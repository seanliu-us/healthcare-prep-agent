#!/usr/bin/env node
/**
 * Custom MCP server — "Office Memory".
 *
 * Exposes a set of tools over the Model Context Protocol (stdio transport) that
 * let the agent persist and recall its work in a local SQLite database. This is
 * the project's Source 3 (MCP integration) and also powers the "memory across
 * runs" bonus: a second prep for the same patient or the same carrier+procedure
 * can reuse prior institutional knowledge.
 *
 * IMPORTANT: stdout is the MCP protocol channel. All diagnostic logging must go
 * to stderr only.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const log = (...args: unknown[]) => console.error("[mcp-server]", ...args);

const dbPath = process.env.MEMORY_DB_PATH
  ? resolve(process.env.MEMORY_DB_PATH)
  : resolve(process.cwd(), ".data", "office-memory.db");

mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    insurance_carrier TEXT NOT NULL,
    procedure_code TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    insurance_carrier TEXT NOT NULL,
    procedure_code TEXT NOT NULL,
    appointment_date TEXT,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_findings_patient ON findings(patient_name);
  CREATE INDEX IF NOT EXISTS idx_summaries_patient ON summaries(patient_name);
  CREATE INDEX IF NOT EXISTS idx_summaries_combo ON summaries(insurance_carrier, procedure_code);
`);

log("memory database ready at", dbPath);

const server = new McpServer({
  name: "office-memory",
  version: "1.0.0",
});

const ok = (obj: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
});

server.registerTool(
  "save_finding",
  {
    title: "Save research finding",
    description:
      "Persist a single research finding (procedure detail, payer rule, prior-auth requirement, coverage note, prep instruction, or risk) so it can be recalled later.",
    inputSchema: {
      runId: z.string().describe("Current run identifier"),
      patientName: z.string(),
      insuranceCarrier: z.string(),
      procedureCode: z.string(),
      kind: z
        .enum(["procedure", "payer", "prior_auth", "coverage", "prep", "risk", "memory"])
        .describe("Category of the finding"),
      title: z.string(),
      content: z.string(),
      source: z.string().optional(),
    },
  },
  async (args) => {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO findings (id, run_id, patient_name, insurance_carrier, procedure_code, kind, title, content, source, created_at)
       VALUES (@id, @runId, @patientName, @insuranceCarrier, @procedureCode, @kind, @title, @content, @source, @createdAt)`,
    ).run({
      id,
      runId: args.runId,
      patientName: args.patientName,
      insuranceCarrier: args.insuranceCarrier,
      procedureCode: args.procedureCode,
      kind: args.kind,
      title: args.title,
      content: args.content,
      source: args.source ?? null,
      createdAt: new Date().toISOString(),
    });
    return ok({ saved: true, id });
  },
);

server.registerTool(
  "save_office_summary",
  {
    title: "Save office summary",
    description:
      "Persist the final structured office summary for an appointment so staff and future runs can retrieve it.",
    inputSchema: {
      runId: z.string(),
      patientName: z.string(),
      insuranceCarrier: z.string(),
      procedureCode: z.string(),
      appointmentDate: z.string().optional(),
      summary: z.record(z.string(), z.any()).describe("The full office summary object"),
    },
  },
  async (args) => {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO summaries (id, run_id, patient_name, insurance_carrier, procedure_code, appointment_date, summary_json, created_at)
       VALUES (@id, @runId, @patientName, @insuranceCarrier, @procedureCode, @appointmentDate, @summaryJson, @createdAt)`,
    ).run({
      id,
      runId: args.runId,
      patientName: args.patientName,
      insuranceCarrier: args.insuranceCarrier,
      procedureCode: args.procedureCode,
      appointmentDate: args.appointmentDate ?? null,
      summaryJson: JSON.stringify(args.summary),
      createdAt: new Date().toISOString(),
    });
    return ok({ saved: true, id });
  },
);

server.registerTool(
  "get_patient_history",
  {
    title: "Get patient history",
    description:
      "Recall prior summaries and findings for a patient from previous prep runs (memory across runs). Use this before researching to avoid duplicate work.",
    inputSchema: {
      patientName: z.string(),
      limit: z.number().int().positive().max(20).optional(),
    },
  },
  async (args) => {
    const limit = args.limit ?? 5;
    const summaries = db
      .prepare(
        `SELECT id, run_id, procedure_code, insurance_carrier, appointment_date, created_at
         FROM summaries WHERE patient_name = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(args.patientName, limit);
    const findings = db
      .prepare(
        `SELECT kind, title, content, source, created_at
         FROM findings WHERE patient_name = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(args.patientName, limit * 3);
    return ok({
      patientName: args.patientName,
      priorRunCount: summaries.length,
      summaries,
      findings,
    });
  },
);

server.registerTool(
  "recall_similar_preps",
  {
    title: "Recall similar preparations",
    description:
      "Find prior prep summaries for the SAME insurance carrier and procedure code (institutional memory). Useful to reuse payer-specific prior-auth knowledge across patients.",
    inputSchema: {
      insuranceCarrier: z.string(),
      procedureCode: z.string(),
      limit: z.number().int().positive().max(10).optional(),
    },
  },
  async (args) => {
    const limit = args.limit ?? 3;
    const rows = db
      .prepare(
        `SELECT id, patient_name, appointment_date, summary_json, created_at
         FROM summaries WHERE insurance_carrier = ? AND procedure_code = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(args.insuranceCarrier, args.procedureCode, limit) as Array<{
      id: string;
      patient_name: string;
      appointment_date: string | null;
      summary_json: string;
      created_at: string;
    }>;

    const matches = rows.map((r) => {
      let priorAuth: unknown = undefined;
      try {
        priorAuth = JSON.parse(r.summary_json)?.priorAuthorization;
      } catch {
        /* ignore malformed rows */
      }
      return {
        id: r.id,
        patientName: r.patient_name,
        appointmentDate: r.appointment_date,
        createdAt: r.created_at,
        priorAuthorization: priorAuth,
      };
    });

    return ok({
      insuranceCarrier: args.insuranceCarrier,
      procedureCode: args.procedureCode,
      matchCount: matches.length,
      matches,
    });
  },
);

server.registerTool(
  "list_recent_summaries",
  {
    title: "List recent summaries",
    description: "List the most recent office summaries persisted across all patients.",
    inputSchema: {
      limit: z.number().int().positive().max(50).optional(),
    },
  },
  async (args) => {
    const rows = db
      .prepare(
        `SELECT id, patient_name, insurance_carrier, procedure_code, appointment_date, created_at
         FROM summaries ORDER BY created_at DESC LIMIT ?`,
      )
      .all(args.limit ?? 10);
    return ok({ count: rows.length, summaries: rows });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("connected over stdio");
}

main().catch((err) => {
  log("fatal", err);
  process.exit(1);
});
