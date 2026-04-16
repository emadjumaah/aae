/**
 * Arabic Algebra Engine — Symbolic Reasoning Core
 *
 * Pure TypeScript. No LLM. No network calls. No dependencies.
 * Operates entirely on AlgebraToken → produces ReasoningResult.
 *
 * Reasoning now uses ALL algebraic dimensions:
 *   action = f(intent, pattern, verbForm, tense, negation, prepositions, ...)
 *
 * This is the lightweight brain. Fast enough to run on any device.
 */

import type {
  AlgebraToken,
  ReasoningResult,
  ActionType,
  IntentOperator,
  PatternOperator,
} from "./types.js";

import { compactToken } from "./types.js";
import { VERB_FORM_SEMANTICS, type VerbForm } from "./grammar.js";
import { ALL_ROOT_DATA } from "../data/roots.js";
import { findImplication } from "../data/implications.js";
import { relatedRoots } from "../data/relationships.js";

// ─── Rule Tables ───────────────────────────────────────────────────────────

type ActionKey = `${IntentOperator}:${PatternOperator}`;

/**
 * intent × pattern → action
 * This is the core reasoning rule table.
 * Explicit, readable, and easily extensible.
 * Coverage: 74/100 combinations (74%)
 */
const ACTION_RULES: Partial<Record<ActionKey, ActionType>> = {
  // ── seek (find / request / schedule) ──────────────────────────────────
  "seek:agent": "query", // seek + person → find who
  "seek:patient": "query", // seek + thing → look it up
  "seek:place": "schedule", // seek + place → book a room
  "seek:instance": "query", // seek + one thing → look it up
  "seek:plural": "query", // seek + many → list search
  "seek:seek": "query", // seek + requesting → deep query
  "seek:mutual": "schedule", // seek + together → set up meeting
  "seek:process": "coordinate", // seek + ongoing → find workflow
  "seek:intensifier": "query", // seek + urgent → urgent lookup
  "seek:causer": "request_teach", // seek + teacher → ask for training

  // ── do (execute / perform / act) ──────────────────────────────────────
  "do:agent": "execute", // do + person → execute as actor
  "do:patient": "create", // do + thing → produce the thing
  "do:place": "execute", // do + venue → execute at location
  "do:instance": "create", // do + single → create one item
  "do:plural": "execute", // do + many → batch execute
  "do:mutual": "coordinate", // do + together → team action
  "do:process": "coordinate", // do + ongoing → manage a process
  "do:intensifier": "execute", // do + intense → rush execute
  "do:causer": "execute", // do + make someone → delegate

  // ── send (dispatch / communicate) ─────────────────────────────────────
  "send:agent": "send", // send + person → send to someone
  "send:patient": "send", // send + thing → dispatch the thing
  "send:place": "send", // send + location → ship to place
  "send:instance": "send", // send + one → send a single message
  "send:plural": "broadcast", // send + many → broadcast to all
  "send:mutual": "broadcast", // send + together → group broadcast
  "send:process": "broadcast", // send + ongoing → newsletter/series
  "send:intensifier": "send", // send + urgent → priority send

  // ── gather (assemble / collect) ───────────────────────────────────────
  "gather:agent": "assemble", // gather + person → round up people
  "gather:patient": "assemble", // gather + thing → collect items
  "gather:place": "locate", // gather + place → find location
  "gather:instance": "assemble", // gather + one → pull together one
  "gather:plural": "assemble", // gather + many → collect all
  "gather:mutual": "assemble", // gather + together → team assembly
  "gather:process": "coordinate", // gather + ongoing → recurring meetup
  "gather:intensifier": "assemble", // gather + urgent → emergency assembly

  // ── record (store / document) ─────────────────────────────────────────
  "record:agent": "document", // record + person → note about someone
  "record:patient": "store", // record + thing → store the data
  "record:place": "store", // record + place → archive at location
  "record:instance": "document", // record + one → document single item
  "record:plural": "store", // record + many → batch archive
  "record:process": "document", // record + ongoing → log a process
  "record:intensifier": "store", // record + urgent → priority save

  // ── learn (study / research) ──────────────────────────────────────────
  "learn:agent": "study", // learn + person → study someone's work
  "learn:patient": "study", // learn + thing → study the material
  "learn:instance": "study", // learn + single → study one topic
  "learn:plural": "study", // learn + many → survey/broad study
  "learn:seek": "query", // learn + requesting → ask for info
  "learn:mutual": "coordinate", // learn + together → study group
  "learn:process": "study", // learn + ongoing → continuous learning
  "learn:causer": "request_teach", // learn + instructor → ask for teaching

  // ── decide (resolve / confirm) ────────────────────────────────────────
  "decide:agent": "evaluate", // decide + person → evaluate someone
  "decide:patient": "resolve", // decide + thing → resolve the issue
  "decide:instance": "resolve", // decide + one → resolve single item
  "decide:plural": "resolve", // decide + many → resolve batch
  "decide:mutual": "resolve", // decide + together → group decision
  "decide:process": "evaluate", // decide + ongoing → evaluate process

  // ── enable (unlock / authorize) ───────────────────────────────────────
  "enable:agent": "execute", // enable + person → grant to person
  "enable:patient": "execute", // enable + thing → activate the thing
  "enable:instance": "execute", // enable + one → enable single item
  "enable:causer": "execute", // enable + facilitator → set up access
  "enable:mutual": "coordinate", // enable + together → shared access
  "enable:process": "coordinate", // enable + ongoing → enable workflow

  // ── judge (evaluate / assess) ─────────────────────────────────────────
  "judge:agent": "evaluate", // judge + person → evaluate someone
  "judge:patient": "evaluate", // judge + thing → evaluate the thing
  "judge:instance": "evaluate", // judge + one → evaluate single item
  "judge:plural": "evaluate", // judge + many → batch evaluation
  "judge:process": "evaluate", // judge + ongoing → audit a process

  // ── ask (question / query) ────────────────────────────────────────────
  "ask:agent": "query", // ask + person → ask someone
  "ask:patient": "query", // ask + thing → ask about something
  "ask:instance": "query", // ask + one → ask a single question
  "ask:plural": "query", // ask + many → multi-question
  "ask:seek": "query", // ask + requesting → deep inquiry
  "ask:mutual": "query", // ask + together → group discussion
  "ask:process": "query", // ask + ongoing → follow-up question
};

/**
 * root → resource domain label
 * Generated from the master 820-root database.
 */
const RESOURCE_MAP: Record<string, string> = Object.fromEntries(
  ALL_ROOT_DATA.map((r) => [r.arabic, r.resource]),
);

// ─── Engine ────────────────────────────────────────────────────────────────

export class AlgebraEngine {
  reason(token: AlgebraToken): ReasoningResult {
    const key: ActionKey = `${token.intent}:${token.pattern}`;
    let actionType: ActionType = ACTION_RULES[key] ?? "process";

    // ── Verb form modifies the action ──────────────────────────────────
    // Form II (INTENSIFY/CAUSE) + root → can upgrade execute to coordinate
    // Form X (REQUEST) → can override to request_teach/query
    // Form VII (RESULT/PASSIVE) → shift toward query (checking results)
    if (token.verbForm) {
      actionType = this.applyVerbFormReasoning(
        actionType,
        token.verbForm,
        token,
      );
    }

    // ── Negation inverts or redirects action ───────────────────────────
    // "لم يكتب" (didn't write) ≠ "كتب" (wrote)
    // Negation + seek → query (asking why not)
    // Negation + do → resolve (undo / cancel / diagnose)
    if (token.negation) {
      actionType = this.applyNegationReasoning(actionType, token);
    }

    // ── Conditional creates hypothetical framing ───────────────────────
    // "إذا كتب" (if he writes) → evaluate (conditional check)
    // "لو كتب" (if only he had written) → evaluate (hypothetical)
    if (token.conditional) {
      if (token.conditional.type === "hypothetical") {
        actionType = "evaluate"; // hypothetical = evaluation/analysis
      }
    }

    // ── Relationships & implications: METADATA ONLY ────────────────────
    // These do NOT override the action. They provide annotations that:
    //   1. The training data generator can use for labeling
    //   2. The explain() function can show for debugging
    //   3. A trained model would learn to infer on its own
    // The engine should not enforce what training should discover.
    const implication = findImplication(token);
    const chainRoots = implication?.result.chainRoots;
    const suggestedTool = implication?.result.suggestedTool;

    // Real confidence scoring based on multiple signals
    const confidence = this.calculateConfidence(token, key);

    const resource = RESOURCE_MAP[token.root] ?? "general resource";

    // Build constraints from modifiers + grammatical operators
    const constraints = this.extractConstraints(token);

    const resolvedIntent = this.buildResolvedIntent(
      actionType,
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
      chainRoots,
      suggestedTool,
    };
  }

  /**
   * Verb form transforms the base action.
   * This is compositional reasoning: Form(root) → modified action.
   */
  private applyVerbFormReasoning(
    baseAction: ActionType,
    form: VerbForm,
    token: AlgebraToken,
  ): ActionType {
    const semantics = VERB_FORM_SEMANTICS[form];
    if (!semantics) return baseAction;

    switch (semantics.transform) {
      case "INTENSIFY": // Form II — intensify or cause
        // Intensified action → coordinate (managing the intensification)
        if (baseAction === "execute") return "coordinate";
        return baseAction;
      case "CAUSE": // Form IV — make someone do
        return "coordinate"; // causing others → coordination/delegation
      case "WITH": // Form III — mutual
        return baseAction === "send" ? "broadcast" : "coordinate";
      case "RECIPROCAL": // Form VI — do together
        return "coordinate";
      case "REQUEST": // Form X — seek the action
        return baseAction === "execute" ? "request_teach" : "query";
      case "RESULT": // Form VII — passive/resultative
        return "query"; // checking the result → query
      case "SELF": // Form VIII — reflexive
        return baseAction; // self-action doesn't change type
      case "BECOME_INTENSE": // Form V — become X'd
        return baseAction === "execute" ? "process" : baseAction;
      default:
        return baseAction;
    }
  }

  /**
   * Negation modifies the action: "didn't send" ≠ "sent"
   */
  private applyNegationReasoning(
    baseAction: ActionType,
    token: AlgebraToken,
  ): ActionType {
    // Negation + imperative (لا ترسل = "don't send") → resolve/cancel
    if (token.tense?.tense === "imperative") return "resolve";
    // Negation + past (لم يكتب = "didn't write") → query (investigating)
    if (token.negation?.tense === "past") return "query";
    // Negation + future (لن أكتب = "will never write") → resolve (refusing)
    if (token.negation?.tense === "future") return "resolve";
    // General negation → evaluate (assessing the absence)
    return "evaluate";
  }

  /**
   * Calculate confidence from multiple signals:
   * - Did a rule match? (intent × pattern existed in ACTION_RULES)
   * - Is the root known? (exists in resource map)
   * - Are there modifiers? (more context = more confidence)
   * - Is the root the fallback سأل? (default = low confidence)
   */
  private calculateConfidence(token: AlgebraToken, key: ActionKey): number {
    const ruleMatched = !!ACTION_RULES[key];
    const rootKnown = !!RESOURCE_MAP[token.root];
    const isFallbackRoot = token.root === "سأل" && token.rootLatin === "s-'-l";
    const hasModifiers = token.modifiers.length > 0;

    if (!ruleMatched && isFallbackRoot) return 0.25; // nothing matched
    if (!ruleMatched) return 0.4; // rule missed but root found
    if (isFallbackRoot) return 0.45; // rule matched on fallback root

    // Rule matched + real root
    let conf = 0.7;
    if (rootKnown) conf += 0.1;
    if (hasModifiers)
      conf += 0.05 + Math.min(token.modifiers.length * 0.03, 0.1);

    // Grammatical operators add confidence (more structure = more understanding)
    if (token.verbForm) conf += 0.03;
    if (token.tense && token.tense.tense !== "present") conf += 0.02;
    if (token.negation) conf += 0.02;
    if (token.prepositions && token.prepositions.length > 0) conf += 0.02;
    if (token.pronouns && token.pronouns.length > 0) conf += 0.02;

    return Math.min(conf, 0.95);
  }

  private extractConstraints(token: AlgebraToken): string[] {
    const constraints: string[] = [];

    // Legacy modifiers
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

    // Verb form → transformation constraint
    if (token.verbForm) {
      const sem = VERB_FORM_SEMANTICS[token.verbForm];
      if (sem) constraints.push(`form → ${sem.transform}(${token.root})`);
    }

    // Tense
    if (token.tense && token.tense.tense !== "present") {
      constraints.push(`tense → ${token.tense.tense}`);
    }

    // Negation → polarity constraint
    if (token.negation) {
      constraints.push(`polarity → NOT(${token.negation.tense})`);
    }

    // Prepositions → relational constraints
    if (token.prepositions) {
      for (const pp of token.prepositions) {
        constraints.push(`${pp.prep} → ${pp.object}`);
      }
    }

    // Pronouns → entity constraints
    if (token.pronouns) {
      for (const pr of token.pronouns) {
        constraints.push(`${pr.role} → ${pr.person}`);
      }
    }

    // Conditional
    if (token.conditional) {
      constraints.push(`condition → ${token.conditional.type}`);
    }

    // Emphasis
    if (token.emphasis && token.emphasis.level !== "none") {
      constraints.push(`emphasis → ${token.emphasis.level}`);
    }

    return constraints;
  }

  private buildResolvedIntent(
    action: ActionType,
    resource: string,
    constraints: string[],
    token?: AlgebraToken,
  ): string {
    let base = `perform [${action}] on [${resource}]`;

    // Negation wraps the whole intent
    if (token?.negation) {
      base = `NOT(${token.negation.tense}): ${base}`;
    }

    // Conditional wraps
    if (token?.conditional) {
      base = `IF(${token.conditional.type}): ${base}`;
    }

    if (constraints.length === 0) return base;
    return `${base} with: ${constraints.join(", ")}`;
  }

  /**
   * Explain the reasoning step by step.
   * Useful for debugging and transparency.
   */
  explain(token: AlgebraToken): string {
    const result = this.reason(token);
    const key: ActionKey = `${token.intent}:${token.pattern}`;
    const ruleMatched = !!ACTION_RULES[key];

    const lines = [
      `Algebra      : ${compactToken(token)}`,
      `Rule         : ${token.intent} × ${token.pattern} → ${result.actionType} ${ruleMatched ? "(matched)" : "(fallback)"}`,
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
      `Resolved     : ${result.resolvedIntent}`,
      `Confidence   : ${(result.confidence * 100).toFixed(0)}%`,
    );

    if (result.chainRoots) {
      lines.push(`Chain        : ${result.chainRoots.join(" → ")}`);
    }
    if (result.suggestedTool) {
      lines.push(`Suggested    : ${result.suggestedTool}`);
    }

    return lines.join("\n");
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────
export const engine = new AlgebraEngine();
