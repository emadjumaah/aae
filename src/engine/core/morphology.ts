/**
 * Arabic Algebra Engine — Morphological Analyzer
 *
 * This is the CORE of the Arabic algebra concept.
 *
 * Arabic words are built from a 3-consonant root (جذر) inserted into a pattern (وزن).
 * The root carries semantic meaning. The pattern carries grammatical/structural meaning.
 *
 * Example with root كتب (k-t-b = writing):
 *   مَكْتَبة  (maktaba)  = library    = مَفْعَلة pattern (place of action)
 *   كاتِب   (kaatib)   = writer     = فاعِل pattern (one who does)
 *   كِتاب   (kitaab)   = book       = فِعال pattern (instance/noun)
 *   مَكتوب  (maktuub)  = letter     = مَفعول pattern (thing acted upon)
 *   مُكاتَبة (mukaataba) = correspondence = مُفاعَلة pattern (process)
 *   اِسْتَكْتَب (istaktaba) = to dictate = اِستَفعَل pattern (to seek/request)
 *   تَكاتُب  (takaatub) = exchanging mail = تَفاعُل pattern (mutual/reciprocal)
 *   كَتّاب   (kattaab)  = prolific writer = فَعّال pattern (intensive)
 *
 * This module extracts the root and identifies the pattern from ANY derived form,
 * without needing every form to be in a keyword list.
 *
 * This is NOT a trick. This is how Arabic actually works structurally.
 * 1,400 years of morphological consistency makes this possible.
 */

import type { PatternOperator, ArabicRoot } from "./types.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── Known Roots Set ───────────────────────────────────────────────────────
// Built at startup from the root database. Used to validate extracted roots.

const KNOWN_ROOTS = new Set<string>(ALL_ROOT_DATA.map((r) => r.arabic));

// Also index by individual consonants for fuzzy matching
const ROOT_BY_CONSONANTS = new Map<string, string>();
for (const r of ALL_ROOT_DATA) {
  // Store by the 3 Arabic consonants (strip any non-letter chars)
  const consonants = r.arabic.replace(/[^\u0621-\u064A]/g, "");
  if (consonants.length >= 2) {
    ROOT_BY_CONSONANTS.set(consonants, r.arabic);
  }
}

// ─── Arabic Morphological Patterns (أوزان) ─────────────────────────────────
//
// Each pattern is defined by:
// - template: a regex where ف/ع/ل represent the 3 root consonants
//   We use capture groups to extract them.
// - operator: which PatternOperator this maps to
// - name: the Arabic pattern name
//
// The ف ع ل letters are the traditional placeholders for root consonants:
// ف = first radical, ع = second radical, ل = third radical
//
// We define patterns from most specific (long prefixes/suffixes) to least specific
// so that longer matches win.

export interface MorphPattern {
  /** Human-readable pattern name */
  name: string;
  /** Arabic وزن */
  wazn: string;
  /** Maps to which algebraic pattern operator */
  operator: PatternOperator;
  /**
   * Regex to match against Arabic input.
   * Groups 1, 2, 3 capture the three root consonants (ف ع ل).
   * Arabic consonant class: [\u0621-\u064A] (hamza through ya)
   */
  regex: RegExp;
}

// Arabic consonant character class (excluding vowel diacritics)
const C = "[\\u0621-\\u064A]"; // any Arabic letter

export const MORPH_PATTERNS: MorphPattern[] = [
  // ─── 10-letter+ patterns (most specific first) ────────────────────────

  // اِسْتِفْعال — verbal noun of استفعل (seeking/requesting)
  {
    name: "istif'aal",
    wazn: "استفعال",
    operator: "seek",
    regex: new RegExp(`^\\u0627\\u0633\\u062A(${C})(${C})\\u0627(${C})$`),
  },

  // ─── 7-letter patterns ────────────────────────────────────────────────

  // اِسْتَفْعَل — to seek/request the action (Form X verb)
  {
    name: "istaf'ala",
    wazn: "استفعل",
    operator: "seek",
    regex: new RegExp(`^\\u0627\\u0633\\u062A(${C})(${C})(${C})$`),
  },

  // ─── 6-letter patterns ────────────────────────────────────────────────

  // تَفاعُل — mutual/reciprocal action (verbal noun of Form VI)
  {
    name: "tafaa'ul",
    wazn: "تفاعل",
    operator: "mutual",
    regex: new RegExp(`^\\u062A(${C})\\u0627(${C})(${C})$`),
  },

  // مُفاعَلة — process/ongoing action (verbal noun of Form III)
  {
    name: "mufaa'ala",
    wazn: "مفاعلة",
    operator: "process",
    regex: new RegExp(`^\\u0645(${C})\\u0627(${C})(${C})\\u0629$`),
  },

  // تَفْعيل — intensive action/causation (verbal noun of Form II)
  {
    name: "taf'iil",
    wazn: "تفعيل",
    operator: "intensifier",
    regex: new RegExp(`^\\u062A(${C})(${C})\\u064A(${C})$`),
  },

  // ─── 5-letter patterns ────────────────────────────────────────────────

  // مَفْعَلة — place of action (مَكتَبة، مَدرَسة، مَطبَخة)
  {
    name: "maf'ala",
    wazn: "مفعلة",
    operator: "place",
    regex: new RegExp(`^\\u0645(${C})(${C})(${C})\\u0629$`),
  },

  // مَفْعول — passive participle (thing acted upon)
  {
    name: "maf'uul",
    wazn: "مفعول",
    operator: "patient",
    regex: new RegExp(`^\\u0645(${C})(${C})\\u0648(${C})$`),
  },

  // مِفْعال — instrument/tool pattern
  {
    name: "mif'aal",
    wazn: "مفعال",
    operator: "causer",
    regex: new RegExp(`^\\u0645(${C})(${C})\\u0627(${C})$`),
  },

  // مَفْعِل — place / time of action (variant without taa marbuuta)
  {
    name: "maf'il",
    wazn: "مفعل",
    operator: "place",
    regex: new RegExp(`^\\u0645(${C})(${C})(${C})$`),
  },

  // فاعول — instrument (حاسوب = computer, ناسوخ = fax)
  {
    name: "faa'uul",
    wazn: "فاعول",
    operator: "causer",
    regex: new RegExp(`^(${C})\\u0627(${C})\\u0648(${C})$`),
  },

  // فَعّال — intensive/professional (كتّاب، فنّان، نجّار)
  // Only matches when shadda IS present (meaning doubled consonant)
  {
    name: "fa''aal",
    wazn: "فعّال",
    operator: "intensifier",
    regex: new RegExp(`^(${C})(${C})\\u0651\\u0627(${C})$`),
  },

  // فِعالة — craft/profession (كتابة، تجارة — with taa marbuuta)
  {
    name: "fi'aala",
    wazn: "فعالة",
    operator: "instance",
    regex: new RegExp(`^(${C})(${C})\\u0627(${C})\\u0629$`),
  },

  // فُعول — plural pattern (دروس، كتوب)
  {
    name: "fu'uul",
    wazn: "فعول",
    operator: "plural",
    regex: new RegExp(`^(${C})(${C})\\u0648(${C})$`),
  },

  // ─── 4-letter patterns ────────────────────────────────────────────────

  // فاعِل — active participle (one who does)
  {
    name: "faa'il",
    wazn: "فاعل",
    operator: "agent",
    regex: new RegExp(`^(${C})\\u0627(${C})(${C})$`),
  },

  // فَعيل — adjective / quality pattern (مريض، كبير، جميل)
  {
    name: "fa'iil",
    wazn: "فعيل",
    operator: "patient",
    regex: new RegExp(`^(${C})(${C})\\u064A(${C})$`),
  },

  // فِعال — instance/abstract noun (كتاب، جهاد)
  {
    name: "fi'aal",
    wazn: "فعال",
    operator: "instance",
    regex: new RegExp(`^(${C})(${C})\\u0627(${C})$`),
  },

  // فُعَل — broken plural (صُوَر، غُرَف)
  {
    name: "fu'al",
    wazn: "فعل",
    operator: "plural",
    regex: new RegExp(`^(${C})(${C})(${C})$`),
    // This is the bare 3-letter form — lowest priority
  },
];

// ─── Root Extraction ───────────────────────────────────────────────────────

export interface MorphResult {
  /** Extracted Arabic root */
  root: ArabicRoot;
  /** Which pattern was matched */
  pattern: PatternOperator;
  /** The وزن name */
  wazn: string;
  /** Whether the root was found in the known roots database */
  verified: boolean;
  /** Confidence: 1.0 if verified, 0.6 if pattern matched but root unknown */
  confidence: number;
}

/**
 * Extract the triconsonantal root and morphological pattern from an Arabic word.
 *
 * This is the real Arabic algebra: structured decomposition, not keyword lookup.
 *
 * Strategy:
 * 1. Try each morphological pattern (longest first) against the input word.
 * 2. Extract the three consonants (ف ع ل) from the regex capture groups.
 * 3. Check if the extracted root exists in our known roots database.
 * 4. If it does → high confidence. If not → lower confidence (root might be real
 *    Arabic but not in our database yet).
 *
 * Returns null if no pattern matches (input might not be Arabic, or might be
 * a root form with no pattern overlay).
 */
export function extractRoot(word: string): MorphResult | null {
  // Clean: strip tashkeel (vowel marks), but KEEP shadda (\u0651)
  // Shadda marks consonant doubling — it's structurally meaningful for morphology
  let clean = word
    .replace(
      /[\u0610-\u061A\u064B-\u0650\u0652-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,
      "",
    )
    .trim();

  if (!clean) return null;

  // Strip definite article ال (al-) prefix
  if (clean.startsWith("\u0627\u0644") && clean.length > 4) {
    const withoutAl = clean.slice(2);
    // Try morphology on the word without ال first
    const result = extractRoot(withoutAl);
    if (result) return result;
  }

  // Handle common verb prefixes:
  // Imperative اِفْعَل: ا + 3-letter root (اجمع=gather!, اكتب=write!, ارسل=send!)
  if (clean.startsWith("\u0627") && clean.length === 4) {
    const candidateRoot = clean.slice(1);
    if (KNOWN_ROOTS.has(candidateRoot)) {
      return {
        root: candidateRoot,
        pattern: "instance", // imperative = direct action on the root
        wazn: "افعل",
        verified: true,
        confidence: 1.0,
      };
    }
  }

  // Try each pattern from most specific → least specific
  // Collect ALL matches, prefer verified roots over unverified
  let bestResult: MorphResult | null = null;

  for (const mp of MORPH_PATTERNS) {
    const match = clean.match(mp.regex);
    if (match && match[1] && match[2] && match[3]) {
      const extractedRoot = match[1] + match[2] + match[3];

      // Check if this root exists in our database
      let isVerified = KNOWN_ROOTS.has(extractedRoot);
      let bestRoot = extractedRoot;

      // Also check with common root variations (hamza forms, etc.)
      if (!isVerified) {
        const rootVariants = generateRootVariants(extractedRoot);
        for (const variant of rootVariants) {
          if (KNOWN_ROOTS.has(variant)) {
            bestRoot = variant;
            isVerified = true;
            break;
          }
        }
      }

      const result: MorphResult = {
        root: bestRoot,
        pattern: mp.operator,
        wazn: mp.wazn,
        verified: isVerified,
        confidence: isVerified ? 1.0 : 0.5,
      };

      // If verified, return immediately — this is a confident match
      if (isVerified) return result;

      // If not verified, keep as candidate but continue looking
      // A later pattern might extract a verified root
      if (!bestResult) bestResult = result;
    }
  }

  // Return best unverified result if we found any pattern match
  if (bestResult) return bestResult;

  // No pattern matched — try direct root lookup (word IS a bare root)
  if (KNOWN_ROOTS.has(clean)) {
    return {
      root: clean,
      pattern: "instance", // bare root form, default to instance
      wazn: "فعل",
      verified: true,
      confidence: 0.9, // slightly lower — no pattern info extracted
    };
  }

  return null;
}

/**
 * Generate common Arabic root variants to handle hamza/alef variations.
 * Arabic has multiple forms of alef/hamza that are often interchangeable:
 * أ إ آ ا — all can represent the same root consonant.
 */
function generateRootVariants(root: string): string[] {
  const variants: string[] = [];
  const alefForms = ["ا", "أ", "إ", "آ"];

  // Replace each character that could be an alef variant
  for (let i = 0; i < root.length; i++) {
    if (alefForms.includes(root[i])) {
      for (const form of alefForms) {
        if (form !== root[i]) {
          variants.push(root.slice(0, i) + form + root.slice(i + 1));
        }
      }
    }
  }

  // Also try with/without hamza prefix
  if (root.startsWith("ا") || root.startsWith("أ")) {
    variants.push(root.slice(1));
  }

  return variants;
}

/**
 * Analyze an Arabic input text for morphological structure.
 * Splits into words and analyzes each one.
 * Returns the best (highest confidence) result, or null.
 */
export function analyzeMorphology(input: string): MorphResult | null {
  // Split on whitespace and common Arabic punctuation
  const words = input.split(/[\s\u060C\u061B\u061F\u0021]+/).filter(Boolean);

  let best: MorphResult | null = null;

  for (const word of words) {
    const result = extractRoot(word);
    if (result) {
      if (!best || result.confidence > best.confidence) {
        best = result;
      }
      // If we found a verified root, no need to keep searching
      if (result.verified && result.confidence >= 1.0) break;
    }
  }

  return best;
}
