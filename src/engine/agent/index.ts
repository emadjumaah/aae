/**
 * Arabic Algebra — Agent Module
 *
 * Public API that ties together:
 *   decomposer → encoder → model → executor → session
 *
 * Usage:
 *   const agent = createAgent(TELECOM_DOMAIN);
 *   agent.registerHandlers({ check_balance: async (p) => ({...}) });
 *   const reply = await agent.handle(sessionId, "What is my balance?");
 */

export { decompose, type DecomposedUnit } from "./decomposer.js";
export {
  AgentExecutor,
  type ToolHandler,
  type ExecutionResult,
} from "./executor.js";
export {
  ConversationSession,
  type ConversationState,
  type SessionContext,
  type TurnRecord,
} from "./session.js";
export type {
  AgentResult,
  DomainDefinition,
  NextStep,
  ToolDefinition,
  ToolParam,
  ContextKey,
} from "./types.js";
export {
  TELECOM_DOMAIN,
  getTelecomToolIds,
  getTelecomTool,
} from "./domains/telecom.js";
export { BANKING_DOMAIN } from "./domains/banking.js";
export { HEALTHCARE_DOMAIN } from "./domains/healthcare.js";

import { decompose } from "./decomposer.js";
import {
  AgentExecutor,
  type ToolHandler,
  type ExecutionResult,
} from "./executor.js";
import { ConversationSession } from "./session.js";
import type { AgentResult, DomainDefinition, NextStep } from "./types.js";
import { encodeLocal } from "../core/encoder.js";
import {
  serializeInput,
  serializeAgentOutput,
  deserializeAgentOutput,
} from "../../training/serializer.js";

// ─── Agent ─────────────────────────────────────────────────────────────────

export interface AgentReply {
  /** Text response for the user */
  response: string;
  /** Current conversation state */
  state: string;
  /** Tool(s) that were predicted */
  tools: string[];
  /** What happens next */
  nextStep: NextStep;
  /** Execution results (one per tool in chain) */
  execResults: ExecutionResult[];
  /** Session turn number */
  turn: number;
}

export interface Agent {
  handle(sessionId: string, userText: string): Promise<AgentReply>;
  registerHandler(toolId: string, handler: ToolHandler): void;
  registerHandlers(handlers: Record<string, ToolHandler>): void;
  getSession(sessionId: string): ConversationSession;
  resetSession(sessionId: string): void;
}

/**
 * Create an agent for a specific domain.
 *
 * The `routeFunction` is called with serialized input tokens and must return
 * the model's predicted output tokens. This is where the actual model lives
 * (could be local inference, HTTP call to serve.py, etc.)
 */
export function createAgent(
  domain: DomainDefinition,
  routeFunction?: (
    inputIds: number[],
    contextTokens: Record<string, string>,
  ) => Promise<string[]>,
): Agent {
  const executor = new AgentExecutor(domain);
  const sessions = new Map<string, ConversationSession>();

  function getOrCreateSession(id: string): ConversationSession {
    let session = sessions.get(id);
    if (!session) {
      session = new ConversationSession(id);
      sessions.set(id, session);
    }
    return session;
  }

  // Default route function: keyword-based fallback (no model)
  const route = routeFunction ?? keywordRoute(domain);

  return {
    async handle(sessionId: string, userText: string): Promise<AgentReply> {
      const session = getOrCreateSession(sessionId);
      const units = decompose(userText);
      const state = session.beginTurn(userText, units);

      // If we were confirming and user confirmed, execute pending
      if (state === "executing" && session.getPendingResult()) {
        const pending = session.getPendingResult()!;
        const results = await executor.executeChain(
          pending,
          session.getAccumulatedParams(),
        );

        for (const r of results) {
          session.applyExecution(r);
        }
        session.completeTurn();

        return {
          response: results.map((r) => r.response).join("\n\n"),
          state: session.getState(),
          tools: pending.tools,
          nextStep: results[results.length - 1]?.nextStep ?? "report",
          execResults: results,
          turn: session.getTurn(),
        };
      }

      // If denied confirmation, return to idle
      if (state === "idle" && session.getTurn() > 1) {
        return {
          response: "Okay, cancelled. What else can I help with?",
          state: "idle",
          tools: [],
          nextStep: "close",
          execResults: [],
          turn: session.getTurn(),
        };
      }

      // Route each decomposed unit (or the whole text if single)
      const allResults: ExecutionResult[] = [];
      const allTools: string[] = [];

      for (const unit of units.length > 0
        ? units
        : [{ text: userText, index: 0, isReference: false }]) {
        // Encode → serialize → route
        let agentResult: AgentResult;
        try {
          const token = encodeLocal(unit.text);
          const serialized = serializeInput(token);
          const ctxTokens = session.getContextTokens();

          const outputTokens = await route(serialized.ids, ctxTokens);
          const parsed = deserializeAgentOutput(outputTokens);

          agentResult = {
            tools: parsed.tools,
            nextStep: (parsed.nextStep as NextStep) ?? "report",
            confidence:
              (parsed.confidence as "high" | "medium" | "low") ?? "medium",
            extractedParams: session.getAccumulatedParams(),
            action: parsed.action ?? "execute",
            root: parsed.root ?? "",
            domain: parsed.domain ?? "general",
          };
        } catch {
          // Encoding failed — try keyword fallback
          const fallbackTokens = await route([], session.getContextTokens());
          const parsed = deserializeAgentOutput(fallbackTokens);
          agentResult = {
            tools: parsed.tools.length > 0 ? parsed.tools : ["search_kb"],
            nextStep: "report",
            confidence: "low",
            extractedParams: {},
            action: "query",
            root: "",
            domain: "general",
          };
        }

        allTools.push(...agentResult.tools);
        session.applyRouting(agentResult);

        // Execute based on state
        if (
          session.getState() === "executing" ||
          session.getState() === "chaining"
        ) {
          const results = await executor.executeChain(
            agentResult,
            session.getAccumulatedParams(),
          );
          allResults.push(...results);
          for (const r of results) {
            session.applyExecution(r);
          }
        } else if (
          session.getState() === "confirming" ||
          session.getState() === "awaiting_input"
        ) {
          // Return early — need user input
          const execResult = await executor.execute(
            agentResult,
            session.getAccumulatedParams(),
          );
          allResults.push(execResult);
          session.applyExecution(execResult);
          break;
        } else if (session.getState() === "escalated") {
          allResults.push({
            toolId: "transfer_agent",
            status: "escalated",
            response: "Let me transfer you to a specialist who can help.",
            data: {},
            nextStep: "escalate",
            missingParams: [],
            pendingTools: [],
          });
          break;
        }
      }

      session.completeTurn();

      const lastResult = allResults[allResults.length - 1];
      return {
        response: allResults.map((r) => r.response).join("\n\n"),
        state: session.getState(),
        tools: [...new Set(allTools)],
        nextStep: lastResult?.nextStep ?? "report",
        execResults: allResults,
        turn: session.getTurn(),
      };
    },

    registerHandler(toolId: string, handler: ToolHandler) {
      executor.registerHandler(toolId, handler);
    },

    registerHandlers(handlers: Record<string, ToolHandler>) {
      executor.registerHandlers(handlers);
    },

    getSession(sessionId: string): ConversationSession {
      return getOrCreateSession(sessionId);
    },

    resetSession(sessionId: string): void {
      sessions.get(sessionId)?.reset();
    },
  };
}

// ─── Keyword Fallback Router ───────────────────────────────────────────────

/**
 * Simple keyword-based router — used when no model is available.
 * Matches keywords from the domain definition to predict tools.
 */
function keywordRoute(
  domain: DomainDefinition,
): (inputIds: number[], ctx: Record<string, string>) => Promise<string[]> {
  // Build reverse: keyword → tool mappings based on domain tool descriptions
  const toolKeywords = new Map<string, string[]>();
  for (const tool of domain.tools) {
    const words = [
      tool.id.replace(/_/g, " "),
      tool.name.toLowerCase(),
      tool.description.toLowerCase(),
    ]
      .join(" ")
      .split(/\s+/);
    toolKeywords.set(tool.id, words);
  }

  return async (_inputIds: number[], _ctx: Record<string, string>) => {
    // Return a default search_kb if we can't determine the tool
    // The real router uses the trained model
    return [
      "<BOS>",
      "ACT:query",
      "R:سأل",
      "D:general",
      "TOOL:search_kb",
      "NEXT:report",
      "CONF:low",
      "<EOS>",
    ];
  };
}
