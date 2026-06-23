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
    <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-8 px-5 py-8 sm:px-8">
      {/* ----- Header ----- */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="serif text-lg leading-none text-[var(--ink)]">PrepPilot</p>
            <p className="text-xs text-[var(--ink-3)]">Appointment preparation, automated</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip">
            <Dot color="var(--accent)" /> {mode === "llm" ? `LLM · ${health?.model ?? "Claude"}` : "Heuristic mode"}
          </span>
          <span className="chip">
            <Dot color="var(--mint)" /> Search · {searchProvider === "tavily" ? "Tavily live" : "Knowledge base"}
          </span>
          <span className="chip">
            <Dot color="var(--warn)" /> MCP · office-memory
          </span>
        </div>
      </header>

      {/* ----- Hero ----- */}
      <section className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="eyebrow mb-3 text-[var(--ink-3)]">Autonomous prep agent</p>
          <h1 className="serif text-[2.4rem] leading-[1.1] tracking-tight text-[var(--ink)] sm:text-[2.8rem]">
            Walk into every visit{" "}
            <span className="italic text-[var(--accent-ink)]">prepared</span>.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--ink-2)]">
            PrepPilot pulls procedure data, researches payer prior-auth rules, flags risks, and hands your
            front desk a prioritized action list — minutes after the appointment is booked.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--ink-2)] md:justify-end">
          {["Procedure API", "Live research", "Office memory (MCP)"].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <Check /> {f}
            </li>
          ))}
        </ul>
      </section>

      {/* ----- Main grid ----- */}
      <div className="grid flex-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left rail */}
        <aside className="flex flex-col gap-6">
          <SectionCard
            title="New appointment"
            subtitle="The agent researches all three data sources autonomously."
          >
            <RunForm disabled={running} onSubmit={start} />
          </SectionCard>

          {state.trace && (
            <SectionCard title="Run trace" subtitle="Observability">
              <TraceView trace={state.trace} persisted={state.persisted} />
            </SectionCard>
          )}

          <div className="card-soft p-5 text-sm leading-relaxed text-[var(--ink-2)]">
            <p className="eyebrow mb-2 text-[var(--ink-3)]">How it works</p>
            <p>
              The agent pulls procedure data from a JSON API, runs targeted research, and persists or
              recalls findings via a custom MCP server. It plans, picks tools, reasons across sources,
              flags risks, and produces an office summary.
            </p>
            <p className="mt-2 text-[var(--ink-3)]">
              Synthetic data only. Decision-support, not medical advice or a coverage guarantee.
            </p>
          </div>
        </aside>

        {/* Right column */}
        <main className="flex min-w-0 flex-col gap-6">
          {state.approval && (
            <ApprovalBar onDecision={(d) => decide(state.approval!.approvalId, d)} />
          )}

          <SectionCard
            title="Live activity"
            subtitle="Planning · tool selection · reasoning"
            right={
              running ? (
                <span className="flex items-center gap-1.5 text-xs text-[var(--accent-ink)]">
                  <span
                    className="pulse h-2 w-2 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />{" "}
                  running
                </span>
              ) : state.status === "done" ? (
                <Badge tone="mint">done</Badge>
              ) : state.status === "error" ? (
                <Badge tone="danger">error</Badge>
              ) : null
            }
          >
            <div className="scroll-thin max-h-[30rem] overflow-y-auto pr-1">
              <Timeline items={state.timeline} running={running} />
            </div>
          </SectionCard>

          {state.findings.length > 0 && (
            <SectionCard
              title="Gathered information"
              count={state.findings.length}
              subtitle="Evidence collected across sources"
            >
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

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-2)] pt-5 text-xs text-[var(--ink-3)]">
        <span>PrepPilot · proof-of-concept · synthetic data only</span>
        <span>Built with Next.js · Anthropic · MCP · SQLite</span>
      </footer>
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
        <p className="eyebrow mb-1.5 text-[var(--ink-3)]">Tool breakdown</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trace.toolBreakdown).map(([tool, n]) => (
            <span key={tool} className="chip">
              <code className="font-mono">{tool}</code> ×{n}
            </span>
          ))}
        </div>
      </div>
      <div>
        <Badge tone={persisted ? "mint" : "warn"}>
          {persisted ? "Persisted to MCP" : "Not persisted"}
        </Badge>
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

function Mark() {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[color-mix(in_oklch,var(--accent)_35%,white)] bg-[color-mix(in_oklch,var(--accent)_8%,white)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
