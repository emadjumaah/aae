/**
 * Arabic Algebra — Agent Training Data Generator
 *
 * Generates training data for tool-routing from domain definitions.
 * Each example: customer text → algebra input tokens → agent output tokens (with TOOL/NEXT)
 *
 * Run: npx tsx src/agent/generate-agent-data.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeLocal } from "../core/encoder.js";
import {
  serializeInput,
  serializeAgentOutput,
} from "../reasoning/serializer.js";
import { getVocabulary } from "../reasoning/vocabulary.js";
import { TELECOM_DOMAIN, getTelecomToolIds } from "./domains/telecom.js";
import type { DomainDefinition, ToolDefinition, NextStep } from "./types.js";

// ─── Scenario Templates ────────────────────────────────────────────────────

interface Scenario {
  /** Template with {kw} placeholder */
  texts: string[];
  /** Which tool(s) to invoke */
  tools: string[];
  /** Expected next step */
  next: NextStep;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
  /** Optional context */
  issueType?: string;
}

/**
 * Generate scenarios for each tool in a domain.
 * Each tool gets ~15-25 natural language variations.
 */
function buildScenarios(domain: DomainDefinition): Scenario[] {
  const scenarios: Scenario[] = [];

  for (const tool of domain.tools) {
    const toolScenarios = getToolScenarios(tool);
    scenarios.push(...toolScenarios);
  }

  // Multi-tool scenarios
  scenarios.push(...getMultiToolScenarios(domain));

  // Ambiguous / escalation scenarios
  scenarios.push(...getEscalationScenarios());

  return scenarios;
}

function getToolScenarios(tool: ToolDefinition): Scenario[] {
  const s: Scenario[] = [];

  switch (tool.id) {
    // ── Billing ──────────────────────────────────────────────────────────
    case "check_balance":
      s.push({
        texts: [
          "What is my balance?",
          "How much do I owe?",
          "Check my account balance",
          "I want to know my balance",
          "What's my bill amount?",
          "Show me my balance",
          "Do I owe anything?",
          "When is my bill due?",
          "What's my outstanding balance?",
          "How much is my bill this month?",
          "Can you tell me my balance?",
          "I need to check my account",
          "كم رصيدي؟",
          "أريد معرفة رصيدي",
          "ما هو المبلغ المستحق؟",
        ],
        tools: ["check_balance"],
        next: "report",
        confidence: "high",
      });
      break;

    case "pay_bill":
      s.push({
        texts: [
          "I want to pay my bill",
          "Pay my balance",
          "Can I make a payment?",
          "Process my payment",
          "I need to pay my bill now",
          "Take payment for my account",
          "Accept my payment please",
          "Pay my outstanding balance",
          "I'd like to settle my bill",
          "How can I pay?",
          "أريد أن أدفع فاتورتي",
          "دفع الفاتورة",
        ],
        tools: ["pay_bill"],
        next: "confirm",
        confidence: "high",
      });
      break;

    case "billing_history":
      s.push({
        texts: [
          "Show me my billing history",
          "I want to see my previous bills",
          "Past invoices please",
          "What were my last 3 bills?",
          "Can I see my statement history?",
          "Show recent charges",
          "أرني سجل فواتيري",
        ],
        tools: ["billing_history"],
        next: "report",
        confidence: "high",
      });
      break;

    case "dispute_charge":
      s.push({
        texts: [
          "I want to dispute a charge",
          "There's a wrong charge on my bill",
          "I was overcharged",
          "This charge is incorrect",
          "I didn't make this purchase",
          "I need to contest a charge",
          "There's an error on my bill",
          "Remove this charge from my bill",
          "I was billed twice",
          "I see an unauthorized charge",
          "هناك خطأ في فاتورتي",
          "أريد الاعتراض على هذه الرسوم",
        ],
        tools: ["dispute_charge"],
        next: "await_input",
        confidence: "high",
        issueType: "billing",
      });
      break;

    // ── Account ──────────────────────────────────────────────────────────
    case "view_plan":
      s.push({
        texts: [
          "What plan am I on?",
          "Show me my current plan",
          "What does my plan include?",
          "Plan details please",
          "What's my subscription?",
          "I want to see my plan features",
          "ما هي خطتي الحالية؟",
          "أريد معرفة تفاصيل اشتراكي",
        ],
        tools: ["view_plan"],
        next: "report",
        confidence: "high",
      });
      break;

    case "change_plan":
      s.push({
        texts: [
          "I want to upgrade my plan",
          "Change my plan to unlimited",
          "I need a bigger plan",
          "Downgrade my subscription",
          "Switch to the premium plan",
          "Can I change my plan?",
          "I want a different plan",
          "Upgrade to the family plan",
          "What upgrade options do I have?",
          "I need more data",
          "أريد تغيير خطتي",
          "ارفع اشتراكي",
        ],
        tools: ["change_plan"],
        next: "confirm",
        confidence: "high",
      });
      break;

    case "update_info":
      s.push({
        texts: [
          "Update my email address",
          "I moved, change my address",
          "Change my phone number on file",
          "Update my contact information",
          "I need to change my name on the account",
          "Update my personal details",
          "حدث معلوماتي",
          "غير عنواني",
        ],
        tools: ["update_info"],
        next: "await_input",
        confidence: "high",
      });
      break;

    case "cancel_service":
      s.push({
        texts: [
          "I want to cancel my service",
          "Cancel my account",
          "I'm leaving, cancel everything",
          "Close my account please",
          "I don't want this service anymore",
          "End my subscription",
          "أريد إلغاء اشتراكي",
          "ألغِ حسابي",
        ],
        tools: ["cancel_service"],
        next: "confirm",
        confidence: "high",
        issueType: "cancellation",
      });
      break;

    case "add_line":
      s.push({
        texts: [
          "I want to add a new line",
          "Add another phone to my account",
          "I need a second line",
          "Can I add a line for my kid?",
          "Add a family line",
          "أريد خط إضافي",
        ],
        tools: ["add_line"],
        next: "confirm",
        confidence: "high",
      });
      break;

    // ── Technical ────────────────────────────────────────────────────────
    case "check_network":
      s.push({
        texts: [
          "Is there a network issue?",
          "I have no signal",
          "Network is down",
          "I can't get any service",
          "Is there an outage in my area?",
          "My phone has no bars",
          "I lost network coverage",
          "The signal is very weak",
          "Check if there's an outage",
          "لا يوجد شبكة",
          "الإشارة ضعيفة",
        ],
        tools: ["check_network"],
        next: "report",
        confidence: "high",
        issueType: "technical",
      });
      break;

    case "check_data_usage":
      s.push({
        texts: [
          "How much data have I used?",
          "Check my data usage",
          "Am I close to my data limit?",
          "How much data do I have left?",
          "Show my data consumption",
          "When does my data reset?",
          "كم استخدمت من البيانات؟",
        ],
        tools: ["check_data_usage"],
        next: "report",
        confidence: "high",
      });
      break;

    case "reset_network":
      s.push({
        texts: [
          "My internet isn't working, reset it",
          "Reset my network connection",
          "I need a connection reset",
          "Restart my network settings",
          "Fix my connection",
          "أعد ضبط الشبكة",
        ],
        tools: ["reset_network"],
        next: "execute",
        confidence: "high",
        issueType: "technical",
      });
      break;

    case "speed_test":
      s.push({
        texts: [
          "My internet is slow",
          "Run a speed test",
          "Check my connection speed",
          "Why is my data so slow?",
          "Test my network speed",
          "الانترنت بطيء",
        ],
        tools: ["speed_test"],
        next: "execute",
        confidence: "high",
        issueType: "technical",
      });
      break;

    case "report_outage":
      s.push({
        texts: [
          "I want to report a network outage",
          "There's no service in my whole neighborhood",
          "Report a service disruption",
          "The network is down in my area",
          "أريد الإبلاغ عن انقطاع الخدمة",
        ],
        tools: ["report_outage"],
        next: "await_input",
        confidence: "high",
        issueType: "technical",
      });
      break;

    // ── Device ───────────────────────────────────────────────────────────
    case "check_device":
      s.push({
        texts: [
          "Is my phone still under warranty?",
          "Check my device status",
          "How much is left on my phone payment?",
          "When does my warranty expire?",
          "Device installment balance",
          "ما حالة جهازي؟",
        ],
        tools: ["check_device"],
        next: "report",
        confidence: "high",
      });
      break;

    case "troubleshoot_device":
      s.push({
        texts: [
          "My phone won't turn on",
          "My screen is frozen",
          "Phone keeps restarting",
          "My device is not charging",
          "Apps keep crashing",
          "My phone is very slow",
          "The touchscreen isn't responding",
          "Camera isn't working",
          "جهازي لا يعمل",
          "الشاشة متجمدة",
        ],
        tools: ["troubleshoot_device"],
        next: "execute",
        confidence: "high",
        issueType: "device",
      });
      break;

    case "upgrade_device":
      s.push({
        texts: [
          "I want a new phone",
          "Am I eligible for an upgrade?",
          "When can I upgrade?",
          "What phones are available?",
          "I want to trade in my phone",
          "Upgrade my device",
          "أريد تحديث جهازي",
        ],
        tools: ["upgrade_device"],
        next: "report",
        confidence: "high",
        issueType: "upgrade",
      });
      break;

    case "activate_sim":
      s.push({
        texts: [
          "I need to activate my SIM card",
          "Activate my new SIM",
          "I got a replacement SIM",
          "My SIM card isn't working",
          "I need a new SIM activated",
          "فعّل شريحتي",
        ],
        tools: ["activate_sim"],
        next: "await_input",
        confidence: "high",
      });
      break;

    // ── General ──────────────────────────────────────────────────────────
    case "transfer_agent":
      s.push({
        texts: [
          "Transfer me to a real person",
          "I want to speak to someone",
          "Connect me to an agent",
          "Get me a human",
          "I need to talk to a person",
          "This isn't helping, give me a person",
          "Let me speak to a manager",
          "حولني لموظف",
          "أريد التحدث مع شخص حقيقي",
        ],
        tools: ["transfer_agent"],
        next: "execute",
        confidence: "high",
      });
      break;

    case "collect_info":
      s.push({
        texts: [
          "Here's my phone number",
          "My email is",
          "I'll give you my account number",
          "Let me provide my details",
          "هذا رقم هاتفي",
        ],
        tools: ["collect_info"],
        next: "await_input",
        confidence: "medium",
      });
      break;

    case "send_sms":
      s.push({
        texts: [
          "Send me a confirmation",
          "Text me the details",
          "Send an SMS with the info",
          "Can you message me the confirmation?",
          "أرسل لي رسالة تأكيد",
        ],
        tools: ["send_sms"],
        next: "execute",
        confidence: "high",
      });
      break;

    case "search_kb":
      s.push({
        texts: [
          "How do I set up voicemail?",
          "What are your business hours?",
          "How to enable international roaming?",
          "What's the APN setting?",
          "How do I forward my calls?",
          "كيف أفعّل التجوال؟",
        ],
        tools: ["search_kb"],
        next: "report",
        confidence: "high",
      });
      break;

    case "format_response":
      s.push({
        texts: [
          "Summarize that for me",
          "Give me the short version",
          "Can you compress that information?",
          "Just the key points",
          "Format those results",
          "Make it shorter",
          "Organize that as a list",
          "Highlight the important parts",
          "Too much information, summarize",
          "Give me a brief summary",
          "Shorten that response",
          "Put that in a table",
          "لخص لي ذلك",
          "اختصر المعلومات",
          "نظم النتائج",
        ],
        tools: ["format_response"],
        next: "execute",
        confidence: "high",
      });
      break;

    case "get_profile":
      s.push({
        texts: [
          "Show me my profile",
          "What info do you have on me?",
          "What's my email on file?",
          "Show my account details",
          "I want to see my personal information",
          "What is my phone number on the account?",
          "What's my address?",
          "Show me my contact details",
          "Pull up my profile",
          "Get my customer information",
          "What name is on my account?",
          "What data do you have about me?",
          "Display my account info",
          "I need to verify my profile details",
          "Can you read back my information?",
          "What's the email associated with my account?",
          "Where do you have me located?",
          "أرني ملفي الشخصي",
          "ما هي معلوماتي؟",
          "ما هو بريدي الإلكتروني؟",
          "أريد رؤية بياناتي",
        ],
        tools: ["get_profile"],
        next: "report",
        confidence: "high",
      });
      break;
  }

  return s;
}

function getMultiToolScenarios(domain: DomainDefinition): Scenario[] {
  return [
    {
      texts: [
        "Check my balance and pay it",
        "How much do I owe? I want to pay now",
        "Show me my bill and let me pay",
      ],
      tools: ["check_balance", "pay_bill"],
      next: "chain",
      confidence: "high",
      issueType: "billing",
    },
    {
      texts: [
        "My internet is not working, check the network and reset if needed",
        "No signal, can you check and fix it?",
        "Connection is down, diagnose and reset",
      ],
      tools: ["check_network", "reset_network"],
      next: "chain",
      confidence: "high",
      issueType: "technical",
    },
    {
      texts: [
        "I want to upgrade my phone and change my plan",
        "New phone and unlimited plan please",
      ],
      tools: ["upgrade_device", "change_plan"],
      next: "chain",
      confidence: "medium",
      issueType: "upgrade",
    },
    {
      texts: [
        "Check my data usage and run a speed test",
        "How much data is left? Also test my speed",
      ],
      tools: ["check_data_usage", "speed_test"],
      next: "chain",
      confidence: "high",
      issueType: "technical",
    },
    {
      texts: [
        "Check my device warranty and see if I can upgrade",
        "Is my warranty still valid? I might want a new phone",
      ],
      tools: ["check_device", "upgrade_device"],
      next: "chain",
      confidence: "medium",
      issueType: "device",
    },
    {
      texts: [
        "Search the knowledge base for roaming and give me a summary",
        "Find articles about voicemail and summarize them",
        "Look up data plans and format the results",
      ],
      tools: ["search_kb", "format_response"],
      next: "chain",
      confidence: "high",
      issueType: "general",
    },
    {
      texts: [
        "Show my profile info in a short summary",
        "Get my account details and just highlight the key info",
      ],
      tools: ["get_profile", "format_response"],
      next: "chain",
      confidence: "high",
      issueType: "account",
    },
    {
      texts: [
        "Check my billing history and summarize it",
        "Show me past bills, just the totals",
      ],
      tools: ["billing_history", "format_response"],
      next: "chain",
      confidence: "high",
      issueType: "billing",
    },
  ];
}

function getEscalationScenarios(): Scenario[] {
  return [
    {
      texts: [
        "This is completely unacceptable",
        "I've been waiting for hours",
        "Nobody is helping me",
        "I'm very frustrated with your service",
        "I'm going to switch to another provider",
        "This is terrible customer service",
        "هذا غير مقبول",
        "خدمتكم سيئة جداً",
      ],
      tools: ["transfer_agent"],
      next: "escalate",
      confidence: "high",
      issueType: "complaint",
    },
    {
      texts: [
        "I have a complicated issue",
        "It's hard to explain what happened",
        "I need someone who understands my situation",
        "This is a very specific problem",
        "I paid but was charged twice and also my plan changed somehow",
      ],
      tools: ["transfer_agent"],
      next: "escalate",
      confidence: "low",
    },
  ];
}

// ─── Modifier Variations ───────────────────────────────────────────────────

const TIME_MODS = ["", "now", "today", "tomorrow", "asap", "soon", "this week"];

const URGENCY_MODS = ["", "urgent", "normal"];

const SENTIMENT_CONTEXTS: Array<{ prefix: string; sentiment: string }> = [
  { prefix: "", sentiment: "neutral" },
  { prefix: "please ", sentiment: "positive" },
  { prefix: "help me ", sentiment: "neutral" },
  { prefix: "I'm frustrated, ", sentiment: "frustrated" },
  { prefix: "urgently ", sentiment: "frustrated" },
];

// ─── Generator ─────────────────────────────────────────────────────────────

interface AgentExample {
  id: string;
  input_text: string;
  input_tokens: string[];
  input_ids: number[];
  output_tokens: string[];
  output_ids: number[];
  tools: string[];
  next_step: string;
  domain: string;
  issue_type: string;
  source: string;
}

function generateAgentData(domain: DomainDefinition): AgentExample[] {
  const scenarios = buildScenarios(domain);
  const vocab = getVocabulary();
  const examples: AgentExample[] = [];
  let id = 0;

  // Register all domain tools in vocabulary
  for (const tool of domain.tools) {
    vocab.addTool(tool.id);
  }

  for (const scenario of scenarios) {
    for (const baseText of scenario.texts) {
      // Generate variations with sentiment prefixes and time modifiers
      const sentimentVariations = SENTIMENT_CONTEXTS.slice(
        0,
        baseText.match(/^[\u0600-\u06FF]/) ? 1 : 3, // fewer variations for Arabic text
      );

      for (const { prefix, sentiment } of sentimentVariations) {
        const timeMods = TIME_MODS.slice(0, 3); // use a few time variations

        for (const timeMod of timeMods) {
          const text = timeMod
            ? `${prefix}${baseText} ${timeMod}`.trim()
            : `${prefix}${baseText}`.trim();

          try {
            const token = encodeLocal(text);
            const inputSer = serializeInput(token);

            // Determine root and domain from encoding
            const rootData = findRootDomain(token.root);

            const outputSer = serializeAgentOutput({
              action: determineAction(token.intent, token.pattern),
              root: token.root,
              domain: rootData?.domain ?? "general",
              tools: scenario.tools,
              nextStep: scenario.next,
              confidence: scenario.confidence,
              modifiers: token.modifiers,
            });

            examples.push({
              id: `agent-${String(id).padStart(5, "0")}`,
              input_text: text,
              input_tokens: inputSer.tokens,
              input_ids: inputSer.ids,
              output_tokens: outputSer.tokens,
              output_ids: outputSer.ids,
              tools: scenario.tools,
              next_step: scenario.next,
              domain: rootData?.domain ?? "general",
              issue_type: scenario.issueType ?? "general",
              source: "agent-gen",
            });
            id++;
          } catch (err) {
            // Log errors for debugging
            console.error(
              `  SKIP: "${text}" →`,
              (err as Error).message?.slice(0, 80),
            );
            continue;
          }
        }
      }
    }
  }

  return examples;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

import { ALL_ROOT_DATA } from "../data/roots.js";

function findRootDomain(arabic: string) {
  return ALL_ROOT_DATA.find((r) => r.arabic === arabic);
}

function determineAction(intent: string, pattern: string): string {
  const rules: Record<string, string> = {
    "seek:agent": "query",
    "seek:patient": "query",
    "seek:place": "schedule",
    "do:agent": "execute",
    "do:patient": "create",
    "do:mutual": "coordinate",
    "send:agent": "send",
    "send:patient": "send",
    "send:plural": "broadcast",
    "record:agent": "document",
    "record:patient": "store",
    "learn:patient": "study",
    "decide:patient": "resolve",
    "judge:patient": "evaluate",
    "ask:patient": "query",
    "gather:patient": "assemble",
    "enable:patient": "execute",
  };
  return rules[`${intent}:${pattern}`] ?? "execute";
}

// ─── Context-augmented examples ────────────────────────────────────────────

function generateContextExamples(domain: DomainDefinition): AgentExample[] {
  const vocab = getVocabulary();
  const examples: AgentExample[] = [];
  let id = 0;

  // Multi-turn scenarios: user comes back after first tool
  const followups: Array<{
    prevTool: string;
    texts: string[];
    tools: string[];
    next: NextStep;
  }> = [
    {
      prevTool: "check_balance",
      texts: [
        "OK pay it now",
        "Alright, go ahead and pay",
        "Yes, make the payment",
      ],
      tools: ["pay_bill"],
      next: "confirm",
    },
    {
      prevTool: "check_network",
      texts: ["Can you reset it?", "Fix it please", "Reset my connection"],
      tools: ["reset_network"],
      next: "execute",
    },
    {
      prevTool: "check_device",
      texts: ["I want to upgrade then", "Let me upgrade", "Show me new phones"],
      tools: ["upgrade_device"],
      next: "report",
    },
    {
      prevTool: "speed_test",
      texts: [
        "Report this as an outage",
        "File a complaint",
        "This needs to be reported",
      ],
      tools: ["report_outage"],
      next: "await_input",
    },
    {
      prevTool: "check_data_usage",
      texts: ["I need more data", "Upgrade my data plan", "Give me unlimited"],
      tools: ["change_plan"],
      next: "confirm",
    },
    {
      prevTool: "search_kb",
      texts: [
        "Summarize that",
        "Give me the short version",
        "Too long, shorten it",
      ],
      tools: ["format_response"],
      next: "execute",
    },
    {
      prevTool: "billing_history",
      texts: [
        "Summarize those bills",
        "Just the totals please",
        "Format that as a list",
      ],
      tools: ["format_response"],
      next: "execute",
    },
    {
      prevTool: "get_profile",
      texts: [
        "Just the email and phone",
        "Shorten that",
        "Highlight the important stuff",
      ],
      tools: ["format_response"],
      next: "execute",
    },
  ];

  for (const followup of followups) {
    for (const text of followup.texts) {
      try {
        const token = encodeLocal(text);
        const inputSer = serializeInput(token);

        // Add CTX tokens to input
        const ctxTokens = [
          `CTX:prev_tool`,
          `TOOL:${followup.prevTool}`,
          `CTX:turn`,
          `LIT:2`,
        ];
        const augmentedTokens = [
          ...inputSer.tokens.slice(0, -1), // before <EOS>
          ...ctxTokens,
          "<EOS>",
        ];
        const augmentedIds = augmentedTokens.map((t) => {
          if (t.startsWith("LIT:")) return vocab.addLiteral(t.slice(4));
          if (t.startsWith("TOOL:")) return vocab.addTool(t.slice(5));
          return vocab.encode(t);
        });

        const rootData = findRootDomain(token.root);

        const outputSer = serializeAgentOutput({
          action: determineAction(token.intent, token.pattern),
          root: token.root,
          domain: rootData?.domain ?? "general",
          tools: followup.tools,
          nextStep: followup.next,
          confidence: "high",
        });

        examples.push({
          id: `ctx-${String(id).padStart(5, "0")}`,
          input_text: `[after ${followup.prevTool}] ${text}`,
          input_tokens: augmentedTokens,
          input_ids: augmentedIds,
          output_tokens: outputSer.tokens,
          output_ids: outputSer.ids,
          tools: followup.tools,
          next_step: followup.next,
          domain: rootData?.domain ?? "general",
          issue_type: "followup",
          source: "agent-ctx",
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

console.log("Arabic Algebra — Agent Training Data Generator\n");

const agentExamples = generateAgentData(TELECOM_DOMAIN);
console.log(`Generated: ${agentExamples.length} agent examples`);

const ctxExamples = generateContextExamples(TELECOM_DOMAIN);
console.log(`Generated: ${ctxExamples.length} context examples`);

const allExamples = [...agentExamples, ...ctxExamples];
console.log(`Total: ${allExamples.length} examples`);

// Write output
const outDir = join(import.meta.dirname ?? ".", "../../data/corpus");
const outPath = join(outDir, "train-agent.jsonl");
const lines = allExamples.map((ex) => JSON.stringify(ex));
writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`\nWritten: ${outPath}`);

// Stats
const toolCounts: Record<string, number> = {};
const nextCounts: Record<string, number> = {};
const issueCounts: Record<string, number> = {};
for (const ex of allExamples) {
  for (const t of ex.tools) toolCounts[t] = (toolCounts[t] ?? 0) + 1;
  nextCounts[ex.next_step] = (nextCounts[ex.next_step] ?? 0) + 1;
  issueCounts[ex.issue_type] = (issueCounts[ex.issue_type] ?? 0) + 1;
}
console.log("\nBy tool:", toolCounts);
console.log("By next step:", nextCounts);
console.log("By issue type:", issueCounts);

// Export updated vocabulary (now includes TOOL: tokens)
import { exportVocabulary } from "../reasoning/corpus.js";
const vocabPath = join(outDir, "vocabulary.json");
writeFileSync(vocabPath, exportVocabulary(), "utf-8");
const vocab = getVocabulary();
console.log(`\nVocabulary updated: ${vocabPath} (${vocab.size} tokens)`);
