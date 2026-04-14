import "./styles.css";
import { initBackground, renderNav } from "./shared";

renderNav("nav", "home");
initBackground(document.getElementById("bg-canvas") as HTMLCanvasElement);

// Hero stats — honest framing, self-authored benchmark
const stats = [
  { v: "152", l: "Arabic Roots", s: "15 semantic domains", c: "var(--gold)" },
  { v: "80", l: "Symbolic Rules", s: "hand-curated", c: "var(--cyan)" },
  {
    v: "~8µs",
    l: "Avg Latency",
    s: "deterministic, offline",
    c: "var(--green)",
  },
  {
    v: "$0.00",
    l: "Inference Cost",
    s: "no API, no GPU",
    c: "var(--magenta)",
  },
  { v: "0", l: "Parameters", s: "pure symbolic lookup", c: "var(--gold)" },
  {
    v: "72",
    l: "Tests Passing",
    s: "self-authored test set",
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
