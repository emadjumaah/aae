/**
 * Arabic Algebra Engine — Dictionary
 * The two dimensions of the algebra system as typed constants.
 * Root data is sourced from the master database (src/data/roots.ts).
 */

import type {
  RootEntry,
  PatternEntry,
  ArabicRoot,
  PatternOperator,
} from "./types.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── Root Dictionary ───────────────────────────────────────────────────────
// Generated from the master 150-root database.
// Each root is a semantic field — a cluster of related meanings.

export const ROOTS: RootEntry[] = ALL_ROOT_DATA.map((r) => ({
  arabic: r.arabic,
  latin: r.latin,
  semanticField: r.semanticField,
  covers: r.covers,
}));

// ─── Pattern Dictionary (أوزان) ────────────────────────────────────────────
// Each pattern is an operator applied to a root.
// The second dimension — transforms root meaning into a specific concept.

export const PATTERNS: PatternEntry[] = [
  {
    wazn: "فَاعِل",
    name: "Fa'il",
    operator: "agent",
    meaning: "The one who performs the action",
    example: { arabic: "كاتب", english: "writer (one who writes)" },
  },
  {
    wazn: "مَفْعُول",
    name: "Maf'ul",
    operator: "patient",
    meaning: "The thing acted upon / result",
    example: { arabic: "مكتوب", english: "written / a letter" },
  },
  {
    wazn: "مَفْعَلَة",
    name: "Maf'ala",
    operator: "place",
    meaning: "Place where the action occurs",
    example: { arabic: "مكتبة", english: "library (place of writing)" },
  },
  {
    wazn: "فِعَال",
    name: "Fi'al",
    operator: "instance",
    meaning: "Singular occurrence or abstract noun",
    example: { arabic: "كتاب", english: "book (instance of writing)" },
  },
  {
    wazn: "فُعُول",
    name: "Fu'ul",
    operator: "plural",
    meaning: "Collective / plural of objects",
    example: { arabic: "دروس", english: "lessons (plural)" },
  },
  {
    wazn: "اِسْتِفْعَال",
    name: "Istif'al",
    operator: "seek",
    meaning: "Requesting / seeking the action",
    example: { arabic: "استفسار", english: "inquiry (seeking information)" },
  },
  {
    wazn: "تَفَاعُل",
    name: "Tafa'ul",
    operator: "mutual",
    meaning: "Mutual / reciprocal action between parties",
    example: { arabic: "تجمع", english: "gathering together (mutual)" },
  },
  {
    wazn: "مُفَاعَلَة",
    name: "Mufa'ala",
    operator: "process",
    meaning: "Ongoing process between parties",
    example: { arabic: "مراسلة", english: "correspondence (ongoing exchange)" },
  },
  {
    wazn: "فَعَّال",
    name: "Fa''al",
    operator: "intensifier",
    meaning: "Intensive agent / professional",
    example: { arabic: "عمّال", english: "worker / laborer (intensive)" },
  },
  {
    wazn: "مُفْعِل",
    name: "Muf'il",
    operator: "causer",
    meaning: "One who causes the action in another",
    example: { arabic: "معلم", english: "teacher (one who causes learning)" },
  },
];

// ─── Lookup Helpers ────────────────────────────────────────────────────────

export const ROOT_BY_ARABIC = new Map<ArabicRoot, RootEntry>(
  ROOTS.map((r) => [r.arabic, r]),
);

export const ROOT_LATIN_MAP = new Map<ArabicRoot, string>(
  ROOTS.map((r) => [r.arabic, r.latin]),
);

export const PATTERN_BY_OPERATOR = new Map<PatternOperator, PatternEntry>(
  PATTERNS.map((p) => [p.operator, p]),
);

export const ALL_ROOTS = ROOTS.map((r) => r.arabic).join("|");
export const ALL_PATTERNS = PATTERNS.map((p) => p.operator).join("|");
export const ALL_INTENTS =
  "seek|do|send|gather|record|learn|decide|enable|judge|ask";
