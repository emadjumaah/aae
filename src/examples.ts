/**
 * Arabic Algebra Engine — Pre-baked Examples
 *
 * Cached pipeline results so the playground works with ZERO LLM calls.
 * Each example includes all intermediate stages.
 */

import type { AlgebraToken, ReasoningResult } from "./engine/core/types.js";
import { compactToken } from "./engine/core/types.js";
import { engine } from "./engine/core/engine.js";
import { decodeLocal } from "./engine/core/decoder.js";

export interface ExampleEntry {
  id: string;
  inputEn: string;
  inputAr: string;
  token: AlgebraToken;
  algebraCompact: string;
  reasoning: ReasoningResult;
  explanation: string;
  response: string;
}

function buildExample(
  id: string,
  inputEn: string,
  inputAr: string,
  token: AlgebraToken,
): ExampleEntry {
  const reasoning = engine.reason(token);
  return {
    id,
    inputEn,
    inputAr,
    token,
    algebraCompact: compactToken(token),
    reasoning,
    explanation: engine.explain(token),
    response: decodeLocal(reasoning),
  };
}

export const EXAMPLES: ExampleEntry[] = [
  buildExample(
    "schedule-meeting",
    "Schedule a meeting with the team tomorrow",
    "رتب اجتماعاً مع الفريق غداً",
    {
      intent: "seek",
      root: "جمع",
      rootLatin: "j-m-'",
      pattern: "place",
      modifiers: ["time:tomorrow", "target:team"],
    },
  ),

  buildExample(
    "send-report",
    "Send the report to the manager",
    "أرسل التقرير إلى المدير",
    {
      intent: "send",
      root: "رسل",
      rootLatin: "r-s-l",
      pattern: "patient",
      modifiers: ["target:manager", "content:report"],
    },
  ),

  buildExample(
    "broadcast-update",
    "Send an update to the whole company",
    "أرسل تحديثاً لكل الشركة",
    {
      intent: "send",
      root: "رسل",
      rootLatin: "r-s-l",
      pattern: "process",
      modifiers: ["target:company", "content:update"],
    },
  ),

  buildExample(
    "learn-topic",
    "I want to learn about machine learning",
    "أريد أن أتعلم عن التعلّم الآلي",
    {
      intent: "learn",
      root: "علم",
      rootLatin: "'l-m",
      pattern: "causer",
      modifiers: ["topic:machine-learning"],
    },
  ),

  buildExample(
    "study-report",
    "Analyze the quarterly report",
    "حلّل التقرير الفصلي",
    {
      intent: "learn",
      root: "درس",
      rootLatin: "d-r-s",
      pattern: "agent",
      modifiers: ["content:quarterly-report"],
    },
  ),

  buildExample(
    "write-document",
    "Write down the meeting notes",
    "سجّل ملاحظات الاجتماع",
    {
      intent: "record",
      root: "كتب",
      rootLatin: "k-t-b",
      pattern: "patient",
      modifiers: ["content:meeting-notes"],
    },
  ),

  buildExample(
    "create-doc",
    "Prepare a formal proposal document",
    "أعدّ وثيقة مقترح رسمية",
    {
      intent: "record",
      root: "كتب",
      rootLatin: "k-t-b",
      pattern: "instance",
      modifiers: ["type:proposal", "format:formal"],
    },
  ),

  buildExample(
    "decide-budget",
    "We need to decide on the budget",
    "نحتاج أن نقرّر الميزانية",
    {
      intent: "decide",
      root: "قرر",
      rootLatin: "q-r-r",
      pattern: "instance",
      modifiers: ["topic:budget", "urgency:high"],
    },
  ),

  buildExample(
    "gather-team",
    "Gather the engineering team for a standup",
    "اجمع فريق الهندسة لاجتماع سريع",
    {
      intent: "gather",
      root: "جمع",
      rootLatin: "j-m-'",
      pattern: "mutual",
      modifiers: ["target:engineering", "type:standup"],
    },
  ),

  buildExample(
    "find-room",
    "Find a meeting room for 10 people",
    "جد غرفة اجتماعات لعشرة أشخاص",
    {
      intent: "gather",
      root: "جمع",
      rootLatin: "j-m-'",
      pattern: "place",
      modifiers: ["capacity:10", "type:meeting-room"],
    },
  ),

  buildExample(
    "ask-question",
    "What is the project deadline?",
    "ما هو موعد تسليم المشروع؟",
    {
      intent: "ask",
      root: "سأل",
      rootLatin: "s-'-l",
      pattern: "seek",
      modifiers: ["topic:deadline", "scope:project"],
    },
  ),

  buildExample(
    "review-work",
    "Review the code for security issues",
    "راجع الكود بحثاً عن مشاكل أمنية",
    {
      intent: "judge",
      root: "حكم",
      rootLatin: "h-k-m",
      pattern: "agent",
      modifiers: ["target:code", "criteria:security"],
    },
  ),

  buildExample(
    "run-task",
    "Deploy the application to production",
    "انشر التطبيق في بيئة الإنتاج",
    {
      intent: "do",
      root: "عمل",
      rootLatin: "'m-l",
      pattern: "agent",
      modifiers: ["target:production", "action:deploy"],
    },
  ),

  buildExample(
    "think-strategy",
    "Think about a strategy for growth",
    "فكّر في استراتيجية للنمو",
    {
      intent: "do",
      root: "فكر",
      rootLatin: "f-k-r",
      pattern: "process",
      modifiers: ["topic:growth-strategy"],
    },
  ),

  buildExample(
    "enable-access",
    "Give the new hire access to the system",
    "أعطِ الموظف الجديد صلاحية الدخول للنظام",
    {
      intent: "enable",
      root: "مكن",
      rootLatin: "m-k-n",
      pattern: "causer",
      modifiers: ["target:new-hire", "scope:system-access"],
    },
  ),
];

export function getExampleById(id: string): ExampleEntry | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
