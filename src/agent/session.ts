/**
 * Arabic Algebra — Multi-Turn Conversation State Machine
 *
 * Tracks conversation state across turns. Manages context (CTX tokens),
 * pending operations, confirmation flows, and session history.
 *
 * States:
 *   idle → routing → confirming → executing → reporting → idle
 *                  ↘ awaiting_input ↗
 *                  ↘ escalated (terminal)
 */

import type { NextStep, ContextKey, AgentResult } from "./types.js";
import type { ExecutionResult } from "./executor.js";
import type { DecomposedUnit } from "./decomposer.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ConversationState =
  | "idle"
  | "routing"
  | "confirming"
  | "awaiting_input"
  | "executing"
  | "chaining"
  | "reporting"
  | "escalated"
  | "closed";

export interface TurnRecord {
  /** Turn number (1-based) */
  turn: number;
  /** User input text */
  userText: string;
  /** Decomposed intents from input */
  units: DecomposedUnit[];
  /** Model's routing result */
  agentResult: AgentResult | null;
  /** Execution result */
  execResult: ExecutionResult | null;
  /** State after this turn */
  state: ConversationState;
  /** Timestamp */
  timestamp: number;
}

export interface SessionContext {
  /** Current turn number */
  turn: number;
  /** Last tool that was executed */
  prevTool: string | null;
  /** Last action type */
  prevAction: string | null;
  /** Detected issue type */
  issueType: string | null;
  /** User sentiment */
  sentiment: "positive" | "neutral" | "frustrated";
  /** Communication channel */
  channel: "chat" | "voice" | "email";
}

// ─── Session ───────────────────────────────────────────────────────────────

export class ConversationSession {
  readonly id: string;
  private state: ConversationState = "idle";
  private history: TurnRecord[] = [];
  private context: SessionContext;
  private pendingConfirm: AgentResult | null = null;
  private pendingParams: Record<string, string> = {};
  private pendingToolQueue: string[] = [];

  constructor(sessionId: string, channel: "chat" | "voice" | "email" = "chat") {
    this.id = sessionId;
    this.context = {
      turn: 0,
      prevTool: null,
      prevAction: null,
      issueType: null,
      sentiment: "neutral",
      channel,
    };
  }

  // ─── Getters ───────────────────────────────────────────────────────────

  getState(): ConversationState {
    return this.state;
  }

  getContext(): Readonly<SessionContext> {
    return this.context;
  }

  getHistory(): readonly TurnRecord[] {
    return this.history;
  }

  getTurn(): number {
    return this.context.turn;
  }

  /** Build CTX token map for the model input (appended to serialized tokens) */
  getContextTokens(): Record<string, string> {
    const ctx: Record<string, string> = {
      turn: String(this.context.turn),
      channel: this.context.channel,
      sentiment: this.context.sentiment,
    };
    if (this.context.prevTool) ctx.prev_tool = this.context.prevTool;
    if (this.context.prevAction) ctx.prev_action = this.context.prevAction;
    if (this.context.issueType) ctx.issue_type = this.context.issueType;
    return ctx;
  }

  /** Check if we're waiting for user input or confirmation */
  isPending(): boolean {
    return this.state === "confirming" || this.state === "awaiting_input";
  }

  /** Get the pending agent result (for confirm/input flows) */
  getPendingResult(): AgentResult | null {
    return this.pendingConfirm;
  }

  /** Get accumulated params from the conversation */
  getAccumulatedParams(): Record<string, string> {
    return { ...this.pendingParams };
  }

  // ─── State Transitions ────────────────────────────────────────────────

  /**
   * Start a new turn with user input.
   * Returns the updated state for the router to act on.
   */
  beginTurn(userText: string, units: DecomposedUnit[]): ConversationState {
    this.context.turn++;

    // Detect sentiment from input
    this.context.sentiment = detectSentiment(userText);

    // If we were awaiting confirmation and user confirms
    if (this.state === "confirming" && isConfirmation(userText)) {
      this.state = "executing";
      this.recordTurn(userText, units, null, null);
      return this.state;
    }

    // If we were awaiting confirmation and user denies
    if (this.state === "confirming" && isDenial(userText)) {
      this.state = "idle";
      this.pendingConfirm = null;
      this.recordTurn(userText, units, null, null);
      return this.state;
    }

    // If we were awaiting input, user is providing params
    if (this.state === "awaiting_input") {
      // The new input may contain params — let the executor handle extraction
      this.state = "routing";
      this.recordTurn(userText, units, null, null);
      return this.state;
    }

    // Default: start routing new request
    this.state = "routing";
    this.recordTurn(userText, units, null, null);
    return this.state;
  }

  /**
   * Process the model's routing result.
   * Transitions state based on the predicted nextStep.
   */
  applyRouting(result: AgentResult): ConversationState {
    const lastTurn = this.history[this.history.length - 1];
    if (lastTurn) lastTurn.agentResult = result;

    // Update issue type if detected
    if (result.domain && result.domain !== "general") {
      this.context.issueType = result.domain;
    }

    switch (result.nextStep) {
      case "execute":
      case "report":
        this.state = "executing";
        break;
      case "confirm":
        this.state = "confirming";
        this.pendingConfirm = result;
        break;
      case "await_input":
      case "clarify":
        this.state = "awaiting_input";
        this.pendingConfirm = result;
        break;
      case "chain":
        this.state = "chaining";
        this.pendingToolQueue = result.tools.slice(1);
        break;
      case "escalate":
        this.state = "escalated";
        break;
      case "close":
        this.state = "closed";
        break;
    }

    return this.state;
  }

  /**
   * Record execution result and advance state.
   */
  applyExecution(execResult: ExecutionResult): ConversationState {
    const lastTurn = this.history[this.history.length - 1];
    if (lastTurn) lastTurn.execResult = execResult;

    // Update context with executed tool
    this.context.prevTool = execResult.toolId;
    this.context.prevAction = lastTurn?.agentResult?.action ?? null;

    // Accumulate returned data as params for potential chaining
    Object.assign(this.pendingParams, execResult.data);

    switch (execResult.status) {
      case "success":
        if (execResult.pendingTools.length > 0) {
          this.state = "chaining";
          this.pendingToolQueue = execResult.pendingTools;
        } else {
          this.state = "reporting";
        }
        break;
      case "needs_input":
        this.state = "awaiting_input";
        break;
      case "needs_confirm":
        this.state = "confirming";
        break;
      case "escalated":
        this.state = "escalated";
        break;
      case "error":
        this.state = "reporting"; // report the error to user
        break;
    }

    return this.state;
  }

  /** Mark turn as complete and return to idle */
  completeTurn(): void {
    const lastTurn = this.history[this.history.length - 1];
    if (lastTurn) lastTurn.state = this.state;

    if (this.state === "reporting") {
      this.state = "idle";
    }
  }

  /** Get next tool in chain queue */
  popChainedTool(): string | null {
    return this.pendingToolQueue.shift() ?? null;
  }

  /** Supply a parameter (from user input in await_input state) */
  supplyParam(key: string, value: string): void {
    this.pendingParams[key] = value;
  }

  /** Reset session */
  reset(): void {
    this.state = "idle";
    this.history = [];
    this.pendingConfirm = null;
    this.pendingParams = {};
    this.pendingToolQueue = [];
    this.context = {
      turn: 0,
      prevTool: null,
      prevAction: null,
      issueType: null,
      sentiment: "neutral",
      channel: this.context.channel,
    };
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private recordTurn(
    userText: string,
    units: DecomposedUnit[],
    agentResult: AgentResult | null,
    execResult: ExecutionResult | null,
  ): void {
    this.history.push({
      turn: this.context.turn,
      userText,
      units,
      agentResult,
      execResult,
      state: this.state,
      timestamp: Date.now(),
    });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const CONFIRM_WORDS =
  /^(yes|yeah|yep|ok|okay|sure|go ahead|proceed|confirm|do it|نعم|أكيد|تمام|اوكي|يلا|موافق)\b/i;
const DENY_WORDS =
  /^(no|nah|nope|cancel|stop|don't|never|لا|ألغ|أوقف|ما أبي)\b/i;

function isConfirmation(text: string): boolean {
  return CONFIRM_WORDS.test(text.trim());
}

function isDenial(text: string): boolean {
  return DENY_WORDS.test(text.trim());
}

const FRUSTRATED_WORDS =
  /\b(frustrated|angry|unacceptable|terrible|horrible|worst|ridiculous|مستاء|غاضب|زعلان|سيئ|مقبول)\b/i;

function detectSentiment(text: string): "positive" | "neutral" | "frustrated" {
  if (FRUSTRATED_WORDS.test(text)) return "frustrated";
  if (/\b(thanks?|thank you|great|awesome|شكراً?|ممتاز|رائع)\b/i.test(text))
    return "positive";
  return "neutral";
}
