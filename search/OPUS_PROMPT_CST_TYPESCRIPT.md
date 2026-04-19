# Prompt for Claude Opus — Contextual Semantic Tokenizer: Proof of Concept
## Language: TypeScript (Node.js) + minimal Python for model training only

---

## The Hypothesis

Standard tokenizers (BPE) split text into arbitrary subword fragments.
"writer" becomes "writ" + "er" — meaningless pieces the model must
learn relationships between from billions of examples.

**The question:** what if tokens carried meaning before training starts?

```
BPE:  "writer"  →  ["writ", "er"]           no meaning
CST:  "writer"  →  [CMP:write:agent]         writer = one who writes
CST:  "library" →  [CMP:write:place]         library = place of writing
CST:  "message" →  [CMP:send:instance]       message = thing that was sent
CST:  "teacher" →  [CMP:know:causer]         teacher = one who causes knowing
```

If the vocabulary pre-encodes semantic structure, the transformer
may need less capacity and less data to learn language.

This is **Contextual Semantic Tokenization (CST)**.
This proof of concept tests whether the hypothesis holds on English.

---

## What You Are Building

### Part 1 — CST Tokenizer (TypeScript)
A tokenizer that converts English text into typed semantic tokens.
This is the entire experiment. Get this right before anything else.

### Part 2 — Data Pipeline (TypeScript)
Download English Wikipedia subset, tokenize it, output `.jsonl` files
ready for model training.

### Part 3 — Training Script (Python, one file only)
Minimal GPT-2 training script that reads the `.jsonl` files and trains.
Runs twice — once with BPE baseline, once with CST tokens.
Outputs perplexity curves for comparison.

---

## Token Type System

Every token has a TYPE prefix. Six types:

### ROOT — semantic field
```
Format:  ROOT:field
Example: ROOT:write   ROOT:send   ROOT:know   ROOT:gather
Meaning: the core semantic concept, normalized across synonyms
Count:   ~500-1000 (grows from corpus)
When:    word has known semantic field but pattern not identified
```

### ROLE — morphological operator  
```
Format:  ROLE:operator
Example: ROLE:agent   ROLE:patient   ROLE:place   ROLE:instance
         ROLE:negate  ROLE:repeat    ROLE:possible ROLE:plural
         ROLE:past    ROLE:future    ROLE:causer
Count:   ~15 fixed operators
When:    affix or grammatical marker detected
```

### CMP — composed token (ROOT × ROLE)
```
Format:  CMP:field:operator
Example: CMP:write:agent    = writer (one who writes)
         CMP:write:place    = library (place of writing)
         CMP:write:instance = document (a written thing)
         CMP:send:patient   = message (thing being sent)
         CMP:know:causer    = teacher (one who causes knowing)
         CMP:know:plural    = students (multiple learners)
Count:   ~10,000 possible combinations
When:    BOTH root field AND role are identified — this is the goal
```

### REL — relation between concepts
```
Format:  REL:relation
Example: REL:to      REL:from    REL:causes   REL:before
         REL:after   REL:with    REL:without  REL:enables
Count:   ~25 fixed
When:    preposition or conjunction maps to a logical relation
```

### STR — sentence structure marker
```
Format:  STR:marker
Example: STR:question   STR:negation   STR:condition
         STR:past       STR:future     STR:emphasis
Count:   ~15 fixed
When:    grammatical pattern detected at sentence level
```

### LIT — literal token
```
Format:  LIT:surface
Example: LIT:London   LIT:2025   LIT:iPhone   LIT:the   LIT:a
Count:   ~5000 (top proper nouns + function words from corpus)
When:    named entity, number, function word, or unrecognized word
         NEVER emit UNK if avoidable — always fall back to LIT
```

### Special tokens
```
[BOS]  [EOS]  [PAD]  [UNK]  [SEP]
```

---

## Tokenization Pipeline

Run these six stages IN ORDER for every sentence.

### Stage 1 — Normalize
```typescript
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
```

### Stage 2 — Sentence Structure Detection
Scan the full sentence BEFORE word-by-word processing.
Emit STR tokens that apply to the whole sentence.

```typescript
const STRUCTURE_PATTERNS = [
  { pattern: /\?$/, token: 'STR:question' },
  { pattern: /\b(not|never|no|cannot|can't|won't|don't|doesn't|didn't)\b/, token: 'STR:negation' },
  { pattern: /\b(if|unless|when|whenever|provided that)\b/, token: 'STR:condition' },
  { pattern: /\b(will|shall|going to|gonna)\b/, token: 'STR:future' },
  { pattern: /\b(was|were|had|did)\b/, token: 'STR:past' },
  { pattern: /!$/, token: 'STR:emphasis' },
]
// Emit matching STR tokens FIRST in the output sequence
```

### Stage 3 — Tokenize into words
Split on whitespace and punctuation.
Keep punctuation as separate items for relation detection.

### Stage 4 — NER (Named Entity Recognition)
Before morphology, detect entities that should NOT be decomposed.

```typescript
// Use compromise.js for NER — lightweight, no Python needed
// npm install compromise

import nlp from 'compromise'

function detectEntities(doc: any): Map<string, string> {
  const entities = new Map()
  
  doc.people().forEach((p: any) => 
    entities.set(p.text(), 'LIT:' + p.text()))
  doc.places().forEach((p: any) => 
    entities.set(p.text(), 'LIT:' + p.text()))
  doc.organizations().forEach((o: any) => 
    entities.set(o.text(), 'LIT:' + o.text()))
  doc.values().forEach((v: any) =>   // numbers, dates
    entities.set(v.text(), 'LIT:' + v.text()))
    
  return entities
}
// Words tagged as entities → emit LIT: directly, skip morphology
```

### Stage 5 — Morphological Decomposition
For each non-entity word, extract root + affixes.

```typescript
// Use compromise.js for lemmatization
// It handles: runs→run, wrote→write, libraries→library, etc.

// PREFIX → ROLE mapping
const PREFIX_ROLES: Record<string, string> = {
  'un':  'negate',     // unwrite, undo, unable
  'non': 'negate',     // nonfiction, nonstandard
  'dis': 'negate',     // disagree, disconnect
  're':  'repeat',     // rewrite, resend, redo
  'pre': 'before',     // preview, prebook
  'mis': 'wrong',      // misread, misuse
  'over':'excess',     // overload, overflow
  'co':  'mutual',     // cooperate, cowrite
  'out': 'exceed',     // outperform, outlast
}

// SUFFIX → ROLE mapping
const SUFFIX_ROLES: Record<string, string> = {
  'er':   'agent',      // writer, sender, teacher
  'or':   'agent',      // editor, actor, creator
  'ist':  'agent',      // journalist, specialist
  'ian':  'agent',      // librarian, technician
  'ee':   'patient',    // employee, trainee
  'tion': 'instance',   // information, communication
  'sion': 'instance',   // mission, decision
  'ment': 'instance',   // document, agreement
  'ance': 'instance',   // performance, distance
  'ence': 'instance',   // intelligence, reference
  'ness': 'state',      // awareness, darkness
  'ity':  'state',      // ability, quality
  'ery':  'place',      // bakery, library, surgery
  'ory':  'place',      // laboratory, auditory
  'room': 'place',      // classroom, boardroom
  'able': 'possible',   // readable, available
  'ible': 'possible',   // accessible, flexible
  'ful':  'has',        // meaningful, helpful
  'less': 'negate',     // careless, wireless
  'ly':   'manner',     // quickly, carefully
  's':    'plural',     // books, messages (after noun)
}

function decompose(word: string, lemma: string): { 
  root: string | null, 
  role: string | null 
} {
  // Check prefixes
  for (const [prefix, role] of Object.entries(PREFIX_ROLES)) {
    if (word.startsWith(prefix) && word.length > prefix.length + 2) {
      return { root: lemma, role }
    }
  }
  
  // Check suffixes (compare word to lemma to detect suffix)
  const suffix = detectSuffix(word, lemma)
  if (suffix && SUFFIX_ROLES[suffix]) {
    return { root: lemma, role: SUFFIX_ROLES[suffix] }
  }
  
  // Plural detection (compromise handles this)
  if (isPlural(word, lemma)) {
    return { root: lemma, role: 'plural' }
  }
  
  return { root: lemma, role: null }
}
```

### Stage 6 — Semantic Field Mapping
Map lemmas to semantic fields — this normalizes synonyms.

```typescript
// This is the key table — synonyms collapse to the same ROOT
// Start with ~200 entries, expand from corpus analysis

const SEMANTIC_FIELDS: Record<string, string> = {
  // Writing / Recording
  write: 'write', record: 'write', document: 'write',
  note: 'write', inscribe: 'write', draft: 'write',
  compose: 'write', author: 'write', publish: 'write',
  
  // Sending / Communication
  send: 'send', transmit: 'send', dispatch: 'send',
  forward: 'send', deliver: 'send', mail: 'send',
  email: 'send', message: 'send', broadcast: 'send',
  
  // Knowledge / Learning
  know: 'know', learn: 'know', understand: 'know',
  study: 'know', teach: 'know', educate: 'know',
  read: 'know', research: 'know', discover: 'know',
  
  // Gathering / Meeting
  meet: 'gather', assemble: 'gather', collect: 'gather',
  join: 'gather', unite: 'gather', gather: 'gather',
  group: 'gather', combine: 'gather',
  
  // Making / Creating
  make: 'create', build: 'create', create: 'create',
  produce: 'create', generate: 'create', form: 'create',
  construct: 'create', develop: 'create',
  
  // Movement
  go: 'move', travel: 'move', move: 'move',
  arrive: 'move', depart: 'move', return: 'move',
  enter: 'move', exit: 'move',
  
  // Time
  schedule: 'time', plan: 'time', arrange: 'time',
  book: 'time', reserve: 'time', postpone: 'time',
  
  // Decision
  decide: 'decide', choose: 'decide', select: 'decide',
  determine: 'decide', resolve: 'decide', confirm: 'decide',
  
  // Speaking
  say: 'speak', tell: 'speak', speak: 'speak',
  talk: 'speak', ask: 'speak', answer: 'speak',
  explain: 'speak', describe: 'speak',
  
  // Thinking
  think: 'think', consider: 'think', reason: 'think',
  analyze: 'think', evaluate: 'think', judge: 'think',
  
  // Helping / Enabling
  help: 'enable', support: 'enable', allow: 'enable',
  enable: 'enable', assist: 'enable', facilitate: 'enable',
  
  // ... expand as needed
}

function getSemanticField(lemma: string): string | null {
  return SEMANTIC_FIELDS[lemma] ?? null
}
```

### Stage 7 — Token Emission
Combine all stages into final token sequence.

```typescript
function emitTokens(
  word: string,
  lemma: string,
  isEntity: boolean,
  decomposition: { root: string | null, role: string | null },
  strTokens: string[]
): string[] {
  
  if (isEntity) {
    return ['LIT:' + word]
  }
  
  // Function words → LIT (they, a, the, is, are...)
  if (FUNCTION_WORDS.has(word)) {
    return ['LIT:' + word]
  }
  
  // Prepositions → REL tokens
  const rel = RELATION_MAP[word]
  if (rel) return [rel]
  
  const field = getSemanticField(lemma)
  const { role } = decomposition
  
  // Best case: composed token
  if (field && role) {
    return [`CMP:${field}:${role}`]
  }
  
  // Good case: root only
  if (field) {
    return [`ROOT:${field}`]
  }
  
  // Fallback: literal
  return [`LIT:${word}`]
}
```

---

## Concrete Examples — Verify These Exactly

Your tokenizer MUST produce these outputs.
Write tests for each one before moving on.

```
Input:  "The writer sent a message to the teacher"
Expected: [STR:past] [LIT:the] [CMP:write:agent] [CMP:send:past] 
          [LIT:a] [CMP:send:instance] [REL:to] [LIT:the] [CMP:know:causer]

Input:  "Students learn in the library"
Expected: [CMP:know:plural] [ROOT:know] [REL:in] [LIT:the] [CMP:write:place]

Input:  "Will you send the document?"
Expected: [STR:future] [STR:question] [LIT:you] [ROOT:send] 
          [LIT:the] [CMP:write:instance]

Input:  "She cannot rewrite the unreadable text"
Expected: [STR:negation] [LIT:she] [CMP:write:repeat] 
          [LIT:the] [STR:negation] [CMP:know:possible] [LIT:text]

Input:  "The meeting was scheduled for tomorrow"
Expected: [STR:past] [LIT:the] [CMP:gather:instance] 
          [ROOT:time] [LIT:for] [LIT:tomorrow]
```

---

## Relation Map

```typescript
const RELATION_MAP: Record<string, string> = {
  'to':        'REL:to',
  'toward':    'REL:to',
  'from':      'REL:from',
  'with':      'REL:with',
  'without':   'REL:without',
  'because':   'REL:causes',
  'so':        'REL:causes',
  'before':    'REL:before',
  'after':     'REL:after',
  'during':    'REL:during',
  'in':        'REL:in',
  'at':        'REL:at',
  'by':        'REL:by',
  'for':       'REL:for',
  'of':        'REL:of',
  'about':     'REL:about',
  'between':   'REL:between',
  'through':   'REL:through',
  'against':   'REL:against',
  'despite':   'REL:despite',
  'and':       'REL:and',
  'or':        'REL:or',
  'but':       'REL:but',
  'if':        'REL:condition',
  'unless':    'REL:condition',
}
```

---

## Project Structure

```
cst-poc/
  src/
    tokenizer/
      index.ts            ← public API
      normalizer.ts       ← Stage 1: text cleaning
      structureDetector.ts ← Stage 2: STR token detection
      ner.ts              ← Stage 4: named entity detection
      morphology.ts       ← Stage 5: prefix/suffix decomposition
      semanticFields.ts   ← Stage 6: lemma → field mapping
      emitter.ts          ← Stage 7: final token emission
      vocabulary.ts       ← token registry, ID mapping, save/load
      types.ts            ← all interfaces and enums

    data/
      semanticFields.json ← lemma → field (start with 200, grow)
      prefixRoles.json    ← prefix → ROLE
      suffixRoles.json    ← suffix → ROLE
      relationMap.json    ← preposition → REL
      structurePatterns.json ← grammar → STR
      functionWords.txt   ← words that always become LIT

    pipeline/
      download.ts         ← download Wikipedia subset
      process.ts          ← tokenize Wikipedia → .jsonl
      stats.ts            ← coverage analysis

    tests/
      normalizer.test.ts
      structure.test.ts
      morphology.test.ts
      emitter.test.ts
      examples.test.ts    ← exact match tests for all examples above
      coverage.test.ts    ← 10K sentences, measure CMP+ROOT ratio

  training/               ← Python only, minimal
    train.py              ← reads .jsonl, trains GPT-2, saves checkpoints
    compare.py            ← plots perplexity: BPE vs CST
    requirements.txt      ← torch, transformers, datasets

  data/
    wikipedia/            ← downloaded Wikipedia subset
    tokenized/
      cst/                ← CST tokenized .jsonl files
      bpe/                ← BPE tokenized .jsonl files (for baseline)
    vocab/
      cst-vocab.json      ← CST vocabulary with IDs
      bpe-vocab.json      ← BPE vocabulary (standard GPT-2)

  package.json
  tsconfig.json
  README.md
```

---

## Dependencies

```json
// package.json
{
  "dependencies": {
    "compromise": "^14.10.0",     // NLP: lemma, NER, POS — no Python
    "compromise-numbers": "^1.4", // number detection
    "tsx": "^4.0.0"               // run TypeScript directly
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0"            // testing
  },
  "scripts": {
    "test": "vitest",
    "coverage": "tsx src/tests/coverage.test.ts",
    "process": "tsx src/pipeline/process.ts",
    "stats": "tsx src/pipeline/stats.ts"
  }
}
```

```
# training/requirements.txt
torch>=2.0
transformers>=4.35
datasets
tiktoken
matplotlib
numpy
tqdm
```

---

## Core Types

```typescript
// src/tokenizer/types.ts

export type TokenType = 'ROOT' | 'ROLE' | 'CMP' | 'REL' | 'STR' | 'LIT' | 'SPECIAL'

export interface Token {
  type:       TokenType
  value:      string        // full token string e.g. "CMP:write:agent"
  field?:     string        // semantic field e.g. "write"
  role?:      string        // role e.g. "agent"
  surface:    string        // original word this came from
  id:         number        // integer ID for model
  confidence: number        // 0.0-1.0
}

export interface TokenizerOutput {
  tokens:   Token[]
  ids:      number[]
  coverage: CoverageStats
}

export interface CoverageStats {
  total:    number
  cmp:      number    // CMP tokens — best
  root:     number    // ROOT tokens — good
  str:      number    // STR tokens — good
  rel:      number    // REL tokens — good
  lit:      number    // LIT tokens — neutral
  unk:      number    // UNK tokens — bad
  structured: number  // cmp + root + str + rel combined
  ratio:    number    // structured / total
}

export interface VocabEntry {
  token:     string
  id:        number
  type:      TokenType
  frequency: number
  gloss?:    string   // human-readable description for debugging
}
```

---

## Public API

```typescript
// src/tokenizer/index.ts

export class CSTTokenizer {

  // Core
  tokenize(text: string): TokenizerOutput
  tokenizeBatch(texts: string[]): TokenizerOutput[]

  // For model training
  encode(text: string): number[]
  decode(ids: number[]): Token[]

  // Vocabulary
  buildVocab(texts: string[], maxLiterals?: number): void
  saveVocab(path: string): void
  loadVocab(path: string): void
  getVocabSize(): number

  // Analysis
  getCoverage(texts: string[]): CoverageStats
}
```

---

## Wikipedia Data Pipeline

```typescript
// src/pipeline/download.ts
// Use HuggingFace datasets via HTTP — no Python needed

// Download: https://huggingface.co/datasets/wikipedia
// English Wikipedia 20220301.en subset
// Use the plain text version — ~20GB full, use 2GB subset for POC

// Stream and process:
async function downloadWikipedia(outputDir: string, maxMB: number) {
  // stream from HuggingFace Hub
  // write raw text files
  // stop at maxMB
}

// src/pipeline/process.ts
// Read raw Wikipedia text
// Tokenize with CST
// Write .jsonl where each line is one training example:
// {"ids": [4, 23, 891, 2, ...], "text": "original sentence for debug"}

async function processWikipedia(
  inputDir: string,
  outputDir: string,
  tokenizer: CSTTokenizer
) {
  // Read sentences
  // Tokenize each
  // Write to outputDir/cst/train.jsonl and val.jsonl
  // Log coverage stats every 10K sentences
}
```

---

## Training Script (Python — minimal)

```python
# training/train.py
# Reads .jsonl from TypeScript pipeline
# Trains GPT-2 small
# Saves checkpoints + perplexity log

import json, torch
from transformers import GPT2Config, GPT2LMHeadModel
from torch.utils.data import Dataset, DataLoader

# Config — same for both BPE and CST runs
MODEL_CONFIG = {
    'n_positions': 256,
    'n_embd': 384,
    'n_layer': 6,
    'n_head': 6,
    'n_inner': 1536,
}
# ~30M params with CST vocab (~16K)
# ~32M params with BPE vocab (50K) — embedding table slightly bigger

class TokenizedDataset(Dataset):
    def __init__(self, jsonl_path: str, seq_len: int = 256):
        self.examples = []
        with open(jsonl_path) as f:
            for line in f:
                item = json.loads(line)
                ids = item['ids']
                # chunk into seq_len windows
                for i in range(0, len(ids) - seq_len, seq_len // 2):
                    self.examples.append(ids[i:i+seq_len])
    
    def __len__(self): return len(self.examples)
    def __getitem__(self, i): return torch.tensor(self.examples[i])

def train(
    data_path: str,      # path to .jsonl
    vocab_size: int,     # CST: ~16000, BPE: 50257
    output_dir: str,
    steps: int = 50000,
):
    config = GPT2Config(vocab_size=vocab_size, **MODEL_CONFIG)
    model = GPT2LMHeadModel(config)
    
    dataset = TokenizedDataset(data_path)
    loader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
    
    log = []
    step = 0
    
    for batch in loader:
        if step >= steps: break
        
        outputs = model(batch, labels=batch)
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        
        if step % 500 == 0:
            perplexity = torch.exp(loss).item()
            log.append({'step': step, 'perplexity': perplexity})
            print(f"step {step}: perplexity {perplexity:.2f}")
        
        step += 1
    
    # Save log
    with open(f"{output_dir}/perplexity_log.json", 'w') as f:
        json.dump(log, f)
    
    model.save_pretrained(output_dir)

# Run:
# python train.py --data data/tokenized/cst/train.jsonl
#                 --vocab_size 16000
#                 --output checkpoints/cst
#
# python train.py --data data/tokenized/bpe/train.jsonl
#                 --vocab_size 50257
#                 --output checkpoints/bpe

# training/compare.py
# Reads both perplexity logs, plots comparison chart
import json, matplotlib.pyplot as plt

def compare(cst_log: str, bpe_log: str, output: str):
    cst = json.load(open(cst_log))
    bpe = json.load(open(bpe_log))
    
    plt.figure(figsize=(10, 6))
    plt.plot([x['step'] for x in cst], [x['perplexity'] for x in cst], 
             label='CST Tokenizer', color='blue')
    plt.plot([x['step'] for x in bpe], [x['perplexity'] for x in bpe],
             label='BPE Baseline', color='orange')
    plt.xlabel('Training Steps')
    plt.ylabel('Perplexity (lower = better)')
    plt.title('Contextual Semantic Tokenization vs BPE\nSame model, same data, same steps')
    plt.legend()
    plt.savefig(output)
    print(f"Chart saved to {output}")
```

---

## Coverage Test

```typescript
// src/tests/coverage.test.ts
// Run on 10K Wikipedia sentences BEFORE any model training

import { CSTTokenizer } from '../tokenizer'

const tokenizer = new CSTTokenizer()
tokenizer.loadVocab('data/vocab/cst-vocab.json')

// Download 10K sentences from Wikipedia
const sentences = await load10KWikipediaSentences()

let total = { cmp: 0, root: 0, str: 0, rel: 0, lit: 0, unk: 0, all: 0 }

for (const sentence of sentences) {
  const output = tokenizer.tokenize(sentence)
  total.cmp  += output.coverage.cmp
  total.root += output.coverage.root
  total.str  += output.coverage.str
  total.rel  += output.coverage.rel
  total.lit  += output.coverage.lit
  total.unk  += output.coverage.unk
  total.all  += output.coverage.total
}

const structured = (total.cmp + total.root + total.str + total.rel) / total.all

console.log('Coverage Results:')
console.log(`  CMP:  ${(total.cmp / total.all * 100).toFixed(1)}%`)
console.log(`  ROOT: ${(total.root / total.all * 100).toFixed(1)}%`)
console.log(`  STR:  ${(total.str / total.all * 100).toFixed(1)}%`)
console.log(`  REL:  ${(total.rel / total.all * 100).toFixed(1)}%`)
console.log(`  LIT:  ${(total.lit / total.all * 100).toFixed(1)}%`)
console.log(`  UNK:  ${(total.unk / total.all * 100).toFixed(1)}%`)
console.log(`  STRUCTURED TOTAL: ${(structured * 100).toFixed(1)}%`)
console.log()

// MUST PASS before model training
if (structured < 0.55) {
  console.error('FAIL: structured tokens below 55% threshold')
  console.error('Fix the tokenizer before training any model')
  process.exit(1)
}

if (total.unk / total.all > 0.02) {
  console.error('FAIL: UNK tokens above 2% threshold')
  process.exit(1)
}

console.log('PASS: tokenizer ready for model training')
```

---

## Build Order — Strict

```
Week 1: Tokenizer core
  Day 1-2: types.ts, normalizer.ts, structureDetector.ts
            + tests — must pass before continuing
  Day 3-4: morphology.ts, semanticFields.ts (200 entries)
            + tests
  Day 5:   ner.ts, emitter.ts
            + exact match tests for all 5 examples above

Week 2: Pipeline + coverage
  Day 1-2: vocabulary.ts, index.ts (public API)
  Day 3:   pipeline/download.ts, pipeline/process.ts
  Day 4-5: coverage.test.ts on 10K Wikipedia sentences
           Fix until structured > 55%
           Expand semanticFields.json from coverage gaps

Week 3: Training
  Day 1:   Python training/train.py
           Process Wikipedia with CST tokenizer → .jsonl
           Process same Wikipedia with BPE → .jsonl (baseline)
  Day 2-5: Train both models (needs GPU — use Colab or local)
           50K steps each, log perplexity every 500 steps

Week 4: Results
  Day 1:   compare.py — plot the chart
  Day 2-3: Analyze: why did CST win or lose?
           Coverage analysis: which semantic fields appear most?
           Error analysis: what did the tokenizer get wrong?
  Day 4-5: Write up honest findings
```

---

## Success Criteria

### Tokenizer (must pass before model training)
```
Coverage on 10K Wikipedia sentences:
  CMP + ROOT + STR + REL > 55%   REQUIRED
  LIT < 40%                       REQUIRED
  UNK < 2%                        REQUIRED

Exact match on all 5 example sentences: 100%

Speed: < 5ms per sentence
```

### Experiment
```
Primary: Does CST reach lower perplexity than BPE?
         At 10K steps? At 30K steps? At 50K steps?
         Even 5% lower perplexity is meaningful.

Secondary: Token efficiency
           How many CST tokens per sentence vs BPE tokens?
           Fewer tokens = more context per window = potential advantage

Honest reporting:
  If CST wins → hypothesis supported, scale up
  If BPE wins → hypothesis rejected, report why, move on
  Either result is valid and worth reporting
```

---

## The Question This Answers

> Does pre-encoding semantic structure in the token vocabulary
> reduce what a transformer needs to learn from data?

Build it cleanly.
Test it honestly.
Report what you find.

The tokenizer is the experiment.
If the tokenizer is wrong, everything is wrong.
Start there. Nothing else until it passes.
