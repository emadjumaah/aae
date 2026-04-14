#!/usr/bin/env python3
"""
Arabic Algebra — Tiny Transformer Training

Trains a small seq2seq transformer on algebra token sequences.
Tests the hypothesis: does structured tokenization reduce needed model capacity?

Usage:
  python3 training/train.py                    # train on existing corpus
  python3 training/train.py --data train-expanded.jsonl  # train on expanded corpus
  python3 training/train.py --eval             # evaluate only

Model: ~1M params (d_model=128, 4 heads, 3 encoder + 3 decoder layers)
"""

import json
import argparse
import os
import time
import math
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split

# ─── Config ─────────────────────────────────────────────────────────────────

class Config:
    # Model — scaled for 1800+ vocab, 50K examples
    d_model = 192
    nhead = 6
    num_encoder_layers = 4
    num_decoder_layers = 4
    dim_feedforward = 384
    dropout = 0.1
    max_seq_len = 32

    # Training
    batch_size = 64
    epochs = 80
    lr = 3e-4
    weight_decay = 1e-4
    patience = 12          # early stopping patience

    # Paths
    corpus_dir = Path(__file__).parent.parent / "data" / "corpus"
    model_dir = Path(__file__).parent / "checkpoints"


# ─── Dataset ────────────────────────────────────────────────────────────────

class AlgebraDataset(Dataset):
    def __init__(self, path: Path, max_seq_len: int = 32):
        self.examples = []
        self.max_seq_len = max_seq_len

        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                ex = json.loads(line)
                input_ids = ex["input_ids"]
                output_ids = ex["output_ids"]

                # Pad or truncate
                input_ids = self._pad(input_ids, max_seq_len)
                output_ids = self._pad(output_ids, max_seq_len)

                self.examples.append({
                    "input_ids": input_ids,
                    "output_ids": output_ids,
                })

    def _pad(self, ids: list, max_len: int, pad_id: int = 0) -> list:
        if len(ids) >= max_len:
            return ids[:max_len]
        return ids + [pad_id] * (max_len - len(ids))

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        ex = self.examples[idx]
        return {
            "input_ids": torch.tensor(ex["input_ids"], dtype=torch.long),
            "output_ids": torch.tensor(ex["output_ids"], dtype=torch.long),
        }


# ─── Model ──────────────────────────────────────────────────────────────────

class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 64):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # [1, max_len, d_model]
        self.register_buffer("pe", pe)

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]


class AlgebraTransformer(nn.Module):
    """
    Tiny seq2seq transformer for algebra token reasoning.

    With d_model=128, 4 heads, 3+3 layers, ff=256:
      Embedding:  vocab_size * 128     ≈  60K
      Pos enc:    fixed (0 params)
      Encoder:    3 layers             ≈ 400K
      Decoder:    3 layers             ≈ 530K
      Output:     128 * vocab_size     ≈  60K
      Total:                           ≈ 1.05M params
    """

    def __init__(self, vocab_size: int, cfg: Config):
        super().__init__()
        self.cfg = cfg
        self.embedding = nn.Embedding(vocab_size, cfg.d_model, padding_idx=0)
        self.pos_encoder = PositionalEncoding(cfg.d_model, cfg.max_seq_len)
        self.pos_decoder = PositionalEncoding(cfg.d_model, cfg.max_seq_len)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=cfg.d_model,
            nhead=cfg.nhead,
            dim_feedforward=cfg.dim_feedforward,
            dropout=cfg.dropout,
            batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=cfg.num_encoder_layers)

        decoder_layer = nn.TransformerDecoderLayer(
            d_model=cfg.d_model,
            nhead=cfg.nhead,
            dim_feedforward=cfg.dim_feedforward,
            dropout=cfg.dropout,
            batch_first=True,
        )
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=cfg.num_decoder_layers)

        self.output_proj = nn.Linear(cfg.d_model, vocab_size)

    def _generate_square_subsequent_mask(self, sz: int) -> torch.Tensor:
        mask = torch.triu(torch.ones(sz, sz), diagonal=1).bool()
        return mask

    def forward(self, src: torch.Tensor, tgt: torch.Tensor) -> torch.Tensor:
        """
        src: [batch, src_len] input token IDs
        tgt: [batch, tgt_len] target token IDs (teacher forcing)
        returns: [batch, tgt_len, vocab_size] logits
        """
        # Embeddings + positional encoding
        src_emb = self.pos_encoder(self.embedding(src))
        tgt_emb = self.pos_decoder(self.embedding(tgt))

        # Masks
        src_pad_mask = (src == 0)  # [batch, src_len]
        tgt_pad_mask = (tgt == 0)  # [batch, tgt_len]
        tgt_mask = self._generate_square_subsequent_mask(tgt.size(1)).to(tgt.device)

        # Encode
        memory = self.encoder(src_emb, src_key_padding_mask=src_pad_mask)

        # Decode
        output = self.decoder(
            tgt_emb,
            memory,
            tgt_mask=tgt_mask,
            tgt_key_padding_mask=tgt_pad_mask,
            memory_key_padding_mask=src_pad_mask,
        )

        # Project to vocab
        return self.output_proj(output)

    def count_params(self) -> int:
        return sum(p.numel() for p in self.parameters())

    def count_trainable_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


# ─── Training Loop ──────────────────────────────────────────────────────────

def train_epoch(model, dataloader, optimizer, criterion, device):
    model.train()
    total_loss = 0
    total_correct = 0
    total_tokens = 0

    for batch in dataloader:
        src = batch["input_ids"].to(device)
        tgt = batch["output_ids"].to(device)

        # Teacher forcing: input is tgt[:-1], target is tgt[1:]
        tgt_input = tgt[:, :-1]
        tgt_target = tgt[:, 1:]

        optimizer.zero_grad()
        logits = model(src, tgt_input)  # [batch, tgt_len-1, vocab]

        # Reshape for cross entropy
        logits_flat = logits.reshape(-1, logits.size(-1))
        target_flat = tgt_target.reshape(-1)

        loss = criterion(logits_flat, target_flat)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss += loss.item() * src.size(0)

        # Accuracy (ignore padding)
        preds = logits.argmax(dim=-1)
        mask = tgt_target != 0
        total_correct += ((preds == tgt_target) & mask).sum().item()
        total_tokens += mask.sum().item()

    avg_loss = total_loss / len(dataloader.dataset)
    accuracy = total_correct / total_tokens if total_tokens > 0 else 0
    return avg_loss, accuracy


def eval_epoch(model, dataloader, criterion, device):
    model.eval()
    total_loss = 0
    total_correct = 0
    total_tokens = 0

    with torch.no_grad():
        for batch in dataloader:
            src = batch["input_ids"].to(device)
            tgt = batch["output_ids"].to(device)

            tgt_input = tgt[:, :-1]
            tgt_target = tgt[:, 1:]

            logits = model(src, tgt_input)
            logits_flat = logits.reshape(-1, logits.size(-1))
            target_flat = tgt_target.reshape(-1)

            loss = criterion(logits_flat, target_flat)
            total_loss += loss.item() * src.size(0)

            preds = logits.argmax(dim=-1)
            mask = tgt_target != 0
            total_correct += ((preds == tgt_target) & mask).sum().item()
            total_tokens += mask.sum().item()

    avg_loss = total_loss / len(dataloader.dataset)
    accuracy = total_correct / total_tokens if total_tokens > 0 else 0
    return avg_loss, accuracy


# ─── Inference ──────────────────────────────────────────────────────────────

def greedy_decode(model, src_ids: list, vocab: dict, device, max_len: int = 32) -> list:
    """Generate output tokens autoregressively."""
    model.eval()
    rev_vocab = {v: k for k, v in vocab.items()}

    src = torch.tensor([src_ids], dtype=torch.long).to(device)
    bos_id = vocab.get("<BOS>", 2)
    eos_id = vocab.get("<EOS>", 3)

    tgt_ids = [bos_id]

    with torch.no_grad():
        for _ in range(max_len):
            tgt = torch.tensor([tgt_ids], dtype=torch.long).to(device)
            logits = model(src, tgt)
            next_id = logits[0, -1].argmax().item()
            tgt_ids.append(next_id)
            if next_id == eos_id:
                break

    return [rev_vocab.get(i, f"<{i}>") for i in tgt_ids]


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train Arabic Algebra Tiny Transformer")
    parser.add_argument("--data", default="train.jsonl", help="Training data file in data/corpus/")
    parser.add_argument("--eval", action="store_true", help="Evaluate only (load checkpoint)")
    parser.add_argument("--epochs", type=int, default=None, help="Override number of epochs")
    parser.add_argument("--lr", type=float, default=None, help="Override learning rate")
    args = parser.parse_args()

    cfg = Config()
    if args.epochs:
        cfg.epochs = args.epochs
    if args.lr:
        cfg.lr = args.lr

    device = torch.device("cpu")  # CPU is fine for 1M params
    print(f"Device: {device}")

    # Load vocabulary
    vocab_path = cfg.corpus_dir / "vocabulary.json"
    with open(vocab_path) as f:
        vocab_data = json.load(f)
    vocab = vocab_data["vocab"]
    vocab_size = vocab_data["size"]

    # Load dataset
    data_path = cfg.corpus_dir / args.data
    print(f"Loading data: {data_path}")
    dataset = AlgebraDataset(data_path, max_seq_len=cfg.max_seq_len)
    print(f"Dataset: {len(dataset)} examples")

    # Adjust vocab_size to cover all IDs in the data (dynamic LIT: tokens)
    max_id_in_data = max(
        max(ex["input_ids"].max().item(), ex["output_ids"].max().item())
        for ex in dataset
    )
    if max_id_in_data >= vocab_size:
        vocab_size = max_id_in_data + 1
    print(f"Vocabulary: {vocab_size} tokens (effective)")

    # Split: 85% train, 15% validation
    val_size = max(1, int(len(dataset) * 0.15))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size],
                                     generator=torch.Generator().manual_seed(42))

    train_loader = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=cfg.batch_size)

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

    # Create model
    model = AlgebraTransformer(vocab_size, cfg).to(device)
    print(f"\nModel: {model.count_params():,} total params ({model.count_trainable_params():,} trainable)")

    # Loss — ignore padding (id=0)
    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs)

    # Checkpoint directory
    cfg.model_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = cfg.model_dir / "best_model.pt"

    if args.eval:
        if ckpt_path.exists():
            model.load_state_dict(torch.load(ckpt_path, map_location=device))
            print(f"\nLoaded checkpoint: {ckpt_path}")
        else:
            print(f"No checkpoint found at {ckpt_path}")
            return

        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        print(f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.1%}")

        # Run some example predictions
        print("\n─── Example Predictions ───\n")
        run_examples(model, dataset, vocab, device)
        return

    # ─── Training ─────────────────────────────────────────────────────────

    print(f"\nTraining for {cfg.epochs} epochs (lr={cfg.lr}, batch={cfg.batch_size})\n")

    best_val_loss = float("inf")
    patience_counter = 0

    for epoch in range(1, cfg.epochs + 1):
        t0 = time.time()

        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - t0

        print(
            f"  Epoch {epoch:3d}/{cfg.epochs} | "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc:.1%} | "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc:.1%} | "
            f"{elapsed:.1f}s",
            flush=True,
        )

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), ckpt_path)
        else:
            patience_counter += 1
            if patience_counter >= cfg.patience:
                print(f"\n  Early stopping at epoch {epoch} (patience={cfg.patience})")
                break

    # Load best and final evaluation
    model.load_state_dict(torch.load(ckpt_path, map_location=device))
    val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
    print(f"\n{'='*60}")
    print(f"Best model — Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.1%}")
    print(f"Saved to: {ckpt_path}")
    print(f"Model size: {os.path.getsize(ckpt_path) / 1024:.1f} KB")

    # Example predictions
    print(f"\n─── Example Predictions ───\n")
    run_examples(model, dataset, vocab, device)


def run_examples(model, dataset, vocab, device, n=8):
    """Show some example input→output predictions vs ground truth."""
    rev_vocab = {v: k for k, v in vocab.items()}
    indices = list(range(min(n, len(dataset))))

    for idx in indices:
        ex = dataset[idx]
        src_ids = ex["input_ids"].tolist()
        tgt_ids = ex["output_ids"].tolist()

        # Ground truth tokens (skip padding)
        gt_tokens = [rev_vocab.get(i, f"<{i}>") for i in tgt_ids if i != 0]

        # Predicted tokens
        pred_tokens = greedy_decode(model, src_ids, vocab, device)

        # Input tokens for display
        in_tokens = [rev_vocab.get(i, f"<{i}>") for i in src_ids if i != 0]

        print(f"  Input:    {' '.join(in_tokens)}")
        print(f"  Expected: {' '.join(gt_tokens)}")
        print(f"  Got:      {' '.join(pred_tokens)}")

        # Check action match
        gt_action = next((t for t in gt_tokens if t.startswith("ACT:")), None)
        pred_action = next((t for t in pred_tokens if t.startswith("ACT:")), None)
        match = "✓" if gt_action == pred_action else "✗"
        print(f"  Action:   {match} (expected={gt_action}, got={pred_action})")
        print()


if __name__ == "__main__":
    main()
