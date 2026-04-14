/**
 * Arabic Algebra — Clean Dataset Generator v3
 *
 * Generates a smaller, higher-quality training set:
 *   - ~8K general examples (1 per root × intent, distributed patterns/modifiers)
 *   - ~5K agent examples (1 tool per example, clean LIT values)
 *   - ~2K chain examples (multi-step STEP:n TOOL:x REASON:y sequences)
 *   - Vocabulary is built FIRST, then data uses only known tokens
 *
 * Run: npx tsx src/training/generate-v3.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { encodeLocal } from "../engine/core/encoder.js";
import { engine } from "../engine/core/engine.js";
import { ALL_ROOT_DATA, type RootData } from "../engine/data/roots.js";
import type {
  AlgebraToken,
  IntentOperator,
  PatternOperator,
} from "../engine/core/types.js";
import { serializeInput, serializeOutput } from "./serializer.js";
import { getVocabulary, AlgebraVocabulary } from "./vocabulary.js";
import { TELECOM_DOMAIN } from "../engine/agent/domains/telecom.js";
import { BANKING_DOMAIN } from "../engine/agent/domains/banking.js";
import { HEALTHCARE_DOMAIN } from "../engine/agent/domains/healthcare.js";
import type { DomainDefinition, NextStep } from "../engine/agent/types.js";

// ─── Config ────────────────────────────────────────────────────────────────

const OUT_DIR = join(import.meta.dirname ?? ".", "../../data/corpus");
mkdirSync(OUT_DIR, { recursive: true });

const ALL_INTENTS: IntentOperator[] = [
  "seek",
  "do",
  "send",
  "gather",
  "record",
  "learn",
  "decide",
  "enable",
  "judge",
  "ask",
];

const ALL_PATTERNS: PatternOperator[] = [
  "agent",
  "patient",
  "place",
  "instance",
  "plural",
  "seek",
  "mutual",
  "process",
  "intensifier",
  "causer",
];

// Only use modifier values that exist in the base vocabulary — no LIT: explosion
const CLEAN_MODIFIERS: Array<{ key: string; values: string[] }> = [
  {
    key: "time",
    values: [
      "now",
      "today",
      "tomorrow",
      "this_week",
      "next_week",
      "morning",
      "afternoon",
      "soon",
      "asap",
    ],
  },
  { key: "urgency", values: ["low", "normal", "high", "critical"] },
];

// Intent templates — one per intent, using {keyword} placeholder
const INTENT_TEMPLATES: Record<IntentOperator, string[]> = {
  seek: ["Find {kw}", "Search for {kw}", "Locate {kw}", "Look up {kw}"],
  do: ["Execute {kw}", "Run {kw}", "Perform {kw}", "Handle {kw}"],
  send: ["Send {kw}", "Forward {kw}", "Deliver {kw}", "Share {kw}"],
  gather: ["Collect {kw}", "Gather {kw}", "Compile {kw}", "Assemble {kw}"],
  record: ["Record {kw}", "Save {kw}", "Store {kw}", "Document {kw}"],
  learn: ["Learn about {kw}", "Study {kw}", "Research {kw}", "Explore {kw}"],
  decide: ["Decide on {kw}", "Resolve {kw}", "Choose {kw}", "Determine {kw}"],
  enable: ["Enable {kw}", "Activate {kw}", "Turn on {kw}", "Set up {kw}"],
  judge: ["Evaluate {kw}", "Review {kw}", "Assess {kw}", "Audit {kw}"],
  ask: [
    "What is {kw}?",
    "Tell me about {kw}",
    "How does {kw} work?",
    "What's {kw}?",
  ],
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface Example {
  id: string;
  input_text: string;
  input_tokens: string[];
  input_ids: number[];
  output_tokens: string[];
  output_ids: number[];
  domain: string;
  source: string;
  // Agent-specific
  tools?: string[];
  next_step?: string;
}

// ─── Deterministic RNG ─────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const rng = seededRng(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: GENERAL CORPUS (~8K)
// ═══════════════════════════════════════════════════════════════════════════

function generateGeneralCorpus(): Example[] {
  const examples: Example[] = [];
  let id = 0;

  // Strategy: for each root, pick ONE intent and ONE pattern deterministically
  // Then cycle through intents/patterns across roots for coverage
  const roots = shuffle(ALL_ROOT_DATA);

  for (let ri = 0; ri < roots.length; ri++) {
    const rootData = roots[ri];
    const keywords = rootData.keywords.filter((k) => /^[a-z]/i.test(k));
    if (keywords.length === 0) continue;

    // Each root gets ~10 examples: one per intent, with varied patterns/modifiers
    for (let ii = 0; ii < ALL_INTENTS.length; ii++) {
      const intent = ALL_INTENTS[ii];
      const pattern = ALL_PATTERNS[(ri + ii) % ALL_PATTERNS.length];
      const kw = keywords[(ri + ii) % keywords.length];
      const template =
        INTENT_TEMPLATES[intent][(ri + ii) % INTENT_TEMPLATES[intent].length];
      let inputText = template.replace("{kw}", kw);

      // 60% of examples get a time modifier, 20% get urgency, 20% get none
      const modRoll = rng();
      if (modRoll < 0.6) {
        const tv = pick(CLEAN_MODIFIERS[0].values);
        inputText += ` ${tv.replace("_", " ")}`;
      } else if (modRoll < 0.8) {
        inputText += ` urgently`;
      }

      try {
        const token = encodeLocal(inputText);
        const reasoning = engine.reason(token);
        const domain = rootData.domain;

        const inputSer = serializeInput(token);
        const outputSer = serializeOutput(reasoning, domain);

        // Skip if any token is LIT: (keep it clean)
        const hasLit =
          inputSer.tokens.some((t) => t.startsWith("LIT:")) ||
          outputSer.tokens.some((t) => t.startsWith("LIT:"));
        if (hasLit) continue;

        examples.push({
          id: `gen-${String(id).padStart(5, "0")}`,
          input_text: inputText,
          input_tokens: inputSer.tokens,
          input_ids: inputSer.ids,
          output_tokens: outputSer.tokens,
          output_ids: outputSer.ids,
          domain,
          source: "general",
        });
        id++;
      } catch {
        continue;
      }
    }
  }

  return examples;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: AGENT CORPUS (~5K)
// ═══════════════════════════════════════════════════════════════════════════

interface ToolScenario {
  toolId: string;
  texts: string[];
  next: NextStep;
  confidence: "high" | "medium" | "low";
}

function telecomTools(): ToolScenario[] {
  return [
    {
      toolId: "check_balance",
      texts: [
        "What is my balance",
        "Check my account balance",
        "How much do I owe",
        "Show me my balance",
        "كم رصيدي",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "pay_bill",
      texts: [
        "Pay my bill",
        "Make a payment",
        "I want to pay",
        "Process my payment",
        "دفع الفاتورة",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "billing_history",
      texts: [
        "Show my billing history",
        "Past invoices",
        "Previous bills",
        "My payment history",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "dispute_charge",
      texts: [
        "Dispute a charge",
        "Wrong charge on my bill",
        "I was overcharged",
        "Incorrect billing",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "view_plan",
      texts: [
        "What plan am I on",
        "Show my current plan",
        "My subscription details",
        "Plan features",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "change_plan",
      texts: [
        "Upgrade my plan",
        "Change my subscription",
        "Switch to a better plan",
        "Downgrade my plan",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "add_addon",
      texts: [
        "Add extra data",
        "Get more minutes",
        "Add an addon",
        "Extra data pack",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_usage",
      texts: [
        "Check my data usage",
        "How much data have I used",
        "My usage summary",
        "Show my consumption",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "check_coverage",
      texts: [
        "Is there coverage in my area",
        "Check network coverage",
        "Signal strength",
        "Coverage map",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "report_outage",
      texts: [
        "Report a network outage",
        "My internet is down",
        "No service in my area",
        "Network problem",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "speed_test",
      texts: [
        "Run a speed test",
        "Check my internet speed",
        "How fast is my connection",
        "Test my bandwidth",
      ],
      next: "execute",
      confidence: "high",
    },
    {
      toolId: "reset_router",
      texts: [
        "Reset my router",
        "Restart the modem",
        "Reboot my device",
        "Router not working",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "open_ticket",
      texts: [
        "Open a support ticket",
        "Create a complaint",
        "File a ticket",
        "I need help with an issue",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "track_ticket",
      texts: [
        "Track my ticket",
        "Check ticket status",
        "Update on my complaint",
        "Where is my support request",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "transfer_agent",
      texts: [
        "Transfer me to an agent",
        "Speak to a human",
        "I want a real person",
        "Connect me to support",
      ],
      next: "escalate",
      confidence: "high",
    },
    {
      toolId: "search_kb",
      texts: [
        "How do I set up voicemail",
        "What is call forwarding",
        "How to enable roaming",
        "Help with settings",
      ],
      next: "report",
      confidence: "medium",
    },
    {
      toolId: "activate_roaming",
      texts: [
        "Activate international roaming",
        "Enable roaming",
        "I'm traveling abroad",
        "Turn on roaming",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "block_sim",
      texts: [
        "Block my SIM card",
        "I lost my phone",
        "Disable my SIM",
        "My phone was stolen",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "request_esim",
      texts: [
        "Get an eSIM",
        "Request eSIM activation",
        "Switch to eSIM",
        "I want an eSIM",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "port_number",
      texts: [
        "Port my number",
        "Transfer my number from another provider",
        "Keep my old number",
        "Number portability",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "update_profile",
      texts: [
        "Update my profile",
        "Change my email",
        "Update my address",
        "Edit my account info",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "manage_family",
      texts: [
        "Add a family member",
        "Family plan management",
        "Manage my family account",
        "Add a line",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_contracts",
      texts: [
        "Show my contracts",
        "When does my contract end",
        "Contract details",
        "My agreement terms",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "loyalty_points",
      texts: [
        "Check my loyalty points",
        "Reward points balance",
        "How many points do I have",
        "Redeem my points",
      ],
      next: "report",
      confidence: "high",
    },
  ];
}

function bankingTools(): ToolScenario[] {
  return [
    {
      toolId: "check_account",
      texts: [
        "Check my account balance",
        "How much money do I have",
        "Account summary",
        "Show my balance",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "open_account",
      texts: [
        "Open a new account",
        "Create a savings account",
        "I want to open an account",
        "New account application",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "close_account",
      texts: [
        "Close my account",
        "I want to close my account",
        "Terminate my account",
        "Cancel my banking",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_statements",
      texts: [
        "Show my statements",
        "Bank statements",
        "Transaction history",
        "Account activity",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "transfer_funds",
      texts: [
        "Transfer money",
        "Send money to another account",
        "Wire transfer",
        "Move funds between accounts",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "schedule_transfer",
      texts: [
        "Schedule a transfer",
        "Set up recurring transfer",
        "Automatic payment",
        "Future dated transfer",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "international_transfer",
      texts: [
        "Send money abroad",
        "International wire transfer",
        "Transfer to another country",
        "Foreign currency transfer",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "block_card",
      texts: [
        "Block my card",
        "I lost my debit card",
        "Freeze my card",
        "My card was stolen",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "request_card",
      texts: [
        "Request a new card",
        "Replace my card",
        "I need a new debit card",
        "Order a replacement card",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "set_card_limits",
      texts: [
        "Change my card limit",
        "Set spending limit",
        "Increase my card limit",
        "ATM withdrawal limit",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_card_transactions",
      texts: [
        "Show my card transactions",
        "Recent card purchases",
        "Card activity",
        "What did I spend on my card",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "apply_loan",
      texts: [
        "Apply for a loan",
        "I need a personal loan",
        "Loan application",
        "How to get a loan",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "check_loan_status",
      texts: [
        "Check my loan status",
        "Loan application status",
        "Where is my loan request",
        "Has my loan been approved",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "calculate_installment",
      texts: [
        "Calculate loan installment",
        "Monthly payment calculator",
        "How much would I pay monthly",
        "Installment breakdown",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "setup_standing_order",
      texts: [
        "Set up a standing order",
        "Recurring payment",
        "Automatic bill payment",
        "Monthly debit order",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "manage_beneficiaries",
      texts: [
        "Add a beneficiary",
        "Manage my payees",
        "New transfer recipient",
        "Edit my beneficiary list",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "request_cheque_book",
      texts: [
        "Request a cheque book",
        "I need cheques",
        "Order chequebook",
        "Send me a cheque book",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "report_fraud",
      texts: [
        "Report fraud",
        "Suspicious activity on my account",
        "Unauthorized transaction",
        "Someone used my card",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "dispute_transaction",
      texts: [
        "Dispute a transaction",
        "Wrong amount charged",
        "I don't recognize this charge",
        "Charge back request",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "update_contact_info",
      texts: [
        "Update my contact info",
        "Change my phone number",
        "New email address",
        "Update my address",
      ],
      next: "await_input",
      confidence: "high",
    },
  ];
}

function healthcareTools(): ToolScenario[] {
  return [
    {
      toolId: "book_appointment",
      texts: [
        "Book an appointment",
        "Schedule a doctor visit",
        "I need to see a doctor",
        "Make an appointment",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "cancel_appointment",
      texts: [
        "Cancel my appointment",
        "I can't make my appointment",
        "Remove my booking",
        "Cancel the visit",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "reschedule_appointment",
      texts: [
        "Reschedule my appointment",
        "Change my appointment time",
        "Move my appointment",
        "Pick a new time",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "view_appointments",
      texts: [
        "Show my appointments",
        "Upcoming visits",
        "When is my next appointment",
        "My schedule",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "view_records",
      texts: [
        "Show my medical records",
        "Access my health records",
        "My patient file",
        "View my history",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "request_records",
      texts: [
        "Request my medical records",
        "Send me my records",
        "I need a copy of my file",
        "Export my health data",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "share_records",
      texts: [
        "Share my records with a doctor",
        "Send records to specialist",
        "Transfer my medical file",
        "Give my doctor access",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "update_medical_history",
      texts: [
        "Update my medical history",
        "Add an allergy",
        "Update my medications",
        "New medical condition",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "request_prescription",
      texts: [
        "Request a prescription",
        "I need a new prescription",
        "Prescribe medication",
        "Get a prescription refill",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "renew_prescription",
      texts: [
        "Renew my prescription",
        "Refill my medication",
        "I need more of my medicine",
        "Prescription renewal",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_medications",
      texts: [
        "Show my medications",
        "List my current medicines",
        "What am I taking",
        "My prescription list",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "order_lab_test",
      texts: [
        "Order a lab test",
        "I need blood work",
        "Schedule a blood test",
        "Lab work request",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "view_lab_results",
      texts: [
        "Show my lab results",
        "Blood test results",
        "My latest test results",
        "Lab report",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "request_imaging",
      texts: [
        "Request an X-ray",
        "I need an MRI",
        "Schedule imaging",
        "Radiology request",
      ],
      next: "confirm",
      confidence: "high",
    },
    {
      toolId: "check_coverage",
      texts: [
        "Check my insurance coverage",
        "What does my insurance cover",
        "Am I covered for this",
        "Insurance benefits",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "submit_claim",
      texts: [
        "Submit an insurance claim",
        "File a claim",
        "I want to claim this expense",
        "Insurance reimbursement",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "view_claims",
      texts: [
        "Show my claims",
        "Claim status",
        "My pending claims",
        "Insurance claim history",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "preauthorization",
      texts: [
        "Get preauthorization",
        "Pre-approve a procedure",
        "I need approval for surgery",
        "Authorization request",
      ],
      next: "await_input",
      confidence: "high",
    },
    {
      toolId: "find_provider",
      texts: [
        "Find a doctor near me",
        "Search for specialists",
        "Which hospitals are nearby",
        "Find a pharmacy",
      ],
      next: "report",
      confidence: "high",
    },
    {
      toolId: "emergency_info",
      texts: [
        "Emergency contacts",
        "Nearest emergency room",
        "I need emergency help",
        "Emergency numbers",
      ],
      next: "report",
      confidence: "high",
    },
  ];
}

function generateAgentCorpus(): Example[] {
  const examples: Example[] = [];
  let id = 0;

  const domains: Array<{
    name: string;
    domain: DomainDefinition;
    tools: ToolScenario[];
  }> = [
    { name: "telecom", domain: TELECOM_DOMAIN, tools: telecomTools() },
    { name: "banking", domain: BANKING_DOMAIN, tools: bankingTools() },
    { name: "healthcare", domain: HEALTHCARE_DOMAIN, tools: healthcareTools() },
  ];

  // Prefixes for variation (kept simple — no full sentences as LIT)
  const prefixes = [
    "",
    "please ",
    "I need to ",
    "can you ",
    "help me ",
    "I want to ",
    "I'd like to ",
  ];

  const timeSuffixes = [
    "",
    " now",
    " today",
    " tomorrow",
    " asap",
    " soon",
    " this week",
    " next week",
  ];

  for (const { name, domain, tools } of domains) {
    // Register domain tools in vocab
    const vocab = getVocabulary();
    for (const tool of domain.tools) vocab.addTool(tool.id);

    for (const scenario of tools) {
      for (const baseText of scenario.texts) {
        const isArabic = /^[\u0600-\u06FF]/.test(baseText);

        // For Arabic texts: just 3 time variations
        // For English: prefix × time (7 × 8 = 56 max, but dedup + skip LIT keeps it ~20-30)
        const usePrefixes = isArabic ? [""] : prefixes;
        const useTimes = isArabic ? ["", " الآن", " غداً"] : timeSuffixes;

        for (const prefix of usePrefixes) {
          for (const timeSuffix of useTimes) {
            const inputText = `${prefix}${baseText}${timeSuffix}`.trim();

            try {
              const token = encodeLocal(inputText);
              const inputSer = serializeInput(token);
              const rootData = ALL_ROOT_DATA.find(
                (r) => r.arabic === token.root,
              );

              // Build a CLEAN agent output: ACT + R + D + TOOL + NEXT + CONF
              // No STEP/REASON chains, no LIT in output
              const action = determineAction(token.intent, token.pattern);
              const outputTokens: string[] = [
                "<BOS>",
                `ACT:${action}`,
                `R:${token.root}`,
                `D:${rootData?.domain ?? "general"}`,
                `TOOL:${scenario.toolId}`,
                `NEXT:${scenario.next}`,
                `CONF:${scenario.confidence}`,
                "<EOS>",
              ];

              const outputIds = outputTokens.map((t) => {
                if (t.startsWith("TOOL:")) return vocab.addTool(t.slice(5));
                return vocab.encode(t);
              });

              // Skip if input has LIT tokens (keep agent data clean too)
              if (inputSer.tokens.some((t) => t.startsWith("LIT:"))) continue;

              examples.push({
                id: `agent-${name}-${String(id).padStart(5, "0")}`,
                input_text: inputText,
                input_tokens: inputSer.tokens,
                input_ids: inputSer.ids,
                output_tokens: outputTokens,
                output_ids: outputIds,
                domain: rootData?.domain ?? "general",
                source: `agent-${name}`,
                tools: [scenario.toolId],
                next_step: scenario.next,
              });
              id++;
            } catch {
              continue;
            }
          }
        }
      }
    }
  }

  return examples;
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
// PHASE 3: MULTI-STEP CHAIN CORPUS (~2K)
// ═══════════════════════════════════════════════════════════════════════════

interface ChainTemplate {
  text: string;
  steps: Array<{ toolId: string; reason: string }>;
  domain: string;
  finalNext: NextStep;
}

function telecomChains(): ChainTemplate[] {
  return [
    {
      text: "Check my balance and pay my bill",
      steps: [
        { toolId: "check_balance", reason: "billing" },
        { toolId: "pay_bill", reason: "billing" },
      ],
      domain: "telecom",
      finalNext: "confirm",
    },
    {
      text: "Check my usage and upgrade my plan",
      steps: [
        { toolId: "view_usage", reason: "account" },
        { toolId: "change_plan", reason: "account" },
      ],
      domain: "telecom",
      finalNext: "confirm",
    },
    {
      text: "Block my SIM and request an eSIM",
      steps: [
        { toolId: "block_sim", reason: "security" },
        { toolId: "request_esim", reason: "device" },
      ],
      domain: "telecom",
      finalNext: "confirm",
    },
    {
      text: "Report an outage and open a support ticket",
      steps: [
        { toolId: "report_outage", reason: "technical" },
        { toolId: "open_ticket", reason: "followup" },
      ],
      domain: "telecom",
      finalNext: "await_input",
    },
    {
      text: "Reset my router and run a speed test",
      steps: [
        { toolId: "reset_router", reason: "technical" },
        { toolId: "speed_test", reason: "technical" },
      ],
      domain: "telecom",
      finalNext: "report",
    },
    {
      text: "Check my balance, pay the bill, and view my plan",
      steps: [
        { toolId: "check_balance", reason: "billing" },
        { toolId: "pay_bill", reason: "billing" },
        { toolId: "view_plan", reason: "account" },
      ],
      domain: "telecom",
      finalNext: "report",
    },
    {
      text: "Activate roaming and check coverage",
      steps: [
        { toolId: "activate_roaming", reason: "services" },
        { toolId: "check_coverage", reason: "technical" },
      ],
      domain: "telecom",
      finalNext: "report",
    },
    {
      text: "View my contracts and check loyalty points",
      steps: [
        { toolId: "view_contracts", reason: "account" },
        { toolId: "loyalty_points", reason: "account" },
      ],
      domain: "telecom",
      finalNext: "report",
    },
    {
      text: "Update my profile and manage family plan",
      steps: [
        { toolId: "update_profile", reason: "account" },
        { toolId: "manage_family", reason: "account" },
      ],
      domain: "telecom",
      finalNext: "confirm",
    },
    {
      text: "View my bills, dispute a charge, and talk to an agent",
      steps: [
        { toolId: "billing_history", reason: "billing" },
        { toolId: "dispute_charge", reason: "billing" },
        { toolId: "transfer_agent", reason: "escalate" },
      ],
      domain: "telecom",
      finalNext: "escalate",
    },
  ];
}

function bankingChains(): ChainTemplate[] {
  return [
    {
      text: "Check my balance and transfer money",
      steps: [
        { toolId: "check_account", reason: "account" },
        { toolId: "transfer_funds", reason: "transfers" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Block my card and request a new one",
      steps: [
        { toolId: "block_card", reason: "security" },
        { toolId: "request_card", reason: "cards" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "View my statements and set up a standing order",
      steps: [
        { toolId: "view_statements", reason: "account" },
        { toolId: "setup_standing_order", reason: "transfers" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Apply for a loan and calculate the installment",
      steps: [
        { toolId: "apply_loan", reason: "loans" },
        { toolId: "calculate_installment", reason: "loans" },
      ],
      domain: "banking",
      finalNext: "report",
    },
    {
      text: "Report fraud and block my card",
      steps: [
        { toolId: "report_fraud", reason: "security" },
        { toolId: "block_card", reason: "security" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Check my account, view transactions, and transfer funds",
      steps: [
        { toolId: "check_account", reason: "account" },
        { toolId: "view_card_transactions", reason: "cards" },
        { toolId: "transfer_funds", reason: "transfers" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Add a beneficiary and schedule a transfer",
      steps: [
        { toolId: "manage_beneficiaries", reason: "transfers" },
        { toolId: "schedule_transfer", reason: "transfers" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Check loan status and view statements",
      steps: [
        { toolId: "check_loan_status", reason: "loans" },
        { toolId: "view_statements", reason: "account" },
      ],
      domain: "banking",
      finalNext: "report",
    },
    {
      text: "Set card limits and update my contact info",
      steps: [
        { toolId: "set_card_limits", reason: "cards" },
        { toolId: "update_contact_info", reason: "account" },
      ],
      domain: "banking",
      finalNext: "confirm",
    },
    {
      text: "Dispute a transaction, view statements, and report fraud",
      steps: [
        { toolId: "dispute_transaction", reason: "security" },
        { toolId: "view_statements", reason: "account" },
        { toolId: "report_fraud", reason: "security" },
      ],
      domain: "banking",
      finalNext: "await_input",
    },
  ];
}

function healthcareChains(): ChainTemplate[] {
  return [
    {
      text: "Book an appointment and check my insurance coverage",
      steps: [
        { toolId: "book_appointment", reason: "appointments" },
        { toolId: "check_coverage", reason: "insurance" },
      ],
      domain: "healthcare",
      finalNext: "report",
    },
    {
      text: "View my records and request a prescription",
      steps: [
        { toolId: "view_records", reason: "records" },
        { toolId: "request_prescription", reason: "medications" },
      ],
      domain: "healthcare",
      finalNext: "confirm",
    },
    {
      text: "Order lab tests and schedule an appointment",
      steps: [
        { toolId: "order_lab_test", reason: "clinical" },
        { toolId: "book_appointment", reason: "appointments" },
      ],
      domain: "healthcare",
      finalNext: "await_input",
    },
    {
      text: "Reschedule my appointment and share records with doctor",
      steps: [
        { toolId: "reschedule_appointment", reason: "appointments" },
        { toolId: "share_records", reason: "records" },
      ],
      domain: "healthcare",
      finalNext: "confirm",
    },
    {
      text: "Renew my prescription and check insurance coverage",
      steps: [
        { toolId: "renew_prescription", reason: "medications" },
        { toolId: "check_coverage", reason: "insurance" },
      ],
      domain: "healthcare",
      finalNext: "report",
    },
    {
      text: "View lab results, update medical history, and book follow-up",
      steps: [
        { toolId: "view_lab_results", reason: "clinical" },
        { toolId: "update_medical_history", reason: "records" },
        { toolId: "book_appointment", reason: "appointments" },
      ],
      domain: "healthcare",
      finalNext: "await_input",
    },
    {
      text: "Get preauthorization and submit a claim",
      steps: [
        { toolId: "preauthorization", reason: "insurance" },
        { toolId: "submit_claim", reason: "insurance" },
      ],
      domain: "healthcare",
      finalNext: "await_input",
    },
    {
      text: "Find a doctor and book an appointment",
      steps: [
        { toolId: "find_provider", reason: "general" },
        { toolId: "book_appointment", reason: "appointments" },
      ],
      domain: "healthcare",
      finalNext: "await_input",
    },
    {
      text: "Cancel appointment and request records",
      steps: [
        { toolId: "cancel_appointment", reason: "appointments" },
        { toolId: "request_records", reason: "records" },
      ],
      domain: "healthcare",
      finalNext: "confirm",
    },
    {
      text: "View medications, renew prescription, and view claims",
      steps: [
        { toolId: "view_medications", reason: "medications" },
        { toolId: "renew_prescription", reason: "medications" },
        { toolId: "view_claims", reason: "insurance" },
      ],
      domain: "healthcare",
      finalNext: "report",
    },
  ];
}

function generateChainCorpus(): Example[] {
  const examples: Example[] = [];
  let id = 0;
  const vocab = getVocabulary();

  const allChains = [
    ...telecomChains(),
    ...bankingChains(),
    ...healthcareChains(),
  ];

  // Prefixes × time suffixes for variation
  const prefixes = [
    "",
    "please ",
    "I need to ",
    "can you ",
    "help me ",
    "I want to ",
  ];
  const timeSuffixes = [
    "",
    " now",
    " today",
    " tomorrow",
    " asap",
    " this week",
    " next week",
  ];

  for (const chain of allChains) {
    for (const prefix of prefixes) {
      for (const timeSuffix of timeSuffixes) {
        const inputText = `${prefix}${chain.text}${timeSuffix}`.trim();

        try {
          const token = encodeLocal(inputText);
          const inputSer = serializeInput(token);
          if (inputSer.tokens.some((t) => t.startsWith("LIT:"))) continue;

          // Build chained output: ACT + R + D + STEP:1 TOOL:x REASON:y + STEP:2 TOOL:z REASON:w + ... + NEXT + CONF
          const rootData = ALL_ROOT_DATA.find((r) => r.arabic === token.root);
          const action = determineAction(token.intent, token.pattern);

          const outputTokens: string[] = [
            "<BOS>",
            `ACT:${action}`,
            `R:${token.root}`,
            `D:${rootData?.domain ?? chain.domain}`,
          ];

          for (let i = 0; i < chain.steps.length; i++) {
            outputTokens.push(`STEP:${i + 1}`);
            outputTokens.push(`TOOL:${chain.steps[i].toolId}`);
            outputTokens.push(`REASON:${chain.steps[i].reason}`);
          }

          outputTokens.push(`NEXT:${chain.finalNext}`);
          outputTokens.push("CONF:high");
          outputTokens.push("<EOS>");

          const outputIds = outputTokens.map((t) => {
            if (t.startsWith("TOOL:")) return vocab.addTool(t.slice(5));
            return vocab.encode(t);
          });

          examples.push({
            id: `chain-${String(id).padStart(5, "0")}`,
            input_text: inputText,
            input_tokens: inputSer.tokens,
            input_ids: inputSer.ids,
            output_tokens: outputTokens,
            output_ids: outputIds,
            domain: rootData?.domain ?? chain.domain,
            source: "chain",
            tools: chain.steps.map((s) => s.toolId),
            next_step: chain.finalNext,
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

console.log("Arabic Algebra — Clean Dataset Generator v3\n");

// Phase 1
console.log("Phase 1: General corpus...");
const general = generateGeneralCorpus();
console.log(`  Generated: ${general.length} examples`);

// Phase 2
console.log("\nPhase 2: Agent corpus...");
const agent = generateAgentCorpus();
console.log(`  Generated: ${agent.length} examples`);

// Phase 3
console.log("\nPhase 3: Chain corpus (multi-step)...");
const chains = generateChainCorpus();
console.log(`  Generated: ${chains.length} examples`);

// Combine
const allExamples = shuffle([...general, ...agent, ...chains]);
console.log(`\nTotal: ${allExamples.length} examples`);

// Validate: check for any LIT tokens
const litCount = allExamples.filter(
  (ex) =>
    ex.input_tokens.some((t) => t.startsWith("LIT:")) ||
    ex.output_tokens.some((t) => t.startsWith("LIT:")),
).length;
console.log(`Examples with LIT: tokens: ${litCount} (should be 0)`);

// Check unique tokens used
const usedTokens = new Set<string>();
for (const ex of allExamples) {
  for (const t of ex.input_tokens) usedTokens.add(t);
  for (const t of ex.output_tokens) usedTokens.add(t);
}
console.log(`Unique tokens used: ${usedTokens.size}`);

// Stats
const bySource: Record<string, number> = {};
const byDomain: Record<string, number> = {};
const toolCounts: Record<string, number> = {};
for (const ex of allExamples) {
  bySource[ex.source] = (bySource[ex.source] ?? 0) + 1;
  byDomain[ex.domain] = (byDomain[ex.domain] ?? 0) + 1;
  if (ex.tools) {
    for (const t of ex.tools) toolCounts[t] = (toolCounts[t] ?? 0) + 1;
  }
}
console.log("\nBy source:", bySource);
console.log("\nBy domain (top 10):");
const domainEntries = Object.entries(byDomain).sort((a, b) => b[1] - a[1]);
for (const [d, c] of domainEntries.slice(0, 10)) {
  console.log(`  ${d}: ${c}`);
}

if (Object.keys(toolCounts).length > 0) {
  console.log("\nTool distribution:");
  for (const [tool, count] of Object.entries(toolCounts).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${tool}: ${count}`);
  }
}

// Write JSONL
const jsonlPath = join(OUT_DIR, "train-v3.jsonl");
const lines = allExamples.map((ex) => JSON.stringify(ex));
writeFileSync(jsonlPath, lines.join("\n") + "\n", "utf-8");
console.log(`\nWritten: ${jsonlPath}`);

// Write vocabulary (with all TOOL tokens registered)
const vocab = getVocabulary();
const vocabData = {
  vocab: vocab.toJSON(),
  stats: vocab.stats(),
  size: vocab.size,
};
const vocabPath = join(OUT_DIR, "vocabulary-v3.json");
writeFileSync(vocabPath, JSON.stringify(vocabData, null, 2), "utf-8");
console.log(`Written: ${vocabPath} (${vocab.size} tokens)`);

// Verify: every token in the data exists in the vocabulary
let missing = 0;
for (const tok of usedTokens) {
  if (!vocab.has(tok)) {
    console.log(`  WARNING: token not in vocab: ${tok}`);
    missing++;
  }
}
if (missing === 0) {
  console.log("\n✓ All tokens in data exist in vocabulary (zero UNK risk)");
} else {
  console.log(`\n✗ ${missing} tokens missing from vocabulary!`);
}

console.log("\nDone!");
