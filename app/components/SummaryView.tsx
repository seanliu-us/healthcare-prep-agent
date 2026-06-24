"use client";

import type { ReactNode } from "react";
import type { OfficeSummary } from "@/lib/types";
import { Badge, PriorityPill, SeverityPill } from "./ui";

export function SummaryView({ summary }: { summary: OfficeSummary }) {
  const pa = summary.priorAuthorization;
  return (
    <div className="flex flex-col gap-7">
      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[color-mix(in_oklch,var(--accent)_25%,white)] bg-[color-mix(in_oklch,var(--accent)_6%,white)] px-4 py-3">
        <div>
          <p className="eyebrow text-[var(--accent-ink)]">Office summary</p>
          <p className="mt-0.5 text-base font-semibold text-[var(--ink)]">{summary.headline}</p>
        </div>
        <Badge tone={summary.confidence >= 0.75 ? "mint" : "warn"}>
          {(summary.confidence * 100).toFixed(0)}% confidence
        </Badge>
      </div>

      {/* 1. Overview */}
      <Section n={1} title="Appointment Overview">
        <div className="kf-box px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <KV label="Patient" value={summary.patientName} />
            <KV label="Insurance Carrier" value={summary.insuranceCarrier} />
            <KV label="Procedure" value={summary.procedureCode} mono />
            <KV label="Appointment Date" value={summary.appointmentDate} />
            {summary.estimatedPatientCost && (
              <KV label="Estimated Cost" value={summary.estimatedPatientCost} />
            )}
          </dl>
        </div>
        {summary.overview && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">{summary.overview}</p>
        )}
      </Section>

      {/* 2. Prior authorization */}
      <Section n={2} title="Prior Authorization">
        <div className="kf-box mb-3 px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <KV label="Likely Required" value={pa.likelyRequired ? "Yes" : "No"} />
            <KVNode label="Risk">
              <SeverityPill severity={pa.risk} />
            </KVNode>
          </dl>
          {pa.notes && <p className="mt-3 text-xs text-[var(--ink-3)] italic">{pa.notes}</p>}
        </div>
        {pa.requirements.length > 0 && <Bullets items={pa.requirements} />}
      </Section>

      {/* 3. Coverage */}
      <Section n={3} title="Coverage & Cost Considerations">
        <Bullets items={summary.coverageConsiderations} />
      </Section>

      {/* 4. Recommended actions */}
      <Section n={4} title="Recommended Actions">
        <div className="overflow-x-auto">
          <table className="kf-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Action</th>
                <th>Owner</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {summary.recommendedActions.map((a, i) => (
                <tr key={i}>
                  <td>
                    <PriorityPill priority={a.priority} />
                  </td>
                  <td>
                    <span className="cell-strong">{a.action}</span>
                    {a.rationale && (
                      <span className="mt-0.5 block text-[var(--ink-3)]">{a.rationale}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{a.owner}</td>
                  <td className="whitespace-nowrap">{a.dueBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Risks */}
      {summary.risksAndGaps.length > 0 && (
        <Section n={5} title="Risks & Gaps">
          <div className="overflow-x-auto">
            <table className="kf-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Risk</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {summary.risksAndGaps.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <SeverityPill severity={r.severity} />
                    </td>
                    <td className="cell-strong whitespace-nowrap">{r.title}</td>
                    <td>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* 6. Prep & questions */}
      <Section n={6} title="Patient Prep & Questions">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--ink-3)] uppercase">
              Preparation instructions
            </p>
            <Bullets items={summary.patientPrepInstructions} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--ink-3)] uppercase">
              Questions for patient
            </p>
            <Bullets items={summary.questionsForPatient} />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="fade-in">
      <h3 className="section-title mb-3">
        {n}. {title}:
      </h3>
      {children}
    </section>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-[var(--ink)] ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function KVNode({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
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
