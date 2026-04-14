/**
 * Encoder + Decoder + Full Pipeline Tests — Pure standalone, no LLM
 * Run with: npx tsx src/tests/standalone.test.ts
 */

import { encodeLocal } from "../engine/core/encoder.js";
import { decodeLocal } from "../engine/core/decoder.js";
import { engine } from "../engine/core/engine.js";
import { run } from "../pipeline.js";
import { compactToken } from "../engine/core/types.js";

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${description}`);
    console.log(`       ${e}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ─── Encoder Tests ─────────────────────────────────────────────────────────

console.log("\nArabic Algebra Engine — Standalone Tests\n");

console.log("Encoder: Root Detection");
test('detects meeting/gathering root for "schedule a meeting"', () => {
  const token = encodeLocal("Schedule a meeting with the team tomorrow");
  assert(
    token.root === "جمع" || token.root === "وقت",
    `expected جمع or وقت, got ${token.root}`,
  );
});

test('detects sending root for "send the report"', () => {
  const token = encodeLocal("Send the report to the manager");
  assert(token.root === "رسل", `expected رسل, got ${token.root}`);
});

test('detects knowledge root for "learn about machine learning"', () => {
  const token = encodeLocal("I want to learn about machine learning");
  assert(token.root === "علم", `expected علم, got ${token.root}`);
});

test('detects writing root for "write down the notes"', () => {
  const token = encodeLocal("Write down the meeting notes");
  assert(token.root === "كتب", `expected كتب, got ${token.root}`);
});

test('detects work root for "run the task"', () => {
  const token = encodeLocal("Run the build task and execute the tests");
  assert(token.root === "عمل", `expected عمل, got ${token.root}`);
});

test("detects questioning root for Arabic question", () => {
  const token = encodeLocal("ما هو موعد تسليم المشروع؟");
  assert(token.intent === "ask", `expected ask intent, got ${token.intent}`);
});

console.log("\nEncoder: Intent Detection");
test('detects seek intent for "need to find"', () => {
  const token = encodeLocal("I need to find a meeting room");
  assert(token.intent === "seek", `expected seek, got ${token.intent}`);
});

test('detects send intent for "send email"', () => {
  const token = encodeLocal("Send an email to the team");
  assert(token.intent === "send", `expected send, got ${token.intent}`);
});

test("detects ask intent for question words", () => {
  const token = encodeLocal("What is the project deadline?");
  assert(token.intent === "ask", `expected ask, got ${token.intent}`);
});

test('detects record intent for "write down"', () => {
  const token = encodeLocal("Write down the meeting notes");
  assert(token.intent === "record", `expected record, got ${token.intent}`);
});

test('detects decide intent for "decide on"', () => {
  const token = encodeLocal("We need to decide on the budget");
  assert(token.intent === "decide", `expected decide, got ${token.intent}`);
});

test('detects learn intent for "analyze"', () => {
  const token = encodeLocal("Analyze the quarterly report");
  assert(token.intent === "learn", `expected learn, got ${token.intent}`);
});

console.log("\nEncoder: Arabic Input");
test("encodes Arabic send command", () => {
  const token = encodeLocal("أرسل التقرير إلى المدير");
  assert(token.root === "رسل", `expected رسل, got ${token.root}`);
  assert(token.intent === "send", `expected send intent, got ${token.intent}`);
});

test("encodes Arabic gather command", () => {
  const token = encodeLocal("اجمع فريق الهندسة");
  assert(token.root === "جمع", `expected جمع, got ${token.root}`);
});

console.log("\nEncoder: Modifier Extraction");
test('extracts time modifier for "tomorrow"', () => {
  const token = encodeLocal("Schedule a meeting tomorrow");
  const hasTime = token.modifiers.some((m) => m.startsWith("time:"));
  assert(hasTime, `expected time modifier, got ${token.modifiers}`);
});

test('extracts target modifier for "with the team"', () => {
  const token = encodeLocal("Schedule a meeting with the team");
  const hasTarget = token.modifiers.some((m) => m.startsWith("target:"));
  assert(hasTarget, `expected target modifier, got ${token.modifiers}`);
});

test('extracts topic modifier for "about machine learning"', () => {
  const token = encodeLocal("Learn about machine learning");
  const hasTopic = token.modifiers.some((m) => m.startsWith("topic:"));
  assert(hasTopic, `expected topic modifier, got ${token.modifiers}`);
});

// ─── Decoder Tests ─────────────────────────────────────────────────────────

console.log("\nDecoder: Template Responses");
test("produces response for schedule action", () => {
  const token = encodeLocal("Schedule a meeting tomorrow");
  const reasoning = engine.reason(token);
  const response = decodeLocal(reasoning);
  assert(response.length > 10, `response too short: ${response}`);
  const lower = response.toLowerCase();
  assert(
    lower.includes("schedule") ||
      lower.includes("find") ||
      lower.includes("assemble") ||
      lower.includes("meeting"),
    `expected action words in response: ${response}`,
  );
});

test("produces response for send action", () => {
  const token = encodeLocal("Send the report to the manager");
  const reasoning = engine.reason(token);
  const response = decodeLocal(reasoning);
  assert(response.length > 10, `response too short: ${response}`);
});

test("produces response for query action", () => {
  const token = encodeLocal("What is the deadline?");
  const reasoning = engine.reason(token);
  const response = decodeLocal(reasoning);
  assert(response.length > 10, `response too short: ${response}`);
});

// ─── Full Pipeline Tests ───────────────────────────────────────────────────

console.log("\nFull Pipeline (standalone)");
test("pipeline runs synchronously with no network", () => {
  const start = Date.now();
  const result = run("Schedule a meeting with the team tomorrow");
  const elapsed = Date.now() - start;
  assert(
    result.mode === "standalone",
    `expected standalone mode, got ${result.mode}`,
  );
  assert(
    elapsed < 50,
    `too slow: ${elapsed}ms — should be <50ms for pure symbolic`,
  );
  assert(result.response.length > 0, "empty response");
  assert(result.algebraCompact.length > 0, "empty compact token");
  assert(result.explanation.length > 0, "empty explanation");
});

test("pipeline handles English input end-to-end", () => {
  const result = run("Send the quarterly report to the CEO");
  assert(
    result.reasoning.actionType === "send" ||
      result.reasoning.actionType === "broadcast",
    `expected send/broadcast, got ${result.reasoning.actionType}`,
  );
});

test("pipeline handles Arabic input end-to-end", () => {
  const result = run("أرسل التقرير إلى المدير");
  assert(
    result.token.root === "رسل",
    `expected رسل root, got ${result.token.root}`,
  );
  assert(
    result.mode === "standalone",
    `expected standalone, got ${result.mode}`,
  );
});

test("pipeline returns fast for simple input", () => {
  // Warm up (first call may include lazy init overhead)
  run("test");
  const result = run("deploy");
  assert(result.durationMs <= 50, `too slow: ${result.durationMs}ms`);
});

test("pipeline handles empty-ish input gracefully", () => {
  const result = run("   ");
  assert(
    result.token.intent === "ask",
    `expected fallback ask intent, got ${result.token.intent}`,
  );
});

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(
  `${passed + failed} tests: ${passed} passed, ${failed} failed ${failed === 0 ? "✓" : "✗"}`,
);
if (failed > 0) process.exit(1);
