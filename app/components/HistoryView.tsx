"use client";

import { useEffect, useState } from "react";

interface SummaryRow {
  id: string;
  patient_name: string;
  insurance_carrier: string;
  procedure_code: string;
  appointment_date: string | null;
  created_at: string;
}

export function HistoryView({
  refreshKey,
  selectedId,
  onOpen,
  onChanged,
}: {
  refreshKey: number;
  selectedId?: string | null;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pendingDelete, setPendingDelete] = useState<SummaryRow | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/summaries?limit=500")
      .then((r) => r.json())
      .then((data: { summaries?: SummaryRow[] }) => {
        if (cancelled) return;
        setRows(data.summaries ?? []);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, nonce]);

  const refresh = () => {
    setState("loading");
    setNonce((n) => n + 1);
  };

  const remove = async (id: string) => {
    setBusy(true);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/summaries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch {
      setRows(prev);
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  const clearAll = async () => {
    setBusy(true);
    const prev = rows;
    setRows([]);
    try {
      const res = await fetch("/api/summaries", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch {
      setRows(prev);
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  return (
    <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="serif text-xl text-[var(--ink)]">Prep history</h2>
          <p className="text-xs text-[var(--ink-3)]">
            {rows.length} saved {rows.length === 1 ? "prep" : "preps"} in office memory (MCP · SQLite)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh} className="btn-ghost">
            Refresh
          </button>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-md border border-[var(--danger-soft)] px-3 py-1.5 text-sm font-medium text-[var(--danger-ink)] transition hover:bg-[var(--danger-soft)]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
        {state === "loading" && <p className="py-10 text-center text-sm text-[var(--ink-3)]">Loading…</p>}
        {state === "error" && (
          <p className="py-10 text-center text-sm text-[var(--ink-3)]">
            Couldn’t reach the office memory store.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--ink-3)]">
            No saved preps yet. Run one from the dashboard to populate office memory.
          </p>
        )}
        {state === "ready" && rows.length > 0 && (
          <table className="kf-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Carrier</th>
                <th>Procedure</th>
                <th>Appointment</th>
                <th>Saved</th>
                <th className="w-px whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-selected={row.id === selectedId}>
                  <td className="font-medium text-[var(--ink)]">{row.patient_name}</td>
                  <td>{row.insurance_carrier}</td>
                  <td>
                    <code className="font-mono text-xs">{row.procedure_code}</code>
                  </td>
                  <td>{row.appointment_date ?? "—"}</td>
                  <td className="text-[var(--ink-3)]">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="w-px whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onOpen(row.id)}
                        title="View prep"
                        aria-label={`View prep for ${row.patient_name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-3)] transition hover:bg-[var(--bg-2)] hover:text-[var(--accent-ink)]"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        title="Delete prep"
                        aria-label={`Delete prep for ${row.patient_name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-3)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)]"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="Delete prep?"
          message={
            <>
              This permanently removes the prep for{" "}
              <strong className="text-[var(--ink)]">{pendingDelete.patient_name}</strong> (
              {pendingDelete.procedure_code}) and its research findings from office memory.
            </>
          }
          confirmLabel="Delete"
          busy={busy}
          onConfirm={() => remove(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {confirmClear && (
        <ConfirmModal
          title="Clear all office memory?"
          message={
            <>
              This permanently removes <strong className="text-[var(--ink)]">all {rows.length} preps</strong>{" "}
              and their findings. This cannot be undone.
            </>
          }
          confirmLabel="Clear all"
          busy={busy}
          onConfirm={clearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="card w-full max-w-sm p-5 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger-ink)]">
            <TrashIcon />
          </span>
          <h3 className="text-base font-semibold text-[var(--ink)]">{title}</h3>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-[var(--ink-2)]">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7m4 4v6m4-6v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
