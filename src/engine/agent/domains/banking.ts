/**
 * Arabic Algebra — Banking Domain Definition
 *
 * Complete tool set for a banking customer support agent.
 * Each tool maps to TOOL:<id> tokens in the vocabulary.
 */

import type { DomainDefinition, ToolDefinition } from "../types.js";

// ─── Tools ─────────────────────────────────────────────────────────────────

const TOOLS: ToolDefinition[] = [
  // ── Account ────────────────────────────────────────────────────────────
  {
    id: "check_account",
    name: "Check Account",
    description: "Look up account balance, status, and summary",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
    ],
    returns: "balance, available, status, type",
  },
  {
    id: "view_transactions",
    name: "View Transactions",
    description: "Show recent account transactions",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
      {
        name: "days",
        type: "number",
        required: false,
        description: "Number of days (default: 30)",
      },
    ],
    returns: "transactions[]",
  },
  {
    id: "open_account",
    name: "Open Account",
    description: "Open a new bank account",
    domain: "account",
    params: [
      {
        name: "type",
        type: "string",
        required: true,
        description: "Account type: checking, savings",
      },
      {
        name: "customer_id",
        type: "string",
        required: true,
        description: "Customer ID",
      },
    ],
    returns: "account_number, status",
  },
  {
    id: "close_account",
    name: "Close Account",
    description: "Close an existing bank account",
    domain: "account",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
      {
        name: "reason",
        type: "string",
        required: false,
        description: "Closure reason",
      },
    ],
    returns: "closure_date, final_balance",
  },

  // ── Transfers ──────────────────────────────────────────────────────────
  {
    id: "transfer_money",
    name: "Transfer Money",
    description: "Transfer funds between accounts",
    domain: "transfers",
    params: [
      {
        name: "from_account",
        type: "string",
        required: true,
        description: "Source account",
      },
      {
        name: "to_account",
        type: "string",
        required: true,
        description: "Destination account",
      },
      {
        name: "amount",
        type: "number",
        required: true,
        description: "Transfer amount",
      },
    ],
    returns: "transfer_id, status, new_balance",
  },
  {
    id: "wire_transfer",
    name: "Wire Transfer",
    description: "Send international or domestic wire transfer",
    domain: "transfers",
    params: [
      {
        name: "from_account",
        type: "string",
        required: true,
        description: "Source account",
      },
      {
        name: "recipient",
        type: "string",
        required: true,
        description: "Recipient details",
      },
      {
        name: "amount",
        type: "number",
        required: true,
        description: "Wire amount",
      },
    ],
    returns: "wire_id, status, fee, estimated_arrival",
  },
  {
    id: "auto_pay",
    name: "Auto Pay",
    description: "Set up or manage automatic payments",
    domain: "transfers",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
      {
        name: "payee",
        type: "string",
        required: true,
        description: "Payment recipient",
      },
      {
        name: "amount",
        type: "number",
        required: false,
        description: "Payment amount",
      },
    ],
    returns: "autopay_id, schedule, status",
  },

  // ── Loans ──────────────────────────────────────────────────────────────
  {
    id: "apply_loan",
    name: "Apply for Loan",
    description: "Submit a loan or credit application",
    domain: "loans",
    params: [
      {
        name: "customer_id",
        type: "string",
        required: true,
        description: "Customer ID",
      },
      {
        name: "type",
        type: "string",
        required: true,
        description: "Loan type: personal, auto, home",
      },
      {
        name: "amount",
        type: "number",
        required: true,
        description: "Requested amount",
      },
    ],
    returns: "application_id, status, estimated_rate",
  },
  {
    id: "loan_status",
    name: "Loan Status",
    description: "Check status of loan application or existing loan",
    domain: "loans",
    params: [
      {
        name: "loan_id",
        type: "string",
        required: true,
        description: "Loan or application ID",
      },
    ],
    returns: "status, balance, next_payment, rate",
  },
  {
    id: "mortgage_calc",
    name: "Mortgage Calculator",
    description: "Calculate mortgage payments and terms",
    domain: "loans",
    params: [
      {
        name: "amount",
        type: "number",
        required: true,
        description: "Loan amount",
      },
      {
        name: "term_years",
        type: "number",
        required: true,
        description: "Loan term in years",
      },
      {
        name: "rate",
        type: "number",
        required: false,
        description: "Interest rate (auto if omitted)",
      },
    ],
    returns: "monthly_payment, total_interest, total_cost",
  },

  // ── Cards ──────────────────────────────────────────────────────────────
  {
    id: "card_block",
    name: "Block Card",
    description: "Block a lost or stolen card immediately",
    domain: "cards",
    params: [
      {
        name: "card_id",
        type: "string",
        required: true,
        description: "Card number (last 4)",
      },
    ],
    returns: "block_status, replacement_info",
  },
  {
    id: "card_activate",
    name: "Activate Card",
    description: "Activate a new or replacement card",
    domain: "cards",
    params: [
      {
        name: "card_id",
        type: "string",
        required: true,
        description: "Card number (last 4)",
      },
    ],
    returns: "activation_status",
  },
  {
    id: "credit_score",
    name: "Credit Score",
    description: "Check customer's credit score and report",
    domain: "cards",
    params: [
      {
        name: "customer_id",
        type: "string",
        required: true,
        description: "Customer ID",
      },
    ],
    returns: "score, rating, factors[]",
  },

  // ── Investments ────────────────────────────────────────────────────────
  {
    id: "investment_portfolio",
    name: "Investment Portfolio",
    description: "View investment portfolio performance",
    domain: "investments",
    params: [
      {
        name: "customer_id",
        type: "string",
        required: true,
        description: "Customer ID",
      },
    ],
    returns: "holdings[], total_value, gain_loss",
  },
  {
    id: "savings_goal",
    name: "Savings Goal",
    description: "Set up or check progress on savings goals",
    domain: "investments",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Savings account ID",
      },
      {
        name: "goal_amount",
        type: "number",
        required: false,
        description: "Target amount",
      },
    ],
    returns: "current_amount, goal_amount, progress_pct, estimated_date",
  },

  // ── Services ───────────────────────────────────────────────────────────
  {
    id: "exchange_rate",
    name: "Exchange Rate",
    description: "Check currency exchange rates",
    domain: "services",
    params: [
      {
        name: "from_currency",
        type: "string",
        required: true,
        description: "Source currency",
      },
      {
        name: "to_currency",
        type: "string",
        required: true,
        description: "Target currency",
      },
    ],
    returns: "rate, last_updated",
  },
  {
    id: "set_budget",
    name: "Set Budget",
    description: "Create or update a spending budget",
    domain: "services",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
      {
        name: "category",
        type: "string",
        required: true,
        description: "Budget category",
      },
      {
        name: "limit",
        type: "number",
        required: true,
        description: "Monthly limit",
      },
    ],
    returns: "budget_id, status",
  },
  {
    id: "atm_locator",
    name: "ATM Locator",
    description: "Find nearest ATMs or branches",
    domain: "services",
    params: [
      {
        name: "location",
        type: "string",
        required: true,
        description: "Current location",
      },
    ],
    returns: "nearest_atms[], nearest_branches[]",
  },
  {
    id: "fraud_report",
    name: "Report Fraud",
    description: "Report suspicious or fraudulent activity",
    domain: "security",
    params: [
      {
        name: "account_id",
        type: "string",
        required: true,
        description: "Account ID",
      },
      {
        name: "description",
        type: "string",
        required: true,
        description: "Fraud description",
      },
    ],
    returns: "case_id, status, next_steps",
  },
  {
    id: "tax_docs",
    name: "Tax Documents",
    description: "Request tax documents (1099, statements)",
    domain: "services",
    params: [
      {
        name: "customer_id",
        type: "string",
        required: true,
        description: "Customer ID",
      },
      {
        name: "year",
        type: "number",
        required: false,
        description: "Tax year",
      },
    ],
    returns: "documents[], download_links[]",
  },
];

// ─── Keywords → Root Mappings ──────────────────────────────────────────────

const KEYWORDS: Record<string, string> = {
  // Account
  account: "حسب",
  balance: "حسب",
  checking: "حسب",
  savings: "ادخر",
  deposit: "ودع",
  withdraw: "سحب",
  statement: "كشف",
  transaction: "عمل",
  history: "ذكر",

  // Transfers
  transfer: "نقل",
  send: "رسل",
  wire: "نقل",
  remittance: "حول",
  autopay: "دفع",
  payment: "دفع",
  pay: "دفع",

  // Loans
  loan: "قرض",
  borrow: "قرض",
  mortgage: "رهن",
  interest: "ربح",
  rate: "سعر",
  installment: "قسط",
  finance: "مول",
  credit: "دين",

  // Cards
  card: "بطق",
  block: "قفل",
  lost: "فقد",
  stolen: "سرق",
  activate: "فعل",
  pin: "رقم",
  limit: "حدد",

  // Investments
  invest: "ثمر",
  portfolio: "ثمر",
  stock: "سهم",
  fund: "صند",
  savings: "ادخر",
  goal: "هدف",
  return: "عائد",

  // Services
  exchange: "صرف",
  currency: "عمل",
  budget: "ميزن",
  atm: "صرف",
  branch: "فرع",
  fraud: "غشش",
  suspicious: "شبه",
  tax: "ضرب",
  document: "وثق",

  // General
  help: "عون",
  problem: "شكل",
  question: "سأل",
  information: "علم",
  close: "غلق",
  open: "فتح",
};

// ─── Response Templates ────────────────────────────────────────────────────

const RESPONSE_TEMPLATES: Record<string, string> = {
  check_account:
    "Account balance: {balance}. Available: {available}. Status: {status}.",
  view_transactions: "Here are your recent transactions:\n{transactions}",
  open_account:
    "New {type} account opened: #{account_number}. Status: {status}.",
  close_account:
    "Account closure scheduled for {closure_date}. Final balance: {final_balance}.",
  transfer_money:
    "Transfer of {amount} completed. Reference: {transfer_id}. New balance: {new_balance}.",
  wire_transfer:
    "Wire #{wire_id} initiated. Fee: {fee}. Estimated arrival: {estimated_arrival}.",
  auto_pay: "Autopay {status}: paying {payee} on schedule {schedule}.",
  apply_loan:
    "Application #{application_id} submitted. Estimated rate: {estimated_rate}%.",
  loan_status:
    "Loan status: {status}. Balance: {balance}. Next payment: {next_payment}.",
  mortgage_calc:
    "Monthly payment: {monthly_payment}. Total interest: {total_interest}. Total cost: {total_cost}.",
  card_block: "Card blocked immediately. {replacement_info}.",
  card_activate: "Card activated successfully.",
  credit_score:
    "Your credit score: {score} ({rating}). Key factors: {factors}.",
  investment_portfolio:
    "Portfolio value: {total_value}. Gain/Loss: {gain_loss}.",
  savings_goal:
    "Progress: {current_amount}/{goal_amount} ({progress_pct}%). On track for {estimated_date}.",
  exchange_rate: "Exchange rate: {rate}. Last updated: {last_updated}.",
  set_budget: "Budget set for {category}: {limit}/month.",
  atm_locator:
    "Nearest ATM: {nearest_atms}. Nearest branch: {nearest_branches}.",
  fraud_report: "Fraud case #{case_id} opened. Next steps: {next_steps}.",
  tax_docs: "Tax documents available: {documents}.",
};

const ISSUE_TYPES = [
  "account",
  "transfers",
  "loans",
  "cards",
  "investments",
  "services",
  "security",
  "general",
];

// ─── Domain Export ─────────────────────────────────────────────────────────

export const BANKING_DOMAIN: DomainDefinition = {
  id: "banking",
  name: "Banking Customer Support",
  tools: TOOLS,
  keywords: KEYWORDS,
  responseTemplates: RESPONSE_TEMPLATES,
  issueTypes: ISSUE_TYPES,
};

export function getBankingToolIds(): string[] {
  return TOOLS.map((t) => t.id);
}

export function getBankingTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
