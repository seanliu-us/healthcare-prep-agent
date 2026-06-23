import type { AppointmentInput } from "@/lib/types";

export const SYSTEM_PROMPT = `You are an autonomous Healthcare Office Preparation Agent for a medical/dental office.

Your job: given an upcoming patient appointment, research everything the office staff needs to be ready BEFORE the patient walks in, then produce a concise, actionable office summary.

You operate in a tool-use loop. You have tools for:
1. get_procedure_details — authoritative procedure data from the office's procedure API (Source 1).
2. web_search — targeted web research (Source 2). You must FORMULATE YOUR OWN focused queries.
3. MCP "office-memory" tools (Source 3) — persist and recall findings/summaries across runs.

Operating principles:
- PLAN first. Decide what you need to know and in what order.
- CHECK MEMORY before researching: call get_patient_history and recall_similar_preps to reuse prior work for the same patient or the same carrier+procedure.
- GROUND claims in tools. Start from get_procedure_details, then run several DISTINCT searches covering: (a) what the procedure is, (b) the carrier's prior-authorization requirements for it, (c) coverage/cost considerations, (d) patient preparation instructions.
- REASON across sources. Reconcile the procedure API's "typical prior auth" flag with payer-specific search findings.
- IDENTIFY GAPS AND RISKS: missing prior auth, network/eligibility unknowns, prep that could cause a same-day cancellation, contrast/renal/allergy screening, missing referral, high patient cost.
- PERSIST as you go: call save_finding for important facts and finish by calling save_office_summary.
- When you have gathered enough, call finalize_preparation EXACTLY ONCE with the complete structured summary. Do not call it before you have procedure details AND payer research.

Be specific and practical. Recommendations must be things a front-desk or billing staffer can act on today. Never invent specific policy numbers; describe requirements generally and flag what must be verified on the payer portal.

This is decision-support for office staff using synthetic data — not medical advice and not a coverage guarantee.`;

export function buildTaskPrompt(input: AppointmentInput): string {
  return `Prepare for this upcoming appointment:

- Patient name: ${input.patientName}
- Insurance carrier: ${input.insuranceCarrier}
- Procedure code: ${input.procedureCode}
- Appointment date: ${input.appointmentDate}

Run your full workflow and finish by calling finalize_preparation with the complete office summary.`;
}

/** JSON schema for the structured final summary tool the model must call. */
export const FINALIZE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One-line status, e.g. 'Prior auth required — start today'." },
    overview: { type: "string", description: "2-4 sentence plain-language overview for staff." },
    insuranceSummary: { type: "string", description: "What matters about this carrier for this procedure." },
    priorAuthorization: {
      type: "object",
      properties: {
        likelyRequired: { type: "boolean" },
        requirements: { type: "array", items: { type: "string" } },
        risk: { type: "string", enum: ["low", "medium", "high"] },
        notes: { type: "string" },
      },
      required: ["likelyRequired", "requirements", "risk", "notes"],
    },
    coverageConsiderations: { type: "array", items: { type: "string" } },
    patientPrepInstructions: { type: "array", items: { type: "string" } },
    questionsForPatient: { type: "array", items: { type: "string" } },
    risksAndGaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title", "detail", "severity"],
      },
    },
    recommendedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          rationale: { type: "string" },
          owner: { type: "string", enum: ["Front Desk", "Billing", "Clinical", "Patient"] },
          priority: { type: "string", enum: ["urgent", "high", "normal"] },
          dueBy: { type: "string" },
        },
        required: ["action", "rationale", "owner", "priority"],
      },
    },
    estimatedPatientCost: { type: "string" },
    confidence: { type: "number", description: "0..1 confidence in the summary" },
  },
  required: [
    "headline",
    "overview",
    "insuranceSummary",
    "priorAuthorization",
    "coverageConsiderations",
    "patientPrepInstructions",
    "questionsForPatient",
    "risksAndGaps",
    "recommendedActions",
    "confidence",
  ],
} as const;
