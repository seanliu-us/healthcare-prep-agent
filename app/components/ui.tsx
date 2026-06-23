import type { ReactNode } from "react";
import type { ActionPriority, RiskSeverity } from "@/lib/types";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "blue" | "amber" | "red" | "green";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-700/40 text-slate-200 border-slate-600/50",
    brand: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    red: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  const map: Record<string, { tone: "brand" | "blue" | "amber" | "neutral"; label: string }> = {
    procedure_api: { tone: "brand", label: "Procedure API" },
    search: { tone: "blue", label: "Search" },
    mcp: { tone: "amber", label: "MCP" },
    agent: { tone: "neutral", label: "Agent" },
  };
  const cfg = map[source] ?? { tone: "neutral" as const, label: source };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function SeverityPill({ severity }: { severity: RiskSeverity }) {
  const tone = severity === "high" ? "red" : severity === "medium" ? "amber" : "green";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function PriorityPill({ priority }: { priority: ActionPriority }) {
  const tone = priority === "urgent" ? "red" : priority === "high" ? "amber" : "neutral";
  return <Badge tone={tone}>{priority}</Badge>;
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  count,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  count?: number;
}) {
  return (
    <section className="card p-5 fade-in">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100 uppercase">
            {title}
            {typeof count === "number" && (
              <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">{count}</span>
            )}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}
