import type { ReactNode } from "react";
import type { ActionPriority, RiskSeverity } from "@/lib/types";

type Tone = "neutral" | "accent" | "mint" | "warn" | "danger" | "ink";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-[var(--bg-2)] text-[var(--ink-2)] border-[var(--line)]",
  accent: "bg-[color-mix(in_oklch,var(--accent)_10%,white)] text-[var(--accent-ink)] border-[color-mix(in_oklch,var(--accent)_30%,white)]",
  mint: "bg-[var(--mint-soft)] text-[var(--mint-ink)] border-[color-mix(in_oklch,var(--mint)_35%,white)]",
  warn: "bg-[var(--warn-soft)] text-[var(--warn-ink)] border-[color-mix(in_oklch,var(--warn)_35%,white)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-ink)] border-[color-mix(in_oklch,var(--danger)_30%,white)]",
  ink: "bg-[var(--ink)] text-white border-transparent",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    procedure_api: { tone: "accent", label: "Procedure API" },
    search: { tone: "mint", label: "Search" },
    mcp: { tone: "warn", label: "MCP" },
    agent: { tone: "neutral", label: "Agent" },
  };
  const cfg = map[source] ?? { tone: "neutral" as const, label: source };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function SeverityPill({ severity }: { severity: RiskSeverity }) {
  const tone: Tone = severity === "high" ? "danger" : severity === "medium" ? "warn" : "mint";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function PriorityPill({ priority }: { priority: ActionPriority }) {
  const tone: Tone = priority === "urgent" ? "danger" : priority === "high" ? "warn" : "neutral";
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
    <section className="card p-6 fade-in">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="serif flex items-center gap-2 text-xl text-[var(--ink)]">
            {title}
            {typeof count === "number" && (
              <span className="rounded-full bg-[var(--bg-2)] px-2 py-0.5 text-xs font-medium text-[var(--ink-3)]">
                {count}
              </span>
            )}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--ink-3)]">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}
