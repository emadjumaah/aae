# Arabic Morphological Algebra as a Deterministic Reasoning Substrate: A Formal Framework for Explainable Intent Resolution

## Research Proposal

**Principal Investigator:** [Name]
**Affiliation:** [University / Research Institute]
**Date:** April 2026
**Discipline:** Computational Linguistics · Symbolic AI · Explainable Artificial Intelligence (XAI)

---

## Abstract

We propose a novel computational framework that repurposes **Arabic root-pattern morphology** — a phonologically productive, two-dimensional derivational system — as a **formal intermediate representation (IR) for intent-level reasoning**. Unlike neural approaches that sacrifice interpretability for accuracy, our system achieves **deterministic, fully auditable intent resolution** by encoding natural language inputs into compact algebraic tokens grounded in the Arabic triconsonantal root system, applying symbolic transformation rules, and decoding structured reasoning results — all without any neural network or probabilistic model at inference time.

A working prototype demonstrates 72 passing tests across 152 Arabic roots, 15 semantic domains, 80 symbolic action rules, and a 5-layer deterministic attention mechanism inspired by the Transformer architecture — achieving sub-millisecond inference with zero model parameters. This proposal seeks support for formal evaluation, cross-linguistic extension, and theoretical analysis of morphological computing as an alternative paradigm to connectionist reasoning.

---

## 1. Introduction and Motivation

### 1.1 The Interpretability Crisis in NLP

Large Language Models (LLMs) have achieved remarkable performance on reasoning benchmarks, yet they remain fundamentally opaque. When an LLM "decides" to schedule a meeting, no human can trace the exact causal chain from input tokens to output action. This opacity is not merely an academic concern — it is a deployment barrier in domains requiring auditability: healthcare, legal, financial, and governmental decision support systems (Rudin, 2019; EU AI Act, 2024).

### 1.2 Arabic Morphology as Computation

Arabic morphology is not merely a linguistic phenomenon — it is a **two-dimensional generative algebra** that has operated productively for over 1,400 years:

- **Dimension 1 — The Root (الجذر):** A triconsonantal skeleton encoding an entire semantic field. The root **ك-ت-ب** (k-t-b) covers _writing, recording, documentation, correspondence_ — all concepts derivable from three consonants.

- **Dimension 2 — The Pattern (الوزن):** A vocalic template that acts as an **operator** on the root, transforming the semantic field into a specific lexical item:

| Root  | Pattern            | Result | Meaning                    |
| ----- | ------------------ | ------ | -------------------------- |
| ك-ت-ب | فَاعِل (agent)     | كاتب   | writer                     |
| ك-ت-ب | مَفْعُول (patient) | مكتوب  | written thing / letter     |
| ك-ت-ب | مَفْعَلَة (place)  | مكتبة  | library (place of writing) |
| ك-ت-ب | فِعَال (instance)  | كتاب   | book (instance of writing) |

The same root, different patterns, systematically different meanings — all formally derived, all predictable, all composable. This is not metaphor. This is **computation**.

### 1.3 Key Insight

**Arabic morphology did not need machine learning to be systematic. It was already an algebra.**

We propose to formalize this insight by using a curated subset of Arabic roots and patterns as the intermediate representation for a reasoning pipeline:

```
Natural Language → Algebraic Token → Symbolic Reasoning → Structured Action
```

The algebraic token `[جمع × place] + [time:tomorrow, target:team]` is the same whether the input was:

- English: _"Schedule a meeting with the team tomorrow"_
- Arabic: _"رتب اجتماعاً مع الفريق غداً"_

The token is **language-independent**. The reasoning is **language-independent**. Only the encoding and decoding edges are language-specific.

---

## 2. Related Work

### 2.1 Symbolic Reasoning

Classical AI approaches to reasoning (Newell & Simon, 1976; McCarthy, 1980) relied on explicit symbol manipulation. While abandoned in favor of connectionist approaches, symbolic reasoning retains advantages in interpretability, verifiability, and formal guarantees. Our work revives symbolic reasoning with a novel twist: the symbol system is not invented _ad hoc_ but borrowed from a natural language's morphological structure.

### 2.2 Arabic Computational Morphology

Existing work on Arabic NLP focuses on **processing** Arabic text: morphological analysis (Buckwalter, 2004; Pasha et al., 2014), part-of-speech tagging, and named entity recognition. Our approach is categorically different: we use Arabic's morphological structure **as** computation, not as a target of computation. The root-pattern system serves as a formal algebra, not as linguistic data to be analyzed.

### 2.3 Interlingua and Pivot Languages

Machine translation research has explored interlingua approaches where a language-independent representation mediates between source and target (Dorr, 1993). Our algebraic token functions as a semantic interlingua, but one grounded in a specific morphological tradition rather than an artificial notation.

### 2.4 Transformer Attention Mechanisms

Vaswani et al. (2017) introduced the self-attention mechanism where each token's representation is computed as a weighted sum of all other tokens' representations. We implement an analogous principle deterministically: our encoder uses five attention-like layers — keyword exclusivity (analogous to value weighting), co-occurrence disambiguation (Q·K dot products), proximity attention (local attention windows), domain coherence (multi-head convergence), and intent-root cross-attention (cross-attention between encoder states).

### 2.5 Neurosymbolic AI

Recent work seeks to combine neural and symbolic approaches (Garcez et al., 2019; Lamb et al., 2020). Our system demonstrates that for bounded intent-resolution tasks, the symbolic component alone — when structured on a sufficiently rich formal system — may be adequate without any neural component.

---

## 3. Technical Framework

### 3.1 The Algebra

**Definition 1 (Arabic Algebra Token).** An algebra token is a 4-tuple:

$$T = (\iota, \rho, \pi, M)$$

where:

- $\iota \in I$ is an **intent operator** from a finite set $I = \{seek, do, send, gather, record, learn, decide, enable, judge, ask\}$
- $\rho \in R$ is a **root** from a curated set $R$ of Arabic triconsonantal roots ($|R| = 152$)
- $\pi \in P$ is a **pattern operator** from the morphological pattern space $P = \{agent, patient, place, instance, plural, seek, mutual, process, intensifier, causer\}$
- $M = \{m_1, ..., m_k\}$ is a set of **modifiers** where each $m_i$ is a key-value pair $(key_i : value_i)$

**Definition 2 (Reasoning Function).** The symbolic reasoning function $\mathcal{R}: I \times P \rightarrow A$ maps an intent-pattern pair to an action type:

$$\mathcal{R}(\iota, \pi) = a \in A$$

where $A$ is the set of action types. This function is implemented as a finite lookup table with 80 defined entries out of a possible $|I| \times |P| = 100$.

**Example:**

$$\mathcal{R}(seek, place) = schedule$$
$$\mathcal{R}(send, patient) = send$$
$$\mathcal{R}(learn, causer) = request\_teach$$

**Definition 3 (Root-Resource Mapping).** Each root $\rho$ maps to a semantic resource:

$$\mathcal{S}(\rho) = resource$$

For example: $\mathcal{S}(جمع) = meeting$, $\mathcal{S}(كتب) = document$, $\mathcal{S}(علم) = knowledge$.

**Definition 4 (Reasoning Result).** The full reasoning output is:

$$\mathcal{O}(T) = (a, r, C, \gamma)$$

where $a = \mathcal{R}(\iota, \pi)$ is the action, $r = \mathcal{S}(\rho)$ is the resource, $C$ is the constraint set derived from modifiers $M$, and $\gamma \in [0, 1]$ is a confidence score based on rule specificity.

### 3.2 The Encoder: Deterministic Attention

The encoder maps natural language to an algebra token without any neural network. It implements five scoring layers inspired by the Transformer attention mechanism:

**Layer 1: Keyword Scoring with Exclusivity Weighting**

Each root $\rho$ has an associated keyword set $K_\rho$. For input text $x$, the base score is:

$$s_1(\rho, x) = \sum_{k \in K_\rho} \mathbb{1}[k \in x] \cdot w(k) \cdot \beta(k)$$

where $w(k)$ is a length-based weight and $\beta(k)$ is the **exclusivity factor**:

$$\beta(k) = \begin{cases} 3.0 & \text{if } |\{\rho' : k \in K_{\rho'}\}| = 1 \text{ (exclusive)} \\ 2.0 & \text{if shared with 1 other root} \\ 1.0 & \text{if shared with 2--3 others} \\ 0.5 & \text{if shared with 4+ others} \end{cases}$$

This is analogous to **IDF (Inverse Document Frequency)** weighting in information retrieval and to the **value weighting** in transformer attention heads.

**Layer 2: Co-occurrence Disambiguation (Q·K Attention)**

A pre-defined set of context-target pairs resolves polysemy:

$$s_2(\rho, x) = \sum_{(c, \rho', b) \in \mathcal{C}} \mathbb{1}[c \in x] \cdot \mathbb{1}[\rho' = \rho] \cdot b$$

For example, the word "server" in the input boosts root عمل (work) by 6 points, disambiguating "deploy" from its manufacturing sense. This mirrors the **dot-product attention** in transformers where specific query-key pairs produce high activation.

**Layer 3: Proximity Attention (Local Attention Window)**

Keywords for the same root that appear within a 5-word window receive a proximity bonus:

$$s_3(\rho, x) = \sum_{i < j} \mathbb{1}[d(p_i, p_j) \leq 5] \cdot \frac{5 - d(p_i, p_j) + 1}{2}$$

where $p_i, p_j$ are positions of matched keywords in the input. This mirrors the **local attention patterns** that transformer heads learn to attend to nearby tokens.

**Layer 4: Domain Coherence (Multi-Head Convergence)**

When multiple roots from the same semantic domain score above a threshold, each receives a coherence bonus:

$$s_4(\rho, x) = \begin{cases} 2.0 & \text{if } |\{\rho' : dom(\rho') = dom(\rho), s_{1-3}(\rho') \geq \theta\}| \geq 2 \\ 0 & \text{otherwise} \end{cases}$$

This is analogous to **multi-head attention convergence** where multiple attention heads agreeing on a semantic domain reinforces the representation.

**Layer 5: Intent↔Root Cross-Attention**

The detected intent biases root selection toward semantically compatible domains:

$$s_5(\rho, \iota) = \begin{cases} 3.0 & \text{if } dom(\rho) \in \mathcal{A}(\iota) \\ 0 & \text{otherwise} \end{cases}$$

where $\mathcal{A}(\iota)$ maps each intent to its affine domains. For example, $\mathcal{A}(send) = \{communication\}$. This mirrors **encoder-decoder cross-attention** in the Transformer.

**Final Score:**

$$s(\rho, x, \iota) = s_1(\rho, x) + s_2(\rho, x) + s_3(\rho, x) + s_4(\rho, x) + s_5(\rho, \iota)$$

The root with the highest score is selected: $\rho^* = \arg\max_{\rho \in R} s(\rho, x, \iota)$.

### 3.3 The Decoder: Template-Based Response Generation

The decoder maps reasoning results to natural language using action-specific templates:

$$decode(\mathcal{O}(T)) = template(a) + constraints(C)$$

Each of the 16 action types has a response template. Constraints from modifiers are formatted with appropriate prepositions ("by" for time, "for" for target, "about" for topic).

### 3.4 Architecture

```
  "Schedule a meeting with the team tomorrow"
                    ↓
         ┌──────────────────┐
         │  5-Layer Encoder  │  ← Deterministic attention
         │  ① Exclusivity    │     (no neural network)
         │  ② Co-occurrence  │
         │  ③ Proximity      │
         │  ④ Coherence      │
         │  ⑤ Cross-attention│
         └────────┬─────────┘
                  ↓
       Token: (seek, جمع, place, {time:tomorrow, target:team})
                  ↓
         ┌──────────────────┐
         │  Symbolic Engine  │  ← Pure lookup: seek × place → schedule
         │  80 Action Rules  │     O(1) · deterministic · auditable
         └────────┬─────────┘
                  ↓
       Result: {action:schedule, resource:meeting,
                constraints:[tomorrow, team], confidence:0.9}
                  ↓
         ┌──────────────────┐
         │ Template Decoder  │  ← 16 action templates
         └────────┬─────────┘
                  ↓
  "I'll schedule a meeting for the team by tomorrow."
```

---

## 4. Worked Examples

### Example 1: Scheduling (English)

**Input:** "Schedule a meeting with the team tomorrow"

**Encoder Trace:**

1. **Keyword scoring:** "meeting" → جمع (gathering, score=6), "schedule" → وقت (time, score=6), "team" → جمع (score=4)
2. **Co-occurrence:** "team" + attendance keywords → reinforces جمع
3. **Proximity:** "meeting" (word 3) and "team" (word 6) → distance 3, within window 5 → bonus
4. **Domain coherence:** جمع (social domain) scores alongside other social roots → modest boost
5. **Cross-attention:** intent=seek, جمع is social domain, seek has affinity with social → +3.0
6. **Final:** جمع wins with score 24.0 over وقت at 12.0

**Token:** $T = (seek, جمع, place, \{time:tomorrow, target:team\})$

**Reasoning:** $\mathcal{R}(seek, place) = schedule$, $\mathcal{S}(جمع) = meeting$

**Output:** "I'll schedule a meeting for the team by tomorrow."

### Example 2: Communication (Arabic)

**Input:** "أرسل التقرير إلى المدير" (Send the report to the manager)

**Encoder Trace:**

1. **Keyword scoring:** "أرسل" → رسل (sending, score=6.0, exclusive keyword), "التقرير" → رسل (report, score=6.0)
2. **Co-occurrence:** no additional context clues
3. **Proximity:** "أرسل" (word 1) and "التقرير" (word 2) → distance 1 → bonus 2.0
4. **Cross-attention:** intent=send, رسل is communication domain → +3.0
5. **Final:** رسل wins decisively

**Token:** $T = (send, رسل, patient, \{target:manager, content:report\})$

**Reasoning:** $\mathcal{R}(send, patient) = send$, $\mathcal{S}(رسل) = message$

**Output:** "I'll send the message for manager (report)."

### Example 3: Disambiguation via Context

**Input A:** "Deploy the server to staging"
**Input B:** "Deploy troops to the border"

Both inputs contain the polysemous word "deploy." Without context, it maps ambiguously to multiple roots.

| Layer           | Input A                               | Input B                               |
| --------------- | ------------------------------------- | ------------------------------------- |
| Keyword         | عمل: "deploy"=2.0                     | عمل: "deploy"=2.0                     |
| Co-occurrence   | "server" boosts عمل by +6             | —                                     |
| Cross-attention | intent=do, عمل (action domain) → +3.0 | intent=do, عمل (action domain) → +3.0 |
| **Result**      | **عمل (work) = 11.0**                 | **عمل (work) = 5.0**                  |

The co-occurrence layer correctly identifies "server" as a technology context indicator, providing a strong signal for عمل (work/execute). Without the server context, the signal is weaker but falls back to a reasonable default.

### Example 4: Security Domain

**Input:** "Secure the network with encryption and enforce the firewall"

**Encoder Trace:**

1. **Keyword scoring:** "secure" → أمن (security, exclusive, score=6.0), "encryption" → أمن (exclusive, score=9.0)
2. **Co-occurrence:** "firewall" → أمن (+6), "encryption" → أمن (+6)
3. **Domain coherence:** أمن and حمي (both security domain) pass threshold → +2.0
4. **Cross-attention:** intent=enable, security is in affinity list → +3.0
5. **Final:** أمن wins with a very high confidence score

This example demonstrates how multiple attention layers converge on the correct root even when the input contains diverse security vocabulary.

### Example 5: Commerce Domain

**Input:** "Sell at retail through trading and auction"

**Token:** $T = (do, بيع, instance, \{\})$

**Reasoning:** $\mathcal{R}(do, instance) = create$, $\mathcal{S}(بيع) = sale/trade$

The exclusive keywords "retail", "auction", and "trading" all point uniquely to بيع (sell/trade). The exclusivity weighting ensures these domain-specific terms outweigh any shared vocabulary.

---

## 5. Evaluation Methodology

### 5.1 Accuracy Benchmark

We propose constructing a benchmark of **500 intent-bearing utterances** across the 15 semantic domains, with ground-truth algebra tokens annotated by bilingual linguists. Metrics:

- **Root accuracy:** Percentage of inputs mapped to the correct root
- **Intent accuracy:** Percentage of inputs mapped to the correct intent
- **Pattern accuracy:** Percentage of inputs mapped to the correct pattern
- **End-to-end accuracy:** Percentage of inputs producing the correct action type

### 5.2 Disambiguation Test Set

A dedicated test set of **100 polysemous inputs** where context is required for correct root selection. Each input contains an ambiguous verb (e.g., "deploy", "run", "store") with varying contextual cues.

### 5.3 Comparison Baselines

- **GPT-4 / Claude:** Prompt-based intent classification
- **BERT-based classifier:** Fine-tuned on the same 500 utterances
- **Rule-based (no attention):** Our encoder without layers 2–5
- **Full system:** Our encoder with all 5 attention layers

### 5.4 Interpretability Metrics

- **Trace completeness:** Can every output be traced to specific rules? (100% by construction)
- **Prediction stability:** Same input always produces same output? (100% by construction)
- **Explanation fidelity:** Does the system's explanation match its actual reasoning? (100% by construction)
- **Inference latency:** Time from input to output (target: <1ms)

### 5.5 Cross-Linguistic Evaluation

We will test the system's language-independence by running the same benchmark in:

- English
- Arabic
- Mixed-code (English-Arabic code-switching)

The algebra token should be identical regardless of input language.

---

## 6. Research Questions

**RQ1:** Can Arabic root-pattern morphology serve as a formal intermediate representation for intent-level reasoning tasks?

**RQ2:** How does a deterministic 5-layer attention mechanism compare to neural attention in accuracy on bounded intent-resolution tasks?

**RQ3:** What is the accuracy–interpretability trade-off: how much accuracy (if any) is sacrificed for full deterministic explainability?

**RQ4:** Can the morphological algebra be extended to other Semitic languages (Hebrew, Amharic, Syriac) or to non-Semitic agglutinative languages (Turkish, Finnish, Swahili)?

**RQ5:** Is there a formal relationship between the combinatorial productivity of root-pattern morphology and the expressiveness of the resulting reasoning system?

---

## 7. Expected Contributions

1. **A novel formal framework** that bridges Semitic morphology and symbolic AI, demonstrating that natural language structures can serve as computational formalisms.

2. **A deterministic attention mechanism** that mirrors transformer attention without any learned parameters — showing that for bounded tasks, the attention principle can be implemented with hand-crafted rules achieving comparable accuracy.

3. **A fully explainable reasoning system** where every output has a complete, human-readable derivation trace — contributing to the Explainable AI (XAI) literature.

4. **An open-source reference implementation** (TypeScript, zero dependencies, 152 roots, 80 rules, 72 tests) that runs offline on any device.

5. **A cross-linguistic evaluation** demonstrating language-independent reasoning through a morphologically-grounded interlingua.

6. **Theoretical analysis** of when and why morphological computing is sufficient, and where neural approaches remain necessary.

---

## 8. Broader Impact

### 8.1 For Arabic Linguistics

This work reframes Arabic morphology not as an object of NLP analysis but as a **source of computational structure**. This perspective may open new research directions in Arabic computational linguistics, morphological theory, and the formal study of Semitic root-pattern systems.

### 8.2 For Explainable AI

As AI regulation tightens (EU AI Act, US Executive Order on AI Safety), demand for explainable systems grows. Our framework offers a practical architecture for intent-resolution tasks where interpretability is non-negotiable.

### 8.3 For Low-Resource Settings

The system requires **zero model parameters**, **zero training data**, and **zero network access**. It runs on any device with a JavaScript runtime. This makes it suitable for offline, edge, and low-resource deployment scenarios where LLMs are impractical.

### 8.4 For Computational Morphology

If the algebra holds for Arabic, it suggests a broader principle: that **productive morphological systems from natural languages can serve as computational formalisms**. Arabic's root-pattern system is uniquely two-dimensional and regular, but analogous structures exist in Hebrew, Amharic, Turkish, and other languages.

---

## 9. Timeline

| Phase                            | Duration | Deliverables                                                                                 |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| 1. Benchmark Construction        | 3 months | 500 annotated utterances, 100 disambiguation pairs, evaluation framework                     |
| 2. Baseline Evaluation           | 2 months | GPT-4, BERT, rule-only baselines. Accuracy comparison tables.                                |
| 3. Attention Analysis            | 3 months | Per-layer ablation study, attention weight visualization, failure case taxonomy              |
| 4. Cross-Linguistic Extension    | 4 months | Hebrew root integration, Turkish agglutinative adapter, bilingual evaluation                 |
| 5. Theoretical Framework         | 3 months | Formal proofs of expressiveness bounds, complexity analysis, relationship to formal grammars |
| 6. Paper Writing & Dissemination | 3 months | Conference paper (ACL/EMNLP/NAACL), journal paper (CL/TACL), open-source release             |

---

## 10. Budget (Estimated)

| Item                                              | Cost (USD)  |
| ------------------------------------------------- | ----------- |
| Graduate Research Assistant (2 years)             | $60,000     |
| Computational resources (baseline LLM evaluation) | $5,000      |
| Linguistic annotation (bilingual annotators)      | $10,000     |
| Conference travel (2 venues)                      | $6,000      |
| Equipment                                         | $4,000      |
| **Total**                                         | **$85,000** |

---

## 11. Prototype Status

A working prototype is available:

| Metric              | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| Arabic roots        | 152 across 15 semantic domains                                        |
| Action rules        | 80 (80% coverage of intent × pattern matrix)                          |
| Attention layers    | 5 (exclusivity, co-occurrence, proximity, coherence, cross-attention) |
| Co-occurrence pairs | 80+ context disambiguators                                            |
| Keywords            | ~2,456 (English + Arabic)                                             |
| Tests               | 72 passing (15 engine + 25 standalone + 32 domain)                    |
| Inference latency   | <1ms (sub-millisecond)                                                |
| Model parameters    | **0** (zero — fully symbolic)                                         |
| Dependencies        | **0** (zero runtime dependencies)                                     |
| Network required    | **No** (fully offline)                                                |
| Languages           | TypeScript (runs on Node.js, Deno, Bun, or browsers)                  |

The prototype source code is available at: [repository URL]

---

## 12. Key References

- Buckwalter, T. (2004). Buckwalter Arabic Morphological Analyzer Version 2.0. LDC.
- Dorr, B. J. (1993). Machine Translation: A View from the Lexicon. MIT Press.
- Garcez, A., Lamb, L., et al. (2019). Neural-Symbolic Computing. Springer.
- Lamb, L., Garcez, A., et al. (2020). Graph Neural Networks Meet Neural-Symbolic Computing. arXiv:2003.00330.
- McCarthy, J. (1980). Circumscription — A Form of Non-Monotonic Reasoning. AI Journal.
- Newell, A. & Simon, H. (1976). Computer Science as Empirical Inquiry: Symbols and Search. CACM.
- Pasha, A., et al. (2014). MADAMIRA: A Fast, Comprehensive Tool for Morphological Analysis and Disambiguation of Arabic. LREC.
- Rudin, C. (2019). Stop Explaining Black Box Machine Learning Models for High Stakes Decisions. Nature Machine Intelligence.
- Vaswani, A., et al. (2017). Attention Is All You Need. NeurIPS.
- Wehr, H. (1979). A Dictionary of Modern Written Arabic (4th ed.). Harrassowitz.
- Wright, W. (1896). A Grammar of the Arabic Language (3rd ed.). Cambridge University Press.

---

## 13. About the Framework Name

**الجبر العربي** — _al-jabr al-ʿarabī_ — "The Arabic Algebra."

The word "algebra" itself is Arabic: الجبر (_al-jabr_), from the root **ج-ب-ر** (_j-b-r_, "to restore, to set right"). Muhammad ibn Musa al-Khwarizmi's 9th-century treatise _al-Kitāb al-Mukhtaṣar fī Ḥisāb al-Jabr wal-Muqābala_ ("The Compendious Book on Calculation by Completion and Balancing") gave the world both the word "algebra" and the concept of systematic symbolic manipulation.

It is fitting that a project using Arabic linguistic structure as a computational algebra should carry the name of the mathematical tradition from which "algebra" originated.

---

_This proposal describes research that is not restricted to any single language, culture, or application domain. The Arabic morphological system is used as a computational structure, not as a cultural artifact. The framework is designed to be extensible to other languages and morphological traditions._
