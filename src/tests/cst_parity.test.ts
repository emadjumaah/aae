/**
 * CST Parity Tests — structural contract enforcement
 *
 * These tests pin down the wire format produced by the AAE → CST bridge.
 * They DO NOT compare against ``cst-poc/edge/arabic_tokenizer.py`` output
 * directly (that tokenizer consumes free prose; AAE consumes short
 * commands). Instead they enforce three invariants that are enough for
 * AAE's output to concatenate safely with cst-poc's tokenizer output
 * during joint training:
 *
 *   1. **Field namespace.** Every ``CMP:<field>:<role>`` and
 *      ``ROOT:<field>`` emitted uses a field from ``CST_FIELDS``.
 *   2. **LIT shape.** Every ``LIT:*`` token has the shape
 *      ``LIT:<kind>:<value>`` where ``<kind>`` ∈ known set and
 *      ``<value>`` is normalised (no raw spaces / punctuation).
 *   3. **REL / STR shape.** ``REL:*`` / ``STR:*`` carry a single
 *      snake_case tag (no free-form text).
 *
 * A fourth test asserts domain coverage: at least 95% of curated roots
 * in ``ALL_ROOT_DATA`` map to a real CST field (not ``"other"``), so
 * drift in the root database doesn't silently collapse field labels.
 *
 * Run with: ``tsx src/tests/cst_parity.test.ts``
 */

import { encodeLocal } from "../engine/core/encoder.js";
import {
  toCST,
  CST_FIELDS,
  cstFieldForResource,
} from "../engine/core/cst_bridge.js";
import { ALL_ROOT_DATA } from "../engine/data/roots.js";

const CST_FIELD_SET = new Set<string>(CST_FIELDS);
const LIT_KINDS = new Set([
  "time",
  "urgency",
  "topic",
  "content",
  "ref",
  "num",
]);
const REL_TAG = /^REL:[a-z_]+$/;
const STR_TAG = /^STR:[a-z_]+$/;
const CMP_SHAPE = /^CMP:([a-z_]+):([a-z_]+)$/;
const ROOT_SHAPE = /^ROOT:([a-z_]+)$/;
const LIT_SHAPE = /^LIT:([a-z_]+):([A-Za-z0-9_\u0600-\u06FF]+)$/;

let passed = 0;
let failed = 0;

function check(desc: string, ok: boolean, detail?: string) {
  const mark = ok ? "✓" : "✗";
  console.log(`  ${mark}  ${desc}`);
  if (!ok) {
    if (detail) console.log(`       ${detail}`);
    failed++;
  } else passed++;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────
//
// Short command / intent phrases covering: English imperative, English
// declarative, Arabic imperative, negation, time modifier, urgency
// modifier, target modifier, content modifier, topic modifier.

const FIXTURES: ReadonlyArray<{ input: string; expectField?: string }> = [
  { input: "Send the report to the manager tomorrow", expectField: "send" },
  { input: "Schedule a meeting with the team next week" },
  { input: "Cancel the subscription urgently" },
  { input: "Study the project requirements" },
  { input: "Assemble the device by end of day" },
  { input: "Write the documentation" },
  { input: "Call the customer about the invoice" },
  { input: "Do not forward this message" },
  { input: "Book a flight to Dubai next Friday" },
  { input: "أرسل التقرير إلى المدير غدًا" },
  { input: "اكتب الملاحظات" },
];

// ─── Test 1: Field namespace ──────────────────────────────────────────────

console.log("\nCST Parity: field namespace");
for (const f of FIXTURES) {
  const token = encodeLocal(f.input);
  const cst = toCST(token);

  // a) .field on the CSTSequence is in the controlled vocabulary
  check(
    `[field-vocab] "${f.input.slice(0, 40)}…"`,
    CST_FIELD_SET.has(cst.field),
    `got field="${cst.field}"`,
  );

  // b) optional: matches expected
  if (f.expectField) {
    check(
      `[field-expected] "${f.input.slice(0, 40)}…" → ${f.expectField}`,
      cst.field === f.expectField,
      `got "${cst.field}"`,
    );
  }

  // c) every CMP:/ROOT: token in the sequence uses the CST vocabulary
  for (const tok of cst.tokens) {
    const cmp = tok.match(CMP_SHAPE);
    if (cmp) {
      check(
        `[cmp-field-vocab] "${tok}"`,
        CST_FIELD_SET.has(cmp[1]),
        `field="${cmp[1]}" not in CST_FIELDS`,
      );
      continue;
    }
    const root = tok.match(ROOT_SHAPE);
    if (root) {
      check(
        `[root-field-vocab] "${tok}"`,
        CST_FIELD_SET.has(root[1]),
        `field="${root[1]}" not in CST_FIELDS`,
      );
    }
  }
}

// ─── Test 2: LIT shape ────────────────────────────────────────────────────

console.log("\nCST Parity: LIT shape");
for (const f of FIXTURES) {
  const cst = toCST(encodeLocal(f.input));
  for (const tok of cst.tokens) {
    if (!tok.startsWith("LIT:")) continue;
    const m = tok.match(LIT_SHAPE);
    check(`[lit-shape] "${tok}"`, !!m, `must match LIT:<kind>:<snake_value>`);
    if (m) {
      check(
        `[lit-kind] "${tok}"`,
        LIT_KINDS.has(m[1]),
        `kind "${m[1]}" not in {${[...LIT_KINDS].join(",")}}`,
      );
    }
  }
}

// ─── Test 3: REL / STR shape ──────────────────────────────────────────────

console.log("\nCST Parity: REL / STR shape");
for (const f of FIXTURES) {
  const cst = toCST(encodeLocal(f.input));
  for (const tok of cst.tokens) {
    if (tok.startsWith("REL:")) {
      check(
        `[rel-shape] "${tok}"`,
        REL_TAG.test(tok),
        "must match REL:<snake>",
      );
    } else if (tok.startsWith("STR:")) {
      check(
        `[str-shape] "${tok}"`,
        STR_TAG.test(tok),
        "must match STR:<snake>",
      );
    }
  }
}

// ─── Test 4: Sequence boundaries ──────────────────────────────────────────

console.log("\nCST Parity: sequence boundaries");
for (const f of FIXTURES) {
  const cst = toCST(encodeLocal(f.input));
  check(
    `[bos] "${f.input.slice(0, 40)}…"`,
    cst.tokens[0] === "[BOS]",
    `first="${cst.tokens[0]}"`,
  );
  check(
    `[eos] "${f.input.slice(0, 40)}…"`,
    cst.tokens[cst.tokens.length - 1] === "[EOS]",
    `last="${cst.tokens[cst.tokens.length - 1]}"`,
  );
  // Exactly one core token (CMP:/ROOT:) per AlgebraToken.
  const coreCount = cst.tokens.filter(
    (t) => t.startsWith("CMP:") || t.startsWith("ROOT:"),
  ).length;
  check(
    `[single-core] "${f.input.slice(0, 40)}…"`,
    coreCount === 1,
    `got ${coreCount} core tokens`,
  );
}

// ─── Test 5: Root database field coverage ─────────────────────────────────
//
// AAE ships 820 curated roots. If cst-poc training is to trust AAE's
// field labels, the share that falls back to "other" must stay small.
// This guards against silent drift when new roots are added.

console.log("\nCST Parity: root database coverage");
{
  let total = 0;
  let otherCount = 0;
  const distinctFields = new Set<string>();
  for (const r of ALL_ROOT_DATA) {
    total++;
    const f = cstFieldForResource(r.resource);
    if (f === "other") otherCount++;
    else distinctFields.add(f);
  }
  const otherPct = (100 * otherCount) / total;
  check(
    `[root-coverage] ≥95% of roots map to a real CST field`,
    otherPct < 5,
    `${otherCount}/${total} (${otherPct.toFixed(1)}%) fell back to "other"`,
  );
  check(
    `[field-spread] ≥40 distinct CST fields used by curated roots`,
    distinctFields.size >= 40,
    `only ${distinctFields.size} fields populated`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────

console.log("\n──────────────────────────────────────────────────");
console.log(`${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
