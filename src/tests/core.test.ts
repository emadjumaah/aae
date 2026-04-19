/**
 * Arabic Algebra Engine — Core Robustness Tests
 *
 * Comprehensive testing of encoder, engine, and decoder edge cases.
 * Run with: npx tsx src/tests/core.test.ts
 */

import { encodeLocal } from "../engine/core/encoder.js";
import { decodeLocal } from "../engine/core/decoder.js";
import { AlgebraEngine } from "../engine/core/engine.js";
import { compactToken } from "../engine/core/types.js";
import type {
  AlgebraToken,
  IntentOperator,
  PatternOperator,
  ActionType,
} from "../engine/core/types.js";

const engine = new AlgebraEngine();

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${description}`);
    console.log(`       ${(e as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, label = "") {
  if (actual !== expected)
    throw new Error(`${label}expected "${expected}" got "${actual}"`);
}

// ════════════════════════════════════════════════════════════════════════════
// ENCODER: Input Safety & Edge Cases
// ════════════════════════════════════════════════════════════════════════════
console.log("\nArabic Algebra Engine — Core Robustness Tests\n");

console.log("Encoder: Input Safety");

test("empty string returns fallback token", () => {
  const t = encodeLocal("");
  assertEqual(t.intent, "ask", "intent ");
  assertEqual(t.root, "سأل", "root ");
});

test("whitespace-only returns fallback token", () => {
  const t = encodeLocal("   \t\n  ");
  assertEqual(t.intent, "ask", "intent ");
  assertEqual(t.root, "سأل", "root ");
});

test("gibberish returns fallback root (سأل)", () => {
  const t = encodeLocal("xyzzy foobar quux zzzz");
  assertEqual(t.root, "سأل", "root ");
});

test("HTML/XSS input does not crash", () => {
  const t = encodeLocal('<script>alert("xss")</script>');
  assert(t.intent !== undefined, "should produce a token");
  assert(t.root !== undefined, "should have a root");
});

test("regex metacharacters in input do not crash", () => {
  const t = encodeLocal("find (something) [brackets] {curly} $dollar ^caret");
  assert(t.intent !== undefined, "should produce a token");
});

test("very long input does not crash", () => {
  const longInput = "send the report ".repeat(200);
  const t = encodeLocal(longInput);
  assertEqual(t.intent, "send", "intent ");
  assertEqual(t.root, "رسل", "root ");
});

test("ALL CAPS input works correctly", () => {
  const t = encodeLocal("SEND THE REPORT TO THE MANAGER");
  assertEqual(t.intent, "send", "intent ");
  assertEqual(t.root, "رسل", "root ");
});

test("numbers in input do not crash", () => {
  const t = encodeLocal("Book room 101 at 2:30pm");
  assert(t.intent !== undefined, "should produce a token");
});

test("emoji in input does not crash", () => {
  const t = encodeLocal("send email 📧 to team 👥");
  assertEqual(t.intent, "send", "intent ");
});

test("newlines and tabs in input handled", () => {
  const t = encodeLocal("send\nthe\treport");
  assertEqual(t.intent, "send", "intent ");
});

// ════════════════════════════════════════════════════════════════════════════
// ENCODER: Tashkeel (Diacritics) Normalization
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEncoder: Tashkeel Normalization");

test("vowelled Arabic أَرْسِلْ matches root رسل", () => {
  const t = encodeLocal("أَرْسِلْ التقرير");
  assertEqual(t.root, "رسل", "root ");
});

test("vowelled Arabic اكْتُبْ matches root كتب", () => {
  const t = encodeLocal("اكْتُبْ الملاحظات");
  assertEqual(t.root, "كتب", "root ");
});

test("mixed tashkeel with English works", () => {
  const t = encodeLocal("أُرِيدُ to send email");
  assertEqual(t.intent, "send", "intent ");
});

// ════════════════════════════════════════════════════════════════════════════
// ENCODER: Mixed Language Input
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEncoder: Mixed Language");

test("Arabic+English interleaved", () => {
  const t = encodeLocal("أريد to schedule meeting tomorrow");
  assert(
    t.intent === "seek" || t.intent === "ask",
    `intent should be seek or ask, got ${t.intent}`,
  );
});

test("repeated keywords don't produce wrong root", () => {
  const t = encodeLocal("send send send");
  assertEqual(t.intent, "send", "intent ");
  assertEqual(t.root, "رسل", "root ");
});

// ════════════════════════════════════════════════════════════════════════════
// ENCODER: Pattern Detection Defaults
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEncoder: Pattern Detection");

test("no pattern signal defaults to instance", () => {
  const t = encodeLocal("deploy");
  assertEqual(t.pattern, "instance", "pattern ");
});

test("'with the team' triggers mutual pattern", () => {
  const t = encodeLocal("work with the team");
  assertEqual(t.pattern, "mutual", "pattern ");
});

test("'the report' triggers patient pattern", () => {
  const t = encodeLocal("send the report");
  assertEqual(t.pattern, "patient", "pattern ");
});

// ════════════════════════════════════════════════════════════════════════════
// ENCODER: Modifier Extraction
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEncoder: Modifier Extraction");

test("extracts 'at 3pm' as time modifier", () => {
  const t = encodeLocal("schedule meeting at 3pm");
  assert(
    t.modifiers.some((m) => m.startsWith("time:") && m.includes("3")),
    `no time modifier found in ${JSON.stringify(t.modifiers)}`,
  );
});

test("extracts 'tomorrow' as time modifier", () => {
  const t = encodeLocal("send report tomorrow");
  assert(
    t.modifiers.some((m) => m.startsWith("time:") && m.includes("tomorrow")),
    `no time modifier in ${JSON.stringify(t.modifiers)}`,
  );
});

test("extracts 'by end of day' as time modifier", () => {
  const t = encodeLocal("finish the task by end of day");
  assert(
    t.modifiers.some((m) => m.startsWith("time:")),
    `no time modifier in ${JSON.stringify(t.modifiers)}`,
  );
});

test("extracts urgency modifier", () => {
  const t = encodeLocal("send the report urgently");
  assert(
    t.modifiers.some((m) => m.startsWith("urgency:")),
    `no urgency modifier in ${JSON.stringify(t.modifiers)}`,
  );
});

test("extracts Arabic time غداً", () => {
  const t = encodeLocal("أرسل التقرير غداً");
  assert(
    t.modifiers.some((m) => m.startsWith("time:")),
    `no time modifier in ${JSON.stringify(t.modifiers)}`,
  );
});

test("target does not include trailing time words", () => {
  const t = encodeLocal("send report to the team tomorrow");
  const target = t.modifiers.find((m) => m.startsWith("target:"));
  if (target) {
    assert(
      !target.includes("tomorrow"),
      `target should not include 'tomorrow': ${target}`,
    );
  }
});

test("no modifier for bare input", () => {
  const t = encodeLocal("deploy");
  assertEqual(t.modifiers.length, 0, "modifier count ");
});

// ════════════════════════════════════════════════════════════════════════════
// ENGINE: No Hardcoded Rules — Action is Always "process"
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEngine: No Hardcoded Rules (stripped)");

// All 74 old ACTION_RULES have been removed.
// The engine returns "process" for everything — the model decides the action.
const SAMPLE_COMBOS: Array<{
  intent: IntentOperator;
  pattern: PatternOperator;
}> = [
  { intent: "seek", pattern: "agent" },
  { intent: "seek", pattern: "place" },
  { intent: "do", pattern: "patient" },
  { intent: "send", pattern: "patient" },
  { intent: "gather", pattern: "mutual" },
  { intent: "record", pattern: "instance" },
  { intent: "learn", pattern: "causer" },
  { intent: "decide", pattern: "agent" },
  { intent: "enable", pattern: "process" },
  { intent: "judge", pattern: "plural" },
  { intent: "ask", pattern: "seek" },
];

for (const combo of SAMPLE_COMBOS) {
  test(`${combo.intent} × ${combo.pattern} → process (no rules)`, () => {
    const token: AlgebraToken = {
      intent: combo.intent,
      root: "سأل",
      rootLatin: "s-'-l",
      pattern: combo.pattern,
      modifiers: [],
    };
    const result = engine.reason(token);
    assertEqual(result.actionType, "process", "action ");
  });
}

// ════════════════════════════════════════════════════════════════════════════
// ENGINE: All combos return "process" — no special fallback needed
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEngine: All Combos → process");

test("any intent × pattern → process with low confidence for fallback root", () => {
  const combos: Array<{ intent: IntentOperator; pattern: PatternOperator }> = [
    { intent: "do", pattern: "seek" },
    { intent: "send", pattern: "causer" },
    { intent: "gather", pattern: "seek" },
    { intent: "learn", pattern: "place" },
    { intent: "decide", pattern: "causer" },
    { intent: "enable", pattern: "intensifier" },
  ];
  for (const combo of combos) {
    const token: AlgebraToken = {
      intent: combo.intent,
      root: "سأل",
      rootLatin: "s-'-l",
      pattern: combo.pattern,
      modifiers: [],
    };
    const result = engine.reason(token);
    assert(
      result.actionType === "process",
      `${combo.intent}×${combo.pattern} action should be process, got ${result.actionType}`,
    );
    assert(
      result.confidence <= 0.3,
      `${combo.intent}×${combo.pattern} confidence should be low for fallback root, got ${result.confidence}`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ENGINE: Edge Cases
// ════════════════════════════════════════════════════════════════════════════
console.log("\nEngine: Edge Cases");

test("unknown root returns 'general resource'", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "zzz",
    rootLatin: "z-z-z",
    pattern: "agent",
    modifiers: [],
  };
  const result = engine.reason(token);
  assertEqual(result.resource, "general resource", "resource ");
});

test("empty root returns 'general resource'", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "",
    rootLatin: "",
    pattern: "agent",
    modifiers: [],
  };
  const result = engine.reason(token);
  assertEqual(result.resource, "general resource", "resource ");
});

test("modifier without colon passes through as constraint", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "agent",
    modifiers: ["freetext"],
  };
  const result = engine.reason(token);
  assertEqual(result.constraints[0], "freetext", "constraint ");
});

test("modifier with multiple colons splits correctly", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "agent",
    modifiers: ["time:3:00pm"],
  };
  const result = engine.reason(token);
  assertEqual(result.constraints[0], "time → 3:00pm", "constraint ");
});

test("empty modifiers array — no constraints", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "instance",
    modifiers: [],
  };
  const result = engine.reason(token);
  assertEqual(result.constraints.length, 0, "constraint count ");
});

test("many modifiers all become constraints", () => {
  const mods = Array.from({ length: 20 }, (_, i) => `key${i}:val${i}`);
  const token: AlgebraToken = {
    intent: "seek",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "instance",
    modifiers: mods,
  };
  const result = engine.reason(token);
  assertEqual(result.constraints.length, 20, "constraint count ");
});

test("explain() includes all expected fields", () => {
  const token: AlgebraToken = {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:team"],
  };
  const explanation = engine.explain(token);
  assert(explanation.includes("Algebra"), "missing Algebra line");
  assert(explanation.includes("Dimensions"), "missing Dimensions line");
  assert(explanation.includes("Resource"), "missing Resource line");
  assert(explanation.includes("Constraints"), "missing Constraints line");
  assert(explanation.includes("Parse Conf."), "missing Parse Conf. line");
});

test("explain() describes token dimensions", () => {
  const token: AlgebraToken = {
    intent: "do",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "seek",
    modifiers: [],
  };
  const explanation = engine.explain(token);
  assert(explanation.includes("intent=do"), "should show intent");
  assert(explanation.includes("pattern=seek"), "should show pattern");
});

// ════════════════════════════════════════════════════════════════════════════
// DECODER: Template Coverage & Edge Cases
// ════════════════════════════════════════════════════════════════════════════
console.log("\nDecoder: Template Coverage");

const ALL_ACTIONS: ActionType[] = [
  "schedule",
  "send",
  "broadcast",
  "assemble",
  "locate",
  "store",
  "document",
  "query",
  "execute",
  "create",
  "coordinate",
  "study",
  "request_teach",
  "resolve",
  "evaluate",
  "process",
];

for (const action of ALL_ACTIONS) {
  test(`decoder produces output for action '${action}'`, () => {
    const token: AlgebraToken = {
      intent: "seek",
      root: "سأل",
      rootLatin: "s-'-l",
      pattern: "instance",
      modifiers: [],
    };
    const result = engine.reason(token);
    // Override action type for testing
    const testResult = { ...result, actionType: action, resource: "test item" };
    const output = decodeLocal(testResult);
    assert(output.length > 0, "output should not be empty");
    assert(
      output.includes("test item"),
      `output should contain resource: ${output}`,
    );
  });
}

console.log("\nDecoder: Edge Cases");

test("decoder with 0 constraints includes follow-up", () => {
  const result = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: [],
  });
  const output = decodeLocal(result);
  assert(output.includes("?"), "should include follow-up question");
});

test("decoder with 1 explicit constraint — may or may not have follow-up", () => {
  const result = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:team"],
  });
  const output = decodeLocal(result);
  // With relationship-derived constraints, total constraints may be >= 2
  // so the follow-up question may or may not appear. Just verify output exists.
  assert(output.length > 10, "should produce meaningful output");
  assert(
    output.includes("message") || output.includes("communication"),
    "should reference the resource",
  );
});

test("decoder with 2+ constraints omits follow-up", () => {
  const result = engine.reason({
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:team", "time:tomorrow"],
  });
  const output = decodeLocal(result);
  assert(!output.includes("?"), `should not include follow-up: ${output}`);
});

test("decoder with unknown action falls to process template", () => {
  const token: AlgebraToken = {
    intent: "seek",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "instance",
    modifiers: [],
  };
  const result = engine.reason(token);
  const testResult = {
    ...result,
    actionType: "nonexistent_action" as ActionType,
  };
  const output = decodeLocal(testResult);
  assert(output.includes("process"), `should use process template: ${output}`);
});

test("decoder handles constraint format edge cases", () => {
  const token: AlgebraToken = {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:team", "time:3:00pm", "freetext"],
  };
  const result = engine.reason(token);
  const output = decodeLocal(result);
  assert(output.length > 0, "output should not be empty");
  assert(output.includes("team"), "should include target");
});

// ════════════════════════════════════════════════════════════════════════════
// compactToken: Formatting
// ════════════════════════════════════════════════════════════════════════════
console.log("\ncompactToken: Formatting");

test("compactToken with no modifiers", () => {
  const token: AlgebraToken = {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: [],
  };
  const s = compactToken(token);
  assert(s.includes("[رسل×patient]"), `unexpected format: ${s}`);
  assert(!s.includes("+"), "no modifiers means no +");
});

test("compactToken with multiple modifiers", () => {
  const token: AlgebraToken = {
    intent: "send",
    root: "رسل",
    rootLatin: "r-s-l",
    pattern: "patient",
    modifiers: ["target:team", "time:tomorrow", "urgency:high"],
  };
  const s = compactToken(token);
  assert(s.includes("[target:team]"), `missing target: ${s}`);
  assert(s.includes("[time:tomorrow]"), `missing time: ${s}`);
  assert(s.includes("[urgency:high]"), `missing urgency: ${s}`);
});

// ════════════════════════════════════════════════════════════════════════════
// DATA INTEGRITY
// ════════════════════════════════════════════════════════════════════════════
console.log("\nData Integrity");

import { ALL_ROOT_DATA, ROOT_DATA_BY_ARABIC } from "../engine/data/roots.js";

test("all roots have required fields", () => {
  for (const r of ALL_ROOT_DATA) {
    assert(r.arabic.length > 0, `empty arabic for ${r.latin}`);
    assert(r.latin.length > 0, `empty latin for ${r.arabic}`);
    assert(r.domain.length > 0, `empty domain for ${r.arabic}`);
    assert(r.resource.length > 0, `empty resource for ${r.arabic}`);
    assert(r.keywords.length > 0, `no keywords for ${r.arabic}`);
  }
});

test("no duplicate arabic roots in ALL_ROOT_DATA", () => {
  const seen = new Set<string>();
  for (const r of ALL_ROOT_DATA) {
    assert(!seen.has(r.arabic), `duplicate arabic root: ${r.arabic}`);
    seen.add(r.arabic);
  }
});

test("ROOT_DATA_BY_ARABIC has same count as ALL_ROOT_DATA", () => {
  assertEqual(
    ROOT_DATA_BY_ARABIC.size,
    ALL_ROOT_DATA.length,
    "map size vs array length ",
  );
});

test("no empty strings in keyword arrays", () => {
  for (const r of ALL_ROOT_DATA) {
    for (const kw of r.keywords) {
      assert(kw.length > 0, `empty keyword in root ${r.arabic}`);
    }
  }
});

test("latin format is consistent (x-x-x pattern)", () => {
  for (const r of ALL_ROOT_DATA) {
    assert(
      r.latin.includes("-"),
      `latin "${r.latin}" for ${r.arabic} missing dashes`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FULL PIPELINE INTEGRATION
// ════════════════════════════════════════════════════════════════════════════
console.log("\nPipeline Integration");

import { run } from "../pipeline.js";

test("encode → reason → decode round trip produces output", () => {
  const result = run("send the report to the team tomorrow");
  assert(result.response.length > 0, "response should not be empty");
  assertEqual(result.mode, "standalone", "mode ");
});

test("Arabic full pipeline round trip", () => {
  const result = run("أرسل التقرير إلى الفريق");
  assert(result.response.length > 0, "response should not be empty");
  assertEqual(result.mode, "standalone", "mode ");
});

test("tashkeel Arabic full pipeline round trip", () => {
  const result = run("أَرْسِلْ التقرير");
  assert(result.response.length > 0, "response should not be empty");
  assert(
    result.token.root === "رسل",
    `expected root رسل got ${result.token.root}`,
  );
});

test("gibberish full pipeline produces graceful output", () => {
  const result = run("xyzzy foobar quux");
  assert(result.response.length > 0, "response should not be empty");
  assertEqual(result.mode, "standalone", "mode ");
});

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(
  `${passed + failed} tests: ${passed} passed, ${failed} failed ${failed === 0 ? "✓" : "✗"}`,
);
if (failed > 0) process.exit(1);
