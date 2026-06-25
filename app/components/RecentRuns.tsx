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

interface RecentRunsProps {
  /** Bumping this value triggers a refresh (e.g., after a run completes). */
  refreshKey: number;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Called after a prep is successfully deleted. */
  onDeleted?: (id: string) => void;
}

export function RecentRuns({ refreshKey, selectedId, onSelect, onDeleted }: RecentRunsProps) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/summaries")
      .then((r) => r.json())
      .then((data: { summaries?: SummaryRow[] }) => {
        if (cancelled) return;
        setRows(data.summaries ?? []);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const remove = async (id: string) => {
    setDeletingId(id);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/summaries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted?.(id);
    } catch {
      setRows(prev); // restore on failure
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (state === "loading") return <Empty>Loading…</Empty>;
  if (state === "error") return <Empty>Couldn’t reach the office memory store.</Empty>;
  if (rows.length === 0) return <Empty>No prior preps yet. Run one to see it here.</Empty>;

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const selected = row.id === selectedId;
        const confirming = confirmId === row.id;
        return (
          <li key={row.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(row.id)}
              className={`flex w-full flex-col gap-0.5 rounded-[var(--rad-sm)] border px-3 py-2.5 pr-9 text-left transition ${
                selected
                  ? "border-[color-mix(in_oklch,var(--accent)_35%,white)] bg-[color-mix(in_oklch,var(--accent)_6%,white)]"
                  : "border-transparent hover:border-[var(--line)] hover:bg-[var(--bg-2)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[var(--ink)]">
                  {row.patient_name}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--ink-3)]">
                  {relativeTime(row.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                <span className="truncate">{row.insurance_carrier}</span>
                <span>·</span>
                <code className="font-mono">{row.procedure_code}</code>
                {row.appointment_date && (
                  <>
                    <span>·</span>
                    <span>{row.appointment_date}</span>
                  </>
                )}
              </div>
            </button>

            {confirming ? (
              <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  disabled={deletingId === row.id}
                  className="rounded-md bg-[var(--danger)] px-2 py-1 text-[11px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {deletingId === row.id ? "…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] text-[var(--ink-2)] transition hover:border-[var(--ink-3)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Remove prep for ${row.patient_name}`}
                title="Remove"
                onClick={() => setConfirmId(row.id)}
                className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-3)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)] focus:opacity-100 focus-visible:opacity-100"
              >
                <TrashIcon />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-xs text-[var(--ink-3)]">{children}</p>;
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
