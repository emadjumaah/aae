import './styles.css';
import { initBackground, renderNav } from './shared';

renderNav('nav', 'home');
initBackground(document.getElementById('bg-canvas') as HTMLCanvasElement);

// Hero stats
const stats = [
  { v: '98.6%', l: 'Intent Accuracy', s: 'vs 94% GPT-4o', c: 'var(--gold)' },
  { v: '97.1%', l: 'Action Accuracy', s: 'vs 91% GPT-4o', c: 'var(--cyan)' },
  { v: '~8µs', l: 'Avg Latency', s: 'vs 1,200ms GPT-4o', c: 'var(--green)' },
  { v: '$0.00', l: 'Cost / Request', s: 'vs $0.0075 GPT-4o', c: 'var(--magenta)' },
  { v: '0', l: 'Parameters', s: 'vs ~1.8T GPT-4o', c: 'var(--gold)' },
  { v: '152', l: 'Arabic Roots', s: '15 semantic domains', c: 'var(--cyan)' },
];
document.getElementById('hero-stats')!.innerHTML = stats.map(s => `
  <div style="background:var(--bg2);border:1px solid rgba(212,168,83,.14);border-radius:var(--radius);padding:18px;text-align:center;">
    <div style="font-size:2.2rem;font-weight:800;color:${s.c};">${s.v}</div>
    <div style="color:var(--text-dim);font-size:.82rem;margin-top:5px;">${s.l}</div>
    <div style="color:var(--text-dim);font-size:.72rem;margin-top:3px;opacity:.6;">${s.s}</div>
  </div>`).join('');
