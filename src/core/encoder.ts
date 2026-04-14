/**
 * Arabic Algebra Engine — Rule-Based Encoder
 *
 * Pure TypeScript. No LLM. No network. No dependencies.
 * Maps natural language → AlgebraToken using keyword matching and heuristics.
 *
 * This replaces the LLM encode() call entirely.
 * Supports English and Arabic input.
 *
 * Root keywords are sourced from the master database (src/data/roots.ts).
 */

import type {
  AlgebraToken,
  IntentOperator,
  PatternOperator,
  ArabicRoot,
} from "./types.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── Keyword → Root mapping ───────────────────────────────────────────────
// Generated from the master root database at startup.

interface RootKeywords {
  root: ArabicRoot;
  latin: string;
  keywords: string[];
}

const ROOT_KEYWORDS: RootKeywords[] = ALL_ROOT_DATA.map((r) => ({
  root: r.arabic,
  latin: r.latin,
  keywords: r.keywords,
}));

// ─── Keyword → Intent mapping ─────────────────────────────────────────────

interface IntentKeywords {
  intent: IntentOperator;
  keywords: string[];
  priority: number; // higher = preferred when tied
}

const INTENT_KEYWORDS: IntentKeywords[] = [
  {
    intent: "seek",
    priority: 5,
    keywords: [
      "need to find",
      "want",
      "looking for",
      "find",
      "get",
      "request",
      "require",
      "schedule",
      "book",
      "arrange",
      "set up",
      "organize",
      "أريد",
      "أحتاج",
      "ابحث",
      "جد",
      "رتب",
      "نظم",
      "احجز",
    ],
  },
  {
    intent: "do",
    priority: 4,
    keywords: [
      "do",
      "execute",
      "run",
      "perform",
      "deploy",
      "build",
      "make",
      "launch",
      "start",
      "implement",
      "complete",
      "finish",
      "create",
      "افعل",
      "نفذ",
      "شغل",
      "شغّل",
      "ابدأ",
      "أنشئ",
      "انشر",
    ],
  },
  {
    intent: "send",
    priority: 6,
    keywords: [
      "send",
      "email",
      "message",
      "forward",
      "share",
      "dispatch",
      "deliver",
      "notify",
      "broadcast",
      "announce",
      "post",
      "publish",
      "أرسل",
      "ارسل",
      "شارك",
      "أبلغ",
      "بلّغ",
      "أعلن",
      "انشر",
    ],
  },
  {
    intent: "gather",
    priority: 5,
    keywords: [
      "gather",
      "collect",
      "assemble",
      "meet",
      "group",
      "bring together",
      "compile",
      "combine",
      "merge",
      "aggregate",
      "اجمع",
      "جمّع",
      "اجتمع",
      "ضم",
    ],
  },
  {
    intent: "record",
    priority: 4,
    keywords: [
      "record",
      "write",
      "note",
      "document",
      "save",
      "store",
      "log",
      "capture",
      "file",
      "archive",
      "draft",
      "compose",
      "prepare",
      "سجل",
      "سجّل",
      "اكتب",
      "دوّن",
      "احفظ",
      "وثق",
      "أعد",
      "أعدّ",
    ],
  },
  {
    intent: "learn",
    priority: 4,
    keywords: [
      "learn",
      "study",
      "analyze",
      "understand",
      "research",
      "examine",
      "investigate",
      "explore",
      "review",
      "look into",
      "read about",
      "تعلم",
      "تعلّم",
      "ادرس",
      "حلل",
      "حلّل",
      "افهم",
      "ابحث",
      "راجع",
    ],
  },
  {
    intent: "decide",
    priority: 6,
    keywords: [
      "decide",
      "confirm",
      "resolve",
      "finalize",
      "settle",
      "approve",
      "choose",
      "pick",
      "select",
      "determine",
      "commit",
      "قرر",
      "قرّر",
      "أكد",
      "أكّد",
      "اختر",
      "حدد",
      "حدّد",
      "وافق",
    ],
  },
  {
    intent: "enable",
    priority: 3,
    keywords: [
      "enable",
      "allow",
      "permit",
      "grant",
      "authorize",
      "unlock",
      "activate",
      "give access",
      "open up",
      "set up access",
      "مكّن",
      "اسمح",
      "افتح",
      "فعّل",
      "أعط",
    ],
  },
  {
    intent: "judge",
    priority: 3,
    keywords: [
      "judge",
      "evaluate",
      "assess",
      "rate",
      "grade",
      "rank",
      "review",
      "audit",
      "inspect",
      "critique",
      "score",
      "قيّم",
      "احكم",
      "افحص",
      "راقب",
      "دقق",
    ],
  },
  {
    intent: "ask",
    priority: 6,
    keywords: [
      "what",
      "where",
      "when",
      "who",
      "how",
      "why",
      "which",
      "is there",
      "can you tell",
      "do you know",
      "look up",
      "check",
      "ما",
      "ماذا",
      "أين",
      "متى",
      "من",
      "كيف",
      "لماذا",
      "هل",
    ],
  },
];

// ─── Pattern inference rules ──────────────────────────────────────────────

interface PatternSignal {
  pattern: PatternOperator;
  keywords: string[];
  priority: number;
}

const PATTERN_SIGNALS: PatternSignal[] = [
  {
    pattern: "place",
    priority: 5,
    keywords: [
      "room",
      "location",
      "where",
      "place",
      "venue",
      "building",
      "office",
      "space",
      "site",
      "at",
      "in the",
      "مكان",
      "غرفة",
      "أين",
      "مبنى",
      "مكتب",
      "موقع",
    ],
  },
  {
    pattern: "agent",
    priority: 3,
    keywords: [
      "person",
      "who",
      "someone",
      "specialist",
      "expert",
      "responsible",
      "manager",
      "lead",
      "developer",
      "engineer",
      "analyst",
      "شخص",
      "من",
      "مسؤول",
      "مدير",
      "مهندس",
    ],
  },
  {
    pattern: "patient",
    priority: 4,
    keywords: [
      "the report",
      "the document",
      "the file",
      "the message",
      "the data",
      "the code",
      "the email",
      "the notes",
      "the task",
      "the request",
      "it",
      "this",
      "that",
      "التقرير",
      "الوثيقة",
      "الملف",
      "الرسالة",
      "البيانات",
      "الكود",
      "المهمة",
    ],
  },
  {
    pattern: "instance",
    priority: 2,
    keywords: [
      "a meeting",
      "a report",
      "a document",
      "a plan",
      "a proposal",
      "a decision",
      "a task",
      "an idea",
      "a course",
      "a session",
      "اجتماع",
      "تقرير",
      "وثيقة",
      "خطة",
      "مقترح",
      "قرار",
      "فكرة",
    ],
  },
  {
    pattern: "plural",
    priority: 3,
    keywords: [
      "all",
      "everyone",
      "multiple",
      "many",
      "several",
      "various",
      "each",
      "every",
      "list",
      "items",
      "files",
      "records",
      "people",
      "كل",
      "جميع",
      "عدة",
      "متعدد",
      "كثير",
    ],
  },
  {
    pattern: "seek",
    priority: 4,
    keywords: [
      "request",
      "inquiry",
      "asking for",
      "looking for",
      "searching",
      "need to find",
      "question",
      "wondering",
      "طلب",
      "استفسار",
      "بحث",
    ],
  },
  {
    pattern: "mutual",
    priority: 5,
    keywords: [
      "together",
      "with the team",
      "with everyone",
      "collaborate",
      "cooperation",
      "joint",
      "shared",
      "group",
      "standup",
      "sync",
      "meeting",
      "meet",
      "معاً",
      "مع الفريق",
      "مع الجميع",
      "تعاون",
      "مشترك",
      "اجتماع",
    ],
  },
  {
    pattern: "process",
    priority: 3,
    keywords: [
      "ongoing",
      "continuous",
      "regularly",
      "process",
      "workflow",
      "correspondence",
      "exchange",
      "series",
      "routine",
      "مستمر",
      "دائم",
      "عملية",
      "سلسلة",
      "روتين",
    ],
  },
  {
    pattern: "intensifier",
    priority: 2,
    keywords: [
      "urgently",
      "immediately",
      "asap",
      "now",
      "right away",
      "quickly",
      "intensive",
      "heavy",
      "major",
      "critical",
      "فوراً",
      "حالاً",
      "عاجل",
      "بسرعة",
      "مكثف",
    ],
  },
  {
    pattern: "causer",
    priority: 3,
    keywords: [
      "teach",
      "train",
      "cause",
      "make someone",
      "enable others",
      "instructor",
      "trainer",
      "teacher",
      "coaching",
      "mentor",
      "علّم",
      "درّب",
      "مدرب",
      "معلم",
    ],
  },
];

// ─── Modifier Extraction ──────────────────────────────────────────────────

interface ModifierPattern {
  key: string;
  patterns: RegExp[];
}

const MODIFIER_PATTERNS: ModifierPattern[] = [
  {
    key: "time",
    patterns: [
      /\b(today|tonight|now)\b/i,
      /\b(tomorrow|tmr|tmrw)\b/i,
      /\b(next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
      /\b(this\s+(?:week|month|afternoon|evening|morning))\b/i,
      /\b(by\s+(?:end of day|eod|friday|monday|tomorrow))\b/i,
      /\b(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i,
      /\b(in\s+\d+\s+(?:hours?|minutes?|days?))\b/i,
      /\b(غداً|غدا|اليوم|الآن|الأسبوع القادم|الشهر القادم)\b/,
      /\b(صباحاً|مساءً|بعد الظهر)\b/,
    ],
  },
  {
    key: "target",
    patterns: [
      /\bto\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s*$/i,
      /\bwith\s+(?:the\s+)?(\w+(?:\s+\w+)?)\b/i,
      /\bfor\s+(?:the\s+)?(\w+(?:\s+\w+)?)\b/i,
      /\bإلى\s+(\S+(?:\s+\S+)?)\b/,
      /\bمع\s+(\S+(?:\s+\S+)?)\b/,
      /\bلـ?\s*(\S+(?:\s+\S+)?)\b/,
    ],
  },
  {
    key: "topic",
    patterns: [
      /\babout\s+(?:the\s+)?(.+?)(?:\s+(?:by|for|with|to|at|in|on)\b|$)/i,
      /\bon\s+(?:the\s+)?(.+?)(?:\s+(?:by|for|with|to|at|in)\b|$)/i,
      /\bregarding\s+(?:the\s+)?(.+?)(?:\s+(?:by|for|with|to|at|in)\b|$)/i,
      /\bعن\s+(.+?)(?:\s+(?:إلى|مع|في|على)\b|$)/,
    ],
  },
  {
    key: "content",
    patterns: [
      /\b(?:the\s+)?(\w+\s+(?:report|document|file|notes|proposal|plan|code|email|message))\b/i,
      /\b(report|document|notes|proposal|code)\b/i,
      /\b(التقرير|الوثيقة|الملف|الملاحظات|المقترح|الكود)\b/,
    ],
  },
  {
    key: "urgency",
    patterns: [
      /\b(urgent|urgently|asap|immediately|critical|right away)\b/i,
      /\b(عاجل|فوراً|حالاً|فوري)\b/,
    ],
  },
];

// Time words to strip from target extraction
const TIME_WORDS = new Set([
  "today",
  "tomorrow",
  "tonight",
  "now",
  "morning",
  "afternoon",
  "evening",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// ─── Keyword Exclusivity Index ────────────────────────────────────────────
// Pre-compute how many roots share each keyword.
// Exclusive keywords (appearing in only 1 root) score 3× more.
// Shared keywords get penalized proportionally.

const KEYWORD_ROOT_COUNT = new Map<string, number>();
for (const rk of ROOT_KEYWORDS) {
  for (const kw of rk.keywords) {
    const lower = kw.toLowerCase();
    KEYWORD_ROOT_COUNT.set(lower, (KEYWORD_ROOT_COUNT.get(lower) ?? 0) + 1);
  }
}

function keywordWeight(kw: string): number {
  const count = KEYWORD_ROOT_COUNT.get(kw.toLowerCase()) ?? 1;
  if (count === 1) return 3.0; // exclusive keyword — strong signal
  if (count === 2) return 2.0; // shared with one other
  if (count <= 4) return 1.0; // moderately shared
  return 0.5; // very common — weak signal
}

// ─── Contextual Attention ─────────────────────────────────────────────────
//
// Inspired by the "Attention Is All You Need" principle: meaning is determined
// by context. Three deterministic attention mechanisms resolve ambiguity
// without any neural network:
//
// 1. Co-occurrence pairs — disambiguating keyword pairs that resolve polysemy
//    e.g. "deploy" alone is ambiguous, but "deploy" + "server" → عمل (work)
//    Analogous to the K·Q dot product: specific key-query pairs produce high
//    attention scores.
//
// 2. Proximity attention — keywords near each other in the input reinforce
//    each other's signal. A 5-word context window mirrors the local attention
//    patterns that transformers learn.
//
// 3. Domain coherence — when multiple roots from the same domain score well,
//    they reinforce each other; analogous to multi-head attention converging
//    on a consistent representation.

// Co-occurrence pairs: [contextWord, targetRoot, boostScore]
// When contextWord appears in input alongside a root's keyword, boost that root.
const CO_OCCURRENCE_PAIRS: Array<[string, string, number]> = [
  // Tech context → عمل (work/execute)
  ["server", "عمل", 6],
  ["pipeline", "عمل", 6],
  ["test", "عمل", 4],
  ["code", "عمل", 4],
  ["app", "عمل", 4],
  ["system", "عمل", 3],
  ["software", "عمل", 5],
  ["script", "عمل", 5],
  ["program", "عمل", 4],
  // Manufacturing context → صنع
  ["factory", "صنع", 6],
  ["parts", "صنع", 4],
  ["machine", "صنع", 4],
  ["assembly line", "صنع", 6],
  ["inventory", "صنع", 4],
  // Communication context → رسل
  ["inbox", "رسل", 6],
  ["recipient", "رسل", 5],
  ["cc", "رسل", 4],
  ["reply", "رسل", 5],
  ["attachment", "رسل", 5],
  ["mail", "رسل", 4],
  // Commerce context → بيع
  ["price", "بيع", 5],
  ["customer", "بيع", 4],
  ["revenue", "بيع", 5],
  ["market", "بيع", 3],
  ["discount", "بيع", 5],
  ["invoice", "بيع", 5],
  // Learning context → علم
  ["student", "علم", 5],
  ["course", "علم", 4],
  ["curriculum", "علم", 5],
  ["textbook", "علم", 5],
  ["class", "علم", 3],
  // Study context → درس
  ["homework", "درس", 6],
  ["exam", "درس", 5],
  ["lesson", "درس", 5],
  ["quiz", "درس", 5],
  ["semester", "درس", 5],
  // Security context → أمن
  ["firewall", "أمن", 6],
  ["encryption", "أمن", 6],
  ["password", "أمن", 5],
  ["vulnerability", "أمن", 6],
  ["auth", "أمن", 4],
  ["ssl", "أمن", 5],
  // Data/info context → حلل
  ["data", "حلل", 4],
  ["metrics", "حلل", 5],
  ["statistics", "حلل", 5],
  ["dataset", "حلل", 6],
  ["trend", "حلل", 4],
  ["chart", "حلل", 4],
  // Meeting/social context → جمع
  ["calendar", "جمع", 4],
  ["attendee", "جمع", 5],
  ["agenda", "جمع", 5],
  ["invite", "جمع", 4],
  ["participant", "جمع", 5],
  // Spatial context → دخل/خرج
  ["door", "دخل", 5],
  ["gate", "دخل", 5],
  ["entrance", "دخل", 6],
  ["building", "دخل", 3],
  ["login", "دخل", 5],
  ["logout", "خرج", 5],
  ["signout", "خرج", 5],
  // Decision context → قرر
  ["vote", "قرر", 5],
  ["ballot", "قرر", 6],
  ["consensus", "قرر", 5],
  ["referendum", "قرر", 6],
  ["poll", "قرر", 4],
  // Creation context → خلق
  ["prototype", "خلق", 5],
  ["brainstorm", "خلق", 5],
  ["sketch", "خلق", 4],
  ["concept", "خلق", 3],
  ["blueprint", "خلق", 5],
  // Emotion context
  ["heart", "حبب", 4],
  ["romance", "حبب", 5],
  ["affection", "حبب", 5],
  ["anger", "كره", 4],
  ["frustrat", "كره", 4],
  ["celebrat", "فرح", 5],
  ["party", "فرح", 3],
  ["congratulat", "فرح", 5],
  // Time context → وقت
  ["calendar", "وقت", 3],
  ["deadline", "وقت", 5],
  ["timeslot", "وقت", 6],
  ["appointment", "وقت", 5],
  ["reminder", "وقت", 4],
  // Organize context → نظم
  ["workflow", "نظم", 5],
  ["hierarchy", "نظم", 5],
  ["structure", "نظم", 3],
  ["systematic", "نظم", 5],
  ["regulation", "نظم", 4],
];

// Pre-index co-occurrence pairs by context word for O(1) lookup
const CO_OCCURRENCE_INDEX = new Map<
  string,
  Array<{ root: string; boost: number }>
>();
for (const [word, root, boost] of CO_OCCURRENCE_PAIRS) {
  const lower = word.toLowerCase();
  if (!CO_OCCURRENCE_INDEX.has(lower)) CO_OCCURRENCE_INDEX.set(lower, []);
  CO_OCCURRENCE_INDEX.get(lower)!.push({ root, boost });
}

// Pre-index root → domain for domain coherence
const ROOT_DOMAIN = new Map<string, string>();
for (const r of ALL_ROOT_DATA) {
  ROOT_DOMAIN.set(r.arabic, r.domain);
}

/**
 * Co-occurrence attention: boost a root's score when disambiguating context
 * words appear in the input alongside the root's keywords.
 * Analogous to Q·K attention — specific pairs produce high scores.
 */
function coOccurrenceBoost(input: string, rootArabic: string): number {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/);
  let boost = 0;
  for (const word of words) {
    const pairs = CO_OCCURRENCE_INDEX.get(word);
    if (pairs) {
      for (const p of pairs) {
        if (p.root === rootArabic) boost += p.boost;
      }
    }
    // Also check substring matches for multi-word context clues
    for (const [contextWord, root, score] of CO_OCCURRENCE_PAIRS) {
      if (
        root === rootArabic &&
        contextWord.includes(" ") &&
        lower.includes(contextWord)
      ) {
        boost += score;
      }
    }
  }
  return boost;
}

/**
 * Proximity attention: keywords that appear near each other within a
 * context window get a multiplier boost. Mirrors local attention patterns.
 *
 * When two keywords for the same root appear within WINDOW_SIZE words of
 * each other, both get a bonus proportional to their closeness.
 */
const PROXIMITY_WINDOW = 5;

function proximityBoost(input: string, keywords: string[]): number {
  const words = input.toLowerCase().split(/\s+/);
  // Find positions of matched keywords using word-boundary matching
  const matchPositions: number[] = [];
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (kwLower.length <= 3) continue; // skip very short keywords for proximity
    for (let i = 0; i < words.length; i++) {
      // Only match when the input word starts with or equals the keyword
      // e.g. "deploying" matches keyword "deploy", but not "a" matching "broadcast"
      if (
        words[i] === kwLower ||
        words[i].startsWith(kwLower) ||
        kwLower === words[i].replace(/(?:ing|ed|s|er|ly)$/, "")
      ) {
        matchPositions.push(i);
        break; // one position per keyword
      }
    }
  }

  if (matchPositions.length < 2) return 0;

  // Calculate proximity bonus: closer matches = higher bonus
  let bonus = 0;
  for (let i = 0; i < matchPositions.length; i++) {
    for (let j = i + 1; j < matchPositions.length; j++) {
      const distance = Math.abs(matchPositions[i] - matchPositions[j]);
      if (distance <= PROXIMITY_WINDOW) {
        bonus += (PROXIMITY_WINDOW - distance + 1) * 0.5;
      }
    }
  }
  return bonus;
}

/**
 * Domain coherence: when multiple candidate roots share the same domain
 * AND both scored meaningfully, provide a modest boost.
 * Analogous to multi-head attention converging on a consistent
 * semantic interpretation.
 *
 * Conservative: only counts roots above a minimum score threshold,
 * and caps the bonus to avoid overwhelming direct keyword matches.
 */
const COHERENCE_THRESHOLD = 3.0;
const COHERENCE_BONUS = 2.0;

function domainCoherenceScores(
  candidates: Array<{ root: string; score: number }>,
): Map<string, number> {
  // Count above-threshold candidates per domain
  const domainCounts = new Map<string, number>();
  for (const c of candidates) {
    if (c.score >= COHERENCE_THRESHOLD) {
      const domain = ROOT_DOMAIN.get(c.root) ?? "unknown";
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  // Flat bonus for roots in domains with 2+ strong candidates
  const bonuses = new Map<string, number>();
  for (const c of candidates) {
    if (c.score >= COHERENCE_THRESHOLD) {
      const domain = ROOT_DOMAIN.get(c.root) ?? "unknown";
      const count = domainCounts.get(domain) ?? 0;
      if (count >= 2) {
        bonuses.set(c.root, COHERENCE_BONUS);
      }
    }
  }
  return bonuses;
}

/**
 * Intent↔Root cross-attention: certain intents naturally align with certain
 * root domains. This bidirectional bias prevents mismatches like
 * detect(intent=send) but detect(root=buy).
 */
const INTENT_DOMAIN_AFFINITY: Record<string, string[]> = {
  seek: ["seeking", "spatial", "time", "social"],
  do: ["action", "creation"],
  send: ["communication"],
  gather: ["social", "communication"],
  record: ["communication", "information"],
  learn: ["cognition", "learning"],
  decide: ["decision"],
  enable: ["security", "action"],
  judge: ["decision", "information"],
  ask: ["seeking", "communication"],
};

function intentRootCrossAttention(
  intent: IntentOperator,
  rootArabic: string,
): number {
  const affineDomains = INTENT_DOMAIN_AFFINITY[intent] ?? [];
  const rootDomain = ROOT_DOMAIN.get(rootArabic) ?? "unknown";
  if (affineDomains.includes(rootDomain)) return 3.0;
  return 0;
}

// ─── Scoring engine ───────────────────────────────────────────────────────

function scoreKeywords(
  input: string,
  keywords: string[],
  useExclusivity = true,
): number {
  const lower = input.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    const isMultiWord = kwLower.includes(" ");

    if (isMultiWord) {
      // Multi-word phrases: substring match (already specific enough)
      if (lower.includes(kwLower)) {
        const base = kwLower.length > 10 ? 4 : 3;
        score += useExclusivity ? base * keywordWeight(kw) : base;
      }
    } else {
      // Single words: word-boundary match to prevent "repo" matching in "report"
      const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, "i").test(lower)) {
        const base = kwLower.length > 5 ? 3 : 2;
        score += useExclusivity ? base * keywordWeight(kw) : base;
      }
    }
  }
  return score;
}

// ─── Encoder ──────────────────────────────────────────────────────────────

export function encodeLocal(input: string): AlgebraToken {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallbackToken();
  }

  // Phase 1: Independent detection (bag-of-words)
  const intent = detectIntent(trimmed);
  const pattern = detectPattern(trimmed);
  const modifiers = extractModifiers(trimmed);

  // Phase 2: Context-aware root detection with cross-attention from intent
  const root = detectRoot(trimmed, intent);

  return {
    intent,
    root: root.root,
    rootLatin: root.latin,
    pattern,
    modifiers,
  };
}

function detectRoot(
  input: string,
  intent?: IntentOperator,
): { root: ArabicRoot; latin: string } {
  // Phase 1: Score each root by keyword matching + exclusivity
  const candidates: Array<{
    root: string;
    latin: string;
    score: number;
    keywords: string[];
  }> = [];
  for (const rk of ROOT_KEYWORDS) {
    const kwScore = scoreKeywords(input, rk.keywords);
    candidates.push({
      root: rk.root,
      latin: rk.latin,
      score: kwScore,
      keywords: rk.keywords,
    });
  }

  // Phase 2: Contextual attention — co-occurrence disambiguation
  for (const c of candidates) {
    c.score += coOccurrenceBoost(input, c.root);
  }

  // Phase 3: Proximity attention — keyword clusters within context window
  for (const c of candidates) {
    c.score += proximityBoost(input, c.keywords);
  }

  // Phase 4: Domain coherence — same-domain roots reinforce each other
  const coherence = domainCoherenceScores(candidates);
  for (const c of candidates) {
    c.score += coherence.get(c.root) ?? 0;
  }

  // Phase 5: Intent↔Root cross-attention — bidirectional bias
  if (intent) {
    for (const c of candidates) {
      c.score += intentRootCrossAttention(intent, c.root);
    }
  }

  // Select highest scoring root
  let best = candidates[0];
  for (const c of candidates) {
    if (c.score > best.score) best = c;
  }

  return { root: best.root, latin: best.latin };
}

function detectIntent(input: string): IntentOperator {
  let bestIntent: IntentKeywords = INTENT_KEYWORDS[0];
  let bestScore = 0;

  for (const ik of INTENT_KEYWORDS) {
    const score = scoreKeywords(input, ik.keywords, false) + ik.priority * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = ik;
    }
  }

  // Question heuristic: if starts with question word, bias toward 'ask'
  if (
    /^(what|where|when|who|how|why|which|is there|can you|do you|ما|ماذا|أين|متى|من|كيف|لماذا|هل)/i.test(
      input,
    )
  ) {
    return "ask";
  }

  return bestIntent.intent;
}

function detectPattern(input: string): PatternOperator {
  let bestPattern: PatternSignal = PATTERN_SIGNALS[3]; // default: instance
  let bestScore = 0;

  for (const ps of PATTERN_SIGNALS) {
    const score = scoreKeywords(input, ps.keywords, false) + ps.priority * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestPattern = ps;
    }
  }

  // If no strong signal, use heuristics
  if (bestScore < 2) {
    // Default based on common patterns
    const lower = input.toLowerCase();
    if (/\b(with|together|team|group)\b/.test(lower)) return "mutual";
    if (/\b(the \w+)\b/.test(lower)) return "patient";
    return "instance";
  }

  return bestPattern.pattern;
}

function extractModifiers(input: string): string[] {
  const mods: string[] = [];
  const seen = new Set<string>();

  for (const mp of MODIFIER_PATTERNS) {
    for (const regex of mp.patterns) {
      const match = input.match(regex);
      if (match) {
        let value = (match[1] ?? match[0]).trim().toLowerCase();
        // Skip empty or too-short values
        if (value.length < 2) continue;
        // Strip time words from target values
        if (mp.key === "target") {
          value = value
            .split(/\s+/)
            .filter((w) => !TIME_WORDS.has(w))
            .join(" ")
            .trim();
          if (!value || value.length < 2) continue;
        }
        const entry = `${mp.key}:${value}`;
        if (!seen.has(entry)) {
          seen.add(entry);
          mods.push(entry);
        }
        break; // one match per key per pattern set
      }
    }
  }

  // Deduplicate by key — keep first match
  const byKey = new Map<string, string>();
  for (const mod of mods) {
    const key = mod.split(":")[0];
    if (!byKey.has(key)) byKey.set(key, mod);
  }

  return [...byKey.values()];
}

function fallbackToken(): AlgebraToken {
  return {
    intent: "ask",
    root: "سأل",
    rootLatin: "s-'-l",
    pattern: "instance",
    modifiers: [],
  };
}
