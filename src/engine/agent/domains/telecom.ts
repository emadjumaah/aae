/**
 * Arabic Algebra — Telecom Domain Definition
 *
 * Complete tool set for a telecom customer support agent.
 * Each tool maps to TOOL:<id> tokens in the vocabulary.
 */

import type { DomainDefinition, ToolDefinition } from "../types.js";

// ─── Tools ─────────────────────────────────────────────────────────────────

const TOOLS: ToolDefinition[] = [
  // ── Billing ────────────────────────────────────────────────────────────
  {
    id: "check_balance",
    name: "Check Balance",
    description: "Look up current account balance and due date",
    domain: "billing",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "balance, due_date, status",
  },
  {
    id: "pay_bill",
    name: "Pay Bill",
    description: "Process a payment for account balance",
    domain: "billing",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "amount",
        type: "number",
        required: false,
        description: "Payment amount (defaults to full)",
      },
    ],
    returns: "payment_status, confirmation_number",
  },
  {
    id: "billing_history",
    name: "Billing History",
    description: "Retrieve recent billing statements",
    domain: "billing",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "months",
        type: "number",
        required: false,
        description: "Number of months (default: 3)",
      },
    ],
    returns: "statements[]",
  },
  {
    id: "dispute_charge",
    name: "Dispute Charge",
    description: "Open a dispute for a specific charge",
    domain: "billing",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "charge_id",
        type: "string",
        required: true,
        description: "Charge to dispute",
      },
      {
        name: "reason",
        type: "string",
        required: true,
        description: "Dispute reason",
      },
    ],
    returns: "dispute_id, status",
  },

  // ── Account ────────────────────────────────────────────────────────────
  {
    id: "view_plan",
    name: "View Plan",
    description: "Show current plan details and features",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "plan_name, data_limit, minutes, features[]",
  },
  {
    id: "change_plan",
    name: "Change Plan",
    description: "Upgrade or downgrade the customer's plan",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "new_plan",
        type: "string",
        required: true,
        description: "Target plan name",
      },
    ],
    returns: "confirmation, effective_date, price_change",
  },
  {
    id: "update_info",
    name: "Update Info",
    description: "Update customer contact or personal information",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "field",
        type: "string",
        required: true,
        description: "Field to update (email, phone, address)",
      },
      {
        name: "value",
        type: "string",
        required: true,
        description: "New value",
      },
    ],
    returns: "updated_field, confirmation",
  },
  {
    id: "cancel_service",
    name: "Cancel Service",
    description: "Cancel or schedule service cancellation",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "reason",
        type: "string",
        required: false,
        description: "Cancellation reason",
      },
    ],
    returns: "cancellation_date, final_bill_amount",
  },
  {
    id: "add_line",
    name: "Add Line",
    description: "Add a new phone line to the account",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "plan",
        type: "string",
        required: false,
        description: "Plan for new line",
      },
    ],
    returns: "new_line_number, monthly_cost",
  },
  {
    id: "get_profile",
    name: "Get Customer Profile",
    description:
      "Retrieve customer profile: name, phone, email, address, and other basic info",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "fields",
        type: "string",
        required: false,
        description: "Specific fields to retrieve (comma-separated)",
      },
    ],
    returns:
      "name, phone, email, address, id_number, join_date, language, preferred_contact",
  },

  // ── Technical ──────────────────────────────────────────────────────────
  {
    id: "check_network",
    name: "Check Network Status",
    description: "Check network coverage and outages in customer area",
    domain: "technical",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "location",
        type: "string",
        required: false,
        description: "Location to check",
      },
    ],
    returns: "network_status, signal_strength, known_outages[]",
  },
  {
    id: "check_data_usage",
    name: "Check Data Usage",
    description: "Show current data consumption and remaining allowance",
    domain: "technical",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "used_gb, limit_gb, reset_date",
  },
  {
    id: "reset_network",
    name: "Reset Network Settings",
    description: "Remote reset of network configuration on device",
    domain: "technical",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "reset_status, estimated_time",
  },
  {
    id: "speed_test",
    name: "Run Speed Test",
    description: "Run a network speed diagnostic",
    domain: "technical",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "download_speed, upload_speed, latency",
  },
  {
    id: "report_outage",
    name: "Report Outage",
    description: "File a network outage report",
    domain: "technical",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "location",
        type: "string",
        required: true,
        description: "Outage location",
      },
      {
        name: "description",
        type: "string",
        required: true,
        description: "Issue description",
      },
    ],
    returns: "ticket_id, estimated_resolution",
  },

  // ── Device ─────────────────────────────────────────────────────────────
  {
    id: "check_device",
    name: "Check Device Status",
    description: "Look up device info, warranty, and payment status",
    domain: "device",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "device_model, warranty_status, installment_remaining",
  },
  {
    id: "troubleshoot_device",
    name: "Troubleshoot Device",
    description: "Run automated device diagnostics",
    domain: "device",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "issue",
        type: "string",
        required: true,
        description: "Issue description",
      },
    ],
    returns: "diagnosis, recommended_steps[]",
  },
  {
    id: "upgrade_device",
    name: "Upgrade Device",
    description: "Check eligibility and options for device upgrade",
    domain: "device",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
    ],
    returns: "eligible, available_devices[], trade_in_value",
  },
  {
    id: "activate_sim",
    name: "Activate SIM",
    description: "Activate a new or replacement SIM card",
    domain: "device",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "sim_number",
        type: "string",
        required: true,
        description: "SIM card number",
      },
    ],
    returns: "activation_status, phone_number",
  },

  // ── General ────────────────────────────────────────────────────────────
  {
    id: "transfer_agent",
    name: "Transfer to Agent",
    description: "Transfer customer to a human agent",
    domain: "general",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "department",
        type: "string",
        required: false,
        description: "Target department",
      },
    ],
    returns: "queue_position, estimated_wait",
  },
  {
    id: "collect_info",
    name: "Collect Information",
    description: "Ask customer for specific information (phone, email, etc.)",
    domain: "general",
    params: [
      {
        name: "field",
        type: "string",
        required: true,
        description: "What to collect",
      },
      {
        name: "reason",
        type: "string",
        required: false,
        description: "Why it's needed",
      },
    ],
    returns: "collected_value",
  },
  {
    id: "send_sms",
    name: "Send SMS",
    description: "Send an SMS notification or confirmation to customer",
    domain: "general",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Customer account ID",
      },
      {
        name: "message",
        type: "string",
        required: true,
        description: "Message content",
      },
    ],
    returns: "delivery_status",
  },
  {
    id: "search_kb",
    name: "Search Knowledge Base",
    description: "Search support articles and FAQs",
    domain: "general",
    params: [
      {
        name: "query",
        type: "string",
        required: true,
        description: "Search query",
      },
    ],
    returns: "articles[], best_match",
  },
  {
    id: "format_response",
    name: "Format Response",
    description:
      "Post-process and format tool results: compress, summarize, restructure, highlight key info",
    domain: "general",
    params: [
      {
        name: "source_tool",
        type: "string",
        required: true,
        description: "Tool whose output to format",
      },
      {
        name: "raw_data",
        type: "string",
        required: true,
        description: "Raw data to format",
      },
      {
        name: "format",
        type: "string",
        required: false,
        description:
          "Output format: summary, list, table, highlight (default: summary)",
      },
    ],
    returns: "formatted_text",
  },
];

// ─── Keywords → Root Mappings ──────────────────────────────────────────────

const KEYWORDS: Record<string, string> = {
  // Billing terms → roots
  bill: "حسب", // h-s-b (to calculate/account)
  balance: "حسب",
  payment: "دفع", // d-f-' (to pay/push)
  pay: "دفع",
  charge: "حسب",
  invoice: "حسب",
  refund: "رجع", // r-j-' (to return)
  credit: "دين", // d-y-n (debt/credit)
  debt: "دين",
  due: "وجب", // w-j-b (obligation)
  overdue: "وجب",
  dispute: "نزع", // n-z-' (to contend)

  // Account terms → roots
  plan: "خطط", // kh-t-t (to plan)
  subscription: "خطط",
  upgrade: "رفع", // r-f-' (to raise)
  downgrade: "نزل", // n-z-l (to lower)
  cancel: "لغى", // l-gh-y (to cancel)
  activate: "فعل", // f-'-l (to activate)
  deactivate: "عطل", // '-t-l (to disable)
  account: "حسب",
  register: "سجل", // s-j-l (to register)
  profile: "وصف", // w-s-f (to describe)
  info: "علم", // '-l-m (to know/inform)
  details: "فصل", // f-s-l (to detail)
  name: "سمي", // s-m-y (to name)
  location: "مكن", // m-k-n (place/location)
  address: "عنو", // '-n-w (to address)
  email: "رسل", // r-s-l (to send)
  contact: "صلا", // s-l-a (contact/connection)
  format: "نظم", // n-z-m (to organize/format)
  summary: "خصر", // kh-s-r (to summarize/shorten)
  compress: "ضغط", // d-gh-t (to compress/press)
  shorten: "خصر", // kh-s-r
  organize: "نظم", // n-z-m
  list: "عدد", // '-d-d (to list/count)
  highlight: "برز", // b-r-z (to highlight)

  // Technical terms → roots
  network: "شبك", // sh-b-k (network)
  signal: "شير", // sh-y-r (to signal)
  coverage: "غطي", // gh-t-y (to cover)
  outage: "قطع", // q-t-' (to cut)
  slow: "بطأ", // b-t-' (to slow)
  speed: "سرع", // s-r-' (speed)
  data: "بين", // b-y-n (data/information)
  internet: "شبك",
  wifi: "شبك",
  connection: "وصل", // w-s-l (to connect)
  disconnect: "قطع",

  // Device terms → roots
  phone: "هتف", // h-t-f (telephone)
  device: "جهز", // j-h-z (device/equipment)
  sim: "بطق", // b-t-q (card)
  screen: "ششر", // screen
  battery: "طقت", // power/energy
  broken: "كسر", // k-s-r (to break)
  repair: "صلح", // s-l-h (to fix)
  warranty: "ضمن", // d-m-n (to guarantee)
  replacement: "بدل", // b-d-l (to replace)

  // General support terms
  help: "عون", // '-w-n (to help)
  problem: "شكل", // sh-k-l (to form/problem)
  issue: "شكل",
  complaint: "شكو", // sh-k-w (to complain)
  request: "طلب", // t-l-b (to request)
  question: "سأل", // s-'-l (to ask)
  information: "علم", // '-l-m (to know)
  status: "حال", // h-a-l (state/status)
  number: "رقم", // r-q-m (number)
  transfer: "حول", // h-w-l (to transfer)
  agent: "وكل", // w-k-l (agent/representative)
  human: "بشر", // b-sh-r (human)
};

// ─── Response Templates ────────────────────────────────────────────────────

const RESPONSE_TEMPLATES: Record<string, string> = {
  check_balance:
    "Your current balance is {balance}. Payment is due on {due_date}. Status: {status}.",
  pay_bill:
    "Payment of {amount} processed successfully. Confirmation: {confirmation_number}.",
  billing_history: "Here are your recent statements:\n{statements}",
  dispute_charge:
    "Dispute #{dispute_id} has been opened. We'll review and update you within 48 hours.",
  view_plan:
    "Your plan: {plan_name}\nData: {data_limit}\nMinutes: {minutes}\nFeatures: {features}",
  change_plan:
    "Plan changed to {new_plan}. Effective {effective_date}. Monthly change: {price_change}.",
  update_info: "Your {updated_field} has been updated successfully.",
  cancel_service:
    "Cancellation scheduled for {cancellation_date}. Final bill: {final_bill_amount}.",
  add_line: "New line added: {new_line_number}. Monthly cost: {monthly_cost}.",
  check_network: "Network status: {network_status}. Signal: {signal_strength}.",
  check_data_usage:
    "Data used: {used_gb}GB of {limit_gb}GB. Resets on {reset_date}.",
  reset_network:
    "Network settings reset initiated. Should take about {estimated_time}.",
  speed_test:
    "Download: {download_speed}Mbps, Upload: {upload_speed}Mbps, Latency: {latency}ms.",
  report_outage:
    "Outage reported. Ticket #{ticket_id}. Estimated resolution: {estimated_resolution}.",
  check_device:
    "Device: {device_model}. Warranty: {warranty_status}. Remaining: {installment_remaining}.",
  troubleshoot_device:
    "Diagnosis: {diagnosis}. Try these steps:\n{recommended_steps}",
  upgrade_device:
    "You're {eligible} for upgrade. Trade-in value: {trade_in_value}.",
  activate_sim: "SIM activated. Your number: {phone_number}.",
  transfer_agent:
    "Transferring you to an agent. Queue position: {queue_position}. Wait: {estimated_wait}.",
  collect_info: "Could you please provide your {field}?",
  send_sms: "Confirmation SMS sent to your number.",
  search_kb: "Here's what I found: {best_match}",
  get_profile:
    "Customer profile:\nName: {name}\nPhone: {phone}\nEmail: {email}\nAddress: {address}\nMember since: {join_date}\nPreferred contact: {preferred_contact}.",
  format_response: "{formatted_text}",
};

// ─── Issue Types ───────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  "billing",
  "technical",
  "account",
  "device",
  "general",
  "complaint",
  "upgrade",
  "cancellation",
];

// ─── Domain Export ─────────────────────────────────────────────────────────

export const TELECOM_DOMAIN: DomainDefinition = {
  id: "telecom",
  name: "Telecom Customer Support",
  tools: TOOLS,
  keywords: KEYWORDS,
  responseTemplates: RESPONSE_TEMPLATES,
  issueTypes: ISSUE_TYPES,
};

/** Get all tool IDs */
export function getTelecomToolIds(): string[] {
  return TOOLS.map((t) => t.id);
}

/** Lookup tool by ID */
export function getTelecomTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
