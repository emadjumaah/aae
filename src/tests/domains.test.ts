/**
 * Domain Coverage Tests
 *
 * Verifies that at least one root from each of the 15 semantic domains
 * is correctly detected by the encoder from natural English input.
 *
 * Run: npx tsx src/tests/domains.test.ts
 */

import { encodeLocal } from "../core/encoder.js";
import { engine } from "../core/engine.js";
import { decodeLocal } from "../core/decoder.js";
import { rootsByDomain, ALL_DOMAINS } from "../data/roots.js";
import assert from "node:assert";

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓  ${label}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗  ${label}`);
    console.log(`       ${msg}`);
  }
}

console.log("\nArabic Algebra Engine — Domain Coverage Tests\n");

// ── communication ──────────────────────────────────────────────────────
console.log("communication");
test("write → كتب", () => {
  const t = encodeLocal("Write a letter to the client");
  assert(t.root === "كتب", `expected كتب, got ${t.root}`);
});
test("send → رسل", () => {
  const t = encodeLocal("Send an email to the team");
  assert(t.root === "رسل", `expected رسل, got ${t.root}`);
});

// ── cognition ──────────────────────────────────────────────────────────
console.log("cognition");
test("think → فكر", () => {
  const t = encodeLocal("Think about the strategy carefully");
  assert(t.root === "فكر", `expected فكر, got ${t.root}`);
});
test("understand → فهم", () => {
  const t = encodeLocal("I need to comprehend and understand this concept");
  assert(t.root === "فهم", `expected فهم, got ${t.root}`);
});

// ── action ─────────────────────────────────────────────────────────────
console.log("action");
test("work → عمل", () => {
  const t = encodeLocal("Work on completing the task");
  assert(t.root === "عمل", `expected عمل, got ${t.root}`);
});
test("manufacture → صنع", () => {
  const t = encodeLocal("Manufacture components at the factory");
  assert(t.root === "صنع", `expected صنع, got ${t.root}`);
});

// ── time ───────────────────────────────────────────────────────────────
console.log("time");
test("schedule → وقت", () => {
  const t = encodeLocal("Schedule a timeslot for the appointment");
  assert(t.root === "وقت", `expected وقت, got ${t.root}`);
});
test("begin → بدء", () => {
  const t = encodeLocal("Begin and commence the kickoff");
  assert(t.root === "بدء", `expected بدء, got ${t.root}`);
});

// ── commerce ───────────────────────────────────────────────────────────
console.log("commerce");
test("sell → بيع", () => {
  const t = encodeLocal("Sell at retail through trading and auction");
  assert(t.root === "بيع", `expected بيع, got ${t.root}`);
});
test("buy → شري", () => {
  const t = encodeLocal("Buy office supplies for the team");
  assert(t.root === "شري", `expected شري, got ${t.root}`);
});

// ── social ─────────────────────────────────────────────────────────────
console.log("social");
test("meet → جمع", () => {
  const t = encodeLocal("Gather the team for an assembly meeting");
  assert(t.root === "جمع", `expected جمع, got ${t.root}`);
});
test("organize → نظم", () => {
  const t = encodeLocal("Organize and coordinate the system systematically");
  assert(t.root === "نظم", `expected نظم, got ${t.root}`);
});

// ── learning ───────────────────────────────────────────────────────────
console.log("learning");
test("study → درس", () => {
  const t = encodeLocal("Study the lesson and examine the course");
  assert(t.root === "درس", `expected درس, got ${t.root}`);
});
test("search → بحث", () => {
  const t = encodeLocal("Search and explore to investigate");
  assert(t.root === "بحث", `expected بحث, got ${t.root}`);
});

// ── spatial ────────────────────────────────────────────────────────────
console.log("spatial");
test("enter → دخل", () => {
  const t = encodeLocal("Enter and log in to access the system");
  assert(t.root === "دخل", `expected دخل, got ${t.root}`);
});
test("exit → خرج", () => {
  const t = encodeLocal("Exit and log out then leave");
  assert(t.root === "خرج", `expected خرج, got ${t.root}`);
});

// ── creation ───────────────────────────────────────────────────────────
console.log("creation");
test("create → خلق", () => {
  const t = encodeLocal("Create and invent an original creation");
  assert(t.root === "خلق", `expected خلق, got ${t.root}`);
});
test("draw → رسم", () => {
  const t = encodeLocal("Draw a diagram of the architecture");
  assert(t.root === "رسم", `expected رسم, got ${t.root}`);
});

// ── security ───────────────────────────────────────────────────────────
console.log("security");
test("protect → حمي", () => {
  const t = encodeLocal("Protect and defend the firewall");
  assert(t.root === "حمي", `expected حمي, got ${t.root}`);
});
test("secure → أمن", () => {
  const t = encodeLocal("Secure the network with encryption and safety");
  assert(t.root === "أمن", `expected أمن, got ${t.root}`);
});

// ── decision ───────────────────────────────────────────────────────────
console.log("decision");
test("decide → قرر", () => {
  const t = encodeLocal("Confirm the final decision");
  assert(t.root === "قرر", `expected قرر, got ${t.root}`);
});
test("choose → خير", () => {
  const t = encodeLocal("Choose the best option and select it");
  assert(t.root === "خير", `expected خير, got ${t.root}`);
});

// ── emotion ────────────────────────────────────────────────────────────
console.log("emotion");
test("love → حبب", () => {
  const t = encodeLocal("I love this favorite thing");
  assert(t.root === "حبب", `expected حبب, got ${t.root}`);
});
test("joy → فرح", () => {
  const t = encodeLocal("Celebrate with happiness and joy");
  assert(t.root === "فرح", `expected فرح, got ${t.root}`);
});

// ── information ────────────────────────────────────────────────────────
console.log("information");
test("analyze → حلل", () => {
  const t = encodeLocal("Analyze and decompose the solution");
  assert(t.root === "حلل", `expected حلل, got ${t.root}`);
});
test("display → عرض", () => {
  const t = encodeLocal("Display the presentation to the audience");
  assert(t.root === "عرض", `expected عرض, got ${t.root}`);
});

// ── seeking ────────────────────────────────────────────────────────────
console.log("seeking");
test("ask → سأل", () => {
  const t = encodeLocal("Ask a question and inquire about it");
  assert(t.root === "سأل", `expected سأل, got ${t.root}`);
});
test("find → وجد", () => {
  const t = encodeLocal("Find and discover where it exists");
  assert(t.root === "وجد", `expected وجد, got ${t.root}`);
});

// ── general ────────────────────────────────────────────────────────────
console.log("general");
test("say → قول", () => {
  const t = encodeLocal("Tell me your quote and state your opinion");
  assert(t.root === "قول", `expected قول, got ${t.root}`);
});
test("take → أخذ", () => {
  const t = encodeLocal("Take and grab the document");
  assert(t.root === "أخذ", `expected أخذ, got ${t.root}`);
});

// ── Pipeline round-trip per domain ─────────────────────────────────────
console.log("\nPipeline round-trip");
test("each domain has at least 1 root", () => {
  for (const domain of ALL_DOMAINS) {
    const roots = rootsByDomain(domain);
    assert(roots.length > 0, `domain "${domain}" has no roots`);
  }
});

test("decoder produces output for all 15 domains", () => {
  const inputs = [
    "Write a document",
    "Think about it",
    "Work on the task",
    "Schedule a time",
    "Sell the product",
    "Gather the group",
    "Study the lesson",
    "Enter the room",
    "Create the design",
    "Protect the system",
    "Confirm the decision",
    "Love the work",
    "Analyze the data",
    "Ask the question",
    "Say the words",
  ];
  for (const input of inputs) {
    const token = encodeLocal(input);
    const reasoning = engine.reason(token);
    const response = decodeLocal(reasoning);
    assert(response.length > 0, `empty response for "${input}"`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(
  `${passed + failed} tests: ${passed} passed, ${failed} failed ${failed === 0 ? "✓" : "✗"}\n`,
);
process.exit(failed > 0 ? 1 : 0);
