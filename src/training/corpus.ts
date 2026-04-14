/**
 * Arabic Algebra — Corpus Builder
 *
 * Generates training data for the algebra-tokenized reasoning model.
 * Three generation modes:
 *   A. Convert existing benchmark/test cases → algebra token sequences
 *   B. Template expansion — generate variations from root × pattern × modifier combos
 *   C. Export format for model training (JSONL)
 */

import { encodeLocal } from "../engine/core/encoder.js";
import { engine } from "../engine/core/engine.js";
import {
  ALL_ROOT_DATA,
  rootsByDomain,
  type RootData,
} from "../engine/data/roots.js";
import type {
  AlgebraToken,
  ReasoningResult,
  IntentOperator,
  PatternOperator,
} from "../engine/core/types.js";
import { serializeInput, serializeOutput } from "./serializer.js";
import { getVocabulary } from "./vocabulary.js";

// ─── Training Example ──────────────────────────────────────────────────────

export interface TrainingExample {
  id: string;
  inputText: string;
  inputTokens: string[];
  inputIds: number[];
  outputTokens: string[];
  outputIds: number[];
  metadata: {
    sourceLang: "en" | "ar";
    domain: string;
    intent: IntentOperator;
    root: string;
    pattern: PatternOperator;
    action: string;
    confidence: number;
    source: "benchmark" | "template" | "manual";
  };
}

// ─── Phase A: Convert from benchmark cases ─────────────────────────────────

interface BenchmarkInput {
  id: string;
  input: string;
  expected: { intent: string; root: string; action: string };
}

export function fromBenchmarkCase(bc: BenchmarkInput): TrainingExample | null {
  try {
    const token = encodeLocal(bc.input);
    const reasoning = engine.reason(token);
    const rootData = ALL_ROOT_DATA.find((r) => r.arabic === token.root);
    const domain = rootData?.domain ?? "general";

    const inputSer = serializeInput(token);
    const outputSer = serializeOutput(reasoning, domain);

    const isArabic = /[\u0600-\u06FF]/.test(bc.input);

    return {
      id: `bench-${bc.id}`,
      inputText: bc.input,
      inputTokens: inputSer.tokens,
      inputIds: inputSer.ids,
      outputTokens: outputSer.tokens,
      outputIds: outputSer.ids,
      metadata: {
        sourceLang: isArabic ? "ar" : "en",
        domain,
        intent: token.intent,
        root: token.root,
        pattern: token.pattern,
        action: reasoning.actionType,
        confidence: reasoning.confidence,
        source: "benchmark",
      },
    };
  } catch {
    return null;
  }
}

// ─── Phase B: Template Expansion ───────────────────────────────────────────

const INTENT_TEMPLATES: Record<IntentOperator, string[]> = {
  seek: [
    "I need to find {keyword}",
    "Can you locate {keyword} for me",
    "Search for {keyword}",
    "Find me {keyword}",
    "Look up {keyword}",
    "I'm looking for {keyword}",
    "Where can I find {keyword}",
  ],
  do: [
    "Execute {keyword}",
    "Run {keyword}",
    "Perform {keyword}",
    "Do the {keyword}",
    "Handle {keyword}",
    "Process {keyword}",
    "Complete {keyword}",
  ],
  send: [
    "Send {keyword} to the team",
    "Dispatch {keyword}",
    "Forward {keyword}",
    "Deliver {keyword}",
    "Email {keyword} to everyone",
    "Share {keyword}",
    "Send out {keyword}",
  ],
  gather: [
    "Collect {keyword}",
    "Gather {keyword}",
    "Assemble {keyword}",
    "Round up {keyword}",
    "Compile {keyword}",
    "Pull together {keyword}",
    "Get all {keyword}",
  ],
  record: [
    "Record {keyword}",
    "Save {keyword}",
    "Store {keyword}",
    "Log {keyword}",
    "Document {keyword}",
    "Archive {keyword}",
    "Keep a record of {keyword}",
  ],
  learn: [
    "Learn about {keyword}",
    "Study {keyword}",
    "Research {keyword}",
    "Understand {keyword}",
    "Read up on {keyword}",
    "Investigate {keyword}",
    "Explore {keyword}",
  ],
  decide: [
    "Decide on {keyword}",
    "Resolve {keyword}",
    "Determine {keyword}",
    "Choose {keyword}",
    "Evaluate {keyword}",
    "Assess {keyword}",
    "Judge {keyword}",
  ],
  enable: [
    "Enable {keyword}",
    "Activate {keyword}",
    "Turn on {keyword}",
    "Unlock {keyword}",
    "Grant access to {keyword}",
    "Allow {keyword}",
    "Set up {keyword}",
  ],
  judge: [
    "Evaluate {keyword}",
    "Review {keyword}",
    "Assess {keyword}",
    "Rate {keyword}",
    "Grade {keyword}",
    "Check {keyword}",
    "Audit {keyword}",
  ],
  ask: [
    "What is {keyword}?",
    "Tell me about {keyword}",
    "How does {keyword} work?",
    "Can you explain {keyword}?",
    "What's the status of {keyword}?",
    "Is {keyword} ready?",
    "When is {keyword}?",
  ],
};

const MODIFIER_TEMPLATES: { key: string; phrases: string[] }[] = [
  { key: "time:tomorrow", phrases: ["tomorrow", "by tomorrow"] },
  { key: "time:today", phrases: ["today", "by end of day"] },
  { key: "time:next_week", phrases: ["next week", "by next week"] },
  { key: "time:asap", phrases: ["as soon as possible", "urgently"] },
  { key: "target:team", phrases: ["with the team", "to the team"] },
  { key: "target:manager", phrases: ["to the manager", "for the manager"] },
  {
    key: "topic:project",
    phrases: ["about the project", "regarding the project"],
  },
];

/**
 * Generate template-expanded training examples.
 * Picks a representative keyword from each root, crosses with intents and modifiers.
 */
export function generateTemplateExamples(options: {
  maxPerRoot?: number;
  maxTotal?: number;
}): TrainingExample[] {
  const { maxPerRoot = 5, maxTotal = 5000 } = options;
  const examples: TrainingExample[] = [];
  let globalId = 0;

  for (const rootData of ALL_ROOT_DATA) {
    if (examples.length >= maxTotal) break;

    // Pick a few representative English keywords
    const keywords = rootData.keywords
      .filter((k) => /^[a-z]/.test(k))
      .slice(0, 3);

    if (keywords.length === 0) continue;

    let count = 0;
    for (const intent of Object.keys(INTENT_TEMPLATES) as IntentOperator[]) {
      if (count >= maxPerRoot || examples.length >= maxTotal) break;

      const templates = INTENT_TEMPLATES[intent];
      const keyword = keywords[count % keywords.length];
      const template = templates[count % templates.length];
      const inputText = template.replace("{keyword}", keyword);

      // Optionally add a modifier
      const modIdx = globalId % MODIFIER_TEMPLATES.length;
      const modifier = MODIFIER_TEMPLATES[modIdx];
      const withModifier = `${inputText} ${modifier.phrases[0]}`;

      // Run through the engine
      try {
        const token = encodeLocal(withModifier);
        const reasoning = engine.reason(token);
        const domain = rootData.domain;

        const inputSer = serializeInput(token);
        const outputSer = serializeOutput(reasoning, domain);

        examples.push({
          id: `tmpl-${String(globalId).padStart(5, "0")}`,
          inputText: withModifier,
          inputTokens: inputSer.tokens,
          inputIds: inputSer.ids,
          outputTokens: outputSer.tokens,
          outputIds: outputSer.ids,
          metadata: {
            sourceLang: "en",
            domain,
            intent: token.intent,
            root: token.root,
            pattern: token.pattern,
            action: reasoning.actionType,
            confidence: reasoning.confidence,
            source: "template",
          },
        });

        globalId++;
        count++;
      } catch {
        continue;
      }
    }
  }

  return examples;
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Export training examples as JSONL (one JSON object per line).
 * Standard format for model training.
 */
export function toJSONL(examples: TrainingExample[]): string {
  return examples
    .map((ex) =>
      JSON.stringify({
        id: ex.id,
        input_tokens: ex.inputTokens,
        input_ids: ex.inputIds,
        output_tokens: ex.outputTokens,
        output_ids: ex.outputIds,
        domain: ex.metadata.domain,
        source_lang: ex.metadata.sourceLang,
        source: ex.metadata.source,
      }),
    )
    .join("\n");
}

/**
 * Export vocabulary as JSON for the model.
 */
export function exportVocabulary(): string {
  const vocab = getVocabulary();
  return JSON.stringify(
    {
      vocab: vocab.toJSON(),
      stats: vocab.stats(),
      size: vocab.size,
    },
    null,
    2,
  );
}

/**
 * Corpus statistics summary.
 */
export function corpusStats(examples: TrainingExample[]): {
  total: number;
  bySource: Record<string, number>;
  byDomain: Record<string, number>;
  byIntent: Record<string, number>;
  byAction: Record<string, number>;
  avgInputLen: number;
  avgOutputLen: number;
} {
  const bySource: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byIntent: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  let totalInputLen = 0;
  let totalOutputLen = 0;

  for (const ex of examples) {
    bySource[ex.metadata.source] = (bySource[ex.metadata.source] ?? 0) + 1;
    byDomain[ex.metadata.domain] = (byDomain[ex.metadata.domain] ?? 0) + 1;
    byIntent[ex.metadata.intent] = (byIntent[ex.metadata.intent] ?? 0) + 1;
    byAction[ex.metadata.action] = (byAction[ex.metadata.action] ?? 0) + 1;
    totalInputLen += ex.inputTokens.length;
    totalOutputLen += ex.outputTokens.length;
  }

  return {
    total: examples.length,
    bySource,
    byDomain,
    byIntent,
    byAction,
    avgInputLen: examples.length ? totalInputLen / examples.length : 0,
    avgOutputLen: examples.length ? totalOutputLen / examples.length : 0,
  };
}
