import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentEventType,
  AgentMode,
  AppointmentInput,
  Finding,
  OfficeSummary,
  PlanStep,
  RiskItem,
  SearchResult,
} from "@/lib/types";
import { buildToolRegistry, type ToolExecution, type ToolRegistry } from "@/lib/agent/tools";
import { Tracer } from "@/lib/agent/tracing";
import { DEFAULT_MODEL, getAnthropic } from "@/lib/llm/anthropic";
import { SYSTEM_PROMPT, buildTaskPrompt, FINALIZE_TOOL_SCHEMA } from "@/lib/agent/prompts";
import { waitForApproval } from "@/lib/agent/approvals";
import { findPayer } from "@/lib/data/payers";
import { getProcedure, synthesizeProcedure } from "@/lib/data/procedures";
import type { ProcedureRecord } from "@/lib/types";

export type Emit = (type: AgentEventType, data: unknown) => void;

export interface OrchestratorOptions {
  runId: string;
  input: AppointmentInput;
  baseUrl: string;
  requireApproval: boolean;
  emit: Emit;
}

const MAX_STEPS = 12;

const FINALIZE_TOOL: Anthropic.Tool = {
  name: "finalize_preparation",
  description:
    "Submit the complete, structured office summary. Call this EXACTLY ONCE, only after gathering procedure details and payer research.",
  input_schema: FINALIZE_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export async function runAgent(opts: OrchestratorOptions): Promise<void> {
  const { runId, input, baseUrl, requireApproval, emit } = opts;
  const anthropic = getAnthropic();
  const mode: AgentMode = anthropic ? "llm" : "heuristic";
  const tracer = new Tracer(mode);

  emit("run_started", { input, mode, model: anthropic ? DEFAULT_MODEL : undefined });

  const registry = await buildToolRegistry({ baseUrl }, input.insuranceCarrier);

  emit("plan", {
    thought:
      mode === "llm"
        ? "I'll check office memory for prior work, pull authoritative procedure details, run targeted payer research, reconcile sources, flag risks, and produce an actionable summary."
        : "Running the deterministic preparation workflow across all three data sources.",
    steps: PLAN_STEPS,
  });

  // Shared accumulator so we can synthesize a fallback summary if the model
  // never calls finalize, and to persist findings at the end.
  const gathered: Gathered = { findings: [], procedure: undefined, searches: [] };

  let summary: OfficeSummary | null = null;

  if (anthropic) {
    summary = await runLlm(anthropic, { runId, input, emit, tracer, registry, gathered });
  } else {
    summary = await runHeuristic({ runId, input, emit, tracer, registry, gathered });
  }

  if (!summary) {
    // Model ended without a structured summary — synthesize from what we gathered.
    summary = synthesizeSummary(input, gathered);
  }

  emit("phase", { phase: "risk_analysis", label: "Reviewing risks & gaps" });
  for (const r of summary.risksAndGaps) emit("risk", r);

  emit("phase", { phase: "recommendation", label: "Drafting recommendations" });
  for (const a of summary.recommendedActions) emit("recommendation", a);

  emit("summary", summary);

  // Human-in-the-loop gate before persistence.
  let approved = true;
  if (requireApproval) {
    const approvalId = `${runId}-approval`;
    emit("approval_required", { approvalId, summary });
    const decision = await waitForApproval(approvalId);
    approved = decision !== "rejected";
    emit("approval_resolved", { approvalId, decision, approved });
  }

  // Persist via MCP (Source 3).
  let persisted = false;
  let summaryId: string | undefined;
  if (approved && registry.mcpAvailable) {
    emit("phase", { phase: "persistence", label: "Persisting to office memory (MCP)" });
    try {
      summaryId = await persist({ runId, input, summary, gathered, registry, emit, tracer });
      persisted = true;
    } catch (err) {
      emit("error", {
        scope: "persistence",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  emit("phase", { phase: "done", label: "Complete" });
  emit("run_completed", { summaryId, persisted, trace: tracer.snapshot() });
}

/* ------------------------------------------------------------------ */
/* LLM tool-use loop                                                   */
/* ------------------------------------------------------------------ */

interface RunCtx {
  runId: string;
  input: AppointmentInput;
  emit: Emit;
  tracer: Tracer;
  registry: ToolRegistry;
  gathered: Gathered;
}

interface Gathered {
  procedure?: ProcedureRecord;
  findings: Finding[];
  searches: { query: string; results: SearchResult[] }[];
}

async function runLlm(
  anthropic: Anthropic,
  ctx: RunCtx,
): Promise<OfficeSummary | null> {
  const { input, emit, tracer, registry, gathered } = ctx;

  const tools: Anthropic.Tool[] = [
    ...registry.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    })),
    FINALIZE_TOOL,
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildTaskPrompt(input) },
  ];

  emit("phase", { phase: "research", label: "Researching across sources" });

  for (let step = 0; step < MAX_STEPS; step++) {
    let resp: Anthropic.Message;
    try {
      resp = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    } catch (err) {
      emit("error", {
        scope: "llm",
        message: `LLM call failed: ${err instanceof Error ? err.message : String(err)}. Falling back to heuristic synthesis.`,
      });
      return null;
    }

    tracer.recordLlmCall(resp.usage?.input_tokens, resp.usage?.output_tokens);
    messages.push({ role: "assistant", content: resp.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let finalized: OfficeSummary | null = null;

    for (const block of resp.content) {
      if (block.type === "text" && block.text.trim()) {
        emit("reasoning", { text: block.text.trim() });
      } else if (block.type === "tool_use") {
        if (block.name === "finalize_preparation") {
          finalized = normalizeSummary(input, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "Office summary received and accepted.",
          });
          continue;
        }

        const tool = registry.byName.get(block.name);
        const callId = block.id;
        emit("tool_call", {
          callId,
          tool: block.name,
          source: tool?.source ?? "agent",
          input: block.input,
        });

        const start = Date.now();
        const exec: ToolExecution = tool
          ? await tool.execute((block.input as Record<string, unknown>) ?? {})
          : { ok: false, summary: `Unknown tool ${block.name}`, data: null, error: "unknown_tool" };
        const durationMs = Date.now() - start;
        tracer.recordTool(block.name, durationMs);

        emit("tool_result", {
          callId,
          tool: block.name,
          ok: exec.ok,
          durationMs,
          summary: exec.summary,
          data: exec.data,
          error: exec.error,
        });

        captureGathered(ctx, block.name, exec);
        emitDerivedFindings(emit, block.name, exec, gathered);

        toolResults.push({
          type: "tool_result",
          tool_use_id: callId,
          is_error: !exec.ok,
          content: truncate(JSON.stringify(exec.data ?? { summary: exec.summary }), 8000),
        });
      }
    }

    if (finalized) return finalized;

    if (toolResults.length === 0) {
      // Model produced no tool calls and didn't finalize — stop the loop.
      break;
    }
    messages.push({ role: "user", content: toolResults });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Heuristic loop (no API key) — genuinely exercises all 3 sources     */
/* ------------------------------------------------------------------ */

async function runHeuristic(ctx: RunCtx): Promise<OfficeSummary> {
  const { input, emit } = ctx;

  // Step 0: consult office memory (MCP) before researching.
  emit("phase", { phase: "planning", label: "Checking office memory (MCP)" });
  await runTool(ctx, "get_patient_history", { patientName: input.patientName, limit: 5 }, "memory");
  await runTool(
    ctx,
    "recall_similar_preps",
    { insuranceCarrier: input.insuranceCarrier, procedureCode: input.procedureCode, limit: 3 },
    "memory",
  );

  // Step 1: procedure details (Source 1).
  emit("phase", { phase: "procedure_lookup", label: "Retrieving procedure details (API)" });
  emit("reasoning", {
    text: `Starting with authoritative procedure data for ${input.procedureCode}, then I'll research ${input.insuranceCarrier}'s requirements.`,
  });
  await runTool(ctx, "get_procedure_details", { procedureCode: input.procedureCode }, "procedure");

  // Step 2: targeted research (Source 2) — the agent formulates its own queries.
  emit("phase", { phase: "research", label: "Researching payer & procedure requirements" });
  const proc = ctx.gathered.procedure ?? synthesizeProcedure(input.procedureCode);
  const queries = buildResearchQueries(input, proc);
  for (const q of queries) {
    emit("reasoning", { text: `Searching: "${q.query}" — to learn about ${q.purpose}.` });
    await runTool(ctx, "web_search", { query: q.query }, q.kind);
  }

  // Steps 3-4 happen in synthesizeSummary (risk analysis + recommendations).
  return synthesizeSummary(input, ctx.gathered);
}

interface QuerySpec {
  query: string;
  purpose: string;
  kind: Finding["kind"];
}

function buildResearchQueries(input: AppointmentInput, proc: ProcedureRecord): QuerySpec[] {
  const human = proc.description || input.procedureCode;
  return [
    {
      query: `What is ${human}? procedure explanation`,
      purpose: "the procedure itself",
      kind: "procedure",
    },
    {
      query: `${input.insuranceCarrier} ${human} prior authorization requirements`,
      purpose: "prior authorization",
      kind: "prior_auth",
    },
    {
      query: `${input.insuranceCarrier} ${proc.category} coverage and out-of-pocket cost considerations`,
      purpose: "coverage and cost",
      kind: "coverage",
    },
    {
      query: `${human} patient preparation instructions before the appointment`,
      purpose: "patient preparation",
      kind: "prep",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Tool execution helper (heuristic mode)                              */
/* ------------------------------------------------------------------ */

async function runTool(
  ctx: RunCtx,
  toolName: string,
  input: Record<string, unknown>,
  findingKind: Finding["kind"],
): Promise<ToolExecution> {
  const tool = ctx.registry.byName.get(toolName);
  if (!tool) {
    const miss: ToolExecution = { ok: false, summary: `Tool ${toolName} unavailable`, data: null, error: "missing_tool" };
    return miss;
  }
  const callId = `${ctx.runId}-${toolName}-${Date.now()}`;
  ctx.emit("tool_call", { callId, tool: toolName, source: tool.source, input });
  const start = Date.now();
  const exec = await tool.execute(input);
  const durationMs = Date.now() - start;
  ctx.tracer.recordTool(toolName, durationMs);
  ctx.emit("tool_result", {
    callId,
    tool: toolName,
    ok: exec.ok,
    durationMs,
    summary: exec.summary,
    data: exec.data,
    error: exec.error,
  });
  captureGathered(ctx, toolName, exec);
  emitDerivedFindings(ctx.emit, toolName, exec, ctx.gathered, findingKind);
  return exec;
}

/* ------------------------------------------------------------------ */
/* Gathered-state capture & finding derivation                         */
/* ------------------------------------------------------------------ */

function captureGathered(ctx: RunCtx, toolName: string, exec: ToolExecution) {
  if (!exec.ok || !exec.data) return;
  if (toolName === "get_procedure_details") {
    ctx.gathered.procedure = exec.data as ProcedureRecord;
  } else if (toolName === "web_search") {
    const d = exec.data as { query: string; results: SearchResult[] };
    if (d?.results) ctx.gathered.searches.push({ query: d.query, results: d.results });
  }
}

function emitDerivedFindings(
  emit: Emit,
  toolName: string,
  exec: ToolExecution,
  gathered: Gathered,
  kindHint?: Finding["kind"],
) {
  if (!exec.ok || !exec.data) return;

  if (toolName === "get_procedure_details") {
    const p = exec.data as ProcedureRecord;
    const finding: Finding = {
      id: `f-proc-${p.procedureCode}`,
      kind: "procedure",
      title: `${p.description} (CPT ${p.cptCode})`,
      content: `Category: ${p.category} · Modality: ${p.modality} · Contrast: ${p.usesContrast ? "yes" : "no"} · Est. duration: ${p.estimatedDurationMinutes} min · Typical prior auth: ${p.typicalPriorAuthRequired ? "yes" : "no"}. ${p.patientPrepSummary}`,
      source: "Procedure API",
      confidence: 0.95,
    };
    gathered.findings.push(finding);
    emit("finding", finding);
    return;
  }

  if (toolName === "web_search") {
    const d = exec.data as { query: string; provider: string; results: SearchResult[] };
    (d.results ?? []).slice(0, 3).forEach((r, i) => {
      const finding: Finding = {
        id: `f-search-${gathered.findings.length}-${i}`,
        kind: kindHint ?? "payer",
        title: r.title,
        content: r.snippet,
        source: d.provider === "tavily" ? "Web search (Tavily)" : "Payer knowledge base",
        sourceUrl: r.url,
        confidence: d.provider === "tavily" ? 0.8 : 0.7,
      };
      gathered.findings.push(finding);
      emit("finding", finding);
    });
    return;
  }

  if (toolName === "recall_similar_preps" || toolName === "get_patient_history") {
    const d = exec.data as { matchCount?: number; priorRunCount?: number };
    const count = d.matchCount ?? d.priorRunCount ?? 0;
    if (count > 0) {
      const finding: Finding = {
        id: `f-memory-${toolName}`,
        kind: "memory",
        title:
          toolName === "recall_similar_preps"
            ? `Found ${count} prior prep(s) for this carrier + procedure`
            : `Found ${count} prior record(s) for this patient`,
        content: "Reusing institutional knowledge from previous runs (MCP office-memory).",
        source: "MCP office-memory",
        confidence: 0.9,
      };
      gathered.findings.push(finding);
      emit("finding", finding);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Summary synthesis (heuristic + LLM fallback)                        */
/* ------------------------------------------------------------------ */

function synthesizeSummary(input: AppointmentInput, gathered: Gathered): OfficeSummary {
  const proc = gathered.procedure ?? getProcedure(input.procedureCode) ?? synthesizeProcedure(input.procedureCode);
  const payer = findPayer(input.insuranceCarrier);
  const isImaging = ["MRI", "CT", "PET"].includes(proc.modality);
  const likelyPriorAuth = proc.typicalPriorAuthRequired || isImaging;

  const priorAuthReqs = [
    ...payer.documentationNeeded,
    likelyPriorAuth
      ? `Submit the authorization request via ${payer.portal} well before ${input.appointmentDate}.`
      : "Confirm on the payer portal whether authorization is needed for this CPT code.",
  ];

  const risks: RiskItem[] = [];
  if (likelyPriorAuth) {
    risks.push({
      title: "Prior authorization likely required",
      detail: `${input.insuranceCarrier} typically requires prior authorization for ${proc.category.toLowerCase()} like ${proc.description}. Without it the claim may be denied or the visit cancelled.`,
      severity: "high",
    });
  }
  risks.push({
    title: "Eligibility & network not yet verified",
    detail: `Confirm ${input.patientName}'s active eligibility and that the service location is in-network for ${input.insuranceCarrier}.`,
    severity: "medium",
  });
  if (proc.usesContrast) {
    risks.push({
      title: "Contrast safety screening needed",
      detail: "This study uses contrast — verify renal function (eGFR) and screen for prior contrast allergy before the appointment.",
      severity: "medium",
    });
  }
  if (/prep|fast|bowel|driver|sedation/i.test(proc.patientPrepSummary)) {
    risks.push({
      title: "Prep non-compliance could cancel the visit",
      detail: `Patient prep is required: ${proc.patientPrepSummary} Confirm the patient understands instructions to avoid a same-day cancellation.`,
      severity: "medium",
    });
  }

  const daysUntil = daysBetween(new Date(), new Date(input.appointmentDate));
  if (likelyPriorAuth && Number.isFinite(daysUntil) && daysUntil <= 5) {
    risks.push({
      title: "Tight timeline for authorization",
      detail: `Only ~${daysUntil} day(s) until the appointment. Standard prior-auth review can take 1-3 business days — start immediately or consider expedited review.`,
      severity: "high",
    });
  }

  const recommendedActions: OfficeSummary["recommendedActions"] = [];
  if (likelyPriorAuth) {
    recommendedActions.push({
      action: `Initiate prior authorization with ${input.insuranceCarrier} for ${proc.cptCode} (${proc.description})`,
      rationale: "Advanced imaging / this procedure typically requires authorization; doing it early prevents denials and cancellations.",
      owner: "Billing",
      priority: Number.isFinite(daysUntil) && daysUntil <= 5 ? "urgent" : "high",
      dueBy: input.appointmentDate,
    });
  }
  recommendedActions.push({
    action: `Verify ${input.patientName}'s eligibility, benefits, and in-network status`,
    rationale: "Avoids surprise bills and confirms the visit will be covered.",
    owner: "Front Desk",
    priority: "high",
  });
  recommendedActions.push({
    action: "Confirm patient preparation instructions with the patient",
    rationale: proc.patientPrepSummary,
    owner: "Front Desk",
    priority: "normal",
  });
  if (proc.usesContrast) {
    recommendedActions.push({
      action: "Obtain recent eGFR and screen for contrast allergy",
      rationale: "Required for safe administration of contrast.",
      owner: "Clinical",
      priority: "high",
    });
  }

  const questionsForPatient = [
    "Has your insurance changed since your last visit? Can we confirm your member ID?",
    "Do you have a referral from your primary care provider, if required?",
    proc.usesContrast
      ? "Do you have any kidney problems or a history of allergic reaction to contrast dye?"
      : "Do you have any implants, a pacemaker, or metal in your body?",
  ];
  if (/driver|sedation/i.test(proc.patientPrepSummary)) {
    questionsForPatient.push("Have you arranged for someone to drive you home after sedation?");
  }

  const coverageConsiderations = [
    ...payer.coverageNotes,
    proc.averageCostUsdRange[1] > 0
      ? `Typical total cost for this procedure ranges roughly $${proc.averageCostUsdRange[0].toLocaleString()}–$${proc.averageCostUsdRange[1].toLocaleString()}; patient responsibility depends on deductible/coinsurance.`
      : "Confirm the contracted rate and patient cost-share for this procedure.",
  ];

  const patientPrepInstructions = derivePrepInstructions(proc);

  const headline = likelyPriorAuth
    ? `Prior authorization likely required — start with ${input.insuranceCarrier} now`
    : `Verify benefits — no prior auth expected for ${proc.description}`;

  return {
    patientName: input.patientName,
    insuranceCarrier: input.insuranceCarrier,
    procedureCode: input.procedureCode,
    appointmentDate: input.appointmentDate,
    headline,
    overview: `${input.patientName} is scheduled for ${proc.description} (CPT ${proc.cptCode}) on ${input.appointmentDate}, covered under ${input.insuranceCarrier}. ${likelyPriorAuth ? "This procedure typically requires prior authorization, so billing should act early." : "Prior authorization is not typically required, but eligibility and benefits should still be verified."}`,
    insuranceSummary: `${payer.name}: ${[...payer.generalPriorAuth].slice(0, 1).join(" ")} Submit via ${payer.portal}.`,
    priorAuthorization: {
      likelyRequired: likelyPriorAuth,
      requirements: priorAuthReqs,
      risk: likelyPriorAuth ? (Number.isFinite(daysUntil) && daysUntil <= 5 ? "high" : "medium") : "low",
      notes: likelyPriorAuth
        ? "Requirement is payer- and plan-specific; confirm the exact criteria and turnaround on the provider portal."
        : "Confirm on the portal; some plans still require notification.",
    },
    coverageConsiderations,
    patientPrepInstructions,
    questionsForPatient,
    risksAndGaps: risks,
    recommendedActions,
    estimatedPatientCost:
      proc.averageCostUsdRange[1] > 0
        ? `$${proc.averageCostUsdRange[0].toLocaleString()}–$${proc.averageCostUsdRange[1].toLocaleString()} total (patient share varies by plan)`
        : undefined,
    confidence: gathered.procedure ? 0.78 : 0.6,
  };
}

function derivePrepInstructions(proc: ProcedureRecord): string[] {
  const items = [proc.patientPrepSummary];
  items.push("Arrive 15 minutes early with insurance card, photo ID, and any referral.");
  if (proc.modality === "MRI") {
    items.push("Remove all metal objects; notify staff of any implants, pacemaker, or prior metal eye injury.");
  }
  if (proc.usesContrast) {
    items.push("Confirm recent kidney function and report any prior contrast reaction.");
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Persistence via MCP                                                 */
/* ------------------------------------------------------------------ */

async function persist(args: {
  runId: string;
  input: AppointmentInput;
  summary: OfficeSummary;
  gathered: Gathered;
  registry: ToolRegistry;
  emit: Emit;
  tracer: Tracer;
}): Promise<string | undefined> {
  const { runId, input, summary, gathered, registry, emit, tracer } = args;

  const saveFinding = registry.byName.get("save_finding");
  const saveSummary = registry.byName.get("save_office_summary");

  // Persist a few of the most important findings.
  if (saveFinding) {
    for (const f of gathered.findings.slice(0, 6)) {
      const start = Date.now();
      const exec = await saveFinding.execute({
        runId,
        patientName: input.patientName,
        insuranceCarrier: input.insuranceCarrier,
        procedureCode: input.procedureCode,
        kind: f.kind,
        title: f.title,
        content: f.content,
        source: f.source,
      });
      tracer.recordTool("save_finding", Date.now() - start);
      if (!exec.ok) {
        emit("error", { scope: "persistence", message: exec.error ?? "save_finding failed" });
      }
    }
  }

  if (saveSummary) {
    const callId = `${runId}-save-summary`;
    emit("tool_call", {
      callId,
      tool: "save_office_summary",
      source: "mcp",
      input: { patientName: input.patientName, procedureCode: input.procedureCode },
    });
    const start = Date.now();
    const exec = await saveSummary.execute({
      runId,
      patientName: input.patientName,
      insuranceCarrier: input.insuranceCarrier,
      procedureCode: input.procedureCode,
      appointmentDate: input.appointmentDate,
      summary: summary as unknown as Record<string, unknown>,
    });
    tracer.recordTool("save_office_summary", Date.now() - start);
    emit("tool_result", {
      callId,
      tool: "save_office_summary",
      ok: exec.ok,
      durationMs: Date.now() - start,
      summary: exec.summary,
      data: exec.data,
      error: exec.error,
    });
    const data = exec.data as { id?: string } | null;
    return data?.id;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Summary normalization (from LLM tool input)                         */
/* ------------------------------------------------------------------ */

function normalizeSummary(input: AppointmentInput, raw: Record<string, unknown>): OfficeSummary {
  const pa = (raw.priorAuthorization as Record<string, unknown>) ?? {};
  return {
    patientName: input.patientName,
    insuranceCarrier: input.insuranceCarrier,
    procedureCode: input.procedureCode,
    appointmentDate: input.appointmentDate,
    headline: str(raw.headline, "Appointment preparation summary"),
    overview: str(raw.overview, ""),
    insuranceSummary: str(raw.insuranceSummary, ""),
    priorAuthorization: {
      likelyRequired: Boolean(pa.likelyRequired),
      requirements: strArray(pa.requirements),
      risk: severity(pa.risk),
      notes: str(pa.notes, ""),
    },
    coverageConsiderations: strArray(raw.coverageConsiderations),
    patientPrepInstructions: strArray(raw.patientPrepInstructions),
    questionsForPatient: strArray(raw.questionsForPatient),
    risksAndGaps: ((raw.risksAndGaps as unknown[]) ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      return {
        title: str(o.title, "Risk"),
        detail: str(o.detail, ""),
        severity: severity(o.severity),
      };
    }),
    recommendedActions: ((raw.recommendedActions as unknown[]) ?? []).map((a) => {
      const o = a as Record<string, unknown>;
      return {
        action: str(o.action, ""),
        rationale: str(o.rationale, ""),
        owner: owner(o.owner),
        priority: priority(o.priority),
        dueBy: o.dueBy ? String(o.dueBy) : undefined,
      };
    }),
    estimatedPatientCost: raw.estimatedPatientCost ? String(raw.estimatedPatientCost) : undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.8,
  };
}

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const PLAN_STEPS: PlanStep[] = [
  { id: 1, title: "Recall office memory", description: "Check prior runs for this patient and carrier+procedure (MCP).", toolHint: "get_patient_history" },
  { id: 2, title: "Get procedure details", description: "Retrieve authoritative procedure data.", toolHint: "get_procedure_details" },
  { id: 3, title: "Research requirements", description: "Search payer prior-auth, coverage, and prep guidance.", toolHint: "web_search" },
  { id: 4, title: "Analyze risks & gaps", description: "Reconcile sources and flag what could go wrong." },
  { id: 5, title: "Recommend & persist", description: "Produce actions for staff and save to office memory (MCP).", toolHint: "save_office_summary" },
];

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…(truncated)` : s;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim());
}
function severity(v: unknown): RiskItem["severity"] {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}
function owner(v: unknown): OfficeSummary["recommendedActions"][number]["owner"] {
  return v === "Front Desk" || v === "Billing" || v === "Clinical" || v === "Patient" ? v : "Front Desk";
}
function priority(v: unknown): OfficeSummary["recommendedActions"][number]["priority"] {
  return v === "urgent" || v === "high" || v === "normal" ? v : "normal";
}
