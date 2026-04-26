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
import { findImplication } from "../engine/data/implications.js";
import type { AlgebraToken } from "../engine/core/types.js";

// ─── CST-token helpers ──────────────────────────────────────────────────
// Each training record ships CST sequences for question / each CoT step /
// answer so downstream tokenizers don't have to re-derive structure from
// English or Arabic prose. These slot into the shared vocab alongside
// cst-poc's existing L:/Q:/R:/C:/A:/S:/V:/N: families.

function questionCstTokens(token: AlgebraToken): string[] {
  const seq: string[] = ["[BOS]"];
  seq.push(`INT:${token.intent}`);
  seq.push(`PAT:${token.pattern}`);
  seq.push(`ROOT:${token.rootLatin}`);
  if (token.tense) seq.push(`TNS:${token.tense.tense}`);
  if (token.negation) seq.push("NEG");
  if (token.conditional) seq.push("COND");
  for (const m of token.modifiers ?? []) {
    seq.push(`MOD:${m}`);
  }
  seq.push("[EOS]");
  return seq;
}

function cotStepCstTokens(
  step:
    | { kind: "root"; value: string }
    | { kind: "pattern"; value: string }
    | { kind: "intent"; value: string }
    | { kind: "negation" }
    | { kind: "tense"; value: string }
    | { kind: "conditional" }
    | { kind: "modifiers"; values: string[] }
    | { kind: "resource"; value: string }
    | { kind: "action"; value: string }
    | { kind: "chain"; roots: string[] }
    | { kind: "constraint"; value: string },
): string[] {
  const out = ["[BOS]"];
  switch (step.kind) {
    case "root":
      out.push("STEP:root", `ROOT:${step.value}`);
      break;
    case "pattern":
      out.push("STEP:pattern", `PAT:${step.value}`);
      break;
    case "intent":
      out.push("STEP:intent", `INT:${step.value}`);
      break;
    case "negation":
      out.push("STEP:negation", "NEG");
      break;
    case "tense":
      out.push("STEP:tense", `TNS:${step.value}`);
      break;
    case "conditional":
      out.push("STEP:conditional", "COND");
      break;
    case "modifiers":
      out.push("STEP:modifiers", ...step.values.map((m) => `MOD:${m}`));
      break;
    case "resource":
      out.push("STEP:resource", `RES:${step.value}`);
      break;
    case "action":
      out.push("STEP:action", `ACT:${step.value}`);
      break;
    case "chain":
      out.push("STEP:chain", ...step.roots.map((r) => `ROOT:${r}`));
      break;
    case "constraint":
      out.push("STEP:constraint", `CNS:${step.value}`);
      break;
  }
  out.push("[EOS]");
  return out;
}

function answerCstTokens(action: string, resource: string): string[] {
  return ["[BOS]", `ACT:${action}`, `RES:${resource}`, "[EOS]"];
}

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
  meta: {
    cst_tokens: string[]; // legacy: whole-sentence token stream
    /** CST tokens for the question (parsed AlgebraToken structure). */
    question_cst: string[];
    /** CST tokens for each CoT step, aligned 1:1 with `cot`. */
    cot_cst: string[][];
    /** CST tokens for the answer. */
    answer_cst: string[];
  };
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

    // engine.reason() is deliberately rule-free (always returns "process"),
    // so for training-data labels we consult the IMPLICATION_RULES table —
    // which is exactly what implications.ts says it's for.
    const impl = findImplication(token);
    const action = impl?.result.action ?? reasoning.actionType;
    const resource = reasoning.resource;
    const chainRoots = impl?.result.chainRoots ?? null;
    const extraConstraints = impl?.result.addConstraints ?? null;

    // Build CST-token views in lock-step with the prose CoT.
    const questionCst = questionCstTokens(token);
    const cotCst: string[][] = [];
    cotCst.push(cotStepCstTokens({ kind: "root", value: token.rootLatin }));
    cotCst.push(cotStepCstTokens({ kind: "pattern", value: token.pattern }));
    cotCst.push(cotStepCstTokens({ kind: "intent", value: token.intent }));
    if (token.negation) cotCst.push(cotStepCstTokens({ kind: "negation" }));
    if (token.tense)
      cotCst.push(
        cotStepCstTokens({ kind: "tense", value: token.tense.tense }),
      );
    if (token.conditional)
      cotCst.push(cotStepCstTokens({ kind: "conditional" }));
    if (token.modifiers.length)
      cotCst.push(
        cotStepCstTokens({ kind: "modifiers", values: token.modifiers }),
      );
    cotCst.push(cotStepCstTokens({ kind: "resource", value: resource }));
    cotCst.push(cotStepCstTokens({ kind: "action", value: action }));
    if (chainRoots && chainRoots.length > 1)
      cotCst.push(cotStepCstTokens({ kind: "chain", roots: chainRoots }));
    if (extraConstraints)
      for (const c of extraConstraints)
        cotCst.push(cotStepCstTokens({ kind: "constraint", value: c }));
    const answerCst = answerCstTokens(action, resource);

    const enCot = buildCotEn(token, resource, action);
    if (chainRoots && chainRoots.length > 1) {
      enCot.push(`Chain roots: ${chainRoots.join(" → ")}.`);
    }
    if (extraConstraints) {
      for (const c of extraConstraints) enCot.push(`Constraint: ${c}.`);
    }
    const enRec: OutRecord = {
      id: `eng-${String(id).padStart(6, "0")}`,
      lang: "en",
      question: en,
      cot: enCot,
      answer: `action=${action}; resource=${resource}`,
      difficulty: level,
      meta: {
        cst_tokens: cst.tokens,
        question_cst: questionCst,
        cot_cst: cotCst,
        answer_cst: answerCst,
      },
    };
    out.push(enRec);

    // Arabic counterpart — synthesize a minimal AR surface from the
    // template. Lossy but stable for CoT purposes.
    const verbAr = rootData.arabic;
    const kwAr = rootData.arabic;
    const ar = tmpl.ar.replace("{verb_ar}", verbAr).replace("{kw_ar}", kwAr);
    const arCot = buildCotAr(token, resource, action);
    if (chainRoots && chainRoots.length > 1) {
      arCot.push(`سلسلة الجذور: ${chainRoots.join(" → ")}.`);
    }
    if (extraConstraints) {
      for (const c of extraConstraints) arCot.push(`قيد: ${c}.`);
    }
    const arRec: OutRecord = {
      id: `eng-${String(id).padStart(6, "0")}`,
      lang: "ar",
      question: ar,
      cot: arCot,
      answer: `الفعل=${action}؛ المورد=${resource}`,
      difficulty: level,
      meta: {
        cst_tokens: cst.tokens,
        question_cst: questionCst,
        cot_cst: cotCst,
        answer_cst: answerCst,
      },
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
