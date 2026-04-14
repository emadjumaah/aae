# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Engine

- **820 roots** across 29 semantic domains (15 core + 14 expanded)
- **74 action rules** (intent × pattern → action lookup)
- **5-layer deterministic encoder** with contextual attention:
  - Layer 1: Keyword matching with exclusivity weighting
  - Layer 2: Co-occurrence disambiguation (88 context pairs)
  - Layer 3: Proximity attention (5-word context window)
  - Layer 4: Domain coherence (same-domain reinforcement)
  - Layer 5: Intent↔Root cross-attention (bidirectional bias)
- **Arabic tashkeel normalization** — strips diacritical marks for robust matching
- **Zero-match fallback** — returns default root (سأل) when no keywords match
- **Arabic word boundary fix** — Unicode-aware regex for Arabic text
- **Multi-colon modifier parsing** — correctly handles values like `time:3:00pm`

### Agent System

- 3 domains: telecom (24 tools), banking (20 tools), healthcare (20 tools)
- Multi-step intent decomposition
- Tool execution engine with session management

### Training Pipeline

- Algebra-derived vocabulary (~1,750 tokens)
- Bidirectional serializer (AlgebraToken ↔ token sequences ↔ numeric IDs)
- General corpus generator (~52K examples)
- Agent data generator (~43K examples)
- Model config: 20.5M parameters (d=384, 8 heads, 6+6 layers)

### Tests

- 212 tests across 4 suites
  - `engine.test.ts` — 15 symbolic reasoning tests
  - `standalone.test.ts` — 25 encoder/decoder/pipeline tests
  - `domains.test.ts` — 32 domain coverage tests
  - `core.test.ts` — 140 comprehensive robustness tests

### Web

- Interactive playground with live encoding
- Benchmark dashboard
- Use case demonstrations
- Deployed to GitHub Pages

## [0.1.0] — Initial Research Prototype

- Core algebraic formalism (root × pattern × intent)
- 152 roots across 15 domains
- 80 action rules
- Basic keyword encoder
- Benchmark runner with LLM comparison
- Research papers (English and Arabic)
