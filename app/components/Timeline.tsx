"use client";

import { useState } from "react";
import type { TimelineItem } from "@/lib/useAgentRun";
import { SourceTag } from "./ui";

export function Timeline({ items, running }: { items: TimelineItem[]; running: boolean }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-[var(--ink-3)]">
        <div className="text-2xl">🩺</div>
        <p>Submit an appointment to watch the agent plan, research, and reason in real time.</p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-3 pl-5">
      <span className="absolute top-1 bottom-1 left-[7px] w-px bg-[var(--line)]" aria-hidden />
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
          <span
            className="pulse absolute top-1.5 -left-[18px] h-3 w-3 rounded-full border-2"
            style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
          />
          <p className="py-1 text-sm text-[var(--ink-3)] italic">Thinking…</p>
        </li>
      )}
    </ol>
  );
}

function dotClass(item: TimelineItem): string {
  switch (item.kind) {
    case "plan":
      return "border-[var(--accent)] bg-[var(--accent)]";
    case "phase":
      return "border-[var(--line)] bg-[var(--bg)]";
    case "reasoning":
      return "border-[var(--ink-3)] bg-[var(--bg)]";
    case "tool":
      return item.status === "error"
        ? "border-[var(--danger)] bg-[var(--danger)]"
        : item.status === "running"
          ? "border-[var(--accent)] bg-white"
          : "border-[var(--accent)] bg-[var(--accent)]";
    case "approval":
      return "border-[var(--warn)] bg-[var(--warn)]";
    case "error":
      return "border-[var(--danger)] bg-[var(--danger)]";
    default:
      return "border-[var(--line)] bg-[var(--bg-2)]";
  }
}

function TimelineRow({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "plan":
      return (
        <div className="rounded-[var(--rad-sm)] border border-[color-mix(in_oklch,var(--accent)_25%,white)] bg-[color-mix(in_oklch,var(--accent)_5%,white)] p-3">
          <p className="eyebrow mb-2 text-[var(--accent-ink)]">Plan</p>
          <p className="mb-2 text-sm text-[var(--ink-2)]">{item.thought}</p>
          <ol className="flex flex-col gap-1">
            {item.steps.map((s) => (
              <li key={s.id} className="flex gap-2 text-sm text-[var(--ink-3)]">
                <span className="text-[var(--accent-ink)]">{s.id}.</span>
                <span>
                  <span className="text-[var(--ink)]">{s.title}</span> — {s.description}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "phase":
      return <p className="eyebrow py-0.5 text-[var(--ink-3)]">▸ {item.label}</p>;
    case "reasoning":
      return <p className="text-sm leading-relaxed text-[var(--ink-2)]">{item.text}</p>;
    case "tool":
      return <ToolRow item={item} />;
    case "approval":
      return (
        <p className="text-sm text-[var(--warn-ink)]">
          ⏸ Awaiting human approval{item.decision ? ` — ${item.decision}` : "…"}
        </p>
      );
    case "error":
      return (
        <p className="rounded-[var(--rad-sm)] border border-[color-mix(in_oklch,var(--danger)_25%,white)] bg-[var(--danger-soft)] p-2 text-sm text-[var(--danger-ink)]">
          ⚠ {item.message}
        </p>
      );
  }
}

function ToolRow({ item }: { item: Extract<TimelineItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg-2)] p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <SourceTag source={item.source} />
        <code className="font-mono text-sm font-medium text-[var(--accent-ink)]">{item.tool}</code>
        {item.status === "running" && (
          <span className="text-xs text-[var(--accent-ink)]">running…</span>
        )}
        {item.status === "done" && (
          <span className="text-xs text-[var(--ink-3)]">{item.durationMs ?? 0}ms</span>
        )}
        {item.status === "error" && <span className="text-xs text-[var(--danger-ink)]">failed</span>}
        <span className="ml-auto text-xs text-[var(--ink-3)]">{open ? "▾" : "▸"}</span>
      </button>
      {item.summary && <p className="mt-1.5 text-sm text-[var(--ink-2)]">{item.summary}</p>}
      {item.error && <p className="mt-1 text-sm text-[var(--danger-ink)]">{item.error}</p>}
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
      <p className="eyebrow mb-1 text-[var(--ink-3)]">{label}</p>
      <pre className="scroll-thin max-h-48 overflow-auto rounded-[var(--rad-sm)] border border-[var(--line)] bg-white p-2 font-mono text-xs text-[var(--ink-2)]">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
