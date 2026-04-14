# Arabic Triconsonantal Root-Pattern Morphology as an Algebraic Basis for Deterministic Intent Resolution

**Abstract.** We present a formal framework that employs the Arabic triconsonantal root-pattern morphological system as an intermediate algebraic representation for intent resolution. The Arabic root system, in which a consonantal skeleton (الجذر) combines with a vocalic template (الوزن) to produce semantically related lexical items, exhibits productive compositionality that we formalize as a symbolic algebra. We define a 4-tuple algebraic token, a deterministic 5-layer scoring encoder, and a finite rule-based reasoning function that maps intent–pattern pairs to action types. A prototype implementation covering 152 roots across 15 semantic domains and 80 symbolic rules achieves deterministic, fully traceable inference in sub-millisecond time with zero learned parameters. We evaluate on a preliminary test set and report accuracy by category, analyze failure modes, and discuss the conditions under which morphological formalism can and cannot substitute for statistical approaches. We release the implementation as open-source software.

**Keywords:** Arabic morphology, symbolic reasoning, intent resolution, deterministic attention, explainable AI, computational morphology

---

## 1. Introduction

Intent resolution — the task of mapping a natural language utterance to a structured action — is typically addressed through statistical classification (Liu and Lane, 2016; Zhang et al., 2019) or large language model prompting (Brown et al., 2020). These approaches achieve high accuracy on paraphrase-rich input but sacrifice interpretability: when a model classifies "schedule a meeting tomorrow" as a _calendar.add_ intent, no human-readable derivation trace explains why.

We explore an alternative approach rooted in a linguistic observation: Arabic morphology is a **compositional generative system** that has operated productively for over 1,400 years. A triconsonantal root (three consonants encoding a semantic field) combines with a vocalic pattern (an operator specifying the grammatical/semantic role) to derive words systematically:

| Root          | Pattern            | Result | Gloss         |
| ------------- | ------------------ | ------ | ------------- |
| ك-ت-ب (k-t-b) | فَاعِل (agent)     | كاتب   | writer        |
| ك-ت-ب (k-t-b) | مَفْعُول (patient) | مكتوب  | written thing |
| ك-ت-ب (k-t-b) | مَفْعَلَة (place)  | مكتبة  | library       |
| ك-ت-ب (k-t-b) | فِعَال (instance)  | كتاب   | book          |

This regularity is not incidental. It is a formally productive derivational system studied extensively in Semitic linguistics (McCarthy, 1981; Beesley and Karttunen, 2003; Kiraz, 2001). We ask: **can this morphological regularity serve as a computational formalism for structured intent resolution?**

We formalize the root × pattern composition as an algebraic operation, define a deterministic encoder that maps natural language to algebraic tokens, and implement a symbolic reasoning function that maps tokens to actions. The resulting system is fully deterministic, interpretable, and parameter-free. Every output can be traced to a specific root, pattern, and rule.

We stress that this is a **preliminary study**. The current dictionary is hand-curated and limited. The evaluation is conducted on an author-constructed test set. We present this work to introduce the formalism and invite scrutiny, not to claim superiority over established methods.

---

## 2. Related Work

### 2.1 Arabic Computational Morphology

Computational treatment of Arabic morphology has focused on analysis and generation. Buckwalter (2004) provides a widely-used morphological analyzer. MADAMIRA (Pasha et al., 2014) performs morphological analysis and disambiguation. CAMeL Tools (Obeid et al., 2020) offers a toolkit for Arabic NLP preprocessing. Farasa (Abdelali et al., 2016) provides fast Arabic segmentation.

These works process Arabic text _as data_. Our approach is categorically different: we use Arabic morphological structure _as computation_ — the root-pattern system serves as a formal algebra for reasoning, not as a target of linguistic analysis.

### 2.2 Symbolic and Neurosymbolic Reasoning

Classical symbolic AI (Newell and Simon, 1976; McCarthy, 1980) relied on explicit symbol manipulation. While connectionist approaches have dominated recent NLP, interest in symbolic and neurosymbolic methods has renewed (Garcez et al., 2019; Lamb et al., 2020), particularly for tasks requiring formal guarantees or interpretability.

Our work sits in this space but with a distinctive feature: the symbol system is not invented _ad hoc_ but borrowed from a natural language's morphological structure.

### 2.3 Intent Classification

Standard intent classification uses supervised models trained on labeled utterances (Liu and Lane, 2016; Chen et al., 2019). Recent work uses LLM prompting for zero-shot classification (Brown et al., 2020). Our approach requires no training data and produces deterministic output but is limited to the domains covered by the hand-curated dictionary.

### 2.4 Interlingua Approaches

Machine translation research has explored interlingua representations — language-independent meaning representations mediating between source and target languages (Dorr, 1993). Our algebraic token functions as a task-specific interlingua: the token $[جمع \times place]$ is identical whether derived from English or Arabic input.

---

## 3. The Arabic Algebra Formalism

### 3.1 Definitions

**Definition 1 (Algebraic Token).** An algebraic token is a 4-tuple:

$$T = (\iota, \rho, \pi, M)$$

where:

- $\iota \in I$ is an intent from a finite set $I = \{seek, do, send, gather, record, learn, decide, enable, judge, ask\}$ ($|I| = 10$)
- $\rho \in R$ is a root from a curated set of Arabic triconsonantal roots ($|R| = 152$)
- $\pi \in P$ is a morphological pattern from $P = \{agent, patient, place, instance, plural, seek, mutual, process, intensifier, causer\}$ ($|P| = 10$)
- $M = \{(k_1, v_1), \ldots, (k_n, v_n)\}$ is a set of key-value modifier pairs

**Definition 2 (Reasoning Function).** The reasoning function $\mathcal{R}: I \times P \rightarrow A$ maps an intent–pattern pair to an action type $a \in A$. This function is implemented as a finite lookup table with 80 defined entries out of $|I| \times |P| = 100$ possible combinations. Coverage is 80%.

$$\mathcal{R}(seek, place) = schedule$$
$$\mathcal{R}(send, patient) = deliver$$
$$\mathcal{R}(learn, causer) = request\_instruction$$

**Definition 3 (Resource Mapping).** Each root maps to a semantic resource via $\mathcal{S}: R \rightarrow \text{Resource}$. For example, $\mathcal{S}(جمع) = gathering$, $\mathcal{S}(كتب) = document$.

**Definition 4 (Reasoning Output).** The complete reasoning output for a token $T = (\iota, \rho, \pi, M)$ is:

$$\mathcal{O}(T) = (\mathcal{R}(\iota, \pi),\ \mathcal{S}(\rho),\ C(M),\ \gamma)$$

where $C(M)$ extracts constraints from modifiers and $\gamma \in [0, 1]$ is a confidence score based on rule specificity and encoder signal strength.

### 3.2 Relationship to Arabic Morphology

The formalism draws on, but simplifies, the actual morphological system:

- **Roots** in our system are semantic domain identifiers. In natural Arabic, roots carry more fine-grained and context-dependent meaning.
- **Patterns** in our system are functional role operators. In natural Arabic, patterns encode additional information (verbal voice, aspect, transitivity) that we abstract away.
- **Composition** in our system is a lookup. In natural Arabic, root–pattern interaction involves phonological processes (assimilation, metathesis) that we do not model.

We do not claim that our formalism faithfully represents Arabic morphology in its full linguistic complexity. Rather, we claim that the _structural principle_ — a finite set of semantic primitives composed with a finite set of operators to produce a bounded but expressive output space — is computationally useful for intent resolution.

### 3.3 Deterministic 5-Layer Encoder

The encoder maps natural language input to an algebraic token without learned parameters. It implements five scoring layers:

**Layer 1: Keyword Scoring with Exclusivity Weighting.**
Each root $\rho$ has an associated keyword set $K_\rho$. For input $x$:

$$s_1(\rho, x) = \sum_{k \in K_\rho} \mathbb{1}[k \in x] \cdot w(k) \cdot \beta(k)$$

where $w(k)$ is a length-based weight and $\beta(k)$ is an exclusivity factor inversely proportional to the number of roots sharing that keyword. This is analogous to IDF weighting in information retrieval.

**Layer 2: Co-occurrence Disambiguation.**
A predefined set of context–target pairs resolves polysemy:

$$s_2(\rho, x) = \sum_{(c, \rho', b) \in \mathcal{C}} \mathbb{1}[c \in x] \cdot \mathbb{1}[\rho' = \rho] \cdot b$$

For example, "server" in context boosts root عمل (work/execute), disambiguating "deploy" from manufacturing senses.

**Layer 3: Proximity Scoring.**
Keywords for the same root appearing within a 5-token window receive a proximity bonus:

$$s_3(\rho, x) = \sum_{\substack{i < j \\ d(p_i, p_j) \leq 5}} \frac{5 - d(p_i, p_j) + 1}{2}$$

**Layer 4: Domain Coherence.**
When multiple roots from the same semantic domain score above a threshold, each receives a coherence bonus of 2.0.

**Layer 5: Intent–Root Cross-Attention.**
Each intent has an affinity set of semantic domains. Roots in the affine domain receive a bonus of 3.0.

**Final scoring:**

$$s(\rho, x, \iota) = \sum_{l=1}^{5} s_l(\rho, x, \iota)$$

The root with the highest aggregate score is selected: $\rho^* = \arg\max_\rho\, s(\rho, x, \iota)$.

---

## 4. Implementation

The system is implemented in TypeScript with zero runtime dependencies.

| Component           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| Root dictionary     | 152 triconsonantal roots across 15 semantic domains       |
| Keyword index       | ~2,456 keywords (English and Arabic) mapped to roots      |
| Pattern set         | 10 morphological operators                                |
| Intent set          | 10 intent categories                                      |
| Action rules        | 80 entries in the $I \times P \rightarrow A$ lookup table |
| Co-occurrence pairs | 88 context disambiguation rules                           |
| Response templates  | 16 action-type templates for output generation            |

The entire system compiles to approximately 74 KB (minified). Inference requires no network access, no GPU, and no external service. The implementation is released under the ISC license.

---

## 5. Evaluation

### 5.1 Test Set Construction

We constructed a preliminary test set of 100 utterances distributed across 6 categories:

| Category              | Count | Description                                                      |
| --------------------- | ----- | ---------------------------------------------------------------- |
| Intent classification | 20    | Mapping input to correct intent                                  |
| Action resolution     | 20    | Mapping token to correct action type                             |
| Bilingual parity      | 20    | Same input in English and Arabic should produce identical tokens |
| Paraphrase handling   | 15    | Semantically equivalent rephrasings                              |
| Domain disambiguation | 15    | Polysemous inputs requiring context                              |
| Consistency           | 10    | Identical inputs producing identical outputs                     |

**Limitation:** This test set was authored by the system developer for the system's dictionary. As such, these results represent performance _within the designed scope_ and should not be interpreted as general accuracy claims.

### 5.2 Results

| Metric                  | Score                                         |
| ----------------------- | --------------------------------------------- |
| Intent accuracy         | 98.6% (69/70 intent-bearing cases)            |
| Action accuracy         | 97.1% (68/70 action-bearing cases)            |
| Bilingual parity        | 90.0% (18/20 pairs produced identical tokens) |
| Paraphrase invariance   | 73.3% (11/15 rephrasings resolved correctly)  |
| Disambiguation accuracy | 86.7% (13/15 polysemous inputs correct)       |
| Consistency             | 100% (10/10 — deterministic by construction)  |
| Mean inference time     | 7.8 µs                                        |

### 5.3 Error Analysis

We identified the following failure modes:

**Synonym gap (5 errors).** The input used a synonym not present in the keyword index. Example: "switch on the lights" failed because "switch on" was not mapped to root فعل (activate), though "turn on" was. This is a dictionary coverage problem, not a formalism limitation.

**Paraphrase blindness (4 errors).** Indirect or hedged phrasing was not captured. Example: "could you maybe look into getting us a meeting room" failed because the signal words were diluted by hedging language. Statistical models handle this naturally; our rule-based encoder does not.

**Arabic dialect mismatch (2 errors).** The system expects Modern Standard Arabic (فصحى). Dialectal input (عامية) with non-standard lexemes was not recognized.

**Cross-domain ambiguity (1 error).** "Store the data and store the boxes" contains "store" in two senses. The encoder resolved to a single root, failing on the multi-sense input.

### 5.4 Ablation Study

We measured the contribution of each encoder layer by removing it and re-evaluating:

| Configuration                      | Intent Accuracy | Action Accuracy |
| ---------------------------------- | --------------- | --------------- |
| Full system (all 5 layers)         | 98.6%           | 97.1%           |
| Without Layer 5 (cross-attention)  | 94.3%           | 91.4%           |
| Without Layer 4 (domain coherence) | 97.1%           | 95.7%           |
| Without Layer 3 (proximity)        | 95.7%           | 94.3%           |
| Without Layer 2 (co-occurrence)    | 90.0%           | 87.1%           |
| Layer 1 only (keywords)            | 81.4%           | 78.6%           |

The co-occurrence disambiguation layer (Layer 2) and intent–root cross-attention (Layer 5) contribute the most to accuracy, accounting for a combined +17.2% improvement over keyword matching alone.

---

## 6. Discussion

### 6.1 What the Formalism Can Do

The Arabic Algebra formalism demonstrates that Arabic root-pattern morphology, when used as a computational structure, can support deterministic intent resolution within a bounded domain. Three properties distinguish it from statistical approaches:

1. **Full traceability.** Every output is derivable from a specific root, pattern, rule, and encoder trace. No step is opaque.
2. **Determinism.** Identical inputs always produce identical outputs. This is a property that probabilistic models, including LLMs with temperature > 0, cannot guarantee.
3. **Zero-parameter inference.** The system requires no learned weights, no training data, and no external services at inference time.

### 6.2 What the Formalism Cannot Do

The limitations are equally important to document:

1. **Coverage is bounded by the dictionary.** The system can only resolve intents involving the 152 curated roots and their associated keywords. Outside this set, it produces no output — it does not degrade gracefully.
2. **Paraphrase sensitivity.** Without distributional semantics, the system is brittle to rephrasings that use different vocabulary to express the same meaning.
3. **No generative capability.** The system cannot produce novel language, handle open-ended queries, or reason about concepts outside its defined domains.
4. **Simplification of morphology.** The formalism abstracts away significant morphological complexity (phonological processes, broken plurals, semantic drift in derived forms). Whether a more faithful morphological model would improve or complicate the system is an open question.

### 6.3 On the Evaluation

We acknowledge that evaluating a system on its own author-constructed test set is a significant methodological limitation. The high accuracy scores (97–99%) are expected under these conditions and should be discounted accordingly. A meaningful evaluation requires an externally constructed test set with inputs from users who have not seen the system's dictionary — this is an immediate priority for future work.

### 6.4 Relationship to Prior Work on Semitic Morphology

McCarthy (1981) formalized Semitic morphology as the interleaving of a consonantal root with a prosodic template. Beesley and Karttunen (2003) implemented this using finite-state transducers. Our work takes a different direction: rather than modeling morphology _for linguistic analysis_, we use the compositional structure _for computation_. The root is not analyzed — it is used as a semantic primitive. The pattern is not parsed — it is used as a functional operator.

This shifts Arabic morphology from the object of study to the medium of computation. Whether this reframing is productive beyond the narrow domain demonstrated here is an empirical question we hope this work begins to address.

---

## 7. Future Work

### 7.1 External Evaluation and Root Expansion

Construct a test set of 200+ utterances from bilingual speakers who have not seen the system's dictionary. Expand the root inventory from 152 to approximately 500, covering professional domains currently absent (medicine, law, technology, natural science, transport, construction, agriculture). Evaluate on MASSIVE (FitzGerald et al., 2022) by mapping its intents to the engine's semantic space.

### 7.2 Arabic Algebra as a Reasoning Tokenizer

The most promising extension of this work is a fundamental architectural shift: using the algebraic token vocabulary not as a standalone reasoning system, but as the **tokenization layer for a small trainable model**.

Standard language models use subword tokenizers (BPE, WordPiece) with vocabularies of 50,000+ tokens that carry no inherent semantic structure. The token "writer" and "library" appear unrelated; the model must learn their connection from billions of examples. We propose replacing the subword vocabulary with an algebra-derived vocabulary of approximately 700-750 structured tokens:

| Layer     | Content                                   | Count |
| --------- | ----------------------------------------- | ----- |
| Algebra   | Root tokens (Arabic triconsonantal roots) | ~500  |
| Algebra   | Pattern, intent, domain tokens            | ~60   |
| Structure | Relations, prepositions, pronouns         | ~50   |
| Modifiers | Slot keys and common values               | ~80   |
| Output    | Action types, confidence                  | ~35   |
| Meta      | Special tokens + dynamic literals         | ~30+  |

In this vocabulary, the semantic relationship between "writer" (`R:كتب × P:agent`) and "library" (`R:كتب × P:place`) is **encoded in the token structure itself** — both share root `R:كتب`. The model receives compositional semantics for free.

**The core hypothesis:** if the token vocabulary already encodes semantic relationships, the model needs far fewer parameters to reason correctly. A 10M parameter transformer trained on 750 algebra tokens may match a 1B parameter model trained on 50,000 BPE tokens for structured reasoning tasks.

**Architecture:**

$$\text{Input (any language)} \xrightarrow{\text{Encoder}_L} \text{Algebra tokens} \xrightarrow{\text{Tiny Transformer}} \text{Algebra tokens} \xrightarrow{\text{Decoder}_L} \text{Output (any language)}$$

The encoder and decoder are the only language-specific components. The reasoning core — the transformer operating on algebra tokens — is **language-independent**. The algebraic token $[I:seek, R:جمع, P:mutual]$ is identical whether derived from English "Schedule a meeting" or Arabic "رتب اجتماعاً". This is not full translation but **semantic extraction**: 4 questions (what intent? what concept? what role? what context?) answerable by keyword matching or a small classifier.

**Handling non-root Arabic.** Arabic text is approximately 85% root-derived words, 12% function words (prepositions, conjunctions), and 3% pronouns/deictics. Root-derived words map to algebra tokens. Function words map to structural tokens (في → `MK:location`, إذا → `REL:IF`, و → `REL:AND`). Pronouns map to reference tokens (`REF:self`, `REF:other`). The complete Arabic language thus decomposes into the algebra vocabulary.

**Preliminary infrastructure.** We have implemented a token vocabulary (460 tokens in current form), a bidirectional serializer (AlgebraToken ↔ token sequences ↔ numeric IDs), and a corpus builder that has generated 885 training examples from benchmark cases and template expansion. These are released alongside the main engine.

This direction — morphologically-structured tokenization as a substitute for learned subword embeddings — is, to our knowledge, unexplored. If the hypothesis holds, the implications extend beyond Arabic: any language with productive compositional morphology (Hebrew, Turkish, Finnish) could potentially serve as a structured tokenization substrate, and the principle of encoding semantic relationships in the vocabulary rather than learning them from data could inform tokenizer design generally.

### 7.3 Cross-linguistic Extension

Test whether the formalism generalizes to Hebrew (which shares the triconsonantal root system) and to agglutinative languages (Turkish, Finnish) where productive morphological composition is also present.

### 7.4 Formal Algebraic Analysis

Characterize the mathematical properties of the root × pattern composition: is it a monoid, a typed function space, a finite-state transduction? Understanding the algebraic structure may reveal expressiveness bounds and extension strategies.

---

## 8. Conclusion

We have presented a formal framework that uses Arabic triconsonantal root-pattern morphology as an algebraic basis for intent resolution. The framework defines an algebraic token composed of a root, pattern, intent, and modifiers; a deterministic 5-layer encoder; and a finite symbolic reasoning function. A prototype implementation demonstrates the approach on a preliminary test set.

The core insight — that a natural language's morphological regularity can serve as a computational formalism — is, to our knowledge, novel. Whether it is _useful_ beyond the narrow domain demonstrated here is an open question that requires external evaluation, broader benchmarks, and theoretical analysis.

We present this work as a starting point for investigation, not as a finished system. The formalism's strengths (determinism, traceability, zero-parameter inference) and weaknesses (limited coverage, paraphrase sensitivity, hand-curated dictionary) are both clearly documented.

The implementation is available at: https://github.com/emadjumaah/aae

---

## References

Abdelali, A., Darwish, K., Durrani, N., and Mubarak, H. (2016). Farasa: A fast and furious segmenter for Arabic. In _Proceedings of NAACL-HLT 2016 (Demonstrations)_, pages 11–16.

Beesley, K. R. and Karttunen, L. (2003). _Finite State Morphology_. CSLI Publications.

Brown, T., Mann, B., Ryder, N., et al. (2020). Language models are few-shot learners. In _Advances in Neural Information Processing Systems_, 33:1877–1901.

Buckwalter, T. (2004). Buckwalter Arabic morphological analyzer version 2.0. LDC2004L02, Linguistic Data Consortium.

Chen, Q., Zhuo, Z., and Wang, W. (2019). BERT for joint intent classification and slot filling. _arXiv preprint arXiv:1902.10909_.

Dorr, B. J. (1993). _Machine Translation: A View from the Lexicon_. MIT Press.

FitzGerald, J., Hench, C., Peris, C., et al. (2022). MASSIVE: A 1M-example multilingual natural language understanding dataset with 51 typologically-diverse languages. In _Proceedings of ACL 2023_, pages 4277–4302.

Garcez, A. d'A., Lamb, L. C., et al. (2019). Neural-symbolic computing: An effective methodology for principled integration of machine learning and reasoning. _Journal of Applied Logics_, 6(4):611–632.

Habash, N. (2010). _Introduction to Arabic Natural Language Processing_. Morgan & Claypool Publishers.

Kiraz, G. A. (2001). _Computational Nonlinear Morphology: With Emphasis on Semitic Languages_. Cambridge University Press.

Lamb, L. C., Garcez, A. d'A., et al. (2020). Graph neural networks meet neural-symbolic computing: A survey and perspective. _arXiv preprint arXiv:2003.00330_.

Liu, B. and Lane, I. (2016). Attention-based recurrent neural network models for joint intent detection and slot filling. In _Proceedings of Interspeech 2016_, pages 685–689.

McCarthy, J. J. (1981). A prosodic theory of nonconcatenative morphology. _Linguistic Inquiry_, 12(3):373–418.

McCarthy, J. (1980). Circumscription — A form of non-monotonic reasoning. _Artificial Intelligence_, 13(1-2):27–39.

Newell, A. and Simon, H. A. (1976). Computer science as empirical inquiry: Symbols and search. _Communications of the ACM_, 19(3):113–126.

Obeid, O., Zalmout, N., Khalifa, S., et al. (2020). CAMeL Tools: An open source Python toolkit for Arabic natural language processing. In _Proceedings of LREC 2020_, pages 7022–7032.

Pasha, A., Al-Badrashiny, M., Diab, M., et al. (2014). MADAMIRA: A fast, comprehensive tool for morphological analysis and disambiguation of Arabic. In _Proceedings of LREC 2014_, pages 1094–1101.

Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). Attention is all you need. In _Advances in Neural Information Processing Systems_, 30:5998–6008.

Zhang, C., Li, Y., Du, N., Fan, W., and Yu, P. S. (2019). Joint slot filling and intent detection via capsule neural networks. In _Proceedings of ACL 2019_, pages 5259–5267.
