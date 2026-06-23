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
    <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-500/30 bg-amber-500/5 p-4 fade-in">
      <div>
        <p className="text-sm font-semibold text-amber-200">Human approval required</p>
        <p className="text-xs text-amber-300/70">
          Review the summary below, then approve to persist it to office memory.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!!submitting}
          onClick={() => decide("rejected")}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-50"
        >
          {submitting === "rejected" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={!!submitting}
          onClick={() => decide("approved")}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {submitting === "approved" ? "Approving…" : "Approve & save"}
        </button>
      </div>
    </div>
  );
}
