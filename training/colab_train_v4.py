#!/usr/bin/env python3
"""Arabic Algebra — Colab Training v4

Trained on REAL data: 132 handcrafted + 33,042 MASSIVE (Amazon NLU).
No fake auto-generated examples. No hardcoded action rules.
The model learns intent→action mapping from honest human data.

Model: ~2.5M params (d_model=192, 6 heads, 4+4 layers)
Data:  33,174 examples (Arabic + English, 14 action types, 26 domains)
Expected: converge in 15-25 epochs, ~10 min on T4 GPU

Upload to Colab:
  1. train-v4.jsonl        (13 MB — training data)
  2. vocabulary-v4.json    (40 KB — token vocabulary)
  3. This file             (colab_train_v4.py)

Then run: !python3 colab_train_v4.py
"""

import json
import os
import time
import math
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split

# ─── Auto-detect paths ─────────────────────────────────────────────────────

def find_data_files():
    candidates = [
        Path("/content"),                                # Colab default
        Path("/content/drive/MyDrive"),                  # Google Drive mount
        Path(__file__).parent.parent / "data" / "corpus",# local dev
        Path("."),
        Path("data/corpus"),
    ]
    for base in candidates:
        vocab_path = base / "vocabulary-v4.json"
        data_path = base / "train-v4.jsonl"
        if vocab_path.exists() and data_path.exists():
            return vocab_path, data_path
    raise FileNotFoundError(
        "Cannot find vocabulary-v4.json and train-v4.jsonl. "
        "Upload both files to /content/ in Colab."
    )

# ─── Config ─────────────────────────────────────────────────────────────────

class Config:
    # Model: ~2.5M params — right-sized for 33K real examples
    d_model = 192
    nhead = 6
    num_encoder_layers = 4
    num_decoder_layers = 4
    dim_feedforward = 384
    dropout = 0.1
    max_seq_len = 32

    # Training
    batch_size = 128         # bumped to 256 on GPU
    epochs = 60
    lr = 3e-4
    weight_decay = 1e-4
    patience = 12            # early stopping patience
    warmup_epochs = 3

    # Label
    label = "v4"

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
                self.examples.append({
                    "input_ids": self._pad(ex["input_ids"], max_seq_len),
                    "output_ids": self._pad(ex["output_ids"], max_seq_len),
                })

    def _pad(self, ids, max_len, pad_id=0):
        return ids[:max_len] if len(ids) >= max_len else ids + [pad_id] * (max_len - len(ids))

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
    def __init__(self, d_model, max_len=64):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class AlgebraTransformer(nn.Module):
    def __init__(self, vocab_size, cfg):
        super().__init__()
        self.cfg = cfg
        self.embedding = nn.Embedding(vocab_size, cfg.d_model, padding_idx=0)
        self.pos_enc = PositionalEncoding(cfg.d_model, cfg.max_seq_len)
        self.pos_dec = PositionalEncoding(cfg.d_model, cfg.max_seq_len)
        enc_layer = nn.TransformerEncoderLayer(
            cfg.d_model, cfg.nhead, cfg.dim_feedforward, cfg.dropout, batch_first=True
        )
        self.encoder = nn.TransformerEncoder(enc_layer, cfg.num_encoder_layers)
        dec_layer = nn.TransformerDecoderLayer(
            cfg.d_model, cfg.nhead, cfg.dim_feedforward, cfg.dropout, batch_first=True
        )
        self.decoder = nn.TransformerDecoder(dec_layer, cfg.num_decoder_layers)
        self.output_proj = nn.Linear(cfg.d_model, vocab_size)

    def forward(self, src, tgt):
        src_emb = self.pos_enc(self.embedding(src))
        tgt_emb = self.pos_dec(self.embedding(tgt))
        tgt_mask = torch.triu(
            torch.ones(tgt.size(1), tgt.size(1)), diagonal=1
        ).bool().to(tgt.device)
        memory = self.encoder(src_emb, src_key_padding_mask=(src == 0))
        out = self.decoder(
            tgt_emb, memory,
            tgt_mask=tgt_mask,
            tgt_key_padding_mask=(tgt == 0),
            memory_key_padding_mask=(src == 0),
        )
        return self.output_proj(out)

    def count_params(self):
        return sum(p.numel() for p in self.parameters())

# ─── Training functions ─────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = total_correct = total_tokens = 0
    for batch in loader:
        src = batch["input_ids"].to(device)
        tgt = batch["output_ids"].to(device)
        tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
        optimizer.zero_grad()
        logits = model(src, tgt_in)
        loss = criterion(logits.reshape(-1, logits.size(-1)), tgt_out.reshape(-1))
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total_loss += loss.item() * src.size(0)
        mask = tgt_out != 0
        total_correct += ((logits.argmax(-1) == tgt_out) & mask).sum().item()
        total_tokens += mask.sum().item()
    return total_loss / len(loader.dataset), total_correct / max(total_tokens, 1)


def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss = total_correct = total_tokens = 0
    with torch.no_grad():
        for batch in loader:
            src = batch["input_ids"].to(device)
            tgt = batch["output_ids"].to(device)
            tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
            logits = model(src, tgt_in)
            loss = criterion(logits.reshape(-1, logits.size(-1)), tgt_out.reshape(-1))
            total_loss += loss.item() * src.size(0)
            mask = tgt_out != 0
            total_correct += ((logits.argmax(-1) == tgt_out) & mask).sum().item()
            total_tokens += mask.sum().item()
    return total_loss / len(loader.dataset), total_correct / max(total_tokens, 1)


def eval_action_accuracy(model, loader, device, rev_vocab):
    """Measure per-action-type accuracy specifically."""
    model.eval()
    correct = total = 0
    action_stats = {}  # action_name → {correct, total}

    with torch.no_grad():
        for batch in loader:
            src = batch["input_ids"].to(device)
            tgt = batch["output_ids"].to(device)
            tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
            preds = model(src, tgt_in).argmax(-1)

            for i in range(tgt_out.size(0)):
                for j in range(tgt_out.size(1)):
                    gt_id = tgt_out[i, j].item()
                    if gt_id == 0:
                        continue
                    tok = rev_vocab.get(gt_id, "")
                    if tok.startswith("ACT:"):
                        total += 1
                        pred_correct = (preds[i, j].item() == gt_id)
                        if pred_correct:
                            correct += 1
                        action = tok[4:]
                        if action not in action_stats:
                            action_stats[action] = {"correct": 0, "total": 0}
                        action_stats[action]["total"] += 1
                        if pred_correct:
                            action_stats[action]["correct"] += 1

    return {
        "overall": correct / max(total, 1),
        "total": total,
        "per_action": {
            k: {"acc": v["correct"] / max(v["total"], 1), "total": v["total"]}
            for k, v in sorted(action_stats.items(), key=lambda x: -x[1]["total"])
        },
    }


def greedy_decode(model, src_ids, vocab, device, max_len=32):
    model.eval()
    rev = {v: k for k, v in vocab.items()}
    src = torch.tensor([src_ids], dtype=torch.long).to(device)
    tgt_ids = [vocab.get("<BOS>", 2)]
    eos = vocab.get("<EOS>", 3)
    with torch.no_grad():
        for _ in range(max_len):
            tgt = torch.tensor([tgt_ids], dtype=torch.long).to(device)
            next_id = model(src, tgt)[0, -1].argmax().item()
            tgt_ids.append(next_id)
            if next_id == eos:
                break
    return [rev.get(i, f"<{i}>") for i in tgt_ids]


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    cfg = Config()
    print("=" * 60)
    print("  Arabic Algebra — Training v4")
    print("  Real data: 132 handcrafted + 33,042 MASSIVE (Amazon)")
    print("  No hardcoded rules. Model learns action mapping.")
    print("=" * 60)

    # Device selection
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Device: {torch.cuda.get_device_name(0)} (CUDA)")
        cfg.batch_size = 256
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
        print("Device: Apple Silicon (MPS)")
        cfg.batch_size = 128
    else:
        device = torch.device("cpu")
        print("Device: CPU (will be slow)")
        cfg.batch_size = 64

    # Load data
    vocab_path, data_path = find_data_files()
    print(f"Vocabulary: {vocab_path}")
    print(f"Data: {data_path}")

    with open(vocab_path) as f:
        vocab_data = json.load(f)
    vocab = vocab_data["vocab"]
    vocab_size = vocab_data["size"]

    dataset = AlgebraDataset(data_path, cfg.max_seq_len)
    print(f"Dataset: {len(dataset):,} examples")

    # Ensure vocab covers all IDs
    max_id = max(
        max(ex["input_ids"].max().item(), ex["output_ids"].max().item())
        for ex in dataset
    )
    if max_id >= vocab_size:
        vocab_size = max_id + 1
    print(f"Vocabulary: {vocab_size} tokens (effective)")

    # Build reverse vocab from data for decoding predictions
    with open(data_path) as f:
        for line in f:
            ex = json.loads(line.strip())
            for tk, ik in [("input_tokens", "input_ids"), ("output_tokens", "output_ids")]:
                for t, i in zip(ex.get(tk, []), ex.get(ik, [])):
                    vocab.setdefault(t, i)

    # Split: 85/15
    val_size = max(1, int(len(dataset) * 0.15))
    train_ds, val_ds = random_split(
        dataset, [len(dataset) - val_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )
    nw = 2 if device.type == "cuda" else 0
    train_loader = DataLoader(
        train_ds, batch_size=cfg.batch_size, shuffle=True,
        num_workers=nw, pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_ds, batch_size=cfg.batch_size,
        num_workers=nw, pin_memory=(device.type == "cuda"),
    )
    print(f"Train: {len(train_ds):,} | Val: {len(val_ds):,} | Batch: {cfg.batch_size}")

    # Create model
    model = AlgebraTransformer(vocab_size, cfg).to(device)
    print(f"Model: {model.count_params():,} params")

    # ─── Compute class weights (inverse frequency) ───────────────────────
    # This forces the model to pay equal attention to rare actions like
    # broadcast/document/coordinate instead of always guessing "query".
    token_counts = torch.zeros(vocab_size)
    for ex in dataset:
        for tid in ex["output_ids"].tolist():
            if tid > 0:
                token_counts[tid] += 1
    # Inverse frequency: weight = total / (num_classes * count)
    # Only weight non-zero tokens; keep PAD weight at 0
    nonzero = token_counts > 0
    weights = torch.zeros(vocab_size)
    total_tokens = token_counts[nonzero].sum()
    num_classes = nonzero.sum()
    weights[nonzero] = total_tokens / (num_classes * token_counts[nonzero])
    # Cap max weight to avoid instability from ultra-rare tokens
    weights = weights.clamp(max=10.0).to(device)
    weights[0] = 0.0  # PAD stays at 0

    # Show action token weights
    act_weights = {}
    for tok, tid in vocab.items():
        if tok.startswith("ACT:") and tid < vocab_size:
            act_weights[tok] = f"{weights[tid].item():.2f}"
    if act_weights:
        print(f"  Action weights: {act_weights}")
    print()

    criterion = nn.CrossEntropyLoss(weight=weights, ignore_index=0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs)

    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"best_model_{cfg.label}.pt"
    full_path = out_dir / f"best_model_{cfg.label}_full.pt"

    # ─── Training loop ────────────────────────────────────────────────────

    print(f"Training for {cfg.epochs} epochs (lr={cfg.lr})\n")
    best_val_loss = float("inf")
    patience_counter = 0
    history = []

    for epoch in range(1, cfg.epochs + 1):
        t0 = time.time()

        # Warmup
        if epoch <= cfg.warmup_epochs:
            for pg in optimizer.param_groups:
                pg["lr"] = cfg.lr * (epoch / cfg.warmup_epochs)

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

        # Checkpoint + early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), ckpt_path)
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
            }, full_path)
        else:
            patience_counter += 1
            if patience_counter >= cfg.patience:
                print(f"\n  Early stopping at epoch {epoch} (patience={cfg.patience})")
                break

    # ─── Final evaluation ─────────────────────────────────────────────────

    model.load_state_dict(torch.load(ckpt_path, map_location=device, weights_only=True))
    val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)

    print(f"\n{'='*60}")
    print(f"  Best — Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.1%}")
    print(f"  Params: {model.count_params():,} | Size: {os.path.getsize(ckpt_path)/1024:.1f} KB")
    print(f"  Saved to: {ckpt_path}")
    print(f"{'='*60}")

    # ─── Action-type accuracy breakdown ───────────────────────────────────

    rev_vocab = {v: k for k, v in vocab.items()}
    action_eval = eval_action_accuracy(model, val_loader, device, rev_vocab)

    print(f"\n─── Action Type Accuracy: {action_eval['overall']:.1%} ({action_eval['total']} tokens) ───")
    for action, stats in action_eval["per_action"].items():
        bar = "█" * int(stats["acc"] * 20)
        print(f"  {action:14s} {stats['acc']:5.1%}  {bar}  ({stats['total']})")

    # ─── Save history ─────────────────────────────────────────────────────

    with open(out_dir / f"history_{cfg.label}.json", "w") as f:
        json.dump(history, f, indent=2)

    # ─── Example predictions ──────────────────────────────────────────────

    print(f"\n─── Example Predictions ───\n")
    for idx in range(min(15, len(dataset))):
        ex = dataset[idx]
        src_ids = ex["input_ids"].tolist()
        tgt_ids = ex["output_ids"].tolist()
        gt = [rev_vocab.get(i, f"<{i}>") for i in tgt_ids if i != 0]
        pred = greedy_decode(model, src_ids, vocab, device, cfg.max_seq_len)
        inp = [rev_vocab.get(i, f"<{i}>") for i in src_ids if i != 0]

        def _first(tokens, prefix):
            return next((t for t in tokens if t.startswith(prefix)), None)

        ga, pa = _first(gt, "ACT:"), _first(pred, "ACT:")
        gr, pr = _first(gt, "R:"), _first(pred, "R:")
        gd, pd = _first(gt, "D:"), _first(pred, "D:")

        act_mark = "✓" if ga == pa else "✗"
        root_mark = "✓" if gr == pr else "✗"
        dom_mark = "✓" if gd == pd else "✗"

        line = f"  [{idx:3d}] {' '.join(inp[:8])}...\n"
        line += f"        Act:{act_mark} {pa}  Root:{root_mark} {pr}  Dom:{dom_mark} {pd}"
        print(line + "\n")

    print(f"\nDone! Download {full_path.name} from checkpoints/")
    print(f"To export ONNX: python3 export_onnx.py checkpoints/{full_path.name}")


if __name__ == "__main__":
    main()
