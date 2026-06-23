import type { ProcedureRecord } from "@/lib/types";
import { webSearch } from "@/lib/tools/search";
import { callMcpTool, listMcpTools } from "@/lib/mcp/client";
import { synthesizeProcedure } from "@/lib/data/procedures";

/**
 * Agent tool registry.
 *
 * Unifies the three data sources behind a single tool interface the agent loop
 * (LLM or heuristic) can call:
 *   - get_procedure_details  -> Source 1 (procedure JSON API, via real fetch)
 *   - web_search             -> Source 2 (search)
 *   - <mcp tools>            -> Source 3 (MCP server, discovered dynamically)
 */

export type ToolSource = "procedure_api" | "search" | "mcp";

export interface AgentTool {
  name: string;
  source: ToolSource;
  description: string;
  /** JSON schema (Anthropic `input_schema` compatible). */
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ToolExecution>;
}

export interface ToolExecution {
  ok: boolean;
  /** Short human-readable summary surfaced in the UI timeline. */
  summary: string;
  /** Full structured payload returned to the model. */
  data: unknown;
  error?: string;
}

export interface ToolRegistryContext {
  /** Absolute base URL used to call the internal procedure API. */
  baseUrl: string;
}

function procedureTool(ctx: ToolRegistryContext): AgentTool {
  return {
    name: "get_procedure_details",
    source: "procedure_api",
    description:
      "Look up structured details for a medical procedure code (CPT, description, category, modality, contrast use, typical prior-auth requirement, prep summary, and average cost) from the procedure API.",
    inputSchema: {
      type: "object",
      properties: {
        procedureCode: {
          type: "string",
          description: "The procedure code to look up, e.g. MRI_KNEE",
        },
      },
      required: ["procedureCode"],
    },
    execute: async (input) => {
      const code = String(input.procedureCode ?? "").trim();
      if (!code) {
        return { ok: false, summary: "Missing procedureCode", data: null, error: "procedureCode is required" };
      }
      try {
        const res = await fetch(`${ctx.baseUrl}/api/procedures/${encodeURIComponent(code)}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          const synthetic = synthesizeProcedure(code);
          return {
            ok: true,
            summary: `Procedure ${code} not in catalog — using a best-effort synthesized record.`,
            data: { ...synthetic, _synthesized: true },
          };
        }
        if (!res.ok) {
          throw new Error(`Procedure API returned HTTP ${res.status}`);
        }
        const data = (await res.json()) as ProcedureRecord;
        return {
          ok: true,
          summary: `${data.description} (CPT ${data.cptCode}, ${data.category}). Typical prior auth: ${data.typicalPriorAuthRequired ? "yes" : "no"}.`,
          data,
        };
      } catch (err) {
        return {
          ok: false,
          summary: "Failed to reach procedure API",
          data: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

function searchTool(carrier: string): AgentTool {
  return {
    name: "web_search",
    source: "search",
    description:
      "Search the web for up-to-date healthcare information: procedure explanations, payer-specific prior-authorization requirements, coverage considerations, and patient preparation guidance. Formulate a focused query.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A focused search query, e.g. 'Aetna MRI knee prior authorization requirements'",
        },
      },
      required: ["query"],
    },
    execute: async (input) => {
      const query = String(input.query ?? "").trim();
      if (!query) {
        return { ok: false, summary: "Missing query", data: null, error: "query is required" };
      }
      const res = await webSearch(query, { carrier });
      return {
        ok: true,
        summary: `Found ${res.results.length} result(s) via ${res.provider} for "${query}".`,
        data: res,
      };
    },
  };
}

async function mcpTools(): Promise<AgentTool[]> {
  try {
    const descriptors = await listMcpTools();
    return descriptors.map((d) => ({
      name: d.name,
      source: "mcp" as const,
      description: `[MCP: office-memory] ${d.description}`,
      inputSchema: d.inputSchema,
      execute: async (input: Record<string, unknown>) => {
        try {
          const data = await callMcpTool(d.name, input);
          return {
            ok: true,
            summary: summarizeMcpResult(d.name, data),
            data,
          };
        } catch (err) {
          return {
            ok: false,
            summary: `MCP tool ${d.name} failed`,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    }));
  } catch (err) {
    console.error("[tools] MCP unavailable:", err);
    return [];
  }
}

function summarizeMcpResult(tool: string, data: unknown): string {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return `MCP ${tool} completed.`;
  if ("saved" in d && d.saved) return `Persisted via MCP (${tool}), id=${String(d.id)}.`;
  if ("priorRunCount" in d) return `MCP history: ${String(d.priorRunCount)} prior run(s) found.`;
  if ("matchCount" in d) return `MCP recall: ${String(d.matchCount)} similar prep(s) found.`;
  if ("count" in d) return `MCP listed ${String(d.count)} summaries.`;
  return `MCP ${tool} completed.`;
}

export interface ToolRegistry {
  tools: AgentTool[];
  byName: Map<string, AgentTool>;
  mcpAvailable: boolean;
}

export async function buildToolRegistry(
  ctx: ToolRegistryContext,
  carrier: string,
): Promise<ToolRegistry> {
  const mcp = await mcpTools();
  const tools = [procedureTool(ctx), searchTool(carrier), ...mcp];
  return {
    tools,
    byName: new Map(tools.map((t) => [t.name, t])),
    mcpAvailable: mcp.length > 0,
  };
}
