# Arabic Algebra Engine — Research & Improvement Plan

> Current status: Research prototype. 152 hand-curated roots, 80 rules, 72 self-authored tests passing. No external validation yet.

---

## Track 1: Validate (Make It Real)

The engine scores 97-99% on its own test set. That means nothing until tested on data it wasn't designed for. Validation is the cheapest step and determines whether anything else is worth doing.

### 1.1 Build an External Test Set

**What:** Collect 200-500 natural commands from people who have never seen the engine's dictionary or keyword list.

**How:**

- Post a Google Form asking bilingual Arabic/English speakers to write commands they'd give a smart assistant. Target: 50 IoT, 50 scheduling, 50 information-seeking, 50 freeform.
- Source participants from Arabic NLP communities (e.g., r/arabic, Arabic AI Discord servers, university Arabic departments).
- Do NOT filter or clean the inputs. Real language is messy — that's the point.

**Expected outcome:** Accuracy will drop to 40-70%. That's not failure — it's the real measurement. The gap between 97% (self-authored) and the real number is the research contribution: it quantifies exactly how far a symbolic approach can go before it needs statistical help.

**Deliverable:** `benchmark/external-dataset.json` with 200+ cases, each tagged with source, language, whether the engine got it right, and why it failed (missing root, unknown phrasing, ambiguous intent, out-of-domain).

### 1.2 Failure Taxonomy

**What:** For every input the engine gets wrong on the external set, classify the failure mode.

**Categories to track:**

- **Missing root** — the concept exists but no root covers it (e.g., "subscribe" has no root)
- **Synonym gap** — the user said "switch on" but the engine only knows "turn on" / "activate"
- **Paraphrase blindness** — "could you maybe adjust the temperature a bit?" vs. "set temperature to 22"
- **Ambiguity** — "check the door" could be inspect (فحص) or secure (أمن)
- **Out-of-domain** — the request is genuinely outside any of the 15 domains
- **Arabic dialect** — user wrote in dialect (عامية) instead of MSA (فصحى)

**Why this matters:** Each failure category has a different fix. Missing roots → expand dictionary. Synonym gap → more keywords. Paraphrase blindness → this is where statistical models genuinely win, and the honest answer might be "the symbolic approach can't handle this."

### 1.3 Small User Study (5-10 people)

**What:** Have 5-10 people use the playground for 15 minutes. Screen-record or take notes.

**Observe:**

- What do they try first?
- Where do they expect the engine to work but it doesn't?
- Do they understand the root/pattern explanation, or is it opaque?
- Do bilingual users switch languages mid-session?

**Deliverable:** 1-page summary of findings. This is publishable as a "preliminary user evaluation" in a workshop paper.

---

## Track 2: Publish (Make It Matter)

The genuinely novel idea here is using Arabic morphological structure as a computational formalism — not NLP _of_ Arabic, but Arabic morphology _as_ computation. That insight deserves a paper, regardless of whether the engine becomes a product.

### 2.1 Formalize the Algebra

**What:** Define the root × pattern composition as a proper algebraic structure with mathematical precision.

**Questions to answer:**

- Is the composition a monoid? (associative + identity element) Probably not — pattern application is not associative.
- Is it closer to a typed function application? (Root → Pattern → Token) This is more accurate.
- Can it be modeled as a finite-state transducer? (Classical approach to Semitic morphology — see Beesley & Karttunen 2003)
- What is the relationship between the algebraic structure and the linguistic reality? Where does the formalism diverge from actual Arabic?

**Prior work to cite:**

- McCarthy (1981) — "A Prosodic Theory of Nonconcatenative Morphology" (the foundational paper on Semitic templatic morphology)
- Beesley & Karttunen (2003) — "Finite State Morphology" (computational treatment)
- Kiraz (2001) — "Computational Nonlinear Morphology" (specifically covers Arabic)
- Habash (2010) — "Introduction to Arabic Natural Language Processing"

**Deliverable:** A formal section in the paper that defines Root, Pattern, Token, and the composition operation with mathematical notation. This is what elevates the project from "clever hack" to "research contribution."

### 2.2 Write the Paper

**Target venues (in order of fit):**

1. **WANLP** (Workshop on Arabic Natural Language Processing, co-located with major ACL conferences) — most directly relevant
2. **ACL SRW** (Student Research Workshop) — if framed as early-stage work
3. **EMNLP Workshop on Structured Prediction** — if the algebraic formalism is strong
4. **arXiv preprint** — regardless of venue, publish a preprint for visibility

**Suggested structure:**

1. Introduction — the hypothesis (morphology as computation)
2. Background — Arabic morphology, symbolic AI, intent resolution
3. The Arabic Algebra formalism — formal definitions
4. Implementation — the engine, dictionary, rules
5. Evaluation — self-authored benchmark (with caveat) + external test set (with honest results)
6. Analysis — failure taxonomy, where symbolic wins, where it loses
7. Discussion — implications for hybrid symbolic-neural systems
8. Conclusion — what was learned, not what was "achieved"

**Estimated length:** 6-8 pages (workshop format).

### 2.3 Fair Benchmark Comparison

**What:** Compare against baselines on a standard intent classification dataset, not the self-authored one.

**Datasets to adapt:**

- **ATIS** (Airline Travel Information) — classic intent classification, English only
- **SNIPS** — 7 intents, 39 slots, English
- **MASSIVE** (Amazon) — multilingual including Arabic, 60 intents, 55 languages

**Approach:**

- Map the dataset intents to the engine's 10 intents (with a clear mapping table)
- Run the engine on the Arabic and English subsets
- Compare against: (a) a simple BERT classifier fine-tuned on the same data, (b) a keyword baseline, (c) GPT-4o zero-shot
- Report not just accuracy but: interpretability score, latency, cost, failure mode distribution

**Expected finding:** The engine will underperform on accuracy but outperform on interpretability and latency. That's the interesting tradeoff to document.

---

## Track 3: Extend (Make It Useful)

### 3.1 Automatic Root Extraction

**What:** Remove the "hand-curated only" bottleneck by automatically extracting roots from Arabic text.

**Existing tools to integrate:**

- **Farasa** (Qatar Computing Research Institute) — fast Arabic segmenter/POS tagger, extracts roots
- **MADAMIRA** (Columbia University) — morphological analyzer and disambiguator
- **CAMeL Tools** (NYU Abu Dhabi) — Python library for Arabic NLP, includes morphological analysis
- **Khoja Stemmer** — lightweight, old but functional root extractor

**Architecture:**

```
Raw Arabic text → Farasa/CAMeL root extraction → Match against engine dictionary
  ├─ Match found → use existing root + rules
  └─ No match → flag for dictionary expansion (or fall through to LLM)
```

**Risk:** Automatic root extraction is noisy (75-85% accuracy for Arabic). Need a confidence threshold — only use auto-extracted roots when analyzer confidence is high.

### 3.2 Hybrid Architecture (Morphological Features → ML)

**What:** Instead of using the algebra AS the reasoning system, use it as a feature extraction layer that feeds into a small ML model.

**Concept:**

```
Input text
  ↓
┌──────────────────────┐
│  Arabic Algebra       │  → root, pattern, intent, domain, confidence
│  (feature extractor)  │     (structured features, not raw text)
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Small classifier     │  → final intent + action
│  (logistic regression │     (handles ambiguity the algebra can't)
│   or tiny transformer)│
└──────────────────────┘
```

**Why this could work:** The morphological features are genuinely informative. A classifier that gets `{root: كتب, domain: communication, pattern: agent, confidence: 0.85}` as input has a huge head start over one that gets raw text. This is a legitimate contribution to Arabic NLP — using morphological structure as engineered features.

**What to measure:** Does adding morphological features improve a small model compared to (a) the model alone, (b) the algebra alone?

### 3.3 Educational Arabic Morphology App

**What:** This is the one use case where the engine already works — because the engine IS the subject matter. A student learning Arabic morphology wants to see how roots combine with patterns. That's exactly what this engine does.

**Features to build:**

- **Root explorer** — pick a root, see all its derivations with explanations
- **Pattern quiz** — given a word, identify the root and pattern
- **Derivation builder** — combine root + pattern, predict the word, check the answer
- **Visual morphology tree** — show the root-pattern-word relationship as a tree diagram
- **Progressive difficulty** — start with common 3-letter roots, progress to rare ones

**Target audience:**

- Arabic as a second language (ASL) students
- Linguistics students studying Semitic morphology
- Heritage speakers who want to understand the formal structure

**Why this is realistic:** All the data already exists in the engine. The playground already does most of this. It just needs better UX and pedagogical structure.

### 3.4 Expand the Dictionary

**Current coverage:** 152 roots, ~2,456 keywords, 15 domains.

**Target:** 500 roots, ~8,000 keywords, 20+ domains.

**New domains to add:**

- **Technology** — برمج (program), حسب (compute), شبك (network), خدم (serve)
- **Legal** — حكم (judge/rule), شرع (legislate), عقد (contract), شهد (witness)
- **Travel** — سفر (travel), حجز (book/reserve), رحل (depart), وصل (arrive)
- **Food/Agriculture** — زرع (plant), حصد (harvest), طبخ (cook), أكل (eat)
- **Environment** — مياه (water), هوى (air), طقس (weather), نظف (clean)

**Method:** Use frequency-ranked Arabic root lists from corpus studies (e.g., Buckwalter & Parkinson, "A Frequency Dictionary of Arabic"). Add the top 500 roots by frequency, with their most common derivations.

**Risk:** More roots → more ambiguity → accuracy might actually drop. Track this.

---

## Priority & Sequencing

```
Month 1-2:  Track 1 — Validate
            ├── 1.1 External test set (2 weeks)
            ├── 1.2 Failure taxonomy (1 week)
            └── 1.3 User study (1 week)

Month 2-3:  Track 2 — Publish
            ├── 2.1 Formalize algebra (2 weeks)
            ├── 2.2 Write paper (3 weeks)
            └── 2.3 Fair benchmark (1 week, parallel with paper)

Month 3+:   Track 3 — Extend (choose ONE)
            ├── 3.3 Educational app (lowest risk, clearest audience)
            ├── 3.2 Hybrid architecture (most publishable)
            ├── 3.1 Auto root extraction (most impactful for coverage)
            └── 3.4 Dictionary expansion (mechanical, do anytime)
```

**Decision point after Track 1:** If external accuracy is below 30%, the algebra-as-reasoning hypothesis is weak. Pivot to Track 3.2 (morphological features for ML) or 3.3 (educational tool). If above 50%, the paper is worth writing.

---

## What Success Looks Like

**Minimum viable outcome:**

- External test set built, real accuracy measured, failure modes documented
- One workshop paper submitted (accepted or not)
- Honest understanding of what this approach can and can't do

**Good outcome:**

- Paper accepted at WANLP or similar venue
- Educational tool usable by Arabic students
- Clear hybrid architecture showing morphological features improve ML accuracy

**Stretch outcome:**

- The formalism generalizes beyond Arabic (Hebrew, Amharic root systems)
- Hybrid model outperforms pure-statistical baselines on low-resource Arabic intent classification
- The project becomes a cited reference in Arabic computational morphology
