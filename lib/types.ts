/**
 * Shared domain + streaming event types for the Healthcare Prep Agent.
 *
 * These types are intentionally the single source of truth shared between the
 * agent runtime (server) and the React UI (client) so that the streamed event
 * contract can never drift between the two.
 */

export interface AppointmentInput {
  patientName: string;
  insuranceCarrier: string;
  procedureCode: string;
  appointmentDate: string;
}

/** Source 1 — shape returned by the procedure JSON API. */
export interface ProcedureRecord {
  procedureCode: string;
  cptCode: string;
  description: string;
  category: string;
  modality: string;
  bodyPart: string;
  usesContrast: boolean;
  estimatedDurationMinutes: number;
  typicalPriorAuthRequired: boolean;
  commonIndications: string[];
  patientPrepSummary: string;
  averageCostUsdRange: [number, number];
}

/** A single piece of evidence gathered by the agent during a run. */
export interface Finding {
  id: string;
  kind: "procedure" | "payer" | "prior_auth" | "coverage" | "prep" | "risk" | "memory";
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  confidence?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedHint?: string;
}

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskItem {
  title: string;
  detail: string;
  severity: RiskSeverity;
}

export type ActionPriority = "urgent" | "high" | "normal";

export interface RecommendedAction {
  action: string;
  rationale: string;
  owner: "Front Desk" | "Billing" | "Clinical" | "Patient";
  priority: ActionPriority;
  dueBy?: string;
}

/** The final structured artifact produced for office staff. */
export interface OfficeSummary {
  patientName: string;
  insuranceCarrier: string;
  procedureCode: string;
  appointmentDate: string;
  headline: string;
  overview: string;
  insuranceSummary: string;
  priorAuthorization: {
    likelyRequired: boolean;
    requirements: string[];
    risk: RiskSeverity;
    notes: string;
  };
  coverageConsiderations: string[];
  patientPrepInstructions: string[];
  questionsForPatient: string[];
  risksAndGaps: RiskItem[];
  recommendedActions: RecommendedAction[];
  estimatedPatientCost?: string;
  confidence: number;
}

/* ------------------------------------------------------------------ */
/* Streaming event protocol                                            */
/* ------------------------------------------------------------------ */

export type AgentEventType =
  | "run_started"
  | "phase"
  | "plan"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "finding"
  | "risk"
  | "recommendation"
  | "approval_required"
  | "approval_resolved"
  | "summary"
  | "trace"
  | "error"
  | "run_completed";

export type AgentPhase =
  | "planning"
  | "procedure_lookup"
  | "research"
  | "risk_analysis"
  | "recommendation"
  | "persistence"
  | "done";

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  toolHint?: string;
}

export interface ToolCallPayload {
  callId: string;
  tool: string;
  source: "procedure_api" | "search" | "mcp" | "agent";
  input: unknown;
  reason?: string;
}

export interface ToolResultPayload {
  callId: string;
  tool: string;
  ok: boolean;
  durationMs: number;
  summary: string;
  data?: unknown;
  error?: string;
}

export interface TracePayload {
  totalToolCalls: number;
  toolBreakdown: Record<string, number>;
  llmCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  elapsedMs: number;
  mode: AgentMode;
}

export type AgentMode = "llm" | "heuristic";

export interface AgentEvent {
  id: string;
  runId: string;
  seq: number;
  ts: number;
  type: AgentEventType;
  data: unknown;
}

/** Convenience discriminated payloads keyed by event type for the UI. */
export interface RunStartedData {
  input: AppointmentInput;
  mode: AgentMode;
  model?: string;
}

export interface PhaseData {
  phase: AgentPhase;
  label: string;
}

export interface PlanData {
  steps: PlanStep[];
  thought: string;
}

export interface ReasoningData {
  text: string;
}

export interface ApprovalRequiredData {
  approvalId: string;
  summary: OfficeSummary;
}

export interface RunCompletedData {
  summaryId?: string;
  trace: TracePayload;
  persisted: boolean;
}
