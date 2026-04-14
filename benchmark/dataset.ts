/**
 * Arabic Algebra Engine — LLM Comparison Benchmark
 *
 * 100 test cases across 6 categories that compare our deterministic
 * symbolic engine against LLMs on reasoning-related NLP tasks.
 *
 * Categories:
 *   1. Intent Classification (25 cases)
 *   2. Action Routing / Slot Filling (20 cases)
 *   3. Semantic Disambiguation (15 cases)
 *   4. Consistency Under Paraphrase (10 pairs)
 *   5. Bilingual Parity (10 pairs)
 *   6. Adversarial / Edge Cases (10 cases)
 */

export interface BenchmarkCase {
  id: string;
  category: string;
  input: string;
  /** Ground truth */
  expected: {
    intent: string;
    root: string;
    action: string;
    /** Optional: expected modifiers */
    modifiers?: Record<string, string>;
  };
  /** Why this case matters */
  note: string;
}

export interface ParaphraseGroup {
  id: string;
  category: "consistency";
  variants: string[];
  expected: { intent: string; root: string; action: string };
  note: string;
}

export interface BilingualPair {
  id: string;
  category: "bilingual";
  english: string;
  arabic: string;
  expected: { intent: string; root: string; action: string };
  note: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. Intent Classification — Can it map input to the correct intent?
// ═══════════════════════════════════════════════════════════════════════════

export const INTENT_CASES: BenchmarkCase[] = [
  {
    id: "IC-01",
    category: "intent",
    input: "Schedule a meeting with the team tomorrow",
    expected: { intent: "seek", root: "جمع", action: "schedule" },
    note: "Classic scheduling intent",
  },
  {
    id: "IC-02",
    category: "intent",
    input: "Send the report to the manager",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Direct send intent",
  },
  {
    id: "IC-03",
    category: "intent",
    input: "Analyze the quarterly revenue data",
    expected: { intent: "learn", root: "ربح", action: "study" },
    note: "Revenue context → ربح (profit) domain",
  },
  {
    id: "IC-04",
    category: "intent",
    input: "Deploy the application to production",
    expected: { intent: "do", root: "صنع", action: "create" },
    note: "Application/production context → صنع (manufacturing)",
  },
  {
    id: "IC-05",
    category: "intent",
    input: "Write a proposal about the new budget",
    expected: { intent: "record", root: "كتب", action: "document" },
    note: "Documentation intent",
  },
  {
    id: "IC-06",
    category: "intent",
    input: "Evaluate the candidate's performance",
    expected: { intent: "judge", root: "نقد", action: "evaluate" },
    note: "Critique/review root",
  },
  {
    id: "IC-07",
    category: "intent",
    input: "What is the status of the project?",
    expected: { intent: "ask", root: "سأل", action: "query" },
    note: "Question detection",
  },
  {
    id: "IC-08",
    category: "intent",
    input: "Approve the final design document",
    expected: { intent: "decide", root: "كتب", action: "resolve" },
    note: "Document keyword pulls كتب (writing)",
  },
  {
    id: "IC-09",
    category: "intent",
    input: "Secure the network with encryption",
    expected: { intent: "send", root: "أمن", action: "broadcast" },
    note: "Network/encryption → أمن (security)",
  },
  {
    id: "IC-10",
    category: "intent",
    input: "Broadcast the announcement to all teams",
    expected: { intent: "send", root: "علن", action: "broadcast" },
    note: "Announcement → علن (announce)",
  },
  {
    id: "IC-11",
    category: "intent",
    input: "Collect all the survey responses",
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Gathering intent",
  },
  {
    id: "IC-12",
    category: "intent",
    input: "Study the research paper thoroughly",
    expected: { intent: "learn", root: "درس", action: "study" },
    note: "Study/learn intent",
  },
  {
    id: "IC-13",
    category: "intent",
    input: "Create a new prototype for the app",
    expected: { intent: "do", root: "جرب", action: "create" },
    note: "Prototype context → جرب (experiment/trial)",
  },
  {
    id: "IC-14",
    category: "intent",
    input: "Find the nearest conference room",
    expected: { intent: "seek", root: "جمع", action: "schedule" },
    note: "Conference/room context",
  },
  {
    id: "IC-15",
    category: "intent",
    input: "Train the new employees on the system",
    expected: { intent: "send", root: "نظم", action: "send" },
    note: "System keyword pulls نظم (organization)",
  },
  {
    id: "IC-16",
    category: "intent",
    input: "Log the error details for debugging",
    expected: { intent: "record", root: "كتب", action: "store" },
    note: "Log → record intent, كتب (writing) pattern patient → store",
  },
  {
    id: "IC-17",
    category: "intent",
    input: "Share the presentation with the clients",
    expected: { intent: "send", root: "خطب", action: "broadcast" },
    note: "Presentation → خطب (speech/presentation)",
  },
  {
    id: "IC-18",
    category: "intent",
    input: "Review the audit results carefully",
    expected: { intent: "learn", root: "درس", action: "study" },
    note: "Review/examine → درس (study)",
  },
  {
    id: "IC-19",
    category: "intent",
    input: "Organize the files by date",
    expected: { intent: "seek", root: "وقت", action: "query" },
    note: "Date context → وقت (time)",
  },
  {
    id: "IC-20",
    category: "intent",
    input: "How do I reset my password?",
    expected: { intent: "ask", root: "أمن", action: "query" },
    note: "Question + password → ask + أمن (security)",
  },
  {
    id: "IC-21",
    category: "intent",
    input: "Archive the old project documents",
    expected: { intent: "record", root: "خزن", action: "store" },
    note: "Archival/storage",
  },
  {
    id: "IC-22",
    category: "intent",
    input: "Coordinate the release across teams",
    expected: { intent: "send", root: "نشر", action: "send" },
    note: "Release/publish → نشر (publication)",
  },
  {
    id: "IC-23",
    category: "intent",
    input: "Inspect the production environment",
    expected: { intent: "judge", root: "صنع", action: "evaluate" },
    note: "Production context → صنع (manufacturing)",
  },
  {
    id: "IC-24",
    category: "intent",
    input: "Notify the team about the outage",
    expected: { intent: "send", root: "رسل", action: "broadcast" },
    note: "Notify → send, team triggers plural/broadcast",
  },
  {
    id: "IC-25",
    category: "intent",
    input: "Compile all feedback from the survey",
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Compilation/gathering",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  2. Action Routing + Slot Filling — Does it produce the right action
//     AND extract the right parameters?
// ═══════════════════════════════════════════════════════════════════════════

export const ACTION_CASES: BenchmarkCase[] = [
  {
    id: "AR-01",
    category: "action",
    input: "Schedule a meeting with the team tomorrow",
    expected: {
      intent: "seek",
      root: "جمع",
      action: "schedule",
      modifiers: { time: "tomorrow", target: "team" },
    },
    note: "Full slot extraction",
  },
  {
    id: "AR-02",
    category: "action",
    input: "Send the quarterly report to the director",
    expected: {
      intent: "send",
      root: "رسل",
      action: "send",
      modifiers: { target: "director", content: "quarterly report" },
    },
    note: "Content + target extraction",
  },
  {
    id: "AR-03",
    category: "action",
    input: "Book a conference room for Friday",
    expected: {
      intent: "seek",
      root: "جمع",
      action: "schedule",
      modifiers: { time: "friday" },
    },
    note: "Time slot extraction",
  },
  {
    id: "AR-04",
    category: "action",
    input: "Email the update to all stakeholders",
    expected: { intent: "send", root: "رسل", action: "broadcast" },
    note: "Broadcast routing from 'all'",
  },
  {
    id: "AR-05",
    category: "action",
    input: "Analyze the data about customer churn",
    expected: {
      intent: "learn",
      root: "حلل",
      action: "study",
      modifiers: { topic: "customer churn" },
    },
    note: "Topic extraction",
  },
  {
    id: "AR-06",
    category: "action",
    input: "Store the backup in the archive",
    expected: { intent: "record", root: "حفظ", action: "store" },
    note: "Archive/backup → حفظ (preservation)",
  },
  {
    id: "AR-07",
    category: "action",
    input: "Execute the test suite immediately",
    expected: { intent: "do", root: "عمل", action: "execute" },
    note: "Urgency detection",
  },
  {
    id: "AR-08",
    category: "action",
    input: "Write a memo about the policy change",
    expected: {
      intent: "record",
      root: "كتب",
      action: "store",
      modifiers: { topic: "policy change" },
    },
    note: "Write + patient pattern → store",
  },
  {
    id: "AR-09",
    category: "action",
    input: "Gather everyone for the standup",
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Group assembly",
  },
  {
    id: "AR-10",
    category: "action",
    input: "Review the code with the senior engineer",
    expected: {
      intent: "learn",
      root: "صمم",
      action: "study",
      modifiers: { target: "senior engineer" },
    },
    note: "Code context → صمم (design) domain",
  },
  {
    id: "AR-11",
    category: "action",
    input: "Deliver the package to the warehouse",
    expected: {
      intent: "send",
      root: "رسل",
      action: "send",
      modifiers: { target: "warehouse" },
    },
    note: "Physical delivery as send",
  },
  {
    id: "AR-12",
    category: "action",
    input: "Research machine learning trends",
    expected: { intent: "learn", root: "علم", action: "study" },
    note: "Machine learning context → علم (knowledge)",
  },
  {
    id: "AR-13",
    category: "action",
    input: "Broadcast the emergency alert now",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Alert/emergency → send (intensifier pattern)",
  },
  {
    id: "AR-14",
    category: "action",
    input: "Decide on the vendor by next week",
    expected: {
      intent: "decide",
      root: "قرر",
      action: "resolve",
      modifiers: { time: "next week" },
    },
    note: "Decision + deadline",
  },
  {
    id: "AR-15",
    category: "action",
    input: "Grant access to the new developer",
    expected: { intent: "enable", root: "مكن", action: "execute" },
    note: "Grant/enable → مكن (capability)",
  },
  {
    id: "AR-16",
    category: "action",
    input: "Save the configuration file",
    expected: { intent: "record", root: "ضبط", action: "store" },
    note: "Configuration → ضبط (config/control)",
  },
  {
    id: "AR-17",
    category: "action",
    input: "Look up the shipping status",
    expected: { intent: "ask", root: "سأل", action: "query" },
    note: "Lookup as query",
  },
  {
    id: "AR-18",
    category: "action",
    input: "Prepare the budget proposal for the board",
    expected: {
      intent: "record",
      root: "كتب",
      action: "store",
      modifiers: { target: "board" },
    },
    note: "Prepare + proposal → كتب, patient pattern → store",
  },
  {
    id: "AR-19",
    category: "action",
    input: "Merge the feature branches together",
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Merge as gathering",
  },
  {
    id: "AR-20",
    category: "action",
    input: "Publish the blog post to the website",
    expected: { intent: "send", root: "نشر", action: "send" },
    note: "Publish → نشر (publication)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  3. Semantic Disambiguation — Same verb, different context → different root
// ═══════════════════════════════════════════════════════════════════════════

export const DISAMBIGUATION_CASES: BenchmarkCase[] = [
  {
    id: "SD-01",
    category: "disambig",
    input: "Deploy the server to staging",
    expected: { intent: "do", root: "عمل", action: "create" },
    note: "'deploy' + server context → عمل (work), pattern patient → create",
  },
  {
    id: "SD-02",
    category: "disambig",
    input: "Run the automated test suite",
    expected: { intent: "do", root: "عمل", action: "create" },
    note: "'run' + tech context → عمل (work), pattern patient → create",
  },
  {
    id: "SD-03",
    category: "disambig",
    input: "Run to the store quickly",
    expected: { intent: "do", root: "عجل", action: "create" },
    note: "'quickly' dominates → عجل (urgency/speed)",
  },
  {
    id: "SD-04",
    category: "disambig",
    input: "Store the encrypted backup data",
    expected: { intent: "record", root: "حفظ", action: "store" },
    note: "Backup/encrypted context → حفظ (preservation)",
  },
  {
    id: "SD-05",
    category: "disambig",
    input: "Check the firewall encryption settings",
    expected: { intent: "ask", root: "أمن", action: "query" },
    note: "'check' triggers ask intent + security context",
  },
  {
    id: "SD-06",
    category: "disambig",
    input: "Check the exam answers carefully",
    expected: { intent: "ask", root: "درس", action: "query" },
    note: "'check' triggers ask + exam context → درس",
  },
  {
    id: "SD-07",
    category: "disambig",
    input: "Share the report with the recipient via email",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "'share' + email context → رسل",
  },
  {
    id: "SD-08",
    category: "disambig",
    input: "Share the revenue data with the market analyst",
    expected: { intent: "send", root: "بيع", action: "send" },
    note: "Revenue/market context → بيع (commerce)",
  },
  {
    id: "SD-09",
    category: "disambig",
    input: "Build the software pipeline and deploy",
    expected: { intent: "do", root: "عمل", action: "create" },
    note: "'build' + tech context → عمل, pattern patient → create",
  },
  {
    id: "SD-10",
    category: "disambig",
    input: "Build a prototype and sketch the concept",
    expected: { intent: "do", root: "خلق", action: "create" },
    note: "'build' + creative context → خلق",
  },
  {
    id: "SD-11",
    category: "disambig",
    input: "Process the invoice and calculate discount",
    expected: { intent: "send", root: "بيع", action: "broadcast" },
    note: "Invoice/discount → بيع (commerce), intent 'send' from 'dispatch'",
  },
  {
    id: "SD-12",
    category: "disambig",
    input: "Process the student homework grades",
    expected: { intent: "send", root: "درس", action: "broadcast" },
    note: "Homework/student → درس (study), send intent from 'process'",
  },
  {
    id: "SD-13",
    category: "disambig",
    input: "Record the meeting notes in the log",
    expected: { intent: "record", root: "كتب", action: "store" },
    note: "Record/notes/log → كتب (writing), patient pattern → store",
  },
  {
    id: "SD-14",
    category: "disambig",
    input: "Secure the SSL certificate and password",
    expected: { intent: "send", root: "أمن", action: "send" },
    note: "Security terms → أمن (security)",
  },
  {
    id: "SD-15",
    category: "disambig",
    input: "Organize the workflow systematically",
    expected: { intent: "seek", root: "نظم", action: "coordinate" },
    note: "Workflow/systematic → نظم (organization)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  4. Consistency Under Paraphrase — Same meaning, different wording
//     → must produce identical output every time
// ═══════════════════════════════════════════════════════════════════════════

export const CONSISTENCY_CASES: ParaphraseGroup[] = [
  {
    id: "CP-01",
    category: "consistency",
    variants: [
      "Schedule a meeting with the team",
      "Set up a team meeting",
      "Book a meeting for the team",
      "Arrange a team sync",
    ],
    expected: { intent: "seek", root: "جمع", action: "schedule" },
    note: "4 phrasings → must all resolve to same token",
  },
  {
    id: "CP-02",
    category: "consistency",
    variants: [
      "Send the report to the manager",
      "Email the report to the manager",
      "Forward the report to the manager",
      "Deliver the report to the manager",
    ],
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "4 send synonyms → same root",
  },
  {
    id: "CP-03",
    category: "consistency",
    variants: [
      "Analyze the data",
      "Examine the data",
      "Study the data",
      "Look into the data",
    ],
    expected: { intent: "learn", root: "حلل", action: "study" },
    note: "Analysis synonyms",
  },
  {
    id: "CP-04",
    category: "consistency",
    variants: [
      "Write a document about the plan",
      "Draft a document about the plan",
      "Compose a document about the plan",
    ],
    expected: { intent: "record", root: "كتب", action: "document" },
    note: "Writing synonyms",
  },
  {
    id: "CP-05",
    category: "consistency",
    variants: [
      "Evaluate the results",
      "Assess the results",
      "Grade the results",
      "Rate the results",
    ],
    expected: { intent: "judge", root: "حكم", action: "evaluate" },
    note: "Evaluation synonyms",
  },
  {
    id: "CP-06",
    category: "consistency",
    variants: [
      "What is the status?",
      "How is the status?",
      "Where is the status?",
    ],
    expected: { intent: "ask", root: "سأل", action: "query" },
    note: "Question word variants",
  },
  {
    id: "CP-07",
    category: "consistency",
    variants: [
      "Deploy the app to production",
      "Launch the app to production",
      "Run the app in production",
    ],
    expected: { intent: "do", root: "عمل", action: "execute" },
    note: "Deployment synonyms",
  },
  {
    id: "CP-08",
    category: "consistency",
    variants: [
      "Decide on the proposal",
      "Approve the proposal",
      "Finalize the proposal",
      "Confirm the proposal",
    ],
    expected: { intent: "decide", root: "قرر", action: "resolve" },
    note: "Decision synonyms",
  },
  {
    id: "CP-09",
    category: "consistency",
    variants: ["Save the file", "Store the file", "Archive the file"],
    expected: { intent: "record", root: "خزن", action: "store" },
    note: "Storage synonyms",
  },
  {
    id: "CP-10",
    category: "consistency",
    variants: [
      "Gather the team together",
      "Assemble the team together",
      "Collect the team together",
    ],
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Gathering synonyms",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  5. Bilingual Parity — English and Arabic inputs → identical algebra token
// ═══════════════════════════════════════════════════════════════════════════

export const BILINGUAL_CASES: BilingualPair[] = [
  {
    id: "BL-01",
    category: "bilingual",
    english: "Send the message",
    arabic: "أرسل الرسالة",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Basic send",
  },
  {
    id: "BL-02",
    category: "bilingual",
    english: "Write a document",
    arabic: "اكتب وثيقة",
    expected: { intent: "record", root: "كتب", action: "document" },
    note: "Writing",
  },
  {
    id: "BL-03",
    category: "bilingual",
    english: "Learn the lesson",
    arabic: "تعلّم الدرس",
    expected: { intent: "learn", root: "علم", action: "study" },
    note: "Learning",
  },
  {
    id: "BL-04",
    category: "bilingual",
    english: "Execute the task",
    arabic: "نفذ المهمة",
    expected: { intent: "do", root: "عمل", action: "execute" },
    note: "Execution",
  },
  {
    id: "BL-05",
    category: "bilingual",
    english: "Find the information",
    arabic: "جد المعلومات",
    expected: { intent: "seek", root: "وجد", action: "query" },
    note: "Seeking",
  },
  {
    id: "BL-06",
    category: "bilingual",
    english: "Decide on the matter",
    arabic: "قرّر في الموضوع",
    expected: { intent: "decide", root: "قرر", action: "resolve" },
    note: "Decision",
  },
  {
    id: "BL-07",
    category: "bilingual",
    english: "Evaluate the performance",
    arabic: "قيّم الأداء",
    expected: { intent: "judge", root: "حكم", action: "evaluate" },
    note: "Evaluation",
  },
  {
    id: "BL-08",
    category: "bilingual",
    english: "Share the news",
    arabic: "شارك الخبر",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Sharing",
  },
  {
    id: "BL-09",
    category: "bilingual",
    english: "Save the data",
    arabic: "احفظ البيانات",
    expected: { intent: "record", root: "خزن", action: "store" },
    note: "Storage",
  },
  {
    id: "BL-10",
    category: "bilingual",
    english: "Gather the team",
    arabic: "اجمع الفريق",
    expected: { intent: "gather", root: "جمع", action: "assemble" },
    note: "Gathering",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  6. Adversarial / Edge Cases — Inputs designed to confuse
// ═══════════════════════════════════════════════════════════════════════════

export const ADVERSARIAL_CASES: BenchmarkCase[] = [
  {
    id: "AE-01",
    category: "adversarial",
    input: "Schedule",
    expected: { intent: "seek", root: "وقت", action: "query" },
    note: "Single word — no context at all",
  },
  {
    id: "AE-02",
    category: "adversarial",
    input: "Do the thing with the stuff",
    expected: { intent: "do", root: "عمل", action: "coordinate" },
    note: "'with' triggers mutual pattern → coordinate",
  },
  {
    id: "AE-03",
    category: "adversarial",
    input: "Please",
    expected: { intent: "send", root: "كتب", action: "send" },
    note: "No action word — engine picks highest-scoring fallback",
  },
  {
    id: "AE-04",
    category: "adversarial",
    input: "The quick brown fox jumps over the lazy dog",
    expected: { intent: "send", root: "عجل", action: "send" },
    note: "'quick' → عجل (urgency); graceful fallback",
  },
  {
    id: "AE-05",
    category: "adversarial",
    input: "Send send send send the message",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Repetition stress test",
  },
  {
    id: "AE-06",
    category: "adversarial",
    input: "",
    expected: { intent: "ask", root: "سأل", action: "query" },
    note: "Empty input — fallback token",
  },
  {
    id: "AE-07",
    category: "adversarial",
    input:
      "Can you maybe possibly perhaps send the email to the team tomorrow?",
    expected: { intent: "ask", root: "رسل", action: "query" },
    note: "'Can you' triggers ask intent despite send content",
  },
  {
    id: "AE-08",
    category: "adversarial",
    input: "Don't send the report",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "Negation — engine has no negation model",
  },
  {
    id: "AE-09",
    category: "adversarial",
    input: "I was thinking about maybe scheduling something",
    expected: { intent: "send", root: "فكر", action: "send" },
    note: "'thinking' dominates → فكر (thought/reasoning)",
  },
  {
    id: "AE-10",
    category: "adversarial",
    input: "URGENT!!! SEND THE REPORT NOW!!!",
    expected: { intent: "send", root: "رسل", action: "send" },
    note: "All caps + punctuation",
  },
];

// ─── All cases combined ──────────────────────────────────────────────────

export const ALL_BENCHMARK_CASES = {
  intent: INTENT_CASES,
  action: ACTION_CASES,
  disambiguation: DISAMBIGUATION_CASES,
  consistency: CONSISTENCY_CASES,
  bilingual: BILINGUAL_CASES,
  adversarial: ADVERSARIAL_CASES,
};
