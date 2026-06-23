import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runAgent, type Emit } from "@/lib/agent/orchestrator";
import type { AgentEvent, AgentEventType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RequestSchema = z.object({
  patientName: z.string().min(1, "patientName is required"),
  insuranceCarrier: z.string().min(1, "insuranceCarrier is required"),
  procedureCode: z.string().min(1, "procedureCode is required"),
  appointmentDate: z.string().min(1, "appointmentDate is required"),
  requireApproval: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { requireApproval, ...input } = parsed.data;
  const runId = randomUUID();
  const origin = new URL(req.url).origin;

  const encoder = new TextEncoder();
  let seq = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const emit: Emit = (type: AgentEventType, data: unknown) => {
        send({
          id: `${runId}-${seq}`,
          runId,
          seq: seq++,
          ts: Date.now(),
          type,
          data,
        });
      };

      // Heartbeat so proxies don't buffer/timeout the stream.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      try {
        await runAgent({ runId, input, baseUrl: origin, requireApproval, emit });
      } catch (err) {
        emit("error", {
          scope: "run",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
