/** Shared helpers used across all pages */

export function esc(s: unknown): string {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

/* ─── Theme ──────────────────────────────────────────────────────────────── */

function getTheme(): "light" | "dark" {
  const stored = localStorage.getItem("aae-theme");
  if (stored === "dark" || stored === "light") return stored;
  return "light"; // light default
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute(
    "data-theme",
    theme === "dark" ? "dark" : "",
  );
  if (theme !== "dark") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", "dark");
}

function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("aae-theme", next);
  if (next === "dark")
    document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  // Notify listeners (e.g. Chart.js re-color)
  window.dispatchEvent(new CustomEvent("theme-changed", { detail: next }));
}

export function isDark(): boolean {
  return getTheme() === "dark";
}

// Apply theme immediately (before DOMContentLoaded) to avoid flash
initTheme();

/** Animated Arabic letter background on a canvas */
export function initBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  let W: number, H: number;
  const letters = "ك ت ب ع ل م ح ك م ر س ل ج م ع ق ر ر س أ ل د ر س".split(" ");
  const cols: number[] = [];
  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    const n = Math.floor(W / 28);
    cols.length = 0;
    for (let i = 0; i < n; i++) cols.push(Math.random() * H);
  }
  function draw() {
    const style = getComputedStyle(document.documentElement);
    const fadeColor =
      style.getPropertyValue("--canvas-fade").trim() ||
      "rgba(246,245,240,0.06)";
    const letterColor =
      style.getPropertyValue("--canvas-letter").trim() ||
      "rgba(154,117,34,.07)";
    ctx.fillStyle = fadeColor;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = letterColor;
    ctx.font = '20px "Noto Sans Arabic",sans-serif';
    for (let i = 0; i < cols.length; i++) {
      const ch = letters[Math.floor(Math.random() * letters.length)];
      ctx.fillText(ch, i * 28, cols[i]);
      cols[i] += 22;
      if (cols[i] > H && Math.random() > 0.98) cols[i] = 0;
    }
    requestAnimationFrame(draw);
  }
  addEventListener("resize", resize);
  resize();
  draw();
}

/** Render top navigation bar and set active state */
export function renderNav(containerId: string, activePage: string) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pages = [
    { href: "index.html", label: "Home", id: "home" },
    { href: "playground.html", label: "Playground", id: "playground" },
    { href: "benchmark.html", label: "Benchmark", id: "benchmark" },
    { href: "usecases.html", label: "Use Cases", id: "usecases" },
  ];
  const dark = isDark();
  el.innerHTML = `
    <a href="index.html" class="logo">الجبر العربي</a>
    ${pages.map((p) => `<a href="${p.href}" class="${p.id === activePage ? "active" : ""}">${p.label}</a>`).join("")}
    <span class="spacer"></span>
    <button class="theme-toggle" id="theme-toggle" title="Toggle light/dark" aria-label="Toggle theme">${dark ? "☀️" : "🌙"}</button>
    <a href="https://github.com/emadjumaah/aae" class="gh-link" target="_blank">GitHub ↗</a>
  `;
  document.getElementById("theme-toggle")!.addEventListener("click", () => {
    toggleTheme();
    // Update button icon
    document.getElementById("theme-toggle")!.textContent = isDark()
      ? "☀️"
      : "🌙";
  });
}

export function confColor(conf: number): string {
  return conf >= 0.8
    ? "var(--green)"
    : conf >= 0.5
      ? "var(--gold)"
      : "var(--red)";
}
