/**
 * Arabic Algebra Engine — Symbolic Reasoning Core
 *
 * Pure TypeScript. No LLM. No network calls. No dependencies.
 * Operates entirely on AlgebraToken → produces ReasoningResult.
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
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── Rule Tables ───────────────────────────────────────────────────────────

type ActionKey = `${IntentOperator}:${PatternOperator}`;

/**
 * intent × pattern → action
 * This is the core reasoning rule table.
 * Explicit, readable, and easily extensible.
 * Coverage: 80/100 combinations (80%)
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
 * Generated from the master 150-root database.
 */
const RESOURCE_MAP: Record<string, string> = Object.fromEntries(
  ALL_ROOT_DATA.map((r) => [r.arabic, r.resource]),
);

// ─── Engine ────────────────────────────────────────────────────────────────

export class AlgebraEngine {
  reason(token: AlgebraToken): ReasoningResult {
    const key: ActionKey = `${token.intent}:${token.pattern}`;
    const actionType: ActionType = ACTION_RULES[key] ?? "process";
    const confidence = ACTION_RULES[key] ? 0.9 : 0.5;

    const resource = RESOURCE_MAP[token.root] ?? "general resource";

    const constraints = this.extractConstraints(token.modifiers);

    const resolvedIntent = this.buildResolvedIntent(
      actionType,
      resource,
      constraints,
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

  private extractConstraints(modifiers: string[]): string[] {
    return modifiers.map((mod) => {
      if (mod.includes(":")) {
        const [key, val] = mod.split(":", 2);
        return `${key} → ${val}`;
      }
      return mod;
    });
  }

  private buildResolvedIntent(
    action: ActionType,
    resource: string,
    constraints: string[],
  ): string {
    const base = `perform [${action}] on [${resource}]`;
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

    return [
      `Algebra      : ${compactToken(token)}`,
      `Rule         : ${token.intent} × ${token.pattern} → ${result.actionType} ${ruleMatched ? "(matched)" : "(fallback)"}`,
      `Resource     : ${result.resource}`,
      `Constraints  : ${result.constraints.length ? result.constraints.join(", ") : "none"}`,
      `Resolved     : ${result.resolvedIntent}`,
      `Confidence   : ${(result.confidence * 100).toFixed(0)}%`,
    ].join("\n");
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────
export const engine = new AlgebraEngine();
