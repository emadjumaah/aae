/**
 * Arabic Algebra Engine — Honest Encoder/Decoder Core
 *
 * Pure TypeScript. No LLM. No network calls. No dependencies.
 * Operates entirely on AlgebraToken → produces ReasoningResult.
 *
 * STRIPPED DOWN: No hardcoded rules. No action overrides.
 * The engine OBSERVES and DESCRIBES the token — it does NOT decide.
 * Action selection is the model's job, not ours.
 *
 * What this engine does:
 *   1. Look up the resource domain from the root
 *   2. Extract constraints from all grammatical dimensions
 *   3. Build a human-readable description of what was encoded
 *   4. Calculate confidence on how well the INPUT was parsed
 *
 * What this engine does NOT do:
 *   - Map intent×pattern → action (that's 74 fake rules removed)
 *   - Override action based on verb form (that's model's job)
 *   - Override action based on negation (that's model's job)
 *   - Force conditionals to "evaluate" (that's model's job)
 */

import type { AlgebraToken, ReasoningResult, ActionType } from "./types.js";

import { compactToken } from "./types.js";
import { VERB_FORM_SEMANTICS } from "./grammar.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

/**
 * root → resource domain label
 * Generated from the master 820-root database.
 * This is legitimate: it's a dictionary lookup, not a reasoning rule.
 */
const RESOURCE_MAP: Record<string, string> = Object.fromEntries(
  ALL_ROOT_DATA.map((r) => [r.arabic, r.resource]),
);

// ─── Engine ────────────────────────────────────────────────────────────────

export class AlgebraEngine {
  /**
   * Observe a token and describe what's there.
   * Returns "process" as actionType — this is a placeholder.
   * A trained model should produce the real action.
   */
  reason(token: AlgebraToken): ReasoningResult {
    // No rules. No overrides. The action is for the model to decide.
    const actionType: ActionType = "process";

    const confidence = this.calculateConfidence(token);
    const resource = RESOURCE_MAP[token.root] ?? "general resource";
    const constraints = this.extractConstraints(token);
    const resolvedIntent = this.buildResolvedIntent(
      resource,
      constraints,
      token,
    );

    return {
      token,
      actionType,
      resource,
      constraints,
      resolvedIntent,
      confidence,
    };
  }

  /**
   * Confidence = how well did we PARSE the input?
   * Not how well did we reason. We don't reason. The model does.
   *
   * Signals:
   * - Is the root known? (exists in resource map)
   * - Is the root the fallback سأل? (encoder couldn't find real root)
   * - Are there modifiers? (richer parse = more confident)
   * - Are there grammatical operators? (more structure found)
   */
  private calculateConfidence(token: AlgebraToken): number {
    const rootKnown = !!RESOURCE_MAP[token.root];
    const isFallbackRoot = token.root === "سأل" && token.rootLatin === "s-'-l";

    if (isFallbackRoot) return 0.25; // encoder couldn't find real root

    let conf = 0.4; // base: we at least got something
    if (rootKnown) conf += 0.2;
    if (token.modifiers.length > 0)
      conf += 0.05 + Math.min(token.modifiers.length * 0.03, 0.1);

    // Grammatical operators = richer parse = more confidence in the encoding
    if (token.verbForm) conf += 0.03;
    if (token.tense && token.tense.tense !== "present") conf += 0.02;
    if (token.negation) conf += 0.02;
    if (token.prepositions && token.prepositions.length > 0) conf += 0.02;
    if (token.pronouns && token.pronouns.length > 0) conf += 0.02;

    return Math.min(conf, 0.95);
  }

  /**
   * Extract observable constraints from the token's dimensions.
   * Pure observation — no interpretation, no overrides.
   */
  private extractConstraints(token: AlgebraToken): string[] {
    const constraints: string[] = [];

    for (const mod of token.modifiers) {
      const colonIdx = mod.indexOf(":");
      if (colonIdx !== -1) {
        const k = mod.slice(0, colonIdx);
        const v = mod.slice(colonIdx + 1);
        constraints.push(`${k} → ${v}`);
      } else {
        constraints.push(mod);
      }
    }

    if (token.verbForm) {
      const sem = VERB_FORM_SEMANTICS[token.verbForm];
      if (sem) constraints.push(`form → ${sem.transform}(${token.root})`);
    }

    if (token.tense && token.tense.tense !== "present") {
      constraints.push(`tense → ${token.tense.tense}`);
    }

    if (token.negation) {
      constraints.push(`polarity → NOT(${token.negation.tense})`);
    }

    if (token.prepositions) {
      for (const pp of token.prepositions) {
        constraints.push(`${pp.prep} → ${pp.object}`);
      }
    }

    if (token.pronouns) {
      for (const pr of token.pronouns) {
        constraints.push(`${pr.role} → ${pr.person}`);
      }
    }

    if (token.conditional) {
      constraints.push(`condition → ${token.conditional.type}`);
    }

    if (token.emphasis && token.emphasis.level !== "none") {
      constraints.push(`emphasis → ${token.emphasis.level}`);
    }

    return constraints;
  }

  private buildResolvedIntent(
    resource: string,
    constraints: string[],
    token?: AlgebraToken,
  ): string {
    let base = `[${token?.intent}:${token?.pattern}] on [${resource}]`;

    if (token?.negation) {
      base = `NOT(${token.negation.tense}): ${base}`;
    }

    if (token?.conditional) {
      base = `IF(${token.conditional.type}): ${base}`;
    }

    if (constraints.length === 0) return base;
    return `${base} with: ${constraints.join(", ")}`;
  }

  /**
   * Explain what was encoded — no reasoning claims.
   */
  explain(token: AlgebraToken): string {
    const result = this.reason(token);

    const lines = [
      `Algebra      : ${compactToken(token)}`,
      `Dimensions   : intent=${token.intent}, pattern=${token.pattern}, root=${token.root}`,
    ];

    if (token.verbForm) {
      const sem = VERB_FORM_SEMANTICS[token.verbForm];
      lines.push(
        `Verb Form    : ${token.verbForm} ${sem ? `= ${sem.transform}(root)` : ""}`,
      );
    }
    if (token.tense) {
      lines.push(`Tense        : ${token.tense.tense} (${token.tense.signal})`);
    }
    if (token.negation) {
      lines.push(
        `Negation     : ${token.negation.particle} → NOT(${token.negation.tense})`,
      );
    }
    if (token.prepositions && token.prepositions.length > 0) {
      lines.push(
        `Prepositions : ${token.prepositions.map((p) => `${p.particle}(${p.prep}) → ${p.object}`).join(", ")}`,
      );
    }
    if (token.pronouns && token.pronouns.length > 0) {
      lines.push(
        `Pronouns     : ${token.pronouns.map((p) => `${p.surface}(${p.person}:${p.role})`).join(", ")}`,
      );
    }
    if (token.conditional) {
      lines.push(
        `Conditional  : ${token.conditional.particle} → ${token.conditional.type}`,
      );
    }
    if (token.emphasis && token.emphasis.level !== "none") {
      lines.push(
        `Emphasis     : ${token.emphasis.particle} → ${token.emphasis.level}`,
      );
    }

    lines.push(
      `Resource     : ${result.resource}`,
      `Constraints  : ${result.constraints.length ? result.constraints.join(", ") : "none"}`,
      `Description  : ${result.resolvedIntent}`,
      `Parse Conf.  : ${(result.confidence * 100).toFixed(0)}%`,
    );

    return lines.join("\n");
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────
export const engine = new AlgebraEngine();
