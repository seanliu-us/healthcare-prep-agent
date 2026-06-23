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

const KIND_TONE: Record<Finding["kind"], "brand" | "blue" | "amber" | "green" | "red" | "neutral"> = {
  procedure: "brand",
  payer: "blue",
  prior_auth: "amber",
  coverage: "green",
  prep: "neutral",
  risk: "red",
  memory: "amber",
};

export function Findings({ findings }: { findings: Finding[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {findings.map((f) => (
        <li key={f.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 fade-in">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={KIND_TONE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
            <span className="text-sm font-medium text-slate-200">{f.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-400">{f.content}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
            <span>{f.source}</span>
            {f.sourceUrl && (
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline"
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
