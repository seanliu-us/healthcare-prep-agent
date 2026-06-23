"use client";

import type { OfficeSummary } from "@/lib/types";
import { Badge, PriorityPill, SeverityPill } from "./ui";

export function SummaryView({ summary }: { summary: OfficeSummary }) {
  const pa = summary.priorAuthorization;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[var(--rad)] border border-[color-mix(in_oklch,var(--accent)_25%,white)] bg-[color-mix(in_oklch,var(--accent)_5%,white)] p-5">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="accent">Office summary</Badge>
          <Badge tone={summary.confidence >= 0.75 ? "mint" : "warn"}>
            {(summary.confidence * 100).toFixed(0)}% confidence
          </Badge>
        </div>
        <h3 className="serif text-2xl text-[var(--ink)]">{summary.headline}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">{summary.overview}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Meta label="Patient" value={summary.patientName} />
          <Meta label="Carrier" value={summary.insuranceCarrier} />
          <Meta label="Procedure" value={summary.procedureCode} />
          <Meta label="Date" value={summary.appointmentDate} />
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Prior authorization" tone={pa.likelyRequired ? "warn" : "mint"}>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={pa.likelyRequired ? "warn" : "mint"}>
              {pa.likelyRequired ? "Likely required" : "Not typically required"}
            </Badge>
            <span className="text-xs text-[var(--ink-3)]">risk:</span>
            <SeverityPill severity={pa.risk} />
          </div>
          <BulletList items={pa.requirements} />
          {pa.notes && <p className="mt-2 text-xs text-[var(--ink-3)] italic">{pa.notes}</p>}
        </Panel>

        <Panel title="Coverage considerations">
          <BulletList items={summary.coverageConsiderations} />
          {summary.estimatedPatientCost && (
            <p className="mt-2 text-sm text-[var(--ink-2)]">
              <span className="text-[var(--ink-3)]">Est. cost: </span>
              {summary.estimatedPatientCost}
            </p>
          )}
        </Panel>

        <Panel title="Patient prep">
          <BulletList items={summary.patientPrepInstructions} />
        </Panel>

        <Panel title="Questions for patient">
          <BulletList items={summary.questionsForPatient} />
        </Panel>
      </div>

      {summary.risksAndGaps.length > 0 && (
        <Panel title="Risks & gaps">
          <ul className="flex flex-col gap-2">
            {summary.risksAndGaps.map((r, i) => (
              <li
                key={i}
                className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg)] p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <SeverityPill severity={r.severity} />
                  <span className="text-sm font-medium text-[var(--ink)]">{r.title}</span>
                </div>
                <p className="text-sm text-[var(--ink-2)]">{r.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {summary.recommendedActions.length > 0 && (
        <Panel title="Recommended actions">
          <ul className="flex flex-col gap-2">
            {summary.recommendedActions.map((a, i) => (
              <li
                key={i}
                className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg)] p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <PriorityPill priority={a.priority} />
                  <Badge tone="accent">{a.owner}</Badge>
                  {a.dueBy && <span className="text-xs text-[var(--ink-3)]">due {a.dueBy}</span>}
                </div>
                <p className="text-sm font-medium text-[var(--ink)]">{a.action}</p>
                <p className="mt-0.5 text-sm text-[var(--ink-2)]">{a.rationale}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="mt-0.5 text-sm text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  tone = "neutral",
  children,
}: {
  title: string;
  tone?: "neutral" | "warn" | "mint";
  children: React.ReactNode;
}) {
  const border =
    tone === "warn"
      ? "border-[color-mix(in_oklch,var(--warn)_25%,white)]"
      : tone === "mint"
        ? "border-[color-mix(in_oklch,var(--mint)_25%,white)]"
        : "border-[var(--line)]";
  return (
    <div className={`rounded-[var(--rad)] border ${border} bg-[var(--bg)] p-4`}>
      <h4 className="eyebrow mb-3 text-[var(--ink-3)]">{title}</h4>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-[var(--ink-3)] italic">None noted.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm text-[var(--ink-2)]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
