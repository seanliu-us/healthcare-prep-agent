"use client";

import type { Finding } from "@/lib/types";
import { Badge } from "./ui";

const KIND_LABEL: Record<Finding["kind"], string> = {
  procedure: "Procedure",
  payer: "Payer",
  prior_auth: "Prior Auth",
  coverage: "Coverage",
  prep: "Prep",
  risk: "Risk",
  memory: "Memory",
};

const KIND_TONE: Record<Finding["kind"], "accent" | "mint" | "warn" | "danger" | "neutral"> = {
  procedure: "accent",
  payer: "mint",
  prior_auth: "warn",
  coverage: "mint",
  prep: "neutral",
  risk: "danger",
  memory: "warn",
};

export function Findings({ findings }: { findings: Finding[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {findings.map((f) => (
        <li
          key={f.id}
          className="rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg)] p-3 fade-in"
        >
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={KIND_TONE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
            <span className="text-sm font-medium text-[var(--ink)]">{f.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink-2)]">{f.content}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--ink-3)]">
            <span>{f.source}</span>
            {f.sourceUrl && (
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-ink)] hover:underline"
              >
                source ↗
              </a>
            )}
            {typeof f.confidence === "number" && <span>· {(f.confidence * 100).toFixed(0)}% conf</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
