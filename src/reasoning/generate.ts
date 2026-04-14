/**
 * Arabic Algebra — Corpus Generator Runner
 *
 * Run: npx tsx src/reasoning/generate.ts
 *
 * Generates training data from:
 *   1. Existing benchmark cases
 *   2. Template expansion
 * Exports to data/corpus/ as JSONL + vocabulary JSON.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  INTENT_CASES,
  ACTION_CASES,
  DISAMBIGUATION_CASES,
  ADVERSARIAL_CASES,
  BILINGUAL_CASES,
  CONSISTENCY_CASES,
} from "../../benchmark/dataset.js";

import {
  fromBenchmarkCase,
  generateTemplateExamples,
  toJSONL,
  exportVocabulary,
  corpusStats,
  type TrainingExample,
} from "./corpus.js";

import { getVocabulary } from "./vocabulary.js";

// ─── Output Directory ──────────────────────────────────────────────────────

const OUT_DIR = join(import.meta.dirname ?? ".", "../../data/corpus");
mkdirSync(OUT_DIR, { recursive: true });

// ─── Phase A: Benchmark Cases ──────────────────────────────────────────────

console.log("Phase A: Converting benchmark cases...\n");

const benchmarkInputs = [
  ...INTENT_CASES,
  ...ACTION_CASES,
  ...DISAMBIGUATION_CASES,
  ...ADVERSARIAL_CASES,
];

// Also handle bilingual pairs
const bilingualInputs = BILINGUAL_CASES.flatMap((bp) => [
  { id: `${bp.id}-en`, input: bp.english, expected: bp.expected },
  { id: `${bp.id}-ar`, input: bp.arabic, expected: bp.expected },
]);

// Consistency — each variant is a separate case
const consistencyInputs = CONSISTENCY_CASES.flatMap((cg) =>
  cg.variants.map((v: string, i: number) => ({
    id: `${cg.id}-v${i}`,
    input: v,
    expected: cg.expected,
  })),
);

const allBenchmark = [
  ...benchmarkInputs,
  ...bilingualInputs,
  ...consistencyInputs,
];

const benchExamples: TrainingExample[] = [];
let skipped = 0;

for (const bc of allBenchmark) {
  const ex = fromBenchmarkCase(bc);
  if (ex) {
    benchExamples.push(ex);
  } else {
    skipped++;
  }
}

console.log(
  `  Converted: ${benchExamples.length} / ${allBenchmark.length} (skipped: ${skipped})`,
);

// ─── Phase B: Template Expansion ───────────────────────────────────────────

console.log("\nPhase B: Generating template examples...\n");

const templateExamples = generateTemplateExamples({
  maxPerRoot: 5,
  maxTotal: 3000,
});

console.log(`  Generated: ${templateExamples.length} template examples`);

// ─── Combine & Export ──────────────────────────────────────────────────────

const allExamples = [...benchExamples, ...templateExamples];

console.log("\n─── Corpus Stats ───\n");
const stats = corpusStats(allExamples);
console.log(`  Total examples: ${stats.total}`);
console.log(`  By source:`, stats.bySource);
console.log(`  By domain:`, stats.byDomain);
console.log(`  By intent:`, stats.byIntent);
console.log(`  By action:`, stats.byAction);
console.log(`  Avg input length:  ${stats.avgInputLen.toFixed(1)} tokens`);
console.log(`  Avg output length: ${stats.avgOutputLen.toFixed(1)} tokens`);

// Write JSONL
const jsonlPath = join(OUT_DIR, "train.jsonl");
writeFileSync(jsonlPath, toJSONL(allExamples), "utf-8");
console.log(`\n  Written: ${jsonlPath}`);

// Write vocabulary
const vocabPath = join(OUT_DIR, "vocabulary.json");
writeFileSync(vocabPath, exportVocabulary(), "utf-8");
const vocab = getVocabulary();
console.log(`  Written: ${vocabPath} (${vocab.size} tokens)`);

// Write stats
const statsPath = join(OUT_DIR, "stats.json");
writeFileSync(statsPath, JSON.stringify(stats, null, 2), "utf-8");
console.log(`  Written: ${statsPath}`);

// Write a few sample examples for inspection
const samplePath = join(OUT_DIR, "samples.json");
const samples = allExamples.slice(0, 10).map((ex) => ({
  id: ex.id,
  inputText: ex.inputText,
  inputTokens: ex.inputTokens,
  outputTokens: ex.outputTokens,
  domain: ex.metadata.domain,
  intent: ex.metadata.intent,
  action: ex.metadata.action,
}));
writeFileSync(samplePath, JSON.stringify(samples, null, 2), "utf-8");
console.log(`  Written: ${samplePath}`);

console.log("\nDone! Corpus ready for training.\n");
