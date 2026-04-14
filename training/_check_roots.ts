import { ALL_ROOT_DATA } from "../src/data/roots.js";
import { AlgebraVocabulary } from "../src/reasoning/vocabulary.js";

const v = new AlgebraVocabulary();
console.log("Total roots:", ALL_ROOT_DATA.length);
console.log("Vocab size:", v.size);

const withKw = ALL_ROOT_DATA.filter((r) =>
  r.keywords.some((k: string) => /^[a-z]/i.test(k)),
);
console.log("Roots with English keywords:", withKw.length);

const noEnKw = ALL_ROOT_DATA.filter(
  (r) => !r.keywords.some((k: string) => /^[a-z]/i.test(k)),
);
console.log("Roots WITHOUT English keywords:", noEnKw.length);
if (noEnKw.length > 0)
  console.log(
    "  Examples:",
    noEnKw.slice(0, 5).map((r) => `${r.arabic} (${r.keywords.join(",")})`),
  );

// Count domains
const domains = new Map<string, number>();
for (const r of ALL_ROOT_DATA) {
  domains.set(r.domain, (domains.get(r.domain) ?? 0) + 1);
}
console.log("\nRoots per domain:");
for (const [d, c] of [...domains.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${d}: ${c}`);
}

// Estimate training examples
// expand-massive generates: ~6 intents × 2 keywords × 4 variants = ~48 per root, but with filtering much less
console.log(
  "\nEstimated corpus: ~",
  withKw.length * 8,
  "examples (conservative)",
);
console.log(
  "Estimated corpus: ~",
  withKw.length * 30,
  "examples (if more templates)",
);
