/**
 * arabic-algebra-engine
 *
 * A lightweight reasoning engine using Arabic root-pattern morphology
 * as an intermediate semantic algebra between natural language and logic.
 *
 * Usage:
 *   import { run, encode, engine, decode } from 'arabic-algebra-engine'
 *
 *   // Full pipeline
 *   const result = await run("Schedule a meeting with the team tomorrow")
 *
 *   // Or stage by stage
 *   const token    = await encode("Schedule a meeting")
 *   const result   = engine.reason(token)
 *   const response = await decode(result, "Schedule a meeting")
 */

export { run, runVerbose, runLLM } from "./pipeline.js";
export { encodeLocal } from "./engine/core/encoder.js";
export { decodeLocal } from "./engine/core/decoder.js";
export { encode, decode } from "./engine/core/translation.js";
export { engine, AlgebraEngine } from "./engine/core/engine.js";
export { ROOTS, PATTERNS } from "./engine/core/dictionary.js";
export { compactToken } from "./engine/core/types.js";
export { EXAMPLES } from "./examples.js";
export {
  ALL_ROOT_DATA,
  ROOT_DATA_BY_ARABIC,
  ALL_DOMAINS,
  rootsByDomain,
} from "./engine/data/roots.js";

// CST interop — produces cst-poc reasoning-level token sequences
export { toCST, type CSTSequence } from "./engine/core/cst_bridge.js";

export type {
  AlgebraToken,
  ReasoningResult,
  IntentOperator,
  PatternOperator,
  ActionType,
  ArabicRoot,
  RootEntry,
  PatternEntry,
} from "./engine/core/types.js";
