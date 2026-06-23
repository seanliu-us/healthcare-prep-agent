"use client";

import { useState } from "react";

export function ApprovalBar({
  onDecision,
}: {
  onDecision: (decision: "approved" | "rejected") => void;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const decide = (d: "approved" | "rejected") => {
    setSubmitting(d);
    onDecision(d);
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-[color-mix(in_oklch,var(--warn)_30%,white)] bg-[var(--warn-soft)] p-4 fade-in">
      <div>
        <p className="text-sm font-semibold text-[var(--warn-ink)]">Human approval required</p>
        <p className="text-xs text-[var(--ink-3)]">
          Review the summary below, then approve to persist it to office memory.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!!submitting}
          onClick={() => decide("rejected")}
          className="btn-ghost disabled:opacity-50"
        >
          {submitting === "rejected" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={!!submitting}
          onClick={() => decide("approved")}
          className="cta cta-accent disabled:opacity-50"
        >
          {submitting === "approved" ? "Approving…" : "Approve & save"}
        </button>
      </div>
    </div>
  );
}
