/**
 * Arabic Algebra — Agent Executor
 *
 * Maps model output (TOOL/NEXT tokens) → tool execution → formatted response.
 * The executor is the runtime bridge between the model's predictions and actual tool calls.
 *
 * Flow:
 *   1. Model predicts: TOOL:check_balance NEXT:report CONF:high
 *   2. Executor looks up tool definition, validates params
 *   3. Calls the registered tool handler (or returns needed params)
 *   4. Fills response template with results
 *   5. Returns structured ExecutionResult
 */

import type {
  AgentResult,
  DomainDefinition,
  NextStep,
  ToolDefinition,
} from "./types.js";

// ─── Types ─────────────────────────────────────────────────────────────────

/** A handler function that executes a tool with given params and returns data */
export type ToolHandler = (
  params: Record<string, string>,
) => Promise<Record<string, string>>;

export interface ExecutionResult {
  /** Tool that was executed (or first tool in chain) */
  toolId: string;
  /** Outcome status */
  status: "success" | "needs_input" | "needs_confirm" | "error" | "escalated";
  /** Formatted response text for the user */
  response: string;
  /** Raw data returned by the tool handler */
  data: Record<string, string>;
  /** What the agent should do next */
  nextStep: NextStep;
  /** Missing required params (for needs_input status) */
  missingParams: string[];
  /** Remaining tools in chain (for multi-tool sequences) */
  pendingTools: string[];
}

// ─── Executor ──────────────────────────────────────────────────────────────

export class AgentExecutor {
  private domain: DomainDefinition;
  private handlers: Map<string, ToolHandler> = new Map();
  private toolMap: Map<string, ToolDefinition> = new Map();

  constructor(domain: DomainDefinition) {
    this.domain = domain;
    for (const tool of domain.tools) {
      this.toolMap.set(tool.id, tool);
    }
  }

  /** Register a handler for a tool */
  registerHandler(toolId: string, handler: ToolHandler): void {
    if (!this.toolMap.has(toolId)) {
      throw new Error(`Unknown tool: ${toolId}`);
    }
    this.handlers.set(toolId, handler);
  }

  /** Register handlers in bulk */
  registerHandlers(handlers: Record<string, ToolHandler>): void {
    for (const [id, handler] of Object.entries(handlers)) {
      this.registerHandler(id, handler);
    }
  }

  /**
   * Execute an agent result (model's prediction).
   * Handles: single tool, chained tools, missing params, confirmation, escalation.
   */
  async execute(
    result: AgentResult,
    providedParams: Record<string, string> = {},
  ): Promise<ExecutionResult> {
    const { tools, nextStep, confidence } = result;

    if (tools.length === 0) {
      return {
        toolId: "",
        status: "error",
        response:
          "I couldn't determine which action to take. Could you rephrase?",
        data: {},
        nextStep: "clarify",
        missingParams: [],
        pendingTools: [],
      };
    }

    const firstToolId = tools[0];
    const tool = this.toolMap.get(firstToolId);

    if (!tool) {
      return {
        toolId: firstToolId,
        status: "error",
        response: `Tool "${firstToolId}" is not available in this domain.`,
        data: {},
        nextStep: "clarify",
        missingParams: [],
        pendingTools: tools.slice(1),
      };
    }

    // Check for escalation
    if (nextStep === "escalate") {
      return {
        toolId: firstToolId,
        status: "escalated",
        response: "Let me transfer you to a specialist who can help with this.",
        data: {},
        nextStep: "escalate",
        missingParams: [],
        pendingTools: [],
      };
    }

    // Check for confirmation needed
    if (nextStep === "confirm") {
      const description = buildConfirmationMessage(tool, providedParams);
      return {
        toolId: firstToolId,
        status: "needs_confirm",
        response: description,
        data: providedParams,
        nextStep: "confirm",
        missingParams: [],
        pendingTools: tools.slice(1),
      };
    }

    // Check required params
    const missing = findMissingParams(tool, providedParams);
    if (missing.length > 0 || nextStep === "await_input") {
      return {
        toolId: firstToolId,
        status: "needs_input",
        response: buildInputRequest(tool, missing),
        data: providedParams,
        nextStep: "await_input",
        missingParams: missing,
        pendingTools: tools.slice(1),
      };
    }

    // Execute the tool
    const handler = this.handlers.get(firstToolId);
    if (!handler) {
      // No handler registered — return template with placeholders
      return {
        toolId: firstToolId,
        status: "success",
        response: this.fillTemplate(firstToolId, providedParams),
        data: providedParams,
        nextStep:
          tools.length > 1
            ? "chain"
            : nextStep === "chain"
              ? "report"
              : nextStep,
        missingParams: [],
        pendingTools: tools.slice(1),
      };
    }

    try {
      const data = await handler(providedParams);

      return {
        toolId: firstToolId,
        status: "success",
        response: this.fillTemplate(firstToolId, data),
        data,
        nextStep:
          tools.length > 1
            ? "chain"
            : nextStep === "chain"
              ? "report"
              : nextStep,
        missingParams: [],
        pendingTools: tools.slice(1),
      };
    } catch (err) {
      return {
        toolId: firstToolId,
        status: "error",
        response: `Sorry, there was an error with ${tool.name}: ${(err as Error).message}`,
        data: {},
        nextStep: "escalate",
        missingParams: [],
        pendingTools: tools.slice(1),
      };
    }
  }

  /**
   * Execute a chain of tools sequentially.
   * Each tool's output is fed as params to the next.
   */
  async executeChain(
    result: AgentResult,
    initialParams: Record<string, string> = {},
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    let currentParams = { ...initialParams };

    // Process tools one at a time
    const toolIds = [...result.tools];

    for (let i = 0; i < toolIds.length; i++) {
      const singleResult: AgentResult = {
        ...result,
        tools: [toolIds[i]],
        nextStep: i < toolIds.length - 1 ? "chain" : result.nextStep,
      };

      const execResult = await this.execute(singleResult, currentParams);
      results.push(execResult);

      // Stop chain on any non-success status
      if (execResult.status !== "success") break;

      // Carry forward data for next tool
      currentParams = { ...currentParams, ...execResult.data };
    }

    return results;
  }

  /** Get a tool definition by ID */
  getTool(id: string): ToolDefinition | undefined {
    return this.toolMap.get(id);
  }

  /** Fill a response template with data values */
  private fillTemplate(toolId: string, data: Record<string, string>): string {
    let template =
      this.domain.responseTemplates[toolId] ??
      `Action completed for ${toolId}.`;

    for (const [key, value] of Object.entries(data)) {
      template = template.replaceAll(`{${key}}`, value);
    }

    // Replace any remaining {placeholders} with "N/A"
    template = template.replace(/\{[^}]+\}/g, "N/A");

    return template;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function findMissingParams(
  tool: ToolDefinition,
  provided: Record<string, string>,
): string[] {
  return tool.params
    .filter((p) => p.required && !(p.name in provided))
    .map((p) => p.name);
}

function buildConfirmationMessage(
  tool: ToolDefinition,
  params: Record<string, string>,
): string {
  const paramSummary = Object.entries(params)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return paramSummary
    ? `I'll ${tool.description.toLowerCase()}. Details: ${paramSummary}. Shall I proceed?`
    : `I'll ${tool.description.toLowerCase()}. Shall I proceed?`;
}

function buildInputRequest(tool: ToolDefinition, missing: string[]): string {
  if (missing.length === 0) {
    return `To ${tool.description.toLowerCase()}, I need a bit more information. What would you like to do?`;
  }

  const descriptions = missing.map((name) => {
    const param = tool.params.find((p) => p.name === name);
    return param ? param.description : name;
  });

  if (descriptions.length === 1) {
    return `Could you please provide your ${descriptions[0].toLowerCase()}?`;
  }

  const last = descriptions.pop()!;
  return `Could you please provide your ${descriptions.join(", ").toLowerCase()} and ${last.toLowerCase()}?`;
}
