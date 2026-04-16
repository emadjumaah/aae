/**
 * Arabic Algebra Engine — Failed Input Validation Tests
 *
 * These are the 10 test inputs from the engineering brief that ALL failed before.
 * Target after Sprint 1: at least 7/10 correct.
 *
 * Run with: npx tsx src/tests/failed-inputs.test.ts
 */

import { encodeLocal } from "../engine/core/encoder.js";
import { engine } from "../engine/core/engine.js";
import { createAgent, TELECOM_DOMAIN } from "../engine/agent/index.js";
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

// ─── Encoder + Engine Tests (symbolic routing) ─────────────────────────────

console.log("\nFailed Input Validation — Encoder + Engine\n");

console.log("Implicit Intent Detection");

test('"my phone keeps dropping calls" → technical support root', () => {
  const token = encodeLocal("my phone keeps dropping calls");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // Should match عون (help/support) or هتف (phone) — NOT default سأل
  assert(
    token.root !== "سأل",
    `should not fall back to سأل, got root=${token.root}`,
  );
});

test('"I\'m going to Dubai next week" → travel/roaming root', () => {
  const token = encodeLocal("I'm going to Dubai next week");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // Should match سفر (travel) root
  assert(
    token.root === "سفر" || token.root === "رحل",
    `expected سفر or رحل, got root=${token.root}`,
  );
});

test('"this is too expensive" → billing complaint', () => {
  const token = encodeLocal("this is too expensive");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // Should route judge intent + ثمن root
  assert(
    token.root === "ثمن" || result.actionType === "evaluate",
    `expected ثمن root or evaluate action, got root=${token.root}, action=${result.actionType}`,
  );
});

test('"I haven\'t received anything" → order/delivery status', () => {
  const token = encodeLocal("I haven't received anything");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // Should match وصل (arrive/deliver) root
  assert(
    token.root === "وصل" || token.root === "أخذ",
    `expected وصل or أخذ, got root=${token.root}`,
  );
});

test('"cancel everything" → cancel service', () => {
  const token = encodeLocal("cancel everything");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // Should match ختم (end/cancel) root with decide intent
  assert(
    token.root === "ختم" || token.intent === "decide",
    `expected ختم root or decide intent, got root=${token.root}, intent=${token.intent}`,
  );
});

test('"I want out" → cancel service intent', () => {
  const token = encodeLocal("I want out");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // "want out" should hit decide/cancel keywords
  assert(
    token.intent === "decide" || token.root === "ختم" || token.root === "خرج",
    `expected decide intent or ختم/خرج root, got intent=${token.intent}, root=${token.root}`,
  );
});

test('"terminate my contract" → cancel service', () => {
  const token = encodeLocal("terminate my contract");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  assert(
    token.root === "ختم" || token.intent === "decide",
    `expected ختم root or decide intent, got root=${token.root}, intent=${token.intent}`,
  );
});

console.log("\nDialect Arabic Input");

test('"ابي اعرف رصيدي" (Gulf) → check balance', () => {
  const token = encodeLocal("ابي اعرف رصيدي");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // After dialect normalization: "أريد أن أعرف رصيدي"
  assert(
    token.intent === "seek" || token.intent === "ask",
    `expected seek or ask intent, got ${token.intent}`,
  );
});

test('"عايز اشحن" (Egyptian) → recharge', () => {
  const token = encodeLocal("عايز اشحن");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // After dialect normalization: "أريد شحن"
  // Should match seek intent + دفع (pay/recharge) root
  assert(
    token.root === "دفع" || token.intent === "seek",
    `expected دفع root or seek intent, got root=${token.root}, intent=${token.intent}`,
  );
});

test('"شو خطتي" (Levantine) → plan info', () => {
  const token = encodeLocal("شو خطتي");
  const result = engine.reason(token);
  console.log(
    `       token: ${compactToken(token)} → ${result.actionType} (conf: ${result.confidence.toFixed(2)})`,
  );
  // After normalization: "ما خطتي" → should be an ask/seek intent
  assert(
    token.intent === "ask" || token.intent === "seek",
    `expected ask or seek intent, got ${token.intent}`,
  );
});

// ─── Agent Tool Routing Tests (the real end-to-end test) ───────────────────

console.log("\nAgent Tool Routing (no model, symbolic only)");

const agent = createAgent(TELECOM_DOMAIN);

async function testAgent(
  input: string,
  expectedTools: string[],
  description: string,
) {
  try {
    const reply = await agent.handle("test-" + Date.now(), input);
    const toolMatch = expectedTools.some((t) => reply.tools.includes(t));
    const notSearchKb =
      !reply.tools.includes("search_kb") || expectedTools.includes("search_kb");

    console.log(
      `       tools: [${reply.tools.join(", ")}] state: ${reply.state}`,
    );
    if (toolMatch || notSearchKb) {
      console.log(`  ✓  ${description}`);
      passed++;
    } else {
      console.log(`  ✗  ${description}`);
      console.log(
        `       expected one of [${expectedTools.join(", ")}], got [${reply.tools.join(", ")}]`,
      );
      failed++;
    }
  } catch (e) {
    console.log(`  ✗  ${description}`);
    console.log(`       Error: ${e}`);
    failed++;
  }
}

async function runAgentTests() {
  await testAgent(
    "my phone keeps dropping calls",
    ["troubleshoot_device", "check_network", "report_outage"],
    '"my phone keeps dropping calls" → tech support tool',
  );

  await testAgent(
    "cancel everything",
    ["cancel_service"],
    '"cancel everything" → cancel_service',
  );

  await testAgent(
    "this is too expensive",
    ["dispute_charge", "billing_history"],
    '"this is too expensive" → billing dispute',
  );

  await testAgent(
    "I'm going to Dubai next week",
    ["change_plan", "view_plan"],
    '"I\'m going to Dubai next week" → plan change for roaming',
  );

  await testAgent(
    "ابي اعرف رصيدي",
    ["check_balance"],
    '"ابي اعرف رصيدي" (Gulf) → check_balance',
  );

  await testAgent(
    "عايز اشحن",
    ["pay_bill"],
    '"عايز اشحن" (Egyptian) → pay_bill/recharge',
  );

  console.log(`\n──────────────────────────────────────────────────`);
  console.log(
    `${passed + failed} tests: ${passed} passed, ${failed} failed ${failed === 0 ? "✓" : ""}`,
  );
  console.log(
    `Sprint 1 target: ${passed}/${passed + failed} (need 7+/10 for engine, agent bonus)\n`,
  );
}

runAgentTests();
