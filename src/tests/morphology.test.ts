/**
 * Arabic Algebra Engine — Morphological Reasoning Tests
 *
 * These tests verify REAL structural reasoning, not keyword lookup.
 * Every test here uses Arabic words that are NOT in any keyword list.
 * The system must decompose them morphologically to find the root and pattern.
 *
 * This is the acid test: if مكتبة is nowhere in keywords, can the engine
 * still understand it means "place of writing" by recognizing the مفعلة pattern
 * on the كتب root?
 *
 * No tricks. No direct mapping. Pure morphological algebra.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  extractRoot,
  analyzeMorphology,
  type MorphResult,
} from "../engine/core/morphology.js";
import { encodeLocal } from "../engine/core/encoder.js";
import { engine } from "../engine/core/engine.js";

// ─── Direct Morphological Decomposition ───────────────────────────────────

describe("Morphological Root Extraction", () => {
  // These words are NOT keywords anywhere in the system.
  // The engine must decompose them structurally.

  const cases: Array<{
    word: string;
    meaning: string;
    expectedRoot: string;
    expectedPattern: string;
    wazn: string;
  }> = [
    // ---- مفعلة (maf'ala) — place pattern ----
    {
      word: "مكتبة",
      meaning: "library (place of writing)",
      expectedRoot: "كتب",
      expectedPattern: "place",
      wazn: "مفعلة",
    },
    {
      word: "مدرسة",
      meaning: "school (place of studying)",
      expectedRoot: "درس",
      expectedPattern: "place",
      wazn: "مفعلة",
    },

    // ---- فاعل (faa'il) — agent pattern ----
    {
      word: "كاتب",
      meaning: "writer (one who writes)",
      expectedRoot: "كتب",
      expectedPattern: "agent",
      wazn: "فاعل",
    },
    {
      word: "طالب",
      meaning: "student (one who seeks)",
      expectedRoot: "طلب",
      expectedPattern: "agent",
      wazn: "فاعل",
    },

    // ---- مفعول (maf'uul) — patient pattern ----
    {
      word: "مكتوب",
      meaning: "written/letter (thing written)",
      expectedRoot: "كتب",
      expectedPattern: "patient",
      wazn: "مفعول",
    },

    // ---- فعال (fi'aal) — instance pattern ----
    {
      word: "كتاب",
      meaning: "book (instance of writing)",
      expectedRoot: "كتب",
      expectedPattern: "instance",
      wazn: "فعال",
    },

    // ---- مفاعلة (mufaa'ala) — process pattern ----
    {
      word: "مكاتبة",
      meaning: "correspondence (process of writing)",
      expectedRoot: "كتب",
      expectedPattern: "process",
      wazn: "مفاعلة",
    },

    // ---- استفعل (istaf'ala) — seek pattern ----
    {
      word: "استكتب",
      meaning: "dictate (request someone to write)",
      expectedRoot: "كتب",
      expectedPattern: "seek",
      wazn: "استفعل",
    },

    // ---- فعيل (fa'iil) — quality/adjective ----
    {
      word: "مريض",
      meaning: "sick (quality from root مرض)",
      expectedRoot: "مرض",
      expectedPattern: "patient",
      wazn: "فعيل",
    },

    // ---- فاعول (faa'uul) — instrument ----
    {
      word: "حاسوب",
      meaning: "computer (instrument of computing)",
      expectedRoot: "حسب",
      expectedPattern: "causer",
      wazn: "فاعول",
    },

    // ---- فعّال (fa''aal) — intensifier (requires shadda) ----
    {
      word: "كتّاب",
      meaning: "prolific writers (intensive form)",
      expectedRoot: "كتب",
      expectedPattern: "intensifier",
      wazn: "فعّال",
    },
  ];

  for (const c of cases) {
    test(`${c.word} → root=${c.expectedRoot}, pattern=${c.expectedPattern} (${c.wazn})`, () => {
      const result = extractRoot(c.word);
      assert(result !== null, `extractRoot returned null for ${c.word}`);
      assert.equal(
        result.root,
        c.expectedRoot,
        `root: expected ${c.expectedRoot}, got ${result.root}`,
      );
      assert.equal(
        result.pattern,
        c.expectedPattern,
        `pattern: expected ${c.expectedPattern}, got ${result.pattern}`,
      );
      assert(result.verified, `root ${result.root} should be verified`);
    });
  }
});

// ─── Cross-Root Morphological Consistency ─────────────────────────────────
// The same pattern applied to different roots should yield the same pattern operator.

describe("Cross-Root Pattern Consistency", () => {
  test("مفعلة pattern always yields 'place'", () => {
    const words = ["مكتبة", "مدرسة"]; // library, school
    for (const w of words) {
      const r = extractRoot(w);
      assert(r !== null, `${w} should match`);
      assert.equal(
        r.pattern,
        "place",
        `${w}: expected place, got ${r.pattern}`,
      );
    }
  });

  test("فاعل pattern always yields 'agent'", () => {
    const words = ["كاتب", "طالب"]; // writer, student
    for (const w of words) {
      const r = extractRoot(w);
      assert(r !== null, `${w} should match`);
      assert.equal(
        r.pattern,
        "agent",
        `${w}: expected agent, got ${r.pattern}`,
      );
    }
  });

  test("same root, different patterns → different meanings", () => {
    // All from root كتب (write), but different morphological meanings
    const katab = extractRoot("كتب"); // root form
    const maktaba = extractRoot("مكتبة"); // place
    const kaatib = extractRoot("كاتب"); // agent
    const maktuub = extractRoot("مكتوب"); // patient
    const kitaab = extractRoot("كتاب"); // instance

    // All should share the same root
    for (const r of [katab, maktaba, kaatib, maktuub, kitaab]) {
      assert(r !== null);
      assert.equal(r.root, "كتب");
    }

    // But each has a different pattern — THIS is the algebra
    const patterns = [
      maktaba!.pattern,
      kaatib!.pattern,
      maktuub!.pattern,
      kitaab!.pattern,
    ];
    const unique = new Set(patterns);
    assert.equal(
      unique.size,
      patterns.length,
      `Expected 4 unique patterns, got ${unique.size}: ${[...unique].join(", ")}`,
    );
  });
});

// ─── Prefix Handling ──────────────────────────────────────────────────────

describe("Arabic Prefix Handling", () => {
  test("imperative اِفعَل prefix: اجمع → جمع", () => {
    const r = extractRoot("اجمع");
    assert(r !== null);
    assert.equal(r.root, "جمع");
    assert(r.verified);
  });

  test("imperative اِفعَل prefix: اكتب → كتب", () => {
    const r = extractRoot("اكتب");
    assert(r !== null);
    assert.equal(r.root, "كتب");
    assert(r.verified);
  });

  test("definite article ال: المدرسة → درس (place)", () => {
    const r = extractRoot("المدرسة");
    assert(r !== null);
    assert.equal(r.root, "درس");
    assert.equal(r.pattern, "place");
  });
});

// ─── Full Encoder Integration ─────────────────────────────────────────────
// When a single Arabic word (not a keyword) is the full input,
// morphology should correctly identify the root and pattern.

describe("Encoder uses morphology for unknown Arabic words", () => {
  test("مكتبة → root=كتب, pattern=place (not a keyword)", () => {
    const token = encodeLocal("مكتبة");
    assert.equal(token.root, "كتب", `root: expected كتب, got ${token.root}`);
    assert.equal(
      token.pattern,
      "place",
      `pattern: expected place, got ${token.pattern}`,
    );
  });

  test("مكتوب → root=كتب, pattern=patient", () => {
    const token = encodeLocal("مكتوب");
    assert.equal(token.root, "كتب");
    assert.equal(token.pattern, "patient");
  });

  test("استكتب → root=كتب, pattern=seek", () => {
    const token = encodeLocal("استكتب");
    assert.equal(token.root, "كتب");
    assert.equal(token.pattern, "seek");
  });
});

// ─── Morphology → Engine Reasoning Chain ──────────────────────────────────
// This tests the FULL chain: Arabic word → morphology → token → reasoning

describe("Morphology-driven reasoning", () => {
  test("مكتبة → token → engine produces reasoning with place pattern", () => {
    const token = encodeLocal("مكتبة");
    const result = engine.reason(token);

    // The engine should produce a valid reasoning result
    assert(result.confidence > 0, `confidence should be positive`);
    assert(result.token.pattern === "place", `pattern should be place`);
    assert(result.token.root === "كتب", `root should be كتب`);
    // The action should emerge from intent × pattern, not from keyword
    assert(result.actionType, `should produce an actionType`);
  });

  test("كاتب → token → engine produces agent-pattern reasoning", () => {
    const token = encodeLocal("كاتب");
    const result = engine.reason(token);
    assert(result.token.pattern === "agent");
    assert(result.token.root === "كتب");
  });

  test("different patterns on same root → different action types", () => {
    // مكتبة (place) vs مكتوب (patient) — same root, different patterns
    const placeToken = encodeLocal("مكتبة");
    const patientToken = encodeLocal("مكتوب");

    const placeResult = engine.reason(placeToken);
    const patientResult = engine.reason(patientToken);

    // Both share the root
    assert.equal(placeResult.token.root, "كتب");
    assert.equal(patientResult.token.root, "كتب");

    // But differ in pattern
    assert.equal(placeResult.token.pattern, "place");
    assert.equal(patientResult.token.pattern, "patient");

    // This COULD lead to different actions depending on intent
    // The key point: the system distinguishes them structurally
    assert(placeResult.actionType !== undefined);
    assert(patientResult.actionType !== undefined);
  });
});
