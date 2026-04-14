/**
 * Arabic Algebra — Agent Training Data Generator v2
 *
 * Generates training data for tool-routing across 3 domains:
 *   - Telecom (24 tools)
 *   - Banking (20 tools)
 *   - Healthcare (20 tools)
 *
 * Produces:
 *   1. Single-tool examples (~10x per tool per variation)
 *   2. Multi-step chain examples with STEP/REASON tokens
 *   3. Context follow-up examples
 *
 * Target: ~60K agent examples (40% of total corpus)
 *
 * Run: npx tsx src/agent/generate-agent-data.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeLocal } from "../engine/core/encoder.js";
import {
  serializeInput,
  serializeAgentOutput,
  serializeChainOutput,
} from "./serializer.js";
import { getVocabulary } from "./vocabulary.js";
import { TELECOM_DOMAIN } from "../engine/agent/domains/telecom.js";
import { BANKING_DOMAIN } from "../engine/agent/domains/banking.js";
import { HEALTHCARE_DOMAIN } from "../engine/agent/domains/healthcare.js";
import type { DomainDefinition, NextStep } from "../engine/agent/types.js";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Scenario {
  texts: string[];
  tools: string[];
  next: NextStep;
  confidence: "high" | "medium" | "low";
  issueType?: string;
}

interface ChainScenario {
  texts: string[];
  steps: Array<{ tool: string; reason: string }>;
  next: NextStep;
  confidence: "high" | "medium" | "low";
}

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

// ─── Modifier Variations ───────────────────────────────────────────────────

const TIME_MODS = [
  "",
  "now",
  "today",
  "tomorrow",
  "asap",
  "soon",
  "this week",
  "next week",
  "urgent",
  "immediately",
  "right away",
  "when possible",
];
const SENTIMENT_PREFIXES = [
  { prefix: "", sentiment: "neutral" },
  { prefix: "please ", sentiment: "positive" },
  { prefix: "help me ", sentiment: "neutral" },
  { prefix: "I need to ", sentiment: "neutral" },
  { prefix: "can you ", sentiment: "positive" },
  { prefix: "I want to ", sentiment: "neutral" },
  { prefix: "I'd like to ", sentiment: "positive" },
  { prefix: "I'm frustrated, ", sentiment: "frustrated" },
  { prefix: "urgently ", sentiment: "frustrated" },
  { prefix: "could you please ", sentiment: "positive" },
  { prefix: "would you ", sentiment: "positive" },
  { prefix: "kindly ", sentiment: "positive" },
  { prefix: "I'm looking to ", sentiment: "neutral" },
  { prefix: "hey, ", sentiment: "neutral" },
  { prefix: "hi, ", sentiment: "neutral" },
];

const PERSON_CONTEXTS = [
  "",
  "for my wife ",
  "for my husband ",
  "for my son ",
  "for my daughter ",
  "for my mother ",
  "for my father ",
  "for my business ",
  "for my family ",
  "on my behalf ",
];

const QUESTION_FRAMES = [
  (t: string) => t,
  (t: string) => `how do I ${t.toLowerCase()}`,
  (t: string) => `is it possible to ${t.toLowerCase()}`,
  (t: string) => `what's the process for ${t.toLowerCase()}`,
  (t: string) => `I was wondering about ${t.toLowerCase()}`,
  (t: string) => `tell me about ${t.toLowerCase()}`,
  (t: string) => `I have a question about ${t.toLowerCase()}`,
  (t: string) => `regarding ${t.toLowerCase()}`,
];

// ─── Root/Domain Lookup ────────────────────────────────────────────────────

import { ALL_ROOT_DATA } from "../engine/data/roots.js";

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

// ═══════════════════════════════════════════════════════════════════════════
// TELECOM SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

function telecomScenarios(): Scenario[] {
  return [
    {
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
    },
    {
      texts: [
        "I want to pay my bill",
        "Pay my balance",
        "Can I make a payment?",
        "Process my payment",
        "I need to pay my bill now",
        "Take payment for my account",
        "Pay my outstanding balance",
        "I'd like to settle my bill",
        "أريد أن أدفع فاتورتي",
        "دفع الفاتورة",
      ],
      tools: ["pay_bill"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Show me my billing history",
        "I want to see my previous bills",
        "Past invoices please",
        "What were my last 3 bills?",
        "Can I see my statement history?",
        "Show recent charges",
        "List my past payments",
        "أرني سجل فواتيري",
      ],
      tools: ["billing_history"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I want to dispute a charge",
        "There's a wrong charge on my bill",
        "I was overcharged",
        "This charge is incorrect",
        "I didn't make this purchase",
        "Remove this charge from my bill",
        "I was billed twice",
        "I see an unauthorized charge",
        "هناك خطأ في فاتورتي",
      ],
      tools: ["dispute_charge"],
      next: "await_input",
      confidence: "high",
      issueType: "billing",
    },
    {
      texts: [
        "What plan am I on?",
        "Show me my current plan",
        "What does my plan include?",
        "Plan details please",
        "What's my subscription?",
        "I want to see my plan features",
        "Tell me about my plan",
        "ما هي خطتي الحالية؟",
        "أريد معرفة تفاصيل اشتراكي",
      ],
      tools: ["view_plan"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I want to upgrade my plan",
        "Change my plan to unlimited",
        "I need a bigger plan",
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
    },
    {
      texts: [
        "Update my email address",
        "I moved, change my address",
        "Change my phone number on file",
        "Update my contact information",
        "I need to change my name on the account",
        "Update my personal details",
        "My email has changed",
        "حدث معلوماتي",
        "غير عنواني",
      ],
      tools: ["update_info"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "I want to cancel my service",
        "Cancel my account",
        "Close my account please",
        "I don't want this service anymore",
        "End my subscription",
        "Terminate my account",
        "أريد إلغاء اشتراكي",
        "ألغِ حسابي",
      ],
      tools: ["cancel_service"],
      next: "confirm",
      confidence: "high",
      issueType: "cancellation",
    },
    {
      texts: [
        "I want to add a new line",
        "Add another phone to my account",
        "I need a second line",
        "Can I add a line for my kid?",
        "Add a family line",
        "Get me another phone number",
        "أريد خط إضافي",
      ],
      tools: ["add_line"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Show me my profile",
        "What info do you have on me?",
        "What's my email on file?",
        "Show my account details",
        "I want to see my personal information",
        "What is my phone number on the account?",
        "Pull up my profile",
        "Get my customer information",
        "What data do you have about me?",
        "أرني ملفي الشخصي",
        "ما هي معلوماتي؟",
      ],
      tools: ["get_profile"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Is there a network issue?",
        "I have no signal",
        "Network is down",
        "I can't get any service",
        "Is there an outage in my area?",
        "My phone has no bars",
        "I lost network coverage",
        "The signal is very weak",
        "لا يوجد شبكة",
        "الإشارة ضعيفة",
      ],
      tools: ["check_network"],
      next: "report",
      confidence: "high",
      issueType: "technical",
    },
    {
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
    },
    {
      texts: [
        "Reset my network connection",
        "I need a connection reset",
        "Restart my network settings",
        "Fix my connection",
        "My internet isn't working, reset it",
        "أعد ضبط الشبكة",
      ],
      tools: ["reset_network"],
      next: "execute",
      confidence: "high",
      issueType: "technical",
    },
    {
      texts: [
        "My internet is slow",
        "Run a speed test",
        "Check my connection speed",
        "Why is my data so slow?",
        "Test my network speed",
        "How fast is my connection?",
        "الانترنت بطيء",
      ],
      tools: ["speed_test"],
      next: "execute",
      confidence: "high",
      issueType: "technical",
    },
    {
      texts: [
        "I want to report a network outage",
        "There's no service in my whole neighborhood",
        "Report a service disruption",
        "The network is down in my area",
        "Everything is out here",
        "أريد الإبلاغ عن انقطاع الخدمة",
      ],
      tools: ["report_outage"],
      next: "await_input",
      confidence: "high",
      issueType: "technical",
    },
    {
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
    },
    {
      texts: [
        "My phone won't turn on",
        "My screen is frozen",
        "Phone keeps restarting",
        "My device is not charging",
        "Apps keep crashing",
        "The touchscreen isn't responding",
        "جهازي لا يعمل",
      ],
      tools: ["troubleshoot_device"],
      next: "execute",
      confidence: "high",
      issueType: "device",
    },
    {
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
    },
    {
      texts: [
        "I need to activate my SIM card",
        "Activate my new SIM",
        "I got a replacement SIM",
        "My SIM card isn't working",
        "فعّل شريحتي",
      ],
      tools: ["activate_sim"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Transfer me to a real person",
        "I want to speak to someone",
        "Connect me to an agent",
        "Get me a human",
        "I need to talk to a person",
        "Let me speak to a manager",
        "حولني لموظف",
      ],
      tools: ["transfer_agent"],
      next: "escalate",
      confidence: "high",
    },
    {
      texts: [
        "Send me a confirmation",
        "Text me the details",
        "Send an SMS with the info",
        "Can you message me?",
        "أرسل لي رسالة تأكيد",
      ],
      tools: ["send_sms"],
      next: "execute",
      confidence: "high",
    },
    {
      texts: [
        "How do I set up voicemail?",
        "What are your business hours?",
        "How to enable international roaming?",
        "How do I forward my calls?",
        "What's the APN setting?",
        "كيف أفعّل التجوال؟",
      ],
      tools: ["search_kb"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Summarize that for me",
        "Give me the short version",
        "Compress that information",
        "Just the key points",
        "Make it shorter",
        "Organize that as a list",
        "لخص لي ذلك",
      ],
      tools: ["format_response"],
      next: "execute",
      confidence: "high",
    },
    {
      texts: [
        "This is completely unacceptable",
        "I've been waiting for hours",
        "Nobody is helping me",
        "I'm very frustrated",
        "I'm going to switch providers",
        "This is terrible customer service",
        "هذا غير مقبول",
      ],
      tools: ["transfer_agent"],
      next: "escalate",
      confidence: "high",
      issueType: "complaint",
    },
  ];
}

function telecomChains(): ChainScenario[] {
  return [
    {
      texts: [
        "Check my balance and pay it",
        "How much do I owe? I want to pay now",
        "Show me my bill and let me pay",
        "What's my balance? pay it please",
      ],
      steps: [
        { tool: "check_balance", reason: "billing" },
        { tool: "pay_bill", reason: "billing" },
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "My internet is not working, check and reset",
        "No signal, can you check and fix it?",
        "Connection is down, diagnose and reset",
      ],
      steps: [
        { tool: "check_network", reason: "technical" },
        { tool: "reset_network", reason: "technical" },
      ],
      next: "execute",
      confidence: "high",
    },
    {
      texts: [
        "I want to upgrade my phone and change my plan",
        "New phone and unlimited plan please",
        "Upgrade device and get a better plan",
      ],
      steps: [
        { tool: "upgrade_device", reason: "device" },
        { tool: "change_plan", reason: "account" },
      ],
      next: "confirm",
      confidence: "medium",
    },
    {
      texts: [
        "Check my data usage and run a speed test",
        "How much data is left? Also test my speed",
        "Data usage and speed test please",
      ],
      steps: [
        { tool: "check_data_usage", reason: "technical" },
        { tool: "speed_test", reason: "technical" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Check my device warranty and see if I can upgrade",
        "Is my warranty valid? I might want a new phone",
      ],
      steps: [
        { tool: "check_device", reason: "device" },
        { tool: "upgrade_device", reason: "device" },
      ],
      next: "report",
      confidence: "medium",
    },
    {
      texts: [
        "Search for roaming info and summarize",
        "Find voicemail articles and give me a summary",
        "Look up data plans and format the results",
      ],
      steps: [
        { tool: "search_kb", reason: "general" },
        { tool: "format_response", reason: "format" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Show my profile and just the key info",
        "Get my account details and highlight important stuff",
      ],
      steps: [
        { tool: "get_profile", reason: "account" },
        { tool: "format_response", reason: "format" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Check billing history and summarize it",
        "Show me past bills, just the totals",
        "My billing history in a short summary",
      ],
      steps: [
        { tool: "billing_history", reason: "billing" },
        { tool: "format_response", reason: "format" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Check network, run speed test, and report outage",
        "Network down, test speed, and file a report",
      ],
      steps: [
        { tool: "check_network", reason: "technical" },
        { tool: "speed_test", reason: "technical" },
        { tool: "report_outage", reason: "technical" },
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Check my balance, view plan, and show my profile",
        "Account overview: balance, plan, and profile",
      ],
      steps: [
        { tool: "check_balance", reason: "billing" },
        { tool: "view_plan", reason: "account" },
        { tool: "get_profile", reason: "account" },
      ],
      next: "report",
      confidence: "high",
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// BANKING SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

function bankingScenarios(): Scenario[] {
  return [
    {
      texts: [
        "What's my account balance?",
        "Check my bank balance",
        "How much money do I have?",
        "Show me my account status",
        "What funds are available?",
        "Account balance please",
        "كم رصيد حسابي؟",
        "أريد معرفة رصيدي البنكي",
      ],
      tools: ["check_account"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Show me my recent transactions",
        "What are my last purchases?",
        "Transaction history please",
        "Show my bank statements",
        "List my recent activity",
        "What did I spend last week?",
        "أرني معاملاتي الأخيرة",
      ],
      tools: ["view_transactions"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I want to open a new account",
        "Open a savings account",
        "I need a checking account",
        "How do I open an account?",
        "Set up a new bank account",
        "أريد فتح حساب جديد",
      ],
      tools: ["open_account"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "I want to close my account",
        "Close my bank account",
        "Shut down my account",
        "I'm closing my account",
        "Cancel my bank account",
        "أريد إغلاق حسابي",
      ],
      tools: ["close_account"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Transfer money to my savings",
        "Send money to another account",
        "Move funds between accounts",
        "I want to transfer money",
        "Make a transfer please",
        "حول مبلغ لحسابي الآخر",
        "أريد تحويل أموال",
      ],
      tools: ["transfer_money"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "I need to send a wire transfer",
        "Wire money internationally",
        "International transfer please",
        "Send money overseas",
        "Wire to another bank",
        "أريد تحويل دولي",
      ],
      tools: ["wire_transfer"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Set up automatic payments",
        "Enable autopay",
        "I want to schedule recurring payments",
        "Auto pay my rent",
        "Set up bill pay",
        "فعّل الدفع التلقائي",
      ],
      tools: ["auto_pay"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "I want to apply for a loan",
        "Can I get a personal loan?",
        "I need to borrow money",
        "Apply for financing",
        "Loan application please",
        "How do I get a loan?",
        "أريد التقدم بطلب قرض",
      ],
      tools: ["apply_loan"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "What's my loan status?",
        "Check my loan balance",
        "How much do I owe on my loan?",
        "When is my next loan payment?",
        "Loan payment remaining",
        "ما حالة قرضي؟",
      ],
      tools: ["loan_status"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Calculate my mortgage payment",
        "Mortgage estimate please",
        "What would my monthly payment be?",
        "Home loan calculator",
        "How much for a mortgage?",
        "احسب قسط الرهن العقاري",
      ],
      tools: ["mortgage_calc"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Block my card immediately",
        "My card was stolen",
        "I lost my credit card",
        "Freeze my card",
        "I need to block my card now",
        "Card is missing, block it",
        "بطاقتي سُرقت",
        "قفل بطاقتي فوراً",
      ],
      tools: ["card_block"],
      next: "execute",
      confidence: "high",
      issueType: "security",
    },
    {
      texts: [
        "Activate my new card",
        "I got a new card, activate it",
        "Card activation please",
        "Turn on my replacement card",
        "فعّل بطاقتي الجديدة",
      ],
      tools: ["card_activate"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "What's my credit score?",
        "Check my credit rating",
        "Show me my credit score",
        "How's my credit?",
        "Credit report please",
        "ما هو تصنيفي الائتماني؟",
      ],
      tools: ["credit_score"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Show me my investment portfolio",
        "How are my investments doing?",
        "Portfolio performance please",
        "Check my stocks",
        "Investment summary",
        "ما أداء استثماراتي؟",
      ],
      tools: ["investment_portfolio"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Set a savings goal",
        "I want to save for a house",
        "Create a savings target",
        "How's my savings goal progress?",
        "Track my savings",
        "أريد وضع هدف ادخار",
      ],
      tools: ["savings_goal"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "What's the exchange rate?",
        "Dollar to euro rate",
        "Currency conversion rate",
        "How much is a dollar in riyals?",
        "Exchange rate for pounds",
        "ما سعر الصرف؟",
      ],
      tools: ["exchange_rate"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Set a spending budget",
        "Create a budget for dining",
        "I want to limit my spending",
        "Budget alert for shopping",
        "ضع ميزانية للمصروفات",
      ],
      tools: ["set_budget"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Find the nearest ATM",
        "Where's the closest branch?",
        "ATM near me",
        "Bank branch nearby",
        "أين أقرب صراف آلي؟",
      ],
      tools: ["atm_locator"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I want to report fraud",
        "There's suspicious activity on my account",
        "Someone used my card",
        "Unauthorized transaction",
        "I think my account was hacked",
        "هناك معاملة مشبوهة",
      ],
      tools: ["fraud_report"],
      next: "await_input",
      confidence: "high",
      issueType: "security",
    },
    {
      texts: [
        "I need my tax documents",
        "Send me my 1099",
        "Tax forms for this year",
        "Where are my tax statements?",
        "أريد مستنداتي الضريبية",
      ],
      tools: ["tax_docs"],
      next: "report",
      confidence: "high",
    },
  ];
}

function bankingChains(): ChainScenario[] {
  return [
    {
      texts: [
        "Check my balance and transfer to savings",
        "See my balance then move money",
        "Account balance and make a transfer",
      ],
      steps: [
        { tool: "check_account", reason: "account" },
        { tool: "transfer_money", reason: "transfers" },
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Block my card and report fraud",
        "Card stolen, block it and file a report",
        "Freeze card and report unauthorized activity",
      ],
      steps: [
        { tool: "card_block", reason: "security" },
        { tool: "fraud_report", reason: "security" },
      ],
      next: "execute",
      confidence: "high",
    },
    {
      texts: [
        "Check my credit score and apply for a loan",
        "What's my credit? I want a loan",
        "Credit check then loan application",
      ],
      steps: [
        { tool: "credit_score", reason: "cards" },
        { tool: "apply_loan", reason: "loans" },
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "View transactions and set a budget",
        "Show my spending and create a budget limit",
        "Transaction history then budget setup",
      ],
      steps: [
        { tool: "view_transactions", reason: "account" },
        { tool: "set_budget", reason: "services" },
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Check exchange rate and wire money",
        "What's the rate? Then send a wire",
        "Currency rate and international transfer",
      ],
      steps: [
        { tool: "exchange_rate", reason: "services" },
        { tool: "wire_transfer", reason: "transfers" },
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Check loan status and mortgage calculator",
        "My loan balance and calculate new mortgage",
        "Loan info and mortgage estimate",
      ],
      steps: [
        { tool: "loan_status", reason: "loans" },
        { tool: "mortgage_calc", reason: "loans" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Portfolio check, savings goal, and budget",
        "How are investments? Check savings and set budget",
      ],
      steps: [
        { tool: "investment_portfolio", reason: "investments" },
        { tool: "savings_goal", reason: "investments" },
        { tool: "set_budget", reason: "services" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Account balance, recent transactions, and find ATM",
        "Full account overview and nearest ATM",
      ],
      steps: [
        { tool: "check_account", reason: "account" },
        { tool: "view_transactions", reason: "account" },
        { tool: "atm_locator", reason: "services" },
      ],
      next: "report",
      confidence: "high",
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTHCARE SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

function healthcareScenarios(): Scenario[] {
  return [
    {
      texts: [
        "I need to book an appointment",
        "Schedule a doctor visit",
        "Can I see a doctor?",
        "Make an appointment for me",
        "I want to book a checkup",
        "Schedule a visit please",
        "أريد حجز موعد",
        "احجز لي موعد عند الطبيب",
      ],
      tools: ["book_appointment"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Cancel my appointment",
        "I can't make my appointment",
        "Need to cancel my visit",
        "Cancel my doctor appointment",
        "ألغِ موعدي",
      ],
      tools: ["cancel_appointment"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "Find a doctor near me",
        "I need a cardiologist",
        "Search for a dermatologist",
        "Who are the available doctors?",
        "Find me a specialist",
        "أبحث عن طبيب",
      ],
      tools: ["find_doctor"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I want a virtual appointment",
        "Can I do telemedicine?",
        "Online doctor visit",
        "Video call with a doctor",
        "Schedule a telehealth visit",
        "أريد استشارة عن بعد",
      ],
      tools: ["telemedicine"],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Show me my medical records",
        "I need my health records",
        "Access my patient file",
        "View my medical history",
        "Pull up my records",
        "أريد سجلاتي الطبية",
      ],
      tools: ["view_records"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Do I have any lab results?",
        "Check my blood test results",
        "Show me my test results",
        "Lab work results please",
        "Are my lab results ready?",
        "نتائج تحاليلي",
      ],
      tools: ["lab_results"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Show my vaccination record",
        "What vaccines have I had?",
        "Am I due for any shots?",
        "Vaccination history please",
        "سجل لقاحاتي",
      ],
      tools: ["vaccination_record"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Give me a health summary",
        "Overview of my health",
        "What are my current conditions?",
        "My health status please",
        "ملخص حالتي الصحية",
      ],
      tools: ["health_summary"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Show me my discharge notes",
        "What were my discharge instructions?",
        "After-visit instructions please",
        "تعليمات الخروج من المستشفى",
      ],
      tools: ["discharge_notes"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I need a prescription refill",
        "Refill my medication",
        "Can I get a refill?",
        "I'm running low on medication",
        "Renew my prescription",
        "أريد تجديد الوصفة الطبية",
      ],
      tools: ["prescription_refill"],
      next: "confirm",
      confidence: "high",
    },
    {
      texts: [
        "What medications am I taking?",
        "Show me my medication list",
        "My current prescriptions",
        "List my meds",
        "قائمة أدويتي",
      ],
      tools: ["medication_list"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "What are my allergies?",
        "Show my allergy list",
        "Do I have any drug allergies?",
        "Check my allergy records",
        "ما هي حساسياتي؟",
      ],
      tools: ["allergy_list"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Find a pharmacy near me",
        "Where's the nearest pharmacy?",
        "Pharmacy nearby",
        "Where can I pick up my prescription?",
        "أين أقرب صيدلية؟",
      ],
      tools: ["pharmacy_locator"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Check my insurance coverage",
        "Am I covered for this?",
        "What does my insurance cover?",
        "Verify my insurance",
        "Is this procedure covered?",
        "هل التأمين يغطي هذا؟",
      ],
      tools: ["insurance_check"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "How much will this cost?",
        "Estimate the bill",
        "What's the cost of this procedure?",
        "Bill estimate please",
        "كم ستكون التكلفة؟",
      ],
      tools: ["bill_estimate"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I need prior authorization",
        "Check if preauth is needed",
        "Authorization for my procedure",
        "Prior auth status",
        "هل أحتاج موافقة مسبقة؟",
      ],
      tools: ["prior_auth"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "What's my claim status?",
        "Check my insurance claim",
        "Has my claim been processed?",
        "Claim update please",
        "ما حالة مطالبتي؟",
      ],
      tools: ["claim_status"],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "I have a headache and fever",
        "I'm not feeling well",
        "Check my symptoms",
        "I have chest pain",
        "I feel dizzy and nauseous",
        "What could my symptoms mean?",
        "عندي صداع وحرارة",
      ],
      tools: ["symptom_checker"],
      next: "report",
      confidence: "high",
      issueType: "clinical",
    },
    {
      texts: [
        "What's the emergency number?",
        "Where's the nearest ER?",
        "I need emergency help",
        "This is an emergency",
        "أحتاج طوارئ",
      ],
      tools: ["emergency_info"],
      next: "execute",
      confidence: "high",
      issueType: "clinical",
    },
    {
      texts: [
        "I need a referral to a specialist",
        "Refer me to a cardiologist",
        "I need to see a specialist",
        "Can I get a referral?",
        "أحتاج تحويل لأخصائي",
      ],
      tools: ["referral_request"],
      next: "await_input",
      confidence: "high",
    },
  ];
}

function healthcareChains(): ChainScenario[] {
  return [
    {
      texts: [
        "Check my symptoms and book an appointment",
        "I'm feeling sick, check symptoms and schedule a visit",
        "Symptom check then book a doctor",
      ],
      steps: [
        { tool: "symptom_checker", reason: "clinical" },
        { tool: "book_appointment", reason: "appointments" },
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Find a doctor and book an appointment",
        "Search for a specialist and schedule",
        "Doctor search then book a visit",
      ],
      steps: [
        { tool: "find_doctor", reason: "appointments" },
        { tool: "book_appointment", reason: "appointments" },
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Check insurance and estimate the bill",
        "Am I covered? How much will it cost?",
        "Insurance check then cost estimate",
      ],
      steps: [
        { tool: "insurance_check", reason: "insurance" },
        { tool: "bill_estimate", reason: "insurance" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Refill prescription and find pharmacy",
        "Renew my meds and where to pick up",
        "Prescription refill then nearest pharmacy",
      ],
      steps: [
        { tool: "prescription_refill", reason: "medications" },
        { tool: "pharmacy_locator", reason: "medications" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "View my records and get a health summary",
        "Show records then summarize my health",
        "Medical history and health overview",
      ],
      steps: [
        { tool: "view_records", reason: "records" },
        { tool: "health_summary", reason: "records" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Lab results and book a follow-up",
        "Check test results and schedule appointment",
        "Get my labs then book a visit",
      ],
      steps: [
        { tool: "lab_results", reason: "records" },
        { tool: "book_appointment", reason: "appointments" },
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      texts: [
        "Check my allergies and medication list",
        "Allergy check and current meds",
        "Show allergies then medications",
      ],
      steps: [
        { tool: "allergy_list", reason: "medications" },
        { tool: "medication_list", reason: "medications" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Check insurance, get prior auth, and check claim",
        "Insurance coverage, authorization, and claim status",
      ],
      steps: [
        { tool: "insurance_check", reason: "insurance" },
        { tool: "prior_auth", reason: "insurance" },
        { tool: "claim_status", reason: "insurance" },
      ],
      next: "report",
      confidence: "high",
    },
    {
      texts: [
        "Health summary, medications, and vaccination record",
        "Full health overview: conditions, meds, and vaccines",
      ],
      steps: [
        { tool: "health_summary", reason: "records" },
        { tool: "medication_list", reason: "medications" },
        { tool: "vaccination_record", reason: "records" },
      ],
      next: "report",
      confidence: "high",
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT FOLLOW-UP SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

interface FollowUp {
  prevTool: string;
  texts: string[];
  tools: string[];
  next: NextStep;
}

function allFollowUps(): FollowUp[] {
  return [
    {
      prevTool: "check_balance",
      texts: ["OK pay it now", "Go ahead and pay", "Yes, make the payment"],
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
      texts: ["I want to upgrade then", "Show me new phones"],
      tools: ["upgrade_device"],
      next: "report",
    },
    {
      prevTool: "speed_test",
      texts: ["Report this as an outage", "File a complaint"],
      tools: ["report_outage"],
      next: "await_input",
    },
    {
      prevTool: "check_data_usage",
      texts: ["I need more data", "Upgrade my data plan"],
      tools: ["change_plan"],
      next: "confirm",
    },
    {
      prevTool: "search_kb",
      texts: ["Summarize that", "Give me the short version"],
      tools: ["format_response"],
      next: "execute",
    },
    {
      prevTool: "billing_history",
      texts: ["Summarize those bills", "Just the totals please"],
      tools: ["format_response"],
      next: "execute",
    },
    {
      prevTool: "check_account",
      texts: ["Transfer the money now", "Move to savings"],
      tools: ["transfer_money"],
      next: "confirm",
    },
    {
      prevTool: "view_transactions",
      texts: ["Set a budget for that", "Create a spending limit"],
      tools: ["set_budget"],
      next: "confirm",
    },
    {
      prevTool: "credit_score",
      texts: ["OK apply for the loan", "I want to apply now"],
      tools: ["apply_loan"],
      next: "await_input",
    },
    {
      prevTool: "card_block",
      texts: ["Now report the fraud", "File a fraud report too"],
      tools: ["fraud_report"],
      next: "await_input",
    },
    {
      prevTool: "exchange_rate",
      texts: ["Send the wire now", "Proceed with the transfer"],
      tools: ["wire_transfer"],
      next: "confirm",
    },
    {
      prevTool: "symptom_checker",
      texts: ["Book an appointment", "I need to see a doctor"],
      tools: ["book_appointment"],
      next: "await_input",
    },
    {
      prevTool: "find_doctor",
      texts: ["Book with that doctor", "Schedule with them"],
      tools: ["book_appointment"],
      next: "await_input",
    },
    {
      prevTool: "insurance_check",
      texts: ["How much will it cost?", "Estimate the bill"],
      tools: ["bill_estimate"],
      next: "report",
    },
    {
      prevTool: "lab_results",
      texts: ["Book a follow-up", "Schedule another visit"],
      tools: ["book_appointment"],
      next: "await_input",
    },
    {
      prevTool: "prescription_refill",
      texts: ["Find a pharmacy near me", "Where do I pick it up?"],
      tools: ["pharmacy_locator"],
      next: "report",
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATOR ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function tryGenerateExample(
  text: string,
  scenario: {
    tools: string[];
    next: NextStep;
    confidence: "high" | "medium" | "low";
    issueType?: string;
  },
  domainId: string,
  id: number,
  source: string,
): AgentExample | null {
  try {
    const token = encodeLocal(text);
    const inputSer = serializeInput(token);
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

    return {
      id: `${source}-${domainId}-${String(id).padStart(5, "0")}`,
      input_text: text,
      input_tokens: inputSer.tokens,
      input_ids: inputSer.ids,
      output_tokens: outputSer.tokens,
      output_ids: outputSer.ids,
      tools: scenario.tools,
      next_step: scenario.next,
      domain: rootData?.domain ?? "general",
      issue_type: scenario.issueType ?? "general",
      source: `${source}-${domainId}`,
    };
  } catch {
    return null;
  }
}

function generateSingleToolExamples(
  scenarios: Scenario[],
  domainId: string,
  idOffset: number,
): AgentExample[] {
  const examples: AgentExample[] = [];
  let id = idOffset;
  const seen = new Set<string>();

  function addIfNew(text: string, scenario: Scenario) {
    const key = text.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    const ex = tryGenerateExample(text, scenario, domainId, id, "agent");
    if (ex) {
      examples.push(ex);
      id++;
    }
  }

  for (const scenario of scenarios) {
    for (const baseText of scenario.texts) {
      const isArabic = /^[\u0600-\u06FF]/.test(baseText);

      // Round 1: sentiment × time (core variations)
      const sentiments = isArabic
        ? SENTIMENT_PREFIXES.slice(0, 1)
        : SENTIMENT_PREFIXES.slice(0, 8);
      const timeMods = TIME_MODS.slice(0, isArabic ? 3 : 8);
      for (const { prefix } of sentiments) {
        for (const timeMod of timeMods) {
          const text = timeMod
            ? `${prefix}${baseText} ${timeMod}`.trim()
            : `${prefix}${baseText}`.trim();
          addIfNew(text, scenario);
        }
      }

      if (isArabic) continue; // skip augmentation for Arabic texts

      // Round 2: person context × time
      const personCtxs = PERSON_CONTEXTS.slice(0, 6);
      const timeMods2 = TIME_MODS.slice(0, 5);
      for (const person of personCtxs) {
        for (const timeMod of timeMods2) {
          const text = timeMod
            ? `${person}${baseText} ${timeMod}`.trim()
            : `${person}${baseText}`.trim();
          addIfNew(text, scenario);
        }
      }

      // Round 3: question frames × time
      const frames = QUESTION_FRAMES.slice(0, 5);
      const timeMods3 = TIME_MODS.slice(0, 4);
      for (const frame of frames) {
        for (const timeMod of timeMods3) {
          const framed = frame(baseText);
          const text = timeMod ? `${framed} ${timeMod}`.trim() : framed;
          addIfNew(text, scenario);
        }
      }
    }
  }

  return examples;
}

function generateChainExamples(
  chains: ChainScenario[],
  domainId: string,
  idOffset: number,
): AgentExample[] {
  const examples: AgentExample[] = [];
  let id = idOffset;
  const seen = new Set<string>();

  for (const chain of chains) {
    for (const baseText of chain.texts) {
      const isArabic = /^[\u0600-\u06FF]/.test(baseText);

      // Build all text variations for this base text
      const textVariants: string[] = [];
      const sentiments = isArabic
        ? SENTIMENT_PREFIXES.slice(0, 1)
        : SENTIMENT_PREFIXES.slice(0, 8);
      const timeMods = TIME_MODS.slice(0, isArabic ? 2 : 6);

      // Round 1: sentiment × time
      for (const { prefix } of sentiments) {
        for (const timeMod of timeMods) {
          const text = timeMod
            ? `${prefix}${baseText} ${timeMod}`.trim()
            : `${prefix}${baseText}`.trim();
          textVariants.push(text);
        }
      }

      // Round 2: person context × time (English only)
      if (!isArabic) {
        const personCtxs = PERSON_CONTEXTS.slice(0, 5);
        const timeMods2 = TIME_MODS.slice(0, 4);
        for (const person of personCtxs) {
          for (const timeMod of timeMods2) {
            const text = timeMod
              ? `${person}${baseText} ${timeMod}`.trim()
              : `${person}${baseText}`.trim();
            textVariants.push(text);
          }
        }
      }

      // Round 3: question frame (English only)
      if (!isArabic) {
        const frames = QUESTION_FRAMES.slice(0, 4);
        for (const frame of frames) {
          textVariants.push(frame(baseText));
        }
      }

      for (const text of textVariants) {
        const key = text.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);

        try {
          const token = encodeLocal(text);
          const inputSer = serializeInput(token);
          const rootData = findRootDomain(token.root);

          const outputSer = serializeChainOutput({
            action: determineAction(token.intent, token.pattern),
            root: token.root,
            domain: rootData?.domain ?? "general",
            steps: chain.steps,
            nextStep: chain.next,
            confidence: chain.confidence,
            modifiers: token.modifiers,
          });

          examples.push({
            id: `chain-${domainId}-${String(id).padStart(5, "0")}`,
            input_text: text,
            input_tokens: inputSer.tokens,
            input_ids: inputSer.ids,
            output_tokens: outputSer.tokens,
            output_ids: outputSer.ids,
            tools: chain.steps.map((s) => s.tool),
            next_step: chain.next,
            domain: rootData?.domain ?? "general",
            issue_type: "chain",
            source: `chain-${domainId}`,
          });
          id++;
        } catch {
          continue;
        }
      }
    }
  }

  return examples;
}

function generateContextExamples(
  followups: FollowUp[],
  idOffset: number,
): AgentExample[] {
  const vocab = getVocabulary();
  const examples: AgentExample[] = [];
  let id = idOffset;

  for (const followup of followups) {
    for (const text of followup.texts) {
      const variations: string[] = [];
      // Expand with sentiments and time mods
      for (const { prefix } of SENTIMENT_PREFIXES.slice(0, 8)) {
        for (const timeMod of TIME_MODS.slice(0, 6)) {
          const v = timeMod
            ? `${prefix}${text} ${timeMod}`.trim()
            : `${prefix}${text}`.trim();
          variations.push(v);
        }
      }

      for (const variant of variations) {
        try {
          const token = encodeLocal(variant);
          const inputSer = serializeInput(token);

          const ctxTokens = [
            "CTX:prev_tool",
            `TOOL:${followup.prevTool}`,
            "CTX:turn",
            "LIT:2",
          ];
          const augmentedTokens = [
            ...inputSer.tokens.slice(0, -1),
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
            input_text: `[after ${followup.prevTool}] ${variant}`,
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
  }

  return examples;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

console.log("Arabic Algebra — Agent Training Data Generator v2\n");
console.log(
  "Domains: telecom (24 tools) + banking (20 tools) + healthcare (20 tools)\n",
);

const vocab = getVocabulary();

// Register all domain tools
for (const tool of TELECOM_DOMAIN.tools) vocab.addTool(tool.id);
for (const tool of BANKING_DOMAIN.tools) vocab.addTool(tool.id);
for (const tool of HEALTHCARE_DOMAIN.tools) vocab.addTool(tool.id);

// Generate
console.log("Generating single-tool examples...");
const telecomSingle = generateSingleToolExamples(
  telecomScenarios(),
  "telecom",
  0,
);
console.log(`  Telecom: ${telecomSingle.length}`);

const bankingSingle = generateSingleToolExamples(
  bankingScenarios(),
  "banking",
  telecomSingle.length,
);
console.log(`  Banking: ${bankingSingle.length}`);

const healthcareSingle = generateSingleToolExamples(
  healthcareScenarios(),
  "healthcare",
  telecomSingle.length + bankingSingle.length,
);
console.log(`  Healthcare: ${healthcareSingle.length}`);

console.log("\nGenerating chain-of-thought examples...");
const telecomChainEx = generateChainExamples(telecomChains(), "telecom", 0);
console.log(`  Telecom chains: ${telecomChainEx.length}`);

const bankingChainEx = generateChainExamples(
  bankingChains(),
  "banking",
  telecomChainEx.length,
);
console.log(`  Banking chains: ${bankingChainEx.length}`);

const healthcareChainEx = generateChainExamples(
  healthcareChains(),
  "healthcare",
  telecomChainEx.length + bankingChainEx.length,
);
console.log(`  Healthcare chains: ${healthcareChainEx.length}`);

console.log("\nGenerating context follow-up examples...");
const ctxExamples = generateContextExamples(allFollowUps(), 0);
console.log(`  Context follow-ups: ${ctxExamples.length}`);

const allExamples = [
  ...telecomSingle,
  ...bankingSingle,
  ...healthcareSingle,
  ...telecomChainEx,
  ...bankingChainEx,
  ...healthcareChainEx,
  ...ctxExamples,
];

console.log(`\n${"=".repeat(50)}`);
console.log(`Total agent examples: ${allExamples.length}`);
console.log(
  `  Single-tool: ${telecomSingle.length + bankingSingle.length + healthcareSingle.length}`,
);
console.log(
  `  Chains: ${telecomChainEx.length + bankingChainEx.length + healthcareChainEx.length}`,
);
console.log(`  Context: ${ctxExamples.length}`);

// Write output
const outDir = join(import.meta.dirname ?? ".", "../../data/corpus");
const outPath = join(outDir, "train-agent.jsonl");
const lines = allExamples.map((ex) => JSON.stringify(ex));
writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");
console.log(`\nWritten: ${outPath}`);

// Stats
const toolCounts: Record<string, number> = {};
const nextCounts: Record<string, number> = {};
const sourceCounts: Record<string, number> = {};
for (const ex of allExamples) {
  for (const t of ex.tools) toolCounts[t] = (toolCounts[t] ?? 0) + 1;
  nextCounts[ex.next_step] = (nextCounts[ex.next_step] ?? 0) + 1;
  sourceCounts[ex.source] = (sourceCounts[ex.source] ?? 0) + 1;
}
console.log("\nBy source:", sourceCounts);
console.log("By next step:", nextCounts);
console.log("\nTool distribution:");
for (const [tool, count] of Object.entries(toolCounts).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${tool}: ${count}`);
}

// Export updated vocabulary
import { exportVocabulary } from "./corpus.js";
const vocabPath = join(outDir, "vocabulary.json");
writeFileSync(vocabPath, exportVocabulary(), "utf-8");
console.log(`\nVocabulary updated: ${vocabPath} (${vocab.size} tokens)`);
