/**
 * Arabic Algebra — Chat Interface
 *
 * Two modes:
 *   1. Symbolic Engine — deterministic keyword rules (like the PoC)
 *   2. Model (1.5M) — ONNX model inference in browser
 *
 * Both produce the same output format: algebra token → tool → result
 */

import { encodeLocal, engine, compactToken } from "./engine-bridge";
import { initTheme, renderNav, initBackground, esc } from "./shared";
import { decompose } from "@engine/agent/decomposer.js";
import type { AlgebraToken } from "@engine/core/types.js";
import * as ort from "onnxruntime-web";

// Configure ONNX Runtime WASM — single-threaded to avoid SharedArrayBuffer requirement
ort.env.wasm.numThreads = 1;

// ─── Types ─────────────────────────────────────────────────────────────────

interface ToolRoute {
  toolId: string;
  toolName: string;
  next: string;
  confidence: "high" | "medium" | "low";
}

interface StepResult {
  step: number;
  text: string;
  algebra: string;
  action: string;
  actionConf: number;
  route: ToolRoute;
  result: Record<string, string>;
  latencyMs: number;
}

interface ChatResult {
  mode: "symbolic" | "model";
  steps: StepResult[];
  totalMs: number;
}

// ─── Tool routing rules (symbolic) ────────────────────────────────────────

const TOOL_RULES: Array<{
  match: (text: string) => boolean;
  toolId: string;
  toolName: string;
  next: string;
}> = [
  {
    match: (t) => /balance|رصيد/.test(t),
    toolId: "check_balance",
    toolName: "Check Balance",
    next: "report",
  },
  {
    match: (t) => /pay|دفع|payment|فاتور/.test(t),
    toolId: "pay_bill",
    toolName: "Pay Bill",
    next: "confirm",
  },
  {
    match: (t) => /bill.*history|previous.*bill|invoice/.test(t),
    toolId: "billing_history",
    toolName: "Billing History",
    next: "report",
  },
  {
    match: (t) => /dispute|overcharg|wrong.*charge/.test(t),
    toolId: "dispute_charge",
    toolName: "Dispute Charge",
    next: "await_input",
  },
  {
    match: (t) => /change.*plan|upgrade.*plan|switch.*plan|downgrade/.test(t),
    toolId: "change_plan",
    toolName: "Change Plan",
    next: "confirm",
  },
  {
    match: (t) =>
      /what.*plan|my.*plan|plan.*detail|which.*plan|view.*plan/.test(t),
    toolId: "view_plan",
    toolName: "View Plan",
    next: "report",
  },
  {
    match: (t) => /usage|data.*used|consumption|كم.*استخدم/.test(t),
    toolId: "check_data_usage",
    toolName: "Check Data Usage",
    next: "report",
  },
  {
    match: (t) => /speed.*test|test.*speed|bandwidth/.test(t),
    toolId: "speed_test",
    toolName: "Run Speed Test",
    next: "execute",
  },
  {
    match: (t) => /coverage|signal|network.*check/.test(t),
    toolId: "check_network",
    toolName: "Check Network",
    next: "report",
  },
  {
    match: (t) =>
      /outage|internet.*down|no.*service|network.*problem|انقطاع/.test(t),
    toolId: "report_outage",
    toolName: "Report Outage",
    next: "await_input",
  },
  {
    match: (t) => /reset.*router|restart.*modem|reboot|reset.*network/.test(t),
    toolId: "reset_network",
    toolName: "Reset Network",
    next: "confirm",
  },
  {
    match: (t) => /activate.*sim|sim.*activate/.test(t),
    toolId: "activate_sim",
    toolName: "Activate SIM",
    next: "confirm",
  },
  {
    match: (t) =>
      /transfer.*agent|speak.*human|real.*person|connect.*support/.test(t),
    toolId: "transfer_agent",
    toolName: "Transfer to Agent",
    next: "escalate",
  },
  {
    match: (t) => /open.*ticket|create.*complaint|file.*ticket/.test(t),
    toolId: "collect_info",
    toolName: "Open Ticket",
    next: "await_input",
  },
  {
    match: (t) => /update.*profile|change.*email|update.*address/.test(t),
    toolId: "update_info",
    toolName: "Update Profile",
    next: "await_input",
  },
];

function routeSymbolic(text: string): ToolRoute {
  const lower = text.toLowerCase();
  for (const rule of TOOL_RULES) {
    if (rule.match(lower)) {
      return {
        toolId: rule.toolId,
        toolName: rule.toolName,
        next: rule.next,
        confidence: "high",
      };
    }
  }
  return {
    toolId: "search_kb",
    toolName: "Knowledge Base",
    next: "report",
    confidence: "low",
  };
}

// ─── Mock tool execution ──────────────────────────────────────────────────

const MOCK_RESULTS: Record<string, Record<string, string>> = {
  // ── Telecom: Billing ──
  check_balance: {
    balance: "47.50 SAR",
    due_date: "2026-05-01",
    status: "active",
  },
  pay_bill: {
    status: "success",
    confirmation: "PAY-2026-8834",
    amount: "47.50 SAR",
  },
  billing_history: { invoices: "3", last: "199 SAR on 2026-04-01" },
  dispute_charge: { dispute: "DSP-2026-1102", status: "under review" },
  bill_estimate: {
    estimate: "199 SAR",
    period: "next month",
    breakdown: "plan 149 + addons 50",
  },
  auto_pay: { status: "enabled", method: "Visa ***4821", next: "2026-05-01" },
  // ── Telecom: Plans & Account ──
  view_plan: { plan: "Premium 5G", data: "100 GB", cost: "199 SAR/mo" },
  change_plan: {
    new_plan: "Ultra 5G",
    effective: "2026-05-01",
    cost: "249 SAR/mo",
  },
  update_info: { status: "updated" },
  update_profile: { status: "updated" },
  update_contact_info: { status: "updated" },
  get_profile: {
    name: "Ahmed M.",
    email: "ahmed@example.com",
    phone: "+966 5X XXX XXXX",
  },
  view_contracts: { contracts: "1 active", renewal: "2027-01-15" },
  loyalty_points: { points: "2,450", value: "24.50 SAR", expiry: "2026-12-31" },
  add_addon: {
    addon: "Social Media Pack",
    cost: "29 SAR/mo",
    status: "activated",
  },
  add_line: {
    number: "+966 5X XXX 9921",
    plan: "Basic 4G",
    status: "pending activation",
  },
  manage_family: { lines: "3 active", total: "449 SAR/mo" },
  cancel_service: {
    ticket: "CAN-2026-4401",
    effective: "2026-05-01",
    status: "pending",
  },
  // ── Telecom: Network ──
  check_data_usage: {
    used: "34.2 GB",
    remaining: "65.8 GB",
    period: "this month",
  },
  view_usage: { used: "34.2 GB", remaining: "65.8 GB", period: "this month" },
  check_network: { area: "Riyadh", type: "5G", signal: "excellent" },
  check_coverage: { area: "Jeddah", type: "5G", coverage: "full" },
  speed_test: { download: "245 Mbps", upload: "48 Mbps", ping: "12ms" },
  report_outage: {
    ticket: "OUT-2026-4421",
    area: "Al Olaya",
    eta: "2-4 hours",
  },
  reset_network: { device: "HG8245H", status: "restarting", eta: "2 minutes" },
  reset_router: { device: "HG8245H", status: "restarting", eta: "2 minutes" },
  // ── Telecom: Device & SIM ──
  check_device: { device: "iPhone 15 Pro", imei: "***4821", status: "active" },
  troubleshoot_device: {
    diagnostic: "passed",
    suggestion: "restart device and check APN settings",
  },
  upgrade_device: {
    eligible: "yes",
    options: "iPhone 16 Pro, Samsung S26",
    installment: "89 SAR/mo",
  },
  activate_sim: { sim: "***4892", status: "activated", network: "connected" },
  block_sim: { sim: "***4892", status: "blocked", ticket: "BLK-2026-1103" },
  request_esim: {
    esim: "pending",
    delivery: "instant (QR code)",
    ticket: "ESIM-2026-0044",
  },
  port_number: {
    number: "+966 5X XXX 3381",
    from: "Mobily",
    status: "in progress",
    eta: "24-48 hours",
  },
  activate_roaming: {
    status: "activated",
    coverage: "worldwide",
    daily_rate: "49 SAR/day",
  },
  // ── Telecom: Support ──
  transfer_agent: { queue: "3", wait: "~2 minutes" },
  collect_info: { ticket: "TKT-2026-7712", priority: "normal" },
  open_ticket: { ticket: "TKT-2026-7713", priority: "normal", status: "open" },
  track_ticket: {
    ticket: "TKT-2026-7712",
    status: "in progress",
    updated: "2 hours ago",
  },
  send_sms: { status: "sent", to: "+966 5X XXX 1234" },
  format_response: { status: "formatted" },
  search_kb: {
    result:
      "I'm not sure how to help with that. Try asking about your balance, plan, usage, or billing.",
  },

  // ── Banking: Accounts ──
  check_account: {
    account: "SA44 2000 0001 ***",
    balance: "12,340.00 SAR",
    type: "Current",
  },
  view_transactions: {
    count: "12 recent",
    last: "−450 SAR at Jarir Bookstore, Apr 14",
  },
  view_statements: {
    count: "6 months available",
    last: "March 2026 statement ready",
  },
  open_account: {
    type: "Savings",
    number: "SA44 2000 0002 ***",
    status: "pending verification",
  },
  close_account: {
    account: "SA44 2000 0001 ***",
    status: "closure requested",
    effective: "30 days",
  },
  // ── Banking: Cards ──
  request_card: {
    type: "Visa Platinum",
    delivery: "5-7 business days",
    status: "approved",
  },
  block_card: {
    card: "Visa ***4821",
    status: "blocked",
    reason: "customer request",
  },
  card_activate: { card: "Visa ***4821", status: "activated" },
  card_block: { card: "Visa ***4821", status: "blocked" },
  view_card_transactions: {
    count: "8 recent",
    last: "−120 SAR at Amazon, Apr 13",
  },
  set_card_limits: {
    card: "Visa ***4821",
    daily_limit: "5,000 SAR",
    status: "updated",
  },
  // ── Banking: Transfers ──
  transfer_money: {
    amount: "500 SAR",
    to: "Ahmed Al-Rashid",
    ref: "TRF-2026-9931",
    status: "completed",
  },
  transfer_funds: {
    amount: "500 SAR",
    to: "Savings account",
    ref: "TRF-2026-9932",
    status: "completed",
  },
  international_transfer: {
    amount: "1,000 USD",
    to: "US Bank ***8812",
    fee: "25 SAR",
    status: "processing",
  },
  wire_transfer: {
    amount: "5,000 SAR",
    to: "IBAN SA88 ***",
    fee: "15 SAR",
    status: "pending",
  },
  schedule_transfer: {
    amount: "500 SAR",
    to: "Savings",
    frequency: "monthly",
    next: "2026-05-01",
  },
  setup_standing_order: {
    amount: "1,000 SAR",
    to: "Rent account",
    frequency: "monthly",
    status: "active",
  },
  manage_beneficiaries: {
    count: "5 saved",
    last_added: "Mohammed A. — Al Rajhi Bank",
  },
  // ── Banking: Loans & Investments ──
  apply_loan: {
    type: "Personal",
    amount: "50,000 SAR",
    rate: "7.5%",
    status: "under review",
  },
  check_loan_status: {
    loan: "LN-2026-0021",
    remaining: "42,000 SAR",
    next_payment: "2026-05-15",
  },
  loan_status: {
    loan: "LN-2026-0021",
    remaining: "42,000 SAR",
    status: "active",
  },
  calculate_installment: {
    loan: "50,000 SAR",
    months: "36",
    monthly: "1,556 SAR",
  },
  mortgage_calc: {
    property: "750,000 SAR",
    down: "150,000 SAR",
    monthly: "3,200 SAR",
    years: "25",
  },
  credit_score: { score: "742", rating: "Good", updated: "2026-04-01" },
  investment_portfolio: {
    value: "85,400 SAR",
    gain: "+4.2%",
    holdings: "3 funds",
  },
  savings_goal: {
    goal: "Emergency Fund",
    target: "30,000 SAR",
    current: "18,500 SAR",
    progress: "62%",
  },
  set_budget: { category: "Dining", limit: "1,500 SAR/mo", spent: "890 SAR" },
  // ── Banking: Security & Misc ──
  report_fraud: {
    ticket: "FRD-2026-0088",
    status: "investigating",
    card_blocked: "yes",
  },
  fraud_report: { ticket: "FRD-2026-0088", status: "investigating" },
  dispute_transaction: {
    dispute: "DSP-2026-4401",
    amount: "350 SAR",
    status: "under review",
  },
  exchange_rate: { pair: "USD/SAR", rate: "3.75", updated: "now" },
  tax_docs: {
    year: "2025",
    documents: "2 available",
    status: "ready to download",
  },
  request_cheque_book: {
    count: "25 cheques",
    delivery: "5-7 days",
    status: "requested",
  },

  // ── Healthcare: Appointments ──
  book_appointment: {
    doctor: "Dr. Sarah Ahmed",
    specialty: "Cardiology",
    date: "2026-04-20 10:00",
    clinic: "Heart Center",
  },
  cancel_appointment: {
    appointment: "APT-2026-1204",
    status: "cancelled",
    refund: "full",
  },
  reschedule_appointment: {
    from: "Apr 20",
    to: "Apr 25 10:00",
    doctor: "Dr. Sarah Ahmed",
  },
  view_appointments: {
    upcoming: "2",
    next: "Dr. Sarah Ahmed — Apr 20 at 10:00 AM",
  },
  find_doctor: {
    name: "Dr. Khalid Al-Fahad",
    specialty: "Cardiology",
    rating: "4.8/5",
    available: "Apr 22",
  },
  find_provider: {
    name: "King Faisal Specialist Hospital",
    distance: "3.2 km",
    rating: "4.7/5",
  },
  telemedicine: {
    session: "TM-2026-0891",
    link: "video call ready",
    doctor: "Dr. Nora Hassan",
  },
  // ── Healthcare: Records ──
  view_records: { records: "12 entries", last: "Lab results — Apr 10, 2026" },
  request_records: {
    ticket: "REC-2026-0441",
    status: "processing",
    eta: "24 hours",
  },
  share_records: {
    shared_with: "Dr. Al-Fahad",
    records: "3 files",
    status: "sent",
  },
  update_medical_history: {
    updated: "allergies, medications",
    status: "saved",
  },
  health_summary: {
    conditions: "Hypertension (controlled)",
    medications: "2 active",
    last_visit: "Apr 10",
  },
  // ── Healthcare: Prescriptions ──
  prescription_refill: {
    medication: "Losartan 50mg",
    pharmacy: "Nahdi Pharmacy",
    status: "ready for pickup",
  },
  renew_prescription: {
    medication: "Losartan 50mg",
    doctor: "Dr. Ahmed",
    status: "renewal approved",
  },
  request_prescription: {
    medication: "requested",
    doctor: "Dr. Ahmed",
    status: "pending approval",
  },
  view_medications: { active: "2", list: "Losartan 50mg, Metformin 500mg" },
  medication_list: { active: "2", list: "Losartan 50mg, Metformin 500mg" },
  // ── Healthcare: Lab & Imaging ──
  lab_results: {
    test: "CBC",
    date: "Apr 10",
    status: "normal",
    hemoglobin: "14.2 g/dL",
  },
  view_lab_results: { test: "CBC", date: "Apr 10", status: "normal" },
  order_lab_test: {
    test: "Lipid Panel",
    lab: "Al Borg Lab",
    date: "Apr 21",
    status: "scheduled",
  },
  request_imaging: {
    type: "Chest X-Ray",
    facility: "Radiology Center",
    date: "Apr 22",
    status: "scheduled",
  },
  // ── Healthcare: Insurance & Claims ──
  insurance_check: {
    provider: "Bupa Arabia",
    plan: "Gold",
    status: "active",
    coverage: "80%",
  },
  submit_claim: {
    claim: "CLM-2026-1122",
    amount: "1,200 SAR",
    status: "submitted",
  },
  claim_status: {
    claim: "CLM-2026-1122",
    status: "approved",
    payout: "960 SAR",
  },
  view_claims: { total: "4 claims", pending: "1", approved: "3" },
  preauthorization: {
    procedure: "MRI",
    status: "approved",
    reference: "PA-2026-0882",
  },
  prior_auth: { procedure: "MRI", status: "approved" },
  // ── Healthcare: Misc ──
  symptom_checker: {
    symptoms: "headache, fatigue",
    suggestion: "schedule appointment",
    urgency: "moderate",
  },
  emergency_info: {
    nearest_er: "King Faisal Hospital — 2.1 km",
    call: "997",
    status: "24/7",
  },
  vaccination_record: {
    vaccines: "4 recorded",
    last: "COVID booster — Jan 2026",
  },
  allergy_list: { allergies: "Penicillin, Shellfish", updated: "2026-03-01" },
  discharge_notes: {
    date: "2026-03-15",
    summary: "Post-surgery follow-up, condition stable",
  },
  referral_request: {
    to: "Endocrinology",
    doctor: "Dr. Al-Fahad",
    status: "referred",
  },
  pharmacy_locator: {
    nearest: "Nahdi Pharmacy — 0.8 km",
    hours: "8 AM - 12 AM",
  },
};

// Natural language responses per tool (specific overrides + generic fallback)
const RESPONSES: Record<string, (r: Record<string, string>) => string> = {
  check_balance: (r) =>
    `Your balance is <strong>${r.balance}</strong>, due on ${r.due_date}. Account status: ${r.status}.`,
  pay_bill: (r) =>
    `Payment of <strong>${r.amount}</strong> confirmed! Reference: ${r.confirmation}.`,
  view_plan: (r) =>
    `You're on the <strong>${r.plan}</strong> plan — ${r.data} data for ${r.cost}.`,
  check_data_usage: (r) =>
    `You've used <strong>${r.used}</strong> with <strong>${r.remaining}</strong> remaining ${r.period}.`,
  view_usage: (r) =>
    `You've used <strong>${r.used}</strong> with <strong>${r.remaining}</strong> remaining ${r.period}.`,
  change_plan: (r) =>
    `Plan changed to <strong>${r.new_plan}</strong> (${r.cost}). Effective ${r.effective}.`,
  speed_test: (r) =>
    `Speed test results: ↓ <strong>${r.download}</strong> / ↑ ${r.upload} / Ping ${r.ping}.`,
  check_network: (r) =>
    `Network in ${r.area}: <strong>${r.type}</strong> — signal is ${r.signal}.`,
  report_outage: (r) =>
    `Outage reported for ${r.area}. Ticket: <strong>${r.ticket}</strong>. ETA: ${r.eta}.`,
  reset_network: (r) =>
    `${r.device} is <strong>${r.status}</strong>. Should be back in ${r.eta}.`,
  activate_sim: (r) =>
    `SIM ${r.sim} is now <strong>${r.status}</strong>. Network: ${r.network}.`,
  transfer_agent: (r) =>
    `Connecting you to a human agent. Queue position: ${r.queue}. Wait: ${r.wait}.`,
  transfer_money: (r) =>
    `Transferred <strong>${r.amount}</strong> to ${r.to}. Reference: ${r.ref}.`,
  transfer_funds: (r) =>
    `Transferred <strong>${r.amount}</strong> to ${r.to}. Reference: ${r.ref}.`,
  book_appointment: (r) =>
    `Appointment booked with <strong>${r.doctor}</strong> (${r.specialty}) on ${r.date} at ${r.clinic}.`,
  check_account: (r) =>
    `Account ${r.account}: Balance <strong>${r.balance}</strong> (${r.type}).`,
  apply_loan: (r) =>
    `Loan application submitted: <strong>${r.amount}</strong> at ${r.rate}. Status: ${r.status}.`,
  find_doctor: (r) =>
    `Found <strong>${r.name}</strong> — ${r.specialty}, rated ${r.rating}. Next available: ${r.available}.`,
  search_kb: (r) => r.result,
};

// Generic response builder for tools without specific templates
function getResponse(toolId: string, result: Record<string, string>): string {
  if (RESPONSES[toolId]) return RESPONSES[toolId](result);
  // Format any tool result generically
  const entries = Object.entries(result)
    .map(([k, v]) => `<strong>${k.replace(/_/g, " ")}</strong>: ${v}`)
    .join(" · ");
  return entries || "Done.";
}

// ─── ONNX Model inference ─────────────────────────────────────────────────

let onnxSession: ort.InferenceSession | null = null;
let vocab: Record<string, number> = {};
let revVocab: Record<string, string> = {};
let specialTokens = { PAD: 0, UNK: 1, BOS: 2, EOS: 3 };
let modelConfig = { max_seq_len: 32 };

async function loadModel(): Promise<void> {
  const statusEl = document.getElementById("model-status")!;
  statusEl.className = "model-status loading";
  statusEl.textContent = "Loading model...";

  try {
    // Load vocab
    const vocabResp = await fetch("./model/vocab.json");
    const vocabData = await vocabResp.json();
    vocab = vocabData.vocab;
    revVocab = vocabData.rev_vocab;
    specialTokens = vocabData.special;
    modelConfig = vocabData.config;

    // Load ONNX model
    onnxSession = await ort.InferenceSession.create("./model/model.onnx", {
      executionProviders: ["wasm"],
    });

    statusEl.className = "model-status loaded";
    statusEl.textContent = "Model: loaded (5.6 MB)";
  } catch (e) {
    console.error("Model load failed:", e);
    statusEl.className = "model-status error";
    statusEl.textContent = "Model: failed to load";
    onnxSession = null;
  }
}

function tokenize(tokens: string[]): number[] {
  return tokens.map((t) => vocab[t] ?? specialTokens.UNK);
}

function pad(ids: number[], maxLen: number): number[] {
  if (ids.length >= maxLen) return ids.slice(0, maxLen);
  return [...ids, ...Array(maxLen - ids.length).fill(specialTokens.PAD)];
}

async function greedyDecode(srcIds: number[]): Promise<string[]> {
  if (!onnxSession) return [];

  const maxLen = modelConfig.max_seq_len;
  const paddedSrc = pad(srcIds, maxLen);
  const tgtIds = [specialTokens.BOS];

  for (let step = 0; step < maxLen - 1; step++) {
    const paddedTgt = pad([...tgtIds], maxLen);

    const srcTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(paddedSrc.map(BigInt)),
      [1, maxLen],
    );
    const tgtTensor = new ort.Tensor(
      "int64",
      BigInt64Array.from(paddedTgt.map(BigInt)),
      [1, maxLen],
    );

    const result = await onnxSession.run({ src: srcTensor, tgt: tgtTensor });
    const logits = result.logits.data as Float32Array;

    // Get logits for the last valid position (tgtIds.length - 1)
    const vocabSize = result.logits.dims[2];
    const posOffset = (tgtIds.length - 1) * vocabSize;

    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < vocabSize; i++) {
      if (logits[posOffset + i] > maxVal) {
        maxVal = logits[posOffset + i];
        maxIdx = i;
      }
    }

    tgtIds.push(maxIdx);
    if (maxIdx === specialTokens.EOS) break;
  }

  return tgtIds.map((id) => revVocab[String(id)] ?? `<${id}>`);
}

function routeModel(outputTokens: string[]): {
  toolId: string;
  toolName: string;
  next: string;
  domain: string;
  action: string;
  steps: string[];
} {
  const tools = outputTokens
    .filter((t) => t.startsWith("TOOL:"))
    .map((t) => t.replace("TOOL:", ""));
  const next =
    outputTokens.find((t) => t.startsWith("NEXT:"))?.replace("NEXT:", "") ??
    "report";
  const domain =
    outputTokens.find((t) => t.startsWith("D:"))?.replace("D:", "") ?? "—";
  const action =
    outputTokens.find((t) => t.startsWith("ACT:"))?.replace("ACT:", "") ?? "—";
  const steps = outputTokens.filter((t) => t.startsWith("STEP:"));

  const toolId = tools[0] ?? "search_kb";
  // Look up tool name from TOOL_RULES or capitalize
  const rule = TOOL_RULES.find((r) => r.toolId === toolId);
  const toolName =
    rule?.toolName ??
    toolId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return { toolId, toolName, next, domain, action, steps };
}

// ─── Process input ────────────────────────────────────────────────────────

async function processInput(
  text: string,
  mode: "symbolic" | "model",
): Promise<ChatResult> {
  const totalStart = performance.now();
  const units = decompose(text);
  const parts =
    units.length > 0 ? units : [{ text, index: 0, isReference: false }];
  const steps: StepResult[] = [];

  for (let i = 0; i < parts.length; i++) {
    const unit = parts[i];
    const stepStart = performance.now();

    let algebra = "—";
    let action = "—";
    let actionConf = 0;
    let route: ToolRoute;

    try {
      const token = encodeLocal(unit.text);
      algebra = compactToken(token);
      const reasoning = engine.reason(token);
      action = reasoning.actionType;
      actionConf = reasoning.confidence;

      if (mode === "model" && onnxSession) {
        // Build input tokens from the algebra token
        const inputTokens = buildInputTokens(token, unit.text);
        const srcIds = tokenize(inputTokens);
        const outputTokens = await greedyDecode(srcIds);
        const modelRoute = routeModel(outputTokens);

        route = {
          toolId: modelRoute.toolId,
          toolName: modelRoute.toolName,
          next: modelRoute.next,
          confidence: "high",
        };
        // Override action/algebra with model output
        if (modelRoute.action !== "—") action = modelRoute.action;
      } else {
        route = routeSymbolic(unit.text);
      }
    } catch {
      route = routeSymbolic(unit.text);
    }

    const result = MOCK_RESULTS[route.toolId] ?? MOCK_RESULTS["search_kb"];
    const latencyMs = performance.now() - stepStart;

    steps.push({
      step: i + 1,
      text: unit.text,
      algebra,
      action,
      actionConf,
      route,
      result: result,
      latencyMs,
    });
  }

  return {
    mode,
    steps,
    totalMs: performance.now() - totalStart,
  };
}

function buildInputTokens(token: AlgebraToken, _text: string): string[] {
  const tokens: string[] = ["<BOS>"];

  // Intent
  if (token.intent) tokens.push(`I:${token.intent}`);

  // Root
  if (token.root) tokens.push(`R:${token.root}`);

  // Root letters
  if (token.rootLetters) tokens.push(`RL:${token.rootLetters}`);

  // Pattern
  if (token.pattern) tokens.push(`P:${token.pattern}`);

  // Modifiers
  if (token.modifiers) {
    for (const mod of token.modifiers) {
      tokens.push(`MK:${mod.key}`);
      if (mod.value) tokens.push(`MV:${mod.key}:${mod.value}`);
    }
  }

  tokens.push("<EOS>");
  return tokens;
}

// ─── UI ────────────────────────────────────────────────────────────────────

let currentMode: "symbolic" | "model" = "symbolic";

const SUGGESTIONS = [
  "What is my balance?",
  "Pay my bill",
  "Check data usage",
  "What plan am I on?",
  "My internet is down",
  "كم رصيدي؟",
  "Check balance and pay bill",
  "Run a speed test",
  "whats my blance",
  "yo how much do I owe",
  "hook me up with a faster plan",
];

function addMessage(html: string, type: "user" | "bot") {
  const el = document.getElementById("messages")!;
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.innerHTML = html;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function renderBotMessage(result: ChatResult) {
  const modeBadge =
    result.mode === "model"
      ? '<span class="mode-badge model">Model (1.5M)</span>'
      : '<span class="mode-badge symbolic">Symbolic Engine</span>';

  let html = modeBadge;

  for (const step of result.steps) {
    const response = getResponse(step.route.toolId, step.result);

    if (result.steps.length > 1) {
      html += `<div style="margin-top:6px"><span class="trace"><span class="step-badge">STEP ${step.step}</span></span> `;
      html += `${response}</div>`;
    } else {
      html += `<div style="margin-top:4px">${response}</div>`;
    }

    // Trace
    html += `<div class="trace">`;
    html += `<div><span class="label">Algebra:</span> <span class="value">${esc(step.algebra)}</span></div>`;
    html += `<div><span class="label">Action:</span> <span class="value">${esc(step.action)}</span> (${Math.round(step.actionConf * 100)}%)</div>`;
    html += `<div><span class="label">Tool:</span> <span class="tool-name">${esc(step.route.toolId)}</span> → ${esc(step.route.toolName)}</div>`;
    html += `<div><span class="label">Next:</span> <span class="value">${esc(step.route.next)}</span></div>`;
    html += `</div>`;

    // Result data
    html += `<div class="result-data">`;
    for (const [k, v] of Object.entries(step.result)) {
      html += `<div class="field"><span class="field-key">${esc(k)}</span><span class="field-val">${esc(v)}</span></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="latency">${result.totalMs.toFixed(1)}ms${result.steps.length > 1 ? ` (${result.steps.length} steps)` : ""}</div>`;

  addMessage(html, "bot");
}

async function handleSend() {
  const input = document.getElementById("chat-input") as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage(esc(text), "user");

  const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
  sendBtn.disabled = true;

  try {
    const result = await processInput(text, currentMode);
    renderBotMessage(result);
  } catch (e) {
    console.error(e);
    addMessage("Sorry, something went wrong processing that request.", "bot");
  }

  sendBtn.disabled = false;
  input.focus();
}

// ─── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderNav("nav", "chat");
  const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
  if (canvas) initBackground(canvas);

  // Mode toggle
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode as "symbolic" | "model";

      if (currentMode === "model" && !onnxSession) {
        loadModel();
      }
    });
  });

  // Suggestions
  const sugEl = document.getElementById("suggestions")!;
  for (const s of SUGGESTIONS) {
    const btn = document.createElement("button");
    btn.className = "sug-btn";
    btn.textContent = s;
    btn.addEventListener("click", () => {
      (document.getElementById("chat-input") as HTMLInputElement).value = s;
      handleSend();
    });
    sugEl.appendChild(btn);
  }

  // Send
  document.getElementById("send-btn")!.addEventListener("click", handleSend);
  document.getElementById("chat-input")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Welcome message
  addMessage(
    `<strong>Welcome to Arabic Algebra Telecom Service</strong><br>` +
      `<span style="font-size:0.8rem; color: var(--text-dim)">` +
      `Ask about your balance, plan, data usage, billing, or network.<br>` +
      `Try English or Arabic. Try typos too — switch to Model mode to see the difference.</span>`,
    "bot",
  );
});
