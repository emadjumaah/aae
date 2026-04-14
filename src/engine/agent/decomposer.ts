/**
 * Arabic Algebra — Sentence Decomposer
 *
 * Splits compound user requests into individual intent units.
 * Rule-based: no LLM needed.
 *
 * "Check my balance and pay it, also change my plan"
 *   → ["Check my balance", "pay it", "change my plan"]
 *
 * "أريد أن أدفع فاتورتي وأغير خطتي"
 *   → ["أريد أن أدفع فاتورتي", "أغير خطتي"]
 */

// ─── Split Patterns ────────────────────────────────────────────────────────

/** English conjunctions / delimiters that split compound requests */
const EN_SPLITTERS = [
  /\band\s+(?:also|then|please)\b/gi,
  /\b(?:also|then|plus|additionally)\s*,?\s*/gi,
  /\balso\b/gi,
  /;\s*/g,
  /\.\s+(?=[A-Z])/g, // sentence boundary (period + capital)
];

/** Arabic conjunctions that split compound requests */
const AR_SPLITTERS = [
  /\s+و(?:أيضاً?|كمان|بعدين)\s+/g, // و + also/then
  /\s*[،؛]\s*/g, // Arabic comma, semicolon
];

/**
 * Coordinating "and" that joins two verb phrases.
 * Only split on "and" when it's between two clauses (has verb indicators on both sides).
 */
const EN_VERB_AND = /([^,]+?)\s+and\s+([^,]+)/gi;

/** Arabic waw conjunction between two verb phrases */
const AR_VERB_WAW = /([^،]+?)\s+و\s*([^،]+)/g;

// ─── Intent Indicators ─────────────────────────────────────────────────────

/** Words that signal a new intent/action (English) */
const EN_INTENT_VERBS = new Set([
  "check",
  "show",
  "get",
  "find",
  "look", // query
  "pay",
  "make",
  "process", // execute
  "change",
  "update",
  "switch",
  "upgrade", // modify
  "cancel",
  "close",
  "remove",
  "delete", // cancel
  "send",
  "text",
  "email",
  "forward", // send
  "reset",
  "restart",
  "fix",
  "repair", // technical
  "report",
  "file",
  "open",
  "submit", // report
  "activate",
  "enable",
  "turn", // enable
  "transfer",
  "connect", // transfer
  "tell",
  "explain",
  "help", // info
  "add",
  "set",
  "configure", // configure
  "run",
  "test",
  "diagnose", // diagnostic
  "summarize",
  "format",
  "shorten",
  "compress", // format
  "display",
  "pull",
  "verify",
  "read", // profile
]);

/** Arabic intent verb prefixes (أريد، أحتاج، etc.) */
const AR_INTENT_PREFIXES = [
  "أريد",
  "أحتاج",
  "أرجو",
  "ممكن",
  "عايز",
  "ادفع",
  "غير",
  "فعّل",
  "ألغ",
  "أرسل",
  "افحص",
  "اعرض",
  "حدث",
  "أضف",
];

// ─── Core Decomposer ──────────────────────────────────────────────────────

export interface DecomposedUnit {
  /** The extracted text fragment */
  text: string;
  /** Position in original input (0-based) */
  index: number;
  /** Whether this unit references a previous one ("pay it" → refers to balance) */
  isReference: boolean;
}

/**
 * Decompose a compound request into individual intent units.
 * Returns 1+ units. Single intents pass through unchanged.
 */
export function decompose(input: string): DecomposedUnit[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const isArabic = /[\u0600-\u06FF]/.test(trimmed);

  // Try structured splits first (semicolons, explicit conjunctions)
  let parts = splitStructured(trimmed, isArabic);

  // If no structured splits, try verb-phrase conjunction splitting
  if (parts.length === 1) {
    parts = splitVerbConjunction(trimmed, isArabic);
  }

  // Clean and validate each part
  return parts
    .map((text, index) => ({
      text: cleanFragment(text),
      index,
      isReference: detectReference(text),
    }))
    .filter((u) => u.text.length > 0);
}

// ─── Splitting strategies ──────────────────────────────────────────────────

/** Split on explicit delimiters: semicolons, "also", "then", etc. */
function splitStructured(text: string, isArabic: boolean): string[] {
  const splitters = isArabic ? AR_SPLITTERS : EN_SPLITTERS;

  for (const pattern of splitters) {
    // Reset regex state
    pattern.lastIndex = 0;
    const parts = text
      .split(pattern)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return [text];
}

/**
 * Split "verb1 ... and verb2 ..." patterns.
 * Only splits when both sides contain intent verbs.
 */
function splitVerbConjunction(text: string, isArabic: boolean): string[] {
  const pattern = isArabic ? AR_VERB_WAW : EN_VERB_AND;
  pattern.lastIndex = 0;

  const match = pattern.exec(text);
  if (!match) return [text];

  const left = match[1].trim();
  const right = match[2].trim();

  // Both must contain intent verbs
  if (hasIntentVerb(left, isArabic) && hasIntentVerb(right, isArabic)) {
    return [left, right];
  }

  return [text];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function hasIntentVerb(text: string, isArabic: boolean): boolean {
  if (isArabic) {
    return AR_INTENT_PREFIXES.some((p) => text.includes(p));
  }
  const words = text.toLowerCase().split(/\s+/);
  return words.some((w) => EN_INTENT_VERBS.has(w));
}

/** Reference words that point to a previous result ("it", "that", "this") */
const REFERENCE_WORDS = /\b(it|that|this|those|them|the result|the above)\b/i;
const AR_REFERENCE = /(ه[ذا]|ذلك|تلك|النتيجة)/;

function detectReference(text: string): boolean {
  return REFERENCE_WORDS.test(text) || AR_REFERENCE.test(text);
}

/** Clean up a fragment: trim, remove leading conjunctions */
function cleanFragment(text: string): string {
  return text
    .replace(/^(and|then|also|plus|but|or)\s+/i, "")
    .replace(/^(و|ثم|أيضاً?|كمان)\s+/, "")
    .replace(/^[,،;؛.\s]+/, "")
    .replace(/[,،;؛.\s]+$/, "")
    .trim();
}
