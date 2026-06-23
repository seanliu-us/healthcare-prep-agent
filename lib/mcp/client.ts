import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

/**
 * MCP client manager.
 *
 * Spawns the custom "office-memory" MCP server (Source 3) as a child process
 * and connects to it over stdio. The agent calls MCP tools exclusively through
 * this client, demonstrating a real client/server MCP integration rather than
 * an in-process shortcut.
 *
 * The connection is cached on globalThis so Next.js dev hot-reloads reuse a
 * single server process instead of spawning one per request.
 */

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpConnection {
  client: Client;
  tools: McpToolDescriptor[];
}

declare global {
  // eslint-disable-next-line no-var
  var __mcpConnection: Promise<McpConnection> | undefined;
}

async function createConnection(): Promise<McpConnection> {
  const projectRoot = process.cwd();
  const serverEntry = resolve(projectRoot, "mcp-server", "index.ts");

  // Run the TypeScript MCP server under Node (so the native better-sqlite3
  // binding loads correctly) with tsx providing on-the-fly TS execution.
  const transport = new StdioClientTransport({
    command: process.execPath, // node
    args: ["--import", "tsx", serverEntry],
    cwd: projectRoot,
    env: {
      ...(process.env as Record<string, string>),
      MEMORY_DB_PATH:
        process.env.MEMORY_DB_PATH ?? resolve(projectRoot, ".data", "office-memory.db"),
    },
    stderr: "inherit",
  });

  const client = new Client(
    { name: "healthcare-prep-agent", version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
  const { tools } = await client.listTools();

  return {
    client,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: "object" },
    })),
  };
}

export function getMcpConnection(): Promise<McpConnection> {
  if (!globalThis.__mcpConnection) {
    globalThis.__mcpConnection = createConnection().catch((err) => {
      // Reset so a later request can retry instead of caching a rejected promise.
      globalThis.__mcpConnection = undefined;
      throw err;
    });
  }
  return globalThis.__mcpConnection;
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client } = await getMcpConnection();
  const result = await client.callTool({ name, arguments: args });

  // MCP tool results return content blocks; we parse the first text block as JSON.
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const textBlock = content.find((c) => c.type === "text");
  if (textBlock?.text) {
    try {
      return JSON.parse(textBlock.text);
    } catch {
      return textBlock.text;
    }
  }
  return result;
}

export async function listMcpTools(): Promise<McpToolDescriptor[]> {
  const { tools } = await getMcpConnection();
  return tools;
}
