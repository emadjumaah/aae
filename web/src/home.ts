import "./styles.css";
import { initBackground, renderNav, esc, confColor } from "./shared";
import { run } from "./engine-bridge";

renderNav("nav", "home");
initBackground(document.getElementById("bg-canvas") as HTMLCanvasElement);

// Hero stats
const stats = [
  { v: "152", l: "Arabic Roots", s: "15 semantic domains", c: "var(--gold)" },
  {
    v: "66",
    l: "Agent Tools",
    s: "telecom · banking · health",
    c: "var(--cyan)",
  },
  {
    v: "~8µs",
    l: "Avg Latency",
    s: "deterministic, offline",
    c: "var(--green)",
  },
  {
    v: "1.5M",
    l: "Model Params",
    s: "runs in browser (6 MB)",
    c: "var(--magenta)",
  },
  {
    v: "90.2%",
    l: "Model Accuracy",
    s: "on structured tasks",
    c: "var(--gold)",
  },
  {
    v: "$0.00",
    l: "Inference Cost",
    s: "no API, no GPU",
    c: "var(--cyan)",
  },
];
document.getElementById("hero-stats")!.innerHTML = stats
  .map(
    (s) => `
  <div style="background:var(--bg2);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:18px;text-align:center;">
    <div style="font-size:2.2rem;font-weight:800;color:${s.c};">${s.v}</div>
    <div style="color:var(--text-dim);font-size:.82rem;margin-top:5px;">${s.l}</div>
    <div style="color:var(--text-dim);font-size:.72rem;margin-top:3px;opacity:.6;">${s.s}</div>
  </div>`,
  )
  .join("");

// Live examples
const EXAMPLES = [
  "Check my balance",
  "أريد دفع الفاتورة",
  "Change my plan to premium",
  "Transfer $500 to savings",
  "Book an appointment with Dr. Smith",
  "Check balance and pay bill",
];

function renderExample(input: string): string {
  const data = run(input);
  const r = data.reasoning;
  return `
    <div style="background:var(--bg);border-radius:8px;padding:12px 16px;margin-bottom:8px;cursor:pointer;border:1px solid var(--border-subtle);transition:border-color 0.15s" class="live-ex">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.9rem;color:var(--text)">${esc(input)}</span>
        <span style="font-size:0.65rem;color:var(--green)">${data.durationMs}ms</span>
      </div>
      <div style="font-size:0.75rem;font-family:'IBM Plex Mono',monospace;color:var(--text-dim);display:flex;flex-wrap:wrap;gap:8px">
        <span>root: <span style="color:var(--gold)">${esc(data.token.root)}</span></span>
        <span>intent: <span style="color:var(--cyan)">${esc(data.token.intent)}</span></span>
        <span>action: <span style="color:${confColor(r.confidence)}">${esc(r.actionType)}</span></span>
        <span>→ <span style="color:var(--green)">${esc(r.resource)}</span></span>
      </div>
    </div>`;
}

const exEl = document.getElementById("live-examples");
if (exEl) {
  exEl.innerHTML = EXAMPLES.map(renderExample).join("");
}
