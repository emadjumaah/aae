/**
 * Engine Tests — Pure symbolic, no LLM, no network
 * Run with: npm test
 */

import { AlgebraEngine } from "../engine/core/engine.js";
import type { AlgebraToken } from "../engine/core/types.js";
import { compactToken } from "../engine/core/types.js";

const engine = new AlgebraEngine();

// ─── Test Runner ───────────────────────────────────────────────────────────

type TestCase = {
  description: string;
  token: AlgebraToken;
  expectedAction: string;
  expectedResource: string;
};

let passed = 0;
let failed = 0;

function test(tc: TestCase) {
  const result = engine.reason(tc.token);

  const actionOk = result.actionType === tc.expectedAction;
  const resourceOk = result.resource
    .toLowerCase()
    .includes(tc.expectedResource.toLowerCase());
  const ok = actionOk && resourceOk;

  const status = ok ? "✓" : "✗";
  console.log(`  ${status}  ${tc.description}`);

  if (!ok) {
    if (!actionOk)
      console.log(
        `       action   expected="${tc.expectedAction}" got="${result.actionType}"`,
      );
    if (!resourceOk)
      console.log(
        `       resource expected contains "${tc.expectedResource}" got="${result.resource}"`,
      );
    failed++;
  } else {
    passed++;
  }
}

// ─── Test Cases ────────────────────────────────────────────────────────────

console.log("\nArabic Algebra Engine — Symbolic Tests\n");

console.log("Scheduling");
test({
  description: "seek × place → schedule (meeting)",
  token: {
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "place",
    modifiers: ["time:tomorrow"],
  },
  expectedAction: "schedule",
  expectedResource: "meeting",
});
test({
  description: "seek × mutual → schedule (meeting)",
  token: {
    intent: "seek",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "mutual",
    modifiers: ["target:team"],
  },
  expectedAction: "schedule",
  expectedResource: "meeting",
});

console.log("\nCommunication");
test({
  description: "send × patient → send (message)",
  token: {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:manager"],
  },
  expectedAction: "send",
  expectedResource: "message",
});
test({
  description: "send × process → broadcast (message)",
  token: {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "process",
    modifiers: ["target:all"],
  },
  expectedAction: "broadcast",
  expectedResource: "message",
});

console.log("\nKnowledge");
test({
  description: "learn × causer → request_teach (knowledge)",
  token: {
    intent: "learn",
    root: "علم",
    rootLatin: "'l-m",
    pattern: "causer",
    modifiers: ["topic:algebra"],
  },
  expectedAction: "request_teach",
  expectedResource: "knowledge",
});
test({
  description: "learn × agent → study (knowledge)",
  token: {
    intent: "learn",
    root: "درس",
    rootLatin: "d-r-s",
    pattern: "agent",
    modifiers: [],
  },
  expectedAction: "study",
  expectedResource: "study",
});

console.log("\nRecording");
test({
  description: "record × patient → store (document)",
  token: {
    intent: "record",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "patient",
    modifiers: ["content:notes"],
  },
  expectedAction: "store",
  expectedResource: "document",
});
test({
  description: "record × instance → document",
  token: {
    intent: "record",
    root: "كتب",
    rootLatin: "k-t-b",
    pattern: "instance",
    modifiers: [],
  },
  expectedAction: "document",
  expectedResource: "document",
});

console.log("\nDecision");
test({
  description: "decide × instance → resolve (confirmation)",
  token: {
    intent: "decide",
    root: "قرر",
    rootLatin: "q-r-r",
    pattern: "instance",
    modifiers: ["urgency:high"],
  },
  expectedAction: "resolve",
  expectedResource: "confirmation",
});
test({
  description: "judge × agent → evaluate",
  token: {
    intent: "judge",
    root: "حكم",
    rootLatin: "h-k-m",
    pattern: "agent",
    modifiers: [],
  },
  expectedAction: "evaluate",
  expectedResource: "decision",
});

console.log("\nQuery");
test({
  description: "ask × seek → query (information)",
  token: {
    intent: "ask",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "seek",
    modifiers: ["topic:schedule"],
  },
  expectedAction: "query",
  expectedResource: "information",
});

console.log("\nAssembly");
test({
  description: "gather × mutual → assemble (meeting)",
  token: {
    intent: "gather",
    root: "جمع",
    rootLatin: "j-m-'",
    pattern: "mutual",
    modifiers: ["target:team"],
  },
  expectedAction: "assemble",
  expectedResource: "meeting",
});

// ─── Modifier extraction test ──────────────────────────────────────────────
console.log("\nModifier extraction");
const modToken: AlgebraToken = {
  intent: "seek",
  root: "جمع",
  rootLatin: "j-m-'",
  pattern: "place",
  modifiers: ["time:tomorrow", "target:engineering", "duration:1h"],
};
const modResult = engine.reason(modToken);
const constraintsOk = modResult.constraints.length === 3;
console.log(
  `  ${constraintsOk ? "✓" : "✗"}  3 modifiers → 3 constraints extracted`,
);
if (!constraintsOk) failed++;
else passed++;

// ─── Explain output test ───────────────────────────────────────────────────
console.log("\nExplain output");
const explanation = engine.explain(modToken);
const explainOk =
  explanation.includes("Algebra") && explanation.includes("Rule");
console.log(`  ${explainOk ? "✓" : "✗"}  explain() returns structured output`);
if (!explainOk) failed++;
else passed++;

// ─── Compact token test ────────────────────────────────────────────────────
const compactStr = compactToken(modToken);
const compactOk =
  compactStr.includes("جمع") &&
  compactStr.includes("place") &&
  compactStr.includes("time:tomorrow");
console.log(
  `  ${compactOk ? "✓" : "✗"}  compactToken() correct format: ${compactStr}`,
);
if (!compactOk) failed++;
else passed++;

// ─── Summary ───────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${"─".repeat(40)}`);
console.log(
  `${passed}/${total} tests passed${failed > 0 ? ` — ${failed} failed` : " ✓"}`,
);
console.log();

if (failed > 0) process.exit(1);
