/**
 * Arabic Algebra — Token Serializer
 *
 * Converts between AlgebraToken ↔ vocabulary token sequences.
 * This is the bridge between the existing engine and the reasoning model.
 *
 * Input serialization:  AlgebraToken → string[] → number[]
 * Output deserialization: number[] → string[] → AlgebraToken
 */

import type {
  AlgebraToken,
  ReasoningResult,
  ActionType,
  IntentOperator,
  PatternOperator,
} from "../engine/core/types.js";
import { getVocabulary, type AlgebraVocabulary } from "./vocabulary.js";

// ─── Modifier Parsing ──────────────────────────────────────────────────────

interface ParsedModifier {
  key: string;
  value: string;
}

function parseModifier(mod: string): ParsedModifier {
  const idx = mod.indexOf(":");
  if (idx === -1) return { key: "topic", value: mod };
  return { key: mod.slice(0, idx), value: mod.slice(idx + 1) };
}

// ─── Time Value Normalization ──────────────────────────────────────────────

const TIME_NORMALIZATIONS: Record<string, string> = {
  tomorrow: "tomorrow",
  today: "today",
  tonight: "tonight",
  yesterday: "yesterday",
  now: "now",
  asap: "asap",
  soon: "soon",
  later: "later",
  "this week": "this_week",
  "next week": "next_week",
  "last week": "last_week",
  "this month": "this_month",
  "next month": "next_month",
  "last month": "last_month",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
};

function normalizeTimeValue(value: string): string {
  const lower = value.toLowerCase().trim();
  return TIME_NORMALIZATIONS[lower] ?? lower;
}

// ─── Serializer ────────────────────────────────────────────────────────────

export interface SerializedTokens {
  /** Human-readable token strings */
  tokens: string[];
  /** Numeric IDs for model input */
  ids: number[];
}

/**
 * Serialize an AlgebraToken into a sequence of vocabulary tokens.
 *
 * Format: <BOS> I:<intent> R:<root> RL:<latin> P:<pattern>
 *         [VF:<form>] [T:<tense>] [NEG:<tense>]
 *         [PREP:<prep>]... [CONJ:<conj>]... [COND:<type>] [EMPH:<level>]
 *         [PRON:<role>:<person>]...
 *         [MK:key MV:key:val | LIT:val]...
 *         <EOS>
 */
export function serializeInput(token: AlgebraToken): SerializedTokens {
  const vocab = getVocabulary();
  const tokens: string[] = [];

  tokens.push("<BOS>");
  tokens.push(`I:${token.intent}`);
  tokens.push(`R:${token.root}`);
  tokens.push(`RL:${token.rootLatin}`);
  tokens.push(`P:${token.pattern}`);

  // ── Grammatical dimensions ──────────────────────────────────────────
  if (token.verbForm) {
    const vfToken = `VF:${token.verbForm}`;
    if (vocab.has(vfToken)) tokens.push(vfToken);
  }

  if (token.tense && token.tense.tense !== "present") {
    const tToken = `T:${token.tense.tense}`;
    if (vocab.has(tToken)) tokens.push(tToken);
  }

  if (token.negation) {
    const negToken = `NEG:${token.negation.tense}`;
    if (vocab.has(negToken)) tokens.push(negToken);
  }

  if (token.prepositions) {
    for (const pp of token.prepositions) {
      const prepToken = `PREP:${pp.prep}`;
      if (vocab.has(prepToken)) tokens.push(prepToken);
    }
  }

  if (token.conjunctions) {
    for (const cj of token.conjunctions) {
      const conjToken = `CONJ:${cj.type}`;
      if (vocab.has(conjToken)) tokens.push(conjToken);
    }
  }

  if (token.conditional) {
    const condToken = `COND:${token.conditional.type}`;
    if (vocab.has(condToken)) tokens.push(condToken);
  }

  if (token.emphasis && token.emphasis.level !== "none") {
    const emphToken = `EMPH:${token.emphasis.level}`;
    if (vocab.has(emphToken)) tokens.push(emphToken);
  }

  if (token.pronouns) {
    for (const pr of token.pronouns) {
      const pronToken = `PRON:${pr.role}:${pr.person}`;
      if (vocab.has(pronToken)) tokens.push(pronToken);
    }
  }

  // ── Modifiers ───────────────────────────────────────────────────────
  for (const mod of token.modifiers) {
    const { key, value } = parseModifier(mod);
    const mkToken = `MK:${key}`;

    if (vocab.has(mkToken)) {
      tokens.push(mkToken);

      // Only emit structured values for time/urgency;
      // topic/target/content/location are redundant with the root — just the MK: key
      if (key === "time") {
        const normalized = normalizeTimeValue(value);
        const mvToken = `MV:time:${normalized}`;
        if (vocab.has(mvToken)) {
          tokens.push(mvToken);
        } else {
          tokens.push(`LIT:${value}`);
        }
      } else if (key === "urgency") {
        const mvToken = `MV:urgency:${value.toLowerCase()}`;
        if (vocab.has(mvToken)) {
          tokens.push(mvToken);
        } else {
          tokens.push(`LIT:${value}`);
        }
      }
      // else: topic/target/content/location — MK: key alone is sufficient
    }
  }

  tokens.push("<EOS>");

  // Register any new literals and convert to IDs
  const ids = tokens.map((t) => {
    if (t.startsWith("LIT:")) {
      return vocab.addLiteral(t.slice(4));
    }
    return vocab.encode(t);
  });

  return { tokens, ids };
}

/**
 * Serialize a ReasoningResult (output side) into vocabulary tokens.
 *
 * Format: <BOS> ACT:<action> R:<root> D:<domain> [MK:key MV/LIT:val]... CONF:<level> <EOS>
 */
export function serializeOutput(
  result: ReasoningResult,
  domain: string,
): SerializedTokens {
  const vocab = getVocabulary();
  const tokens: string[] = [];

  tokens.push("<BOS>");
  tokens.push(`ACT:${result.actionType}`);
  tokens.push(`R:${result.token.root}`);
  tokens.push(`D:${domain}`);

  // Serialize constraints as modifiers
  for (const mod of result.token.modifiers) {
    const { key, value } = parseModifier(mod);
    const mkToken = `MK:${key}`;

    if (vocab.has(mkToken)) {
      tokens.push(mkToken);
      // Only emit values for time/urgency; topic/target/content are redundant with root
      if (key === "time") {
        const normalized = normalizeTimeValue(value);
        const mvToken = `MV:time:${normalized}`;
        tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
      } else if (key === "urgency") {
        const mvToken = `MV:urgency:${value.toLowerCase()}`;
        tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
      }
    }
  }

  // Chain roots from implication reasoning (the reasoning trace)
  if (result.chainRoots && result.chainRoots.length > 0) {
    tokens.push("CHAIN:start");
    for (const cr of result.chainRoots) {
      tokens.push(`R:${cr}`);
      tokens.push("CHAIN:arrow");
    }
    // Replace trailing arrow with end marker
    tokens.pop();
    tokens.push("CHAIN:end");
  }

  // Suggested tool from implication
  if (result.suggestedTool) {
    const toolToken = `TOOL:${result.suggestedTool}`;
    if (vocab.has(toolToken)) {
      tokens.push(toolToken);
    } else {
      vocab.addTool(result.suggestedTool);
      tokens.push(toolToken);
    }
  }

  // Confidence
  const confLevel =
    result.confidence >= 0.8
      ? "high"
      : result.confidence >= 0.5
        ? "medium"
        : "low";
  tokens.push(`CONF:${confLevel}`);
  tokens.push("<EOS>");

  const ids = tokens.map((t) => {
    if (t.startsWith("LIT:")) return vocab.addLiteral(t.slice(4));
    return vocab.encode(t);
  });

  return { tokens, ids };
}

/**
 * Deserialize a token sequence back into an AlgebraToken.
 * Used when reading model output.
 */
export function deserializeToToken(tokens: string[]): AlgebraToken | null {
  let intent: IntentOperator | null = null;
  let root: string | null = null;
  let rootLatin: string | null = null;
  let pattern: PatternOperator | null = null;
  const modifiers: string[] = [];

  let currentModKey: string | null = null;

  for (const t of tokens) {
    if (t === "<BOS>" || t === "<EOS>" || t === "<PAD>") continue;

    if (t.startsWith("I:")) {
      intent = t.slice(2) as IntentOperator;
    } else if (t.startsWith("R:")) {
      root = t.slice(2);
    } else if (t.startsWith("RL:")) {
      rootLatin = t.slice(3);
    } else if (t.startsWith("P:")) {
      pattern = t.slice(2) as PatternOperator;
    } else if (t.startsWith("MK:")) {
      currentModKey = t.slice(3);
    } else if (t.startsWith("MV:")) {
      // MV:time:tomorrow → key=time, value=tomorrow
      const parts = t.slice(3).split(":");
      if (parts.length >= 2) {
        modifiers.push(`${parts[0]}:${parts.slice(1).join(":")}`);
        currentModKey = null;
      }
    } else if (t.startsWith("LIT:")) {
      const val = t.slice(4);
      if (currentModKey) {
        modifiers.push(`${currentModKey}:${val}`);
        currentModKey = null;
      }
    } else if (
      t.startsWith("ACT:") ||
      t.startsWith("D:") ||
      t.startsWith("CONF:")
    ) {
      // Output-side tokens — skip during AlgebraToken reconstruction
      continue;
    }
  }

  if (!intent || !root || !rootLatin || !pattern) return null;

  return { intent, root, rootLatin, pattern, modifiers };
}

/**
 * Deserialize output tokens to extract action type and confidence.
 */
export function deserializeOutput(tokens: string[]): {
  actionType: ActionType | null;
  domain: string | null;
  confidence: number;
  token: AlgebraToken | null;
} {
  let actionType: ActionType | null = null;
  let domain: string | null = null;
  let confidence = 0.5;

  for (const t of tokens) {
    if (t.startsWith("ACT:")) actionType = t.slice(4) as ActionType;
    else if (t.startsWith("D:")) domain = t.slice(2);
    else if (t.startsWith("CONF:")) {
      const level = t.slice(5);
      confidence = level === "high" ? 0.9 : level === "medium" ? 0.7 : 0.3;
    }
  }

  return { actionType, domain, confidence, token: deserializeToToken(tokens) };
}

/**
 * Convert numeric IDs back to token strings.
 */
export function idsToTokens(ids: number[]): string[] {
  const vocab = getVocabulary();
  return ids.map((id) => vocab.decode(id));
}

// ─── Agent-aware Serialization ─────────────────────────────────────────────

/**
 * Serialize an agent output with tool routing and next-step prediction.
 *
 * Format: <BOS> ACT:<action> R:<root> D:<domain> TOOL:<id> [TOOL:<id2>]
 *         [MK:key MV/LIT:val]... NEXT:<step> CONF:<level> <EOS>
 */
export function serializeAgentOutput(output: {
  action: string;
  root: string;
  domain: string;
  tools: string[];
  nextStep: string;
  confidence: string;
  modifiers?: string[];
}): SerializedTokens {
  const vocab = getVocabulary();
  const tokens: string[] = [];

  tokens.push("<BOS>");
  tokens.push(`ACT:${output.action}`);
  tokens.push(`R:${output.root}`);
  tokens.push(`D:${output.domain}`);

  // Tool tokens
  for (const tool of output.tools) {
    tokens.push(`TOOL:${tool}`);
  }

  // Modifiers — only emit values for time/urgency; others just MK: key
  if (output.modifiers) {
    for (const mod of output.modifiers) {
      const idx = mod.indexOf(":");
      if (idx === -1) continue;
      const key = mod.slice(0, idx);
      const value = mod.slice(idx + 1);
      const mkToken = `MK:${key}`;
      if (vocab.has(mkToken)) {
        tokens.push(mkToken);
        if (key === "time") {
          const normalized = normalizeTimeValue(value);
          const mvToken = `MV:time:${normalized}`;
          tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
        } else if (key === "urgency") {
          const mvToken = `MV:urgency:${value.toLowerCase()}`;
          tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
        }
      }
    }
  }

  tokens.push(`NEXT:${output.nextStep}`);
  tokens.push(`CONF:${output.confidence}`);
  tokens.push("<EOS>");

  const ids = tokens.map((t) => {
    if (t.startsWith("LIT:")) return vocab.addLiteral(t.slice(4));
    if (t.startsWith("TOOL:")) return vocab.addTool(t.slice(5));
    return vocab.encode(t);
  });

  return { tokens, ids };
}

/**
 * Serialize a multi-step chain output with STEP/REASON tokens.
 *
 * Format: <BOS> ACT:<action> R:<root> D:<domain>
 *         STEP:1 TOOL:<id> REASON:<cat> [STEP:2 TOOL:<id2> REASON:<cat>]...
 *         NEXT:<step> CONF:<level> <EOS>
 */
export function serializeChainOutput(output: {
  action: string;
  root: string;
  domain: string;
  steps: Array<{ tool: string; reason: string }>;
  nextStep: string;
  confidence: string;
  modifiers?: string[];
}): SerializedTokens {
  const vocab = getVocabulary();
  const tokens: string[] = [];

  tokens.push("<BOS>");
  tokens.push(`ACT:${output.action}`);
  tokens.push(`R:${output.root}`);
  tokens.push(`D:${output.domain}`);

  // Chain steps
  for (let i = 0; i < output.steps.length; i++) {
    tokens.push(`STEP:${i + 1}`);
    tokens.push(`TOOL:${output.steps[i].tool}`);
    tokens.push(`REASON:${output.steps[i].reason}`);
  }

  // Modifiers — only emit values for time/urgency; others just MK: key
  if (output.modifiers) {
    for (const mod of output.modifiers) {
      const idx = mod.indexOf(":");
      if (idx === -1) continue;
      const key = mod.slice(0, idx);
      const value = mod.slice(idx + 1);
      const mkToken = `MK:${key}`;
      if (vocab.has(mkToken)) {
        tokens.push(mkToken);
        if (key === "time") {
          const normalized = normalizeTimeValue(value);
          const mvToken = `MV:time:${normalized}`;
          tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
        } else if (key === "urgency") {
          const mvToken = `MV:urgency:${value.toLowerCase()}`;
          tokens.push(vocab.has(mvToken) ? mvToken : `LIT:${value}`);
        }
      }
    }
  }

  tokens.push(`NEXT:${output.nextStep}`);
  tokens.push(`CONF:${output.confidence}`);
  tokens.push("<EOS>");

  const ids = tokens.map((t) => {
    if (t.startsWith("LIT:")) return vocab.addLiteral(t.slice(4));
    if (t.startsWith("TOOL:")) return vocab.addTool(t.slice(5));
    return vocab.encode(t);
  });

  return { tokens, ids };
}

/**
 * Deserialize agent output tokens → structured result.
 */
export function deserializeAgentOutput(tokens: string[]): {
  action: string | null;
  root: string | null;
  domain: string | null;
  tools: string[];
  nextStep: string | null;
  confidence: string;
  modifiers: string[];
} {
  let action: string | null = null;
  let root: string | null = null;
  let domain: string | null = null;
  let nextStep: string | null = null;
  let confidence = "medium";
  const tools: string[] = [];
  const modifiers: string[] = [];
  let currentModKey: string | null = null;

  for (const t of tokens) {
    if (t === "<BOS>" || t === "<EOS>" || t === "<PAD>") continue;
    if (t.startsWith("ACT:")) action = t.slice(4);
    else if (
      t.startsWith("R:") &&
      !t.startsWith("RL:") &&
      !t.startsWith("REL:")
    )
      root = t.slice(2);
    else if (t.startsWith("D:")) domain = t.slice(2);
    else if (t.startsWith("TOOL:")) tools.push(t.slice(5));
    else if (t.startsWith("NEXT:")) nextStep = t.slice(5);
    else if (t.startsWith("CONF:")) confidence = t.slice(5);
    else if (t.startsWith("MK:")) currentModKey = t.slice(3);
    else if (t.startsWith("MV:")) {
      const parts = t.slice(3).split(":");
      if (parts.length >= 2)
        modifiers.push(`${parts[0]}:${parts.slice(1).join(":")}`);
      currentModKey = null;
    } else if (t.startsWith("LIT:")) {
      if (currentModKey) {
        modifiers.push(`${currentModKey}:${t.slice(4)}`);
        currentModKey = null;
      }
    }
  }

  return { action, root, domain, tools, nextStep, confidence, modifiers };
}
