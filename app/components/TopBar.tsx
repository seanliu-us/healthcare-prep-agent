"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@/lib/useAuth";

export function TopBar({
  statusSlot,
  user,
  onSignOut,
}: {
  statusSlot?: ReactNode;
  user: User;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initial = user.name.trim().charAt(0).toUpperCase() || "U";

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

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full pr-1 transition hover:bg-[var(--bg-2)]"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              {initial}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-medium leading-tight text-[var(--ink)]">
                {user.name}
              </span>
              <span className="block text-[10px] leading-tight text-[var(--ink-3)]">{user.role}</span>
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="hidden text-[var(--ink-3)] sm:block"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <div
              role="menu"
              className="card absolute right-0 top-11 z-50 w-56 p-1.5 shadow-[var(--shadow-card)]"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-[var(--ink)]">{user.name}</p>
                <p className="text-xs text-[var(--ink-3)]">{user.role} · Signed in</p>
              </div>
              <div className="my-1 h-px bg-[var(--line)]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--danger)] transition hover:bg-[color-mix(in_oklch,var(--danger)_8%,white)]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
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
