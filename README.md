# الجبر العربي — Arabic Algebra Engine

**A research prototype exploring Arabic triconsonantal root-pattern morphology as a formal basis for symbolic intent resolution.**

> ⚠️ **Status: Research Prototype** — This is an experimental project, not a production system. The benchmark numbers below are measured on a self-authored test set and should be interpreted as proof-of-concept results, not production claims.

**[Interactive Demo →](https://emadjumaah.github.io/aae/)**

---

## What This Project Explores

Arabic has a **triconsonantal root system** — 3-letter consonant roots combine with vowel patterns (أوزان) to produce words in a regular, predictable way. This regularity is structural, not incidental: linguists have studied it as a formal morphological system for decades.

This project asks: **can that morphological regularity serve as a computational formalism for intent resolution?**

The hypothesis:

- **Root (الجذر)** = semantic field. `ك-ت-ب` (k-t-b) = domain of writing/recording.
- **Pattern (الوزن)** = operator. `فَاعِل` (agent) applied to `ك-ت-ب` → كاتب (writer). `مَفْعَلَة` (place) → مكتبة (library).
- **Root × Pattern = AlgebraToken** — a structured intermediate representation that symbolic rules can operate on.

The result is a deterministic, zero-parameter engine that maps natural language → algebraic token → action, with every step traceable.

---

## What Works (and What Doesn't)

### Works Well

- **Deterministic intent resolution** within the curated domain (152 roots, 15 domains, 80 rules)
- **Full interpretability** — every decision traces to a specific root, pattern, and rule
- **Microsecond latency** (~8µs), zero cost, works offline
- **Bilingual input** — handles both English and Arabic for the covered domain

### Known Limitations

- **Coverage is narrow.** 152 hand-curated roots. Outside this set, the engine produces nothing — it doesn't degrade gracefully like an LLM.
- **Benchmark is self-authored.** The 100 test cases were written by the project author for the project's dictionary. High scores on this set are expected, not surprising.
- **Not a fair LLM comparison.** Comparing a lookup table on its own test set against general-purpose models is apples vs. orchards. The benchmark is included to show _what the engine does_, not to claim superiority.
- **Rules are manually curated.** A statistical model would learn similar mappings with less effort and more coverage.

---

## Architecture

```
  "Schedule a meeting with the team tomorrow"        ← English or Arabic
                        ↓
              ┌─────────────────────┐
              │  encodeLocal()       │  ← 5-layer deterministic attention
              │  keyword exclusivity │    (no neural network)
              │  proximity scoring   │
              └────────┬────────────┘
                       ↓
         ┌──────────────────────────┐
         │       AlgebraToken        │
         │  intent:  seek            │
         │  root:    جمع (gathering)  │
         │  pattern: place           │
         │  mods:    [time:tomorrow,  │
         │           target:team]    │
         └────────────┬─────────────┘
                      ↓
              ┌───────────────┐
              │  engine.reason │  ← 80 symbolic rules, pure function
              │  seek × place  │    deterministic lookup
              │     → schedule │
              └───────┬───────┘
                      ↓
         ┌──────────────────────────┐
         │     ReasoningResult       │
         │  action:   schedule       │
         │  confidence: 90%          │
         └──────────────────────────┘
```

---

## Proof-of-Concept Benchmark

100 self-authored test cases across 6 categories. These results demonstrate the engine's behavior within its designed scope — they are **not** a claim of general superiority over LLMs.

| Model                     | Intent | Action | Consistency | Latency | Cost/1K | Offline |
| ------------------------- | ------ | ------ | ----------- | ------- | ------- | ------- |
| **Arabic Algebra Engine** | 99%    | 97%    | 50%         | ~8µs    | $0.00   | Yes     |
| GPT-4o                    | 94%    | 91%    | 78%         | 1,200ms | $7.50   | No      |
| Claude 3.5 Sonnet         | 93%    | 90%    | 82%         | 800ms   | $4.50   | No      |
| Llama 3 70B               | 87%    | 83%    | 75%         | 400ms   | $0.80   | Yes     |
| BERT-base (fine-tuned)    | 89%    | 85%    | 95%         | 15ms    | $0.02   | Yes     |

**Note:** LLMs were never designed for this narrow task. They handle paraphrase, ambiguity, and open-ended generation far better. This comparison exists to illustrate the tradeoff between symbolic and statistical approaches, not to declare a winner.

---

## The Algebra Space

### Roots (الجذور) — 152 roots across 15 semantic domains

| Domain        | Count | Example Roots                                                |
| ------------- | ----- | ------------------------------------------------------------ |
| communication | 15    | كتب (write), رسل (send), قرء (read), سمع (listen)            |
| action        | 14    | عمل (work), فعل (activate), صنع (manufacture), نفذ (execute) |
| cognition     | 12    | علم (learn), فكر (think), فهم (understand), عقل (reason)     |
| commerce      | 12    | بيع (sell), شري (buy), ربح (profit), دين (debt)              |
| social        | 12    | جمع (gather), قسم (divide), نظم (organize), شرك (partner)    |
| spatial       | 12    | دخل (enter), خرج (exit), رجع (return), نقل (transfer)        |
| time          | 10    | وقت (time), بدء (begin), ختم (end), عجل (hurry)              |
| learning      | 10    | درس (study), بحث (search), حفظ (save), ذكر (remember)        |
| creation      | 10    | خلق (create), رسم (draw), شكل (form), بني (build)            |
| security      | 8     | أمن (secure), حمي (protect), خفي (hide), قفل (lock)          |
| decision      | 8     | قرر (decide), خير (choose), وفق (agree), رفض (reject)        |
| emotion       | 8     | حبب (love), كره (hate), فرح (joy), صبر (patience)            |
| information   | 8     | حلل (analyze), خزن (store), عرض (display), فحص (inspect)     |
| seeking       | 7     | سأل (ask), طلب (request), وجد (find), فقد (lose)             |
| general       | 6     | كون (be), قول (say), أخذ (take), ملك (own)                   |

### Patterns (أوزان) — 10 morphological operators

| Pattern (وزن) | Operator    | Meaning                | Example                 |
| ------------- | ----------- | ---------------------- | ----------------------- |
| فَاعِل        | agent       | The one who does       | كاتب (writer)           |
| مَفْعُول      | patient     | Thing acted upon       | مكتوب (letter)          |
| مَفْعَلَة     | place       | Place of action        | مكتبة (library)         |
| فِعَال        | instance    | Single occurrence      | كتاب (book)             |
| فُعُول        | plural      | Collective             | دروس (lessons)          |
| اِسْتِفْعَال  | seek        | Requesting             | استفسار (inquiry)       |
| تَفَاعُل      | mutual      | Reciprocal             | تجمع (gathering)        |
| مُفَاعَلَة    | process     | Ongoing process        | مراسلة (correspondence) |
| فَعَّال       | intensifier | Intensive/professional | عمّال (laborer)         |
| مُفْعِل       | causer      | One who causes         | معلم (teacher)          |

---

## Potential Use Cases (Speculative)

These are domains where the engine's properties (deterministic, interpretable, zero-cost, offline) could theoretically be valuable. **None have been validated with real users or real data yet.**

1. **Arabic NLP preprocessing** — morphological decomposition as a feature layer for ML models (active research area)
2. **Formal intent verification** — domains requiring auditable decision traces (medical, aviation, legal)
3. **Educational tool** — interactive teaching of Arabic morphology through computation
4. **Edge/IoT intent resolution** — constrained devices where LLM inference is impractical
5. **LLM pre-filter** — fast symbolic classification for common intents, routing ambiguous cases to LLMs

---

## Quick Start

```bash
npm install

# Interactive web app (playground, benchmark, use cases)
cd web && npm install && npm run dev

# Run all tests (72 tests)
npm test

# CLI
npm run dev "Schedule a meeting with the team"
```

---

## Project Structure

```
src/
  index.ts              ← Public API
  pipeline.ts           ← Full pipeline orchestration
  main.ts               ← CLI entry point
  core/
    types.ts            ← AlgebraToken, ReasoningResult, type unions
    dictionary.ts       ← Roots and patterns as typed constants
    engine.ts           ← Symbolic reasoning: 80 action rules
    translation.ts      ← Optional LLM edge layer
  data/
    roots.ts            ← 152 roots, 15 domains, ~2,456 keywords
  tests/
    engine.test.ts         ← 15 symbolic engine tests
    standalone.test.ts     ← 25 encoder/decoder/pipeline tests
    domains.test.ts        ← 32 domain coverage tests
    translation.test.ts    ← full pipeline tests (needs API key)
benchmark/
  dataset.ts               ← 100 benchmark cases, 6 categories
  run.ts                   ← benchmark runner + LLM comparison table
  results.json             ← auto-generated benchmark output
  dashboard.html           ← standalone comparison dashboard
web/                       ← Vite app (Vercel-deployable)
  src/pages/               ← Playground, Benchmark, Use Cases
```

---

## Research Directions

If this idea has merit, the next steps are:

1. **External validation** — test on real Arabic text from users who didn't write the test set
2. **Formal paper** — "Arabic Triconsonantal Roots as an Algebraic Basis for Symbolic Intent Resolution"
3. **Coverage expansion** — grow beyond 152 roots, evaluate where the algebra breaks down
4. **Hybrid architecture** — use morphological features as input to ML models, not as a replacement
5. **Cross-linguistic study** — does this generalize to other Semitic languages (Hebrew, Amharic)?

---

## What This Project Is Not

- **Not a product.** It's a research prototype exploring a linguistic-computational hypothesis.
- **Not an LLM replacement.** LLMs handle open-ended language far better. This handles a narrow structured task.
- **Not a claim that Arabic is "better."** It's a claim that Arabic morphology has algebraic regularity that happens to be useful for this specific formalism.

---

## License

ISC
