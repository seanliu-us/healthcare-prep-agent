"use client";

import type { ReactNode } from "react";

export function TopBar({
  statusSlot,
  onLogout,
}: {
  statusSlot?: ReactNode;
  onLogout: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] bg-white px-4 sm:px-5">
      <div className="flex items-center gap-2">
        <Diamond />
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-[var(--ink)]">Prep</span>
          <span className="text-[var(--accent)]">Pilot</span>
        </span>
        <span className="ml-3 hidden text-xs text-[var(--ink-3)] md:inline">
          Appointment preparation portal
        </span>
      </div>

      <div className="flex items-center gap-3">
        {statusSlot}
        <Avatar letter="A" />
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function Diamond() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        transform="rotate(45 12 12)"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    </svg>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: "#7c3aed" }}
      title="Account"
    >
      {letter}
    </span>
  );
}
