#!/usr/bin/env python3
"""Export the trained Arabic Algebra model to ONNX for browser inference.

Creates:
  - model.onnx        (the model, ~6 MB)
  - vocab.json         (token↔id mappings for JS)

Usage: python3 training/export_onnx.py [checkpoint_path]
"""

import json
import math
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

# ─── Export ─────────────────────────────────────────────────────────────────

def main():
    ckpt_path = sys.argv[1] if len(sys.argv) > 1 else "training/checkpoints/best_model_small_full.pt"
    out_dir = Path("web/public/model")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    vocab, vocab_size, cfg = ckpt["vocab"], ckpt["vocab_size"], ckpt["config"]

    model = AlgebraTransformer(vocab_size, cfg)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    params = sum(p.numel() for p in model.parameters())
    print(f"Model: {params:,} params | vocab: {vocab_size}")
    print(f"Config: {cfg}")

    # ─── Export ONNX ────────────────────────────────────────────────────
    max_seq = cfg["max_seq_len"]
    dummy_src = torch.randint(1, vocab_size, (1, max_seq))
    dummy_tgt = torch.randint(1, vocab_size, (1, max_seq))

    onnx_path = out_dir / "model.onnx"
    print(f"\nExporting to {onnx_path}...")

    torch.onnx.export(
        model,
        (dummy_src, dummy_tgt),
        str(onnx_path),
        input_names=["src", "tgt"],
        output_names=["logits"],
        dynamic_axes={
            "src": {0: "batch", 1: "src_len"},
            "tgt": {0: "batch", 1: "tgt_len"},
            "logits": {0: "batch", 1: "tgt_len"},
        },
        opset_version=17,
        do_constant_folding=True,
    )

    onnx_size = onnx_path.stat().st_size / 1024
    print(f"ONNX saved: {onnx_size:.0f} KB")

    # ─── Export vocab for JS ────────────────────────────────────────────
    # id→token mapping (reverse vocab)
    rev_vocab = {str(v): k for k, v in vocab.items()}

    vocab_out = {
        "vocab": vocab,           # token→id
        "rev_vocab": rev_vocab,   # id→token (string keys for JSON)
        "size": vocab_size,
        "config": cfg,
        "special": {
            "PAD": vocab.get("<PAD>", 0),
            "UNK": vocab.get("<UNK>", 1),
            "BOS": vocab.get("<BOS>", 2),
            "EOS": vocab.get("<EOS>", 3),
        },
    }

    vocab_path = out_dir / "vocab.json"
    with open(vocab_path, "w") as f:
        json.dump(vocab_out, f, ensure_ascii=False)
    print(f"Vocab saved: {vocab_path} ({vocab_path.stat().st_size / 1024:.0f} KB)")

    print(f"\nDone! Files in {out_dir}/")
    print(f"  model.onnx  ({onnx_size:.0f} KB)")
    print(f"  vocab.json  ({vocab_path.stat().st_size / 1024:.0f} KB)")

if __name__ == "__main__":
    main()
