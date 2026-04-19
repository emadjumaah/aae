/**
 * Engine Tests — Tests the OBSERVATION layer, not fake reasoning
 *
 * The engine no longer maps intent×pattern → action.
 * It observes tokens and describes them. These tests verify:
 *   - Resource lookup works (root → domain)
 *   - Constraints are extracted from all dimensions
 *   - Confidence reflects parse quality
 *   - explain() produces structured output
 *   - compactToken() formats correctly
 *
 * Run with: npm test
 */

import { AlgebraEngine } from "../engine/core/engine.js";
import type { AlgebraToken } from "../engine/core/types.js";
import { compactToken } from "../engine/core/types.js";

const engine = new AlgebraEngine();

let passed = 0;
let failed = 0;

function assert(description: string, ok: boolean, details?: string) {
  const status = ok ? "✓" : "✗";
  console.log(`  ${status}  ${description}`);
  if (!ok) {
    if (details) console.log(`       ${details}`);
    failed++;
  } else {
    passed++;
  }
}

// ─── Resource Lookup ───────────────────────────────────────────────────────

console.log("\nArabic Algebra Engine — Honest Observation Tests\n");

console.log("Resource lookup (root → domain)");
{
  const r = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: [],
  });
  assert(
    "رسل → message resource",
    r.resource.toLowerCase().includes("message"),
  );
}
{
  const r = engine.reason({
    intent: "learn",
    root: "علم",
    rootLatin: "'l-m",
    pattern: "agent",
    modifiers: [],
  });
  assert(
    "علم → knowledge resource",
    r.resource.toLowerCase().includes("knowledge"),
  );
}
{
  const r = engine.reason({
    intent: "record",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "patient",
    modifiers: [],
  });
  assert(
    "كتب → document resource",
    r.resource.toLowerCase().includes("document"),
  );
}
{
  const r = engine.reason({
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: [],
  });
  assert(
    "جمع → meeting resource",
    r.resource.toLowerCase().includes("meeting"),
  );
}
{
  const r = engine.reason({
    intent: "do",
    root: "zzz",
    rootLatin: "z-z-z",
    pattern: "agent",
    modifiers: [],
  });
  assert("unknown root → general resource", r.resource === "general resource");
}

// ─── Action is always "process" (model decides, not us) ────────────────────

console.log("\nAction passthrough (no hardcoded rules)");
{
  const r1 = engine.reason({
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: [],
  });
  const r2 = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: [],
  });
  const r3 = engine.reason({
    intent: "decide",
    root: "قرر",
    rootLatin: "q-r-r",
    pattern: "instance",
    modifiers: [],
  });
  assert("seek × place → process (not schedule)", r1.actionType === "process");
  assert("send × patient → process (not send)", r2.actionType === "process");
  assert(
    "decide × instance → process (not resolve)",
    r3.actionType === "process",
  );
}

// ─── Constraint Extraction ─────────────────────────────────────────────────

console.log("\nConstraint extraction");
{
  const token: AlgebraToken = {
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: ["time:tomorrow", "target:engineering", "duration:1h"],
  };
  const r = engine.reason(token);
  assert("3 modifiers → 3 constraints", r.constraints.length === 3);
  assert(
    "constraint includes time→tomorrow",
    r.constraints.some((c) => c.includes("time") && c.includes("tomorrow")),
  );
}
{
  const token: AlgebraToken = {
    intent: "do",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "agent",
    modifiers: [],
    verbForm: "II",
    tense: { tense: "past", signal: "كَتَّبَ" },
    negation: { particle: "لم", tense: "past" },
  };
  const r = engine.reason(token);
  assert(
    "verb form → form constraint",
    r.constraints.some((c) => c.includes("INTENSIFY")),
  );
  assert(
    "tense → tense constraint",
    r.constraints.some((c) => c.includes("past")),
  );
  assert(
    "negation → polarity constraint",
    r.constraints.some((c) => c.includes("NOT")),
  );
}
{
  const token: AlgebraToken = {
    intent: "seek",
    root: "سفر",
    rootLatin: "s-f-r",
    pattern: "patient",
    modifiers: [],
    prepositions: [{ particle: "إلى", prep: "to", object: "القاهرة" }],
    pronouns: [{ surface: "أنا", person: "1s", role: "subject" }],
  };
  const r = engine.reason(token);
  assert(
    "preposition → relation constraint",
    r.constraints.some((c) => c.includes("to") && c.includes("القاهرة")),
  );
  assert(
    "pronoun → entity constraint",
    r.constraints.some((c) => c.includes("subject") && c.includes("1s")),
  );
}
{
  const token: AlgebraToken = {
    intent: "do",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "agent",
    modifiers: [],
    conditional: { particle: "لو", type: "hypothetical" },
    emphasis: { particle: "إنّ", level: "strong" },
  };
  const r = engine.reason(token);
  assert(
    "conditional → condition constraint",
    r.constraints.some((c) => c.includes("hypothetical")),
  );
  assert(
    "emphasis → emphasis constraint",
    r.constraints.some((c) => c.includes("strong")),
  );
}

// ─── Confidence ────────────────────────────────────────────────────────────

console.log("\nConfidence (parse quality, not reasoning quality)");
{
  const fallback = engine.reason({
    intent: "ask",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "seek",
    modifiers: [],
  });
  assert("fallback root → low confidence (≤0.3)", fallback.confidence <= 0.3);
}
{
  const known = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:all"],
  });
  assert(
    "known root + modifiers → higher confidence (≥0.5)",
    known.confidence >= 0.5,
  );
}
{
  const rich = engine.reason({
    intent: "do",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "agent",
    modifiers: ["topic:report"],
    verbForm: "II",
    tense: { tense: "past", signal: "كَتَّبَ" },
    negation: { particle: "لم", tense: "past" },
    prepositions: [{ particle: "في", prep: "in", object: "المكتب" }],
    pronouns: [{ surface: "هو", person: "3ms", role: "subject" }],
  });
  assert("rich token → highest confidence (≥0.7)", rich.confidence >= 0.7);
}

// ─── Explain output ────────────────────────────────────────────────────────

console.log("\nExplain output");
{
  const token: AlgebraToken = {
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: ["time:tomorrow"],
  };
  const explanation = engine.explain(token);
  assert("explain() includes Algebra line", explanation.includes("Algebra"));
  assert(
    "explain() includes Dimensions line",
    explanation.includes("Dimensions"),
  );
  assert("explain() includes Resource", explanation.includes("Resource"));
  assert("explain() includes Parse Conf.", explanation.includes("Parse Conf."));
}

// ─── Compact token ─────────────────────────────────────────────────────────

console.log("\nCompact token");
{
  const token: AlgebraToken = {
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: ["time:tomorrow"],
  };
  const compact = compactToken(token);
  assert("compactToken includes root", compact.includes("جمع"));
  assert("compactToken includes pattern", compact.includes("place"));
  assert("compactToken includes modifier", compact.includes("time:tomorrow"));
}

// ─── Resolved intent description ───────────────────────────────────────────

console.log("\nResolved intent description");
{
  const token: AlgebraToken = {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: [],
    negation: { particle: "لم", tense: "past" },
  };
  const r = engine.reason(token);
  assert("negation wraps with NOT()", r.resolvedIntent.includes("NOT(past)"));
}
{
  const token: AlgebraToken = {
    intent: "do",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "agent",
    modifiers: [],
    conditional: { particle: "لو", type: "hypothetical" },
  };
  const r = engine.reason(token);
  assert(
    "conditional wraps with IF()",
    r.resolvedIntent.includes("IF(hypothetical)"),
  );
}

// ─── Summary ───────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${"─".repeat(40)}`);
console.log(
  `${passed}/${total} tests passed${failed > 0 ? ` — ${failed} failed` : " ✓"}`,
);
console.log();

if (failed > 0) process.exit(1);
