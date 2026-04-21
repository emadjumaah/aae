/**
 * Arabic Algebra Engine — Reasoning CoT Generator
 *
 * Produces bilingual chain-of-thought training records for the CST
 * reasoning-model pipeline. Output schema matches
 * ``cst-poc/reasoning/data/sources/algebra_engine.py``::
 *
 *   {
 *     id: "algebra-eng-000042",
 *     lang: "ar" | "en",
 *     question: "...",
 *     cot: ["step 1", "step 2", ...],
 *     answer: "...",
 *     difficulty: "easy" | "medium" | "hard",
 *     meta: { cst_tokens: [...] }
 *   }
 *
 * The trace is a **decomposition-and-reasoning** CoT, not a math proof:
 *
 *   Q: "Send the report to the manager tomorrow"
 *   CoT:
 *     1. Root extraction    → ر.س.ل (rasala = send/dispatch)
 *     2. Pattern            → patient (the report is acted upon)
 *     3. Intent             → send
 *     4. Modifiers          → time=tomorrow, target=manager
 *     5. Resource            → message
 *     6. Action              → send
 *   A: action=send, resource=message, when=tomorrow, to=manager
 *
 * The same item is emitted in both EN and AR. Difficulty is controlled
 * by the number of grammatical dimensions present on the source
 * sentence (easy = 2 dims, medium = 3-4, hard = 5+).
 *
 * Run:
 *   npx tsx src/training/generate-reasoning-cot.ts --count 50000 \
 *       --out data/corpus/reasoning-cot.jsonl
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { encodeLocal } from "../engine/core/encoder.js";
import { engine } from "../engine/core/engine.js";
import { toCST } from "../engine/core/cst_bridge.js";
import { ALL_ROOT_DATA } from "../engine/data/roots.js";
import type { AlgebraToken } from "../engine/core/types.js";

// ─── CLI args ────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

const COUNT = parseInt(arg("count", "50000"), 10);
const OUT = arg("out", "data/corpus/reasoning-cot.jsonl");
const SEED = parseInt(arg("seed", "42"), 10);

// ─── Difficulty mix (locked default: 70 / 20 / 10) ──────────────────────

const DIFFICULTY_MIX: Array<[string, number]> = [
  ["easy", 0.7],
  ["medium", 0.2],
  ["hard", 0.1],
];

function pickDifficulty(rng: () => number): "easy" | "medium" | "hard" {
  const r = rng();
  let acc = 0;
  for (const [level, p] of DIFFICULTY_MIX) {
    acc += p;
    if (r < acc) return level as "easy" | "medium" | "hard";
  }
  return "easy";
}

// ─── Deterministic RNG ───────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── Sentence templates by difficulty ────────────────────────────────────

interface TemplatePair {
  en: string;
  ar: string;
}

const EASY_TEMPLATES: TemplatePair[] = [
  { en: "{verb} the {kw}", ar: "{verb_ar} الـ{kw_ar}" },
  { en: "Please {verb} {kw}", ar: "من فضلك {verb_ar} {kw_ar}" },
];

const MEDIUM_TEMPLATES: TemplatePair[] = [
  {
    en: "{verb} the {kw} tomorrow",
    ar: "{verb_ar} الـ{kw_ar} غدا",
  },
  {
    en: "Please {verb} the {kw} for the team",
    ar: "من فضلك {verb_ar} الـ{kw_ar} للفريق",
  },
];

const HARD_TEMPLATES: TemplatePair[] = [
  {
    en: "If possible, {verb} the {kw} to the manager tomorrow urgently",
    ar: "إن أمكن، {verb_ar} الـ{kw_ar} للمدير غدا بشكل عاجل",
  },
];

function templatesFor(level: "easy" | "medium" | "hard"): TemplatePair[] {
  if (level === "easy") return EASY_TEMPLATES;
  if (level === "medium") return MEDIUM_TEMPLATES;
  return HARD_TEMPLATES;
}

// ─── Verb selection per intent ───────────────────────────────────────────
// Uses the first keyword that's lowercase English from each root entry.

const ROOTS_EN_KEYWORDS = ALL_ROOT_DATA.filter((r) =>
  r.keywords.some((k) => /^[a-z]/.test(k)),
);

// ─── CoT builder ─────────────────────────────────────────────────────────

function buildCotEn(
  token: AlgebraToken,
  resource: string,
  action: string,
): string[] {
  const steps: string[] = [
    `Extract root: ${token.rootLatin} (${token.root}).`,
    `Identify pattern: ${token.pattern}.`,
    `Identify intent: ${token.intent}.`,
  ];
  if (token.negation) steps.push(`Detect negation: ${token.negation.tense}.`);
  if (token.tense) steps.push(`Detect tense: ${token.tense.tense}.`);
  if (token.conditional) steps.push(`Detect conditional.`);
  if (token.modifiers.length) {
    steps.push(`Collect modifiers: ${token.modifiers.join(", ")}.`);
  }
  steps.push(`Map root → resource: ${resource}.`);
  steps.push(`Map (intent × pattern × modifiers) → action: ${action}.`);
  return steps;
}

function buildCotAr(
  token: AlgebraToken,
  resource: string,
  action: string,
): string[] {
  const steps: string[] = [
    `استخرج الجذر: ${token.root}.`,
    `حدد الوزن: ${token.pattern}.`,
    `حدد القصد: ${token.intent}.`,
  ];
  if (token.negation) steps.push(`لاحظ النفي.`);
  if (token.tense) steps.push(`حدد الزمن: ${token.tense.tense}.`);
  if (token.conditional) steps.push(`لاحظ الشرط.`);
  if (token.modifiers.length) {
    steps.push(`اجمع المعدّلات: ${token.modifiers.join(", ")}.`);
  }
  steps.push(`اربط الجذر بالمورد: ${resource}.`);
  steps.push(`استنتج الفعل المطلوب: ${action}.`);
  return steps;
}

// ─── Main ────────────────────────────────────────────────────────────────

interface OutRecord {
  id: string;
  lang: "en" | "ar";
  question: string;
  cot: string[];
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  meta: { cst_tokens: string[] };
}

function generate(count: number, seed: number): OutRecord[] {
  const rng = seededRng(seed);
  const out: OutRecord[] = [];
  let id = 0;

  for (let i = 0; i < count; i++) {
    const rootData = ROOTS_EN_KEYWORDS[i % ROOTS_EN_KEYWORDS.length];
    const enKw = rootData.keywords.find((k) => /^[a-z]/.test(k)) ?? "";
    if (!enKw) continue;

    const level = pickDifficulty(rng);
    const tmpl =
      templatesFor(level)[Math.floor(rng() * templatesFor(level).length)];

    // Minimal EN surface — we only need enough signal for the encoder.
    const verbEn = ["do", "send", "find", "record"][Math.floor(rng() * 4)];
    const en = tmpl.en.replace("{verb}", verbEn).replace("{kw}", enKw);

    let token: AlgebraToken;
    try {
      token = encodeLocal(en);
    } catch {
      continue;
    }
    const reasoning = engine.reason(token);
    const cst = toCST(token, reasoning);

    const action = reasoning.actionType;
    const resource = reasoning.resource;

    const enRec: OutRecord = {
      id: `eng-${String(id).padStart(6, "0")}`,
      lang: "en",
      question: en,
      cot: buildCotEn(token, resource, action),
      answer: `action=${action}; resource=${resource}`,
      difficulty: level,
      meta: { cst_tokens: cst.tokens },
    };
    out.push(enRec);

    // Arabic counterpart — synthesize a minimal AR surface from the
    // template. Lossy but stable for CoT purposes.
    const verbAr = rootData.arabic;
    const kwAr = rootData.arabic;
    const ar = tmpl.ar.replace("{verb_ar}", verbAr).replace("{kw_ar}", kwAr);
    const arRec: OutRecord = {
      id: `eng-${String(id).padStart(6, "0")}`,
      lang: "ar",
      question: ar,
      cot: buildCotAr(token, resource, action),
      answer: `الفعل=${action}؛ المورد=${resource}`,
      difficulty: level,
      meta: { cst_tokens: cst.tokens },
    };
    out.push(arRec);

    id++;
  }
  return out;
}

function main(): void {
  const records = generate(COUNT, SEED);
  mkdirSync(dirname(OUT), { recursive: true });
  const body = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(OUT, body, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${records.length.toLocaleString()} CoT records → ${OUT}`);
}

main();
