# Prompt for Claude Opus — Contextual Semantic Tokenizer: Proof of Concept

---

## Context & Background

We are testing a hypothesis about tokenization for language models.

**The hypothesis:**
> If tokens carry pre-encoded semantic meaning (type, field, role) instead of arbitrary subword fragments, a transformer model can learn language with fewer parameters and less training data — because the vocabulary does work the model would otherwise have to learn.

**The insight came from Arabic morphology:**
Arabic roots (3 consonants) combine with patterns to produce words algebraically.
- Root كتب (writing) × pattern agent = كاتب (writer)
- Root كتب (writing) × pattern place = مكتبة (library)
- Root كتب (writing) × pattern patient = مكتوب (letter)

The same principle applies to English morphology:
- "write" + suffix "-er" = writer (agent)
- "write" + prefix "re-" = rewrite (repeat action)
- "un" + "write" + "able" = unwritable (negated possibility)

**The generalization:**
Every language encodes meaning compositionally in word structure. Instead of BPE (which ignores this structure), we tokenize into typed semantic units:

```
TYPE : SEMANTIC_FIELD : ROLE
```

This is called **Contextual Semantic Tokenization (CST)**.

---

## The Experiment

**Not Arabic. English only for this proof of concept.**

**Comparison:**
- Baseline: GPT-2 architecture (10-30M params) + standard BPE tokenizer
- Experiment: same GPT-2 architecture (same params) + CST tokenizer

**Training data:** English Wikipedia (subset — 1-5GB, freely available)

**Training objective:** next token prediction (identical for both)

**Measure:**
- Perplexity at same training steps
- Downstream task performance (simple classification or QA)
- Token coverage (what % of text gets structured vs literal tokens)

**Success criterion:**
CST model reaches equal or lower perplexity with same parameters and data.
Even a 5-10% improvement is meaningful.
A negative result is also valuable — report it honestly.

---

## What To Build (Proof of Concept Only)

### Phase 1 — The CST Tokenizer (build this first, nothing else until it works)

A Python tokenizer for English text that produces typed semantic tokens.

**Token types:**

```
ROOT:xxx      — semantic field (the core concept)
              Example: ROOT:write  ROOT:send  ROOT:know

ROLE:xxx      — morphological role operator  
              Example: ROLE:agent  ROLE:patient  ROLE:place
                       ROLE:negate  ROLE:repeat  ROLE:possible
                       ROLE:past  ROLE:future  ROLE:plural

CMP:xxx:yyy   — composed token (root × role)
              Example: CMP:write:agent   (= writer)
                       CMP:write:place   (= library, writing desk)
                       CMP:send:patient  (= message, letter)
                       CMP:know:causer   (= teacher)

REL:xxx       — relation between concepts
              Example: REL:to  REL:from  REL:causes  REL:before
                       REL:after  REL:with  REL:without  REL:enables

STR:xxx       — sentence structure marker
              Example: STR:question  STR:negation  STR:condition
                       STR:past  STR:future  STR:emphasis

LIT:xxx       — literal token (proper nouns, numbers, untokenizable)
              Example: LIT:London  LIT:2025  LIT:iPhone

SPECIAL       — [BOS] [EOS] [PAD] [UNK] [SEP]
```

**Tokenization pipeline (run in this order):**

```
Stage 1 — Normalize
  lowercase, fix encoding, normalize punctuation

Stage 2 — NER (Named Entity Recognition)
  detect proper nouns, numbers, dates BEFORE morphology
  tag as LIT: to prevent wrong root extraction
  use spaCy NER (en_core_web_sm) for this

Stage 3 — Structure Detection
  scan for: questions (?), negation (not/never/no/un-),
  conditionals (if/when/unless), tense markers (will/was/were)
  emit STR: tokens at sentence level

Stage 4 — Morphological Decomposition
  use NLTK WordNetLemmatizer + morpheme analysis
  OR use morfessor (unsupervised morpheme segmenter)
  OR use MorphoLex database (English morpheme database)
  
  for each non-NER word:
    extract: root/lemma + affixes
    map affixes to ROLE tokens:
      -er, -or, -ist, -ian → ROLE:agent
      -ee, -ed (passive)   → ROLE:patient  
      -tion, -ment, -ance  → ROLE:instance
      -ery, -ery, -room    → ROLE:place
      un-, non-, -less     → ROLE:negate
      re-                  → ROLE:repeat
      -able, -ible         → ROLE:possible
      -s, -es (plural)     → ROLE:plural
      -ed (past)           → ROLE:past
      will + verb          → ROLE:future

Stage 5 — Token Emission
  if root + role both identified:
    emit CMP:root:role
  elif root identified only:
    emit ROOT:root
  elif NER entity:
    emit LIT:surface_form
  else:
    emit LIT:surface_form  (never UNK if avoidable)

Stage 6 — Relation Detection
  prepositions → REL tokens where mappable:
    to/toward  → REL:to
    from       → REL:from
    because/so → REL:causes
    before     → REL:before
    after      → REL:after
    with       → REL:with
    without    → REL:without
    if/unless  → REL:condition
```

**Semantic field mapping (critical — this is the ROOT vocabulary):**

Do NOT use arbitrary lemmas as ROOT values.
Map lemmas to semantic fields using WordNet or a hand-curated ontology.

```python
# Example semantic field mapping
SEMANTIC_FIELDS = {
    # writing/recording field
    'write': 'write', 'record': 'write', 'document': 'write',
    'note': 'write', 'inscribe': 'write', 'draft': 'write',
    
    # sending/communication field  
    'send': 'send', 'transmit': 'send', 'dispatch': 'send',
    'forward': 'send', 'deliver': 'send', 'mail': 'send',
    
    # knowledge/learning field
    'know': 'know', 'learn': 'know', 'understand': 'know',
    'study': 'know', 'teach': 'know', 'educate': 'know',
    
    # gathering/meeting field
    'meet': 'gather', 'assemble': 'gather', 'collect': 'gather',
    'join': 'gather', 'unite': 'gather', 'gather': 'gather',
    
    # ... etc
}
# If lemma not in map → use lemma directly as ROOT value
# This is fine — coverage improves over time
```

**Concrete tokenization examples:**

```
Input:  "The writer sent a message to the teacher"

Stage 3: no negation, no question, past tense detected
Stage 4: 
  writer  → lemma:write + suffix:-er → root:write, role:agent
  sent    → lemma:send  + past tense → root:send,  role:past
  message → lemma:message + -age suffix → root:send, role:instance
  teacher → lemma:teach  + -er → root:know, role:causer

Output tokens:
[STR:past] [CMP:write:agent] [CMP:send:past] [LIT:a] 
[CMP:send:instance] [REL:to] [CMP:know:causer]

────────────────────────────────────────────────────

Input:  "I can't rewrite the unreadable document"

Stage 3: negation detected (can't), negate prefix detected (un-)
Stage 4:
  can't    → STR:negation
  rewrite  → prefix:re- + root:write → root:write, role:repeat
  un-      → prefix:un- → STR:negation (second negation)
  readable → root:read + suffix:-able → root:read, role:possible
  document → root:document → semantic field write, role:instance

Output tokens:
[STR:negation] [CMP:write:repeat] [LIT:the] 
[STR:negation] [CMP:read:possible] [CMP:write:instance]

────────────────────────────────────────────────────

Input:  "Will the students understand the lesson?"

Stage 3: STR:question (?), STR:future (will)
Stage 4:
  students → root:study + plural → CMP:know:plural
  understand → root:understand → semantic field:know, role:agent
  lesson   → root:learn + -on → semantic field:know, role:instance

Output tokens:
[STR:question] [STR:future] [CMP:know:plural] 
[CMP:know:agent] [LIT:the] [CMP:know:instance]
```

**Tokenizer evaluation (must pass before model training):**

```python
# Run on 10,000 Wikipedia sentences
# Measure:
coverage = {
    'CMP': ...,    # target > 30% (composed tokens)
    'ROOT': ...,   # target > 15% (root only)
    'STR': ...,    # target > 5%
    'REL': ...,    # target > 5%
    'LIT': ...,    # target < 40% (literals are fallback)
    'UNK': ...,    # target < 2%
}
# CMP + ROOT + STR + REL > 55% means structured tokens dominate
# If LIT > 60% the tokenizer is basically BPE — fix before proceeding
```

---

### Phase 2 — Baseline Model (BPE)

Standard GPT-2 architecture, small size.

```python
# Model config
config = {
    'vocab_size': 50257,        # standard GPT-2 BPE vocab
    'n_positions': 256,         # context window
    'n_embd': 256,              # embedding dimension
    'n_layer': 6,               # transformer layers
    'n_head': 8,                # attention heads
    'n_inner': 1024,            # feedforward dimension
}
# Total params: ~15-20M

# Tokenizer: GPT-2 BPE (tiktoken or HuggingFace)
# Training: standard causal LM, next token prediction
# Data: English Wikipedia (use HuggingFace datasets)
# Train for: 10,000-50,000 steps (enough to see perplexity trend)
```

---

### Phase 3 — Experiment Model (CST)

Same architecture. Different tokenizer.

```python
# Model config — IDENTICAL to baseline
config = {
    'vocab_size': 16000,        # CST vocabulary (smaller than BPE)
    'n_positions': 256,
    'n_embd': 256,
    'n_layer': 6,
    'n_head': 8,
    'n_inner': 1024,
}
# Total params: slightly fewer (smaller embedding table)
# Adjust n_embd if needed to match baseline param count exactly

# Tokenizer: CST tokenizer (Phase 1)
# Training: same causal LM, next token prediction
# Data: same English Wikipedia subset
# Train for: same number of steps
```

---

### Phase 4 — Measurement & Comparison

```python
# At every 1000 training steps, record:
metrics = {
    'step': ...,
    'train_loss': ...,
    'eval_perplexity': ...,    # on held-out Wikipedia
    'model': 'BPE' or 'CST',
}

# After training, also measure:
# 1. Text generation quality (human eval, 20 samples)
# 2. Simple downstream task (text classification)
# 3. Token efficiency: how many tokens per sentence (CST vs BPE)

# Plot: perplexity vs training steps for both models
# This is the key chart — does CST reach lower perplexity faster?
```

---

## What NOT To Build (Proof of Concept Scope)

```
NOT: multilingual support (English only for now)
NOT: Arabic (that comes after proof of concept works)
NOT: production tokenizer (speed optimization later)
NOT: large model (10-30M params only)
NOT: full Wikipedia training (use 1-5GB subset)
NOT: fine-tuning on downstream tasks (basic perplexity only)
NOT: the full CST spec with all 6 token types perfectly implemented
     (a working approximation is better than a perfect incomplete system)
```

---

## File Structure

```
cst-poc/
  tokenizer/
    __init__.py
    normalizer.py       ← text cleaning
    ner.py              ← spaCy NER wrapper
    morphology.py       ← morpheme extraction (NLTK/Morfessor)
    structure.py        ← sentence-level STR token detection
    emitter.py          ← combines stages → token sequence
    vocabulary.py       ← token registry, ID mapping, save/load
    semantic_fields.py  ← lemma → semantic field mapping
    tokenizer.py        ← main class, public API

  model/
    config.py           ← model hyperparameters
    gpt2.py             ← GPT-2 implementation (or use HuggingFace)
    train.py            ← training loop
    evaluate.py         ← perplexity measurement

  experiments/
    run_baseline.py     ← train BPE model
    run_cst.py          ← train CST model
    compare.py          ← plot comparison charts
    coverage_test.py    ← tokenizer coverage on Wikipedia

  data/
    semantic_fields.json    ← lemma to field mapping
    role_suffixes.json      ← suffix to ROLE mapping
    role_prefixes.json      ← prefix to ROLE mapping
    relations.json          ← preposition to REL mapping
    structures.json         ← grammar patterns to STR mapping

  tests/
    test_normalizer.py
    test_morphology.py
    test_emitter.py
    test_coverage.py        ← 10K Wikipedia sentence coverage test
    test_examples.py        ← exact tokenization checks (use examples above)

  requirements.txt
  README.md
```

---

## Dependencies

```
# requirements.txt
torch>=2.0
transformers>=4.35     # GPT-2 model
datasets               # HuggingFace datasets (Wikipedia)
nltk                   # lemmatizer, morphology
spacy                  # NER
en_core_web_sm         # spaCy English model
morfessor              # unsupervised morpheme segmentation
matplotlib             # comparison plots
numpy
tqdm
```

---

## Deliverables For Proof of Concept

```
1. Working CST tokenizer
   - Passes coverage test (CMP+ROOT+STR+REL > 55%)
   - Correct on all example sentences in this prompt
   - Processes 10K Wikipedia sentences without crashing

2. Perplexity comparison chart
   - BPE model vs CST model
   - Same architecture, same data, same training steps
   - Honest result — do not cherry pick

3. Token coverage analysis
   - What % of English Wikipedia gets structured tokens
   - Which semantic fields appear most
   - Which roles appear most

4. Honest conclusion
   - Does CST reach lower perplexity? By how much?
   - If yes: what's the next experiment?
   - If no: what failed and why?
```

---

## The Honest Question This Answers

> Does pre-encoding semantic structure in the token vocabulary
> reduce what a transformer needs to learn from data?

If YES — small models can be smarter with less training.
This changes how we think about model efficiency.

If NO — BPE is good enough, transformers learn structure anyway.
Also valuable. Saves everyone future effort.

Either answer is a contribution.
Build it cleanly. Measure it honestly. Report what you find.

---

## One Final Instruction

Start with the tokenizer. Do not touch the model until the tokenizer:
1. Produces correct output on all examples in this prompt
2. Passes the 10K sentence coverage test
3. Has passing unit tests for each stage

The tokenizer is the experiment. If it's wrong, everything else is wrong.
```
