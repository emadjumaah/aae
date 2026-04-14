import './styles.css';
import { initBackground, renderNav, esc, confColor } from './shared';
import { run, engine, ROOTS, PATTERNS, EXAMPLES, encodeLocal, decodeLocal, compactToken } from './engine-bridge';
import type { AlgebraToken, IntentOperator, PatternOperator } from './engine-bridge';

renderNav('nav', 'playground');
initBackground(document.getElementById('bg-canvas') as HTMLCanvasElement);

// ─── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.panel!)!.classList.add('active');
  });
});

// ─── Live Engine ────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Schedule a meeting with the team tomorrow',
  'Send the report to the manager',
  'أريد أن أتعلم عن الذكاء الاصطناعي',
  'What is the project deadline?',
  'Review the code for security issues',
  'اجمع فريق الهندسة لاجتماع سريع',
  'Write down the meeting notes',
  'Deploy the application to production',
  'نحتاج أن نقرّر الميزانية',
  'Give the new hire access to the system',
];

const sugEl = document.getElementById('suggestions')!;
sugEl.innerHTML = SUGGESTIONS.map(s =>
  `<button class="sug-btn" data-s="${esc(s)}">${esc(s.length > 42 ? s.slice(0, 42) + '…' : s)}</button>`
).join('');
sugEl.querySelectorAll<HTMLButtonElement>('.sug-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    (document.getElementById('liveInput') as HTMLInputElement).value = btn.dataset.s!;
    runLive();
  });
});

document.getElementById('liveRun')!.addEventListener('click', runLive);
(document.getElementById('liveInput') as HTMLInputElement).addEventListener('keydown', e => {
  if (e.key === 'Enter') runLive();
});

function runLive() {
  const input = (document.getElementById('liveInput') as HTMLInputElement).value.trim();
  if (!input) return;
  const data = run(input);
  showResult('liveResult', data);
}

function showResult(targetId: string, data: ReturnType<typeof run>) {
  const r = data.reasoning;
  const cc = confColor(r.confidence);
  document.getElementById(targetId)!.innerHTML = `
    <div class="card">
      <h3>① Encode → AlgebraToken</h3>
      <div class="token-display">
        <span class="root">${esc(data.token.root)}</span>
        <span class="op">×</span>
        <span class="pattern">${esc(data.token.pattern)}</span>
        ${data.token.modifiers.map(m => `<span class="mod">${esc(m)}</span>`).join('')}
      </div>
      <div class="compact">${esc(data.algebraCompact)}</div>
      <div style="margin-top:8px;font-size:.78rem;color:var(--text-dim);">
        intent = <span style="color:var(--text)">${esc(data.token.intent)}</span> ·
        root = <span style="color:var(--gold)">${esc(data.token.root)}</span> (${esc(data.token.rootLatin)}) ·
        pattern = <span style="color:var(--cyan)">${esc(data.token.pattern)}</span>
      </div>
    </div>
    <div class="pipeline-arrow">↓</div>
    <div class="card">
      <h3>② Reason (symbolic)</h3>
      <div class="field"><div class="label">Action</div><div class="value action">${esc(r.actionType)}</div></div>
      <div class="field"><div class="label">Resource</div><div class="value resource">${esc(r.resource)}</div></div>
      <div class="field"><div class="label">Constraints</div><div class="value">${r.constraints.length ? r.constraints.map(c => esc(c)).join(', ') : 'none'}</div></div>
      <div class="confidence">
        <span style="font-size:.72rem;color:var(--text-dim)">Confidence</span>
        <div class="confidence-bar"><div class="confidence-fill" style="width:${r.confidence * 100}%;background:${cc}"></div></div>
        <span class="confidence-pct" style="color:${cc}">${(r.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
    <div class="pipeline-arrow">↓</div>
    <div class="card">
      <h3>③ Reasoning Trace</h3>
      <div class="explanation">${esc(data.explanation)}</div>
    </div>
    <div class="pipeline-arrow">↓</div>
    <div class="card">
      <h3>④ Response</h3>
      <div style="font-size:.95rem;color:var(--text);line-height:1.7;">${esc(data.response)}</div>
      <div style="margin-top:8px;font-size:.72rem;color:var(--text-dim);">${data.durationMs}ms · client-side · no LLM</div>
    </div>`;
}

// ─── Examples ───────────────────────────────────────────────────────────────
const EXAMPLES_DATA = EXAMPLES;
const exGrid = document.getElementById('exGrid')!;
exGrid.innerHTML = EXAMPLES_DATA.map((ex, i) => `
  <button class="ex-btn" data-idx="${i}">
    <div class="en">${esc(ex.inputEn)}</div>
    <div class="ar">${esc(ex.inputAr)}</div>
  </button>`).join('');
exGrid.querySelectorAll<HTMLButtonElement>('.ex-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    exGrid.querySelectorAll('.ex-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const ex = EXAMPLES_DATA[+btn.dataset.idx!];
    const r = ex.reasoning;
    const cc = confColor(r.confidence);
    document.getElementById('exResult')!.innerHTML = `
      <div class="card">
        <h3>Input (bilingual)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><div style="font-size:.7rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px;">English</div><div>${esc(ex.inputEn)}</div></div>
          <div><div style="font-size:.7rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px;">العربية</div><div style="font-family:var(--font-ar);direction:rtl;text-align:right;font-size:1.1rem;">${esc(ex.inputAr)}</div></div>
        </div>
        <div style="margin-top:8px;display:inline-block;background:rgba(78,220,111,.08);color:var(--green);font-size:.7rem;padding:2px 10px;border-radius:12px;">→ Same AlgebraToken from both languages</div>
      </div>
      <div class="pipeline-arrow">↓</div>
      <div class="card">
        <h3>AlgebraToken</h3>
        <div class="token-display">
          <span class="root">${esc(ex.token.root)}</span>
          <span class="op">×</span>
          <span class="pattern">${esc(ex.token.pattern)}</span>
          ${ex.token.modifiers.map(m => `<span class="mod">${esc(m)}</span>`).join('')}
        </div>
        <div class="compact">${esc(ex.algebraCompact)}</div>
      </div>
      <div class="pipeline-arrow">↓</div>
      <div class="card">
        <h3>Reasoning</h3>
        <div class="field"><div class="label">Action</div><div class="value action">${esc(r.actionType)}</div></div>
        <div class="field"><div class="label">Resource</div><div class="value resource">${esc(r.resource)}</div></div>
        <div class="confidence">
          <span style="font-size:.72rem;color:var(--text-dim)">Confidence</span>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${r.confidence * 100}%;background:${cc}"></div></div>
          <span class="confidence-pct" style="color:${cc}">${(r.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div class="pipeline-arrow">↓</div>
      <div class="card">
        <h3>Trace</h3>
        <div class="explanation">${esc(ex.explanation)}</div>
      </div>
      <div class="pipeline-arrow">↓</div>
      <div class="card">
        <h3>Response</h3>
        <div style="font-size:.95rem;line-height:1.7;">${esc(ex.response)}</div>
      </div>`;
  });
});

// ─── Token Builder ──────────────────────────────────────────────────────────
const INTENTS: IntentOperator[] = ['seek','do','send','gather','record','learn','decide','enable','judge','ask'];
const PATTERN_OPS: PatternOperator[] = ['agent','patient','place','instance','plural','seek','mutual','process','intensifier','causer'];

const bIntentEl = document.getElementById('bIntent') as HTMLSelectElement;
const bRootEl = document.getElementById('bRoot') as HTMLSelectElement;
const bPatternEl = document.getElementById('bPattern') as HTMLSelectElement;

bIntentEl.innerHTML = INTENTS.map(i => `<option value="${i}">${i}</option>`).join('');
bRootEl.innerHTML = ROOTS.map(r => `<option value="${esc(r.arabic)}">${esc(r.arabic)} (${esc(r.latin)}) — ${esc(r.semanticField)}</option>`).join('');
bPatternEl.innerHTML = PATTERNS.map(p => `<option value="${p.operator}">${p.operator} — ${esc(p.wazn)}</option>`).join('');

document.getElementById('bRun')!.addEventListener('click', () => {
  const intent = bIntentEl.value as IntentOperator;
  const rootEntry = ROOTS.find(r => r.arabic === bRootEl.value)!;
  const pattern = bPatternEl.value as PatternOperator;
  const modsRaw = (document.getElementById('bMods') as HTMLInputElement).value.trim();
  const modifiers = modsRaw ? modsRaw.split(',').map(m => m.trim()).filter(Boolean) : [];

  const token: AlgebraToken = { intent, root: rootEntry.arabic, rootLatin: rootEntry.latin, pattern, modifiers };
  const reasoning = engine.reason(token);
  const explanation = engine.explain(token);
  const cc = confColor(reasoning.confidence);
  document.getElementById('bResult')!.innerHTML = `
    <div class="card">
      <h3>Token</h3>
      <div class="token-display">
        <span class="root">${esc(token.root)}</span>
        <span class="op">×</span>
        <span class="pattern">${esc(token.pattern)}</span>
        ${token.modifiers.map(m => `<span class="mod">${esc(m)}</span>`).join('')}
      </div>
      <div class="compact">${esc(compactToken(token))}</div>
    </div>
    <div class="pipeline-arrow">↓</div>
    <div class="card">
      <h3>Reasoning</h3>
      <div class="field"><div class="label">Action</div><div class="value action">${esc(reasoning.actionType)}</div></div>
      <div class="field"><div class="label">Resource</div><div class="value resource">${esc(reasoning.resource)}</div></div>
      <div class="confidence">
        <span style="font-size:.72rem;color:var(--text-dim)">Confidence</span>
        <div class="confidence-bar"><div class="confidence-fill" style="width:${reasoning.confidence * 100}%;background:${cc}"></div></div>
        <span class="confidence-pct" style="color:${cc}">${(reasoning.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
    <div class="pipeline-arrow">↓</div>
    <div class="card"><h3>Trace</h3><div class="explanation">${esc(explanation)}</div></div>`;
});

// ─── Rules Matrix ───────────────────────────────────────────────────────────
{
  const table = document.getElementById('matrixTable')!;
  let html = '<thead><tr><th></th>';
  PATTERN_OPS.forEach(p => { html += `<th>${esc(p)}</th>`; });
  html += '</tr></thead><tbody>';
  INTENTS.forEach(intent => {
    html += `<tr><th>${esc(intent)}</th>`;
    PATTERN_OPS.forEach(pattern => {
      const token: AlgebraToken = { intent, root: 'عمل', rootLatin: "'m-l", pattern, modifiers: [] };
      const res = engine.reason(token);
      const action = res.confidence > 0.5 ? res.actionType : null;
      html += action ? `<td class="rule">${esc(action)}</td>` : `<td class="empty">·</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

// ─── Dictionary ─────────────────────────────────────────────────────────────
document.getElementById('rootsGrid')!.innerHTML = ROOTS.map(r => `
  <div class="dict-card">
    <div class="arabic">${esc(r.arabic)}</div>
    <div class="latin">${esc(r.latin)}</div>
    <div class="meaning">${esc(r.semanticField)}</div>
    <div class="covers">${esc(r.covers)}</div>
  </div>`).join('');

document.getElementById('patternsGrid')!.innerHTML = PATTERNS.map(p => `
  <div class="dict-card">
    <div class="wazn">${esc(p.wazn)}</div>
    <div class="operator">${esc(p.operator)}</div>
    <div class="meaning">${esc(p.meaning)}</div>
    <div style="font-size:.75rem;color:var(--text-dim);margin-top:4px;">
      <span style="font-family:var(--font-ar);direction:rtl;">${esc(p.example.arabic)}</span> — ${esc(p.example.english)}
    </div>
  </div>`).join('');
