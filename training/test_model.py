#!/usr/bin/env python3
"""Test the trained Arabic Algebra model — proper evaluation.

Three test modes:
  1. Holdout eval     — sample 200 unseen examples from training data, measure token accuracy
  2. Per-token audit  — break down ACT, ROOT, DOMAIN, TOOL, NEXT, STEP accuracy
  3. Greedy decode    — show full autoregressive output for hand-picked inputs

Usage:
  python3 training/test_model.py                                    # default: small model
  python3 training/test_model.py training/checkpoints/best_model_medium_full.pt
"""

import json
import sys
import math
import random
from pathlib import Path
from collections import defaultdict

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# ─── Model (must match training architecture) ──────────────────────────────

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
        self.embedding = nn.Embedding(vocab_size, cfg["d_model"], padding_idx=0)
        self.pos_enc = PositionalEncoding(cfg["d_model"], cfg["max_seq_len"])
        self.pos_dec = PositionalEncoding(cfg["d_model"], cfg["max_seq_len"])
        enc_layer = nn.TransformerEncoderLayer(cfg["d_model"], cfg["nhead"], cfg["dim_feedforward"], 0.1, batch_first=True)
        self.encoder = nn.TransformerEncoder(enc_layer, cfg["num_encoder_layers"])
        dec_layer = nn.TransformerDecoderLayer(cfg["d_model"], cfg["nhead"], cfg["dim_feedforward"], 0.1, batch_first=True)
        self.decoder = nn.TransformerDecoder(dec_layer, cfg["num_decoder_layers"])
        self.output_proj = nn.Linear(cfg["d_model"], vocab_size)

    def forward(self, src, tgt):
        src_emb = self.pos_enc(self.embedding(src))
        tgt_emb = self.pos_dec(self.embedding(tgt))
        tgt_mask = torch.triu(torch.ones(tgt.size(1), tgt.size(1)), diagonal=1).bool().to(tgt.device)
        memory = self.encoder(src_emb, src_key_padding_mask=(src == 0))
        out = self.decoder(tgt_emb, memory, tgt_mask=tgt_mask,
                           tgt_key_padding_mask=(tgt == 0), memory_key_padding_mask=(src == 0))
        return self.output_proj(out)

# ─── Dataset ────────────────────────────────────────────────────────────────

class AlgebraDataset(Dataset):
    def __init__(self, examples, max_seq_len=32):
        self.examples = []
        for ex in examples:
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

# ─── Greedy decode ──────────────────────────────────────────────────────────

def greedy_decode(model, src_ids, vocab, rev_vocab, device, max_len=32):
    model.eval()
    src = torch.tensor([src_ids], dtype=torch.long).to(device)
    bos, eos = vocab.get("<BOS>", 2), vocab.get("<EOS>", 3)
    tgt_ids = [bos]
    with torch.no_grad():
        for _ in range(max_len):
            tgt = torch.tensor([tgt_ids], dtype=torch.long).to(device)
            next_id = model(src, tgt)[0, -1].argmax().item()
            tgt_ids.append(next_id)
            if next_id == eos:
                break
    return [rev_vocab.get(i, f"<{i}>") for i in tgt_ids]

def pad(ids, max_len=32, pad_id=0):
    return (ids[:max_len] if len(ids) >= max_len else ids + [pad_id] * (max_len - len(ids)))

# ─── Colors ─────────────────────────────────────────────────────────────────

GREEN = "\033[32m"; RED = "\033[31m"; CYAN = "\033[36m"
YELLOW = "\033[33m"; DIM = "\033[2m"; BOLD = "\033[1m"; RESET = "\033[0m"

# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    ckpt_path = sys.argv[1] if len(sys.argv) > 1 else "training/checkpoints/best_model_small_full.pt"

    # Find data file
    data_path = None
    for p in [Path("data/corpus/train-v3.jsonl"), Path(__file__).parent.parent / "data" / "corpus" / "train-v3.jsonl"]:
        if p.exists():
            data_path = p; break
    if not data_path:
        print("Cannot find train-v3.jsonl"); sys.exit(1)

    # Load model
    print(f"\n{BOLD}Loading:{RESET} {ckpt_path}")
    device = torch.device("cpu")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    vocab, vocab_size, cfg = ckpt["vocab"], ckpt["vocab_size"], ckpt["config"]
    rev_vocab = {v: k for k, v in vocab.items()}

    model = AlgebraTransformer(vocab_size, cfg).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    params = sum(p.numel() for p in model.parameters())
    size_kb = sum(p.nelement() * p.element_size() for p in model.parameters()) / 1024
    print(f"{BOLD}Model:{RESET}   {params:,} params | {size_kb:.0f} KB | vocab: {vocab_size}")
    print(f"{BOLD}Config:{RESET}  d={cfg['d_model']}, heads={cfg['nhead']}, enc={cfg['num_encoder_layers']}, dec={cfg['num_decoder_layers']}")

    # Load data — same 85/15 split as training (seed=42)
    all_examples = []
    with open(data_path) as f:
        for line in f:
            all_examples.append(json.loads(line.strip()))

    random.seed(42)
    indices = list(range(len(all_examples)))
    random.shuffle(indices)
    val_size = max(1, int(len(all_examples) * 0.15))
    val_indices = indices[len(all_examples) - val_size:]
    val_examples = [all_examples[i] for i in val_indices]

    print(f"{BOLD}Data:{RESET}    {len(all_examples)} total, {len(val_examples)} val (15%, seed=42)")

    # ═══════════════════════════════════════════════════════════════════════
    # TEST 1: Teacher-forced token accuracy on validation set
    # ═══════════════════════════════════════════════════════════════════════

    print(f"\n{'='*70}")
    print(f"  {BOLD}TEST 1: Token Accuracy (teacher-forced, full val set){RESET}")
    print(f"{'='*70}")

    val_ds = AlgebraDataset(val_examples, cfg["max_seq_len"])
    val_loader = DataLoader(val_ds, batch_size=256)

    total_correct = total_tokens = 0
    # Per-prefix accuracy
    prefix_stats = defaultdict(lambda: [0, 0])  # [correct, total]

    with torch.no_grad():
        for batch in val_loader:
            src = batch["input_ids"].to(device)
            tgt = batch["output_ids"].to(device)
            tgt_in, tgt_out = tgt[:, :-1], tgt[:, 1:]
            logits = model(src, tgt_in)
            preds = logits.argmax(-1)
            mask = tgt_out != 0

            total_correct += ((preds == tgt_out) & mask).sum().item()
            total_tokens += mask.sum().item()

            # Per-token-type breakdown
            for i in range(tgt_out.size(0)):
                for j in range(tgt_out.size(1)):
                    gt_id = tgt_out[i, j].item()
                    if gt_id == 0: continue
                    tok = rev_vocab.get(gt_id, "")
                    prefix = tok.split(":")[0] + ":" if ":" in tok else tok
                    is_correct = preds[i, j].item() == gt_id
                    prefix_stats[prefix][1] += 1
                    if is_correct:
                        prefix_stats[prefix][0] += 1

    overall_acc = total_correct / max(total_tokens, 1)
    print(f"\n  {BOLD}Overall:{RESET} {GREEN}{overall_acc:.1%}{RESET} ({total_correct:,}/{total_tokens:,} tokens)\n")

    # Sort by token count descending
    print(f"  {'Token Type':<14} {'Accuracy':>9} {'Correct':>9} {'Total':>9}")
    print(f"  {'─'*14} {'─'*9} {'─'*9} {'─'*9}")
    for prefix in sorted(prefix_stats.keys(), key=lambda k: prefix_stats[k][1], reverse=True):
        c, t = prefix_stats[prefix]
        acc = c / max(t, 1)
        color = GREEN if acc >= 0.8 else YELLOW if acc >= 0.5 else RED
        print(f"  {prefix:<14} {color}{acc:>8.1%}{RESET} {c:>9,} {t:>9,}")

    # ═══════════════════════════════════════════════════════════════════════
    # TEST 2: Greedy decode accuracy (autoregressive, no teacher forcing)
    # ═══════════════════════════════════════════════════════════════════════

    print(f"\n{'='*70}")
    print(f"  {BOLD}TEST 2: Greedy Decode (autoregressive, 200 val samples){RESET}")
    print(f"{'='*70}")

    sample = val_examples[:200]
    decode_stats = defaultdict(lambda: [0, 0])  # per-prefix [match, total]
    full_match = 0

    for ex in sample:
        src_ids = pad(ex["input_ids"], cfg["max_seq_len"])
        gt_tokens = [t for t in ex["output_tokens"] if t not in ("<PAD>", "<BOS>", "<EOS>")]
        pred_tokens = greedy_decode(model, src_ids, vocab, rev_vocab, device, cfg["max_seq_len"])
        pred_clean = [t for t in pred_tokens if t not in ("<PAD>", "<BOS>", "<EOS>")]

        # Build prefix→value maps for comparison
        gt_map = defaultdict(list)
        pred_map = defaultdict(list)
        for t in gt_tokens:
            prefix = t.split(":")[0] + ":" if ":" in t else t
            gt_map[prefix].append(t)
        for t in pred_clean:
            prefix = t.split(":")[0] + ":" if ":" in t else t
            pred_map[prefix].append(t)

        # Check each ground truth token type
        all_match = True
        for prefix, gt_vals in gt_map.items():
            decode_stats[prefix][1] += 1
            if pred_map.get(prefix) == gt_vals:
                decode_stats[prefix][0] += 1
            else:
                all_match = False
        if all_match:
            full_match += 1

    print(f"\n  {BOLD}Full sequence match:{RESET} {GREEN}{full_match}/{len(sample)} ({full_match/len(sample):.1%}){RESET}\n")

    print(f"  {'Token Type':<14} {'Match':>9} {'Correct':>9} {'Total':>9}")
    print(f"  {'─'*14} {'─'*9} {'─'*9} {'─'*9}")
    for prefix in sorted(decode_stats.keys(), key=lambda k: decode_stats[k][1], reverse=True):
        c, t = decode_stats[prefix]
        acc = c / max(t, 1)
        color = GREEN if acc >= 0.8 else YELLOW if acc >= 0.5 else RED
        print(f"  {prefix:<14} {color}{acc:>8.1%}{RESET} {c:>9,} {t:>9,}")

    # ═══════════════════════════════════════════════════════════════════════
    # TEST 3: Example outputs (hand-picked interesting cases)
    # ═══════════════════════════════════════════════════════════════════════

    print(f"\n{'='*70}")
    print(f"  {BOLD}TEST 3: Example Predictions{RESET}")
    print(f"{'='*70}\n")

    # Pick diverse examples: some agent (TOOL), some general, some chain (STEP)
    show_examples = []
    by_type = {"tool": [], "chain": [], "general": []}
    for ex in val_examples:
        out = ex["output_tokens"]
        has_step = any(t.startswith("STEP:") for t in out)
        has_tool = any(t.startswith("TOOL:") for t in out)
        if has_step and len(by_type["chain"]) < 3:
            by_type["chain"].append(ex)
        elif has_tool and len(by_type["tool"]) < 5:
            by_type["tool"].append(ex)
        elif not has_tool and len(by_type["general"]) < 4:
            by_type["general"].append(ex)

    for category, label in [("tool", "Agent (tool routing)"), ("chain", "Chain (multi-step)"), ("general", "General (domain only)")]:
        if not by_type[category]: continue
        print(f"  {BOLD}── {label} ──{RESET}\n")
        for ex in by_type[category]:
            src_ids = pad(ex["input_ids"], cfg["max_seq_len"])
            gt = [t for t in ex["output_tokens"] if t not in ("<PAD>",)]
            pred = greedy_decode(model, src_ids, vocab, rev_vocab, device, cfg["max_seq_len"])
            inp = [t for t in ex["input_tokens"] if t not in ("<PAD>",)]

            def _get(tokens, prefix):
                return [t for t in tokens if t.startswith(prefix)]

            # Compare each field
            fields = [("ACT:", "Act"), ("R:", "Root"), ("D:", "Dom"), ("TOOL:", "Tool"), ("NEXT:", "Next"), ("STEP:", "Step")]
            parts = []
            for prefix, name in fields:
                gv, pv = _get(gt, prefix), _get(pred, prefix)
                if not gv and not pv: continue
                ok = gv == pv
                mark = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
                pv_str = ",".join(pv) if pv else "—"
                parts.append(f"{name}:{mark}{pv_str}")

            print(f"    {DIM}In:{RESET}  {' '.join(inp)}")
            print(f"    {DIM}GT:{RESET}  {' '.join(gt)}")
            print(f"    {DIM}PR:{RESET}  {' '.join(pred)}")
            print(f"    {'  '.join(parts)}")
            print()

    print(f"{'='*70}")
    print(f"  {BOLD}Summary{RESET}")
    print(f"  Token accuracy (teacher-forced): {GREEN}{overall_acc:.1%}{RESET}")
    print(f"  Full decode match (autoregressive): {GREEN}{full_match}/{len(sample)} ({full_match/len(sample):.1%}){RESET}")
    print(f"{'='*70}\n")

if __name__ == "__main__":
    main()
