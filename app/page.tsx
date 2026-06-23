"use client";

import { useEffect, useState } from "react";
import { useAgentRun } from "@/lib/useAgentRun";
import { RunForm } from "./components/RunForm";
import { Timeline } from "./components/Timeline";
import { Findings } from "./components/Findings";
import { SummaryView } from "./components/SummaryView";
import { ApprovalBar } from "./components/ApprovalBar";
import { Badge, SectionCard } from "./components/ui";

interface Health {
  agentMode: "llm" | "heuristic";
  model: string | null;
  searchProvider: "tavily" | "knowledge_base";
}

export default function Home() {
  const { state, start, decide } = useAgentRun();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const running = state.status === "running" || state.status === "awaiting_approval";
  const mode = state.mode ?? health?.agentMode;
  const searchProvider = health?.searchProvider;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-xl shadow-lg shadow-teal-500/20">
            🧭
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">PrepPilot</h1>
            <p className="text-xs text-slate-400">Autonomous appointment preparation agent for healthcare offices</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={mode === "llm" ? "green" : "amber"}>
            {mode === "llm" ? `LLM · ${health?.model ?? "Claude"}` : "Heuristic mode"}
          </Badge>
          <Badge tone={searchProvider === "tavily" ? "green" : "blue"}>
            Search · {searchProvider === "tavily" ? "Tavily (live)" : "Knowledge base"}
          </Badge>
          <Badge tone="amber">MCP · office-memory</Badge>
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left: input */}
        <aside className="flex flex-col gap-6">
          <SectionCard title="New appointment" subtitle="The agent researches all three data sources autonomously.">
            <RunForm disabled={running} onSubmit={start} />
          </SectionCard>

          {state.trace && (
            <SectionCard title="Run trace" subtitle="Observability">
              <TraceView trace={state.trace} persisted={state.persisted} />
            </SectionCard>
          )}

          <div className="card p-5 text-xs leading-relaxed text-slate-400">
            <p className="mb-2 font-semibold text-slate-300">How it works</p>
            <p>
              The agent pulls procedure data from a JSON API (Source 1), runs targeted web research
              (Source 2), and persists/recalls findings via a custom MCP server (Source 3). It plans,
              selects tools, reasons across sources, flags risks, and produces an office summary.
            </p>
            <p className="mt-2 text-slate-500">
              Synthetic data only. Decision-support, not medical advice or a coverage guarantee.
            </p>
          </div>
        </aside>

        {/* Right: live run */}
        <main className="flex min-w-0 flex-col gap-6">
          {state.approval && (
            <ApprovalBar onDecision={(d) => decide(state.approval!.approvalId, d)} />
          )}

          <SectionCard
            title="Live activity"
            subtitle="Planning · tool selection · reasoning"
            right={
              running ? (
                <span className="flex items-center gap-1.5 text-xs text-teal-300">
                  <span className="pulse h-2 w-2 rounded-full bg-teal-400" /> running
                </span>
              ) : state.status === "done" ? (
                <Badge tone="green">done</Badge>
              ) : state.status === "error" ? (
                <Badge tone="red">error</Badge>
              ) : null
            }
          >
            <div className="scroll-thin max-h-[28rem] overflow-y-auto pr-1">
              <Timeline items={state.timeline} running={running} />
            </div>
          </SectionCard>

          {state.findings.length > 0 && (
            <SectionCard title="Gathered information" count={state.findings.length} subtitle="Evidence collected across sources">
              <Findings findings={state.findings} />
            </SectionCard>
          )}

          {state.summary && (
            <SectionCard title="Final recommendations" subtitle="Actionable office summary">
              <SummaryView summary={state.summary} />
            </SectionCard>
          )}
        </main>
      </div>
    </div>
  );
}

function TraceView({
  trace,
  persisted,
}: {
  trace: NonNullable<ReturnType<typeof useAgentRun>["state"]["trace"]>;
  persisted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Tool calls" value={String(trace.totalToolCalls)} />
        <Stat label="LLM calls" value={String(trace.llmCalls)} />
        <Stat label="Elapsed" value={`${(trace.elapsedMs / 1000).toFixed(1)}s`} />
        <Stat
          label="Tokens"
          value={trace.inputTokens ? `${trace.inputTokens}/${trace.outputTokens ?? 0}` : "—"}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs tracking-wide text-slate-500 uppercase">Tool breakdown</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trace.toolBreakdown).map(([tool, n]) => (
            <Badge key={tool} tone="neutral">
              {tool} ×{n}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={persisted ? "green" : "amber"}>{persisted ? "Persisted to MCP" : "Not persisted"}</Badge>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}
