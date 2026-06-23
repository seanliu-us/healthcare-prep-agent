import { z } from "zod";
import { resolveApproval } from "@/lib/agent/approvals";

export const runtime = "nodejs";

const Schema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
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
  const ok = resolveApproval(parsed.data.approvalId, parsed.data.decision);
  if (!ok) {
    return Response.json({ error: "approval_not_found_or_expired" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
