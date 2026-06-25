import { z } from "zod";
import { getAnthropic, DEFAULT_MODEL, llmAvailable } from "@/lib/llm/anthropic";
import { knowledgeBaseSearch, findPayer } from "@/lib/data/payers";
import type { OfficeSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  question: z.string().min(1),
  summary: z.unknown().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_error", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { question, summary, history } = parsed.data;
  const ctx = summary as OfficeSummary | undefined;

  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const messages = [
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: question },
      ];
      const resp = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 700,
        system: buildSystemPrompt(ctx),
        messages,
      });
      const text = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
      return Response.json({ answer: text || "I couldn't generate an answer.", mode: "llm" });
    } catch (err) {
      console.error("[ask] LLM failed, falling back:", err);
    }
  }

  return Response.json({ answer: heuristicAnswer(question, ctx), mode: "heuristic", llm: llmAvailable() });
}

function buildSystemPrompt(ctx?: OfficeSummary): string {
  const base =
    "You are PrepPilot's office assistant for a healthcare front desk. Answer concisely and practically about insurance, prior authorization, coverage, procedure prep, and appointment readiness. Use synthetic/general guidance; never claim to guarantee coverage. If asked about the current appointment, use the provided context.";
  if (!ctx) return `${base}\nThere is no appointment loaded right now; answer generally and suggest running a prep.`;
  return `${base}\n\nCURRENT APPOINTMENT CONTEXT (JSON):\n${JSON.stringify(ctx).slice(0, 6000)}`;
}

/* ------------------------------------------------------------------ */
/* Heuristic answerer (no API key)                                     */
/* ------------------------------------------------------------------ */

function heuristicAnswer(question: string, ctx?: OfficeSummary): string {
  const q = question.toLowerCase();

  if (ctx) {
    if (/prior auth|authorization|precert|pre-cert|approval/.test(q)) {
      const pa = ctx.priorAuthorization;
      return [
        `For ${ctx.patientName} (${ctx.procedureCode}, ${ctx.insuranceCarrier}): prior authorization is ${pa.likelyRequired ? "**likely required**" : "**not typically required**"} (risk: ${pa.risk}).`,
        pa.requirements.length ? `Requirements:\n- ${pa.requirements.join("\n- ")}` : "",
        pa.notes,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (/cost|deductible|coverage|cover|out of pocket|price|pay/.test(q)) {
      return [
        ctx.estimatedPatientCost ? `Estimated cost: ${ctx.estimatedPatientCost}.` : "",
        ctx.coverageConsiderations.length ? `Coverage notes:\n- ${ctx.coverageConsiderations.join("\n- ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (/prep|prepare|before|fast|instruction|ready/.test(q)) {
      return ctx.patientPrepInstructions.length
        ? `Patient prep:\n- ${ctx.patientPrepInstructions.join("\n- ")}`
        : "No special preparation noted for this procedure.";
    }
    if (/risk|gap|wrong|miss|cancel/.test(q)) {
      return ctx.risksAndGaps.length
        ? `Top risks:\n- ${ctx.risksAndGaps.map((r) => `${r.title} (${r.severity}): ${r.detail}`).join("\n- ")}`
        : "No major risks flagged.";
    }
    if (/do|action|next|todo|task|step/.test(q)) {
      return ctx.recommendedActions.length
        ? `Recommended actions:\n- ${ctx.recommendedActions.map((a) => `[${a.priority}/${a.owner}] ${a.action}`).join("\n- ")}`
        : "No actions recommended.";
    }
    if (/question|ask|patient/.test(q)) {
      return ctx.questionsForPatient.length
        ? `Ask the patient:\n- ${ctx.questionsForPatient.join("\n- ")}`
        : "No specific patient questions noted.";
    }
    // Default with context: give the headline + a nudge.
    return `${ctx.headline}\n\n${ctx.overview}\n\nAsk me about prior authorization, coverage & cost, prep, risks, or recommended actions for this appointment.`;
  }

  // No appointment context — answer from payer KB if a carrier is mentioned.
  const carrierMatch = q.match(/aetna|united\s?healthcare|uhc|cigna|blue cross|bcbs|medicare/);
  if (carrierMatch) {
    const carrier = carrierMatch[0];
    const payer = findPayer(carrier);
    const results = knowledgeBaseSearch(question, carrier);
    return [
      `Here's general guidance for ${payer.name}:`,
      ...results.map((r) => `- ${r.snippet}`),
      "\nLoad or run a prep to get appointment-specific answers.",
    ].join("\n");
  }

  return "I can help with insurance, prior authorization, coverage, and procedure prep. Run a prep (or open a saved one) and I'll answer questions specific to that appointment. You can also ask general questions like \"What does Aetna require for an MRI?\"";
}
