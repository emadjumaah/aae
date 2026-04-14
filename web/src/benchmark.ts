import "./styles.css";
import { initBackground, renderNav, esc, isDark } from "./shared";
import { run } from "./engine-bridge";

import benchmarkResults from "../../benchmark/results.json";

declare const Chart: any;

renderNav("nav", "benchmark");
initBackground(document.getElementById("bg-canvas") as HTMLCanvasElement);

// Apply Chart.js defaults based on current theme
function applyChartTheme() {
  const style = getComputedStyle(document.documentElement);
  Chart.defaults.color = style.getPropertyValue('--chart-text').trim() || '#333';
  Chart.defaults.borderColor = style.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,.08)';
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 11;
}
applyChartTheme();

// ─── types ──────────────────────────────────────────────────────────────────
interface CaseResult {
  id: string;
  category: string;
  input: string;
  expected: { intent: string; root: string; action: string };
  actual: { intent: string; root: string; action: string };
  intentMatch: boolean;
  rootMatch: boolean;
  actionMatch: boolean;
  allMatch: boolean;
  durationUs: number;
  note: string;
}
interface ConsistencyGroup {
  id: string;
  variants: string[];
  expected: { intent: string; root: string; action: string };
  results: { input: string; intent: string; root: string; action: string }[];
  allConsistent: boolean;
  matchesExpected: boolean;
  note: string;
}
interface BilingualPair {
  id: string;
  english: string;
  arabic: string;
  expected: { intent: string; root: string; action: string };
  enResult: { intent: string; root: string; action: string };
  arResult: { intent: string; root: string; action: string };
  parity: boolean;
  enCorrect: boolean;
  arCorrect: boolean;
  note: string;
}

const R = benchmarkResults as any;
const cases: CaseResult[] = R.cases;
const consistency: ConsistencyGroup[] = R.consistency;
const bilingual: BilingualPair[] = R.bilingual;
const overall = R.overall;
const categories = R.categories;
const llmBaseline = R.llmBaseline;

const consistencyRate =
  consistency.filter((c) => c.allConsistent).length / consistency.length;
const bilingualParity =
  bilingual.filter((b) => b.parity).length / bilingual.length;

// ─── Colors (resolved at render time based on current theme) ────────────────
const dark = isDark();
const GOLD = dark ? '#daa520' : '#b8860b';
const CYAN = dark ? '#5eead4' : '#0c8c83';
const GREEN = dark ? '#4edc6f' : '#1a8f3a';
const RED = dark ? '#f87171' : '#c43045';
const PURPLE = dark ? '#c084fc' : '#7b3fa0';
const VIOLET = dark ? '#9f7aea' : '#6b3fb0';
const ROSE = dark ? '#fb7185' : '#c43060';

// ─── Hero stats (id="hero-stats") ───────────────────────────────────────────
{
  const el = document.getElementById("hero-stats")!;
  const stats = [
    {
      value: `${(overall.intentAcc * 100).toFixed(1)}%`,
      label: "Intent Accuracy",
      sub: `vs GPT-4o ${(llmBaseline.models["GPT-4o"].intentAcc * 100).toFixed(0)}%`,
    },
    {
      value: `${(overall.actionAcc * 100).toFixed(1)}%`,
      label: "Action Accuracy",
      sub: `vs GPT-4o ${(llmBaseline.models["GPT-4o"].actionAcc * 100).toFixed(0)}%`,
    },
    {
      value: `${(overall.fullAcc * 100).toFixed(1)}%`,
      label: "Full Match",
      sub: `${R.totalCases} test cases`,
    },
    {
      value: `~${Math.round(overall.avgDurationUs)}µs`,
      label: "Avg Latency",
      sub: `${(llmBaseline.models["GPT-4o"].avgLatencyMs / (overall.avgDurationUs / 1000)).toFixed(0)}× faster than GPT-4o`,
    },
    { value: "$0", label: "Inference Cost", sub: "No API, no GPU" },
    { value: "152", label: "Arabic Roots", sub: "Zero parameters" },
  ];
  el.innerHTML = stats
    .map(
      (s) => `
    <div class="stat-card">
      <div class="stat-value" style="color:var(--gold)">${esc(s.value)}</div>
      <div class="stat-label">${esc(s.label)}</div>
      <div class="stat-sub">${esc(s.sub)}</div>
    </div>`,
    )
    .join("");
}

// ─── Meta ───────────────────────────────────────────────────────────────────
document.getElementById("meta")!.textContent =
  `Engine v${R.engineVersion} · ${R.totalCases} single cases · ${consistency.length} consistency groups · ${bilingual.length} bilingual pairs · ${new Date(R.timestamp).toLocaleDateString()}`;

// ─── Accuracy charts (id="chart-intent", id="chart-action") ────────────────
{
  const models = Object.keys(llmBaseline.models);
  const allLabels = ["Arabic Algebra", ...models];

  // Intent chart
  new Chart(
    (document.getElementById("chart-intent") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "bar",
      data: {
        labels: allLabels,
        datasets: [
          {
            label: "Intent Accuracy",
            data: [
              overall.intentAcc,
              ...models.map((m) => llmBaseline.models[m].intentAcc),
            ],
            backgroundColor: allLabels.map((_, i) => (i === 0 ? GOLD : CYAN)),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0.8, max: 1 } },
      },
    },
  );

  // Action chart
  new Chart(
    (document.getElementById("chart-action") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "bar",
      data: {
        labels: allLabels,
        datasets: [
          {
            label: "Action Accuracy",
            data: [
              overall.actionAcc,
              ...models.map((m) => llmBaseline.models[m].actionAcc),
            ],
            backgroundColor: allLabels.map((_, i) => (i === 0 ? GOLD : GREEN)),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0.7, max: 1 } },
      },
    },
  );
}

// ─── Comparison table (id="comp-body") ──────────────────────────────────────
{
  const tbody = document.getElementById("comp-body")!;
  const models = llmBaseline.models;

  function win(ours: number, theirs: number) {
    return ours >= theirs ? "win" : "lose";
  }

  let html = `<tr class="engine-row">
    <td class="model-name">Arabic Algebra Engine</td>
    <td class="win">${(overall.intentAcc * 100).toFixed(1)}%</td>
    <td class="win">${(overall.actionAcc * 100).toFixed(1)}%</td>
    <td>${(consistencyRate * 100).toFixed(0)}%</td>
    <td>${(bilingualParity * 100).toFixed(0)}%</td>
    <td class="win">~${Math.round(overall.avgDurationUs)}µs</td>
    <td class="win">$0</td>
    <td>152 roots</td>
    <td class="win">✓</td>
    <td class="win">✓</td></tr>`;

  for (const [name, m] of Object.entries<any>(models)) {
    html += `<tr>
      <td class="model-name">${esc(name)}</td>
      <td class="${win(overall.intentAcc, m.intentAcc)}">${(m.intentAcc * 100).toFixed(0)}%</td>
      <td class="${win(overall.actionAcc, m.actionAcc)}">${(m.actionAcc * 100).toFixed(0)}%</td>
      <td>${(m.consistencyRate * 100).toFixed(0)}%</td>
      <td>${(m.bilingualParity * 100).toFixed(0)}%</td>
      <td>${m.avgLatencyMs}ms</td>
      <td>$${m.costPer1000}/1k</td>
      <td>${esc(m.parameters)}</td>
      <td>${m.explainable ? "✓" : "✗"}</td>
      <td>${m.offline ? "✓" : "✗"}</td></tr>`;
  }
  tbody.innerHTML = html;
}

// ─── Radar chart (id="chart-radar") ─────────────────────────────────────────
{
  const labels = [
    "Intent",
    "Action",
    "Consistency",
    "Bilingual",
    "Explainability",
    "Cost Eff.",
  ];
  const ourData = [
    overall.intentAcc,
    overall.actionAcc,
    consistencyRate,
    bilingualParity,
    1.0,
    1.0,
  ];

  const datasets: any[] = [
    {
      label: "Arabic Algebra",
      data: ourData,
      borderColor: GOLD,
      backgroundColor: "rgba(218,165,32,.15)",
      pointBackgroundColor: GOLD,
    },
  ];
  const modelColors = [CYAN, PURPLE, GREEN, ROSE];
  Object.entries<any>(llmBaseline.models).forEach(([name, m], i) => {
    datasets.push({
      label: name,
      data: [
        m.intentAcc,
        m.actionAcc,
        m.consistencyRate,
        m.bilingualParity,
        0,
        m.costPer1000 < 1 ? 0.8 : 0.2,
      ],
      borderColor: modelColors[i],
      backgroundColor: "transparent",
      pointBackgroundColor: modelColors[i],
      borderDash: [4, 2],
    });
  });

  new Chart(
    (document.getElementById("chart-radar") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "radar",
      data: { labels, datasets },
      options: {
        responsive: true,
        scales: { r: { beginAtZero: true, max: 1 } },
        plugins: { legend: { position: "top" } },
      },
    },
  );
}

// ─── Operational advantages (id="chart-ops") ────────────────────────────────
{
  new Chart(
    (document.getElementById("chart-ops") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "bar",
      data: {
        labels: ["Deterministic", "Explainable", "Offline", "Privacy"],
        datasets: [
          {
            label: "Arabic Algebra",
            data: [1, 1, 1, 1],
            backgroundColor: GOLD,
          },
          { label: "GPT-4o", data: [0, 0, 0, 0], backgroundColor: CYAN },
          { label: "Claude 3.5", data: [0, 0, 0, 0], backgroundColor: PURPLE },
          { label: "BERT", data: [0.9, 0.3, 1, 1], backgroundColor: GREEN },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            min: 0,
            max: 1,
            ticks: {
              callback: (v: number) => (v === 1 ? "Yes" : v === 0 ? "No" : ""),
            },
          },
        },
        plugins: { legend: { position: "top" } },
      },
    },
  );
}

// ─── Latency chart (id="chart-latency") ─────────────────────────────────────
{
  const models = llmBaseline.models;
  const allLabels = ["Arabic Algebra", ...Object.keys(models)];
  const latencies = [
    overall.avgDurationUs / 1000,
    ...Object.values<any>(models).map((m) => m.avgLatencyMs),
  ];

  new Chart(
    (document.getElementById("chart-latency") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "bar",
      data: {
        labels: allLabels,
        datasets: [
          {
            label: "Latency (ms)",
            data: latencies,
            backgroundColor: allLabels.map((_, i) => (i === 0 ? GOLD : CYAN)),
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: "ms (log scale)" },
          },
        },
      },
    },
  );
}

// ─── Cost chart (id="chart-cost") ───────────────────────────────────────────
{
  const models = llmBaseline.models;
  const allLabels = ["Arabic Algebra", ...Object.keys(models)];
  const costs = [0, ...Object.values<any>(models).map((m) => m.costPer1000)];

  new Chart(
    (document.getElementById("chart-cost") as HTMLCanvasElement).getContext(
      "2d",
    )!,
    {
      type: "bar",
      data: {
        labels: allLabels,
        datasets: [
          {
            label: "Cost per 1K ($)",
            data: costs,
            backgroundColor: allLabels.map((_, i) => (i === 0 ? GOLD : ROSE)),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { title: { display: true, text: "USD per 1,000 requests" } },
        },
      },
    },
  );
}

// ─── Per-category (id="chart-categories") ───────────────────────────────────
{
  const cats = ["intent", "action", "disambiguation", "adversarial"];
  const catLabels = ["Intent", "Action", "Disambiguation", "Adversarial"];
  new Chart(
    (
      document.getElementById("chart-categories") as HTMLCanvasElement
    ).getContext("2d")!,
    {
      type: "bar",
      data: {
        labels: catLabels,
        datasets: [
          {
            label: "Intent Acc",
            data: cats.map((c) => categories[c]?.intentAcc ?? 0),
            backgroundColor: GOLD,
          },
          {
            label: "Root Acc",
            data: cats.map((c) => categories[c]?.rootAcc ?? 0),
            backgroundColor: VIOLET,
          },
          {
            label: "Action Acc",
            data: cats.map((c) => categories[c]?.actionAcc ?? 0),
            backgroundColor: CYAN,
          },
          {
            label: "Full Match",
            data: cats.map((c) => categories[c]?.fullAcc ?? 0),
            backgroundColor: GREEN,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { y: { min: 0.75, max: 1 } },
      },
    },
  );
}

// ─── Consistency chart (id="chart-consistency") ─────────────────────────────
{
  const matched = consistency.filter((c) => c.matchesExpected).length;
  const consistent = consistency.filter((c) => c.allConsistent).length;
  const diverged = consistency.length - consistent;

  new Chart(
    (
      document.getElementById("chart-consistency") as HTMLCanvasElement
    ).getContext("2d")!,
    {
      type: "doughnut",
      data: {
        labels: ["Fully Consistent", "Diverged"],
        datasets: [
          { data: [consistent, diverged], backgroundColor: [GREEN, RED] },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    },
  );
}

// ─── Consistency detail (id="consistency-detail") ───────────────────────────
{
  const el = document.getElementById("consistency-detail")!;
  el.innerHTML =
    '<h4 style="color:var(--cyan);margin-bottom:12px;">Paraphrase Groups</h4>' +
    consistency
      .map((g) => {
        const ok = g.allConsistent && g.matchesExpected;
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:var(--text)">${esc(g.id)}</strong>
          <span style="color:${ok ? GREEN : RED};font-size:.82rem;">${ok ? "✓ Consistent" : "✗ Diverged"}</span>
        </div>
        <div style="font-size:.75rem;color:var(--text-dim);margin-top:4px;">
          ${g.results
            .map((r) => {
              const match =
                r.intent === g.expected.intent &&
                r.root === g.expected.root &&
                r.action === g.expected.action;
              return `<span style="color:${match ? "var(--text)" : RED}">"${esc(r.input.length > 35 ? r.input.slice(0, 35) + "…" : r.input)}" → ${esc(r.action)}</span>`;
            })
            .join(" · ")}
        </div>
      </div>`;
      })
      .join("");
}

// ─── Bilingual charts (id="chart-bilingual", id="chart-bilingual2") ────────
{
  const parityCount = bilingual.filter((b) => b.parity).length;
  const divergedCount = bilingual.length - parityCount;

  new Chart(
    (
      document.getElementById("chart-bilingual") as HTMLCanvasElement
    ).getContext("2d")!,
    {
      type: "doughnut",
      data: {
        labels: ["Parity", "Diverged"],
        datasets: [
          { data: [parityCount, divergedCount], backgroundColor: [GREEN, RED] },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    },
  );

  const enCorrect = bilingual.filter((b) => b.enCorrect).length;
  const arCorrect = bilingual.filter((b) => b.arCorrect).length;

  new Chart(
    (
      document.getElementById("chart-bilingual2") as HTMLCanvasElement
    ).getContext("2d")!,
    {
      type: "bar",
      data: {
        labels: ["English", "Arabic"],
        datasets: [
          {
            label: "Correct",
            data: [enCorrect, arCorrect],
            backgroundColor: GREEN,
          },
          {
            label: "Incorrect",
            data: [bilingual.length - enCorrect, bilingual.length - arCorrect],
            backgroundColor: RED,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { x: {}, y: { stacked: true } },
      },
    },
  );
}

// ─── Bilingual detail (id="bilingual-detail") ──────────────────────────────
{
  const el = document.getElementById("bilingual-detail")!;
  el.innerHTML =
    '<h4 style="color:var(--cyan);margin-bottom:12px;">Pair Details</h4>' +
    bilingual
      .map((b) => {
        const ok = b.parity;
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);display:grid;grid-template-columns:1fr 1fr 80px;gap:12px;align-items:center;">
        <div>
          <div style="font-size:.72rem;color:var(--text-dim)">EN</div>
          <div style="font-size:.82rem;">${esc(b.english)}</div>
          <div style="font-size:.72rem;color:${b.enCorrect ? "var(--text)" : RED}">→ ${esc(b.enResult.action)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:.72rem;color:var(--text-dim)">AR</div>
          <div style="font-size:.82rem;font-family:var(--font-ar);direction:rtl;">${esc(b.arabic)}</div>
          <div style="font-size:.72rem;color:${b.arCorrect ? "var(--text)" : RED}">→ ${esc(b.arResult.action)}</div>
        </div>
        <div style="text-align:center;color:${ok ? GREEN : RED};font-weight:600;">${ok ? "✓" : "✗"}</div>
      </div>`;
      })
      .join("");
}

// ─── Case explorer (id="case-filters", id="case-list") ─────────────────────
{
  const filtersEl = document.getElementById("case-filters")!;
  const listEl = document.getElementById("case-list")!;

  const filterCategories = [
    "all",
    "pass",
    "fail",
    "intent",
    "action",
    "disambiguation",
    "adversarial",
  ];

  filtersEl.innerHTML = filterCategories
    .map(
      (f) =>
        `<button class="filter-btn ${f === "all" ? "active" : ""}" data-filter="${f}">${f === "pass" ? "✓ Pass" : f === "fail" ? "✗ Fail" : f.charAt(0).toUpperCase() + f.slice(1)}</button>`,
    )
    .join("");

  function renderCases(filter: string) {
    let filtered = cases;
    if (filter === "pass") filtered = cases.filter((c) => c.allMatch);
    else if (filter === "fail") filtered = cases.filter((c) => !c.allMatch);
    else if (filter !== "all")
      filtered = cases.filter((c) => c.category === filter);

    listEl.innerHTML = filtered
      .map(
        (c) => `
      <div class="case-item">
        <span class="case-id">${esc(c.id)}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(c.input)}">${esc(c.input)}</span>
        <span style="font-size:.78rem;">
          <span style="color:${c.intentMatch ? "var(--text)" : RED}">${esc(c.actual.intent)}</span> →
          <span style="color:${c.actionMatch ? "var(--green)" : RED}">${esc(c.actual.action)}</span>
        </span>
        <span style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
          <span class="case-dur">${c.durationUs}µs</span>
          <span class="case-badge ${c.allMatch ? "pass" : "fail"}">${c.allMatch ? "✓" : "✗"}</span>
        </span>
      </div>`,
      )
      .join("");
  }

  filtersEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".filter-btn",
    ) as HTMLButtonElement | null;
    if (!btn) return;
    filtersEl
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderCases(btn.dataset.filter!);
  });

  renderCases("all");
}
