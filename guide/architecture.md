# Architecture

> How the engine works, end to end.

## The Pipeline

Every input — English or Arabic — flows through the same pipeline:

```
Input text
    ↓
┌────────────────────┐
│  1. Tashkeel strip  │  Strip Arabic diacritical marks
│  2. Intent detect   │  Which of 10 intents? (keyword scoring)
│  3. Pattern detect  │  Which of 10 patterns? (keyword scoring)
│  4. Root detect     │  Which of 820 roots? (5-layer attention)
│  5. Modifier extract│  Time, target, topic, urgency, content
└────────┬───────────┘
         ↓
    AlgebraToken
  { intent, root, pattern, modifiers }
         ↓
┌────────────────────┐
│  engine.reason()    │  Lookup: intent × pattern → action
│                     │  Map: root → resource domain
│                     │  Format: modifiers → constraints
└────────┬───────────┘
         ↓
    ReasoningResult
  { actionType, resource, constraints, confidence }
         ↓
┌────────────────────┐
│  decodeLocal()      │  Template: action → natural language
└────────────────────┘
         ↓
    Response text
```

## The Encoder: 5 Layers

The encoder (`src/engine/core/encoder.ts`) maps raw text to an `AlgebraToken`. It uses 5 deterministic layers, no neural network:

### Layer 1: Keyword Scoring

Every root in the database has a list of English and Arabic keywords. The encoder scores each root by counting keyword matches in the input, weighted by **exclusivity** — a keyword that appears in only one root scores 3×, one shared across many roots scores 0.5×.

```
"deploy the server" →
  عمل (work):  "deploy" scores 3.0 (exclusive) + "server" scores 0 = 3.0
  صنع (make):  0
  رسل (send):  0
```

### Layer 2: Co-occurrence Disambiguation

88 hand-crafted context pairs resolve ambiguity. When a context word appears alongside a root's keyword, that root gets a boost.

```
"deploy" alone → ambiguous
"deploy" + "server" → boost عمل (work) by 6 points
"deploy" + "troops" → would boost a different root
```

This is analogous to the Q·K dot product in transformer attention — specific pairs produce high scores.

### Layer 3: Proximity Attention

Keywords that appear near each other (within a 5-word window) reinforce each other. Two keywords 2 words apart get a higher bonus than keywords 5 words apart.

```
"send the urgent report tomorrow"
  "urgent" and "report" are 1 word apart → high proximity bonus
```

### Layer 4: Domain Coherence

When multiple candidate roots belong to the same semantic domain and both scored well, they reinforce each other. If the input has signals pointing to "communication" domain roots, all communication roots get a small boost.

This mirrors multi-head attention converging on a consistent interpretation.

### Layer 5: Intent↔Root Cross-Attention

Certain intents align naturally with certain root domains. The intent "send" aligns with the "communication" domain. The intent "learn" aligns with "cognition" and "learning" domains. This bidirectional bias prevents mismatches like detecting intent=send but root=buy.

```
Intent domain affinity:
  send  → communication
  learn → cognition, learning
  seek  → seeking, spatial, time
  judge → decision, information
```

Roots in affine domains get +3.0 points when the detected intent matches.

### Zero-Match Fallback

If no keyword matches any root at all, the encoder doesn't guess — it returns the default root سأل (s-'-l, "ask"). This is the "I don't know" state. The engine never hallucinates.

### Tashkeel Normalization

Arabic text with vowel marks (أَرْسِلْ) is stripped to base consonants (أرسل) before matching. This covers Quranic Arabic, formal texts, and any vowelled input. The Unicode ranges stripped: `\u0610-\u061A`, `\u064B-\u065F`, `\u0670`, `\u06D6-\u06DC`, `\u06DF-\u06E4`, `\u06E7-\u06E8`, `\u06EA-\u06ED`.

### Arabic Word Boundaries

Standard regex `\b` doesn't work with Arabic characters. The encoder uses Unicode-aware boundaries: `(?:^|[\s\u060C\u061B])` (start of string or Arabic whitespace/punctuation) instead.

## The Engine: Rule Lookup

The engine (`src/engine/core/engine.ts`) takes an `AlgebraToken` and produces a `ReasoningResult`. The core logic is a single lookup table:

```
intent × pattern → action type
```

74 of the 100 possible combinations have explicit rules. The remaining 26 fall through to a generic "process" action with 0.5 confidence (vs 0.9 for matched rules).

Examples:

```
seek   × agent    → query         (find a person)
seek   × place    → schedule      (book a location)
send   × plural   → broadcast     (send to many)
learn  × causer   → request_teach (ask for training)
decide × patient  → resolve       (resolve an issue)
judge  × patient  → evaluate      (evaluate something)
```

The engine also:

- Maps the root to a **resource** label via `RESOURCE_MAP` (e.g., root جمع → "meeting/assembly")
- Formats modifiers into **constraints** (e.g., `time:tomorrow` → `time → tomorrow`)
- Builds a **resolved intent** string for debugging

## The Decoder: Templates

The decoder (`src/engine/core/decoder.ts`) converts a `ReasoningResult` to natural language using 16 templates — one per action type.

Each template has two parts:

- **confirm** — the main response ("I'll schedule {resource} {constraints}.")
- **followUp** — a question when info is missing ("What time works best?")

Constraints are formatted by type:

```
time    → "by tomorrow"
target  → "for the team"
topic   → "on budgets"
content → "(the report)"
urgency → "— urgent"
```

If fewer than 2 constraints are present, the decoder appends the follow-up question. This keeps responses conversational while prompting for missing information.

## File Map

```
src/engine/
  core/
    types.ts       ← AlgebraToken, ReasoningResult, all type unions
    encoder.ts     ← 5-layer encoder (this doc describes it)
    engine.ts      ← 74 action rules, resource mapping
    decoder.ts     ← 16 response templates
    dictionary.ts  ← Root and pattern constants
    translation.ts ← Optional LLM layer (only file with network access)
  data/
    roots.ts       ← 820 roots, deduplication, domain aggregator
    roots-*.ts     ← Per-domain root definitions (13 files)
  agent/
    index.ts       ← Agent API (see agent.md)
    decomposer.ts  ← Multi-step intent splitting
    executor.ts    ← Tool execution
    session.ts     ← Conversation state
    domains/*.ts   ← Domain tool definitions
```

---

← [Back to README](../README.md) | [The Algebra →](algebra.md)
