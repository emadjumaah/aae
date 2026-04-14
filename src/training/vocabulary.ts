/**
 * Arabic Algebra — Hybrid Token Vocabulary
 *
 * Defines the complete token vocabulary for the algebra-based reasoning model.
 * ~2,100 tokens total vs 50,000+ for BPE. Each token carries semantic structure.
 *
 * Three layers:
 *   1. Algebra tokens — root, intent, pattern, domain, root×pattern combos
 *   2. Modifier tokens — structured key-value slots
 *   3. Structural tokens — logic, sequencing, special
 */

import { ALL_ROOT_DATA, type RootData } from "../engine/data/roots.js";
import type {
  IntentOperator,
  PatternOperator,
  ActionType,
} from "../engine/core/types.js";

// ─── Special Tokens ────────────────────────────────────────────────────────

export const SPECIAL_TOKENS = [
  "<PAD>",
  "<UNK>",
  "<BOS>",
  "<EOS>",
  "<MASK>",
] as const;
export type SpecialToken = (typeof SPECIAL_TOKENS)[number];

// ─── Relation Tokens ───────────────────────────────────────────────────────

export const RELATION_OPS = [
  "AND",
  "OR",
  "NOT",
  "IF",
  "THEN",
  "ELSE",
  "BECAUSE",
  "BEFORE",
  "AFTER",
  "WHILE",
  "UNTIL",
] as const;
export type RelationOp = (typeof RELATION_OPS)[number];

// ─── Sequence Tokens ───────────────────────────────────────────────────────

export const SEQUENCE_MARKERS = ["START", "END", "SEP", "STEP"] as const;
export type SequenceMarker = (typeof SEQUENCE_MARKERS)[number];

// ─── Modifier Keys ─────────────────────────────────────────────────────────

export const MODIFIER_KEYS = [
  "time",
  "target",
  "topic",
  "content",
  "urgency",
  "location",
  "quantity",
  "method",
  "reason",
  "condition",
] as const;
export type ModifierKey = (typeof MODIFIER_KEYS)[number];

// ─── Confidence Levels ─────────────────────────────────────────────────────

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// ─── All Intents ───────────────────────────────────────────────────────────

const ALL_INTENTS: IntentOperator[] = [
  "seek",
  "do",
  "send",
  "gather",
  "record",
  "learn",
  "decide",
  "enable",
  "judge",
  "ask",
];

// ─── All Patterns ──────────────────────────────────────────────────────────

const ALL_PATTERNS: PatternOperator[] = [
  "agent",
  "patient",
  "place",
  "instance",
  "plural",
  "seek",
  "mutual",
  "process",
  "intensifier",
  "causer",
];

// ─── All Action Types ──────────────────────────────────────────────────────

const ALL_ACTIONS: ActionType[] = [
  "schedule",
  "send",
  "broadcast",
  "assemble",
  "locate",
  "store",
  "document",
  "query",
  "execute",
  "create",
  "coordinate",
  "study",
  "request_teach",
  "resolve",
  "evaluate",
  "process",
];

// ─── All Domains ───────────────────────────────────────────────────────────

function allDomains(): string[] {
  const set = new Set<string>();
  for (const r of ALL_ROOT_DATA) set.add(r.domain);
  return [...set].sort();
}

// ─── Token Prefixes ────────────────────────────────────────────────────────

export type TokenPrefix =
  | "I" // intent
  | "R" // root (arabic)
  | "RL" // root latin
  | "P" // pattern
  | "D" // domain
  | "ACT" // action type
  | "MK" // modifier key
  | "MV" // modifier value
  | "LIT" // literal (proper nouns, numbers, etc.)
  | "REL" // relation
  | "SEQ" // sequence marker
  | "CONF" // confidence
  | "TOOL" // tool to invoke
  | "NEXT" // next step prediction
  | "CTX" // conversation context
  | "STEP" // chain step number
  | "REASON"; // chain-of-thought reason

// ─── Vocabulary Builder ────────────────────────────────────────────────────

export interface VocabEntry {
  id: number;
  token: string;
  prefix: TokenPrefix | "SPECIAL";
  description: string;
}

export class AlgebraVocabulary {
  private tokenToId: Map<string, number> = new Map();
  private idToEntry: Map<number, VocabEntry> = new Map();
  private nextId = 0;

  constructor() {
    this.build();
  }

  private add(
    token: string,
    prefix: TokenPrefix | "SPECIAL",
    description: string,
  ): number {
    if (this.tokenToId.has(token)) return this.tokenToId.get(token)!;
    const id = this.nextId++;
    const entry: VocabEntry = { id, token, prefix, description };
    this.tokenToId.set(token, id);
    this.idToEntry.set(id, entry);
    return id;
  }

  private build(): void {
    // Special tokens first (IDs 0-4)
    for (const t of SPECIAL_TOKENS) {
      this.add(t, "SPECIAL", `special: ${t}`);
    }

    // Intent tokens
    for (const intent of ALL_INTENTS) {
      this.add(`I:${intent}`, "I", `intent: ${intent}`);
    }

    // Pattern tokens
    for (const pattern of ALL_PATTERNS) {
      this.add(`P:${pattern}`, "P", `pattern: ${pattern}`);
    }

    // Root tokens (arabic + latin)
    for (const root of ALL_ROOT_DATA) {
      this.add(
        `R:${root.arabic}`,
        "R",
        `root: ${root.arabic} (${root.latin}) — ${root.semanticField}`,
      );
      this.add(`RL:${root.latin}`, "RL", `root-latin: ${root.latin}`);
    }

    // Domain tokens
    for (const domain of allDomains()) {
      this.add(`D:${domain}`, "D", `domain: ${domain}`);
    }

    // Action type tokens
    for (const action of ALL_ACTIONS) {
      this.add(`ACT:${action}`, "ACT", `action: ${action}`);
    }

    // Modifier key tokens
    for (const key of MODIFIER_KEYS) {
      this.add(`MK:${key}`, "MK", `modifier-key: ${key}`);
    }

    // Common modifier values
    this.addTimeValues();
    this.addUrgencyValues();

    // Relation tokens
    for (const rel of RELATION_OPS) {
      this.add(`REL:${rel}`, "REL", `relation: ${rel}`);
    }

    // Sequence markers
    for (const seq of SEQUENCE_MARKERS) {
      this.add(`SEQ:${seq}`, "SEQ", `sequence: ${seq}`);
    }

    // Confidence levels
    for (const conf of CONFIDENCE_LEVELS) {
      this.add(`CONF:${conf}`, "CONF", `confidence: ${conf}`);
    }

    // Agent tokens — tools, next steps, context, chain steps
    this.addAgentTokens();
    this.addChainTokens();
  }

  private addAgentTokens(): void {
    // Next step tokens
    const nextSteps = [
      "execute",
      "confirm",
      "await_input",
      "clarify",
      "escalate",
      "report",
      "chain",
      "close",
    ];
    for (const step of nextSteps) {
      this.add(`NEXT:${step}`, "NEXT", `next-step: ${step}`);
    }

    // Context keys and common values
    const ctxKeys = [
      "turn",
      "prev_tool",
      "prev_action",
      "issue_type",
      "sentiment",
      "channel",
    ];
    for (const key of ctxKeys) {
      this.add(`CTX:${key}`, "CTX", `context-key: ${key}`);
    }

    // Common context values
    const sentiments = ["positive", "neutral", "frustrated"];
    for (const s of sentiments) {
      this.add(`CTX:sentiment:${s}`, "CTX", `sentiment: ${s}`);
    }
    const channels = ["chat", "voice", "email"];
    for (const c of channels) {
      this.add(`CTX:channel:${c}`, "CTX", `channel: ${c}`);
    }
  }

  private addChainTokens(): void {
    // Step numbers for chain-of-thought
    for (let i = 1; i <= 5; i++) {
      this.add(`STEP:${i}`, "STEP", `chain step ${i}`);
    }
    // Reason categories
    const reasons = [
      "billing",
      "account",
      "technical",
      "device",
      "general",
      "transfers",
      "loans",
      "cards",
      "investments",
      "services",
      "appointments",
      "records",
      "medications",
      "insurance",
      "clinical",
      "security",
      "followup",
      "format",
      "verify",
      "escalate",
    ];
    for (const r of reasons) {
      this.add(`REASON:${r}`, "REASON", `reason: ${r}`);
    }
  }

  /** Register a tool token (called by domain definitions) */
  addTool(toolId: string): number {
    const token = `TOOL:${toolId}`;
    if (this.tokenToId.has(token)) return this.tokenToId.get(token)!;
    return this.add(token, "TOOL", `tool: ${toolId}`);
  }

  private addTimeValues(): void {
    const timeVals = [
      "now",
      "today",
      "tonight",
      "tomorrow",
      "yesterday",
      "this_week",
      "next_week",
      "last_week",
      "this_month",
      "next_month",
      "last_month",
      "morning",
      "afternoon",
      "evening",
      "soon",
      "later",
      "asap",
      "urgent",
    ];
    for (const v of timeVals) {
      this.add(`MV:time:${v}`, "MV", `time-value: ${v}`);
    }
  }

  private addUrgencyValues(): void {
    const urgencyVals = ["low", "normal", "high", "critical"];
    for (const v of urgencyVals) {
      this.add(`MV:urgency:${v}`, "MV", `urgency-value: ${v}`);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /** Get token ID, or <UNK> ID if not found */
  encode(token: string): number {
    return this.tokenToId.get(token) ?? this.tokenToId.get("<UNK>")!;
  }

  /** Get token string from ID */
  decode(id: number): string {
    return this.idToEntry.get(id)?.token ?? "<UNK>";
  }

  /** Get full entry */
  entry(id: number): VocabEntry | undefined {
    return this.idToEntry.get(id);
  }

  /** Check if a token exists */
  has(token: string): boolean {
    return this.tokenToId.has(token);
  }

  /** Register a literal token on the fly (for proper nouns, numbers, etc.) */
  addLiteral(value: string): number {
    const token = `LIT:${value}`;
    if (this.tokenToId.has(token)) return this.tokenToId.get(token)!;
    return this.add(token, "LIT", `literal: ${value}`);
  }

  /** Total vocabulary size */
  get size(): number {
    return this.nextId;
  }

  /** Get pad token ID */
  get padId(): number {
    return this.tokenToId.get("<PAD>")!;
  }

  /** Get BOS token ID */
  get bosId(): number {
    return this.tokenToId.get("<BOS>")!;
  }

  /** Get EOS token ID */
  get eosId(): number {
    return this.tokenToId.get("<EOS>")!;
  }

  /** Export full vocabulary as array */
  toArray(): VocabEntry[] {
    return [...this.idToEntry.values()];
  }

  /** Export as JSON for model training */
  toJSON(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [token, id] of this.tokenToId) {
      result[token] = id;
    }
    return result;
  }

  /** Summary stats */
  stats(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.idToEntry.values()) {
      counts[entry.prefix] = (counts[entry.prefix] ?? 0) + 1;
    }
    counts["TOTAL"] = this.nextId;
    return counts;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _vocab: AlgebraVocabulary | undefined;

export function getVocabulary(): AlgebraVocabulary {
  if (!_vocab) _vocab = new AlgebraVocabulary();
  return _vocab;
}
