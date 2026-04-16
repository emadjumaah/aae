/**
 * Trace: Full algebraic decomposition of real Arabic sentences.
 * Shows all 8+ dimensions working together.
 */
import { encodeLocal } from "./src/engine/core/encoder.ts";
import { engine } from "./src/engine/core/engine.ts";
import { compactToken } from "./src/engine/core/types.ts";

const sentences = [
  // 1. Simple — bare root, no operators
  "اكتب التقرير", // Write the report

  // 2. Negation + past — "didn't write"
  "لم يكتب التقرير", // He didn't write the report

  // 3. Future + preposition — "will send to the manager"
  "سيرسل الرسالة إلى المدير", // Will send the message to the manager

  // 4. Negation + future — "will never send"
  "لن أرسل الملف", // I will never send the file

  // 5. Conditional — "if he writes the report"
  "إذا كتب التقرير", // If he writes the report

  // 6. Hypothetical — "if only I had sent it"
  "لو أرسلت الملف", // If only I had sent the file

  // 7. Pronoun — "I want my balance"
  "أريد رصيدي", // I want my balance

  // 8. Emphasis — "must send this urgent"
  "Send this report urgently please", // English with emphasis

  // 9. Complex Arabic: negation + preposition + pronoun
  "لم يرسل الرسالة إلى المدير", // He didn't send the message to the manager

  // 10. Conjunction — "write and send"
  "اكتب التقرير ثم أرسله", // Write the report then send it

  // 11. Morphology + grammar — derived form with preposition
  "المكتوب في الملف", // The written (thing) in the file

  // 12. Morphology — مدرسة (school = place of studying)
  "المدرسة في المدينة", // The school is in the city
];

console.log("═══════════════════════════════════════════════════════════════");
console.log("  ARABIC ALGEBRA — Full Compositional Decomposition Trace");
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

for (const s of sentences) {
  const token = encodeLocal(s);
  const result = engine.reason(token);

  console.log(`INPUT: ${s}`);
  console.log(`ALGEBRA: ${compactToken(token)}`);
  console.log(
    `ACTION: ${result.actionType} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
  );
  if (result.constraints.length > 0) {
    console.log(`CONSTRAINTS: ${result.constraints.join(" | ")}`);
  }
  console.log(`RESOLVED: ${result.resolvedIntent}`);
  console.log(
    "───────────────────────────────────────────────────────────────\n",
  );
}
