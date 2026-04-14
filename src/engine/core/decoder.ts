/**
 * Arabic Algebra Engine — Template-Based Decoder
 *
 * Pure TypeScript. No LLM. No network. No dependencies.
 * Converts ReasoningResult → natural language using templates.
 *
 * This replaces the LLM decode() call entirely.
 */

import type { ReasoningResult, ActionType } from "./types.js";

// ─── Response Templates ───────────────────────────────────────────────────
// Each action type has a set of templates. Slots are filled from the result.

interface ResponseTemplate {
  /** Main confirmation sentence */
  confirm: string;
  /** Follow-up question if info is missing */
  followUp: string;
}

const TEMPLATES: Record<ActionType, ResponseTemplate> = {
  schedule: {
    confirm: "I'll schedule {resource} {constraints}.",
    followUp: "What time works best?",
  },
  send: {
    confirm: "I'll send {resource} {constraints}.",
    followUp: "Do you want to add any notes before sending?",
  },
  broadcast: {
    confirm: "I'll broadcast {resource} {constraints}.",
    followUp: "Should this go via email or the announcement channel?",
  },
  assemble: {
    confirm: "I'll assemble {resource} {constraints}.",
    followUp: "What time works best?",
  },
  locate: {
    confirm: "I'll find {resource} {constraints}.",
    followUp: "Do you have a preferred location?",
  },
  store: {
    confirm: "I'll store {resource} {constraints}.",
    followUp: "Would you like me to organize it by topic?",
  },
  document: {
    confirm: "I'll prepare {resource} {constraints}.",
    followUp: "What format do you prefer?",
  },
  query: {
    confirm: "I'll look up {resource} {constraints}.",
    followUp: "Can you narrow down what specifically you need?",
  },
  execute: {
    confirm: "I'll execute {resource} {constraints}.",
    followUp: "Should I proceed immediately?",
  },
  create: {
    confirm: "I'll create {resource} {constraints}.",
    followUp: "Any specific requirements?",
  },
  coordinate: {
    confirm: "I'll coordinate {resource} {constraints}.",
    followUp: "Who should be involved?",
  },
  study: {
    confirm: "I'll analyze {resource} {constraints}.",
    followUp: "What aspects should I focus on?",
  },
  request_teach: {
    confirm: "I'll find training resources for {resource} {constraints}.",
    followUp: "Would you prefer structured courses or hands-on tutorials?",
  },
  resolve: {
    confirm: "I'll prepare {resource} for resolution {constraints}.",
    followUp: "Should I gather the latest data first?",
  },
  evaluate: {
    confirm: "I'll evaluate {resource} {constraints}.",
    followUp: "What criteria should I use?",
  },
  process: {
    confirm: "I'll process {resource} {constraints}.",
    followUp: "Any priority or deadline?",
  },
};

// ─── Constraint formatting ────────────────────────────────────────────────

function formatConstraints(constraints: string[]): string {
  if (constraints.length === 0) return "";

  const parts: string[] = [];
  for (const c of constraints) {
    // constraints are in "key → value" format
    const match = c.match(/^(\w+)\s*→\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      switch (key) {
        case "time":
          parts.push(`by ${value}`);
          break;
        case "target":
          parts.push(`for ${value}`);
          break;
        case "topic":
          parts.push(`on ${value}`);
          break;
        case "content":
          parts.push(`(${value})`);
          break;
        case "urgency":
          parts.push(`— ${value}`);
          break;
        default:
          parts.push(`(${key}: ${value})`);
          break;
      }
    } else {
      parts.push(c);
    }
  }
  return parts.join(" ");
}

// ─── Decoder ──────────────────────────────────────────────────────────────

export function decodeLocal(result: ReasoningResult): string {
  const template = TEMPLATES[result.actionType] ?? TEMPLATES.process;

  const constraintStr = formatConstraints(result.constraints);

  const confirm = template.confirm
    .replace("{resource}", result.resource)
    .replace("{constraints}", constraintStr)
    .replace(/\s{2,}/g, " ")
    .trim();

  // Add follow-up if < 2 constraints (likely missing info)
  if (result.constraints.length < 2) {
    return `${confirm} ${template.followUp}`;
  }

  return confirm;
}
