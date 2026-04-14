/**
 * Arabic Algebra Engine — Core Types
 *
 * The algebra token is the central data structure.
 * Everything passes through this representation.
 */

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

/**
 * AlgebraToken — the intermediate representation.
 * Natural language collapses into this. Reasoning operates on this.
 */
export interface AlgebraToken {
  intent: IntentOperator;
  root: ArabicRoot;
  rootLatin: string; // e.g. 'k-t-b'
  pattern: PatternOperator;
  modifiers: string[]; // e.g. ['time:tomorrow', 'target:team']
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

export function compactToken(token: AlgebraToken): string {
  const mods = token.modifiers.map((m) => `[${m}]`).join(" + ");
  return `[${token.root}×${token.pattern}]` + (mods ? ` + ${mods}` : "");
}
