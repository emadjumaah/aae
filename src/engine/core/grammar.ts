/**
 * Arabic Algebra Engine — Grammatical Operators (حروف ومعاني)
 *
 * Arabic grammar is essentially a set of well-defined FUNCTIONS:
 *
 * 1. VERB FORMS (أبواب الفعل) — 10 forms, each a transformation on root meaning
 *    Form II  فَعَّلَ  = INTENSIFY(root) or CAUSE(root)
 *    Form III فاعَلَ  = WITH(root) — mutual/shared action
 *    Form V   تَفَعَّلَ = BECOME(INTENSIFY(root)) — reflexive of II
 *    Form VI  تَفاعَلَ = BECOME(WITH(root)) — reflexive of III
 *    Form VII اِنْفَعَلَ = RESULT(root) — passive/resultative
 *    Form VIII اِفْتَعَلَ = SELF(root) — reflexive
 *    Form X   اِسْتَفْعَلَ = REQUEST(root) — to seek the action
 *
 * 2. PREPOSITIONS (حروف الجر) — relational operators
 *    في = IN/ABOUT, إلى = TO/TOWARD, على = ON/AGAINST, عن = FROM/ABOUT
 *    من = FROM/OF, ب = BY/WITH, ل = FOR/TO, حتى = UNTIL
 *
 * 3. NEGATION (أدوات النفي) — tense-aware polarity inversion
 *    لا = NOT(present), لم = NOT(past), لن = NOT(future), ما = NOT(narrative)
 *
 * 4. PRONOUNS (ضمائر) — entity markers (attached + detached)
 *    Suffixes: ـه=his/him, ـها=her, ـهم=their, ـنا=our, ـي=my, ـك=your
 *    Detached: أنا=I, أنت=you, هو=he, هي=she, نحن=we, هم=they
 *
 * 5. CONJUNCTIONS (حروف العطف) — logical connectors
 *    و = AND, أو = OR, ثم = THEN(sequence), ف = SO(consequence)
 *    لكن = BUT(contrast), بل = RATHER(correction)
 *
 * 6. CONDITIONALS (أدوات الشرط) — if-then logic
 *    إذا = IF(real/likely), لو = IF(hypothetical), إن = IF(general)
 *
 * 7. TENSE (الزمن) — temporal framing
 *    Past: فَعَلَ = DID, Present: يَفْعَلُ = DOES, Future: سَيَفْعَلُ = WILL
 *
 * 8. EMPHASIS (أدوات التوكيد) — certainty modifiers
 *    إنّ = INDEED, قد+past = ALREADY, قد+present = MIGHT, لَ = SURELY
 *
 * Each of these is a composable algebraic operator.
 * A sentence like "لم يكتب إليها" decomposes to:
 *   NOT(past) + DOES(root=كتب) + TO + HER
 *   = negation.past × verb.present × prep.to × pronoun.3fs
 */

import { ALL_ROOT_DATA } from "../data/roots.js";

const KNOWN_ROOTS = new Set<string>(ALL_ROOT_DATA.map((r) => r.arabic));

// ═══════════════════════════════════════════════════════════════════════════
// 1. VERB FORMS (أبواب الفعل)
// ═══════════════════════════════════════════════════════════════════════════
//
// Each form applies a semantic transformation to the base root meaning.
// These are COMPOSITIONAL: if you know the root and the form,
// you can derive the meaning without ever having seen that combination.

export type VerbForm =
  | "I" // فَعَلَ  — base action
  | "II" // فَعَّلَ  — intensify / cause
  | "III" // فاعَلَ  — mutual / shared action
  | "IV" // أَفْعَلَ — cause (transitive)
  | "V" // تَفَعَّلَ — reflexive of II (become X'd)
  | "VI" // تَفاعَلَ — reflexive of III (do together)
  | "VII" // اِنْفَعَلَ — passive / resultative
  | "VIII" // اِفْتَعَلَ — reflexive / middle voice
  | "X"; // اِسْتَفْعَلَ — request / seek the action

/** What each verb form DOES to the root meaning */
export const VERB_FORM_SEMANTICS: Record<
  VerbForm,
  {
    transform: string;
    meaning: string;
    wazn: string;
  }
> = {
  I: { transform: "DO", meaning: "base action", wazn: "فَعَلَ" },
  II: {
    transform: "INTENSIFY",
    meaning: "intensify or cause",
    wazn: "فَعَّلَ",
  },
  III: {
    transform: "WITH",
    meaning: "do with / shared action",
    wazn: "فاعَلَ",
  },
  IV: { transform: "CAUSE", meaning: "make someone do", wazn: "أَفْعَلَ" },
  V: {
    transform: "BECOME_INTENSE",
    meaning: "become intensified",
    wazn: "تَفَعَّلَ",
  },
  VI: {
    transform: "RECIPROCAL",
    meaning: "do with each other",
    wazn: "تَفاعَلَ",
  },
  VII: {
    transform: "RESULT",
    meaning: "be affected / resultative",
    wazn: "اِنْفَعَلَ",
  },
  VIII: {
    transform: "SELF",
    meaning: "do to oneself / reflexive",
    wazn: "اِفْتَعَلَ",
  },
  X: {
    transform: "REQUEST",
    meaning: "seek / request the action",
    wazn: "اِسْتَفْعَلَ",
  },
};

const C = "[\\u0621-\\u064A]"; // any Arabic letter

interface VerbFormMatch {
  form: VerbForm;
  root: string;
  verified: boolean;
}

const VERB_FORM_PATTERNS: Array<{
  form: VerbForm;
  regex: RegExp;
}> = [
  // Form X: استفعل — longest first
  { form: "X", regex: new RegExp(`^\\u0627\\u0633\\u062A(${C})(${C})(${C})$`) },
  // Form VII: انفعل
  { form: "VII", regex: new RegExp(`^\\u0627\\u0646(${C})(${C})(${C})$`) },
  // Form VIII: افتعل
  { form: "VIII", regex: new RegExp(`^\\u0627(${C})\\u062A(${C})(${C})$`) },
  // Form V: تفعّل (with shadda on 2nd radical)
  { form: "V", regex: new RegExp(`^\\u062A(${C})(${C})\\u0651(${C})$`) },
  // Form V: تفعّل (without shadda in text)
  { form: "V", regex: new RegExp(`^\\u062A(${C})(${C})(${C})(${C})$`) },
  // Form VI: تفاعل
  { form: "VI", regex: new RegExp(`^\\u062A(${C})\\u0627(${C})(${C})$`) },
  // Form IV: أفعل
  { form: "IV", regex: new RegExp(`^\\u0623(${C})(${C})(${C})$`) },
  // Form II: فعّل (with shadda)
  { form: "II", regex: new RegExp(`^(${C})(${C})\\u0651(${C})$`) },
  // Form III: فاعل (verb form — same shape as فاعل participle, context differentiates)
  { form: "III", regex: new RegExp(`^(${C})\\u0627(${C})(${C})$`) },
];

export function detectVerbForm(word: string): VerbFormMatch | null {
  const clean = stripForAnalysis(word);
  if (!clean) return null;

  for (const { form, regex } of VERB_FORM_PATTERNS) {
    const match = clean.match(regex);
    if (match) {
      // Form V without shadda: تفعّل written as 5 chars
      // match has 4 groups — radicals are 1, 2+3 (doubled), 4
      let root: string;
      if (form === "V" && match[4]) {
        // This was the 5-char variant; skip if middle two aren't same letter
        if (match[2] !== match[3]) continue;
        root = match[1] + match[2] + match[4];
      } else {
        root = match[1] + match[2] + match[3];
      }

      const verified = KNOWN_ROOTS.has(root);
      if (verified) {
        return { form, root, verified };
      }
      // Try hamza variants
      const variants = generateVariants(root);
      for (const v of variants) {
        if (KNOWN_ROOTS.has(v)) {
          return { form, root: v, verified: true };
        }
      }
      // Unverified match — keep looking
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PREPOSITIONS (حروف الجر) — relational operators
// ═══════════════════════════════════════════════════════════════════════════

export type Preposition =
  | "in" // في — location / topic
  | "to" // إلى — direction / recipient
  | "on" // على — upon / obligation / against
  | "from" // من — origin / partitive
  | "about" // عن — about / away from
  | "with" // بـ / مع — instrument / accompaniment
  | "for" // لـ — purpose / beneficiary
  | "until"; // حتى — limit / deadline

export interface PrepPhrase {
  prep: Preposition;
  /** the Arabic particle found */
  particle: string;
  /** what follows the preposition */
  object: string;
}

// Ordered longest-first so "من أجل" matches before "من"
const PREP_PATTERNS: Array<{ prep: Preposition; particles: string[] }> = [
  { prep: "about", particles: ["عن", "بخصوص", "حول", "بشأن"] },
  { prep: "until", particles: ["حتى", "إلى أن"] },
  { prep: "in", particles: ["في", "داخل", "ضمن"] },
  { prep: "to", particles: ["إلى", "نحو"] },
  { prep: "on", particles: ["على", "فوق"] },
  { prep: "from", particles: ["من"] },
  { prep: "with", particles: ["مع", "بواسطة"] },
  { prep: "for", particles: ["لأجل", "من أجل"] },
];

// Single-letter attached preps: بـ (with/by), لـ (for), كـ (like)
const ATTACHED_PREPS: Array<{ letter: string; prep: Preposition }> = [
  { letter: "\u0628", prep: "with" }, // ب
  { letter: "\u0644", prep: "for" }, // ل
];

export function extractPrepositions(input: string): PrepPhrase[] {
  const results: PrepPhrase[] = [];
  const words = input.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    // Multi-word prepositions (check 2-word combos)
    const twoWord = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : "";

    let found = false;
    for (const pp of PREP_PATTERNS) {
      for (const particle of pp.particles) {
        if (twoWord === particle) {
          const obj = words.slice(i + 2).join(" ");
          if (obj) results.push({ prep: pp.prep, particle, object: obj });
          i++; // skip next word
          found = true;
          break;
        }
        if (words[i] === particle) {
          const obj = words.slice(i + 1).join(" ");
          if (obj) results.push({ prep: pp.prep, particle, object: obj });
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Single-letter attached preps (بالكتاب = ب + الكتاب)
    if (!found && words[i] && words[i].length > 2) {
      for (const ap of ATTACHED_PREPS) {
        if (words[i].startsWith(ap.letter)) {
          const rest = words[i].slice(1);
          // Only if what remains is recognizable (starts with ال or is 3+ chars)
          if (rest.startsWith("\u0627\u0644") || rest.length >= 3) {
            results.push({ prep: ap.prep, particle: ap.letter, object: rest });
            break;
          }
        }
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. NEGATION (أدوات النفي) — polarity inversion with tense
// ═══════════════════════════════════════════════════════════════════════════

export type NegationTense = "present" | "past" | "future" | "imperative";

export interface Negation {
  tense: NegationTense;
  particle: string;
}

const NEGATION_PARTICLES: Array<{
  particle: string;
  tense: NegationTense;
  pattern: RegExp;
}> = [
  // لم + jussive = "didn't" (past completed)
  { particle: "لم", tense: "past", pattern: /(?:^|\s)(لم)\s/ },
  // لن + subjunctive = "will never" (future denial)
  { particle: "لن", tense: "future", pattern: /(?:^|\s)(لن)\s/ },
  // لا + present = "doesn't" (habitual negation)
  { particle: "لا", tense: "present", pattern: /(?:^|\s)(لا)\s/ },
  // ما + past/present = "didn't / doesn't" (narrative)
  { particle: "ما", tense: "past", pattern: /(?:^|\s)(ما)\s/ },
  // ليس = "is not" (copular negation)
  { particle: "ليس", tense: "present", pattern: /(?:^|\s)(ليس)\s/ },
  // ليست = "is not" (feminine)
  { particle: "ليست", tense: "present", pattern: /(?:^|\s)(ليست)\s/ },
  // غير = "non-/un-" (nominal negation)
  { particle: "غير", tense: "present", pattern: /(?:^|\s)(غير)\s/ },
  // English
  {
    particle: "not",
    tense: "present",
    pattern: /\b(not|n't|don't|doesn't|didn't|won't|can't|cannot|never)\b/i,
  },
];

export function detectNegation(input: string): Negation | null {
  for (const np of NEGATION_PARTICLES) {
    if (np.pattern.test(input)) {
      return { tense: np.tense, particle: np.particle };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PRONOUNS (ضمائر) — entity markers
// ═══════════════════════════════════════════════════════════════════════════

export type Person =
  | "1s"
  | "1p"
  | "2ms"
  | "2fs"
  | "2p"
  | "3ms"
  | "3fs"
  | "3mp"
  | "3fp";

export interface PronounRef {
  person: Person;
  role: "subject" | "object" | "possessor";
  surface: string;
}

// Detached pronouns (standalone words)
const DETACHED_PRONOUNS: Array<{ words: string[]; person: Person }> = [
  { words: ["أنا", "انا"], person: "1s" },
  { words: ["نحن"], person: "1p" },
  { words: ["أنت", "انت"], person: "2ms" },
  { words: ["أنتِ", "انتي"], person: "2fs" },
  { words: ["أنتم", "انتم"], person: "2p" },
  { words: ["هو"], person: "3ms" },
  { words: ["هي"], person: "3fs" },
  { words: ["هم"], person: "3mp" },
  { words: ["هن"], person: "3fp" },
  // English
  { words: ["i", "I"], person: "1s" },
  { words: ["we"], person: "1p" },
  { words: ["you"], person: "2ms" },
  { words: ["he", "him"], person: "3ms" },
  { words: ["she", "her"], person: "3fs" },
  { words: ["they", "them"], person: "3mp" },
];

// Arabic pronoun suffixes (attached to end of word)
// Ordered longest first to match ـهما before ـها
const PRONOUN_SUFFIXES: Array<{ suffix: string; person: Person }> = [
  { suffix: "هما", person: "3mp" }, // dual
  { suffix: "هم", person: "3mp" },
  { suffix: "هن", person: "3fp" },
  { suffix: "كم", person: "2p" },
  { suffix: "نا", person: "1p" },
  { suffix: "ها", person: "3fs" },
  { suffix: "ـه", person: "3ms" },
  { suffix: "ك", person: "2ms" },
  { suffix: "ي", person: "1s" },
  { suffix: "ه", person: "3ms" },
];

export function extractPronouns(input: string): PronounRef[] {
  const results: PronounRef[] = [];
  const words = input.split(/\s+/);
  const seen = new Set<Person>();

  // Detached pronouns
  for (const word of words) {
    for (const dp of DETACHED_PRONOUNS) {
      if (dp.words.includes(word) && !seen.has(dp.person)) {
        seen.add(dp.person);
        results.push({ person: dp.person, role: "subject", surface: word });
      }
    }
  }

  // Suffix pronouns (attached to Arabic words)
  for (const word of words) {
    if (word.length < 3) continue;
    for (const sp of PRONOUN_SUFFIXES) {
      if (word.endsWith(sp.suffix) && word.length > sp.suffix.length + 1) {
        if (!seen.has(sp.person)) {
          seen.add(sp.person);
          results.push({
            person: sp.person,
            role: "object",
            surface: sp.suffix,
          });
        }
        break;
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONJUNCTIONS (حروف العطف) — logical connectors
// ═══════════════════════════════════════════════════════════════════════════

export type Conjunction =
  | "and" // و — additive
  | "or" // أو — alternative
  | "then" // ثم — sequential (X then Y)
  | "so" // ف — consequential (X so Y)
  | "but" // لكن — contrastive
  | "rather"; // بل — corrective

export interface ConjunctionMarker {
  type: Conjunction;
  particle: string;
  /** position in input string */
  position: number;
}

const CONJUNCTION_MAP: Array<{ particle: string; type: Conjunction }> = [
  // Arabic
  { particle: "ثم", type: "then" },
  { particle: "لكن", type: "but" },
  { particle: "لكنّ", type: "but" },
  { particle: "بل", type: "rather" },
  { particle: "أو", type: "or" },
  { particle: "و", type: "and" },
  { particle: "ف", type: "so" },
  // English
  { particle: "then", type: "then" },
  { particle: "and", type: "and" },
  { particle: "or", type: "or" },
  { particle: "but", type: "but" },
  { particle: "so", type: "so" },
];

export function extractConjunctions(input: string): ConjunctionMarker[] {
  const results: ConjunctionMarker[] = [];
  const words = input.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    for (const cj of CONJUNCTION_MAP) {
      if (words[i] === cj.particle) {
        results.push({
          type: cj.type,
          particle: cj.particle,
          position: i,
        });
        break;
      }
    }
    // Arabic attached و (wa-) at start of word = "and"
    if (words[i].startsWith("\u0648") && words[i].length > 2 && i > 0) {
      // Only if the rest isn't a known conjunction itself
      const rest = words[i].slice(1);
      if (!CONJUNCTION_MAP.some((c) => c.particle === rest)) {
        results.push({
          type: "and",
          particle: "و",
          position: i,
        });
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. CONDITIONALS (أدوات الشرط) — if-then logic
// ═══════════════════════════════════════════════════════════════════════════

export type ConditionalType =
  | "real" // إذا — if (likely/real condition)
  | "hypothetical" // لو — if (contrary to fact / wish)
  | "general"; // إن — if (general/open condition)

export interface Conditional {
  type: ConditionalType;
  particle: string;
}

const CONDITIONAL_PARTICLES: Array<{
  particles: string[];
  type: ConditionalType;
}> = [
  { particles: ["إذا", "اذا"], type: "real" },
  { particles: ["لو", "لولا"], type: "hypothetical" },
  { particles: ["إن", "ان"], type: "general" },
  // English
  { particles: ["if"], type: "real" },
  { particles: ["if only", "i wish"], type: "hypothetical" },
];

export function detectConditional(input: string): Conditional | null {
  const words = input.split(/\s+/);

  for (const cp of CONDITIONAL_PARTICLES) {
    for (const particle of cp.particles) {
      // Multi-word
      if (particle.includes(" ")) {
        if (input.includes(particle)) {
          return { type: cp.type, particle };
        }
      } else if (words.includes(particle)) {
        return { type: cp.type, particle };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. TENSE (الزمن) — temporal framing
// ═══════════════════════════════════════════════════════════════════════════

export type Tense = "past" | "present" | "future" | "imperative";

export interface TenseMarker {
  tense: Tense;
  signal: string;
}

/**
 * Arabic tense detection from verb prefixes, particles, and context.
 *
 * Arabic verbs conjugate for tense:
 * - Past:      فَعَلَ (base form, no prefix)
 * - Present:   يَفْعَلُ (prefix ي/ت/ن/أ)
 * - Future:    سَيَفْعَلُ (سـ or سوف + present)
 * - Imperative: اِفْعَلْ (prefix ا + jussive)
 */
export function detectTense(input: string): TenseMarker {
  const words = input.split(/\s+/);

  // Future markers (check first — most specific)
  for (const w of words) {
    if (w === "سوف" || w === "سوف") {
      return { tense: "future", signal: "سوف" };
    }
    // سـ prefix on a verb (سيكتب = will write)
    if (w.startsWith("\u0633") && w.length > 3) {
      return { tense: "future", signal: "سـ" };
    }
  }

  // English future
  if (/\b(will|going to|gonna|shall)\b/i.test(input)) {
    return { tense: "future", signal: "will" };
  }

  // Past negation marker لم means the VERB is past even though the verb looks present
  if (words.includes("لم")) {
    return { tense: "past", signal: "لم" };
  }

  // Imperative: starts with a command verb
  // Arabic: first word is اِفعَل form (starts with ا and 4 letters)
  if (words[0] && words[0].startsWith("\u0627") && words[0].length === 4) {
    const possibleRoot = words[0].slice(1);
    if (KNOWN_ROOTS.has(possibleRoot)) {
      return { tense: "imperative", signal: words[0] };
    }
  }
  // English imperative: starts with a verb (no subject)
  if (
    /^(send|write|gather|find|book|schedule|cancel|create|delete|show|open)\b/i.test(
      input,
    )
  ) {
    return { tense: "imperative", signal: "imperative" };
  }

  // Present tense: Arabic verb with present-tense prefix (ي ت ن أ)
  const presentPrefixes = ["\u064A", "\u062A", "\u0646", "\u0623"]; // ي ت ن أ
  for (const w of words) {
    if (w.length >= 4 && presentPrefixes.some((p) => w.startsWith(p))) {
      // Check if stripping prefix yields a known root
      const candidate = w.slice(1);
      if (candidate.length === 3 && KNOWN_ROOTS.has(candidate)) {
        return { tense: "present", signal: w };
      }
    }
  }

  // English tense signals
  if (/\b(did|was|were|had|yesterday|last)\b/i.test(input)) {
    return { tense: "past", signal: "past" };
  }

  // Default: present (most unmarked sentences are present/general)
  return { tense: "present", signal: "default" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. EMPHASIS (أدوات التوكيد) — certainty modifiers
// ═══════════════════════════════════════════════════════════════════════════

export type EmphasisLevel = "none" | "mild" | "strong";

export interface Emphasis {
  level: EmphasisLevel;
  particle: string;
}

export function detectEmphasis(input: string): Emphasis {
  const words = input.split(/\s+/);

  // إنّ / أنّ = strong assertion ("indeed", "verily")
  if (
    words.some((w) => w === "إن" || w === "إنّ" || w === "أن" || w === "أنّ")
  ) {
    // Disambiguate: إن at start = conditional, إنّ = emphasis
    // If it has shadda or is followed by a pronoun/noun, it's emphasis
    if (words[0] === "إنّ" || words[0] === "أنّ") {
      return { level: "strong", particle: words[0] };
    }
  }

  // قد + past verb = "already/indeed" (strong)
  // قد + present verb = "might/perhaps" (mild)
  const qadIdx = words.indexOf("قد");
  if (qadIdx !== -1) {
    // We'll approximate: if negation present, it's mild
    if (words.includes("لا") || words.includes("لم")) {
      return { level: "mild", particle: "قد" };
    }
    return { level: "strong", particle: "قد" };
  }

  // English emphasis
  if (/\b(must|definitely|certainly|absolutely|please|urgent)\b/i.test(input)) {
    return { level: "strong", particle: "emphasis" };
  }
  if (/\b(maybe|perhaps|possibly|might|could)\b/i.test(input)) {
    return { level: "mild", particle: "uncertainty" };
  }

  return { level: "none", particle: "" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. FULL SENTENCE ANALYSIS — compose all operators
// ═══════════════════════════════════════════════════════════════════════════

export interface GrammaticalAnalysis {
  verbForm: VerbFormMatch | null;
  prepositions: PrepPhrase[];
  negation: Negation | null;
  pronouns: PronounRef[];
  conjunctions: ConjunctionMarker[];
  conditional: Conditional | null;
  tense: TenseMarker;
  emphasis: Emphasis;
}

/**
 * Analyze all grammatical operators in an Arabic/English input.
 * Each operator is independent and composable.
 */
export function analyzeGrammar(input: string): GrammaticalAnalysis {
  const words = input.split(/\s+/);

  // Try verb form detection on each Arabic word
  let verbForm: VerbFormMatch | null = null;
  for (const word of words) {
    const vf = detectVerbForm(word);
    if (vf && vf.verified) {
      verbForm = vf;
      break;
    }
  }

  return {
    verbForm,
    prepositions: extractPrepositions(input),
    negation: detectNegation(input),
    pronouns: extractPronouns(input),
    conjunctions: extractConjunctions(input),
    conditional: detectConditional(input),
    tense: detectTense(input),
    emphasis: detectEmphasis(input),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function stripForAnalysis(word: string): string {
  return word
    .replace(
      /[\u0610-\u061A\u064B-\u0650\u0652-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,
      "",
    )
    .trim();
}

function generateVariants(root: string): string[] {
  const variants: string[] = [];
  const alefForms = ["\u0627", "\u0623", "\u0625", "\u0622"];
  for (let i = 0; i < root.length; i++) {
    if (alefForms.includes(root[i])) {
      for (const form of alefForms) {
        if (form !== root[i]) {
          variants.push(root.slice(0, i) + form + root.slice(i + 1));
        }
      }
    }
  }
  return variants;
}
