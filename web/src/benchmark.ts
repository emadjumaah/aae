import './styles.css';
import { initBackground, renderNav, esc, confColor } from './shared';
import { run, ROOTS, PATTERNS } from './engine-bridge';

/* We load results.json as a static asset. Vite resolves the import. */
import benchmarkResults from '../../benchmark/results.json';

declare const Chart: any; // loaded via CDN <script> in benchmark.html

renderNav('nav', 'benchmark');
initBackground(document.getElementById('bg-canvas') as HTMLCanvasElement);

// ─── types ──────────────────────────────────────────────────────────────────
interface CaseResult {
  id: string; category: string; input: string;
  expected: { intent: string; root: string; action: string };
  actual: { intent: string; root: string; action: string };
  intentMatch: boolean; rootMatch: boolean; actionMatch: boolean; allMatch: boolean;
  durationUs: number; note: string;
}
interface ConsistencyGroup {
  id: string; variants: string[];
  expected: { intent: string; root: string; action: string };
  results: { input: string; intent: string; root: string; action: string }[];
  allConsistent: boolean; matchesExpected: boolean; note: string;
}
interface BilingualPair {
  id: string; english: string; arabic: string;
  expected: { intent: string; root: string; action: string };
  enResult: { intent: string; root: string; action: string };
  arResult: { intent: string; root: string; action: string };
  parity: boolean; enCorrect: boolean; arCorrect: boolean; note: string;
}

const R = benchmarkResults as any;
const cases: CaseResult[] = R.cases;
const consistency: ConsistencyGroup[] = R.consistency;
const bilingual: BilingualPair[] = R.bilingual;
const overall = R.overall;
const categories = R.categories;
const llmBaseline = R.llmBaseline;

// ─── Hero stats ─────────────────────────────────────────────────────────────
document.getElementById('stat-intent')!.textContent = `${(overall.intentAcc * 100).toFixed(1)}%`;
document.getElementById('stat-action')!.textContent = `${(overall.actionAcc * 100).toFixed(1)}%`;
document.getElementById('stat-full')!.textContent = `${(overall.fullAcc * 100).toFixed(1)}%`;
document.getElementById('stat-latency')!.textContent = `~${(overall.avgDurationUs / 1000).toFixed(0)}µs`;

// ─── Chart defaults ─────────────────────────────────────────────────────────
const GOLD = '#daa520';
const CYAN = '#5eead4';
const GREEN = '#4edc6f';
const RED = '#f87171';
const PURPLE = '#c084fc';
const VIOLET = '#9f7aea';
const ROSE = '#fb7185';
const TEXT = '#c9d1d9';
const DIM = '#5a6272';

Chart.defaults.color = TEXT;
Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
Chart.defaults.font.family = "'IBM Plex Mono', monospace";
Chart.defaults.font.size = 11;

// ─── 1. Accuracy comparison bars ────────────────────────────────────────────
{
  const ctx = (document.getElementById('accuracyChart') as HTMLCanvasElement).getContext('2d')!;
  const models = Object.keys(llmBaseline.models);
  const allLabels = ['Arabic Algebra', ...models];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Intent Accuracy',
          data: [overall.intentAcc, ...models.map((m: string) => llmBaseline.models[m].intentAcc)],
          backgroundColor: GOLD,
        },
        {
          label: 'Action Accuracy',
          data: [overall.actionAcc, ...models.map((m: string) => llmBaseline.models[m].actionAcc)],
          backgroundColor: CYAN,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: false, min: 0.7, max: 1, ticks: { format: { style: 'percent' } } } },
    },
  });
}

// ─── 2. Full comparison table ───────────────────────────────────────────────
{
  const tbody = document.querySelector('#comparisonTable tbody')!;
  const models = llmBaseline.models;
  const consistencyRate = consistency.filter(c => c.allConsistent).length / consistency.length;
  const bilingualParity = bilingual.filter(b => b.parity).length / bilingual.length;

  // Our row
  let html = `<tr class="ours">
    <td><strong>Arabic Algebra</strong></td>
    <td>${(overall.intentAcc * 100).toFixed(1)}%</td>
    <td>${(overall.actionAcc * 100).toFixed(1)}%</td>
    <td>${(consistencyRate * 100).toFixed(0)}%</td>
    <td>${(bilingualParity * 100).toFixed(0)}%</td>
    <td>~${(overall.avgDurationUs / 1000).toFixed(0)}µs</td>
    <td>$0</td>
    <td>152 roots</td>
    <td>✓</td>
    <td>✓</td></tr>`;

  for (const [name, m] of Object.entries<any>(models)) {
    html += `<tr>
      <td>${esc(name)}</td>
      <td>${(m.intentAcc * 100).toFixed(0)}%</td>
      <td>${(m.actionAcc * 100).toFixed(0)}%</td>
      <td>${(m.consistencyRate * 100).toFixed(0)}%</td>
      <td>${(m.bilingualParity * 100).toFixed(0)}%</td>
      <td>${m.avgLatencyMs}ms</td>
      <td>$${m.costPer1000}/1k</td>
      <td>${m.parameters}</td>
      <td>${m.explainable ? '✓' : '✗'}</td>
      <td>${m.offline ? '✓' : '✗'}</td></tr>`;
  }
  tbody.innerHTML = html;
}

// ─── 3. Radar chart ─────────────────────────────────────────────────────────
{
  const ctx = (document.getElementById('radarChart') as HTMLCanvasElement).getContext('2d')!;
  const consistencyRate = consistency.filter(c => c.allConsistent).length / consistency.length;
  const bilingualParity = bilingual.filter(b => b.parity).length / bilingual.length;

  const labels = ['Intent Acc', 'Action Acc', 'Consistency', 'Bilingual', 'Explainability', 'Cost Eff.'];
  const ourData = [overall.intentAcc, overall.actionAcc, consistencyRate, bilingualParity, 1.0, 1.0];

  const datasets: any[] = [
    { label: 'Arabic Algebra', data: ourData, borderColor: GOLD, backgroundColor: 'rgba(218,165,32,.15)', pointBackgroundColor: GOLD },
  ];
  const models = llmBaseline.models;
  const modelColors = [CYAN, PURPLE, GREEN, ROSE];
  Object.entries<any>(models).forEach(([name, m], i) => {
    datasets.push({
      label: name,
      data: [m.intentAcc, m.actionAcc, m.consistencyRate, m.bilingualParity, 0, m.costPer1000 < 1 ? 0.8 : 0.2],
      borderColor: modelColors[i],
      backgroundColor: 'transparent',
      pointBackgroundColor: modelColors[i],
      borderDash: [4, 2],
    });
  });

  new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: { responsive: true, scales: { r: { beginAtZero: true, max: 1 } }, plugins: { legend: { position: 'top' } } },
  });
}

// ─── 4. Latency + Cost ─────────────────────────────────────────────────────
{
  const ctx = (document.getElementById('latencyChart') as HTMLCanvasElement).getContext('2d')!;
  const models = llmBaseline.models;
  const allLabels = ['Arabic Algebra', ...Object.keys(models)];
  const latencies = [overall.avgDurationUs / 1000, ...Object.values<any>(models).map(m => m.avgLatencyMs)];
  const costs = [0, ...Object.values<any>(models).map(m => m.costPer1000)];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        { label: 'Latency (ms)', data: latencies, backgroundColor: CYAN, yAxisID: 'y' },
        { label: 'Cost per 1K ($)', data: costs, backgroundColor: ROSE, yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { type: 'logarithmic', position: 'left', title: { display: true, text: 'Latency (ms, log)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Cost ($)' } },
      },
    },
  });
}

// ─── 5. Per-category breakdown ──────────────────────────────────────────────
{
  const ctx = (document.getElementById('categoryChart') as HTMLCanvasElement).getContext('2d')!;
  const cats = ['intent', 'action', 'disambiguation', 'adversarial'];
  const catLabels = ['Intent', 'Action', 'Disambiguation', 'Adversarial'];
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: catLabels,
      datasets: [
        { label: 'Intent Acc', data: cats.map(c => categories[c]?.intentAcc ?? 0), backgroundColor: GOLD },
        { label: 'Root Acc', data: cats.map(c => categories[c]?.rootAcc ?? 0), backgroundColor: VIOLET },
        { label: 'Action Acc', data: cats.map(c => categories[c]?.actionAcc ?? 0), backgroundColor: CYAN },
        { label: 'Full Match', data: cats.map(c => categories[c]?.fullAcc ?? 0), backgroundColor: GREEN },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: false, min: 0.75, max: 1 } },
    },
  });
}

// ─── 6. Consistency groups ──────────────────────────────────────────────────
{
  const el = document.getElementById('consistencyGrid')!;
  el.innerHTML = consistency.map(g => {
    const ok = g.allConsistent && g.matchesExpected;
    return `<div class="card ${ok ? '' : 'fail'}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${esc(g.id)}</strong>
        <span style="color:${ok ? GREEN : RED}">${ok ? '✓ Consistent' : '✗ Diverged'}</span>
      </div>
      <div style="margin-top:8px;font-size:.78rem;">Expected: <span style="color:var(--gold)">${esc(g.expected.intent)}</span> ·
        <span style="color:var(--cyan)">${esc(g.expected.root)}</span> →
        <span style="color:var(--green)">${esc(g.expected.action)}</span>
      </div>
      <div style="margin-top:6px;">
        ${g.results.map(r => {
          const match = r.intent === g.expected.intent && r.root === g.expected.root && r.action === g.expected.action;
          return `<div style="font-size:.72rem;margin:2px 0;color:${match ? 'var(--text)' : RED}">
            ${match ? '✓' : '✗'} "${esc(r.input.length > 40 ? r.input.slice(0, 40) + '…' : r.input)}"
            → ${esc(r.intent)}/${esc(r.root)}/${esc(r.action)}
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:4px;font-size:.68rem;color:var(--text-dim);">${esc(g.note)}</div>
    </div>`;
  }).join('');
}

// ─── 7. Bilingual parity ───────────────────────────────────────────────────
{
  const el = document.getElementById('bilingualGrid')!;
  el.innerHTML = bilingual.map(b => {
    const ok = b.parity;
    return `<div class="card ${ok ? '' : 'fail'}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${esc(b.id)}</strong>
        <span style="color:${ok ? GREEN : RED}">${ok ? '✓ Parity' : '✗ Diverged'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div>
          <div style="font-size:.68rem;color:var(--text-dim);text-transform:uppercase;">English</div>
          <div style="font-size:.82rem;">${esc(b.english)}</div>
          <div style="font-size:.72rem;margin-top:2px;color:${b.enCorrect ? 'var(--text)' : RED}">
            → ${esc(b.enResult.intent)}/${esc(b.enResult.root)}/${esc(b.enResult.action)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:.68rem;color:var(--text-dim);text-transform:uppercase;">العربية</div>
          <div style="font-size:.82rem;font-family:var(--font-ar);direction:rtl;">${esc(b.arabic)}</div>
          <div style="font-size:.72rem;margin-top:2px;color:${b.arCorrect ? 'var(--text)' : RED}">
            → ${esc(b.arResult.intent)}/${esc(b.arResult.root)}/${esc(b.arResult.action)}
          </div>
        </div>
      </div>
      <div style="margin-top:4px;font-size:.68rem;color:var(--text-dim);">${esc(b.note)}</div>
    </div>`;
  }).join('');
}

// ─── 8. Case explorer ──────────────────────────────────────────────────────
{
  const el = document.getElementById('caseExplorer')!;
  const filterEl = document.getElementById('caseFilter') as HTMLSelectElement;

  function renderCases(filter: string) {
    const filtered = filter === 'all' ? cases : filter === 'pass' ? cases.filter(c => c.allMatch) : cases.filter(c => !c.allMatch);
    el.innerHTML = `<table class="full-table"><thead><tr>
      <th>ID</th><th>Category</th><th>Input</th><th>Intent</th><th>Root</th><th>Action</th><th>µs</th><th></th>
    </tr></thead><tbody>${filtered.map(c => `<tr>
      <td>${esc(c.id)}</td>
      <td><span class="badge ${c.category}">${esc(c.category)}</span></td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(c.input)}">${esc(c.input)}</td>
      <td style="color:${c.intentMatch ? 'var(--text)' : RED}">${esc(c.actual.intent)}</td>
      <td style="color:${c.rootMatch ? 'var(--gold)' : RED}">${esc(c.actual.root)}</td>
      <td style="color:${c.actionMatch ? 'var(--green)' : RED}">${esc(c.actual.action)}</td>
      <td style="font-size:.78rem;color:var(--text-dim)">${c.durationUs}</td>
      <td style="font-size:1rem;">${c.allMatch ? '✓' : '✗'}</td>
    </tr>`).join('')}</tbody></table>
    <div style="margin-top:8px;font-size:.75rem;color:var(--text-dim);">${filtered.length} cases shown</div>`;
  }

  filterEl.addEventListener('change', () => renderCases(filterEl.value));
  renderCases('all');
}

// ─── 9. Live test ──────────────────────────────────────────────────────────
{
  const input = document.getElementById('liveTestInput') as HTMLInputElement;
  const btn = document.getElementById('liveTestRun')!;
  const result = document.getElementById('liveTestResult')!;

  btn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    const data = run(text);
    const r = data.reasoning;
    const cc = confColor(r.confidence);
    result.innerHTML = `
      <div class="token-display" style="margin-bottom:12px;">
        <span class="root">${esc(data.token.root)}</span>
        <span class="op">×</span>
        <span class="pattern">${esc(data.token.pattern)}</span>
      </div>
      <div class="field"><div class="label">Intent</div><div class="value">${esc(data.token.intent)}</div></div>
      <div class="field"><div class="label">Action</div><div class="value action">${esc(r.actionType)}</div></div>
      <div class="field"><div class="label">Resource</div><div class="value resource">${esc(r.resource)}</div></div>
      <div class="confidence">
        <div class="confidence-bar"><div class="confidence-fill" style="width:${r.confidence * 100}%;background:${cc}"></div></div>
        <span class="confidence-pct" style="color:${cc}">${(r.confidence * 100).toFixed(0)}%</span>
      </div>
      <div style="margin-top:8px;font-size:.72rem;color:var(--text-dim);">${data.durationMs}ms</div>`;
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}
