"use client";

import type { OfficeSummary } from "@/lib/types";
import { Badge, PriorityPill, SeverityPill } from "./ui";

export function SummaryView({ summary }: { summary: OfficeSummary }) {
  const pa = summary.priorAuthorization;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-sky-500/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="brand">Office Summary</Badge>
          <Badge tone={summary.confidence >= 0.75 ? "green" : "amber"}>
            {(summary.confidence * 100).toFixed(0)}% confidence
          </Badge>
        </div>
        <h3 className="text-lg font-semibold text-slate-100">{summary.headline}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{summary.overview}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Meta label="Patient" value={summary.patientName} />
          <Meta label="Carrier" value={summary.insuranceCarrier} />
          <Meta label="Procedure" value={summary.procedureCode} />
          <Meta label="Date" value={summary.appointmentDate} />
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Prior Authorization" tone={pa.likelyRequired ? "amber" : "green"}>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={pa.likelyRequired ? "amber" : "green"}>
              {pa.likelyRequired ? "Likely required" : "Not typically required"}
            </Badge>
            <span className="text-xs text-slate-400">risk:</span>
            <SeverityPill severity={pa.risk} />
          </div>
          <BulletList items={pa.requirements} />
          {pa.notes && <p className="mt-2 text-xs text-slate-400 italic">{pa.notes}</p>}
        </Panel>

        <Panel title="Coverage Considerations">
          <BulletList items={summary.coverageConsiderations} />
          {summary.estimatedPatientCost && (
            <p className="mt-2 text-sm text-slate-300">
              <span className="text-slate-500">Est. cost: </span>
              {summary.estimatedPatientCost}
            </p>
          )}
        </Panel>

        <Panel title="Patient Prep">
          <BulletList items={summary.patientPrepInstructions} />
        </Panel>

        <Panel title="Questions for Patient">
          <BulletList items={summary.questionsForPatient} />
        </Panel>
      </div>

      {summary.risksAndGaps.length > 0 && (
        <Panel title="Risks & Gaps">
          <ul className="flex flex-col gap-2">
            {summary.risksAndGaps.map((r, i) => (
              <li key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <SeverityPill severity={r.severity} />
                  <span className="text-sm font-medium text-slate-200">{r.title}</span>
                </div>
                <p className="text-sm text-slate-400">{r.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {summary.recommendedActions.length > 0 && (
        <Panel title="Recommended Actions">
          <ul className="flex flex-col gap-2">
            {summary.recommendedActions.map((a, i) => (
              <li key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <PriorityPill priority={a.priority} />
                  <Badge tone="blue">{a.owner}</Badge>
                  {a.dueBy && <span className="text-xs text-slate-500">due {a.dueBy}</span>}
                </div>
                <p className="text-sm font-medium text-slate-200">{a.action}</p>
                <p className="mt-0.5 text-sm text-slate-400">{a.rationale}</p>
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
      <dt className="text-xs tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="text-sm text-slate-200">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  tone = "neutral",
  children,
}: {
  title: string;
  tone?: "neutral" | "amber" | "green";
  children: React.ReactNode;
}) {
  const border =
    tone === "amber" ? "border-amber-500/20" : tone === "green" ? "border-emerald-500/20" : "border-slate-700/60";
  return (
    <div className={`rounded-xl border ${border} bg-slate-900/40 p-4`}>
      <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">{title}</h4>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-slate-500 italic">None noted.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-300">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/70" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
