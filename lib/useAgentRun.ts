"use client";

import { useCallback, useReducer, useRef } from "react";
import type {
  AgentEvent,
  AgentMode,
  AgentPhase,
  AppointmentInput,
  Finding,
  OfficeSummary,
  PlanStep,
  RecommendedAction,
  RiskItem,
  TracePayload,
} from "@/lib/types";

export type RunStatus = "idle" | "running" | "awaiting_approval" | "done" | "error";

export type TimelineItem =
  | { kind: "plan"; id: string; thought: string; steps: PlanStep[] }
  | { kind: "phase"; id: string; phase: AgentPhase; label: string }
  | { kind: "reasoning"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      callId: string;
      tool: string;
      source: string;
      input: unknown;
      status: "running" | "done" | "error";
      summary?: string;
      data?: unknown;
      durationMs?: number;
      error?: string;
    }
  | { kind: "approval"; id: string; approvalId: string; decision?: string }
  | { kind: "error"; id: string; message: string };

export interface RunState {
  status: RunStatus;
  mode?: AgentMode;
  model?: string;
  input?: AppointmentInput;
  phase?: AgentPhase;
  timeline: TimelineItem[];
  findings: Finding[];
  risks: RiskItem[];
  recommendations: RecommendedAction[];
  summary?: OfficeSummary;
  approval?: { approvalId: string; summary: OfficeSummary };
  trace?: TracePayload;
  persisted?: boolean;
  error?: string;
  /** Which source produced the currently-displayed summary. */
  source: "idle" | "live" | "history";
  /** ID of the persisted summary being viewed (history mode). */
  loadedSummaryId?: string;
  /** Run id (for live runs) or the persisted run id (history). */
  runId?: string;
  /** When this run/summary was created. */
  createdAt?: string;
}

const initialState: RunState = {
  status: "idle",
  timeline: [],
  findings: [],
  risks: [],
  recommendations: [],
  source: "idle",
};

type Action =
  | { type: "reset" }
  | { type: "event"; event: AgentEvent }
  | { type: "status"; status: RunStatus }
  | {
      type: "load_history";
      input: AppointmentInput;
      summary: OfficeSummary;
      summaryId: string;
      runId?: string;
      createdAt?: string;
    };

function reducer(state: RunState, action: Action): RunState {
  if (action.type === "reset") return { ...initialState };
  if (action.type === "status") return { ...state, status: action.status };
  if (action.type === "load_history") {
    return {
      ...initialState,
      status: "done",
      source: "history",
      input: action.input,
      summary: action.summary,
      loadedSummaryId: action.summaryId,
      runId: action.runId,
      createdAt: action.createdAt,
      risks: action.summary.risksAndGaps,
      recommendations: action.summary.recommendedActions,
    };
  }

  const { event } = action;
  const data = event.data as Record<string, unknown>;
  const id = event.id;

  switch (event.type) {
    case "run_started":
      return {
        ...initialState,
        status: "running",
        source: "live",
        mode: data.mode as AgentMode,
        model: data.model as string | undefined,
        input: data.input as AppointmentInput,
        runId: event.runId,
        createdAt: new Date(event.ts).toISOString(),
      };

    case "plan":
      return {
        ...state,
        timeline: [
          ...state.timeline,
          { kind: "plan", id, thought: String(data.thought ?? ""), steps: (data.steps as PlanStep[]) ?? [] },
        ],
      };

    case "phase":
      return {
        ...state,
        phase: data.phase as AgentPhase,
        timeline: [
          ...state.timeline,
          { kind: "phase", id, phase: data.phase as AgentPhase, label: String(data.label ?? "") },
        ],
      };

    case "reasoning":
      return {
        ...state,
        timeline: [...state.timeline, { kind: "reasoning", id, text: String(data.text ?? "") }],
      };

    case "tool_call":
      return {
        ...state,
        timeline: [
          ...state.timeline,
          {
            kind: "tool",
            id,
            callId: String(data.callId),
            tool: String(data.tool),
            source: String(data.source),
            input: data.input,
            status: "running",
          },
        ],
      };

    case "tool_result": {
      const callId = String(data.callId);
      return {
        ...state,
        timeline: state.timeline.map((item) =>
          item.kind === "tool" && item.callId === callId
            ? {
                ...item,
                status: data.ok ? "done" : "error",
                summary: String(data.summary ?? ""),
                data: data.data,
                durationMs: data.durationMs as number | undefined,
                error: data.error as string | undefined,
              }
            : item,
        ),
      };
    }

    case "finding":
      return { ...state, findings: [...state.findings, data as unknown as Finding] };

    case "risk":
      return { ...state, risks: [...state.risks, data as unknown as RiskItem] };

    case "recommendation":
      return { ...state, recommendations: [...state.recommendations, data as unknown as RecommendedAction] };

    case "summary":
      return { ...state, summary: data as unknown as OfficeSummary };

    case "approval_required":
      return {
        ...state,
        status: "awaiting_approval",
        approval: { approvalId: String(data.approvalId), summary: data.summary as OfficeSummary },
        timeline: [...state.timeline, { kind: "approval", id, approvalId: String(data.approvalId) }],
      };

    case "approval_resolved":
      return {
        ...state,
        status: "running",
        approval: undefined,
        timeline: state.timeline.map((item) =>
          item.kind === "approval" && item.approvalId === String(data.approvalId)
            ? { ...item, decision: String(data.decision) }
            : item,
        ),
      };

    case "trace":
      return { ...state, trace: data as unknown as TracePayload };

    case "run_completed":
      return {
        ...state,
        status: "done",
        trace: (data.trace as TracePayload) ?? state.trace,
        persisted: Boolean(data.persisted),
      };

    case "error":
      return {
        ...state,
        timeline: [...state.timeline, { kind: "error", id, message: String(data.message ?? "Unknown error") }],
        error: String(data.message ?? "Unknown error"),
      };

    default:
      return state;
  }
}

export function useAgentRun() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (input: AppointmentInput & { requireApproval: boolean }) => {
    dispatch({ type: "reset" });
    dispatch({ type: "status", status: "running" });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`Agent request failed (${res.status}). ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json) as AgentEvent;
            dispatch({ type: "event", event: evt });
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      dispatch({
        type: "event",
        event: {
          id: "client-error",
          runId: "client",
          seq: -1,
          ts: Date.now(),
          type: "error",
          data: { message: err instanceof Error ? err.message : String(err) },
        },
      });
      dispatch({ type: "status", status: "error" });
    }
  }, []);

  const decide = useCallback(async (approvalId: string, decision: "approved" | "rejected") => {
    await fetch("/api/agent/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision }),
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    abortRef.current?.abort();
    try {
      const res = await fetch(`/api/summaries/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        id: string;
        runId?: string;
        patientName: string;
        insuranceCarrier: string;
        procedureCode: string;
        appointmentDate?: string;
        createdAt: string;
        summary: OfficeSummary;
      };
      dispatch({
        type: "load_history",
        summaryId: data.id,
        runId: data.runId,
        createdAt: data.createdAt,
        input: {
          patientName: data.patientName,
          insuranceCarrier: data.insuranceCarrier,
          procedureCode: data.procedureCode,
          appointmentDate: data.appointmentDate ?? data.summary.appointmentDate,
        },
        summary: data.summary,
      });
    } catch (err) {
      dispatch({
        type: "event",
        event: {
          id: "client-error",
          runId: "client",
          seq: -1,
          ts: Date.now(),
          type: "error",
          data: { message: err instanceof Error ? err.message : String(err) },
        },
      });
    }
  }, []);

  return { state, start, decide, reset, loadHistory };
}
