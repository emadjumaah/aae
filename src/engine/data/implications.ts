/**
 * Arabic Algebra — Implication Rules (METADATA ONLY)
 *
 * IF condition THEN likely-action — training annotations, NOT runtime overrides.
 *
 * These rules capture domain-specific inference patterns:
 *   "If the user mentions travel + future time → they probably need roaming setup"
 *   "If the user says something is expensive → billing complaint likely"
 *
 * IMPORTANT: These do NOT override engine.reason() at runtime.
 * They exist for:
 *   1. Training data generation — labeling examples with reasoning chains
 *   2. Trace/explain output — showing what a trained model should learn
 *   3. Evaluation — measuring if a trained model discovers these patterns
 *
 * The model should learn to infer these, not have them hardcoded.
 * Priority: higher number = checked first (for annotation ranking).
 */

export interface ImplicationCondition {
  root?: string;
  intent?: string;
  pattern?: string;
  modifier?: string; // e.g. 'time:future', 'urgency:critical'
  negation?: boolean; // presence of negation
  verbForm?: string; // e.g. 'II', 'X'
  tense?: string; // 'past' | 'present' | 'future' | 'imperative'
}

export interface ImplicationResult {
  action: string; // overrides actionType
  confidence?: number; // override confidence (if higher than calculated)
  addConstraints?: string[]; // extra constraints to append
  chainRoots?: string[]; // related roots forming the reasoning chain
  suggestedTool?: string; // hint for agent layer
}

export interface ImplicationRule {
  id: string;
  condition: ImplicationCondition;
  result: ImplicationResult;
  priority: number; // higher = checked first
  domain?: string; // optional domain scope
}

// ─── Rules ─────────────────────────────────────────────────────────────────

export const IMPLICATION_RULES: ImplicationRule[] = [
  // ── Travel → Roaming ────────────────────────────────────────────────
  {
    id: "travel-future-roaming",
    condition: { root: "سفر", modifier: "time:future" },
    result: {
      action: "execute",
      confidence: 0.85,
      chainRoots: ["سفر", "خرج", "شبك"],
      suggestedTool: "activate_roaming",
      addConstraints: ["chain: سفر→شبك (travel implies roaming)"],
    },
    priority: 10,
    domain: "telecom",
  },
  {
    id: "travel-generic-roaming",
    condition: { root: "سفر" },
    result: {
      action: "query",
      chainRoots: ["سفر", "شبك"],
      suggestedTool: "activate_roaming",
      addConstraints: ["chain: سفر→شبك (travel may need roaming)"],
    },
    priority: 5,
    domain: "telecom",
  },

  // ── Expensive → Billing complaint ──────────────────────────────────
  {
    id: "expensive-complaint",
    condition: { root: "ثمن" },
    result: {
      action: "evaluate",
      confidence: 0.8,
      chainRoots: ["ثمن", "حكم"],
      suggestedTool: "dispute_charge",
      addConstraints: ["chain: ثمن→حكم (price implies judgment/complaint)"],
    },
    priority: 9,
  },
  {
    id: "expensive-negation",
    condition: { root: "ثمن", negation: true },
    result: {
      action: "resolve",
      confidence: 0.85,
      chainRoots: ["ثمن", "إلغ"],
      suggestedTool: "dispute_charge",
      addConstraints: ["chain: ثمن+NOT→إلغ (expensive + negation = wants out)"],
    },
    priority: 11,
  },

  // ── Broken/defect → Technical support ──────────────────────────────
  {
    id: "broken-support",
    condition: { root: "عطل" },
    result: {
      action: "execute",
      confidence: 0.85,
      chainRoots: ["عطل", "فحص", "صلح"],
      suggestedTool: "open_ticket",
      addConstraints: ["chain: عطل→فحص→صلح (defect→diagnose→fix)"],
    },
    priority: 10,
  },

  // ── Cancel → Cancel service ────────────────────────────────────────
  {
    id: "cancel-service",
    condition: { root: "إلغ", intent: "decide" },
    result: {
      action: "resolve",
      confidence: 0.9,
      chainRoots: ["إلغ", "قرر"],
      addConstraints: ["chain: إلغ→قرر (cancel requires confirmation)"],
    },
    priority: 10,
  },

  // ── Lost/stolen → Block + replace ──────────────────────────────────
  {
    id: "lost-block",
    condition: { root: "فقد" },
    result: {
      action: "execute",
      confidence: 0.9,
      chainRoots: ["فقد", "حظر", "بدل"],
      suggestedTool: "block_sim",
      addConstraints: ["chain: فقد→حظر→بدل (lost→block→replace)"],
    },
    priority: 10,
  },
  {
    id: "stolen-block",
    condition: { root: "سرق" },
    result: {
      action: "execute",
      confidence: 0.92,
      chainRoots: ["سرق", "حظر", "بدل"],
      suggestedTool: "block_card",
      addConstraints: ["chain: سرق→حظر→بدل (stolen→block→replace)"],
    },
    priority: 11,
  },

  // ── Sick → Medical care chain ──────────────────────────────────────
  {
    id: "sick-care",
    condition: { root: "مرض" },
    result: {
      action: "schedule",
      confidence: 0.85,
      chainRoots: ["مرض", "فحص", "علج"],
      suggestedTool: "book_appointment",
      addConstraints: ["chain: مرض→فحص→علج (illness→diagnosis→treatment)"],
    },
    priority: 9,
    domain: "healthcare",
  },

  // ── Payment required ────────────────────────────────────────────────
  {
    id: "payment-due",
    condition: { root: "دفع", tense: "imperative" },
    result: {
      action: "execute",
      confidence: 0.88,
      chainRoots: ["دفع", "حسب"],
      suggestedTool: "pay_bill",
      addConstraints: ["chain: دفع→حسب (payment requires account check)"],
    },
    priority: 8,
  },

  // ── Ask/Question → Knowledge base ──────────────────────────────────
  {
    id: "question-kb",
    condition: { intent: "ask" },
    result: {
      action: "query",
      suggestedTool: "search_kb",
      addConstraints: ["mode: informational"],
    },
    priority: 3,
  },

  // ── Learning → Study/research ──────────────────────────────────────
  {
    id: "learn-seek",
    condition: { intent: "learn", pattern: "seek" },
    result: {
      action: "query",
      addConstraints: ["mode: educational"],
    },
    priority: 4,
  },

  // ── Negation + imperative = cancel/stop ────────────────────────────
  {
    id: "negation-imperative-cancel",
    condition: { negation: true, tense: "imperative" },
    result: {
      action: "resolve",
      confidence: 0.8,
      addConstraints: ["directive: STOP/CANCEL"],
    },
    priority: 7,
  },

  // ── Request form (X) + service root → request setup ────────────────
  {
    id: "form-x-request",
    condition: { verbForm: "X" },
    result: {
      action: "request_teach",
      addConstraints: ["form: استفعل (requesting the action)"],
    },
    priority: 6,
  },

  // ── Order + delivery ────────────────────────────────────────────────
  {
    id: "order-delivery",
    condition: { root: "طلب" },
    result: {
      action: "execute",
      chainRoots: ["طلب", "دفع", "وصل"],
      addConstraints: ["chain: طلب→دفع→وصل (order→pay→deliver)"],
    },
    priority: 7,
  },

  // ── Diagnosis/check-up ─────────────────────────────────────────────
  {
    id: "diagnosis-chain",
    condition: { root: "فحص" },
    result: {
      action: "execute",
      chainRoots: ["فحص", "عرف", "علج"],
      suggestedTool: "order_lab_test",
      addConstraints: ["chain: فحص→عرف→علج (examine→know→treat)"],
    },
    priority: 8,
    domain: "healthcare",
  },

  // ── Intent defaults (priority=1, fallback only) ────────────────────
  // These guarantee every token gets a non-"process" action label during
  // training-data generation, so the model has a real target to learn.
  // They never fire at runtime (engine.reason is deliberately rule-free)
  // and are overridden by any higher-priority rule above.
  {
    id: "intent-default-do",
    condition: { intent: "do" },
    result: { action: "execute" },
    priority: 1,
  },
  {
    id: "intent-default-send",
    condition: { intent: "send" },
    result: { action: "send" },
    priority: 1,
  },
  {
    id: "intent-default-seek",
    condition: { intent: "seek" },
    result: { action: "query" },
    priority: 1,
  },
  {
    id: "intent-default-gather",
    condition: { intent: "gather" },
    result: { action: "assemble" },
    priority: 1,
  },
  {
    id: "intent-default-record",
    condition: { intent: "record" },
    result: { action: "document" },
    priority: 1,
  },
  {
    id: "intent-default-learn",
    condition: { intent: "learn" },
    result: { action: "study" },
    priority: 1,
  },
  {
    id: "intent-default-decide",
    condition: { intent: "decide" },
    result: { action: "resolve" },
    priority: 1,
  },
  {
    id: "intent-default-enable",
    condition: { intent: "enable" },
    result: { action: "create" },
    priority: 1,
  },
  {
    id: "intent-default-judge",
    condition: { intent: "judge" },
    result: { action: "evaluate" },
    priority: 1,
  },
  {
    id: "intent-default-ask",
    condition: { intent: "ask" },
    result: { action: "query" },
    priority: 1,
  },
];

// ─── Matcher ───────────────────────────────────────────────────────────────

import type { AlgebraToken } from "../core/types.js";

/**
 * Check if a token matches an implication condition.
 * All specified fields must match (AND logic).
 */
export function matchesCondition(
  token: AlgebraToken,
  condition: ImplicationCondition,
): boolean {
  if (condition.root && token.root !== condition.root) return false;
  if (condition.intent && token.intent !== condition.intent) return false;
  if (condition.pattern && token.pattern !== condition.pattern) return false;

  if (condition.modifier) {
    if (!token.modifiers.some((m) => m.startsWith(condition.modifier!)))
      return false;
  }

  if (condition.negation !== undefined) {
    const hasNeg = !!token.negation;
    if (condition.negation !== hasNeg) return false;
  }

  if (condition.verbForm) {
    if (token.verbForm !== condition.verbForm) return false;
  }

  if (condition.tense) {
    if (!token.tense || token.tense.tense !== condition.tense) return false;
  }

  return true;
}

/**
 * Find the best matching implication rule for a token.
 * Returns the highest-priority matching rule, or null.
 */
export function findImplication(
  token: AlgebraToken,
  domain?: string,
): ImplicationRule | null {
  // Sort by priority descending
  const sorted = [...IMPLICATION_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    // Skip domain-scoped rules that don't match
    if (rule.domain && domain && rule.domain !== domain) continue;

    if (matchesCondition(token, rule.condition)) {
      return rule;
    }
  }

  return null;
}

/**
 * Find ALL matching implication rules (not just the best).
 * Useful for building full reasoning chains.
 */
export function findAllImplications(
  token: AlgebraToken,
  domain?: string,
): ImplicationRule[] {
  return IMPLICATION_RULES.filter((rule) => {
    if (rule.domain && domain && rule.domain !== domain) return false;
    return matchesCondition(token, rule.condition);
  }).sort((a, b) => b.priority - a.priority);
}
