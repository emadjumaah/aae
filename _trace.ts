import { encodeLocal } from "./src/engine/core/encoder.ts";
import { compactToken } from "./src/engine/core/types.ts";
import {
  extractRoot,
  analyzeMorphology,
} from "./src/engine/core/morphology.ts";

console.log("=== MORPHOLOGICAL ANALYSIS (direct) ===\n");

const morphTests = [
  ["كتب", "bare root = write"],
  ["مكتبة", "library = مَفْعَلة on كتب (place of writing)"],
  ["كاتب", "writer = فاعِل on كتب (one who writes)"],
  ["كتاب", "book = فِعال on كتب (instance of writing)"],
  ["مكاتبة", "correspondence = مُفاعَلة on كتب (process)"],
  ["مكتوب", "written/letter = مَفعول on كتب (thing written)"],
  ["استكتب", "dictate = اِستَفعَل on كتب (request writing)"],
  ["مدرسة", "school = مَفْعَلة on درس (place of studying)"],
  ["طالب", "student = فاعِل on طلب (one who seeks)"],
  ["مريض", "patient/sick = فعيل on مرض (state)"],
  ["حاسوب", "computer = فاعول on حسب (instrument of computing)"],
  ["كتّاب", "prolific writers = فعّال on كتب (intensive)"],
];

for (const [word, meaning] of morphTests) {
  const result = extractRoot(word);
  if (result) {
    console.log(`${word} (${meaning})`);
    console.log(
      `  → root: ${result.root} | pattern: ${result.pattern} (${result.wazn}) | verified: ${result.verified} | conf: ${result.confidence}`,
    );
  } else {
    console.log(`${word} (${meaning})`);
    console.log(`  → NO MATCH`);
  }
}

console.log("\n=== FULL ENCODER (with morphology wired in) ===\n");
const t1 = encodeLocal("كتب");
console.log("كتب (bare root) →", compactToken(t1), "| root:", t1.root);

// What about the keyword 'write' that IS in the dictionary?
const t2 = encodeLocal("write");
console.log("write →", compactToken(t2), "| root:", t2.root);

// What about اكتب (imperative: write!)
const t3 = encodeLocal("اكتب");
console.log("اكتب (write!) →", compactToken(t3), "| root:", t3.root);

// What about كتابة (gerund: writing)
const t4 = encodeLocal("كتابة");
console.log("كتابة (writing) →", compactToken(t4), "| root:", t4.root);

// The derived forms that SHOULD decompose structurally:
const forms = [
  ["مكتبة", "library = م+كتب+ة = place of writing"],
  ["كاتب", "writer = فاعل pattern on كتب"],
  ["كتاب", "book = فعال pattern on كتب"],
  ["مكاتبة", "correspondence = مفاعلة pattern on كتب"],
  ["مكتوب", "written/letter = مفعول pattern on كتب"],
  ["استكتب", "dictate = استفعل pattern on كتب"],
];

console.log("\n--- Derived Forms ---");
for (const [form, meaning] of forms) {
  const t = encodeLocal(form);
  const match = t.root === "كتب" ? "YES" : "NO";
  console.log(`${form} (${meaning})`);
  console.log(
    `  → root: ${t.root} [match كتب: ${match}] | pattern: ${t.pattern} | intent: ${t.intent}`,
  );
}
