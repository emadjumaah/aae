import "./styles.css";
import { initBackground, renderNav, esc, confColor } from "./shared";
import { run } from "./engine-bridge";

renderNav("nav", "usecases");
initBackground(document.getElementById("bg-canvas") as HTMLCanvasElement);

// ─── Use case definitions ───────────────────────────────────────────────────
interface UseCase {
  id: string;
  title: string;
  titleAr: string;
  tag: string;
  tagColor: string;
  icon: string;
  description: string;
  samples: string[];
  metrics: { label: string; value: string }[];
}

const USE_CASES: UseCase[] = [
  {
    id: "telecom",
    title: "Telecom Customer Service",
    titleAr: "خدمة عملاء الاتصالات",
    tag: "Telecom",
    tagColor: "iot",
    icon: "📱",
    description:
      "24 tools covering billing, account management, network diagnostics, device support, and customer routing. The engine classifies intent and routes to the correct tool in microseconds — no LLM needed for structured requests.",
    samples: [
      "Check my balance",
      "Pay my bill",
      "Change my plan to premium",
      "What's my data usage?",
      "Run a speed test",
      "أريد تغيير باقتي",
    ],
    metrics: [
      { label: "Tools", value: "24" },
      { label: "Bilingual", value: "EN + AR" },
      { label: "Latency", value: "<10µs" },
    ],
  },
  {
    id: "banking",
    title: "Banking & Finance",
    titleAr: "الخدمات المصرفية",
    tag: "Finance",
    tagColor: "finance",
    icon: "🏦",
    description:
      "13 tools for accounts, transfers, and loans. Same input always produces the same classification — full auditability. Deterministic routing means no hallucinated tool calls.",
    samples: [
      "Transfer $500 to my savings account",
      "What is my current balance?",
      "Show recent transactions",
      "Apply for a personal loan",
      "Send money to Ahmed",
      "أريد تحويل مبلغ",
    ],
    metrics: [
      { label: "Tools", value: "13" },
      { label: "Consistency", value: "100%" },
      { label: "Cost", value: "$0/request" },
    ],
  },
  {
    id: "health",
    title: "Healthcare",
    titleAr: "الرعاية الصحية",
    tag: "Health",
    tagColor: "health",
    icon: "🏥",
    description:
      "12 tools for appointments, medical records, and prescriptions. Bilingual Arabic/English classification with explainable reasoning — every decision traces back to root × pattern algebra.",
    samples: [
      "Book an appointment with Dr. Smith",
      "Cancel my appointment",
      "Refill my prescription",
      "View my medical records",
      "Find a cardiologist near me",
      "أريد حجز موعد",
    ],
    metrics: [
      { label: "Tools", value: "12" },
      { label: "Explainable", value: "100%" },
      { label: "Offline", value: "✓" },
    ],
  },
  {
    id: "prefilter",
    title: "LLM Pre-filter / Cost Reduction",
    titleAr: "تقليل تكلفة النماذج اللغوية",
    tag: "Infrastructure",
    tagColor: "infra",
    icon: "⚡",
    description:
      "In production AI agents, 3-5 LLM calls per message cost $0.01-0.05 per conversation. AAE replaces intent classification, tool routing, and multi-step planning with deterministic inference — reducing LLM calls by 50-70%. The LLM only handles genuinely complex reasoning.",
    samples: [
      "Check my balance and pay my bill",
      "Book appointment then check records",
      "Delete all records from last month",
      "What are the implications of quantum computing?",
      "Summarize the Q3 earnings report",
      "Transfer money and apply for a loan",
    ],
    metrics: [
      { label: "LLM savings", value: "50-70%" },
      { label: "Pre-filter", value: "<10µs" },
      { label: "Multi-step", value: "✓" },
    ],
  },
];

// ─── Render cards ───────────────────────────────────────────────────────────
const container = document.getElementById("ucContainer")!;
container.innerHTML = USE_CASES.map(
  (uc) => `
  <div class="uc-card" id="uc-${uc.id}">
    <div class="uc-header">
      <span class="uc-icon">${uc.icon}</span>
      <div>
        <h2>${esc(uc.title)}</h2>
        <span class="uc-title-ar">${esc(uc.titleAr)}</span>
      </div>
      <span class="tag ${uc.tagColor}">${esc(uc.tag)}</span>
    </div>
    <p class="uc-desc">${esc(uc.description)}</p>
    <div class="metric-row">
      ${uc.metrics.map((m) => `<div class="metric"><span class="metric-label">${esc(m.label)}</span><span class="metric-value">${esc(m.value)}</span></div>`).join("")}
    </div>
    <h3 class="uc-try-header">Try it live</h3>
    <div class="uc-samples">
      ${uc.samples.map((s) => `<button class="sample-btn" data-input="${esc(s)}">${esc(s.length > 50 ? s.slice(0, 50) + "…" : s)}</button>`).join("")}
    </div>
    <div class="uc-tryit">
      <input type="text" class="uc-input" id="input-${uc.id}" placeholder="Or type your own command…">
      <button class="uc-run" data-uc="${uc.id}">Run ▶</button>
    </div>
    <div class="uc-result" id="result-${uc.id}"></div>
  </div>
`,
).join("");

// ─── Wire up interactions ───────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>(".sample-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".uc-card")!;
    const input = card.querySelector(".uc-input") as HTMLInputElement;
    input.value = btn.dataset.input!;
    card.querySelector<HTMLButtonElement>(".uc-run")!.click();
  });
});

document.querySelectorAll<HTMLButtonElement>(".uc-run").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ucId = btn.dataset.uc!;
    const input = (
      document.getElementById(`input-${ucId}`) as HTMLInputElement
    ).value.trim();
    if (!input) return;
    const data = run(input);
    const r = data.reasoning;
    const cc = confColor(r.confidence);
    document.getElementById(`result-${ucId}`)!.innerHTML = `
      <div class="result-inner">
        <div class="token-display" style="margin-bottom:12px;">
          <span class="root">${esc(data.token.root)}</span>
          <span class="op">×</span>
          <span class="pattern">${esc(data.token.pattern)}</span>
          ${data.token.modifiers.map((m) => `<span class="mod">${esc(m)}</span>`).join("")}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
          <div class="field"><div class="label">Intent</div><div class="value">${esc(data.token.intent)}</div></div>
          <div class="field"><div class="label">Action</div><div class="value action">${esc(r.actionType)}</div></div>
          <div class="field"><div class="label">Resource</div><div class="value resource">${esc(r.resource)}</div></div>
        </div>
        <div class="confidence" style="margin-bottom:12px;">
          <span style="font-size:.72rem;color:var(--text-dim)">Confidence</span>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${r.confidence * 100}%;background:${cc}"></div></div>
          <span class="confidence-pct" style="color:${cc}">${(r.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="explanation" style="font-size:.78rem;margin-bottom:8px;">${esc(data.explanation)}</div>
        <div style="font-size:.72rem;color:var(--text-dim);">${data.durationMs}ms · deterministic · no LLM</div>
      </div>`;
  });
});
