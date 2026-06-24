import { callMcpTool } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const data = (await callMcpTool("get_summary", { id })) as { found?: boolean };
    if (!data?.found) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "mcp_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const data = (await callMcpTool("delete_summary", { id })) as { deleted?: boolean };
    if (!data?.deleted) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "mcp_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
