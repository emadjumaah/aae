/**
 * Arabic Algebra Engine — Core Types
 *
 * The algebra token is the central data structure.
 * Everything passes through this representation.
 *
 * An Arabic sentence decomposes into:
 *   root × pattern × verbForm × tense × negation × prepositions × pronouns × conjunctions × conditional × emphasis
 *
 * Each dimension is an algebraic operator. Together they compose meaning.
 */

// Re-export grammatical types for convenience
export type {
  VerbForm,
  Preposition,
  PrepPhrase,
  NegationTense,
  Negation,
  Person,
  PronounRef,
  Conjunction,
  ConjunctionMarker,
  ConditionalType,
  Conditional,
  Tense,
  TenseMarker,
  EmphasisLevel,
  Emphasis,
  GrammaticalAnalysis,
} from "./grammar.js";

// ─── Intent Operators ──────────────────────────────────────────────────────
export type IntentOperator =
  | "seek" // requesting / wanting something
  | "do" // performing an action
  | "send" // dispatching / communicating
  | "gather" // assembling / collecting
  | "record" // storing / documenting
  | "learn" // acquiring knowledge
  | "decide" // resolving / confirming
  | "enable" // making possible
  | "judge" // evaluating
  | "ask"; // querying for information

// ─── Pattern Operators (أوزان) ─────────────────────────────────────────────
export type PatternOperator =
  | "agent" // فاعل  — one who does
  | "patient" // مفعول — thing acted upon
  | "place" // مفعلة — place of action
  | "instance" // فعال  — single occurrence / abstract noun
  | "plural" // فعول  — collective / plural
  | "seek" // استفعال — requesting the action
  | "mutual" // تفاعل — reciprocal action
  | "process" // مفاعلة — ongoing process
  | "intensifier" // فعّال — intensive / professional
  | "causer"; // مفعل  — one who causes

// ─── Root ──────────────────────────────────────────────────────────────────
// 150 roots — validated at runtime via the root database in src/data/roots.ts.
// Using string here because a 150-entry union adds no practical safety
// (the encoder always picks from the known set).
export type ArabicRoot = string;

// ─── Action Types (output of the reasoning engine) ─────────────────────────
export type ActionType =
  | "schedule"
  | "send"
  | "broadcast"
  | "assemble"
  | "locate"
  | "store"
  | "document"
  | "query"
  | "execute"
  | "create"
  | "coordinate"
  | "study"
  | "request_teach"
  | "resolve"
  | "evaluate"
  | "process";

// ─── Core Data Structures ──────────────────────────────────────────────────

import type {
  VerbForm,
  PrepPhrase,
  Negation,
  PronounRef,
  ConjunctionMarker,
  Conditional,
  TenseMarker,
  Emphasis,
} from "./grammar.js";

/**
 * AlgebraToken — the intermediate representation.
 * Natural language collapses into this. The engine reasons on this.
 *
 * Think of it as: root × pattern × form × tense × polarity × relations × entities
 * Each field is an algebraic dimension. Together they compose full meaning.
 *
 * Backward-compatible: new fields are optional. Old code still works.
 */
export interface AlgebraToken {
  intent: IntentOperator;
  root: ArabicRoot;
  rootLatin: string; // e.g. 'k-t-b'
  pattern: PatternOperator;
  modifiers: string[]; // e.g. ['time:tomorrow', 'target:team']

  // ── Grammatical operators (new) ──────────────────────────────────────
  /** Verb form I-X: semantic transformation on root (CAUSE, REQUEST, MUTUAL...) */
  verbForm?: VerbForm;
  /** Tense: past, present, future, imperative */
  tense?: TenseMarker;
  /** Negation: لم (past-not), لن (future-not), لا (present-not) */
  negation?: Negation | null;
  /** Prepositions: relational operators (في=in, إلى=to, على=on, عن=about) */
  prepositions?: PrepPhrase[];
  /** Pronouns: who is involved (subject, object, possessor) */
  pronouns?: PronounRef[];
  /** Conjunctions: logical connectors (و=and, أو=or, ثم=then, ف=so) */
  conjunctions?: ConjunctionMarker[];
  /** Conditional: if-then logic (إذا=real, لو=hypothetical) */
  conditional?: Conditional | null;
  /** Emphasis: certainty level (قد=already, إنّ=indeed) */
  emphasis?: Emphasis;
}

/**
 * ReasoningResult — output of the symbolic engine.
 * Fully explainable, no black box.
 */
export interface ReasoningResult {
  token: AlgebraToken;
  actionType: ActionType;
  resource: string;
  constraints: string[];
  resolvedIntent: string;
  confidence: number; // 0.0 - 1.0
  /** Root chain from implication rules (e.g. ['سفر', 'خرج', 'شبك']) */
  chainRoots?: string[];
  /** Tool suggestion from implication rules */
  suggestedTool?: string;
}

// ─── Dictionary Types ──────────────────────────────────────────────────────

export interface RootEntry {
  arabic: ArabicRoot;
  latin: string;
  semanticField: string;
  covers: string;
}

export interface PatternEntry {
  wazn: string;
  name: string;
  operator: PatternOperator;
  meaning: string;
  example: { arabic: string; english: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Compact string representation of a token. Shows the algebraic decomposition.
 * Example: [كتب×place×II] + NEG(past) + TO(المدير) + [time:tomorrow]
 */
export function compactToken(token: AlgebraToken): string {
  const parts: string[] = [];

  // Core: root × pattern (× verbForm if present)
  let core = `[${token.root}×${token.pattern}`;
  if (token.verbForm) core += `×${token.verbForm}`;
  core += "]";
  parts.push(core);

  // Tense (if not default present)
  if (token.tense && token.tense.tense !== "present") {
    parts.push(`T:${token.tense.tense}`);
  }

  // Negation
  if (token.negation) {
    parts.push(`NEG(${token.negation.tense})`);
  }

  // Prepositions
  if (token.prepositions) {
    for (const pp of token.prepositions) {
      parts.push(`${pp.prep.toUpperCase()}(${pp.object})`);
    }
  }

  // Pronouns
  if (token.pronouns && token.pronouns.length > 0) {
    const prons = token.pronouns.map((p) => `${p.role}:${p.person}`).join(",");
    parts.push(`WHO(${prons})`);
  }

  // Conditional
  if (token.conditional) {
    parts.push(`IF(${token.conditional.type})`);
  }

  // Emphasis
  if (token.emphasis && token.emphasis.level !== "none") {
    parts.push(`EMPH(${token.emphasis.level})`);
  }

  // Conjunctions
  if (token.conjunctions && token.conjunctions.length > 0) {
    for (const c of token.conjunctions) {
      parts.push(`${c.type.toUpperCase()}`);
    }
  }

  // Legacy modifiers
  if (token.modifiers.length > 0) {
    for (const m of token.modifiers) {
      parts.push(`[${m}]`);
    }
  }

  return parts.join(" + ");
}
