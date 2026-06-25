"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/useAuth";

interface Health {
  agentMode: "llm" | "heuristic";
  model: string | null;
  searchProvider: "tavily" | "knowledge_base";
  procedureCodes?: string[];
}

export function SettingsView({
  health,
  user,
  onChanged,
}: {
  health: Health | null;
  user: User;
  onChanged: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refreshCount = () => {
    fetch("/api/summaries?limit=500")
      .then((r) => r.json())
      .then((d: { summaries?: unknown[] }) => setCount(d.summaries?.length ?? 0))
      .catch(() => setCount(null));
  };

  useEffect(refreshCount, []);

  const clearAll = async () => {
    setClearing(true);
    try {
      await fetch("/api/summaries", { method: "DELETE" });
      onChanged();
      refreshCount();
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const llm = health?.agentMode === "llm";
  const tavily = health?.searchProvider === "tavily";

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div>
          <h2 className="serif text-2xl text-[var(--ink)]">Settings</h2>
          <p className="text-sm text-[var(--ink-3)]">System status, account, and office-memory management.</p>
        </div>

        <section className="card p-5">
          <h3 className="section-title mb-3">System status</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusItem
              on={llm}
              label="Agent reasoning"
              value={llm ? `LLM · ${health?.model ?? "Claude"}` : "Heuristic planner"}
              hint={llm ? "Anthropic API key detected." : "No ANTHROPIC_API_KEY — deterministic fallback."}
            />
            <StatusItem
              on={tavily}
              label="Search provider"
              value={tavily ? "Tavily (live web)" : "Knowledge base (offline)"}
              hint={tavily ? "Live web search enabled." : "No TAVILY_API_KEY — curated payer KB."}
            />
            <StatusItem on label="MCP office memory" value="Connected · SQLite" hint="Custom MCP server over stdio." />
            <StatusItem
              on
              label="Procedure catalog"
              value={`${health?.procedureCodes?.length ?? 0} codes`}
              hint="Source 1 — procedure JSON API."
            />
          </div>
        </section>

        <section className="card p-5">
          <h3 className="section-title mb-3">Account</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <KV label="Name" value={user.name} />
            <KV label="Role" value={user.role} />
          </div>
          <p className="mt-3 text-xs text-[var(--ink-3)]">
            This is a local demo sign-in. Use the avatar menu (top right) to sign out.
          </p>
        </section>

        <section className="card p-5">
          <h3 className="section-title mb-3">Office memory</h3>
          <p className="mb-4 text-sm text-[var(--ink-2)]">
            {count === null ? "—" : count} saved {count === 1 ? "prep" : "preps"} persisted via MCP. Clearing
            removes all summaries and their research findings. This cannot be undone.
          </p>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing}
                className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {clearing ? "Clearing…" : "Yes, clear everything"}
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={!count}
              className="rounded-md border border-[var(--danger-soft)] px-3 py-1.5 text-sm font-medium text-[var(--danger-ink)] transition hover:bg-[var(--danger-soft)] disabled:opacity-50"
            >
              Clear all office memory
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusItem({
  on,
  label,
  value,
  hint,
}: {
  on: boolean;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg)] p-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: on ? "var(--mint)" : "var(--ink-3)" }}
        />
        <span className="text-xs font-medium text-[var(--ink-3)]">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">{hint}</p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2">
      <span className="text-xs text-[var(--ink-3)]">{label}</span>
      <span className="text-sm text-[var(--ink)]">{value}</span>
    </div>
  );
}
