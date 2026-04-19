#!/usr/bin/env python3
"""Interactive Arabic Algebra model tester.

Loads the trained model, takes arbitrary text input, pipes it through
the TypeScript encoder (via npx tsx), then runs model inference.

Usage:
  python3 training/interactive_test.py
  python3 training/interactive_test.py training/checkpoints/best_model_v4_full.pt
"""

import json
import math
import subprocess
import sys
from pathlib import Path

import torch
import torch.nn as nn

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


def greedy_decode(model, src_ids, vocab, rev_vocab, device, max_len=32):
    model.eval()
    src = torch.tensor([src_ids], dtype=torch.long).to(device)
    bos, eos = vocab.get("<BOS>", 2), vocab.get("<EOS>", 3)
    tgt_ids = [bos]
    with torch.no_grad():
        for _ in range(max_len):
            tgt = torch.tensor([tgt_ids], dtype=torch.long).to(device)
            logits = model(src, tgt)
            next_id = logits[0, -1].argmax().item()
            tgt_ids.append(next_id)
            if next_id == eos:
                break
    return [rev_vocab.get(i, f"<{i}>") for i in tgt_ids]


def pad(ids, max_len=32, pad_id=0):
    return ids[:max_len] if len(ids) >= max_len else ids + [pad_id] * (max_len - ids.__len__())


# ─── Colors ─────────────────────────────────────────────────────────────────

GREEN = "\033[32m"; RED = "\033[31m"; CYAN = "\033[36m"
YELLOW = "\033[33m"; DIM = "\033[2m"; BOLD = "\033[1m"; RESET = "\033[0m"


# ─── Encode via TypeScript ──────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def encode_text(text: str) -> dict | None:
    """Call the TypeScript encoder via subprocess."""
    try:
        result = subprocess.run(
            ["npx", "tsx", "src/_encode_stdin.ts"],
            input=text + "\n",
            capture_output=True,
            text=True,
            timeout=15,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0:
            print(f"  {RED}Encoder error:{RESET} {result.stderr.strip()}")
            return None
        output = result.stdout.strip()
        if not output:
            print(f"  {RED}Encoder returned empty output{RESET}")
            return None
        return json.loads(output)
    except subprocess.TimeoutExpired:
        print(f"  {RED}Encoder timed out{RESET}")
        return None
    except json.JSONDecodeError as e:
        print(f"  {RED}JSON parse error:{RESET} {e}")
        return None


def main():
    ckpt_path = sys.argv[1] if len(sys.argv) > 1 else "training/checkpoints/best_model_v4_full.pt"

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"  {BOLD}Arabic Algebra — Interactive Model Tester{RESET}")
    print(f"{'='*60}")

    # Load model
    print(f"\n  Loading: {ckpt_path}")
    device = torch.device("cpu")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    vocab = ckpt["vocab"]
    vocab_size = ckpt["vocab_size"]
    cfg = ckpt["config"]
    rev_vocab = {v: k for k, v in vocab.items()}

    model = AlgebraTransformer(vocab_size, cfg).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    params = sum(p.numel() for p in model.parameters())
    print(f"  Model: {params:,} params | d={cfg['d_model']}, heads={cfg['nhead']}")
    print(f"  Vocab: {vocab_size} tokens")
    print(f"\n  Type Arabic or English text. Type 'quit' to exit.\n")
    print(f"{'='*60}\n")

    while True:
        try:
            text = input(f"{BOLD}> {RESET}").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not text:
            continue
        if text.lower() in ("quit", "exit", "q"):
            print("Bye!")
            break

        # Step 1: Encode through TypeScript
        encoded = encode_text(text)
        if not encoded:
            continue
        if "error" in encoded:
            print(f"  {RED}Encode failed:{RESET} {encoded['error']}")
            continue

        # Step 2: Show encoding
        print(f"\n  {DIM}── Encoder ──{RESET}")
        print(f"  Root: {CYAN}{encoded['root']}{RESET} ({encoded['rootLatin']})")
        print(f"  Intent: {CYAN}{encoded['intent']}{RESET} | Pattern: {CYAN}{encoded['pattern']}{RESET}")
        if encoded.get('verbForm'):
            print(f"  Verb Form: {encoded['verbForm']}", end="")
            if encoded.get('tense'):
                print(f" | Tense: {encoded['tense']}", end="")
            print()
        print(f"  Tokens: {' '.join(encoded['input_tokens'])}")

        # Step 3: Run model
        src_ids = pad(encoded["input_ids"], cfg["max_seq_len"])
        pred_tokens = greedy_decode(model, src_ids, vocab, rev_vocab, device, cfg["max_seq_len"])
        pred_clean = [t for t in pred_tokens if t not in ("<PAD>", "<BOS>", "<EOS>")]

        # Step 4: Parse prediction
        print(f"\n  {DIM}── Model Output ──{RESET}")

        action = next((t for t in pred_clean if t.startswith("ACT:")), None)
        root = next((t for t in pred_clean if t.startswith("R:")), None)
        domain = next((t for t in pred_clean if t.startswith("D:")), None)
        conf = next((t for t in pred_clean if t.startswith("CONF:")), None)
        mods = [t for t in pred_clean if t.startswith("MK:") or t.startswith("MV:") or t.startswith("LIT:")]

        if action:
            act_name = action.split(":")[1]
            print(f"  Action: {GREEN}{BOLD}{act_name}{RESET}")
        if root:
            print(f"  Root:   {CYAN}{root.split(':')[1]}{RESET}")
        if domain:
            print(f"  Domain: {CYAN}{domain.split(':')[1]}{RESET}")
        if conf:
            print(f"  Conf:   {conf.split(':')[1]}")
        if mods:
            print(f"  Mods:   {' '.join(mods)}")

        print(f"  {DIM}Raw: {' '.join(pred_tokens)}{RESET}")
        print()


if __name__ == "__main__":
    main()
