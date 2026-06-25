"use client";

import { useState } from "react";

export function Login({ onSignIn }: { onSignIn: (name: string, role: string) => void }) {
  const [name, setName] = useState("Front Desk Staff");
  const [role, setRole] = useState("Front Desk");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-2)] px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
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
          <span className="text-xl font-semibold tracking-tight">
            <span className="text-[var(--ink)]">Prep</span>
            <span className="text-[var(--accent)]">Pilot</span>
          </span>
        </div>

        <h1 className="serif text-2xl text-[var(--ink)]">Sign in to the prep portal</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--ink-3)]">
          Demo sign-in — your name is stored locally to personalize the workspace.
        </p>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSignIn(name, role);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Your name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="field-label">Role</span>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Front Desk</option>
              <option>Billing</option>
              <option>Clinical</option>
              <option>Office Manager</option>
            </select>
          </label>

          <button type="submit" className="cta cta-accent mt-1">
            Continue to portal
          </button>
        </form>
      </div>
    </div>
  );
}
