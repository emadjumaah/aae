#!/usr/bin/env node
/**
 * Expand training corpus using Ollama (local LLM).
 *
 * Uses qwen2.5:0.5b via Ollama to generate diverse natural language
 * paraphrases of existing examples, then runs them through the
 * algebra encoder to produce new training pairs.
 *
 * Run: npx tsx training/expand-corpus.ts
 */

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeLocal } from "../src/engine/core/encoder.js";
import { engine } from "../src/engine/core/engine.js";
import { ALL_ROOT_DATA } from "../src/engine/data/roots.js";
import { serializeInput, serializeOutput } from "../src/training/serializer.js";
import type { TrainingExample } from "../src/training/corpus.js";
import type { IntentOperator } from "../src/engine/core/types.js";

// ─── Ollama API ────────────────────────────────────────────────────────────

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen2.5:0.5b";

async function askOllama(prompt: string): Promise<string> {
  const resp = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.8, num_predict: 512 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = (await resp.json()) as { response: string };
  return data.response;
}

// ─── Prompt Templates ──────────────────────────────────────────────────────

function buildPrompt(
  rootArabic: string,
  rootLatin: string,
  covers: string,
  domain: string,
  intent: IntentOperator,
): string {
  return `Generate exactly 8 different English sentences that a user might say when they want to "${intent}" something related to "${covers}" (domain: ${domain}).

Rules:
- Each sentence on its own line, numbered 1-8
- Mix formal and informal styles
- Some short (3-6 words), some longer (8-15 words)
- Include time references (tomorrow, next week, now, etc.) in some
- Include target references (team, manager, client, etc.) in some
- NO explanations, just the sentences

Examples of good output:
1. Schedule a meeting tomorrow
2. Set up a quick team sync
3. Can we meet next week to discuss this?

Now generate 8 sentences for intent="${intent}", concept="${covers}":`;
}

// ─── Process one root ──────────────────────────────────────────────────────

async function expandRoot(
  rootData: { arabic: string; latin: string; covers: string; domain: string },
  intent: IntentOperator,
  batchId: number,
): Promise<TrainingExample[]> {
  const prompt = buildPrompt(
    rootData.arabic,
    rootData.latin,
    rootData.covers,
    rootData.domain,
    intent,
  );
  let response: string;
  try {
    response = await askOllama(prompt);
  } catch (e) {
    console.error(`  Ollama failed for ${rootData.latin}/${intent}: ${e}`);
    return [];
  }

  // Parse numbered lines
  const lines = response
    .split("\n")
    .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(
      (l) =>
        l.length > 5 &&
        l.length < 200 &&
        !l.startsWith("Note") &&
        !l.startsWith("Here"),
    );

  const examples: TrainingExample[] = [];

  for (let i = 0; i < lines.length; i++) {
    const inputText = lines[i];
    try {
      const token = encodeLocal(inputText);
      const reasoning = engine.reason(token);
      const domain =
        ALL_ROOT_DATA.find((r) => r.arabic === token.root)?.domain ?? "general";

      // Only keep if confidence is reasonable
      if (reasoning.confidence < 0.5) continue;

      const inputSer = serializeInput(token);
      const outputSer = serializeOutput(reasoning, domain);

      examples.push({
        id: `ollama-${String(batchId).padStart(5, "0")}-${i}`,
        inputText,
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
          source: "manual" as const, // "manual" is closest to LLM-generated
        },
      });
    } catch {
      continue;
    }
  }

  return examples;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("Arabic Algebra — Corpus Expansion via Ollama\n");
  console.log(`Model: ${MODEL}`);
  console.log(`Ollama: ${OLLAMA_URL}\n`);

  // Check Ollama is running
  try {
    await askOllama("Say hello in one word.");
    console.log("Ollama connection: OK\n");
  } catch (e) {
    console.error("Cannot connect to Ollama. Is it running? (ollama serve)");
    process.exit(1);
  }

  const intents: IntentOperator[] = [
    "seek",
    "do",
    "send",
    "gather",
    "record",
    "learn",
    "decide",
    "ask",
  ];

  // Sample roots across domains (use every 3rd root for faster generation)
  const sampleRoots = ALL_ROOT_DATA.filter((_, i) => i % 3 === 0);
  const totalBatches = sampleRoots.length * intents.length;

  console.log(
    `Generating for ${sampleRoots.length} roots × ${intents.length} intents = ${totalBatches} batches\n`,
  );

  const allExamples: TrainingExample[] = [];
  let batchId = 0;

  for (const root of sampleRoots) {
    for (const intent of intents) {
      process.stdout.write(
        `  [${batchId + 1}/${totalBatches}] ${root.latin} × ${intent}...`,
      );
      const examples = await expandRoot(
        {
          arabic: root.arabic,
          latin: root.latin,
          covers: root.covers,
          domain: root.domain,
        },
        intent,
        batchId,
      );
      allExamples.push(...examples);
      console.log(` +${examples.length} (total: ${allExamples.length})`);
      batchId++;
    }
  }

  // Load existing corpus and merge
  const corpusDir = join(import.meta.dirname ?? ".", "../data/corpus");
  const existingPath = join(corpusDir, "train.jsonl");
  const existingLines = readFileSync(existingPath, "utf-8").trim().split("\n");
  const existingCount = existingLines.length;

  console.log(`\nExisting corpus: ${existingCount} examples`);
  console.log(`New examples:    ${allExamples.length}`);
  console.log(`Total:           ${existingCount + allExamples.length}`);

  // Write expanded corpus
  const newLines = allExamples.map((ex) =>
    JSON.stringify({
      id: ex.id,
      input_tokens: ex.inputTokens,
      input_ids: ex.inputIds,
      output_tokens: ex.outputTokens,
      output_ids: ex.outputIds,
      domain: ex.metadata.domain,
      source_lang: ex.metadata.sourceLang,
      source: "ollama",
    }),
  );

  const expandedPath = join(corpusDir, "train-expanded.jsonl");
  writeFileSync(
    expandedPath,
    [...existingLines, ...newLines].join("\n"),
    "utf-8",
  );
  console.log(`\nWritten: ${expandedPath}`);

  // Stats
  const domainCounts: Record<string, number> = {};
  for (const ex of allExamples) {
    domainCounts[ex.metadata.domain] =
      (domainCounts[ex.metadata.domain] ?? 0) + 1;
  }
  console.log("\nNew examples by domain:", domainCounts);
  console.log("\nDone!");
}

main().catch(console.error);
