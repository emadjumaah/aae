/**
 * Arabic Algebra Engine — Public API
 *
 * Re-exports everything needed to use the engine at runtime.
 */

// Core
export { encodeLocal } from "./core/encoder.js";
export { decodeLocal } from "./core/decoder.js";
export { encode, decode } from "./core/translation.js";
export { engine, AlgebraEngine } from "./core/engine.js";
export { ROOTS, PATTERNS } from "./core/dictionary.js";
export { compactToken } from "./core/types.js";

export type {
  AlgebraToken,
  ReasoningResult,
  IntentOperator,
  PatternOperator,
  ActionType,
  ArabicRoot,
  RootEntry,
  PatternEntry,
} from "./core/types.js";

// Data
export {
  ALL_ROOT_DATA,
  ROOT_DATA_BY_ARABIC,
  ALL_DOMAINS,
  rootsByDomain,
} from "./data/roots.js";

// Agent
export {
  decompose,
  AgentExecutor,
  ConversationSession,
  TELECOM_DOMAIN,
  getTelecomToolIds,
  getTelecomTool,
  createAgent,
} from "./agent/index.js";

export type {
  DecomposedUnit,
  ToolHandler,
  ExecutionResult,
  ConversationState,
  SessionContext,
  TurnRecord,
  AgentResult,
  DomainDefinition,
  NextStep,
  ToolDefinition,
  ToolParam,
  ContextKey,
  AgentReply,
  Agent,
} from "./agent/index.js";
