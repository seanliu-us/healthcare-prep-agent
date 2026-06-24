"use client";

import type { ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  hidden?: boolean;
}

export function Tabs({
  tabs,
  active,
  onChange,
  right,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--line)]">
      <nav className="-mb-px flex flex-1 flex-wrap items-center gap-1" role="tablist">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => {
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(t.id)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${
                  selected
                    ? "text-[var(--ink)]"
                    : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                }`}
              >
                <span>{t.label}</span>
                {typeof t.count === "number" && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold ${
                      selected
                        ? "bg-[color-mix(in_oklch,var(--accent)_15%,white)] text-[var(--accent-ink)]"
                        : "bg-[var(--bg-2)] text-[var(--ink-3)]"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
                {selected && (
                  <span
                    aria-hidden
                    className="absolute right-0 -bottom-px left-0 h-[2px] rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
      </nav>
      {right && <div className="pr-1">{right}</div>}
    </div>
  );
}
