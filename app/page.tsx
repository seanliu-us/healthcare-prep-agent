"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentRun } from "@/lib/useAgentRun";
import { useAuth } from "@/lib/useAuth";
import { RunForm } from "./components/RunForm";
import { Timeline } from "./components/Timeline";
import { Findings } from "./components/Findings";
import { SummaryView } from "./components/SummaryView";
import { OutreachKit } from "./components/OutreachKit";
import { ApprovalBar } from "./components/ApprovalBar";
import { RunHeader } from "./components/RunHeader";
import { RecentRuns } from "./components/RecentRuns";
import { Tabs, type TabDef } from "./components/Tabs";
import { Sidebar, type View } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AskAi } from "./components/AskAi";
import { DashboardView } from "./components/DashboardView";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
import { Login } from "./components/Login";
import { Badge } from "./components/ui";

interface Health {
  agentMode: "llm" | "heuristic";
  model: string | null;
  searchProvider: "tavily" | "knowledge_base";
  procedureCodes?: string[];
}

type TabId = "summary" | "outreach" | "activity" | "findings" | "trace";

export default function Home() {
  const { user, ready, signIn, signOut } = useAuth();
  const { state, start, decide, reset, loadHistory } = useAgentRun();
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<TabId>("summary");
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<View>("dashboard");
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Adjust the active tab when the run status changes. Done during render (with a
  // previous-value guard) rather than in an effect — the pattern React recommends
  // for deriving state from changes (avoids extra render passes).
  const [prevStatus, setPrevStatus] = useState(state.status);
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (state.status === "running") setTab("activity");
    if (state.status === "done") {
      setTab("summary");
      if (state.source === "live") setRefreshKey((k) => k + 1);
    }
  }

  const [prevLoaded, setPrevLoaded] = useState(state.loadedSummaryId);
  if (state.loadedSummaryId !== prevLoaded) {
    setPrevLoaded(state.loadedSummaryId);
    if (state.source === "history") setTab("summary");
  }

  const tabs: TabDef[] = useMemo(
    () => [
      { id: "summary", label: "Summary", hidden: !state.summary },
      { id: "outreach", label: "Outreach", hidden: !state.summary },
      { id: "activity", label: "Activity", count: state.timeline.length || undefined, hidden: state.source === "history" },
      { id: "findings", label: "Findings", count: state.findings.length || undefined, hidden: state.source === "history" || state.findings.length === 0 },
      { id: "trace", label: "Trace", hidden: state.source === "history" || !state.trace },
    ],
    [state.summary, state.timeline.length, state.findings.length, state.source, state.trace],
  );

  const running = state.status === "running" || state.status === "awaiting_approval";
  const visibleTab: TabId = tabs.find((t) => t.id === tab && !t.hidden) ? tab : (tabs.find((t) => !t.hidden)?.id as TabId) ?? "summary";

  const focusNewPrep = () => {
    reset();
    setView("newprep");
    requestAnimationFrame(() => {
      const el = document.getElementById("new-prep");
      const input = el?.querySelector("input");
      (input as HTMLInputElement | null)?.focus();
    });
  };

  const openPrep = (id: string) => {
    loadHistory(id);
    setView("newprep");
  };

  if (!ready) {
    return <div className="min-h-dvh bg-[var(--bg-2)]" />;
  }
  if (!user) {
    return <Login onSignIn={(name, role) => signIn(name, role)} />;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--bg)]">
      <Sidebar
        view={view}
        onSelect={setView}
        onNew={focusNewPrep}
        expanded={navExpanded}
        onToggle={() => setNavExpanded((v) => !v)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          statusSlot={<StatusBar health={health} mode={state.mode} />}
          user={user}
          onSignOut={signOut}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto flex h-full max-w-[1320px] flex-col px-4 py-4 sm:px-6 sm:py-5">
            {view === "dashboard" ? (
              <DashboardView
                user={user}
                health={health}
                refreshKey={refreshKey}
                selectedId={state.loadedSummaryId}
                onNewPrep={focusNewPrep}
                onOpen={openPrep}
                onDeleted={(id) => {
                  if (state.loadedSummaryId === id) reset();
                }}
                onGoHistory={() => setView("history")}
                onGoSettings={() => setView("settings")}
              />
            ) : view === "history" ? (
              <HistoryView
                refreshKey={refreshKey}
                selectedId={state.loadedSummaryId}
                onOpen={openPrep}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            ) : view === "settings" ? (
              <SettingsView health={health} user={user} onChanged={() => setRefreshKey((k) => k + 1)} />
            ) : (
            <div className="grid flex-1 gap-5 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* ---------- Left rail ---------- */}
              <aside className="flex flex-col gap-4 lg:min-h-0">
                <div id="new-prep" className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <h3 className="eyebrow text-[var(--ink-3)]">New prep</h3>
                  </div>
                  <div className="p-4">
                    <RunForm disabled={running} onSubmit={(input) => start(input)} />
                  </div>
                </div>

                <div
                  id="recent-preps"
                  className="card flex flex-col overflow-hidden lg:min-h-0 lg:flex-1"
                >
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <h3 className="eyebrow text-[var(--ink-3)]">Recent preps</h3>
                    <span className="text-[11px] text-[var(--ink-3)]">office memory</span>
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

              {/* ---------- Workspace ---------- */}
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
                      {visibleTab === "outreach" && state.summary && (
                        <OutreachKit
                          summary={state.summary}
                          aiAvailable={(state.mode ?? health?.agentMode) === "llm"}
                        />
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
            )}
          </div>
        </div>
      </div>

      <AskAi summary={state.summary} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StatusBar({ health, mode }: { health: Health | null; mode?: "llm" | "heuristic" }) {
  const effectiveMode = mode ?? health?.agentMode;
  const isLive = effectiveMode === "llm";
  const searchLive = health?.searchProvider === "tavily";
  return (
    <div className="mr-1 hidden items-center gap-3 text-xs text-[var(--ink-3)] lg:flex">
      <Indicator
        on={isLive}
        onLabel={`LLM · ${health?.model ?? "Claude"}`}
        offLabel="Heuristic mode"
        title={isLive ? "Anthropic API key detected." : "No API key — deterministic heuristic planner."}
      />
      <span className="h-3 w-px bg-[var(--line)]" />
      <Indicator
        on={searchLive}
        onLabel="Search · Tavily"
        offLabel="Search · KB"
        title={searchLive ? "Live web search via Tavily." : "Curated payer knowledge base (offline)."}
      />
      <span className="h-3 w-px bg-[var(--line)]" />
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--mint)" }} />
        MCP
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
        Submit an appointment in the left panel, or open a saved prep from office memory to view its
        breakdown here.
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
