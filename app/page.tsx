"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentRun } from "@/lib/useAgentRun";
import { RunForm } from "./components/RunForm";
import { Timeline } from "./components/Timeline";
import { Findings } from "./components/Findings";
import { SummaryView } from "./components/SummaryView";
import { ApprovalBar } from "./components/ApprovalBar";
import { RunHeader } from "./components/RunHeader";
import { RecentRuns } from "./components/RecentRuns";
import { Tabs, type TabDef } from "./components/Tabs";
import { Badge } from "./components/ui";

interface Health {
  agentMode: "llm" | "heuristic";
  model: string | null;
  searchProvider: "tavily" | "knowledge_base";
}

type TabId = "summary" | "activity" | "findings" | "trace";

export default function Home() {
  const { state, start, decide, reset, loadHistory } = useAgentRun();
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<TabId>("summary");
  const [refreshKey, setRefreshKey] = useState(0);
  const lastStatus = useRef(state.status);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Auto-switch to Activity while running, to Summary when done.
  useEffect(() => {
    if (state.status === "running" && lastStatus.current !== "running") setTab("activity");
    if (state.status === "done" && lastStatus.current !== "done") setTab("summary");
    if (state.status === "done" && state.source === "live") {
      setRefreshKey((k) => k + 1);
    }
    lastStatus.current = state.status;
  }, [state.status, state.source]);

  useEffect(() => {
    if (state.source === "history") setTab("summary");
  }, [state.loadedSummaryId, state.source]);

  const tabs: TabDef[] = useMemo(
    () => [
      { id: "summary", label: "Summary", hidden: !state.summary },
      { id: "activity", label: "Activity", count: state.timeline.length || undefined, hidden: state.source === "history" },
      { id: "findings", label: "Findings", count: state.findings.length || undefined, hidden: state.source === "history" || state.findings.length === 0 },
      { id: "trace", label: "Trace", hidden: state.source === "history" || !state.trace },
    ],
    [state.summary, state.timeline.length, state.findings.length, state.source, state.trace],
  );

  const running = state.status === "running" || state.status === "awaiting_approval";
  const visibleTab: TabId = tabs.find((t) => t.id === tab && !t.hidden) ? tab : (tabs.find((t) => !t.hidden)?.id as TabId) ?? "summary";

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-5 py-5 sm:px-7 lg:h-dvh lg:overflow-hidden">
      {/* ------------ Top app bar ------------ */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="leading-tight">
            <p className="serif text-lg text-[var(--ink)]">PrepPilot</p>
            <p className="text-xs text-[var(--ink-3)]">Appointment preparation workspace</p>
          </div>
        </div>
        <StatusBar health={health} mode={state.mode} />
      </header>

      <div className="grid flex-1 gap-5 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ------------ Left rail ------------ */}
        <aside className="flex flex-col gap-4 lg:min-h-0">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <h3 className="eyebrow text-[var(--ink-3)]">New prep</h3>
            </div>
            <div className="p-4">
              <RunForm disabled={running} onSubmit={(input) => start(input)} />
            </div>
          </div>

          <div className="card flex flex-col overflow-hidden lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <h3 className="eyebrow text-[var(--ink-3)]">Recent preps</h3>
              <span className="text-[11px] text-[var(--ink-3)]">from office memory</span>
            </div>
            <div className="scroll-thin max-h-[22rem] flex-1 overflow-y-auto p-2 lg:max-h-none lg:min-h-0">
              <RecentRuns
                refreshKey={refreshKey}
                selectedId={state.loadedSummaryId}
                onSelect={(id) => loadHistory(id)}
                onDeleted={(id) => {
                  if (state.loadedSummaryId === id) reset();
                }}
              />
            </div>
          </div>
        </aside>

        {/* ------------ Workspace ------------ */}
        <main className="flex min-w-0 flex-col gap-4 lg:min-h-0">
          <RunHeader
            input={state.input}
            runId={state.runId}
            status={state.status}
            elapsedMs={state.trace?.elapsedMs}
            source={state.source}
            createdAt={state.createdAt}
            onReset={() => reset()}
          />

          {state.approval && (
            <ApprovalBar onDecision={(d) => decide(state.approval!.approvalId, d)} />
          )}

          {state.source === "idle" ? (
            <EmptyWorkspace />
          ) : (
            <div className="card flex min-h-0 flex-1 flex-col">
              <div className="px-4 pt-3">
                <Tabs
                  tabs={tabs}
                  active={visibleTab}
                  onChange={(id) => setTab(id as TabId)}
                  right={
                    state.source === "live" && state.persisted ? (
                      <Badge tone="mint">Saved</Badge>
                    ) : null
                  }
                />
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
                {visibleTab === "summary" && state.summary && (
                  <SummaryView summary={state.summary} />
                )}
                {visibleTab === "activity" && (
                  <Timeline items={state.timeline} running={running} />
                )}
                {visibleTab === "findings" && <Findings findings={state.findings} />}
                {visibleTab === "trace" && state.trace && (
                  <TraceView
                    trace={state.trace}
                    persisted={state.persisted}
                    mode={state.mode}
                    model={state.model}
                  />
                )}
                {visibleTab === "summary" && !state.summary && (
                  <EmptyTab message="The summary will appear here when the run is complete." />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-2)] pt-4 text-xs text-[var(--ink-3)]">
        <span>PrepPilot · proof-of-concept · synthetic data only</span>
        <span>Next.js · Anthropic · MCP · SQLite</span>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StatusBar({
  health,
  mode,
}: {
  health: Health | null;
  mode?: "llm" | "heuristic";
}) {
  const effectiveMode = mode ?? health?.agentMode;
  const isLive = effectiveMode === "llm";
  const searchLive = health?.searchProvider === "tavily";
  return (
    <div className="hidden flex-wrap items-center gap-3 text-xs text-[var(--ink-3)] sm:flex">
      <Indicator
        on={isLive}
        onLabel={`LLM · ${health?.model ?? "Claude"}`}
        offLabel="Heuristic mode"
        title={isLive ? "Anthropic API key detected." : "No API key — running deterministic heuristic planner."}
      />
      <span className="h-3 w-px bg-[var(--line)]" />
      <Indicator
        on={searchLive}
        onLabel="Search · Tavily"
        offLabel="Search · Knowledge base"
        title={searchLive ? "Live web search via Tavily." : "Curated payer knowledge base (offline)."}
      />
      <span className="h-3 w-px bg-[var(--line)]" />
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--mint)" }} />
        MCP connected
      </span>
    </div>
  );
}

function Indicator({
  on,
  onLabel,
  offLabel,
  title,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  title: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: on ? "var(--mint)" : "var(--ink-3)" }}
      />
      {on ? onLabel : offLabel}
    </span>
  );
}

function EmptyWorkspace() {
  return (
    <div className="card flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
      <Mark large />
      <p className="serif mt-2 text-xl text-[var(--ink)]">Start a new prep</p>
      <p className="max-w-sm text-sm text-[var(--ink-2)]">
        Submit an appointment in the left rail, or open a saved prep from office memory to view it
        here.
      </p>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-[var(--ink-3)]">{message}</p>;
}

function TraceView({
  trace,
  persisted,
  mode,
  model,
}: {
  trace: NonNullable<ReturnType<typeof useAgentRun>["state"]["trace"]>;
  persisted?: boolean;
  mode?: "llm" | "heuristic";
  model?: string;
}) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Tool calls" value={String(trace.totalToolCalls)} />
        <Stat label="LLM calls" value={String(trace.llmCalls)} />
        <Stat label="Elapsed" value={`${(trace.elapsedMs / 1000).toFixed(1)}s`} />
        <Stat
          label="Tokens"
          value={trace.inputTokens ? `${trace.inputTokens} / ${trace.outputTokens ?? 0}` : "—"}
        />
      </div>
      <div>
        <p className="eyebrow mb-2 text-[var(--ink-3)]">Tool breakdown</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trace.toolBreakdown).map(([tool, n]) => (
            <span key={tool} className="chip">
              <code className="font-mono">{tool}</code> ×{n}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <KV label="Mode" value={mode === "llm" ? `LLM · ${model ?? "Claude"}` : "Heuristic planner"} />
        <KV label="Persisted" value={persisted ? "Yes (office memory)" : "No"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg)] p-3">
      <p className="field-label">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-[var(--ink)]">{value}</p>
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

function Mark({ large = false }: { large?: boolean }) {
  const size = large ? "h-12 w-12" : "h-9 w-9";
  const icon = large ? 22 : 18;
  return (
    <span
      aria-hidden
      className={`flex ${size} items-center justify-center rounded-[10px] border border-[color-mix(in_oklch,var(--accent)_35%,white)] bg-[color-mix(in_oklch,var(--accent)_8%,white)]`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 13.5l4.5 4.5L20 6.5"
          stroke="var(--accent-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
