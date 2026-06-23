import { llmAvailable, DEFAULT_MODEL } from "@/lib/llm/anthropic";
import { searchProvider } from "@/lib/tools/search";
import { listProcedureCodes } from "@/lib/data/procedures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    agentMode: llmAvailable() ? "llm" : "heuristic",
    model: llmAvailable() ? DEFAULT_MODEL : null,
    searchProvider: searchProvider(),
    procedureCodes: listProcedureCodes(),
  });
}
