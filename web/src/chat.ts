/**
 * Arabic Algebra — Chat Interface
 *
 * Two modes:
 *   1. Symbolic Engine — deterministic keyword rules (like the PoC)
 *   2. Model (1.5M) — ONNX model inference in browser
 *
 * Both produce the same output format: algebra token → tool → result
 */

import { encodeLocal, engine, compactToken } from "./engine-bridge";
import { initTheme, renderNav, initBackground, esc } from "./shared";
import { decompose } from "@engine/agent/decomposer.js";
import type { AlgebraToken } from "@engine/core/types.js";
import * as ort from "onnxruntime-web";

// Configure ONNX Runtime WASM — single-threaded to avoid SharedArrayBuffer requirement
ort.env.wasm.numThreads = 1;

// ─── Types ─────────────────────────────────────────────────────────────────

interface ToolRoute {
  toolId: string;
  toolName: string;
  next: string;
  confidence: "high" | "medium" | "low";
}

interface StepResult {
  step: number;
  text: string;
  algebra: string;
  action: string;
  actionConf: number;
  route: ToolRoute;
  modelTokens?: string[]; // raw model output (model mode only)
  latencyMs: number;
}

interface ChatResult {
  mode: "symbolic" | "model";
  steps: StepResult[];
  totalMs: number;
}

// ─── Tool routing rules (symbolic) ────────────────────────────────────────

const TOOL_RULES: Array<{
  match: (text: string) => boolean;
  toolId: string;
  toolName: string;
  next: string;
}> = [
  {
    match: (t) => /balance|رصيد/.test(t),
    toolId: "check_balance",
    toolName: "Check Balance",
    next: "report",
  },
  {
    match: (t) => /pay|دفع|payment|فاتور/.test(t),
    toolId: "pay_bill",
    toolName: "Pay Bill",
    next: "confirm",
  },
  {
    match: (t) => /bill.*history|previous.*bill|invoice/.test(t),
    toolId: "billing_history",
    toolName: "Billing History",
    next: "report",
  },
  {
    match: (t) => /dispute|overcharg|wrong.*charge/.test(t),
    toolId: "dispute_charge",
    toolName: "Dispute Charge",
    next: "await_input",
  },
  {
    match: (t) => /change.*plan|upgrade.*plan|switch.*plan|downgrade/.test(t),
    toolId: "change_plan",
    toolName: "Change Plan",
    next: "confirm",
  },
  {
    match: (t) =>
      /what.*plan|my.*plan|plan.*detail|which.*plan|view.*plan/.test(t),
    toolId: "view_plan",
    toolName: "View Plan",
    next: "report",
  },
  {
    match: (t) => /usage|data.*used|consumption|كم.*استخدم/.test(t),
    toolId: "check_data_usage",
    toolName: "Check Data Usage",
    next: "report",
  },
  {
    match: (t) => /speed.*test|test.*speed|bandwidth/.test(t),
    toolId: "speed_test",
    toolName: "Run Speed Test",
    next: "execute",
  },
  {
    match: (t) => /coverage|signal|network.*check/.test(t),
    toolId: "check_network",
    toolName: "Check Network",
    next: "report",
  },
  {
    match: (t) =>
      /outage|internet.*down|no.*service|network.*problem|انقطاع/.test(t),
    toolId: "report_outage",
    toolName: "Report Outage",
    next: "await_input",
  },
  {
    match: (t) => /reset.*router|restart.*modem|reboot|reset.*network/.test(t),
    toolId: "reset_network",
    toolName: "Reset Network",
    next: "confirm",
  },
  {
    match: (t) => /activate.*sim|sim.*activate/.test(t),
    toolId: "activate_sim",
    toolName: "Activate SIM",
    next: "confirm",
  },
  {
    match: (t) =>
      /transfer.*agent|speak.*human|real.*person|connect.*support/.test(t),
    toolId: "transfer_agent",
    toolName: "Transfer to Agent",
    next: "escalate",
  },
  {
    match: (t) => /open.*ticket|create.*complaint|file.*ticket/.test(t),
    toolId: "collect_info",
    toolName: "Open Ticket",
    next: "await_input",
  },
  {
    match: (t) => /update.*profile|change.*email|update.*address/.test(t),
    toolId: "update_info",
    toolName: "Update Profile",
    next: "await_input",
  },
];

function routeSymbolic(text: string): ToolRoute {
  const lower = text.toLowerCase();
  for (const rule of TOOL_RULES) {
    if (rule.match(lower)) {
      return {
        toolId: rule.toolId,
        toolName: rule.toolName,
        next: rule.next,
        confidence: "high",
      };
    }
  }
  return {
    toolId: "search_kb",
    toolName: "Knowledge Base",
    next: "report",
    confidence: "low",
  };
}

// ─── ONNX Model inference ─────────────────────────────────────────────────

let onnxSession: ort.InferenceSession | null = null;
let vocab: Record<string, number> = {};
let revVocab: Record<string, string> = {};
let modelConfig = { max_seq_len: 32 };

async function loadModel(): Promise<void> {
  const statusEl = document.getElementById("model-status")!;
  statusEl.className = "model-status loading";
  statusEl.textContent = "Loading model...";

  try {
    // Load vocab
    const vocabResp = await fetch("./model/vocab.json");
    const vocabData = await vocabResp.json();
    vocab = vocabData.vocab;
    revVocab = vocabData.rev_vocab;
    specialTokens = vocabData.special;
    modelConfig = vocabData.config;

    // Load ONNX model
    onnxSession = await ort.InferenceSession.create("./model/model.onnx", {
      executionProviders: ["wasm"],
    });

    statusEl.className = "model-status loaded";
    statusEl.textContent = "Model: loaded (5.6 MB)";
  } catch (e) {
    console.error("Model load failed:", e);
    statusEl.className = "model-status error";
    statusEl.textContent = "Model: failed to load";
    onnxSession = null;
  }
}

function tokenize(tokens: string[]): number[] {
  return tokens.map((t) => vocab[t] ?? specialTokens.UNK);
}

function pad(ids: number[], maxLen: number): number[] {
  if (ids.length >= maxLen) return ids.slice(0, maxLen);
  return [...ids, ...Array(maxLen - ids.length).fill(specialTokens.PAD)];
}

async function greedyDecode(srcIds: number[]): Promise<string[]> {
  if (!onnxSession) return [];

  const maxLen = modelConfig.max_seq_len;
  const paddedSrc = pad(srcIds, maxLen);
  const tgtIds = [specialTokens.BOS];

  for (let step = 0; step < maxLen - 1; step++) {
    const paddedTgt = pad([...tgtIds], maxLen);

    const srcTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(paddedSrc.map(BigInt)),
      [1, maxLen],
    );
    const tgtTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(paddedTgt.map(BigInt)),
      [1, maxLen],
    );

    const result = await onnxSession.run({ src: srcTensor, tgt: tgtTensor });
    const logits = result.logits.data as Float32Array;

    // Get logits for the last valid position (tgtIds.length - 1)
    const vocabSize = result.logits.dims[2];
    const posOffset = (tgtIds.length - 1) * vocabSize;

    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < vocabSize; i++) {
      if (logits[posOffset + i] > maxVal) {
        maxVal = logits[posOffset + i];
        maxIdx = i;
      }
    }

    tgtIds.push(maxIdx);
    if (maxIdx === specialTokens.EOS) break;
  }

  return tgtIds.map((id) => revVocab[String(id)] ?? `<${id}>`);
}

function routeModel(outputTokens: string[]): {
  toolId: string;
  toolName: string;
  next: string;
  domain: string;
  action: string;
  steps: string[];
} {
  const tools = outputTokens
    .filter((t) => t.startsWith("TOOL:"))
    .map((t) => t.replace("TOOL:", ""));
  const next =
    outputTokens.find((t) => t.startsWith("NEXT:"))?.replace("NEXT:", "") ??
    "report";
  const domain =
    outputTokens.find((t) => t.startsWith("D:"))?.replace("D:", "") ?? "—";
  const action =
    outputTokens.find((t) => t.startsWith("ACT:"))?.replace("ACT:", "") ?? "—";
  const steps = outputTokens.filter((t) => t.startsWith("STEP:"));

  const toolId = tools[0] ?? "search_kb";
  // Look up tool name from TOOL_RULES or capitalize
  const rule = TOOL_RULES.find((r) => r.toolId === toolId);
  const toolName =
    rule?.toolName ??
    toolId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return { toolId, toolName, next, domain, action, steps };
}

// ─── Process input ────────────────────────────────────────────────────────

async function processInput(
  text: string,
  mode: "symbolic" | "model",
): Promise<ChatResult> {
  const totalStart = performance.now();
  const units = decompose(text);
  const parts =
    units.length > 0 ? units : [{ text, index: 0, isReference: false }];
  const steps: StepResult[] = [];

  for (let i = 0; i < parts.length; i++) {
    const unit = parts[i];
    const stepStart = performance.now();

    let algebra = "—";
    let action = "—";
    let actionConf = 0;
    let route: ToolRoute;
    let modelTokens: string[] | undefined;

    try {
      const token = encodeLocal(unit.text);
      algebra = compactToken(token);
      const reasoning = engine.reason(token);
      action = reasoning.actionType;
      actionConf = reasoning.confidence;

      if (mode === "model" && onnxSession) {
        // Build input tokens from the algebra token
        const inputTokens = buildInputTokens(token, unit.text);
        const srcIds = tokenize(inputTokens);
        const outputTokens = await greedyDecode(srcIds);
        const modelRoute = routeModel(outputTokens);

        route = {
          toolId: modelRoute.toolId,
          toolName: modelRoute.toolName,
          next: modelRoute.next,
          confidence: "high",
        };
        modelTokens = outputTokens.filter(
          (t) => t !== "<BOS>" && t !== "<EOS>" && t !== "<PAD>",
        );
        // Override action/algebra with model output
        if (modelRoute.action !== "—") action = modelRoute.action;
      } else {
        route = routeSymbolic(unit.text);
      }
    } catch {
      route = routeSymbolic(unit.text);
    }

    const latencyMs = performance.now() - stepStart;

    steps.push({
      step: i + 1,
      text: unit.text,
      algebra,
      action,
      actionConf,
      route,
      modelTokens,
      latencyMs,
    });
  }

  return {
    mode,
    steps,
    totalMs: performance.now() - totalStart,
  };
}

function buildInputTokens(token: AlgebraToken, _text: string): string[] {
  const tokens: string[] = ["<BOS>"];

  // Intent
  if (token.intent) tokens.push(`I:${token.intent}`);

  // Root
  if (token.root) tokens.push(`R:${token.root}`);

  // Root letters
  if (token.rootLetters) tokens.push(`RL:${token.rootLetters}`);

  // Pattern
  if (token.pattern) tokens.push(`P:${token.pattern}`);

  // Modifiers
  if (token.modifiers) {
    for (const mod of token.modifiers) {
      tokens.push(`MK:${mod.key}`);
      if (mod.value) tokens.push(`MV:${mod.key}:${mod.value}`);
    }
  }

  tokens.push("<EOS>");
  return tokens;
}

// ─── UI ────────────────────────────────────────────────────────────────────

let currentMode: "symbolic" | "model" = "symbolic";

const SUGGESTIONS = [
  "What is my balance?",
  "Pay my bill",
  "Check data usage",
  "What plan am I on?",
  "My internet is down",
  "كم رصيدي؟",
  "Check balance and pay bill",
  "Run a speed test",
  "whats my blance",
  "yo how much do I owe",
  "hook me up with a faster plan",
];

function addMessage(html: string, type: "user" | "bot") {
  const el = document.getElementById("messages")!;
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.innerHTML = html;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function renderBotMessage(result: ChatResult) {
  const modeBadge =
    result.mode === "model"
      ? '<span class="mode-badge model">Model (1.5M)</span>'
      : '<span class="mode-badge symbolic">Symbolic Engine</span>';

  let html = modeBadge;

  for (const step of result.steps) {
    // Summary line — what the engine actually decided
    const toolLabel = esc(step.route.toolName);
    const confPct = Math.round(step.actionConf * 100);
    const summary = `Classified as <strong>${esc(step.action)}</strong> (${confPct}%) → route to <strong>${toolLabel}</strong>`;

    if (result.steps.length > 1) {
      html += `<div style="margin-top:6px"><span class="trace"><span class="step-badge">STEP ${step.step}</span></span> ${summary}</div>`;
    } else {
      html += `<div style="margin-top:4px">${summary}</div>`;
    }

    // Engine trace
    html += `<div class="trace">`;
    html += `<div><span class="label">Input:</span> <span class="value">${esc(step.text)}</span></div>`;
    html += `<div><span class="label">Algebra:</span> <span class="value">${esc(step.algebra)}</span></div>`;
    html += `<div><span class="label">Action:</span> <span class="value">${esc(step.action)}</span> (${confPct}%)</div>`;
    html += `<div><span class="label">Tool:</span> <span class="tool-name">${esc(step.route.toolId)}</span> → ${esc(step.route.toolName)}</div>`;
    html += `<div><span class="label">Next:</span> <span class="value">${esc(step.route.next)}</span></div>`;
    if (step.modelTokens) {
      html += `<div><span class="label">Model output:</span> <span class="value">${esc(step.modelTokens.join(" "))}</span></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="latency">${result.totalMs.toFixed(1)}ms${result.steps.length > 1 ? ` (${result.steps.length} steps)` : ""}</div>`;

  addMessage(html, "bot");
}

async function handleSend() {
  const input = document.getElementById("chat-input") as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage(esc(text), "user");

  const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
  sendBtn.disabled = true;

  try {
    const result = await processInput(text, currentMode);
    renderBotMessage(result);
  } catch (e) {
    console.error(e);
    addMessage("Sorry, something went wrong processing that request.", "bot");
  }

  sendBtn.disabled = false;
  input.focus();
}

// ─── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderNav("nav", "chat");
  const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
  if (canvas) initBackground(canvas);

  // Mode toggle
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode as "symbolic" | "model";

      if (currentMode === "model" && !onnxSession) {
        loadModel();
      }
    });
  });

  // Suggestions
  const sugEl = document.getElementById("suggestions")!;
  for (const s of SUGGESTIONS) {
    const btn = document.createElement("button");
    btn.className = "sug-btn";
    btn.textContent = s;
    btn.addEventListener("click", () => {
      (document.getElementById("chat-input") as HTMLInputElement).value = s;
      handleSend();
    });
    sugEl.appendChild(btn);
  }

  // Send
  document.getElementById("send-btn")!.addEventListener("click", handleSend);
  document.getElementById("chat-input")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Welcome message
  addMessage(
    `<strong>Arabic Algebra Engine — Live Demo</strong><br>` +
      `<span style="font-size:0.8rem; color: var(--text-dim)">` +
      `Type a request and see real engine output: algebra encoding, reasoning, and tool routing.<br>` +
      `No fake data — this shows exactly what the engine produces. Try English, Arabic, or typos.</span>`,
    "bot",
  );
});
