/**
 * Arabic Algebra — Massive Corpus Expansion (No LLM needed)
 *
 * Generates ~5,000 diverse training examples by:
 *   1. Systematic root × intent × pattern × modifier combinations
 *   2. Paraphrase templates with slot filling
 *   3. Arabic input variations
 *   4. Multi-modifier combinations
 *
 * Run: npx tsx training/expand-massive.ts
 */

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeLocal } from "../src/core/encoder.js";
import { engine } from "../src/core/engine.js";
import { ALL_ROOT_DATA } from "../src/data/roots.js";
import {
  serializeInput,
  serializeOutput,
} from "../src/reasoning/serializer.js";
import type { IntentOperator } from "../src/core/types.js";

// ─── Sentence Templates Per Intent ─────────────────────────────────────────

const TEMPLATES: Record<IntentOperator, string[]> = {
  seek: [
    "Find {kw}",
    "I need to find {kw}",
    "Search for {kw}",
    "Where can I find {kw}",
    "Look up {kw}",
    "I'm looking for {kw}",
    "Help me locate {kw}",
    "Can you find {kw} for me",
    "I want to locate {kw}",
    "Need {kw} urgently",
    "Get me {kw}",
    "I require {kw}",
    "Locate {kw} please",
    "I'm searching for {kw}",
    "Find me the {kw}",
  ],
  do: [
    "Execute {kw}",
    "Run {kw}",
    "Do {kw}",
    "Perform {kw}",
    "Handle {kw}",
    "Process {kw}",
    "Complete {kw}",
    "Carry out {kw}",
    "Start {kw}",
    "Begin {kw}",
    "Initiate {kw}",
    "Work on {kw}",
    "Take care of {kw}",
    "Execute the {kw} task",
    "Finish {kw}",
  ],
  send: [
    "Send {kw}",
    "Send {kw} to the team",
    "Forward {kw}",
    "Deliver {kw}",
    "Share {kw}",
    "Dispatch {kw}",
    "Email {kw}",
    "Transmit {kw}",
    "Pass along {kw}",
    "Send out {kw}",
    "Distribute {kw}",
    "Mail {kw} to everyone",
    "Ship {kw}",
    "Send {kw} right away",
    "Forward {kw} to the manager",
  ],
  gather: [
    "Collect {kw}",
    "Gather {kw}",
    "Assemble {kw}",
    "Compile {kw}",
    "Pull together {kw}",
    "Round up {kw}",
    "Get all {kw}",
    "Bring together {kw}",
    "Aggregate {kw}",
    "Accumulate {kw}",
    "Consolidate {kw}",
    "Amass {kw}",
    "Pool {kw} together",
    "Collect all the {kw}",
    "Gather up {kw}",
  ],
  record: [
    "Record {kw}",
    "Save {kw}",
    "Store {kw}",
    "Log {kw}",
    "Document {kw}",
    "Write down {kw}",
    "Note {kw}",
    "Archive {kw}",
    "Keep a record of {kw}",
    "Preserve {kw}",
    "File {kw}",
    "Register {kw}",
    "Catalog {kw}",
    "Take note of {kw}",
    "Put {kw} on file",
  ],
  learn: [
    "Learn about {kw}",
    "Study {kw}",
    "Research {kw}",
    "Understand {kw}",
    "Read about {kw}",
    "Investigate {kw}",
    "Explore {kw}",
    "Dive into {kw}",
    "Analyze {kw}",
    "Examine {kw}",
    "Look into {kw}",
    "Find out about {kw}",
    "Study up on {kw}",
    "Get familiar with {kw}",
    "Educate me on {kw}",
  ],
  decide: [
    "Decide on {kw}",
    "Resolve {kw}",
    "Determine {kw}",
    "Choose {kw}",
    "Make a decision about {kw}",
    "Settle {kw}",
    "Finalize {kw}",
    "Confirm {kw}",
    "Pick {kw}",
    "Weigh options for {kw}",
    "Deliberate on {kw}",
    "Conclude {kw}",
    "Commit to {kw}",
    "Lock in {kw}",
    "Approve {kw}",
  ],
  enable: [
    "Enable {kw}",
    "Activate {kw}",
    "Turn on {kw}",
    "Unlock {kw}",
    "Allow {kw}",
    "Set up {kw}",
    "Switch on {kw}",
    "Grant access to {kw}",
    "Open up {kw}",
    "Make {kw} available",
    "Provision {kw}",
    "Authorize {kw}",
    "Permit {kw}",
    "Launch {kw}",
    "Boot up {kw}",
  ],
  judge: [
    "Evaluate {kw}",
    "Assess {kw}",
    "Review {kw}",
    "Rate {kw}",
    "Grade {kw}",
    "Audit {kw}",
    "Check {kw}",
    "Inspect {kw}",
    "Appraise {kw}",
    "Score {kw}",
    "Critique {kw}",
    "Rank {kw}",
    "Benchmark {kw}",
    "Measure {kw}",
    "Test {kw} quality",
  ],
  ask: [
    "What is {kw}?",
    "Tell me about {kw}",
    "How does {kw} work?",
    "Can you explain {kw}?",
    "What's the status of {kw}?",
    "When is {kw}?",
    "Where is {kw}?",
    "Who handles {kw}?",
    "Is {kw} ready?",
    "How much is {kw}?",
    "What about {kw}?",
    "Any updates on {kw}?",
    "Can I get info on {kw}?",
    "I have a question about {kw}",
    "What do we know about {kw}?",
  ],
};

// ─── Time Modifiers ────────────────────────────────────────────────────────

const TIME_PHRASES = [
  "", // no modifier
  "tomorrow",
  "today",
  "by tomorrow",
  "next week",
  "by next week",
  "this afternoon",
  "this morning",
  "tonight",
  "as soon as possible",
  "right now",
  "by end of day",
  "later",
  "soon",
  "before the deadline",
  "by Friday",
];

// ─── Target Modifiers ──────────────────────────────────────────────────────

const TARGET_PHRASES = [
  "", // no modifier
  "for the team",
  "to the manager",
  "with the client",
  "to everyone",
  "for the department",
  "to the board",
  "for engineering",
  "with HR",
  "to the director",
  "for the whole company",
  "to the customer",
];

// ─── Arabic Sentence Templates ─────────────────────────────────────────────

const ARABIC_TEMPLATES: { intent: IntentOperator; templates: string[] }[] = [
  {
    intent: "seek",
    templates: [
      "ابحث عن {arKw}",
      "أحتاج {arKw}",
      "أين أجد {arKw}",
      "ساعدني في إيجاد {arKw}",
      "أريد {arKw}",
    ],
  },
  {
    intent: "do",
    templates: [
      "نفذ {arKw}",
      "قم بـ{arKw}",
      "أنجز {arKw}",
      "ابدأ {arKw}",
      "اعمل على {arKw}",
    ],
  },
  {
    intent: "send",
    templates: [
      "أرسل {arKw}",
      "وزع {arKw}",
      "أرسل {arKw} للفريق",
      "شارك {arKw}",
      "أرسل {arKw} فوراً",
    ],
  },
  {
    intent: "record",
    templates: [
      "سجل {arKw}",
      "احفظ {arKw}",
      "وثق {arKw}",
      "دوّن {arKw}",
      "اكتب {arKw}",
    ],
  },
  {
    intent: "learn",
    templates: [
      "تعلم عن {arKw}",
      "ادرس {arKw}",
      "ابحث في {arKw}",
      "افهم {arKw}",
      "اقرأ عن {arKw}",
    ],
  },
  {
    intent: "ask",
    templates: [
      "ما هو {arKw}؟",
      "أخبرني عن {arKw}",
      "كيف يعمل {arKw}؟",
      "ما حالة {arKw}؟",
      "هل {arKw} جاهز؟",
    ],
  },
];

// ─── Arabic Keywords per Root (sample) ─────────────────────────────────────

function getArabicKeyword(root: string): string {
  const map: Record<string, string> = {
    كتب: "الكتابة",
    رسل: "الرسالة",
    علم: "العلم",
    جمع: "الاجتماع",
    عمل: "العمل",
    حسب: "الحساب",
    قرر: "القرار",
    أمن: "الأمان",
    بحث: "البحث",
    فكر: "التفكير",
    نظر: "النظر",
    سأل: "السؤال",
    حكم: "الحكم",
    وقت: "الوقت",
    مكن: "التمكين",
    صنع: "الصناعة",
    بدل: "التبديل",
    حول: "التحويل",
    قبل: "القبول",
    رفض: "الرفض",
    فتح: "الفتح",
    غلق: "الإغلاق",
    دخل: "الدخول",
    خرج: "الخروج",
    وصل: "التواصل",
    قطع: "القطع",
    حفظ: "الحفظ",
    نشر: "النشر",
    طلب: "الطلب",
    عرض: "العرض",
    شرح: "الشرح",
    ترجم: "الترجمة",
  };
  return map[root] ?? root;
}

// ─── Generator ─────────────────────────────────────────────────────────────

interface Example {
  id: string;
  input_tokens: string[];
  input_ids: number[];
  output_tokens: string[];
  output_ids: number[];
  domain: string;
  source_lang: string;
  source: string;
}

function generateExamples(): Example[] {
  const examples: Example[] = [];
  let id = 0;

  const intents = Object.keys(TEMPLATES) as IntentOperator[];

  for (const rootData of ALL_ROOT_DATA) {
    // Get 3 English keywords for this root
    const enKeywords = rootData.keywords
      .filter((k: string) => /^[a-z]/i.test(k))
      .slice(0, 4);

    if (enKeywords.length === 0) continue;

    // English examples: each root × 3 intents × 2 keywords × some modifiers
    const selectedIntents = intents.filter(
      (_, i) => (i + id) % 3 === 0 || i < 3,
    );

    for (const intent of selectedIntents) {
      const templates = TEMPLATES[intent];

      for (let kwIdx = 0; kwIdx < Math.min(2, enKeywords.length); kwIdx++) {
        const kw = enKeywords[kwIdx];

        // Variant 1: no modifiers
        const tmplIdx = id % templates.length;
        const bare = templates[tmplIdx].replace("{kw}", kw);

        // Variant 2: with time
        const timeIdx = (id + 1) % TIME_PHRASES.length;
        const withTime = TIME_PHRASES[timeIdx]
          ? `${bare} ${TIME_PHRASES[timeIdx]}`
          : null;

        // Variant 3: with target
        const targetIdx = (id + 2) % TARGET_PHRASES.length;
        const withTarget = TARGET_PHRASES[targetIdx]
          ? `${bare} ${TARGET_PHRASES[targetIdx]}`
          : null;

        // Variant 4: with both
        const withBoth =
          TIME_PHRASES[timeIdx] && TARGET_PHRASES[targetIdx]
            ? `${bare} ${TARGET_PHRASES[targetIdx]} ${TIME_PHRASES[timeIdx]}`
            : null;

        for (const text of [bare, withTime, withTarget, withBoth]) {
          if (!text) continue;
          try {
            const token = encodeLocal(text);
            const reasoning = engine.reason(token);
            if (reasoning.confidence < 0.4) continue;

            const domain =
              ALL_ROOT_DATA.find((r) => r.arabic === token.root)?.domain ??
              "general";
            const inputSer = serializeInput(token);
            const outputSer = serializeOutput(reasoning, domain);

            examples.push({
              id: `exp-${String(id).padStart(5, "0")}`,
              input_tokens: inputSer.tokens,
              input_ids: inputSer.ids,
              output_tokens: outputSer.tokens,
              output_ids: outputSer.ids,
              domain,
              source_lang: "en",
              source: "expand",
            });
            id++;
          } catch {
            continue;
          }
        }
      }
    }

    // Arabic examples
    const arKw = getArabicKeyword(rootData.arabic);
    for (const arGroup of ARABIC_TEMPLATES) {
      const tmpl = arGroup.templates[id % arGroup.templates.length];
      const text = tmpl.replace("{arKw}", arKw);
      try {
        const token = encodeLocal(text);
        const reasoning = engine.reason(token);
        if (reasoning.confidence < 0.4) continue;

        const domain =
          ALL_ROOT_DATA.find((r) => r.arabic === token.root)?.domain ??
          "general";
        const inputSer = serializeInput(token);
        const outputSer = serializeOutput(reasoning, domain);

        examples.push({
          id: `exp-ar-${String(id).padStart(5, "0")}`,
          input_tokens: inputSer.tokens,
          input_ids: inputSer.ids,
          output_tokens: outputSer.tokens,
          output_ids: outputSer.ids,
          domain,
          source_lang: "ar",
          source: "expand",
        });
        id++;
      } catch {
        continue;
      }
    }
  }

  return examples;
}

// ─── Main ──────────────────────────────────────────────────────────────────

console.log("Arabic Algebra — Massive Corpus Expansion\n");

const newExamples = generateExamples();
console.log(`Generated: ${newExamples.length} new examples`);

// Load existing
const corpusDir = join(import.meta.dirname ?? ".", "../data/corpus");
const existingPath = join(corpusDir, "train.jsonl");
const existingLines = readFileSync(existingPath, "utf-8").trim().split("\n");
console.log(`Existing:  ${existingLines.length} examples`);

// Merge
const newLines = newExamples.map((ex) => JSON.stringify(ex));
const allLines = [...existingLines, ...newLines];
console.log(`Total:     ${allLines.length} examples`);

// Write expanded
const expandedPath = join(corpusDir, "train-expanded.jsonl");
writeFileSync(expandedPath, allLines.join("\n"), "utf-8");
console.log(`\nWritten: ${expandedPath}`);

// Stats
const domainCounts: Record<string, number> = {};
const langCounts: Record<string, number> = {};
for (const ex of newExamples) {
  domainCounts[ex.domain] = (domainCounts[ex.domain] ?? 0) + 1;
  langCounts[ex.source_lang] = (langCounts[ex.source_lang] ?? 0) + 1;
}
console.log("\nBy domain:", domainCounts);
console.log("By language:", langCounts);
