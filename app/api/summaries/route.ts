import { callMcpTool } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists persisted summaries from the MCP office-memory store. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 10;
  try {
    const data = await callMcpTool("list_recent_summaries", { limit });
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "mcp_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}

/** Clears the entire office memory (all summaries + findings). */
export async function DELETE() {
  try {
    const data = await callMcpTool("delete_all_summaries", {});
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "mcp_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
