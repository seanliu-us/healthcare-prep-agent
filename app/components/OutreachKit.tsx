"use client";

import { useMemo, useState } from "react";
import type { OfficeSummary } from "@/lib/types";
import { buildOutreach, type Outreach } from "@/lib/outreach";

export function OutreachKit({
  summary,
  aiAvailable,
}: {
  summary: OfficeSummary;
  aiAvailable: boolean;
}) {
  const base = useMemo(() => buildOutreach(summary), [summary]);
  const [kit, setKit] = useState<Outreach>(base);
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState(false);

  // Reset when the summary changes.
  const sig = summary.procedureCode + summary.patientName + summary.appointmentDate;
  const [lastSig, setLastSig] = useState(sig);
  if (sig !== lastSig) {
    setLastSig(sig);
    setKit(base);
    setRefined(false);
  }

  const refine = async () => {
    setRefining(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = (await res.json()) as Partial<Outreach>;
      setKit((k) => ({
        ...k,
        sms: data.sms ?? k.sms,
        emailSubject: data.emailSubject ?? k.emailSubject,
        emailBody: data.emailBody ?? k.emailBody,
      }));
      setRefined(true);
    } catch {
      /* keep deterministic draft */
    } finally {
      setRefining(false);
    }
  };

  const mailto = `mailto:?subject=${encodeURIComponent(kit.emailSubject)}&body=${encodeURIComponent(
    kit.emailBody,
  )}`;
  const smsHref = `sms:?&body=${encodeURIComponent(kit.sms)}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="serif text-xl text-[var(--ink)]">Patient Outreach Kit</h3>
          <p className="mt-0.5 max-w-xl text-sm text-[var(--ink-2)]">
            Auto-drafted from this prep — ready to send. Trim staff time and help{" "}
            {summary.patientName.split(" ")[0]} show up prepared.
          </p>
        </div>
        {aiAvailable ? (
          <button
            type="button"
            onClick={refine}
            disabled={refining}
            className="cta cta-accent shrink-0 disabled:opacity-60"
          >
            {refining ? "Refining…" : refined ? "Refine again" : "Refine with AI"}
          </button>
        ) : (
          <span className="chip" title="Add ANTHROPIC_API_KEY to enable AI refinement">
            Smart templates
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OutreachCard
          title="Text message"
          subtitle="SMS reminder"
          copyText={kit.sms}
          sendHref={smsHref}
          sendLabel="Open in messages"
          badge={refined ? "AI" : undefined}
        >
          <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">{kit.sms}</p>
          <p className="mt-2 text-[11px] text-[var(--ink-3)]">{kit.sms.length} characters</p>
        </OutreachCard>

        <OutreachCard
          title="Confirmation email"
          subtitle={kit.emailSubject}
          copyText={`Subject: ${kit.emailSubject}\n\n${kit.emailBody}`}
          sendHref={mailto}
          sendLabel="Open in email"
          badge={refined ? "AI" : undefined}
        >
          <p className="mb-2 text-xs font-medium text-[var(--ink-3)]">
            Subject: <span className="text-[var(--ink-2)]">{kit.emailSubject}</span>
          </p>
          <pre className="scroll-thin max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-[var(--ink)]">
            {kit.emailBody}
          </pre>
        </OutreachCard>

        <OutreachCard
          title="What to bring"
          subtitle="Patient checklist"
          copyText={kit.checklist.map((c) => `• ${c}`).join("\n")}
        >
          <ul className="flex flex-col gap-1.5 text-sm text-[var(--ink)]">
            {kit.checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckIcon />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </OutreachCard>

        <OutreachCard
          title="Payer verification script"
          subtitle="Internal — front desk / billing"
          copyText={kit.callScript.map((c, i) => `${i + 1}. ${c}`).join("\n")}
        >
          <ol className="flex flex-col gap-1.5 text-sm text-[var(--ink)]">
            {kit.callScript.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--bg-2)] text-[10px] font-semibold text-[var(--ink-3)]">
                  {i + 1}
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </OutreachCard>
      </div>
    </div>
  );
}

function OutreachCard({
  title,
  subtitle,
  copyText,
  sendHref,
  sendLabel,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  copyText: string;
  sendHref?: string;
  sendLabel?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--ink)]">{title}</h4>
            {badge && (
              <span className="rounded-full bg-[color-mix(in_oklch,var(--accent)_14%,white)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-ink)]">
                {badge}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-[var(--ink-3)]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {sendHref && (
            <a
              href={sendHref}
              title={sendLabel}
              className="flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-xs font-medium text-[var(--ink-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
            >
              <SendIcon />
              Send
            </a>
          )}
          <button
            type="button"
            onClick={copy}
            className="flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-xs font-medium text-[var(--ink-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
          >
            {copied ? <CheckIcon small /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ small = false }: { small?: boolean }) {
  const s = small ? 13 : 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={small ? "" : "mt-0.5 shrink-0 text-[var(--accent-ink)]"}
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
