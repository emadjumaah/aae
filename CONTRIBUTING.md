# Contributing to Arabic Algebra Engine

Thank you for your interest in contributing. This is a research prototype — contributions that improve the engine, expand the root dictionary, or strengthen the test suite are welcome.

## Getting Started

```bash
git clone https://github.com/emadjumaah/arabic-algebra-engine.git
cd arabic-algebra-engine
npm install

# Run all tests (212 tests across 4 suites)
npm test

# Start the CLI
npm run dev "Schedule a meeting with the team"

# Start the web app
cd web && npm install && npm run dev
```

## Project Layout

The project has two main areas:

- **`src/engine/`** — The runtime engine (encoder, decoder, symbolic reasoning, agent system)
- **`src/training/`** — The training pipeline (vocabulary, serializer, corpus generator)

Tests are in `src/tests/`. Run them before submitting any PR.

## How to Contribute

### Expanding the Root Dictionary

The most impactful contribution is adding new roots. Each root needs:

```typescript
{
  arabic: "جذر",          // Arabic triconsonantal root
  latin: "j-dh-r",       // Latin transliteration (x-x-x format)
  domain: "nature",       // One of the 29 semantic domains
  semanticField: "root / origin / foundation",
  resource: "botanical resource",
  covers: "root, origin, foundation, radical",
  keywords: ["root", "origin", "foundation", "جذر", "أصل", "أساس"],
}
```

Root data files are in `src/engine/data/roots-*.ts`. Add roots to the appropriate domain file. Run `npm test` to verify no duplicates or format issues — the test suite checks data integrity.

### Adding Action Rules

The engine has 74 of 100 possible intent × pattern rules. The remaining 26 fall back to a generic "process" action. If you can define a meaningful action for a missing combination, add it to `ACTION_RULES` in `src/engine/core/engine.ts`.

### Improving the Encoder

The encoder in `src/engine/core/encoder.ts` uses 5 layers of deterministic attention. Contributions could include:

- New co-occurrence disambiguation pairs
- Better Arabic keyword coverage
- Improved pattern detection heuristics

### Writing Tests

The test suite in `src/tests/core.test.ts` has 140 tests. Areas that could use more coverage:

- Arabic-only input edge cases
- Mixed-language inputs
- Agent system scenarios

## Code Style

- TypeScript, strict mode
- No runtime dependencies in the engine (zero-dep is a design constraint)
- Functions over classes where possible
- Comments for non-obvious logic only

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm test` — all 212+ tests must pass
4. Write a clear PR description explaining what and why
5. One feature/fix per PR

## Reporting Issues

Open an issue with:

- What you tried (input text)
- What you expected
- What happened instead
- Whether the input is English, Arabic, or mixed

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
