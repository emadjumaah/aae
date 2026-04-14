/**
 * Arabic Algebra — Reasoning Module
 *
 * Algebra-as-tokenizer infrastructure for training a small reasoning model.
 */

export { AlgebraVocabulary, getVocabulary } from "./vocabulary.js";
export {
  serializeInput,
  serializeOutput,
  deserializeToToken,
  deserializeOutput,
  idsToTokens,
} from "./serializer.js";
export {
  fromBenchmarkCase,
  generateTemplateExamples,
  toJSONL,
  exportVocabulary,
  corpusStats,
} from "./corpus.js";
export type { TrainingExample } from "./corpus.js";
export type { SerializedTokens } from "./serializer.js";
export type { VocabEntry } from "./vocabulary.js";
