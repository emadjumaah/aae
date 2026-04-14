#!/usr/bin/env python3
"""Arabic Algebra — Google Colab Training Script (v3 — 20M model with CoT)

Self-contained training script for GPU training on Google Colab.
Upload this file + data/corpus/train-merged-v2.jsonl + data/corpus/vocabulary.json

v3: 20M params (d=384, 8 heads, 6+6 layers), 3 domains (64 tools),
    STEP/REASON chain-of-thought tokens, agent accuracy metrics.
    ~95K training examples (51K general + 43K agent = 46% agent).

Usage (in Colab):
  1. Upload files to Colab
  2. !python colab_train.py
  3. Download best_model_full.pt when done

Or run locally if you have a GPU:
  python3 training/colab_train.py
"""

import json
import os
import time
import math
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split

# ─── Auto-detect paths (works in Colab or local) ───────────────────────────

def find_data_files():
    """Find data files whether running in Colab or locally."""
    candidates = [
        # Colab: files uploaded to /content/
        Path("/content"),
        # Local: relative to this script
        Path(__file__).parent.parent / "data" / "corpus",
        # Local: current directory
        Path("."),
        Path("data/corpus"),
    ]
    for base in candidates:
        vocab_path = base / "vocabulary.json"
        # Try v2 merged first (3-domain), then v1 merged, then expanded
        data_path = base / "train-merged-v2.jsonl"
        if not data_path.exists():
            data_path = base / "train-merged.jsonl"
        if not data_path.exists():
            data_path = base / "train-expanded.jsonl"
        if vocab_path.exists() and data_path.exists():
            return vocab_path, data_path
    raise FileNotFoundError(
        "Cannot find vocabulary.json and train-merged.jsonl (or train-expanded.jsonl). "
        "Upload them to Colab or run from the project root."
    )


# ─── Config ─────────────────────────────────────────────────────────────────

class Config:
    # Model — 20M params: 3 domains, 64 tools, STEP/REASON CoT
    d_model = 384
    nhead = 8
    num_encoder_layers = 6
    num_decoder_layers = 6
    dim_feedforward = 768
    dropout = 0.1
    max_seq_len = 48          # longer for chain-of-thought sequences

    # Training — tuned for GPU, ~95K examples
    batch_size = 256         # larger batches on GPU
    epochs = 80
    lr = 2e-4                # slightly lower lr for larger model
    weight_decay = 1e-4
    patience = 15             # more patience for larger model
    warmup_epochs = 8         # longer warmup for stability


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
        pe = pe.unsqueeze(0)
        self.register_buffer("pe", pe)

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]


class AlgebraTransformer(nn.Module):
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
        src_emb = self.pos_encoder(self.embedding(src))
        tgt_emb = self.pos_decoder(self.embedding(tgt))
        src_pad_mask = (src == 0)
        tgt_pad_mask = (tgt == 0)
        tgt_mask = self._generate_square_subsequent_mask(tgt.size(1)).to(tgt.device)
        memory = self.encoder(src_emb, src_key_padding_mask=src_pad_mask)
        output = self.decoder(
            tgt_emb, memory,
            tgt_mask=tgt_mask,
            tgt_key_padding_mask=tgt_pad_mask,
            memory_key_padding_mask=src_pad_mask,
        )
        return self.output_proj(output)

    def count_params(self) -> int:
        return sum(p.numel() for p in self.parameters())


# ─── Training ───────────────────────────────────────────────────────────────

def train_epoch(model, dataloader, optimizer, criterion, device):
    model.train()
    total_loss = 0
    total_correct = 0
    total_tokens = 0

    for batch in dataloader:
        src = batch["input_ids"].to(device)
        tgt = batch["output_ids"].to(device)
        tgt_input = tgt[:, :-1]
        tgt_target = tgt[:, 1:]

        optimizer.zero_grad()
        logits = model(src, tgt_input)
        logits_flat = logits.reshape(-1, logits.size(-1))
        target_flat = tgt_target.reshape(-1)
        loss = criterion(logits_flat, target_flat)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss += loss.item() * src.size(0)
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


def eval_agent_accuracy(model, dataloader, device, rev_vocab):
    """Evaluate TOOL/NEXT/STEP token accuracy separately from overall accuracy."""
    model.eval()
    tool_correct = 0
    tool_total = 0
    next_correct = 0
    next_total = 0
    step_correct = 0
    step_total = 0

    with torch.no_grad():
        for batch in dataloader:
            src = batch["input_ids"].to(device)
            tgt = batch["output_ids"].to(device)
            tgt_input = tgt[:, :-1]
            tgt_target = tgt[:, 1:]
            logits = model(src, tgt_input)
            preds = logits.argmax(dim=-1)

            for i in range(tgt_target.size(0)):
                for j in range(tgt_target.size(1)):
                    gt_id = tgt_target[i, j].item()
                    if gt_id == 0:
                        continue
                    gt_tok = rev_vocab.get(gt_id, "")
                    pred_id = preds[i, j].item()

                    if gt_tok.startswith("TOOL:"):
                        tool_total += 1
                        if pred_id == gt_id:
                            tool_correct += 1
                    elif gt_tok.startswith("NEXT:"):
                        next_total += 1
                        if pred_id == gt_id:
                            next_correct += 1
                    elif gt_tok.startswith("STEP:") or gt_tok.startswith("REASON:"):
                        step_total += 1
                        if pred_id == gt_id:
                            step_correct += 1

    return {
        "tool_acc": tool_correct / tool_total if tool_total > 0 else 0,
        "tool_total": tool_total,
        "next_acc": next_correct / next_total if next_total > 0 else 0,
        "next_total": next_total,
        "step_acc": step_correct / step_total if step_total > 0 else 0,
        "step_total": step_total,
    }


def greedy_decode(model, src_ids: list, vocab: dict, device, max_len: int = 48) -> list:
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
    print("=" * 60)
    print("  Arabic Algebra — Training (GPU-accelerated)")
    print("=" * 60)

    cfg = Config()

    # Device — auto-detect GPU
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Device: {torch.cuda.get_device_name(0)} (CUDA)")
        # Use larger batch on GPU
        cfg.batch_size = 256
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
        print(f"Device: Apple Silicon (MPS)")
        cfg.batch_size = 128
    else:
        device = torch.device("cpu")
        print(f"Device: CPU (will be slow)")
        cfg.batch_size = 64

    # Find data files
    vocab_path, data_path = find_data_files()
    print(f"Vocabulary: {vocab_path}")
    print(f"Data: {data_path}")

    # Load vocabulary
    with open(vocab_path) as f:
        vocab_data = json.load(f)
    vocab = vocab_data["vocab"]
    vocab_size = vocab_data["size"]

    # Load dataset
    dataset = AlgebraDataset(data_path, max_seq_len=cfg.max_seq_len)
    print(f"Dataset: {len(dataset)} examples")

    # Effective vocab size
    max_id_in_data = max(
        max(ex["input_ids"].max().item(), ex["output_ids"].max().item())
        for ex in dataset
    )
    if max_id_in_data >= vocab_size:
        vocab_size = max_id_in_data + 1
    print(f"Vocabulary: {vocab_size} tokens (effective)")

    # Build reverse vocab from corpus for decoding
    with open(data_path) as f:
        for line in f:
            ex = json.loads(line.strip())
            for tok_key, ids_key in [("input_tokens", "input_ids"), ("output_tokens", "output_ids")]:
                tokens = ex.get(tok_key, [])
                ids = ex.get(ids_key, [])
                for t, i in zip(tokens, ids):
                    if t not in vocab:
                        vocab[t] = i

    # Split
    val_size = max(1, int(len(dataset) * 0.15))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(
        dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )

    num_workers = 2 if device.type == "cuda" else 0
    train_loader = DataLoader(
        train_ds, batch_size=cfg.batch_size, shuffle=True,
        num_workers=num_workers, pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_ds, batch_size=cfg.batch_size,
        num_workers=num_workers, pin_memory=(device.type == "cuda"),
    )

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Batch: {cfg.batch_size}")

    # Model
    model = AlgebraTransformer(vocab_size, cfg).to(device)
    print(f"Model: {model.count_params():,} total params")

    # Loss & optimizer
    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs)

    # Output dir
    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / "best_model.pt"

    # ─── Training loop ────────────────────────────────────────────────────

    print(f"\nTraining for {cfg.epochs} epochs (lr={cfg.lr})\n")

    best_val_loss = float("inf")
    best_val_acc = 0
    patience_counter = 0
    history = []

    for epoch in range(1, cfg.epochs + 1):
        t0 = time.time()

        # Warmup: linear lr ramp for first N epochs
        if epoch <= cfg.warmup_epochs:
            warmup_lr = cfg.lr * (epoch / cfg.warmup_epochs)
            for pg in optimizer.param_groups:
                pg["lr"] = warmup_lr

        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)

        if epoch > cfg.warmup_epochs:
            scheduler.step()

        elapsed = time.time() - t0
        history.append({
            "epoch": epoch, "train_loss": train_loss, "train_acc": train_acc,
            "val_loss": val_loss, "val_acc": val_acc, "time": elapsed,
        })

        print(
            f"  Epoch {epoch:3d}/{cfg.epochs} | "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc:.1%} | "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc:.1%} | "
            f"{elapsed:.1f}s",
            flush=True,
        )

        # Save best
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            patience_counter = 0
            torch.save(model.state_dict(), ckpt_path)
            # Also save vocab mapping for inference
            torch.save({
                "model_state_dict": model.state_dict(),
                "vocab": vocab,
                "vocab_size": vocab_size,
                "config": {
                    "d_model": cfg.d_model,
                    "nhead": cfg.nhead,
                    "num_encoder_layers": cfg.num_encoder_layers,
                    "num_decoder_layers": cfg.num_decoder_layers,
                    "dim_feedforward": cfg.dim_feedforward,
                    "max_seq_len": cfg.max_seq_len,
                },
            }, out_dir / "best_model_full.pt")
        else:
            patience_counter += 1
            if patience_counter >= cfg.patience:
                print(f"\n  Early stopping at epoch {epoch} (patience={cfg.patience})")
                break

    # ─── Final evaluation ─────────────────────────────────────────────────

    model.load_state_dict(torch.load(ckpt_path, map_location=device, weights_only=True))
    val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)

    print(f"\n{'=' * 60}")
    print(f"  Best model — Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.1%}")
    print(f"  Saved to: {ckpt_path}")
    print(f"  Model size: {os.path.getsize(ckpt_path) / 1024:.1f} KB")
    print(f"{'=' * 60}")

    # ─── Agent token accuracy ─────────────────────────────────────────────

    rev_vocab = {v: k for k, v in vocab.items()}
    agent_metrics = eval_agent_accuracy(model, val_loader, device, rev_vocab)
    print(f"\n─── Agent Token Accuracy ───")
    print(f"  TOOL:   {agent_metrics['tool_acc']:.1%}  ({agent_metrics['tool_total']} tokens)")
    print(f"  NEXT:   {agent_metrics['next_acc']:.1%}  ({agent_metrics['next_total']} tokens)")
    print(f"  STEP/REASON: {agent_metrics['step_acc']:.1%}  ({agent_metrics['step_total']} tokens)")

    # Save training history
    with open(out_dir / "history.json", "w") as f:
        json.dump(history, f, indent=2)

    # Example predictions
    print(f"\n─── Example Predictions ───\n")
    rev_vocab = {v: k for k, v in vocab.items()}

    for idx in range(min(12, len(dataset))):
        ex = dataset[idx]
        src_ids = ex["input_ids"].tolist()
        tgt_ids = ex["output_ids"].tolist()

        gt_tokens = [rev_vocab.get(i, f"<{i}>") for i in tgt_ids if i != 0]
        pred_tokens = greedy_decode(model, src_ids, vocab, device, max_len=cfg.max_seq_len)
        in_tokens = [rev_vocab.get(i, f"<{i}>") for i in src_ids if i != 0]

        gt_action = next((t for t in gt_tokens if t.startswith("ACT:")), None)
        pred_action = next((t for t in pred_tokens if t.startswith("ACT:")), None)
        gt_root = next((t for t in gt_tokens if t.startswith("R:") and not t.startswith("RL:")), None)
        pred_root = next((t for t in pred_tokens if t.startswith("R:") and not t.startswith("RL:")), None)
        gt_domain = next((t for t in gt_tokens if t.startswith("D:")), None)
        pred_domain = next((t for t in pred_tokens if t.startswith("D:")), None)
        gt_tools = [t for t in gt_tokens if t.startswith("TOOL:")]
        pred_tools = [t for t in pred_tokens if t.startswith("TOOL:")]
        gt_next = next((t for t in gt_tokens if t.startswith("NEXT:")), None)
        pred_next = next((t for t in pred_tokens if t.startswith("NEXT:")), None)
        gt_steps = [t for t in gt_tokens if t.startswith("STEP:")]
        pred_steps = [t for t in pred_tokens if t.startswith("STEP:")]
        gt_reasons = [t for t in gt_tokens if t.startswith("REASON:")]
        pred_reasons = [t for t in pred_tokens if t.startswith("REASON:")]

        action_ok = "✓" if gt_action == pred_action else "✗"
        root_ok = "✓" if gt_root == pred_root else "✗"
        domain_ok = "✓" if gt_domain == pred_domain else "✗"

        print(f"  [{idx}] Input: {' '.join(in_tokens[:8])}...")
        line = f"       Action: {action_ok} {pred_action}  Root: {root_ok} {pred_root}  Domain: {domain_ok} {pred_domain}"
        if gt_tools or pred_tools:
            tool_ok = "✓" if gt_tools == pred_tools else "✗"
            line += f"  Tools: {tool_ok} {pred_tools}"
        if gt_next or pred_next:
            next_ok = "✓" if gt_next == pred_next else "✗"
            line += f"  Next: {next_ok} {pred_next}"
        if gt_steps or pred_steps:
            step_ok = "✓" if gt_steps == pred_steps else "✗"
            line += f"\n       Steps: {step_ok} {pred_steps}  Reasons: {pred_reasons}"
        print(line)
        print()

    print("Done! Download best_model_full.pt from checkpoints/")
    print(f"Files to upload to Colab: train-merged-v2.jsonl + vocabulary.json + colab_train.py")


if __name__ == "__main__":
    main()
