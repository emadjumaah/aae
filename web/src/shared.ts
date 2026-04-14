/** Shared helpers used across all pages */

export function esc(s: unknown): string {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

/** Animated Arabic letter background on a canvas */
export function initBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  let W: number, H: number;
  const letters = 'ك ت ب ع ل م ح ك م ر س ل ج م ع ق ر ر س أ ل د ر س'.split(' ');
  const cols: number[] = [];
  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    const n = Math.floor(W / 28);
    cols.length = 0;
    for (let i = 0; i < n; i++) cols.push(Math.random() * H);
  }
  function draw() {
    ctx.fillStyle = 'rgba(10,10,18,0.06)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(212,168,83,0.12)';
    ctx.font = '20px "Noto Sans Arabic",sans-serif';
    for (let i = 0; i < cols.length; i++) {
      const ch = letters[Math.floor(Math.random() * letters.length)];
      ctx.fillText(ch, i * 28, cols[i]);
      cols[i] += 22;
      if (cols[i] > H && Math.random() > 0.98) cols[i] = 0;
    }
    requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  resize();
  draw();
}

/** Render top navigation bar and set active state */
export function renderNav(containerId: string, activePage: string) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pages = [
    { href: 'index.html', label: 'Home', id: 'home' },
    { href: 'playground.html', label: 'Playground', id: 'playground' },
    { href: 'benchmark.html', label: 'Benchmark', id: 'benchmark' },
    { href: 'usecases.html', label: 'Use Cases', id: 'usecases' },
  ];
  el.innerHTML = `
    <a href="index.html" class="logo">الجبر العربي</a>
    ${pages.map(p => `<a href="${p.href}" class="${p.id === activePage ? 'active' : ''}">${p.label}</a>`).join('')}
    <span class="spacer"></span>
    <a href="https://github.com" class="gh-link" target="_blank">GitHub ↗</a>
  `;
}

export function confColor(conf: number): string {
  return conf >= 0.8 ? 'var(--green)' : conf >= 0.5 ? 'var(--gold)' : 'var(--red)';
}
