# The Algebra

> Roots, patterns, intents — and how they combine into a 3D reasoning space.

## What "Algebra" Means Here

Arabic grammar already is an algebra. Every Arabic word decomposes into:

- A **root** (جذر): 3 consonants that carry core meaning
- A **pattern** (وزن): a vowel template that transforms that meaning

The root ك-ت-ب (k-t-b) means "writing/inscription." Apply different patterns:

| Pattern               | Arabic | Meaning                                |
| --------------------- | ------ | -------------------------------------- |
| فَاعِل (agent)        | كاتب   | writer                                 |
| مَفْعُول (patient)    | مكتوب  | written (document)                     |
| فَعَّال (intensive)   | كتّاب  | scribes (many writers)                 |
| مَفْعَل (place)       | مكتب   | office/desk (place of writing)         |
| تَفَاعُل (reciprocal) | تكاتب  | correspondence (writing to each other) |
| إفعال (causer)        | إكتاب  | dictation (causing writing)            |
| فَعِيل (result)       | كتيب   | booklet (result of writing)            |

This system has worked for 1400+ years across millions of words. We formalize it.

## The Three Axes

The engine operates in a 3D space:

```
Intent (10) × Root (820) × Pattern (10) = reasoning space
```

### Axis 1: Intent (10 operators)

What the speaker _wants_ to happen:

| Intent | Arabic | Example trigger                |
| ------ | ------ | ------------------------------ |
| send   | أرسل   | "send", "deliver", "transmit"  |
| seek   | طلب    | "find", "search", "look for"   |
| learn  | تعلم   | "learn", "study", "understand" |
| build  | بنى    | "create", "build", "construct" |
| store  | خزن    | "save", "store", "archive"     |
| gather | جمع    | "collect", "gather", "compile" |
| decide | قرر    | "decide", "choose", "resolve"  |
| judge  | حكم    | "evaluate", "assess", "review" |
| change | غير    | "update", "modify", "change"   |
| show   | عرض    | "show", "display", "present"   |

Each intent has a priority (1–10, lower = higher priority). When input matches multiple intents, the highest-priority one wins.

### Axis 2: Root (820 entries across 29 domains)

The root identifies _what thing_ the sentence is about. 820 roots are organized into semantic domains:

| Domain        | Count | Examples                                      |
| ------------- | ----- | --------------------------------------------- |
| communication | 60+   | رسل (send), كلم (speak), نبأ (inform)         |
| cognition     | 50+   | فكر (think), فهم (understand), ذكر (remember) |
| commerce      | 40+   | بيع (sell), شرى (buy), ربح (profit)           |
| movement      | 40+   | مشى (walk), سفر (travel), هجر (migrate)       |
| creation      | 30+   | صنع (make), بنى (build), خلق (create)         |
| ...           | ...   | 29 domains total                              |

The encoder's 5 attention layers (described in [architecture.md](architecture.md)) select the best root.

### Axis 3: Pattern (10 operators)

The pattern describes the _grammatical role_ of the subject:

| Pattern    | Arabic | Meaning                            |
| ---------- | ------ | ---------------------------------- |
| agent      | فاعل   | the doer ("the writer")            |
| patient    | مفعول  | the receiver ("the written thing") |
| instrument | آلة    | the tool ("the pen")               |
| place      | مكان   | the location ("the office")        |
| time       | زمان   | the time ("the writing session")   |
| plural     | جمع    | many ("the writers")               |
| intensive  | مبالغة | extreme ("prolific writer")        |
| diminutive | تصغير  | small ("a short note")             |
| causer     | سبب    | the cause ("the one who dictated") |
| reciprocal | تفاعل  | mutual ("correspondence")          |

## The Result: 100 Actions

Intent × Pattern → Action.

From 10 intents and 10 patterns, there are 100 possible combinations. 74 have explicit action rules:

```
seek  × agent    → query         (seeking + doer = ask a person)
seek  × place    → schedule      (seeking + location = book a place)
seek  × time     → schedule      (seeking + time = schedule something)
send  × plural   → broadcast     (sending + many = broadcast)
send  × agent    → send          (sending + doer = send to person)
build × result   → create        (building + result = create something)
learn × causer   → request_teach (learning + cause = request teaching)
judge × patient  → evaluate      (judging + receiver = evaluate)
```

The 26 unmapped combinations fall back to a generic "process" action at lower confidence.

## Worked Example: "اجمع التقرير المالي غدا"

"Collect the financial report tomorrow."

```
Step 1 — Intent detection:
  "اجمع" matches intent keyword "جمع" (gather) → intent = gather

Step 2 — Pattern detection:
  "التقرير" (the report) → patient pattern (it's being acted upon)

Step 3 — Root detection:
  "تقرير" stems from root ق-ر-ر (q-r-r, "decide/report")
  "مالي" (financial) → boosts commerce domain roots
  Co-occurrence: "تقرير" + "مالي" → strong match for ق-ر-ر

Step 4 — Modifiers:
  "غدا" (tomorrow) → time modifier

Step 5 — Encode:
  AlgebraToken {
    intent: "gather",
    root: "قرر",
    rootLatin: "q-r-r",
    pattern: "patient",
    modifiers: [{ key: "time", value: "غدا" }]
  }

Step 6 — Engine reasoning:
  gather × patient → "assemble" action (0.9 confidence)
  root قرر → resource "report/decision"

Step 7 — Decode:
  "I'll assemble report/decision by غدا."
```

## Worked Example: "send the quarterly report to the finance team by Friday"

```
Step 1 — Intent: "send" → intent = send
Step 2 — Pattern: "quarterly report" (thing being sent) → patient
Step 3 — Root: "report" matches ق-ر-ر (q-r-r, "report/decision")
Step 4 — Modifiers:
  target: "finance team"
  time: "Friday"
  content: "quarterly report"

Step 5 — Encode:
  AlgebraToken {
    intent: "send",
    root: "قرر",
    rootLatin: "q-r-r",
    pattern: "patient",
    modifiers: [
      { key: "target", value: "finance team" },
      { key: "time", value: "Friday" },
      { key: "content", value: "quarterly report" }
    ]
  }

Step 6 — Engine reasoning:
  send × patient → "send" action (0.9 confidence)
  root قرر → resource "report/decision"

Step 7 — Decode:
  "I'll send report/decision for finance team by Friday (quarterly report)."
```

## Why This Matters

In a standard LLM, "send report" and "send troops" are just sequences of BPE tokens. The model has to learn from millions of examples that these need different handling.

In our algebra:

- "send report" → intent=send, root=ق-ر-ر (report), pattern=patient → **send action**
- "send troops" → intent=send, root=ج-ن-د (soldiers), pattern=plural → **coordinate action**

The algebra _already knows_ these are different because the root carries domain knowledge and the pattern carries grammatical structure. The system doesn't need millions of examples to learn this distinction — it's encoded in the algebra.

---

← [Architecture](architecture.md) | [Back to README](../README.md) | [Vocabulary →](vocabulary.md)
