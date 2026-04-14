/**
 * Arabic Algebra — Healthcare Domain Definition
 *
 * Complete tool set for a healthcare support agent.
 * Each tool maps to TOOL:<id> tokens in the vocabulary.
 */

import type { DomainDefinition, ToolDefinition } from "../types.js";

// ─── Tools ─────────────────────────────────────────────────────────────────

const TOOLS: ToolDefinition[] = [
  // ── Appointments ───────────────────────────────────────────────────────
  {
    id: "book_appointment",
    name: "Book Appointment",
    description: "Schedule a medical appointment",
    domain: "appointments",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "doctor_id",
        type: "string",
        required: false,
        description: "Preferred doctor",
      },
      {
        name: "specialty",
        type: "string",
        required: false,
        description: "Medical specialty",
      },
      {
        name: "date",
        type: "string",
        required: false,
        description: "Preferred date",
      },
    ],
    returns: "appointment_id, date, time, doctor_name, location",
  },
  {
    id: "cancel_appointment",
    name: "Cancel Appointment",
    description: "Cancel an existing appointment",
    domain: "appointments",
    params: [
      {
        name: "appointment_id",
        type: "string",
        required: true,
        description: "Appointment ID",
      },
    ],
    returns: "cancellation_status, refund_info",
  },
  {
    id: "find_doctor",
    name: "Find Doctor",
    description: "Search for doctors by specialty or name",
    domain: "appointments",
    params: [
      {
        name: "specialty",
        type: "string",
        required: false,
        description: "Medical specialty",
      },
      {
        name: "name",
        type: "string",
        required: false,
        description: "Doctor name",
      },
      {
        name: "location",
        type: "string",
        required: false,
        description: "Preferred area",
      },
    ],
    returns: "doctors[], availability",
  },
  {
    id: "telemedicine",
    name: "Telemedicine",
    description: "Start or schedule a virtual consultation",
    domain: "appointments",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "specialty",
        type: "string",
        required: false,
        description: "Medical specialty",
      },
    ],
    returns: "session_link, doctor_name, scheduled_time",
  },

  // ── Records ────────────────────────────────────────────────────────────
  {
    id: "view_records",
    name: "View Medical Records",
    description: "Access patient medical history and records",
    domain: "records",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "type",
        type: "string",
        required: false,
        description: "Record type filter",
      },
    ],
    returns: "records[], last_visit, diagnoses[]",
  },
  {
    id: "lab_results",
    name: "Lab Results",
    description: "View laboratory test results",
    domain: "records",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "test_id",
        type: "string",
        required: false,
        description: "Specific test ID",
      },
    ],
    returns: "results[], status, date",
  },
  {
    id: "vaccination_record",
    name: "Vaccination Record",
    description: "View vaccination history and upcoming vaccines",
    domain: "records",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
    ],
    returns: "vaccines[], next_due",
  },
  {
    id: "health_summary",
    name: "Health Summary",
    description: "Get an overview of patient health status",
    domain: "records",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
    ],
    returns: "conditions[], medications[], allergies[], vitals",
  },
  {
    id: "discharge_notes",
    name: "Discharge Notes",
    description: "Access recent discharge instructions",
    domain: "records",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "visit_id",
        type: "string",
        required: false,
        description: "Visit ID",
      },
    ],
    returns: "instructions, follow_up, medications",
  },

  // ── Medications ────────────────────────────────────────────────────────
  {
    id: "prescription_refill",
    name: "Prescription Refill",
    description: "Request a prescription refill",
    domain: "medications",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "medication",
        type: "string",
        required: true,
        description: "Medication name",
      },
    ],
    returns: "refill_status, pickup_date, pharmacy",
  },
  {
    id: "medication_list",
    name: "Medication List",
    description: "View current medications and dosages",
    domain: "medications",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
    ],
    returns: "medications[], dosages[], frequencies[]",
  },
  {
    id: "allergy_list",
    name: "Allergy List",
    description: "View and manage allergy records",
    domain: "medications",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
    ],
    returns: "allergies[], severities[]",
  },
  {
    id: "pharmacy_locator",
    name: "Pharmacy Locator",
    description: "Find nearby pharmacies",
    domain: "medications",
    params: [
      {
        name: "location",
        type: "string",
        required: true,
        description: "Current location",
      },
    ],
    returns: "pharmacies[], hours[], distance[]",
  },

  // ── Insurance & Billing ────────────────────────────────────────────────
  {
    id: "insurance_check",
    name: "Insurance Check",
    description: "Verify insurance coverage and benefits",
    domain: "insurance",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "procedure",
        type: "string",
        required: false,
        description: "Procedure to check",
      },
    ],
    returns: "covered, copay, deductible_remaining, network",
  },
  {
    id: "bill_estimate",
    name: "Bill Estimate",
    description: "Estimate cost of a procedure or visit",
    domain: "insurance",
    params: [
      {
        name: "procedure",
        type: "string",
        required: true,
        description: "Procedure name",
      },
      {
        name: "insurance_id",
        type: "string",
        required: false,
        description: "Insurance plan ID",
      },
    ],
    returns: "estimated_cost, insurance_covers, out_of_pocket",
  },
  {
    id: "prior_auth",
    name: "Prior Authorization",
    description: "Check or request prior authorization for a procedure",
    domain: "insurance",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "procedure",
        type: "string",
        required: true,
        description: "Procedure requiring auth",
      },
    ],
    returns: "auth_status, auth_number, expiry",
  },
  {
    id: "claim_status",
    name: "Claim Status",
    description: "Check status of an insurance claim",
    domain: "insurance",
    params: [
      {
        name: "claim_id",
        type: "string",
        required: true,
        description: "Claim ID",
      },
    ],
    returns: "status, amount, decision_date",
  },

  // ── Clinical ───────────────────────────────────────────────────────────
  {
    id: "symptom_checker",
    name: "Symptom Checker",
    description: "Assess symptoms and suggest next steps",
    domain: "clinical",
    params: [
      {
        name: "symptoms",
        type: "string",
        required: true,
        description: "Described symptoms",
      },
    ],
    returns: "possible_conditions[], urgency, recommended_action",
  },
  {
    id: "emergency_info",
    name: "Emergency Info",
    description: "Provide emergency contact info and nearest ER",
    domain: "clinical",
    params: [
      {
        name: "location",
        type: "string",
        required: false,
        description: "Current location",
      },
    ],
    returns: "emergency_number, nearest_er, wait_time",
  },
  {
    id: "referral_request",
    name: "Referral Request",
    description: "Request a referral to a specialist",
    domain: "clinical",
    params: [
      {
        name: "patient_id",
        type: "string",
        required: true,
        description: "Patient ID",
      },
      {
        name: "specialty",
        type: "string",
        required: true,
        description: "Specialist type",
      },
    ],
    returns: "referral_id, specialist_name, appointment_date",
  },
];

// ─── Keywords → Root Mappings ──────────────────────────────────────────────

const KEYWORDS: Record<string, string> = {
  // Appointments
  appointment: "وعد",
  book: "حجز",
  schedule: "وقت",
  cancel: "لغى",
  doctor: "طبب",
  visit: "زور",
  clinic: "عيد",
  hospital: "شفي",
  telemedicine: "طبب",
  virtual: "خيل",
  consultation: "شور",

  // Records
  record: "سجل",
  history: "ذكر",
  result: "نتج",
  lab: "فحص",
  test: "فحص",
  vaccine: "لقح",
  vaccination: "لقح",
  summary: "خصر",
  discharge: "خرج",
  diagnosis: "شخص",

  // Medications
  prescription: "وصف",
  medication: "دوي",
  medicine: "دوي",
  refill: "عيد",
  pharmacy: "صيد",
  drug: "دوي",
  dose: "جرع",
  allergy: "حسس",
  allergic: "حسس",

  // Insurance
  insurance: "أمن",
  coverage: "غطي",
  copay: "دفع",
  deductible: "خصم",
  claim: "طلب",
  authorization: "أذن",
  preauth: "أذن",
  cost: "كلف",
  estimate: "قدر",
  bill: "حسب",

  // Clinical
  symptom: "عرض",
  pain: "ألم",
  fever: "حمم",
  cough: "سعل",
  emergency: "طوأ",
  urgent: "عجل",
  referral: "حول",
  specialist: "خصص",

  // General
  help: "عون",
  question: "سأل",
  health: "صحح",
  patient: "مرض",
  condition: "حال",
};

// ─── Response Templates ────────────────────────────────────────────────────

const RESPONSE_TEMPLATES: Record<string, string> = {
  book_appointment:
    "Appointment booked for {date} at {time} with Dr. {doctor_name} at {location}.",
  cancel_appointment: "Appointment cancelled. {refund_info}.",
  find_doctor:
    "Found {doctors} matching your criteria. Earliest availability shown.",
  telemedicine:
    "Virtual session scheduled with Dr. {doctor_name} at {scheduled_time}. Link: {session_link}.",
  view_records:
    "Medical records retrieved. Last visit: {last_visit}. Diagnoses: {diagnoses}.",
  lab_results: "Lab results ({date}): {results}. Status: {status}.",
  vaccination_record: "Vaccination history: {vaccines}. Next due: {next_due}.",
  health_summary:
    "Health summary — Conditions: {conditions}. Medications: {medications}. Allergies: {allergies}.",
  discharge_notes:
    "Discharge instructions: {instructions}. Follow-up: {follow_up}.",
  prescription_refill:
    "Refill {refill_status}. Pickup at {pharmacy} on {pickup_date}.",
  medication_list: "Current medications: {medications} — Dosages: {dosages}.",
  allergy_list: "Known allergies: {allergies}. Severities: {severities}.",
  pharmacy_locator: "Nearest pharmacies: {pharmacies}.",
  insurance_check:
    "Coverage: {covered}. Copay: {copay}. Deductible remaining: {deductible_remaining}.",
  bill_estimate:
    "Estimated cost: {estimated_cost}. Insurance covers: {insurance_covers}. Your cost: {out_of_pocket}.",
  prior_auth:
    "Authorization {auth_status}. Auth #: {auth_number}. Expires: {expiry}.",
  claim_status:
    "Claim status: {status}. Amount: {amount}. Decision date: {decision_date}.",
  symptom_checker:
    "Based on symptoms: {possible_conditions}. Urgency: {urgency}. Recommended: {recommended_action}.",
  emergency_info:
    "Emergency: Call {emergency_number}. Nearest ER: {nearest_er}. Wait: {wait_time}.",
  referral_request:
    "Referral to {specialist_name} submitted. Appointment: {appointment_date}.",
};

const ISSUE_TYPES = [
  "appointments",
  "records",
  "medications",
  "insurance",
  "clinical",
  "billing",
  "general",
];

// ─── Domain Export ─────────────────────────────────────────────────────────

export const HEALTHCARE_DOMAIN: DomainDefinition = {
  id: "healthcare",
  name: "Healthcare Support",
  tools: TOOLS,
  keywords: KEYWORDS,
  responseTemplates: RESPONSE_TEMPLATES,
  issueTypes: ISSUE_TYPES,
};

export function getHealthcareToolIds(): string[] {
  return TOOLS.map((t) => t.id);
}

export function getHealthcareTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
