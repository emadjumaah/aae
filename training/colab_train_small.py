#!/usr/bin/env python3
"""Arabic Algebra — Colab Training: SMALL model (~1.2M params)

Best for: 18K clean dataset. Fast training, small deployment, less overfitting.
Expected: converge in 5-10 epochs, ~5 min on T4, ~5 MB model file.

Upload: train-v3.jsonl + vocabulary-v3.json + this file
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
    candidates = [Path("/content"), Path(__file__).parent.parent / "data" / "corpus", Path("."), Path("data/corpus")]
    for base in candidates:
        vocab_path = base / "vocabulary-v3.json"
        data_path = base / "train-v3.jsonl"
        if vocab_path.exists() and data_path.exists():
            return vocab_path, data_path
    raise FileNotFoundError("Cannot find vocabulary-v3.json and train-v3.jsonl.")

# ─── Config ─────────────────────────────────────────────────────────────────

class Config:
    # SMALL: ~1.2M params — right-sized for 18K examples
    d_model = 128
    nhead = 4
    num_encoder_layers = 3
    num_decoder_layers = 3
    dim_feedforward = 256
    dropout = 0.1
    max_seq_len = 32

    # Training
    batch_size = 128
    epochs = 40
    lr = 5e-4               # higher lr OK for small model
    weight_decay = 1e-4
    patience = 8
    warmup_epochs = 2

    # Label
    label = "small"

# ─── Dataset ────────────────────────────────────────────────────────────────

class AlgebraDataset(Dataset):
    def __init__(self, path: Path, max_seq_len: int = 32):
        self.examples = []
        self.max_seq_len = max_seq_len
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line: continue
                ex = json.loads(line)
                self.examples.append({
                    "input_ids": self._pad(ex["input_ids"], max_seq_len),
                    "output_ids": self._pad(ex["output_ids"], max_seq_len),
                })

    def _pad(self, ids, max_len, pad_id=0):
        return (ids[:max_len] if len(ids) >= max_len else ids + [pad_id] * (max_len - len(ids)))

    def __len__(self): return len(self.examples)

    def __getitem__(self, idx):
        ex = self.examples[idx]
        return {"input_ids": torch.tensor(ex["input_ids"], dtype=torch.long),
                "output_ids": torch.tensor(ex["output_ids"], dtype=torch.long)}

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

    def forward(self, x): return x + self.pe[:, :x.size(1)]

class AlgebraTransformer(nn.Module):
    def __init__(self, vocab_size, cfg):
        super().__init__()
        self.cfg = cfg
        self.embedding = nn.Embedding(vocab_size, cfg.d_model, padding_idx=0)
        self.pos_enc = PositionalEncoding(cfg.d_model, cfg.max_seq_len)
        self.pos_dec = PositionalEncoding(cfg.d_model, cfg.max_seq_len)
        enc_layer = nn.TransformerEncoderLayer(cfg.d_model, cfg.nhead, cfg.dim_feedforward, cfg.dropout, batch_first=True)
        self.encoder = nn.TransformerEncoder(enc_layer, cfg.num_encoder_layers)
        dec_layer = nn.TransformerDecoderLayer(cfg.d_model, cfg.nhead, cfg.dim_feedforward, cfg.dropout, batch_first=True)
        self.decoder = nn.TransformerDecoder(dec_layer, cfg.num_decoder_layers)
        self.output_proj = nn.Linear(cfg.d_model, vocab_size)

    def forward(self, src, tgt):
        src_emb = self.pos_enc(self.embedding(src))
        tgt_emb = self.pos_dec(self.embedding(tgt))
        tgt_mask = torch.triu(torch.ones(tgt.size(1), tgt.size(1)), diagonal=1).bool().to(tgt.device)
        memory = self.encoder(src_emb, src_key_padding_mask=(src == 0))
        out = self.decoder(tgt_emb, memory, tgt_mask=tgt_mask,
                           tgt_key_padding_mask=(tgt == 0), memory_key_padding_mask=(src == 0))
        return self.output_proj(out)

    def count_params(self): return sum(p.numel() for p in self.parameters())

# ─── Training functions ─────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = total_correct = total_tokens = 0
    for batch in loader:
        src, tgt = batch["input_ids"].to(device), batch["output_ids"].to(device)
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
            src, tgt = batch["input_ids"].to(device), batch["output_ids"].to(device)
            tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
            logits = model(src, tgt_in)
            loss = criterion(logits.reshape(-1, logits.size(-1)), tgt_out.reshape(-1))
            total_loss += loss.item() * src.size(0)
            mask = tgt_out != 0
            total_correct += ((logits.argmax(-1) == tgt_out) & mask).sum().item()
            total_tokens += mask.sum().item()
    return total_loss / len(loader.dataset), total_correct / max(total_tokens, 1)

def eval_agent_accuracy(model, loader, device, rev_vocab):
    model.eval()
    counts = {"tool": [0, 0], "next": [0, 0], "step": [0, 0]}
    with torch.no_grad():
        for batch in loader:
            src, tgt = batch["input_ids"].to(device), batch["output_ids"].to(device)
            tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
            preds = model(src, tgt_in).argmax(-1)
            for i in range(tgt_out.size(0)):
                for j in range(tgt_out.size(1)):
                    gt_id = tgt_out[i, j].item()
                    if gt_id == 0: continue
                    tok = rev_vocab.get(gt_id, "")
                    for prefix, key in [("TOOL:", "tool"), ("NEXT:", "next"), ("STEP:", "step"), ("REASON:", "step")]:
                        if tok.startswith(prefix):
                            counts[key][1] += 1
                            if preds[i, j].item() == gt_id: counts[key][0] += 1
    return {k: {"acc": c[0]/max(c[1],1), "total": c[1]} for k, c in counts.items()}

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
            if next_id == eos: break
    return [rev.get(i, f"<{i}>") for i in tgt_ids]

# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    cfg = Config()
    print("=" * 60)
    print(f"  Arabic Algebra — Training [{cfg.label.upper()}] model")
    print("=" * 60)

    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Device: {torch.cuda.get_device_name(0)} (CUDA)")
        cfg.batch_size = 256
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps"); print("Device: Apple Silicon (MPS)"); cfg.batch_size = 128
    else:
        device = torch.device("cpu"); print("Device: CPU (will be slow)"); cfg.batch_size = 64

    vocab_path, data_path = find_data_files()
    print(f"Vocabulary: {vocab_path}\nData: {data_path}")

    with open(vocab_path) as f: vocab_data = json.load(f)
    vocab = vocab_data["vocab"]
    vocab_size = vocab_data["size"]

    dataset = AlgebraDataset(data_path, cfg.max_seq_len)
    print(f"Dataset: {len(dataset)} examples")

    max_id = max(max(ex["input_ids"].max().item(), ex["output_ids"].max().item()) for ex in dataset)
    if max_id >= vocab_size: vocab_size = max_id + 1
    print(f"Vocabulary: {vocab_size} tokens (effective)")

    # Build full reverse vocab from data
    with open(data_path) as f:
        for line in f:
            ex = json.loads(line.strip())
            for tk, ik in [("input_tokens", "input_ids"), ("output_tokens", "output_ids")]:
                for t, i in zip(ex.get(tk, []), ex.get(ik, [])): vocab.setdefault(t, i)

    val_size = max(1, int(len(dataset) * 0.15))
    train_ds, val_ds = random_split(dataset, [len(dataset) - val_size, val_size],
                                     generator=torch.Generator().manual_seed(42))
    nw = 2 if device.type == "cuda" else 0
    train_loader = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True, num_workers=nw, pin_memory=(device.type=="cuda"))
    val_loader = DataLoader(val_ds, batch_size=cfg.batch_size, num_workers=nw, pin_memory=(device.type=="cuda"))
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Batch: {cfg.batch_size}")

    model = AlgebraTransformer(vocab_size, cfg).to(device)
    print(f"Model: {model.count_params():,} total params\n")

    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs)

    out_dir = Path("checkpoints"); out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"best_model_{cfg.label}.pt"
    full_path = out_dir / f"best_model_{cfg.label}_full.pt"

    print(f"Training for {cfg.epochs} epochs (lr={cfg.lr})\n")
    best_val_loss = float("inf"); patience_counter = 0; history = []

    for epoch in range(1, cfg.epochs + 1):
        t0 = time.time()
        if epoch <= cfg.warmup_epochs:
            for pg in optimizer.param_groups: pg["lr"] = cfg.lr * (epoch / cfg.warmup_epochs)

        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        if epoch > cfg.warmup_epochs: scheduler.step()
        elapsed = time.time() - t0

        history.append({"epoch": epoch, "train_loss": train_loss, "train_acc": train_acc,
                        "val_loss": val_loss, "val_acc": val_acc, "time": elapsed})
        print(f"  Epoch {epoch:3d}/{cfg.epochs} | Train Loss: {train_loss:.4f} Acc: {train_acc:.1%} | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc:.1%} | {elapsed:.1f}s", flush=True)

        if val_loss < best_val_loss:
            best_val_loss = val_loss; patience_counter = 0
            torch.save(model.state_dict(), ckpt_path)
            torch.save({"model_state_dict": model.state_dict(), "vocab": vocab, "vocab_size": vocab_size,
                         "config": {"d_model": cfg.d_model, "nhead": cfg.nhead,
                                    "num_encoder_layers": cfg.num_encoder_layers,
                                    "num_decoder_layers": cfg.num_decoder_layers,
                                    "dim_feedforward": cfg.dim_feedforward,
                                    "max_seq_len": cfg.max_seq_len}}, full_path)
        else:
            patience_counter += 1
            if patience_counter >= cfg.patience:
                print(f"\n  Early stopping at epoch {epoch} (patience={cfg.patience})"); break

    # ─── Final evaluation ─────────────────────────────────────────────────

    model.load_state_dict(torch.load(ckpt_path, map_location=device, weights_only=True))
    val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)

    print(f"\n{'='*60}")
    print(f"  [{cfg.label.upper()}] Best — Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.1%}")
    print(f"  Params: {model.count_params():,} | Size: {os.path.getsize(ckpt_path)/1024:.1f} KB")
    print(f"  Saved to: {ckpt_path}")
    print(f"{'='*60}")

    rev_vocab = {v: k for k, v in vocab.items()}
    agent = eval_agent_accuracy(model, val_loader, device, rev_vocab)
    print(f"\n─── Agent Token Accuracy ───")
    for k in ["tool", "next", "step"]:
        print(f"  {k.upper():12s}: {agent[k]['acc']:.1%}  ({agent[k]['total']} tokens)")

    with open(out_dir / f"history_{cfg.label}.json", "w") as f: json.dump(history, f, indent=2)

    print(f"\n─── Example Predictions ───\n")
    for idx in range(min(12, len(dataset))):
        ex = dataset[idx]
        src_ids, tgt_ids = ex["input_ids"].tolist(), ex["output_ids"].tolist()
        gt = [rev_vocab.get(i, f"<{i}>") for i in tgt_ids if i != 0]
        pred = greedy_decode(model, src_ids, vocab, device, cfg.max_seq_len)
        inp = [rev_vocab.get(i, f"<{i}>") for i in src_ids if i != 0]

        def _tok(tokens, prefix): return [t for t in tokens if t.startswith(prefix)]
        def _first(tokens, prefix): return next((t for t in tokens if t.startswith(prefix)), None)

        ga, pa = _first(gt,"ACT:"), _first(pred,"ACT:")
        gr, pr = _first(gt,"R:"), _first(pred,"R:")
        gd, pd = _first(gt,"D:"), _first(pred,"D:")
        gt_tools, pt = _tok(gt,"TOOL:"), _tok(pred,"TOOL:")
        gn, pn = _first(gt,"NEXT:"), _first(pred,"NEXT:")

        line = f"  [{idx}] {' '.join(inp[:8])}...\n"
        line += f"       Act:{'✓' if ga==pa else '✗'} {pa}  Root:{'✓' if gr==pr else '✗'} {pr}  Dom:{'✓' if gd==pd else '✗'} {pd}"
        if gt_tools or pt: line += f"  Tool:{'✓' if gt_tools==pt else '✗'} {pt}"
        if gn or pn: line += f"  Next:{'✓' if gn==pn else '✗'} {pn}"
        print(line + "\n")

    print(f"Done! Download {full_path.name} from checkpoints/")

if __name__ == "__main__":
    main()
