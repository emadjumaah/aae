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
    id: "iot",
    title: "Smart Home IoT",
    titleAr: "المنزل الذكي",
    tag: "IoT",
    tagColor: "iot",
    icon: "🏠",
    description:
      "Concept: pre-classify voice commands into intent + action on-device. No cloud calls, no latency, no privacy leaks. Unvalidated — would need real-world testing with diverse command phrasings.",
    samples: [
      "Turn on the living room lights",
      "Set the thermostat to 22 degrees",
      "Lock the front door",
      "Play music in the bedroom",
      "Schedule the sprinklers for 6 AM",
      "Show me the security camera feed",
    ],
    metrics: [
      { label: "Latency", value: "<10µs" },
      { label: "Privacy", value: "100% local" },
      { label: "Power", value: "~0 watts" },
    ],
  },
  {
    id: "health",
    title: "Hospital Triage",
    titleAr: "فرز المستشفى",
    tag: "Health",
    tagColor: "health",
    icon: "🏥",
    description:
      "Concept: classify patient complaints into action types and route to departments. Bilingual Arabic/English. Unvalidated — medical NLP requires extensive real-world testing and regulatory approval.",
    samples: [
      "I have severe chest pain",
      "أشعر بألم شديد في صدري",
      "My child has a high fever",
      "I need to refill my prescription",
      "Schedule a follow-up appointment",
      "Where is the radiology department?",
    ],
    metrics: [
      { label: "Bilingual", value: "EN + AR" },
      { label: "Explainable", value: "100%" },
      { label: "Offline", value: "✓" },
    ],
  },
  {
    id: "finance",
    title: "Banking Classifier",
    titleAr: "مصنف مصرفي",
    tag: "Finance",
    tagColor: "finance",
    icon: "🏦",
    description:
      "Concept: route customer requests deterministically. Same input always produces same classification — useful for audit trails. Unvalidated with real banking data.",
    samples: [
      "Transfer $500 to my savings account",
      "What is my current balance?",
      "Report a fraudulent transaction",
      "Apply for a personal loan",
      "Change my account PIN",
      "Show recent transactions",
    ],
    metrics: [
      { label: "Consistency", value: "100%" },
      { label: "Auditable", value: "✓" },
      { label: "Cost", value: "$0/request" },
    ],
  },
  {
    id: "edu",
    title: "Educational Tool",
    titleAr: "أداة تعليمية",
    tag: "Education",
    tagColor: "edu",
    icon: "📚",
    description:
      "The most realistic use case today: teach Arabic morphology through interactive algebra. Students see how roots × patterns = meaning. This works because the engine IS the subject matter.",
    samples: [
      "Teach me about Arabic roots",
      "What does the root ك-ت-ب mean?",
      "How do patterns change meaning?",
      "Show me examples of the agent pattern",
      "أريد أن أتعلم عن الجذور العربية",
      "Explain the difference between فاعل and مفعول",
    ],
    metrics: [
      { label: "Languages", value: "EN + AR" },
      { label: "Interactive", value: "✓" },
      { label: "Transparent", value: "100%" },
    ],
  },
  {
    id: "infra",
    title: "LLM Pre-filter",
    titleAr: "مرشح أولي للنماذج اللغوية",
    tag: "Infrastructure",
    tagColor: "infra",
    icon: "⚡",
    description:
      "Concept: classify intent symbolically before calling an expensive LLM. If resolved with high confidence, skip the LLM. Theoretical cost savings — would need real traffic data to validate.",
    samples: [
      "Delete all records from last month",
      "Summarize the Q3 earnings report",
      "Write a poem about the stars",
      "Translate this document to French",
      "What are the implications of quantum computing on cryptography?",
      "Book a flight to Dubai next week",
    ],
    metrics: [
      { label: "Cost savings", value: "theoretical" },
      { label: "Pre-filter", value: "<10µs" },
      { label: "Validated", value: "No" },
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
