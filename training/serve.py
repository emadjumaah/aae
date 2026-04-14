#!/usr/bin/env python3
"""
Arabic Algebra — Inference Server

Loads the trained transformer checkpoint and serves a JSON API
for interactive chat. Handles the full pipeline:
  1. Receive algebra token IDs (pre-serialized by the TS encoder)
  2. Run through the model (greedy decode)
  3. Return predicted output token names

Also supports a "raw text" mode that accepts English text,
shells out to the TS encoder, then runs inference.

Usage:
  python3 training/serve.py                     # default port 8787
  python3 training/serve.py --port 9000         # custom port
  python3 training/serve.py --checkpoint best_model.pt
"""

import json
import argparse
import math
import subprocess
import sys
import os
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

import torch
import torch.nn as nn

# ─── Model (must match train.py exactly) ────────────────────────────────────

class Config:
    d_model = 192
    nhead = 6
    num_encoder_layers = 4
    num_decoder_layers = 4
    dim_feedforward = 384
    dropout = 0.1
    max_seq_len = 32

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
            d_model=cfg.d_model, nhead=cfg.nhead,
            dim_feedforward=cfg.dim_feedforward,
            dropout=cfg.dropout, batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=cfg.num_encoder_layers)

        decoder_layer = nn.TransformerDecoderLayer(
            d_model=cfg.d_model, nhead=cfg.nhead,
            dim_feedforward=cfg.dim_feedforward,
            dropout=cfg.dropout, batch_first=True,
        )
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=cfg.num_decoder_layers)

        self.output_proj = nn.Linear(cfg.d_model, vocab_size)

    def _generate_square_subsequent_mask(self, sz: int) -> torch.Tensor:
        return torch.triu(torch.ones(sz, sz), diagonal=1).bool()

    def forward(self, src, tgt):
        src_emb = self.pos_encoder(self.embedding(src))
        tgt_emb = self.pos_decoder(self.embedding(tgt))
        src_pad_mask = (src == 0)
        tgt_pad_mask = (tgt == 0)
        tgt_mask = self._generate_square_subsequent_mask(tgt.size(1)).to(tgt.device)
        memory = self.encoder(src_emb, src_key_padding_mask=src_pad_mask)
        output = self.decoder(tgt_emb, memory, tgt_mask=tgt_mask,
                              tgt_key_padding_mask=tgt_pad_mask,
                              memory_key_padding_mask=src_pad_mask)
        return self.output_proj(output)


# ─── Inference ──────────────────────────────────────────────────────────────

def greedy_decode(model, src_ids, vocab, device, max_len=32):
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

    tokens = [rev_vocab.get(i, f"<{i}>") for i in tgt_ids]
    return {"ids": tgt_ids, "tokens": tokens}


# ─── TS Encoder Bridge ─────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent

def encode_text_via_ts(text: str) -> dict | None:
    """Shell out to a small TS script that encodes text → algebra token IDs."""
    script = f"""
import {{ encodeLocal }} from './src/core/encoder.js';
import {{ serializeInput }} from './src/reasoning/serializer.js';
import {{ getVocabulary }} from './src/reasoning/vocabulary.js';

const text = {json.dumps(text)};
try {{
  const token = encodeLocal(text);
  const ser = serializeInput(token);
  console.log(JSON.stringify({{
    ok: true,
    input_tokens: ser.tokens,
    input_ids: ser.ids,
    token: {{
      intent: token.intent,
      root: token.root,
      rootLatin: token.rootLatin,
      pattern: token.pattern,
      modifiers: token.modifiers,
    }}
  }}));
}} catch (e) {{
  console.log(JSON.stringify({{ ok: false, error: e.message }}));
}}
"""
    try:
        result = subprocess.run(
            ["node", "--import", "tsx/esm", "-e", script],
            capture_output=True, text=True, timeout=10,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0:
            return None
        # Find the last JSON line in stdout
        for line in reversed(result.stdout.strip().split("\n")):
            line = line.strip()
            if line.startswith("{"):
                return json.loads(line)
        return None
    except Exception as e:
        print(f"TS encode error: {e}", file=sys.stderr)
        return None


# ─── HTTP Server ────────────────────────────────────────────────────────────

class InferenceHandler(BaseHTTPRequestHandler):
    model = None
    vocab = None
    rev_vocab = None
    device = None
    sample_inputs = None  # pre-loaded sample inputs for quick testing

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html_response(self, html):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self._cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "/chat":
            self._serve_chat_ui()
        elif self.path == "/api/samples":
            self._json_response({"samples": self.__class__.sample_inputs})
        elif self.path == "/api/vocab":
            self._json_response({
                "size": len(self.__class__.vocab),
                "tokens": list(self.__class__.vocab.keys())[:100],
            })
        elif self.path == "/api/health":
            self._json_response({"status": "ok", "vocab_size": len(self.__class__.vocab)})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/predict":
            self._handle_predict()
        elif self.path == "/api/encode":
            self._handle_encode()
        elif self.path == "/api/chat":
            self._handle_chat()
        else:
            self.send_error(404)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length > 1_000_000:  # 1MB limit
            return None
        body = self.rfile.read(length)
        return json.loads(body)

    def _handle_predict(self):
        """Predict from raw token IDs: POST {"input_ids": [2, 5, 151, ...]}"""
        data = self._read_json_body()
        if not data or "input_ids" not in data:
            self._json_response({"error": "missing input_ids"}, 400)
            return

        input_ids = data["input_ids"]
        # Pad to max_seq_len
        if len(input_ids) < 32:
            input_ids = input_ids + [0] * (32 - len(input_ids))
        input_ids = input_ids[:32]

        result = greedy_decode(
            self.__class__.model, input_ids,
            self.__class__.vocab, self.__class__.device
        )

        # Parse structured output
        parsed = self._parse_output_tokens(result["tokens"])

        self._json_response({
            "input_ids": data["input_ids"],
            "output": result,
            "parsed": parsed,
        })

    def _handle_encode(self):
        """Encode text via TS bridge: POST {"text": "send the report"}"""
        data = self._read_json_body()
        if not data or "text" not in data:
            self._json_response({"error": "missing text"}, 400)
            return

        encoded = encode_text_via_ts(data["text"])
        if not encoded or not encoded.get("ok"):
            self._json_response({
                "error": encoded.get("error", "encoding failed") if encoded else "encoding failed"
            }, 400)
            return

        # Remap IDs to training vocabulary
        vocab = self.__class__.vocab
        unk_id = vocab.get("<UNK>", 1)
        encoded["input_ids"] = [vocab.get(t, unk_id) for t in encoded["input_tokens"]]
        self._json_response(encoded)

    def _handle_chat(self):
        """Full pipeline: text → encode → predict → structured response"""
        data = self._read_json_body()
        if not data or "text" not in data:
            self._json_response({"error": "missing text"}, 400)
            return

        text = data["text"].strip()
        if not text:
            self._json_response({"error": "empty text"}, 400)
            return

        # Step 1: Encode text to algebra tokens
        encoded = encode_text_via_ts(text)
        if not encoded or not encoded.get("ok"):
            self._json_response({
                "error": f"Could not encode: {encoded.get('error', 'unknown') if encoded else 'bridge failed'}",
                "step": "encode",
            }, 200)
            return

        # Step 2: Remap token strings to training-vocab IDs (TS vocab has grown)
        vocab = self.__class__.vocab
        unk_id = vocab.get("<UNK>", 1)
        input_tokens = encoded["input_tokens"]
        input_ids = [vocab.get(t, unk_id) for t in input_tokens]

        if len(input_ids) < 32:
            input_ids = input_ids + [0] * (32 - len(input_ids))
        input_ids = input_ids[:32]

        try:
            result = greedy_decode(
                self.__class__.model, input_ids,
                self.__class__.vocab, self.__class__.device
            )
        except Exception as e:
            self._json_response({
                "error": f"Inference failed: {e}",
                "step": "predict",
                "input_tokens": input_tokens,
                "input_ids": [vocab.get(t, unk_id) for t in input_tokens],
            }, 200)
            return

        # Step 3: Parse output
        parsed = self._parse_output_tokens(result["tokens"])

        # Step 3.5: Keyword fallback — if model didn't predict TOOL tokens,
        # try matching input text to known tool patterns
        if not parsed["tools"]:
            fallback = self._keyword_tool_fallback(text)
            if fallback:
                parsed["tools"] = fallback["tools"]
                parsed["next_step"] = fallback.get("next_step", parsed["next_step"])
                parsed["_fallback"] = True

        # Step 4: Generate human-readable reply
        reply = self._generate_reply(parsed, text)

        self._json_response({
            "input_text": text,
            "reply": reply,
            "algebra_token": encoded.get("token"),
            "input_tokens": input_tokens,
            "input_ids": [vocab.get(t, unk_id) for t in input_tokens],
            "output_tokens": result["tokens"],
            "output_ids": result["ids"],
            "parsed": parsed,
        })

    def _parse_output_tokens(self, tokens):
        """Extract structured fields from output token sequence."""
        parsed = {
            "action": None,
            "root": None,
            "domain": None,
            "tools": [],
            "next_step": None,
            "modifiers": [],
            "confidence": None,
            "raw": [t for t in tokens if t not in ("<BOS>", "<EOS>", "<PAD>")],
        }
        for t in tokens:
            if t.startswith("ACT:"):
                parsed["action"] = t[4:]
            elif t.startswith("R:"):
                parsed["root"] = t[2:]
            elif t.startswith("D:"):
                parsed["domain"] = t[2:]
            elif t.startswith("TOOL:"):
                parsed["tools"].append(t[5:])
            elif t.startswith("NEXT:"):
                parsed["next_step"] = t[5:]
            elif t.startswith("CONF:"):
                parsed["confidence"] = t[5:]
            elif t.startswith("MK:") or t.startswith("MV:") or t.startswith("LIT:"):
                parsed["modifiers"].append(t)
        return parsed

    def _keyword_tool_fallback(self, text):
        """Match input text to tools when model doesn't predict TOOL tokens."""
        import re
        t = text.lower().strip()
        RULES = [
            (r'\b(balance|how much.*owe|amount due)\b', ["check_balance"], "report"),
            (r'\b(pay|payment|pay.*bill)\b', ["pay_bill"], "confirm"),
            (r'\b(billing|invoice|statement|receipt)\b', ["billing_history"], "report"),
            (r'\b(dispute|wrong charge|incorrect)\b', ["dispute_charge"], "await_input"),
            (r'\b(my plan|current plan|view plan|what plan)\b', ["view_plan"], "report"),
            (r'\b(change plan|switch plan|upgrade plan)\b', ["change_plan"], "confirm"),
            (r'\b(update|change).*(info|address|email|name|phone)\b', ["update_info"], "await_input"),
            (r'\b(cancel|terminate|close.*account)\b', ["cancel_service"], "confirm"),
            (r'\b(add.*line|new line|extra line)\b', ["add_line"], "confirm"),
            (r'\b(profile|account.*detail|my info|my account)\b', ["get_profile"], "report"),
            (r'\b(network|signal|coverage|no service)\b', ["check_network"], "report"),
            (r'\b(data usage|how much data|data.*left)\b', ["check_data_usage"], "report"),
            (r'\b(reset.*network|restart.*network)\b', ["reset_network"], "confirm"),
            (r'\b(speed test|internet speed|how fast)\b', ["speed_test"], "report"),
            (r'\b(outage|down|not working)\b', ["report_outage"], "await_input"),
            (r'\b(device|phone.*status|warranty)\b', ["check_device"], "report"),
            (r'\b(troubleshoot|diagnos|fix.*device|phone.*problem)\b', ["troubleshoot_device"], "report"),
            (r'\b(upgrade.*device|new phone|eligible.*upgrade)\b', ["upgrade_device"], "report"),
            (r'\b(sim|activate.*sim|sim card)\b', ["activate_sim"], "await_input"),
            (r'\b(transfer|speak.*agent|human|representative)\b', ["transfer_agent"], "escalate"),
            (r'\b(slow|internet.*slow|lag|buffering)\b', ["speed_test", "check_network"], "report"),
        ]
        for pattern, tools, next_step in RULES:
            if re.search(pattern, t):
                return {"tools": tools, "next_step": next_step}
        return None

    def _generate_reply(self, parsed, input_text=""):
        """Turn structured model output into a natural text reply."""
        tools = parsed.get("tools", [])
        next_step = parsed.get("next_step")
        action = parsed.get("action", "execute")
        domain = parsed.get("domain", "general")
        confidence = parsed.get("confidence", "medium")

        # If tools were predicted, generate tool-aware response
        if tools:
            return self._tool_reply(tools, next_step, confidence, input_text)

        # No tools — generate a general reasoning response
        return self._general_reply(action, domain, parsed, input_text)

    def _tool_reply(self, tools, next_step, confidence, input_text):
        """Build reply for tool-routing predictions."""
        # Response templates for known tools
        TOOL_RESPONSES = {
            "check_balance": "Let me check your account balance for you.",
            "pay_bill": "I can process your payment. Would you like to pay the full balance?",
            "billing_history": "Here's a summary of your recent billing statements.",
            "dispute_charge": "I can help you dispute that charge. Could you provide details about which charge is incorrect?",
            "view_plan": "Let me pull up your current plan details.",
            "change_plan": "I can help you change your plan. What plan would you like to switch to?",
            "update_info": "I can update your information. What would you like to change?",
            "cancel_service": "I understand you'd like to cancel. Before I process that, is there anything we can do to help?",
            "add_line": "I can add a new line to your account. What plan should the new line have?",
            "get_profile": "Here are your account details on file.",
            "check_network": "Let me check the network status in your area.",
            "check_data_usage": "Let me look up your current data usage.",
            "reset_network": "I'll reset your network settings now. This should take just a moment.",
            "speed_test": "Running a speed test on your connection now.",
            "report_outage": "I'll file an outage report for your area. Can you confirm your location?",
            "check_device": "Let me check your device status and warranty information.",
            "troubleshoot_device": "Let me run some diagnostics on your device.",
            "upgrade_device": "Let me check your upgrade eligibility and available options.",
            "activate_sim": "I can activate your SIM card. Please provide your SIM number.",
            "transfer_agent": "Let me connect you with a specialist who can help further.",
            "collect_info": "Could you please provide the required information?",
            "send_sms": "I'll send you a confirmation message now.",
            "search_kb": "Let me search our knowledge base for that information.",
            "format_response": "Here's a summary of that information.",
        }

        # Build response for each tool
        parts = []
        for tool in tools:
            text = TOOL_RESPONSES.get(tool, f"Processing your request ({tool})...")
            parts.append(text)

        reply = " ".join(parts)

        # Add next-step context
        if next_step == "confirm":
            reply += " Shall I go ahead?"
        elif next_step == "await_input":
            pass  # The tool response already asks for input
        elif next_step == "chain" and len(tools) > 1:
            reply = parts[0] + " Then I'll " + parts[1][0].lower() + parts[1][1:] if len(parts) > 1 else reply
        elif next_step == "escalate":
            reply = "Let me connect you with a specialist who can help with this."

        return reply

    def _general_reply(self, action, domain, parsed, input_text):
        """Build reply for non-tool general predictions."""
        ACTION_TEMPLATES = {
            "query": "Looking into that for you.",
            "execute": "Processing your request now.",
            "create": "Creating that for you.",
            "send": "Sending that now.",
            "broadcast": "Broadcasting your message.",
            "schedule": "Scheduling that for you.",
            "document": "Recording that information.",
            "store": "Saving that to your records.",
            "study": "Let me look into the details on that.",
            "resolve": "Working on resolving that.",
            "evaluate": "Evaluating that for you.",
            "coordinate": "Coordinating that with the team.",
            "assemble": "Gathering that information together.",
        }
        reply = ACTION_TEMPLATES.get(action, "Processing your request.")
        root = parsed.get("root")
        if root and domain and domain != "general":
            reply += f" (domain: {domain})"
        return reply

    def _serve_chat_ui(self):
        """Serve the built-in chat interface."""
        ui_path = Path(__file__).parent / "chat.html"
        if ui_path.exists():
            self._html_response(ui_path.read_text(encoding="utf-8"))
        else:
            self._html_response("<h1>chat.html not found</h1>")

    def log_message(self, format, *args):
        # Quieter logging
        if "/api/health" not in str(args):
            super().log_message(format, *args)


# ─── Load & Start ──────────────────────────────────────────────────────────

def load_samples(corpus_dir: Path, vocab: dict, n=20):
    """Load a few sample inputs from the training corpus for the UI."""
    rev_vocab = {v: k for k, v in vocab.items()}
    samples = []
    data_files = ["train.jsonl", "train-expanded.jsonl"]

    seen_actions = set()
    for fname in data_files:
        fpath = corpus_dir / fname
        if not fpath.exists():
            continue
        with open(fpath) as f:
            for line in f:
                if len(samples) >= n:
                    break
                ex = json.loads(line.strip())
                # Pick diverse examples by action type
                out_tokens = ex.get("output_tokens", [])
                action = next((t[4:] for t in out_tokens if t.startswith("ACT:")), None)
                if action and action in seen_actions and len(samples) > 5:
                    continue
                if action:
                    seen_actions.add(action)

                input_tokens = ex.get("input_tokens", [])
                samples.append({
                    "id": ex.get("id", ""),
                    "input_tokens": input_tokens,
                    "input_ids": ex.get("input_ids", []),
                    "expected_output": out_tokens,
                    "domain": ex.get("domain", ""),
                })
    return samples


def main():
    parser = argparse.ArgumentParser(description="Arabic Algebra Inference Server")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--checkpoint", default="best_model.pt")
    args = parser.parse_args()

    device = torch.device("cpu")
    cfg = Config()
    corpus_dir = Path(__file__).parent.parent / "data" / "corpus"
    ckpt_dir = Path(__file__).parent / "checkpoints"

    # Load vocabulary
    vocab_path = corpus_dir / "vocabulary.json"
    print(f"Loading vocabulary: {vocab_path}")
    with open(vocab_path) as f:
        vocab_data = json.load(f)
    vocab = vocab_data["vocab"]
    vocab_size = vocab_data["size"]

    # Load corpus to discover effective vocab size (same logic as train.py)
    data_files = ["train-merged.jsonl", "train-expanded.jsonl", "train.jsonl"]
    max_id = vocab_size - 1
    for fname in data_files:
        fpath = corpus_dir / fname
        if not fpath.exists():
            continue
        with open(fpath) as f:
            for line in f:
                ex = json.loads(line.strip())
                for ids_key in ("input_ids", "output_ids"):
                    for i in ex.get(ids_key, []):
                        if i > max_id:
                            max_id = i
    effective_vocab = max_id + 1
    if effective_vocab > vocab_size:
        print(f"Effective vocab size: {effective_vocab} (expanded from {vocab_size} for LIT: tokens)")
        vocab_size = effective_vocab

    # Build reverse vocab from corpus too (including TOOL:/NEXT: tokens)
    for fname in data_files:
        fpath = corpus_dir / fname
        if not fpath.exists():
            continue
        with open(fpath) as f:
            for line in f:
                ex = json.loads(line.strip())
                in_tokens = ex.get("input_tokens", [])
                in_ids = ex.get("input_ids", [])
                out_tokens = ex.get("output_tokens", [])
                out_ids = ex.get("output_ids", [])
                for t, i in zip(in_tokens, in_ids):
                    if t not in vocab:
                        vocab[t] = i
                for t, i in zip(out_tokens, out_ids):
                    if t not in vocab:
                        vocab[t] = i

    # Load model
    ckpt_path = ckpt_dir / args.checkpoint
    print(f"Loading model: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    # Support both full checkpoint (dict with model_state_dict) and raw state_dict
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        state_dict = ckpt["model_state_dict"]
        # If checkpoint includes vocab, merge missing tokens
        if "vocab" in ckpt:
            for t, i in ckpt["vocab"].items():
                if t not in vocab:
                    vocab[t] = i
            ckpt_vocab_size = ckpt.get("vocab_size", vocab_size)
            if ckpt_vocab_size > vocab_size:
                print(f"Checkpoint vocab size: {ckpt_vocab_size} (overriding {vocab_size})")
                vocab_size = ckpt_vocab_size
    else:
        state_dict = ckpt
    model = AlgebraTransformer(vocab_size, cfg).to(device)
    model.load_state_dict(state_dict)
    model.eval()

    params = sum(p.numel() for p in model.parameters())
    print(f"Model loaded: {params:,} params, vocab={vocab_size}")

    # Load sample inputs for the UI
    samples = load_samples(corpus_dir, vocab)
    print(f"Loaded {len(samples)} sample inputs for testing")

    # Setup handler class vars
    InferenceHandler.model = model
    InferenceHandler.vocab = vocab
    InferenceHandler.rev_vocab = {v: k for k, v in vocab.items()}
    InferenceHandler.device = device
    InferenceHandler.sample_inputs = samples

    server = HTTPServer(("0.0.0.0", args.port), InferenceHandler)
    print(f"\n{'='*50}")
    print(f"  Arabic Algebra Chat — http://localhost:{args.port}")
    print(f"{'='*50}")
    print(f"  POST /api/chat    — full pipeline (text → encode → predict)")
    print(f"  POST /api/predict — raw IDs inference")
    print(f"  POST /api/encode  — text → algebra tokens")
    print(f"  GET  /api/samples — pre-loaded test examples")
    print(f"  GET  /            — chat UI")
    print(f"{'='*50}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
