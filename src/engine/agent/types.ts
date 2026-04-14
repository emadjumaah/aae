/**
 * Arabic Algebra — Agent Types
 *
 * Extends the core algebra system with tool routing, next-step prediction,
 * and conversation context for building complete domain agents.
 */

// ─── Tool Definition ───────────────────────────────────────────────────────

export interface ToolDefinition {
  /** Unique tool ID, becomes TOOL:<id> token */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this tool does */
  description: string;
  /** Which domain this tool belongs to */
  domain: string;
  /** Required parameters */
  params: ToolParam[];
  /** What the tool returns */
  returns: string;
}

export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

// ─── Next Step Prediction ──────────────────────────────────────────────────

export type NextStep =
  | "execute" // run the tool immediately
  | "confirm" // ask user to confirm before executing
  | "await_input" // wait for user to provide missing info
  | "clarify" // ask user to clarify ambiguous request
  | "escalate" // hand off to human / LLM
  | "report" // report results back to user
  | "chain" // chain to next tool in sequence
  | "close"; // conversation complete

export const ALL_NEXT_STEPS: NextStep[] = [
  "execute",
  "confirm",
  "await_input",
  "clarify",
  "escalate",
  "report",
  "chain",
  "close",
];

// ─── Conversation Context ──────────────────────────────────────────────────

export type ContextKey =
  | "turn" // turn number in conversation
  | "prev_tool" // last tool that was called
  | "prev_action" // last action type
  | "issue_type" // categorized issue (billing, technical, etc.)
  | "sentiment" // user mood: positive, neutral, frustrated
  | "channel"; // chat, voice, email

export const ALL_CONTEXT_KEYS: ContextKey[] = [
  "turn",
  "prev_tool",
  "prev_action",
  "issue_type",
  "sentiment",
  "channel",
];

// ─── Agent Result ──────────────────────────────────────────────────────────

export interface AgentResult {
  /** Which tool(s) to call */
  tools: string[];
  /** What to do next */
  nextStep: NextStep;
  /** Confidence in the routing decision */
  confidence: "high" | "medium" | "low";
  /** Extracted parameters for the tool */
  extractedParams: Record<string, string>;
  /** The underlying algebra reasoning */
  action: string;
  root: string;
  domain: string;
}

// ─── Domain Definition ─────────────────────────────────────────────────────

export interface DomainDefinition {
  /** Domain identifier */
  id: string;
  /** Human name */
  name: string;
  /** Available tools */
  tools: ToolDefinition[];
  /** Domain-specific keywords → root mappings */
  keywords: Record<string, string>;
  /** Response templates keyed by tool ID */
  responseTemplates: Record<string, string>;
  /** Issue type categories */
  issueTypes: string[];
}
