/**
 * Arabic Algebra Engine — CST Bridge
 *
 * Converts an AlgebraToken + ReasoningResult into a CST-style token
 * sequence matching the schema defined in
 * ``cst-poc/docs/two-level-tokenization.md``:
 *
 *   ROOT:<field>   REL:<type>   CMP:<role>   STR:<marker>   LIT:<value>
 *
 * This bridge is what lets the algebra engine contribute data to the
 * CST reasoning-model pipeline without either side adopting the other's
 * internal token format.
 *
 * The mapping is deliberately lossy — it produces the **reasoning-level**
 * CST view (no FEAT:*, no inflection detail), which is exactly what the
 * reasoning tokenizer T_R^ar would emit for the same sentence.
 */

import type { AlgebraToken, ReasoningResult } from "./types.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── Semantic-field derivation ────────────────────────────────────────────

/**
 * The `RootData.resource` label (e.g. "document / record") is the closest
 * proxy to the CST "semantic field". We normalize it to a single-word
 * lowercase token so it fits the `ROOT:<field>` shape.
 */
function deriveField(arabicRoot: string): string {
  const rd = ALL_ROOT_DATA.find((r) => r.arabic === arabicRoot);
  if (!rd) return arabicRoot; // fallback: literal root as field
  // Take the first word of the resource label.
  const first = rd.resource.split(/[\s/]+/)[0].trim();
  return first.toLowerCase() || arabicRoot;
}

// ─── Pattern → CMP role ──────────────────────────────────────────────────

const PATTERN_TO_CMP_ROLE: Record<string, string> = {
  agent: "agent",
  patient: "patient",
  place: "place",
  instance: "instance",
  plural: "group",
  seek: "request",
  mutual: "reciprocal",
  process: "process",
  intensifier: "intensive",
  causer: "causer",
};

// ─── Intent → REL / STR marker ───────────────────────────────────────────
//
// Most intents map into an implicit relation on the root (seek → REL:for,
// ask → STR:question, etc.). We only emit markers where the intent
// carries truth-conditional information the reasoning level cares about.

const INTENT_TO_MARKER: Record<string, string> = {
  ask: "STR:question",
  // Other intents are encoded via the CMP role / context; we don't emit
  // an extra REL for "do", "send", etc. to keep the sequence coarse.
};

// ─── Negation / conditional / tense markers ──────────────────────────────

function negationToken(neg: AlgebraToken["negation"]): string | null {
  if (!neg) return null;
  return "REL:neg";
}

function conditionalToken(cond: AlgebraToken["conditional"]): string | null {
  if (!cond) return null;
  return "STR:conditional";
}

function tenseToken(tense: AlgebraToken["tense"]): string | null {
  if (!tense) return null;
  if (tense.tense === "future") return "STR:future";
  if (tense.tense === "past") return "STR:past";
  return null;
}

function emphasisToken(emph: AlgebraToken["emphasis"]): string | null {
  // Reasoning level deliberately drops emphasis — see
  // cst-poc/reasoning/tokenizer/projection.py._AR_REMAP.
  void emph;
  return null;
}

// ─── Conjunctions → REL:* ────────────────────────────────────────────────

function conjunctionToken(conj: string): string {
  // Normalise a small set; anything else → REL:and.
  const table: Record<string, string> = {
    and: "REL:and",
    or: "REL:or",
    but: "REL:contrast",
    then: "REL:then",
    because: "REL:cause",
  };
  return table[conj.toLowerCase()] ?? "REL:and";
}

// ─── Preposition → REL:* ─────────────────────────────────────────────────

function prepositionToken(prep: string): string {
  const table: Record<string, string> = {
    in: "REL:in",
    on: "REL:on",
    with: "REL:with",
    for: "REL:for",
    by: "REL:by",
    from: "REL:from",
    to: "REL:to",
    about: "REL:about",
  };
  return table[prep.toLowerCase()] ?? `REL:${prep.toLowerCase()}`;
}

// ─── Modifier → LIT:* / REL:time ─────────────────────────────────────────

function modifierToken(mod: string): string {
  // Modifiers arrive as "key:value" or bare value.
  const idx = mod.indexOf(":");
  if (idx === -1) return `LIT:${mod}`;
  const key = mod.slice(0, idx);
  const value = mod.slice(idx + 1);
  if (key === "time") return `LIT:time:${value}`;
  if (key === "urgency") return `LIT:urgency:${value}`;
  return `LIT:${value}`;
}

// ─── Main bridge ─────────────────────────────────────────────────────────

export interface CSTSequence {
  /** Reasoning-level CST tokens for this algebra token */
  tokens: string[];
  /** Semantic field derived from the root */
  field: string;
  /** CMP role derived from the pattern */
  role: string | null;
}

/**
 * Convert an AlgebraToken + optional ReasoningResult into a coarse
 * reasoning-level CST token sequence.
 */
export function toCST(
  token: AlgebraToken,
  _reasoning?: ReasoningResult,
): CSTSequence {
  const out: string[] = ["[BOS]"];

  // 1. Sentence-level markers (come first)
  const tenseTok = tenseToken(token.tense);
  if (tenseTok) out.push(tenseTok);

  const condTok = conditionalToken(token.conditional);
  if (condTok) out.push(condTok);

  const intentMarker = INTENT_TO_MARKER[token.intent];
  if (intentMarker) out.push(intentMarker);

  // 2. Negation before the core token
  const negTok = negationToken(token.negation);
  if (negTok) out.push(negTok);

  // 3. Conjunctions (collected from the token, if any)
  for (const c of token.conjunctions ?? []) {
    out.push(conjunctionToken(c.type ?? "and"));
  }

  // 4. Prepositions → REL:*
  for (const p of token.prepositions ?? []) {
    out.push(prepositionToken(p.prep));
  }

  // 5. Core token: CMP if the pattern gives a role, else ROOT
  const field = deriveField(token.root);
  const role = PATTERN_TO_CMP_ROLE[token.pattern] ?? null;
  if (role) {
    out.push(`CMP:${field}:${role}`);
  } else {
    out.push(`ROOT:${field}`);
  }

  // 6. Modifiers → LIT:*
  for (const mod of token.modifiers ?? []) {
    out.push(modifierToken(mod));
  }

  // 7. Emphasis (currently dropped at reasoning level)
  const emTok = emphasisToken(token.emphasis);
  if (emTok) out.push(emTok);

  out.push("[EOS]");

  return { tokens: out, field, role };
}
