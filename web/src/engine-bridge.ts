/**
 * Shared engine bridge for the web app.
 * Imports the pure-TS engine modules (no Node.js deps).
 */
export { encodeLocal } from "@engine/core/encoder.js";
export { decodeLocal } from "@engine/core/decoder.js";
export { engine } from "@engine/core/engine.js";
export { compactToken } from "@engine/core/types.js";
export { ROOTS, PATTERNS } from "@engine/core/dictionary.js";
export { EXAMPLES } from "@src/examples.js";
export {
  ALL_ROOT_DATA,
  ALL_DOMAINS,
  rootsByDomain,
} from "@engine/data/roots.js";

export type {
  AlgebraToken,
  ReasoningResult,
  IntentOperator,
  PatternOperator,
  ActionType,
} from "@engine/core/types.js";

// Run the full standalone pipeline client-side
import { encodeLocal } from "@engine/core/encoder.js";
import { decodeLocal } from "@engine/core/decoder.js";
import { engine } from "@engine/core/engine.js";
import { compactToken } from "@engine/core/types.js";

export function run(input: string) {
  const start = performance.now();
  const token = encodeLocal(input.trim());
  const reasoning = engine.reason(token);
  const explanation = engine.explain(token);
  const response = decodeLocal(reasoning);
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  return {
    input: input.trim(),
    token,
    algebraCompact: compactToken(token),
    reasoning,
    explanation,
    response,
    durationMs,
  };
}
