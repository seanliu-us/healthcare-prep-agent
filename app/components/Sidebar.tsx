"use client";

import type { ReactNode } from "react";

export type View = "dashboard" | "newprep" | "history" | "settings";

export function Sidebar({
  view,
  onSelect,
  onNew,
  expanded,
  onToggle,
}: {
  view: View;
  onSelect: (view: View) => void;
  onNew: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 border-r border-[var(--line)] bg-white py-3 transition-[width] duration-200 ${
        expanded ? "w-52 items-stretch px-2" : "w-14 items-center"
      }`}
    >
      <SideIcon label="Menu" expanded={expanded} onClick={onToggle}>
        <PathIcon d="M4 6h16M4 12h16M4 18h16" />
      </SideIcon>

      <div className={`my-1 h-px bg-[var(--line)] ${expanded ? "mx-2" : "w-6"}`} />

      <SideIcon
        label="Dashboard"
        expanded={expanded}
        active={view === "dashboard"}
        onClick={() => onSelect("dashboard")}
      >
        <PathIcon d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" fill />
      </SideIcon>

      <SideIcon
        label="New prep"
        expanded={expanded}
        active={view === "newprep"}
        onClick={onNew}
      >
        <PathIcon d="M9 4h6l1 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3zM12 10v6M9 13h6" />
      </SideIcon>

      <SideIcon
        label="History"
        expanded={expanded}
        active={view === "history"}
        onClick={() => onSelect("history")}
      >
        <PathIcon d="M12 8v4l3 2M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4M3 5v3h3" />
      </SideIcon>

      <div className="mt-auto" />

      <SideIcon
        label="Settings"
        expanded={expanded}
        active={view === "settings"}
        onClick={() => onSelect("settings")}
      >
        <PathIcon d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.8 7.8 0 0 0 0-2l1.6-1.2-1.6-2.8-1.9.8a7.6 7.6 0 0 0-1.7-1L14.5 4h-3.2L11 6.6a7.6 7.6 0 0 0-1.7 1l-1.9-.8L5.8 9.6 7.4 11a7.8 7.8 0 0 0 0 2l-1.6 1.2 1.6 2.8 1.9-.8a7.6 7.6 0 0 0 1.7 1l.3 2.6h3.2l.3-2.6a7.6 7.6 0 0 0 1.7-1l1.9.8 1.6-2.8z" />
      </SideIcon>
    </aside>
  );
}

function SideIcon({
  label,
  active = false,
  expanded,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  expanded: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={expanded ? undefined : label}
      aria-label={label}
      data-active={active}
      className={`side-icon ${expanded ? "side-icon-wide" : ""}`}
    >
      {children}
      {expanded && <span className="text-sm">{label}</span>}
    </button>
  );
}

function PathIcon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="shrink-0"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
