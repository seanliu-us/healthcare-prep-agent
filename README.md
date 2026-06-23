# PrepPilot — Autonomous Healthcare Appointment Prep Agent

An autonomous AI agent that helps a healthcare office prepare for an upcoming patient
appointment. Given an appointment, it **plans**, **gathers information from three independent
sources**, **reasons across them**, **flags risks**, and produces an **actionable office summary** —
streamed live to a web UI so you can watch every reasoning step and tool call.

> Built for the Healthcare Office AI Agent Challenge. Synthetic data only — decision-support, not
> medical advice or a coverage guarantee.

---

## Why this matters (product context)

Front-desk and billing staff lose hours per appointment researching insurance, prior-auth rules,
procedure prep, and coverage — exactly the "last mile" problem companies like
[Klearforce](http://klearforce.com/) tackle for dental offices. PrepPilot automates that research
loop and hands staff a prioritized, owner-assigned action list *before* the patient walks in.

---

## What it does

Input:

```json
{
  "patientName": "John Smith",
  "insuranceCarrier": "Aetna",
  "procedureCode": "MRI_KNEE",
  "appointmentDate": "2026-07-15"
}
```

The agent then:

1. **Recalls office memory** (MCP) — prior runs for this patient or this carrier+procedure.
2. **Retrieves procedure details** from a JSON API (Source 1).
3. **Researches** payer prior-auth, coverage, and prep using search (Source 2) — formulating its own queries.
4. **Identifies risks & gaps** by reconciling sources (missing prior auth, tight timelines, contrast safety, prep non-compliance, eligibility unknowns).
5. **Generates recommendations** for staff — prioritized and assigned to an owner (Front Desk / Billing / Clinical / Patient).
6. **Persists findings** back to the MCP server for future runs.

---

## The three data sources

| # | Source | Implementation |
|---|--------|----------------|
| 1 | **JSON API** | `GET /api/procedures/[code]` — a real HTTP endpoint the agent consumes via `fetch`. Backed by a procedure catalog with CPT codes, modality, contrast, prep, prior-auth flags, and cost ranges. |
| 2 | **Search** | `web_search` tool. Uses **Tavily** when `TAVILY_API_KEY` is set; otherwise a curated, source-attributed **payer knowledge base** so the demo works offline. |
| 3 | **MCP** | A custom **`office-memory` MCP server** (`mcp-server/index.ts`) over stdio, backed by **SQLite**. Tools: `save_finding`, `save_office_summary`, `get_patient_history`, `recall_similar_preps`, `list_recent_summaries`. |

---

## Architecture

```
Browser (React, SSE)
   │  POST /api/agent  (Server-Sent Events stream)
   ▼
Next.js Route Handler ──► Agent Orchestrator (lib/agent/orchestrator.ts)
   │                          │
   │                          ├─ LLM tool-use loop (Anthropic)  ── or ──  heuristic planner
   │                          │
   │                          ├─ Tool registry (lib/agent/tools.ts)
   │                          │     ├─ get_procedure_details ─► /api/procedures/[code]   (Source 1)
   │                          │     ├─ web_search ─► Tavily | knowledge base             (Source 2)
   │                          │     └─ MCP tools  ─► MCP client                          (Source 3)
   │                          │
   │                          └─ Tracer (observability)
   ▼
MCP client (stdio) ──spawns──► office-memory MCP server ──► SQLite (.data/office-memory.db)
```

Every step is emitted as a typed event (`lib/types.ts`) over SSE and rendered live: plan, phase,
reasoning, tool_call/tool_result, finding, risk, recommendation, approval, summary, trace.

### Dual-mode agent

- **LLM mode** (`ANTHROPIC_API_KEY` set): a genuine Anthropic tool-use loop. The model plans,
  picks tools, formulates search queries, reasons over results, and calls a structured
  `finalize_preparation` tool. Demonstrates real autonomy.
- **Heuristic mode** (no key): a deterministic planner that still calls all three sources, derives
  findings/risks, and synthesizes the same structured summary. Guarantees the demo always runs.

---

## Running locally

Requirements: Node 20+ (built/tested on Node 22), and the package manager of your choice.

```bash
# install (bun, npm, or pnpm all work)
bun install            # or: npm install

# optional: enable LLM + live search
cp .env.example .env.local   # then add ANTHROPIC_API_KEY / TAVILY_API_KEY

# dev
bun run dev            # or: npm run dev
# open http://localhost:3000
```

No keys? It still works — you'll see the `Heuristic mode` + `Knowledge base` badges and a full run.

### Quick API checks

```bash
# Source 1 — procedure API
curl http://localhost:3000/api/procedures/MRI_KNEE

# health / mode
curl http://localhost:3000/api/health

# run the agent (streams SSE)
curl -N -X POST http://localhost:3000/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"patientName":"John Smith","insuranceCarrier":"Aetna","procedureCode":"MRI_KNEE","appointmentDate":"2026-07-15"}'

# recent persisted summaries (MCP)
curl http://localhost:3000/api/summaries
```

---

## Frontend

A single-page app (`app/page.tsx`) where you can:

- Submit appointment information (with sample presets and an optional **human-approval** toggle)
- Start agent execution
- Watch **agent reasoning steps** and **tool invocations** stream in real time
- See **gathered information** grouped by source
- Read the **final recommendations** (prior auth, coverage, prep, questions, risks, actions)
- Inspect a **run trace** (tool/LLM counts, latency, tokens, persistence status)

---

## Evaluation mapping

- **AI Agent Design** — planning, dynamic tool selection, self-formulated search queries, cross-source reasoning, autonomous finalize.
- **Engineering Quality** — typed event contract, clean source/tool separation, graceful degradation (404 → synthesized record, Tavily → KB, LLM → heuristic), zod validation, streaming with heartbeats.
- **Product Thinking** — owner-assigned, prioritized, time-aware recommendations a front desk can act on today.
- **MCP Usage** — a real client/server MCP integration with persistence **and** cross-run recall.

### Bonus features included

- ✅ **Memory across runs** (SQLite via MCP; `recall_similar_preps` reuses carrier+procedure knowledge)
- ✅ **Human approval workflow** (toggle → pause → approve/reject before persistence)
- ✅ **Streaming updates** (SSE end-to-end)
- ✅ **Observability/tracing** (per-tool durations, token usage, run trace panel)
- ✅ **Graceful, key-free demo mode**

---

## Project layout

```
app/
  api/agent/route.ts            SSE agent endpoint
  api/agent/approve/route.ts    human-in-the-loop approval
  api/procedures/[code]/route.ts Source 1 JSON API
  api/summaries/route.ts        list persisted summaries (MCP)
  api/health/route.ts           mode/config probe
  components/                   UI (form, timeline, findings, summary, approval)
  page.tsx                      main app
lib/
  agent/orchestrator.ts         agent loop (LLM + heuristic), synthesis, persistence
  agent/tools.ts                unified tool registry across the 3 sources
  agent/prompts.ts              system prompt + finalize schema
  agent/approvals.ts            approval registry
  agent/tracing.ts              observability
  mcp/client.ts                 MCP client manager (spawns server)
  tools/search.ts               search (Tavily + KB fallback)
  data/procedures.ts            procedure catalog (Source 1 data)
  data/payers.ts                payer knowledge base (search fallback)
  llm/anthropic.ts              Anthropic client provider
  types.ts                      shared domain + event types
mcp-server/index.ts             custom office-memory MCP server (SQLite)
```
