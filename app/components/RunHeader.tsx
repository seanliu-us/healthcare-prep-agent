"use client";

import type { AppointmentInput } from "@/lib/types";
import type { RunStatus } from "@/lib/useAgentRun";

interface RunHeaderProps {
  input?: AppointmentInput;
  runId?: string;
  status: RunStatus;
  elapsedMs?: number;
  source: "live" | "history" | "idle";
  createdAt?: string;
  onReset: () => void;
}

export function RunHeader({
  input,
  runId,
  status,
  elapsedMs,
  source,
  createdAt,
  onReset,
}: RunHeaderProps) {
  const placeholder = !input;
  return (
    <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={status} source={source} />
          {runId && (
            <code className="font-mono text-[11px] text-[var(--ink-3)]">
              run · {runId.slice(0, 8)}
            </code>
          )}
          {createdAt && (
            <span className="text-[11px] text-[var(--ink-3)]">
              {new Date(createdAt).toLocaleString()}
            </span>
          )}
          {typeof elapsedMs === "number" && elapsedMs > 0 && (
            <span className="text-[11px] text-[var(--ink-3)]">· {(elapsedMs / 1000).toFixed(1)}s</span>
          )}
        </div>
        <h2 className="serif truncate text-2xl text-[var(--ink)]">
          {placeholder ? "Select or start an appointment" : input!.patientName}
        </h2>
        <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Item label="Carrier" value={input?.insuranceCarrier ?? "—"} />
          <Item label="Procedure" value={input?.procedureCode ?? "—"} mono />
          <Item label="Appointment" value={input?.appointmentDate ?? "—"} />
        </dl>
      </div>
      <div className="flex gap-2">
        {!placeholder && (
          <button type="button" onClick={onReset} className="btn-ghost">
            New prep
          </button>
        )}
      </div>
    </div>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className={`text-sm text-[var(--ink-2)] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status, source }: { status: RunStatus; source: "live" | "history" | "idle" }) {
  if (source === "history") {
    return (
      <span className="chip">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-3)" }} />
        Saved prep
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="chip" style={{ color: "var(--accent-ink)" }}>
        <span className="pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        Running
      </span>
    );
  }
  if (status === "awaiting_approval") {
    return (
      <span className="chip" style={{ color: "var(--warn-ink)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
        Awaiting approval
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="chip" style={{ color: "var(--mint-ink)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--mint)" }} />
        Complete
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="chip" style={{ color: "var(--danger-ink)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger)" }} />
        Error
      </span>
    );
  }
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-3)" }} />
      Idle
    </span>
  );
}
