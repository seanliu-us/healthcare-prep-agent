"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/useAuth";
import { RecentRuns } from "./RecentRuns";

interface Health {
  agentMode: "llm" | "heuristic";
  model: string | null;
  searchProvider: "tavily" | "knowledge_base";
  procedureCodes?: string[];
}

export function DashboardView({
  user,
  health,
  refreshKey,
  selectedId,
  onNewPrep,
  onOpen,
  onDeleted,
  onGoHistory,
  onGoSettings,
}: {
  user: User;
  health: Health | null;
  refreshKey: number;
  selectedId?: string | null;
  onNewPrep: () => void;
  onOpen: (id: string) => void;
  onDeleted?: (id: string) => void;
  onGoHistory: () => void;
  onGoSettings: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/summaries?limit=500")
      .then((r) => r.json())
      .then((d: { summaries?: unknown[] }) => setCount(d.summaries?.length ?? 0))
      .catch(() => setCount(null));
  }, [refreshKey]);

  const llm = health?.agentMode === "llm";
  const tavily = health?.searchProvider === "tavily";

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {/* Greeting + primary CTA */}
        <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-[var(--ink-3)]">{greeting()}</p>
            <h1 className="serif mt-1 text-2xl text-[var(--ink)]">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-2)]">
              Prepare a patient appointment in seconds — the agent researches insurance, prior auth,
              coverage, and prep, then writes an office-ready summary.
            </p>
          </div>
          <button type="button" onClick={onNewPrep} className="cta cta-accent shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Start new prep
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Saved preps"
            value={count === null ? "—" : String(count)}
            hint="In office memory (MCP)"
            onClick={onGoHistory}
          />
          <StatCard
            label="Agent reasoning"
            value={llm ? "LLM" : "Heuristic"}
            hint={llm ? health?.model ?? "Claude" : "Deterministic fallback"}
            dot={llm}
            onClick={onGoSettings}
          />
          <StatCard
            label="Search"
            value={tavily ? "Tavily" : "Knowledge base"}
            hint={tavily ? "Live web search" : "Offline payer KB"}
            dot={tavily}
            onClick={onGoSettings}
          />
          <StatCard
            label="Procedure catalog"
            value={`${health?.procedureCodes?.length ?? 0}`}
            hint="Codes available"
            dot
            onClick={onGoSettings}
          />
        </div>

        {/* Recent preps */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 className="section-title">Recent preps</h2>
              <p className="text-xs text-[var(--ink-3)]">Open a saved prep to review its breakdown</p>
            </div>
            <button
              type="button"
              onClick={onGoHistory}
              className="text-sm font-medium text-[var(--accent-ink)] transition hover:underline"
            >
              View all →
            </button>
          </div>
          <div className="p-2">
            <RecentRuns
              refreshKey={refreshKey}
              selectedId={selectedId}
              onSelect={onOpen}
              onDeleted={onDeleted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  dot,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  dot?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex flex-col items-start gap-1 p-4 text-left transition hover:border-[var(--ink-3)]"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-3)]">
        {dot !== undefined && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dot ? "var(--mint)" : "var(--ink-3)" }}
          />
        )}
        {label}
      </span>
      <span className="text-2xl font-semibold text-[var(--ink)]">{value}</span>
      <span className="text-[11px] text-[var(--ink-3)]">{hint}</span>
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
