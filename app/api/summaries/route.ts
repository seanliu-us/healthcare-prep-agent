import { callMcpTool } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists recent persisted summaries from the MCP office-memory store. */
export async function GET() {
  try {
    const data = await callMcpTool("list_recent_summaries", { limit: 10 });
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "mcp_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
