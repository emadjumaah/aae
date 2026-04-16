/**
 * Arabic Dialect Normalizer
 *
 * Converts Gulf (خليجي), Egyptian (مصري), and Levantine (شامي) dialect
 * forms into Modern Standard Arabic (MSA / فصحى) so the encoder's keyword
 * matching works on colloquial input.
 *
 * Called as the first step in encodeLocal(), before any root matching.
 */

// ─── Dialect → MSA word-level mappings ─────────────────────────────────────

const DIALECT_MAP: [RegExp, string][] = [
  // Gulf (خليجي)
  [/\bابي\b/g, "أريد"],
  [/\bابا\b/g, "أريد"],
  [/\bودي\b/g, "أريد"],
  [/\bاقدر\b/g, "أستطيع"],
  [/\bوش\b/g, "ما"],
  [/\bايش\b/g, "ما"],
  [/\bليش\b/g, "لماذا"],
  [/\bچذي\b/g, "هكذا"],
  [/\bجذي\b/g, "هكذا"],
  [/\bاخلص\b/g, "انتهى"],
  [/\bيبي\b/g, "يريد"],
  [/\bتبي\b/g, "تريد"],
  [/\bابيه\b/g, "أريده"],
  [/\bشلون\b/g, "كيف"],
  [/\bمنهو\b/g, "من هو"],
  [/\bوين\b/g, "أين"],
  [/\bحق\b/g, "الخاص بـ"],
  [/\bاعرف\b/g, "أعرف"],

  // Egyptian (مصري)
  [/\bعايز\b/g, "أريد"],
  [/\bعاوز\b/g, "أريد"],
  [/\bعايزة\b/g, "أريد"],
  [/\bعاوزة\b/g, "أريد"],
  [/\bايه\b/g, "ما"],
  [/\bبتاعي\b/g, "الخاص بي"],
  [/\bبتاعت\b/g, "الخاصة بـ"],
  [/\bبتاع\b/g, "الخاص بـ"],
  [/\bفين\b/g, "أين"],
  [/\bازاي\b/g, "كيف"],
  [/\bليه\b/g, "لماذا"],
  [/\bكده\b/g, "هكذا"],
  [/\bدلوقتي\b/g, "الآن"],
  [/\bمفيش\b/g, "لا يوجد"],

  // Levantine (شامي)
  [/\bبدي\b/g, "أريد"],
  [/\bبدك\b/g, "تريد"],
  [/\bشو\b/g, "ما"],
  [/\bهيك\b/g, "هكذا"],
  [/\bكيفك\b/g, "كيف حالك"],
  [/\bلازم\b/g, "يجب"],
  [/\bهلق\b/g, "الآن"],
  [/\bهلأ\b/g, "الآن"],
  [/\bمنيح\b/g, "جيد"],
  [/\bوين\b/g, "أين"],

  // Common across dialects
  [/\bخلاص\b/g, "انتهى"],
  [/\bيلا\b/g, "هيا"],
  [/\bطيب\b/g, "حسنا"],
];

// ─── Phrase-level dialect patterns ─────────────────────────────────────────
// These catch common multi-word dialectal phrases

const DIALECT_PHRASES: [RegExp, string][] = [
  // Gulf
  [/ابي اعرف/g, "أريد أن أعرف"],
  [/ابي اشحن/g, "أريد شحن"],
  [/ودي اعرف/g, "أريد أن أعرف"],

  // Egyptian
  [/عايز اشحن/g, "أريد شحن"],
  [/عايز اعرف/g, "أريد أن أعرف"],
  [/عاوز اشحن/g, "أريد شحن"],

  // Levantine
  [/بدي اعرف/g, "أريد أن أعرف"],
  [/شو خطتي/g, "ما خطتي"],
  [/شو رصيدي/g, "ما رصيدي"],
];

/**
 * Normalize Arabic dialect input to MSA.
 * Applies phrase-level patterns first (more specific), then word-level.
 */
export function normalizeDialect(input: string): string {
  let normalized = input;

  // Phase 1: Phrase-level (more specific, applied first)
  for (const [pattern, replacement] of DIALECT_PHRASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Phase 2: Word-level
  for (const [pattern, replacement] of DIALECT_MAP) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}
