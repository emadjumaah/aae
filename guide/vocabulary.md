# Vocabulary

> Why 1,756 structured tokens beat 50,000 — and what they encode.

## The Problem with BPE

Every modern LLM uses byte-pair encoding (BPE) or similar statistical tokenization. GPT-4 uses ~100K tokens. LLaMA uses ~32K. These tokens are learned from raw text by frequency — they carry no meaning.

The token `" report"` (with leading space) might be token 1045. The token `"repo"` might be token 7823. The token `"rt"` might be token 412. None of these tokens know they're related. The model has to learn from billions of text examples that "report" is a noun, that it relates to "writing," that "quarterly report" differs from "police report."

## The Algebra Vocabulary

Our base vocabulary has **1,756 tokens**. Each one means something. (During training, literal tokens like `LIT:friday` and `TOOL:check_balance` expand the effective count to 4,366 — but the structured core is 1,756.)

### Token Categories

| Category           | Count     | Examples                                                                  |
| ------------------ | --------- | ------------------------------------------------------------------------- |
| Special tokens     | 5         | `<PAD>`, `<UNK>`, `<BOS>`, `<EOS>`, `<MASK>`                              |
| Intent tokens      | 10        | `I:send`, `I:seek`, `I:learn`, `I:do`, ...                                |
| Pattern tokens     | 10        | `P:agent`, `P:patient`, `P:instrument`, ...                               |
| Root tokens        | 820       | `R:رسل`, `R:كتب`, `R:فكر`, ...                                            |
| Root-Latin tokens  | 771       | `RL:r-s-l`, `RL:k-t-b`, `RL:f-k-r`, ... (49 roots share transliterations) |
| Domain tokens      | 29        | `D:communication`, `D:cognition`, `D:commerce`, ...                       |
| Action tokens      | 16        | `ACT:send`, `ACT:query`, `ACT:schedule`, ...                              |
| Modifier keys      | 10        | `MK:time`, `MK:target`, `MK:topic`, ...                                   |
| Modifier values    | 22        | `MV:time:tomorrow`, `MV:urgency:high`, ...                                |
| Relation operators | 11        | `AND`, `OR`, `NOT`, `IF`, `THEN`, `WHILE`, ...                            |
| Sequence markers   | 4         | `START`, `END`, `SEP`, `STEP`                                             |
| Confidence levels  | 3         | `CONF:high`, `CONF:medium`, `CONF:low`                                    |
| Next-step tokens   | 8         | `NEXT:execute`, `NEXT:confirm`, `NEXT:escalate`, ...                      |
| Context tokens     | 12        | `CTX:turn`, `CTX:prev_tool`, `CTX:sentiment:frustrated`, ...              |
| Chain step tokens  | 5         | `STEP:1` through `STEP:5`                                                 |
| Reason tokens      | 20        | `REASON:billing`, `REASON:account`, `REASON:technical`, ...               |
| **Base total**     | **1,756** |                                                                           |

At training time, additional tokens are registered dynamically:

| Dynamic category    | Count     | Source                                                                     |
| ------------------- | --------- | -------------------------------------------------------------------------- |
| Tool tokens         | ~64       | `TOOL:check_balance`, `TOOL:transfer_funds`, ... (from domain definitions) |
| Literal tokens      | ~2,546    | `LIT:friday`, `LIT:manager`, `LIT:a proposal`, ... (from training data)    |
| **Effective total** | **4,366** | (base + dynamic)                                                           |

### What a Token "Knows"

Consider BPE token 45 being the word "report" vs our token `R:قرر`.

**BPE token 45 ("report") knows nothing.** It's an integer. The model must learn from context:

- "report" can be a noun or verb
- "quarterly report" relates to finance
- "report to the manager" means something different
- "police report" relates to law enforcement

**Our token `R:قرر` knows:**

- It belongs to the "cognition" domain (from the root database)
- Its semantic field: "decide, determine, report, resolution, stability"
- It connects to 10 patterns (writer of reports, place of reporting, tool of reporting, ...)
- Combined with `I:seek` it produces a "query" action
- Combined with `I:send` it produces a "send" action
- Its resource label is "report/decision"

This information isn't learned — it's **given** by the algebraic structure.

## Serialization Format

The training data uses a structured token sequence:

### Input format

```
<BOS> I:send R:قرر RL:q-r-r P:patient MK:target MV:target:finance_team MK:time MV:time:Friday <EOS>
```

Breakdown:

- `<BOS>` — start of sequence
- `I:send` — intent operator
- `R:قرر` — Arabic root
- `RL:q-r-r` — Latin transliteration
- `P:patient` — pattern operator
- `MK:target` — modifier key (announces next modifier)
- `MV:target:finance_team` — modifier value
- `MK:time` / `MV:time:Friday` — another modifier
- `<EOS>` — end of sequence

### Output format

```
<BOS> ACT:send R:قرر D:communication MK:target MV:target:finance_team CONF:high <EOS>
```

Breakdown:

- `ACT:send` — the action the engine chose
- `D:communication` — the domain
- `CONF:high` — confidence level (high = matched a rule, low = fallback)

## Why Size Matters

### Embedding table size

The embedding table is `vocab_size × d_model`. For d_model=384:

| System   | Vocab     | Embedding params | % of model      |
| -------- | --------- | ---------------- | --------------- |
| GPT-4    | 100K      | 38.4M            | small % of 1.7T |
| LLaMA-7B | 32K       | 12.3M            | ~2%             |
| **Ours** | **4,366** | **1.68M**        | **8% of 21.1M** |

Even with literal tokens expanding the vocabulary from 1,756 base to 4,366 effective, the embedding table is still 7× smaller than LLaMA's. The bulk of the 21.1M parameters focus on learning the _relationships_ between algebraic tokens.

### Signal density

In BPE, a sentence like "send the quarterly report to the finance team by Friday" becomes ~10-15 tokens, most of which are function words ("the", "to", "by") that carry little meaning.

In our vocabulary, the same sentence becomes ~8 tokens, every one meaningful:

```
<BOS> I:send R:قرر RL:q-r-r P:patient MK:target MV:target:finance_team MK:time MV:time:Friday <EOS>
```

No filler tokens. Every token either declares a algebraic position (intent, root, pattern) or carries a constraint (modifier key/value). The model never wastes attention on articles and prepositions.

## The Analogy: Sheet Music vs Audio

BPE tokenizes language like digitizing raw audio — sample the waveform at regular intervals and encode each sample as a number. The numbers don't know about notes, rhythm, or harmony. The model has to rediscover all of music theory from the raw signal.

Our vocabulary tokenizes language like sheet music — each symbol **is** a note with pitch, duration, and position in a measure. A model trained on sheet music doesn't need to learn what a C-major chord sounds like from raw waveforms. It's written in the notation.

---

← [The Algebra](algebra.md) | [Back to README](../README.md) | [Training →](training.md)
