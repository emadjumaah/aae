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
import { engine } from "../core/engine.js";
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
  const route = routeFunction ?? null;
  const useSymbolicRouter = !routeFunction;

  /**
   * Symbolic routing: encodeLocal → engine.reason → domain tool matching.
   * Used when no model is available. This is the core fix — the engine
   * now directly drives tool selection instead of returning search_kb.
   */
  function symbolicRoute(
    text: string,
    ctx: Record<string, string>,
  ): AgentResult {
    const token = encodeLocal(text);
    const result = engine.reason(token);

    // Find the best tool from the domain based on reasoning output
    const toolId = matchToolFromReasoning(text, result, domain, ctx);

    // Map numeric confidence to category
    let confLevel: "high" | "medium" | "low";
    if (result.confidence >= 0.7) confLevel = "high";
    else if (result.confidence >= 0.45) confLevel = "medium";
    else confLevel = "low";

    // Low confidence → clarify instead of executing
    let nextStep: NextStep;
    if (confLevel === "low") {
      nextStep = "clarify";
    } else if (confLevel === "medium") {
      nextStep = "execute";
    } else {
      nextStep = "execute";
    }

    // Frustrated user + low/medium confidence → escalate
    if (ctx.sentiment === "frustrated" && confLevel !== "high") {
      nextStep = "escalate";
    }

    return {
      tools: [toolId],
      nextStep,
      confidence: confLevel,
      extractedParams: {},
      action: result.actionType,
      root: token.root,
      domain: matchDomainFromRoot(token.root, domain),
    };
  }

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
        // Encode → reason → route
        let agentResult: AgentResult;
        try {
          if (useSymbolicRouter) {
            // Direct symbolic routing: encode → reason → tool match
            agentResult = symbolicRoute(unit.text, session.getContextTokens());
            // Carry forward accumulated params
            agentResult.extractedParams = session.getAccumulatedParams();
          } else {
            // Model-based routing: serialize → model → deserialize
            const token = encodeLocal(unit.text);
            const serialized = serializeInput(token);
            const ctxTokens = session.getContextTokens();

            const outputTokens = await route!(serialized.ids, ctxTokens);
            const parsed = deserializeAgentOutput(outputTokens);

            agentResult = {
              tools: parsed.tools.length > 0 ? parsed.tools : ["search_kb"],
              nextStep: (parsed.nextStep as NextStep) ?? "report",
              confidence:
                (parsed.confidence as "high" | "medium" | "low") ?? "medium",
              extractedParams: session.getAccumulatedParams(),
              action: parsed.action ?? "execute",
              root: parsed.root ?? "",
              domain: parsed.domain ?? "general",
            };
          }
        } catch {
          // Encoding failed — use symbolic fallback with clarification
          try {
            agentResult = symbolicRoute(unit.text, session.getContextTokens());
          } catch {
            agentResult = {
              tools: ["search_kb"],
              nextStep: "clarify",
              confidence: "low",
              extractedParams: {},
              action: "query",
              root: "",
              domain: "general",
            };
          }
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

// ─── Symbolic Routing Helpers ───────────────────────────────────────────────

import type { ReasoningResult, ActionType } from "../core/types.js";

/**
 * Map reasoning output to the best matching tool in the domain.
 * Uses: actionType, root, domain keywords, and input text matching.
 */
function matchToolFromReasoning(
  inputText: string,
  result: ReasoningResult,
  domain: DomainDefinition,
  ctx: Record<string, string>,
): string {
  const lower = inputText.toLowerCase();
  const rootArabic = result.token.root;
  const action = result.actionType;

  // Phase 1: Direct text → domain keyword → tool mapping
  // Score each tool by how many domain keywords match the input
  const toolScores = new Map<string, number>();

  for (const [keyword, root] of Object.entries(domain.keywords)) {
    const kwLower = keyword.toLowerCase();
    if (lower.includes(kwLower) || rootArabic === root) {
      // Find tools whose description/name/domain mentions this keyword
      for (const tool of domain.tools) {
        const toolText =
          `${tool.id} ${tool.name} ${tool.description} ${tool.domain}`.toLowerCase();
        if (toolText.includes(kwLower) || tool.domain === kwLower) {
          toolScores.set(tool.id, (toolScores.get(tool.id) ?? 0) + 3);
        }
      }
    }
  }

  // Phase 2: Action type → tool domain heuristics
  const actionDomainMap: Record<string, string[]> = {
    query: [
      "check_balance",
      "view_plan",
      "check_data_usage",
      "get_profile",
      "search_kb",
    ],
    resolve: ["cancel_service", "dispute_charge"],
    evaluate: ["dispute_charge", "check_device", "speed_test"],
    execute: ["pay_bill", "change_plan", "activate_sim", "reset_network"],
    create: ["add_line", "activate_sim"],
    send: ["send_sms"],
    schedule: ["check_network", "report_outage"],
    store: ["update_info"],
    document: ["billing_history"],
  };

  const actionTools = actionDomainMap[action] ?? [];
  for (const toolId of actionTools) {
    toolScores.set(toolId, (toolScores.get(toolId) ?? 0) + 2);
  }

  // Phase 3: Specific text patterns → direct tool routing
  const directPatterns: [RegExp, string, number][] = [
    [/\b(balance|رصيد)\b/i, "check_balance", 10],
    [/\b(pay|bill|دفع|فاتورة)\b/i, "pay_bill", 8],
    [/\b(plan|خطة|خطتي)\b/i, "view_plan", 8],
    [
      /\b(cancel|terminate|end contract|إلغاء|ألغي|الغ)\b/i,
      "cancel_service",
      10,
    ],
    [/\b(recharge|top up|شحن|اشحن)\b/i, "pay_bill", 9],
    [/\b(data usage|data|بيانات)\b/i, "check_data_usage", 8],
    [/\b(network|signal|شبك|إشارة)\b/i, "check_network", 8],
    [/\b(speed|بطيء|slow)\b/i, "speed_test", 8],
    [/\b(outage|انقطاع|قطع)\b/i, "report_outage", 9],
    [/\b(device|phone|جهاز|هاتف)\b/i, "check_device", 7],
    [/\b(upgrade|ترقية)\b/i, "upgrade_device", 8],
    [/\b(sim|شريحة)\b/i, "activate_sim", 7],
    [/\b(transfer|agent|human|تحويل|موظف)\b/i, "transfer_agent", 9],
    [/\b(profile|info|معلومات)\b/i, "get_profile", 7],
    [
      /\b(troubleshoot|dropping|not working|keeps|frozen|stuck|عطل|خراب)\b/i,
      "troubleshoot_device",
      9,
    ],
    [/\b(expensive|too much|overcharged|غالي|غالية)\b/i, "dispute_charge", 9],
    [
      /\b(haven't received|not received|still waiting|where is my|missing|delayed)\b/i,
      "check_device",
      7,
    ],
    [/\b(travel|abroad|overseas|roaming|Dubai|سفر|مسافر)\b/i, "change_plan", 7],
    [/\b(history|billing history)\b/i, "billing_history", 8],
    [/\b(dispute|نزاع)\b/i, "dispute_charge", 9],
  ];

  for (const [pattern, toolId, score] of directPatterns) {
    if (pattern.test(lower) || pattern.test(inputText)) {
      toolScores.set(toolId, (toolScores.get(toolId) ?? 0) + score);
    }
  }

  // Pick the highest scoring tool
  let bestTool = "search_kb";
  let bestScore = 0;
  for (const [toolId, score] of toolScores) {
    // Only consider tools that exist in the domain
    if (domain.tools.some((t) => t.id === toolId) && score > bestScore) {
      bestScore = score;
      bestTool = toolId;
    }
  }

  return bestTool;
}

/**
 * Find which domain category a root belongs to based on the domain keywords.
 */
function matchDomainFromRoot(root: string, domain: DomainDefinition): string {
  for (const [keyword, kwRoot] of Object.entries(domain.keywords)) {
    if (kwRoot === root) {
      // Find which tool domain this keyword is associated with
      for (const tool of domain.tools) {
        const toolText =
          `${tool.id} ${tool.name} ${tool.description}`.toLowerCase();
        if (toolText.includes(keyword.toLowerCase())) {
          return tool.domain;
        }
      }
    }
  }
  return "general";
}
