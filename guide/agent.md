# Agent System

> How the algebra engine becomes a conversational agent with tools.

## Overview

The engine alone maps text to structured actions. The agent system wraps it with:

- **Decomposition** — split multi-intent inputs into units
- **Tool routing** — map algebra actions to executable tools
- **Execution** — run tools and collect results
- **Session management** — track conversation state across turns

```
User: "Check my balance and send me the last 3 transactions"
    ↓
┌──────────────┐
│  Decomposer   │ → ["Check my balance", "send me the last 3 transactions"]
└──────┬───────┘
       ↓ (for each unit)
┌──────────────┐
│  Encoder      │ → AlgebraToken { intent, root, pattern, modifiers }
└──────┬───────┘
       ↓
┌──────────────┐
│  Serializer   │ → "<BOS> I:seek R:حسب ... <EOS>"
└──────┬───────┘
       ↓
┌──────────────┐
│  Router       │ → Predict tool: "check_balance"
│  (model or    │   (or keyword fallback if no model)
│   fallback)   │
└──────┬───────┘
       ↓
┌──────────────┐
│  Executor     │ → Run tool, get result
└──────┬───────┘
       ↓
┌──────────────┐
│  Session      │ → Update state, record turn
└──────────────┘
       ↓
Response: "Your balance is 1,250 SAR. Here are your last 3 transactions: ..."
```

## Decomposer

The decomposer (`src/engine/agent/decomposer.ts`) splits compound requests into individual units:

```
"Check my balance and send me the statement"
    ↓
[
  { text: "Check my balance", index: 0, isReference: false },
  { text: "send me the statement", index: 1, isReference: false }
]
```

Splitting triggers: conjunctions ("and", "then", "also", "و"), semicolons, numbered lists.

Cross-references between units are detected (when unit 2 refers to the output of unit 1), enabling chained execution.

## Routing

### With Model

When a trained model is provided via `routeFunction`, the flow is:

1. Encode the input text → `AlgebraToken`
2. Serialize the token → integer IDs
3. Pass IDs + session context to the model
4. Model predicts output tokens
5. Deserialize output → `{ tools, nextStep, confidence, action, root, domain }`

### Without Model (Keyword Fallback)

When no model is available, the agent uses a keyword-based router built from the domain's tool definitions. It matches words in the input against tool names, descriptions, and parameter names.

This fallback ensures the agent is usable immediately, without training a model first. It's less accurate but functional for demos and testing.

## Execution

The `AgentExecutor` class manages tool execution:

```typescript
// Register a handler for a specific tool
agent.registerHandler("check_balance", async (params) => ({
  status: "success",
  data: { balance: 1250, currency: "SAR" },
  response: "Your balance is 1,250 SAR.",
}));
```

Features:

- **Tool chains** — execute multiple tools in sequence when the routing predicts a chain
- **Missing parameters** — detect when required params are absent and prompt the user
- **Error recovery** — wrap execution in try/catch, return structured error results
- **Next step prediction** — after execution, suggest what should happen next (report, confirm, follow-up, close, escalate)

## Session Management

The `ConversationSession` class tracks state across turns:

### States

| State            | Meaning                                  |
| ---------------- | ---------------------------------------- |
| `idle`           | Waiting for user input                   |
| `executing`      | Running a tool                           |
| `chaining`       | Running a sequence of tools              |
| `confirming`     | Waiting for user to confirm an action    |
| `awaiting_input` | Waiting for user to provide missing info |
| `escalated`      | Transferred to human agent               |

### State Transitions

```
idle → executing     (user sends a request)
idle → confirming    (high-risk action needs confirmation)
executing → idle     (tool completed, result reported)
executing → chaining (first tool done, more to run)
chaining → idle      (all tools completed)
confirming → executing (user confirmed)
confirming → idle    (user denied)
awaiting_input → executing (user provided missing params)
any → escalated     (agent can't handle the request)
```

### Context

The session accumulates context across turns:

- Extracted parameters from previous turns
- Tool execution results
- User preferences and session variables

Context tokens are passed to the model as additional input, enabling the model to make better predictions based on conversation history.

## Domains

Three domains are pre-configured, each with a set of tools:

### Telecom (24 tools)

| Category   | Tools                                                         |
| ---------- | ------------------------------------------------------------- |
| Account    | check_balance, view_plan, change_plan, add_addon, view_usage  |
| Billing    | pay_bill, view_invoices, setup_autopay, request_refund        |
| Technical  | check_coverage, report_outage, speed_test, reset_router       |
| Support    | open_ticket, track_ticket, transfer_agent, search_kb          |
| Services   | activate_roaming, block_sim, request_esim, port_number        |
| Management | update_profile, manage_family, view_contracts, loyalty_points |

### Banking (20 tools)

| Category  | Tools                                                             |
| --------- | ----------------------------------------------------------------- |
| Accounts  | check_account, open_account, close_account, view_statements       |
| Transfers | transfer_funds, schedule_transfer, international_transfer         |
| Cards     | block_card, request_card, set_card_limits, view_card_transactions |
| Loans     | apply_loan, check_loan_status, calculate_installment              |
| Services  | setup_standing_order, manage_beneficiaries, request_cheque_book   |
| Support   | report_fraud, dispute_transaction, update_contact_info            |

### Healthcare (20 tools)

| Category      | Tools                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Appointments  | book_appointment, cancel_appointment, reschedule_appointment, view_appointments |
| Records       | view_records, request_records, share_records, update_medical_history            |
| Prescriptions | request_prescription, renew_prescription, view_medications                      |
| Lab & Imaging | order_lab_test, view_lab_results, request_imaging                               |
| Insurance     | check_coverage, submit_claim, view_claims, preauthorization                     |
| Support       | find_provider, emergency_info, request_callback                                 |

## Usage Example

```typescript
import { createAgent, TELECOM_DOMAIN } from "./src/engine/agent/index.js";

const agent = createAgent(TELECOM_DOMAIN);

// Register real tool handlers
agent.registerHandlers({
  check_balance: async (params) => ({
    status: "success",
    data: { balance: 1250, currency: "SAR" },
    response: "Your current balance is 1,250 SAR.",
  }),
  pay_bill: async (params) => ({
    status: "success",
    data: { amount: params.amount, method: params.method },
    response: `Paid ${params.amount} SAR via ${params.method}.`,
  }),
});

// Handle a conversation
const reply1 = await agent.handle("session-1", "What's my balance?");
// → { response: "Your current balance is 1,250 SAR.", tools: ["check_balance"], ... }

const reply2 = await agent.handle("session-1", "Pay my bill with credit card");
// → { response: "Paid 350 SAR via credit card.", tools: ["pay_bill"], ... }
```

## How This Relates to the Algebra

The agent doesn't bypass the algebra — it builds on it:

1. **Intent detection** finds what the user wants (seek, send, build, ...)
2. **Root detection** finds what domain object is involved (balance, bill, plan, ...)
3. **Pattern detection** determines the grammatical role (agent, patient, instrument, ...)
4. **Engine reasoning** maps intent × pattern → action type
5. **Tool routing** maps action type + root domain → specific tool

The algebra gives structure to the routing decision. Instead of matching keywords directly to tools (the fallback approach), the model learns that `I:seek + R:حسب (count) + D:telecom → check_balance` through the algebraic representation.

---

← [Training](training.md) | [Back to README](../README.md)
