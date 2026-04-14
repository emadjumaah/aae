/**
 * Arabic Algebra Engine — Pipeline
 *
 * Two modes:
 *   1. Standalone (default) — pure TypeScript, no LLM, no network
 *   2. LLM-assisted — uses Claude for encode/decode (needs API key)
 *
 * The standalone pipeline is the primary mode. LLM is optional.
 */

import { encode, decode } from "./engine/core/translation.js";
import { encodeLocal } from "./engine/core/encoder.js";
import { decodeLocal } from "./engine/core/decoder.js";
import { engine } from "./engine/core/engine.js";
import { compactToken } from "./engine/core/types.js";
import type { AlgebraToken, ReasoningResult } from "./engine/core/types.js";

export interface PipelineResult {
  input: string;
  token: AlgebraToken;
  algebraCompact: string;
  reasoning: ReasoningResult;
  explanation: string;
  response: string;
  durationMs: number;
  mode: "standalone" | "llm";
}

/**
 * run — standalone pipeline, NO LLM, NO network
 * Encode via keyword matching, reason via rules, decode via templates.
 */
export function run(input: string): PipelineResult {
  const start = Date.now();

  const token = encodeLocal(input);
  const reasoning = engine.reason(token);
  const response = decodeLocal(reasoning);

  return {
    input,
    token,
    algebraCompact: compactToken(token),
    reasoning,
    explanation: engine.explain(token),
    response,
    durationMs: Date.now() - start,
    mode: "standalone",
  };
}

/**
 * runLLM — LLM-assisted pipeline (needs ANTHROPIC_API_KEY)
 * Uses Claude for encode/decode. Reasoning is still pure symbolic.
 */
export async function runLLM(input: string): Promise<PipelineResult> {
  const start = Date.now();

  const token = await encode(input);
  const reasoning = engine.reason(token);
  const response = await decode(reasoning, input);

  return {
    input,
    token,
    algebraCompact: compactToken(token),
    reasoning,
    explanation: engine.explain(token),
    response,
    durationMs: Date.now() - start,
    mode: "llm",
  };
}

/**
 * runVerbose — standalone pipeline with stdout logging
 */
export function runVerbose(input: string): PipelineResult {
  console.log("\n" + "─".repeat(60));
  console.log(`Input      : ${input}`);

  const result = run(input);

  console.log(`\nAlgebra    : ${result.algebraCompact}`);
  console.log(`  intent   = ${result.token.intent}`);
  console.log(`  root     = ${result.token.root} (${result.token.rootLatin})`);
  console.log(`  pattern  = ${result.token.pattern}`);
  console.log(`  modifiers= ${result.token.modifiers.join(", ") || "none"}`);
  console.log(`\nReasoning`);
  console.log(`  action   = ${result.reasoning.actionType}`);
  console.log(`  resource = ${result.reasoning.resource}`);
  console.log(`  resolved = ${result.reasoning.resolvedIntent}`);
  console.log(
    `  confidence ${(result.reasoning.confidence * 100).toFixed(0)}%`,
  );
  console.log(`\nResponse   : ${result.response}`);
  console.log(`Duration   : ${result.durationMs}ms`);
  console.log(`Mode       : ${result.mode}`);

  return result;
}

// Re-export individual stages for direct use
export { encodeLocal } from "./engine/core/encoder.js";
export { decodeLocal } from "./engine/core/decoder.js";
export { encode, decode } from "./engine/core/translation.js";
export { engine } from "./engine/core/engine.js";
export { compactToken } from "./engine/core/types.js";
export type { AlgebraToken, ReasoningResult } from "./engine/core/types.js";
