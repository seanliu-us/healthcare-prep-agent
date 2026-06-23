"use client";

import { useState } from "react";
import type { TimelineItem } from "@/lib/useAgentRun";
import { SourceTag } from "./ui";

export function Timeline({ items, running }: { items: TimelineItem[]; running: boolean }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
        <div className="text-2xl">🩺</div>
        <p>Submit an appointment to watch the agent plan, research, and reason in real time.</p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-3 pl-5">
      <span className="absolute top-1 bottom-1 left-[7px] w-px bg-slate-700/60" aria-hidden />
      {items.map((item) => (
        <li key={item.id} className="relative fade-in">
          <span
            className={`absolute top-1.5 -left-[18px] h-3 w-3 rounded-full border-2 ${dotClass(item)}`}
            aria-hidden
          />
          <TimelineRow item={item} />
        </li>
      ))}
      {running && (
        <li className="relative fade-in">
          <span className="pulse absolute top-1.5 -left-[18px] h-3 w-3 rounded-full border-2 border-teal-400 bg-teal-400" />
          <p className="py-1 text-sm text-slate-400 italic">Thinking…</p>
        </li>
      )}
    </ol>
  );
}

function dotClass(item: TimelineItem): string {
  switch (item.kind) {
    case "plan":
      return "border-sky-400 bg-sky-400";
    case "phase":
      return "border-slate-400 bg-slate-800";
    case "reasoning":
      return "border-indigo-400 bg-indigo-400/30";
    case "tool":
      return item.status === "error"
        ? "border-rose-400 bg-rose-400"
        : item.status === "running"
          ? "border-teal-400 bg-teal-400/30"
          : "border-teal-400 bg-teal-400";
    case "approval":
      return "border-amber-400 bg-amber-400";
    case "error":
      return "border-rose-500 bg-rose-500";
    default:
      return "border-slate-500 bg-slate-700";
  }
}

function TimelineRow({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "plan":
      return (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-sky-300 uppercase">Plan</p>
          <p className="mb-2 text-sm text-slate-300">{item.thought}</p>
          <ol className="flex flex-col gap-1">
            {item.steps.map((s) => (
              <li key={s.id} className="flex gap-2 text-sm text-slate-400">
                <span className="text-sky-400">{s.id}.</span>
                <span>
                  <span className="text-slate-200">{s.title}</span> — {s.description}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "phase":
      return (
        <p className="py-0.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          ▸ {item.label}
        </p>
      );
    case "reasoning":
      return <p className="text-sm leading-relaxed text-slate-300">{item.text}</p>;
    case "tool":
      return <ToolRow item={item} />;
    case "approval":
      return (
        <p className="text-sm text-amber-300">
          ⏸ Awaiting human approval{item.decision ? ` — ${item.decision}` : "…"}
        </p>
      );
    case "error":
      return (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-300">
          ⚠ {item.message}
        </p>
      );
  }
}

function ToolRow({ item }: { item: Extract<TimelineItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <SourceTag source={item.source} />
        <code className="text-sm font-medium text-teal-200">{item.tool}</code>
        {item.status === "running" && <span className="text-xs text-teal-400">running…</span>}
        {item.status === "done" && (
          <span className="text-xs text-slate-500">{item.durationMs ?? 0}ms</span>
        )}
        {item.status === "error" && <span className="text-xs text-rose-400">failed</span>}
        <span className="ml-auto text-xs text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {item.summary && <p className="mt-1.5 text-sm text-slate-300">{item.summary}</p>}
      {item.error && <p className="mt-1 text-sm text-rose-300">{item.error}</p>}
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <Block label="input" value={item.input} />
          {item.data !== undefined && <Block label="output" value={item.data} />}
        </div>
      )}
    </div>
  );
}

function Block({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <pre className="scroll-thin max-h-48 overflow-auto rounded-md bg-slate-950/60 p-2 text-xs text-slate-400">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
