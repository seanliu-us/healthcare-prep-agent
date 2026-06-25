import { z } from "zod";
import { getAnthropic, DEFAULT_MODEL } from "@/lib/llm/anthropic";
import { buildOutreach } from "@/lib/outreach";
import type { OfficeSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ summary: z.unknown() });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_error" }, { status: 400 });
  }

  const summary = parsed.data.summary as OfficeSummary;
  const base = buildOutreach(summary);

  const anthropic = getAnthropic();
  if (!anthropic) {
    return Response.json({ ...base, mode: "heuristic" });
  }

  try {
    const resp = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 900,
      system:
        "You rewrite healthcare front-desk patient communications. Keep them warm, plain-language (6th-grade reading level), accurate to the provided draft, and free of medical/insurance jargon. Never invent clinical facts, costs, or dates not present in the draft. Return ONLY JSON.",
      messages: [
        {
          role: "user",
          content: `Refine this patient outreach. Keep the same facts. Return JSON with exactly these string keys: "sms" (<=320 chars), "emailSubject", "emailBody".\n\nDRAFT:\n${JSON.stringify(
            { sms: base.sms, emailSubject: base.emailSubject, emailBody: base.emailBody },
          )}`,
        },
      ],
    });

    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = extractJson(text);
    if (json) {
      return Response.json({
        sms: typeof json.sms === "string" ? json.sms : base.sms,
        emailSubject: typeof json.emailSubject === "string" ? json.emailSubject : base.emailSubject,
        emailBody: typeof json.emailBody === "string" ? json.emailBody : base.emailBody,
        checklist: base.checklist,
        callScript: base.callScript,
        mode: "llm",
      });
    }
  } catch (err) {
    console.error("[outreach] LLM refine failed:", err);
  }

  return Response.json({ ...base, mode: "heuristic" });
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
