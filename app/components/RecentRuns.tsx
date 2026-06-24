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
}

export function RecentRuns({ refreshKey, selectedId, onSelect }: RecentRunsProps) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
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

  if (state === "loading") {
    return <Empty>Loading…</Empty>;
  }
  if (state === "error") {
    return <Empty>Couldn’t reach the office memory store.</Empty>;
  }
  if (rows.length === 0) {
    return <Empty>No prior preps yet. Run one to see it here.</Empty>;
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row.id)}
              className={`flex w-full flex-col gap-0.5 rounded-[var(--rad-sm)] border px-3 py-2.5 text-left transition ${
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
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-xs text-[var(--ink-3)]">{children}</p>;
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
