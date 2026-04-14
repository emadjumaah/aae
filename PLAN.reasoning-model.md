# Arabic Algebra as Reasoning Tokenizer — Architecture Plan

> **Status**: Active research direction. Prototype vocabulary + serializer + corpus builder implemented.
> **Last updated**: April 2026

---

## Core Hypothesis

> If the token vocabulary already encodes semantic relationships (via Arabic root × pattern composition), a small model needs far fewer parameters to reason correctly.

### Sub-hypotheses

1. **Structured tokenization reduces model capacity.** A 10M parameter model trained on ~3,000 algebra tokens achieves accuracy comparable to a 1B parameter model trained on 50,000+ BPE tokens for the same reasoning tasks.
2. **Arabic morphology is the optimal substrate.** The triconsonantal root system's compositionality gives it an advantage over English-derived or synthetic token systems for encoding semantic relationships.
3. **Language-independent reasoning.** The algebra layer is the same regardless of input/output language — only the encoder/decoder edges change.

---

## Full Architecture

```
 ┌──────────────────────────────────────────────────────────────┐
 │                    LANGUAGE-SPECIFIC EDGES                    │
 │                                                              │
 │  English ─→ [EN Encoder] ──┐                                 │
 │  Arabic  ─→ [AR Encoder] ──┤    ┌────────────────────────┐   │
 │  French  ─→ [FR Encoder] ──┼───→│  Algebra Token Sequence │   │
 │  Any     ─→ [XX Encoder] ──┘    │  (language-independent) │   │
 │                                  └──────────┬─────────────┘   │
 │                                             │                 │
 │                    ┌────────────────────────┐│                 │
 │                    │  REASONING CORE        ││                 │
 │                    │  (language-independent) ││                 │
 │                    │                        ▼│                 │
 │                    │  ┌─────────────────────┐│                 │
 │                    │  │ Tiny Transformer     ││                 │
 │                    │  │ 1-20M params         ││                 │
 │                    │  │ ~3,000 token vocab   ││                 │
 │                    │  │ Never sees raw text  ││                 │
 │                    │  └────────┬────────────┘│                 │
 │                    │           │             │                 │
 │                    └───────────┼─────────────┘                 │
 │                                │                               │
 │                    ┌───────────▼──────────────┐                │
 │                    │  Algebra Output Sequence  │                │
 │                    └──────────┬───────────────┘                │
 │                               │                                │
 │  ┌────────────────────────────┼──────────────────────────┐     │
 │  │                            │                          │     │
 │  ▼                            ▼                          ▼     │
 │ [EN Decoder]              [AR Decoder]             [XX Decoder]│
 │  ↓                            ↓                          ↓     │
 │ English output            Arabic output            Any output  │
 └──────────────────────────────────────────────────────────────┘
```

### Why this works (the translation question)

The encoder does **NOT** do full translation. It does something much simpler:

```
"Schedule a meeting with the team tomorrow"
    ↓ (extract: what action? what concept? what role? what context?)
[I:seek  R:جمع  P:mutual  MK:time  MV:time:tomorrow  MK:target  LIT:team]
```

This is **semantic extraction**, not translation. The encoder needs to answer 4 questions:

1. **What does the user want?** → intent (seek, do, send...)
2. **What concept is involved?** → root (جمع = gathering, كتب = writing...)
3. **What role/perspective?** → pattern (agent, patient, place...)
4. **What context?** → modifiers (time, target, topic...)

These 4 questions are answerable with keyword matching (current approach) or a small classifier. No full translation needed.

The decoder is equally simple — it takes the algebra output and fills templates in the target language. Fluent output can use a small LLM, but structured output (JSON actions, API calls) needs no LLM at all.

---

## The Arabic Language Coverage Problem

Arabic text has three word classes that need different handling:

### Class 1: Root-derived words (~85% of Arabic text)

These are the core of the algebra. Every Arabic word derived from a root maps to an algebra token.

```
كاتب (writer)  → R:كتب × P:agent
مكتبة (library) → R:كتب × P:place
اجتماع (meeting) → R:جمع × P:instance
```

**With 500 roots**: covers ~95% of modern professional Arabic vocabulary.

### Class 2: Function words / particles (~12% of Arabic text)

Prepositions, conjunctions, particles — these are NOT derived from roots.

```
في (in), على (on), إلى (to), من (from) → become modifier keys: MK:location, MK:source
لكن (but), إذا (if), لأن (because) → become relations: REL:BUT, REL:IF, REL:BECAUSE
و (and), ثم (then), أو (or) → become connectives: REL:AND, REL:THEN, REL:OR
```

These map directly to **structural tokens** — they don't need the algebra, they ARE the connective tissue.

### Class 3: Pronouns and deictics (~3% of Arabic text)

```
أنا (I), أنت (you), هو (he) → REF:self, REF:addressee, REF:other
هذا (this), ذلك (that) → REF:proximal, REF:distal
```

### Total vocabulary structure (with 500 roots):

| Layer         | Category         | Count                                 | What it covers                               |
| ------------- | ---------------- | ------------------------------------- | -------------------------------------------- |
| **Algebra**   | Root tokens      | 500                                   | All root-derived words (~85% of Arabic)      |
| **Algebra**   | Pattern tokens   | 10-15                                 | Morphological operators                      |
| **Algebra**   | Intent tokens    | 10-15                                 | User goal categories                         |
| **Algebra**   | Domain tokens    | 25-30                                 | Semantic field groupings                     |
| **Structure** | Relations        | 15-20                                 | Logical connectives (و، لكن، إذا...)         |
| **Structure** | Prepositions     | 15-20                                 | Spatial/temporal relations (في، على، إلى...) |
| **Structure** | Pronouns/Refs    | 10-15                                 | Anaphora and deixis                          |
| **Structure** | Sequence markers | 5-10                                  | Flow control                                 |
| **Modifiers** | Modifier keys    | 10-15                                 | Slot names                                   |
| **Modifiers** | Modifier values  | 30-50                                 | Common values (time, urgency)                |
| **Output**    | Action types     | 20-30                                 | Reasoning conclusions                        |
| **Output**    | Confidence       | 3-5                                   | Certainty levels                             |
| **Meta**      | Special tokens   | 5                                     | PAD, UNK, BOS, EOS, MASK                     |
| **Open**      | Literals         | dynamic                               | Proper nouns, numbers, unknowns              |
|               | **TOTAL**        | **~700-750** fixed + dynamic literals |                                              |

This is still **50-70× smaller** than BPE (50,000+) but now covers the full Arabic language structure.

---

## Root Expansion Plan: 152 → 500

### Current coverage (152 roots × 15 domains)

| Domain                  | Current | Target   | Missing areas                                      |
| ----------------------- | ------- | -------- | -------------------------------------------------- |
| communication           | 15      | 30       | rhetoric, debate, interpret, announce, whisper     |
| action                  | 14      | 35       | manufacture, construct, repair, demolish, assemble |
| spatial                 | 12      | 25       | navigate, border, surround, elevate, descend       |
| social                  | 12      | 25       | govern, elect, represent, marry, divorce           |
| commerce                | 12      | 30       | invest, profit, bankrupt, insure, audit            |
| cognition               | 12      | 25       | imagine, doubt, remember, forget, calculate        |
| time                    | 10      | 15       | schedule, postpone, hasten, age, renew             |
| learning                | 10      | 20       | experiment, specialize, graduate, certify          |
| creation                | 10      | 20       | innovate, design, compose, sculpt, engineer        |
| security                | 8       | 20       | encrypt, surveil, defend, attack, detect           |
| information             | 8       | 15       | index, archive, classify, compress, transmit       |
| emotion                 | 8       | 15       | love, hate, fear, hope, grieve                     |
| decision                | 8       | 15       | legislate, veto, arbitrate, appeal                 |
| seeking                 | 7       | 10       | explore, investigate, probe, survey                |
| general                 | 6       | 10       | exist, begin, end, change, equal                   |
| **NEW: medicine**       | 0       | 25       | diagnose, treat, heal, infect, operate, prescribe  |
| **NEW: law**            | 0       | 20       | prosecute, defend, witness, contract, inherit      |
| **NEW: technology**     | 0       | 25       | compute, program, network, automate, digitize      |
| **NEW: nature/science** | 0       | 20       | grow, flow, burn, freeze, dissolve                 |
| **NEW: transport**      | 0       | 15       | fly, sail, drive, load, deliver                    |
| **NEW: construction**   | 0       | 15       | build, demolish, plan, survey, pave                |
| **NEW: agriculture**    | 0       | 15       | plant, harvest, irrigate, fertilize, breed         |
|                         | **152** | **~500** |                                                    |

### Expansion strategy

1. **Phase 1 (→ 300 roots)**: Expand existing 15 domains to full coverage. Use Hans Wehr dictionary + Buckwalter analyzer as sources. Each root must have: arabic, latin, domain, semanticField, resource, covers, keywords (EN+AR).
2. **Phase 2 (→ 500 roots)**: Add 7 new professional domains (medicine, law, technology, science, transport, construction, agriculture).
3. **Validation**: Each new root must pass: (a) is genuinely triconsonantal, (b) has productive modern derivatives, (c) does not overlap semantically with existing roots in same domain.

---

## Corpus Building Strategy

### Phase A: Convert existing test cases (~125 examples) ✅ DONE

- Benchmark + test cases → algebra token sequences
- 125 examples converted successfully

### Phase B: Template expansion (~5,000 examples) ✅ PARTIAL (760 done)

- For each root × pattern × modifier combination, generate variations
- Use existing keyword lists to create synthetic inputs
- Deterministic — no LLM needed
- Scale to full 500 roots after expansion

### Phase C: LLM-assisted generation (~50,000 examples)

- Use GPT-4/Claude to generate diverse natural language inputs
- Run through encoder → serialize → verify
- Filter for quality: only keep examples where encoder confidence > 0.8
- Generate in multiple languages (EN, AR, FR) to train multilingual encoders

### Phase D: Real-world data collection

- Collect actual user utterances from deployed prototypes
- Manual annotation by bilingual speakers
- Adversarial examples from Arabic dialect speakers

## Success Criteria

| Metric               | Target                                                         |
| -------------------- | -------------------------------------------------------------- |
| Root coverage        | 500 roots across 22+ domains                                   |
| Tiny model params    | < 20M                                                          |
| Accuracy on test set | ≥ 90% of current engine                                        |
| Inference time       | < 50ms on CPU                                                  |
| Generalization       | Handle paraphrases not in training data                        |
| Key comparison       | 10M algebra-tokenized model vs 1B raw-text model on same tasks |
| Language coverage    | EN + AR encoders validated, FR experimental                    |

## Implementation Status

| Component                  | File                          | Status                                         |
| -------------------------- | ----------------------------- | ---------------------------------------------- |
| Token vocabulary           | `src/reasoning/vocabulary.ts` | ✅ Done (460 tokens, will grow with 500 roots) |
| Serializer                 | `src/reasoning/serializer.ts` | ✅ Done                                        |
| Corpus builder             | `src/reasoning/corpus.ts`     | ✅ Done                                        |
| Corpus generator           | `src/reasoning/generate.ts`   | ✅ Done (885 examples generated)               |
| Root expansion (→500)      | `src/data/roots.ts`           | 🔲 Planned                                     |
| Non-root token layer       | `src/reasoning/vocabulary.ts` | 🔲 Planned                                     |
| Multilingual encoders      | `src/encoders/`               | 🔲 Planned                                     |
| Model training             | `training/` (Python)          | 🔲 Planned                                     |
| Inference bridge           | `src/reasoning/inference.ts`  | 🔲 Planned                                     |
| Practical deployment guide | `GUIDE.md`                    | 🔲 Planned                                     |
