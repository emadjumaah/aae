/**
 * Arabic Algebra — Training Data Serializer
 *
 * Bridge between raw text examples and model-ready training JSONL.
 *
 * Takes: handcrafted-v1.json and/or massive-converted.jsonl
 * Produces: train-ready JSONL with input_ids / output_ids
 *
 * Pipeline per example:
 *   1. encodeLocal(input_text) → AlgebraToken (real decomposition)
 *   2. serializeInput(token) → input_ids
 *   3. Construct ReasoningResult with expected_action → serializeOutput → output_ids
 *   4. Write JSONL line
 *
 * Usage:
 *   npx tsx src/training/serialize-data.ts
 *   npx tsx src/training/serialize-data.ts --input training/massive-converted.jsonl
 *   npx tsx src/training/serialize-data.ts --combine   # merge handcrafted + massive
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { encodeLocal } from "../engine/core/encoder.js";
import type { ReasoningResult, ActionType } from "../engine/core/types.js";
import { serializeInput, serializeOutput } from "./serializer.js";
import { getVocabulary } from "./vocabulary.js";
import { exportVocabulary } from "./corpus.js";
import { ALL_ROOT_DATA } from "../engine/data/roots.js";

// ─── Config ────────────────────────────────────────────────────────────────

const ROOT_DIR = resolve(import.meta.dirname ?? ".", "../..");
const DATA_DIR = join(ROOT_DIR, "data", "corpus");
const TRAINING_DIR = join(ROOT_DIR, "training");

mkdirSync(DATA_DIR, { recursive: true });

// ─── Types ─────────────────────────────────────────────────────────────────

interface RawExample {
  input_text: string;
  expected_action: string;
  domain: string;
  notes?: string;
  modifiers?: Record<string, string>;
  id?: string;
  scenario?: string;
  intent?: string;
}

interface SerializedExample {
  id: string;
  input_text: string;
  input_tokens: string[];
  input_ids: number[];
  output_tokens: string[];
  output_ids: number[];
  domain: string;
  expected_action: string;
  source: string;
}

// ─── Domain Map ────────────────────────────────────────────────────────────
// Vocabulary tokens use r.domain (e.g., "communication"), NOT r.resource
// (e.g., "message / communication"). We must use domain for D: tokens.

const DOMAIN_MAP: Record<string, string> = Object.fromEntries(
  ALL_ROOT_DATA.map((r) => [r.arabic, r.domain]),
);

// ─── Core Serialization ────────────────────────────────────────────────────

function serializeExample(
  raw: RawExample,
  index: number,
  source: string,
): SerializedExample | null {
  try {
    // Step 1: Encode the raw input text through the real encoder
    const token = encodeLocal(raw.input_text);

    // Step 2: Serialize the input side (AlgebraToken → token IDs)
    const input = serializeInput(token);

    // Step 3: Build a ReasoningResult with the EXPECTED action
    // This is the ground truth that the model should learn to produce
    const actionType = raw.expected_action as ActionType;
    const resource = raw.domain ?? "general";

    const result: ReasoningResult = {
      token,
      actionType,
      resource,
      constraints: [],
      resolvedIntent: `${actionType} via ${token.root}`,
      confidence: 0.8, // Ground truth gets high confidence
    };

    // Use the vocabulary-compatible domain label (r.domain, not r.resource)
    const domain = DOMAIN_MAP[token.root] ?? raw.domain ?? "general";

    // Step 4: Serialize the output side (ReasoningResult → token IDs)
    const output = serializeOutput(result, domain);

    return {
      id: `${source}-${String(index).padStart(5, "0")}`,
      input_text: raw.input_text,
      input_tokens: input.tokens,
      input_ids: input.ids,
      output_tokens: output.tokens,
      output_ids: output.ids,
      domain,
      expected_action: actionType,
      source,
    };
  } catch (err) {
    console.warn(
      `⚠ Failed to serialize: "${raw.input_text}" — ${(err as Error).message}`,
    );
    return null;
  }
}

// ─── File Loaders ──────────────────────────────────────────────────────────

function loadJSON(path: string): RawExample[] {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

function loadJSONL(path: string): RawExample[] {
  const raw = readFileSync(path, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf("--input");
  const combine = args.includes("--combine");

  const allExamples: SerializedExample[] = [];
  let totalRaw = 0;

  // Always load handcrafted data
  const handcraftedPath = join(DATA_DIR, "handcrafted-v1.json");
  if (existsSync(handcraftedPath)) {
    const raw = loadJSON(handcraftedPath);
    totalRaw += raw.length;
    console.log(`📖 Loaded ${raw.length} handcrafted examples`);

    for (let i = 0; i < raw.length; i++) {
      const ex = serializeExample(raw[i], i, "handcrafted");
      if (ex) allExamples.push(ex);
    }
    console.log(
      `   ✓ Serialized ${allExamples.length}/${raw.length} handcrafted`,
    );
  } else {
    console.log(`⚠ No handcrafted data at ${handcraftedPath}`);
  }

  // Load additional input files if specified
  if (inputFlag >= 0 && args[inputFlag + 1]) {
    const inputPath = resolve(args[inputFlag + 1]);
    if (existsSync(inputPath)) {
      const isJsonl =
        inputPath.endsWith(".jsonl") || inputPath.endsWith(".ndjson");
      const raw = isJsonl ? loadJSONL(inputPath) : loadJSON(inputPath);
      totalRaw += raw.length;
      const beforeCount = allExamples.length;

      console.log(`📖 Loaded ${raw.length} examples from ${inputPath}`);

      for (let i = 0; i < raw.length; i++) {
        const ex = serializeExample(raw[i], i, "massive");
        if (ex) allExamples.push(ex);
      }
      console.log(
        `   ✓ Serialized ${allExamples.length - beforeCount}/${raw.length} external`,
      );
    } else {
      console.error(`✗ File not found: ${inputPath}`);
      process.exit(1);
    }
  }

  // Load MASSIVE converted data if --combine
  if (combine) {
    const massivePath = join(DATA_DIR, "massive-train.jsonl");
    if (existsSync(massivePath)) {
      const raw = loadJSONL(massivePath);
      totalRaw += raw.length;
      const beforeCount = allExamples.length;

      console.log(`📖 Loaded ${raw.length} MASSIVE-converted examples`);

      for (let i = 0; i < raw.length; i++) {
        const ex = serializeExample(raw[i], i, "massive");
        if (ex) allExamples.push(ex);
      }
      console.log(
        `   ✓ Serialized ${allExamples.length - beforeCount}/${raw.length} MASSIVE`,
      );
    } else {
      console.log(
        `⚠ No MASSIVE data at ${massivePath}. Run: python3 training/download-massive.py && python3 training/convert-massive.py`,
      );
    }
  }

  if (allExamples.length === 0) {
    console.error("✗ No examples serialized. Check your input data.");
    process.exit(1);
  }

  // ── Write output ──────────────────────────────────────────────────────
  const outPath = join(DATA_DIR, "train-v4.jsonl");
  const lines = allExamples.map((ex) => JSON.stringify(ex)).join("\n");
  writeFileSync(outPath, lines + "\n", "utf-8");
  console.log(`\n✓ Wrote ${allExamples.length} examples → ${outPath}`);

  // ── Action type distribution ──────────────────────────────────────────
  const actionDist: Record<string, number> = {};
  for (const ex of allExamples) {
    actionDist[ex.expected_action] = (actionDist[ex.expected_action] || 0) + 1;
  }
  console.log("\n📊 Action distribution:");
  for (const [action, count] of Object.entries(actionDist).sort(
    (a, b) => b[1] - a[1],
  )) {
    const pct = ((count / allExamples.length) * 100).toFixed(1);
    console.log(`   ${action.padEnd(14)} ${count} (${pct}%)`);
  }

  // ── Domain distribution ───────────────────────────────────────────────
  const domainDist: Record<string, number> = {};
  for (const ex of allExamples) {
    domainDist[ex.domain] = (domainDist[ex.domain] || 0) + 1;
  }
  console.log("\n📊 Domain distribution:");
  for (const [domain, count] of Object.entries(domainDist).sort(
    (a, b) => b[1] - a[1],
  )) {
    const pct = ((count / allExamples.length) * 100).toFixed(1);
    console.log(`   ${domain.padEnd(20)} ${count} (${pct}%)`);
  }

  // ── Save updated vocabulary ───────────────────────────────────────────
  const vocab = getVocabulary();
  const vocabPath = join(DATA_DIR, "vocabulary-v4.json");
  const vocabData = exportVocabulary();
  writeFileSync(vocabPath, vocabData, "utf-8");
  console.log(`\n✓ Vocabulary: ${vocab.size} tokens → ${vocabPath}`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════`);
  console.log(`  Total raw:        ${totalRaw}`);
  console.log(`  Serialized:       ${allExamples.length}`);
  console.log(
    `  Success rate:     ${((allExamples.length / totalRaw) * 100).toFixed(1)}%`,
  );
  console.log(`  Vocabulary size:  ${vocab.size}`);
  console.log(`═══════════════════════════════════`);
}

main();
