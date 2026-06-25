# PrepPilot — Autonomous Healthcare Appointment Prep Agent

[![CI](https://github.com/seanliu-us/healthcare-prep-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/seanliu-us/healthcare-prep-agent/actions/workflows/ci.yml)

An autonomous AI agent that helps a healthcare office prepare for an upcoming patient
appointment. Given an appointment, it **plans**, **gathers information from three independent
sources**, **reasons across them**, **flags risks**, produces an **actionable office summary**, and
**auto-drafts patient communications** — all streamed live to a web portal so you can watch every
reasoning step and tool call.

> Built for the Healthcare Office AI Agent Challenge. Synthetic data only — decision-support, not
> medical advice or a coverage guarantee.

---

## Table of contents

- [Why this matters](#why-this-matters-product-context)
- [Tech stack](#tech-stack)
- [What it does (agent logic)](#what-it-does-agent-logic)
- [The three data sources](#the-three-data-sources)
- [Architecture](#architecture)
- [Dual-mode agent](#dual-mode-agent-llm--heuristic)
- [Feature tour](#feature-tour)
- [Running locally](#running-locally)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Deployment notes](#deployment-notes)
- [Evaluation mapping](#evaluation-mapping)
- [Project layout](#project-layout)

---

## Why this matters (product context)

Front-desk and billing staff lose hours per appointment researching insurance, prior-auth rules,
procedure prep, and coverage — exactly the "last mile" problem companies like
[Klearforce](http://klearforce.com/) tackle for dental offices. PrepPilot automates that research
loop and hands staff a prioritized, owner-assigned action list **plus ready-to-send patient
messages** *before* the patient walks in.

---

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js 16** (App Router, Turbopack) | API routes + React UI in one app |
| Language | **TypeScript** (strict) | end-to-end typed event contract |
| Runtime | **Node.js 20+** | server routes run on the Node runtime |
| UI | **React 19**, **Tailwind CSS v4** | custom Klearforce-aligned design system |
| LLM | **Anthropic Claude** (`@anthropic-ai/sdk`) | tool-use loop; optional |
| Search | **Tavily API** | live web search; optional (KB fallback) |
| MCP | **`@modelcontextprotocol/sdk`** | custom stdio server (client + server) |
| Storage | **SQLite** (`better-sqlite3`) | office-memory persistence |
| Validation | **Zod** | request + MCP tool schemas |
| Streaming | **Server-Sent Events** | live agent progress to the browser |
| Fonts | Inter, Instrument Serif, JetBrains Mono | via `next/font` |

Everything works **with zero API keys** thanks to deterministic fallbacks (see
[Dual-mode agent](#dual-mode-agent-llm--heuristic)).

---

## What it does (agent logic)

Input:

```json
{
  "patientName": "John Smith",
  "insuranceCarrier": "Aetna",
  "procedureCode": "MRI_KNEE",
  "appointmentDate": "2026-07-15"
}
```

The agent runs a multi-step workflow:

1. **Recall office memory** (MCP) — checks prior runs for this patient and for this
   carrier+procedure, so it can reuse institutional knowledge instead of re-researching.
2. **Retrieve procedure details** from a JSON API (Source 1) — CPT code, modality, contrast use,
   typical prior-auth flag, prep summary, cost range. Unknown codes are gracefully synthesized.
3. **Research** payer prior-auth, coverage/cost, and prep using search (Source 2). In LLM mode the
   model **formulates its own queries**; in heuristic mode the agent generates four targeted queries
   covering the procedure, prior auth, coverage, and prep.
4. **Reconcile sources & identify risks/gaps** — e.g. prior-auth likely required, tight
   authorization timeline, contrast safety screening, prep non-compliance, eligibility/network
   unknowns. Each risk carries a severity.
5. **Generate recommendations** — concrete actions, each with a **rationale**, an **owner**
   (Front Desk / Billing / Clinical / Patient), a **priority**, and an optional due date.
6. **Persist** findings + the structured summary back to the MCP server for future runs.
7. **(Optional) human approval** — if enabled, the agent pauses before persistence and waits for an
   approve/reject decision from the UI.
8. **Draft patient outreach** — from the summary, the app generates an SMS, a confirmation email, a
   "what to bring" checklist, and an internal payer-verification call script.

---

## The three data sources

| # | Source | Implementation |
|---|--------|----------------|
| 1 | **JSON API** | `GET /api/procedures/[code]` — a real HTTP endpoint the agent consumes via `fetch`. Backed by a procedure catalog (CPT codes, modality, contrast, prep, prior-auth flags, cost ranges). Returns `404` + `availableCodes` for unknown codes, which the agent then synthesizes. |
| 2 | **Search** | `web_search` tool. Uses **Tavily** when `TAVILY_API_KEY` is set; otherwise a curated, source-attributed **payer knowledge base** (`lib/data/payers.ts`) so the demo works fully offline. |
| 3 | **MCP** | A custom **`office-memory` MCP server** (`mcp-server/index.ts`) over stdio, backed by **SQLite**. Tools: `save_finding`, `save_office_summary`, `get_patient_history`, `recall_similar_preps`, `get_summary`, `delete_summary`, `delete_all_summaries`, `list_recent_summaries`. |

---

## Architecture

```
Browser (React portal, SSE)
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
   │                          ├─ Human-in-the-loop approval gate (lib/agent/approvals.ts)
   │                          └─ Tracer (observability, lib/agent/tracing.ts)
   ▼
MCP client (stdio) ──spawns──► office-memory MCP server ──► SQLite (.data/office-memory.db)
```

Every step is emitted as a **typed event** (`lib/types.ts`) over SSE and rendered live: `run_started`,
`plan`, `phase`, `reasoning`, `tool_call`/`tool_result`, `finding`, `risk`, `recommendation`,
`approval_required`/`approval_resolved`, `summary`, `trace`, `error`, `run_completed`.

---

## Dual-mode agent (LLM + heuristic)

- **LLM mode** (`ANTHROPIC_API_KEY` set): a genuine Anthropic tool-use loop. The model plans, selects
  tools, formulates search queries, reasons over results, and calls a structured
  `finalize_preparation` tool to emit the summary. If the model ends without finalizing, the
  orchestrator synthesizes a summary from what was gathered (never fails empty).
- **Heuristic mode** (no key): a deterministic planner that still exercises **all three sources**,
  derives findings/risks, and synthesizes the same structured summary. Guarantees the demo always
  runs and is reproducible.

The same fallback philosophy applies throughout: procedure `404` → synthesized record, Tavily failure
→ knowledge base, MCP unavailable → run continues without persistence.

---

## Feature tour

The frontend is a portal-style app (`app/page.tsx`) with a sidebar, top bar, and four views:

- **Dashboard** — greeting, quick stats (saved preps, agent mode, search provider, catalog size),
  a "Start new prep" CTA, and recent preps.
- **New prep** — the appointment form (with sample presets, searchable carrier/procedure comboboxes,
  and a human-approval toggle) plus the live workspace.
- **History** — a full table of saved preps with view/delete and a "clear all", backed by MCP.
- **Settings** — system status, account info, and office-memory management.

The **workspace** (in New prep) organizes results into tabs to keep information dense:

- **Summary** — headline, overview, insurance summary, prior auth, coverage, prep, questions, risks,
  and owner-assigned recommended actions.
- **Outreach** — the **Patient Outreach Kit**: auto-drafted SMS, confirmation email, "what to bring"
  checklist, and payer-verification call script. One-click copy, `sms:`/`mailto:` send, and an
  optional **"Refine with AI"** that rewrites the patient messages in warmer, plain language
  (LLM, with deterministic fallback).
- **Activity** — live timeline of plan, reasoning, and every tool invocation (with source + latency).
- **Findings** — gathered information grouped by source.
- **Trace** — observability: tool/LLM counts, durations, token usage, persistence status.

Additional product touches:

- **Ask Prep AI** — a floating chat (`/api/ask`) that answers questions grounded in the current
  prep's summary, or from the payer knowledge base for general questions.
- **Human approval workflow** — pause-and-approve before persistence.
- **Mock auth** — a local sign-in personalizes the portal; the avatar menu signs out.

---

## Running locally

Requirements: **Node 20+** (built/tested on Node 22) and a package manager (bun, npm, or pnpm).

```bash
# install
bun install            # or: npm install

# optional: enable LLM + live search
cp .env.example .env.local   # then add ANTHROPIC_API_KEY / TAVILY_API_KEY

# dev
bun run dev            # or: npm run dev
# open http://localhost:3000
```

No keys? It still works end-to-end — you'll see the `Heuristic mode` + `Knowledge base` badges.

```bash
# production build
bun run build && bun run start
```

---

## API reference

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/agent` | Run the agent; streams SSE events |
| `POST` | `/api/agent/approve` | Resolve a human-approval request |
| `GET`  | `/api/procedures/[code]` | Source 1 — procedure details |
| `POST` | `/api/ask` | Ask Prep AI chat (grounded Q&A) |
| `POST` | `/api/outreach` | Generate / AI-refine the outreach kit |
| `GET`  | `/api/summaries` | List persisted summaries (MCP) |
| `DELETE` | `/api/summaries` | Clear all office memory |
| `GET` / `DELETE` | `/api/summaries/[id]` | Fetch / delete a single summary |
| `GET`  | `/api/health` | Mode/config probe |

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

## Configuration

All environment variables are **optional** (see `.env.example`):

| Variable | Default | Effect |
|----------|---------|--------|
| `ANTHROPIC_API_KEY` | — | Enables LLM tool-use mode (else heuristic) |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` | Model used in LLM mode |
| `TAVILY_API_KEY` | — | Enables live web search (else knowledge base) |
| `MEMORY_DB_PATH` | `.data/office-memory.db` | SQLite location for office memory |

---

## Deployment notes

This app is **not serverless/edge-friendly** — it spawns a child process (the MCP server) and writes
a SQLite file. Deploy to a **long-running Node host**:

- **Recommended hosts:** Render, Railway, Fly.io, AWS App Runner / ECS / EC2 (Docker is the cleanest
  path). Avoid Vercel/edge for the MCP + SQLite combination.
- **Writable disk:** the SQLite DB needs a writable path. For persistence, mount a volume and set
  `MEMORY_DB_PATH` to it (`/tmp` works but is ephemeral).
- **Dependencies:** `tsx` and `better-sqlite3` are runtime dependencies (the MCP server is run via
  `node --import tsx mcp-server/index.ts`), so a prod-only install still works.
- **Build/run:** `bun run build` then `bun run start` (or `npm`), behind the platform's port.

### Deploy to Render (recommended)

A `Dockerfile` and `render.yaml` blueprint are included.

1. Push this repo to GitHub (already done if you're reading this there).
2. In Render: **New + → Blueprint**, connect the repo, and apply — it reads `render.yaml`
   (a Docker web service, free plan, health check at `/api/health`).
   *Or* **New + → Web Service → Docker** and point it at the repo.
3. (Optional) Add `ANTHROPIC_API_KEY` / `TAVILY_API_KEY` in the service's **Environment** tab to
   enable LLM mode + live search. Without them it runs in heuristic / knowledge-base mode.
4. Deploy. The app listens on Render's injected `PORT`; the MCP server is spawned inside the
   container and writes to `/data/office-memory.db`.

> **Persistence:** on the free plan `/data` is ephemeral (office memory resets on redeploy). For
> durable cross-run memory, attach a **Persistent Disk** mounted at `/data` (paid) — uncomment the
> `disk:` block in `render.yaml`.

The same Docker image works on Railway and Fly.io with their respective volume settings.

---

## Evaluation mapping

- **AI Agent Design** — planning, dynamic tool selection, self-formulated search queries,
  cross-source reasoning, autonomous `finalize_preparation`.
- **Engineering Quality** — typed event contract, clean source/tool separation, graceful degradation
  (404 → synthesized record, Tavily → KB, LLM → heuristic), Zod validation, SSE with heartbeats,
  lint/type clean.
- **Product Thinking** — owner-assigned, prioritized, time-aware recommendations **plus** ready-to-send
  patient outreach a front desk can use immediately.
- **MCP Usage** — a real client/server MCP integration with persistence **and** cross-run recall.

### Bonus features included

- ✅ **Memory across runs** (SQLite via MCP; `recall_similar_preps` reuses carrier+procedure knowledge)
- ✅ **Human approval workflow** (toggle → pause → approve/reject before persistence)
- ✅ **Streaming updates** (SSE end-to-end)
- ✅ **Observability/tracing** (per-tool durations, token usage, run trace panel)
- ✅ **Graceful, key-free demo mode**
- ⬜ Multi-agent architecture — partial (LLM refine is a second role, not a full multi-agent split)
- ⬜ AWS deployment — see [Deployment notes](#deployment-notes)

---

## Project layout

```
app/
  api/
    agent/route.ts              SSE agent endpoint
    agent/approve/route.ts      human-in-the-loop approval
    procedures/[code]/route.ts  Source 1 JSON API
    ask/route.ts                Ask Prep AI chat
    outreach/route.ts           patient outreach generation + AI refine
    summaries/route.ts          list / clear-all summaries (MCP)
    summaries/[id]/route.ts     get / delete a summary (MCP)
    health/route.ts             mode/config probe
  components/                   UI: portal chrome, workspace tabs, forms, views
  page.tsx                      main app (views + workspace)
  globals.css                   Klearforce-aligned design system
lib/
  agent/orchestrator.ts         agent loop (LLM + heuristic), synthesis, persistence
  agent/tools.ts                unified tool registry across the 3 sources
  agent/prompts.ts              system prompt + finalize schema
  agent/approvals.ts            human-approval registry
  agent/tracing.ts              observability
  mcp/client.ts                 MCP client manager (spawns the server)
  tools/search.ts               search (Tavily + KB fallback)
  data/procedures.ts            procedure catalog (Source 1 data)
  data/payers.ts                payer knowledge base (search fallback)
  llm/anthropic.ts              Anthropic client provider
  outreach.ts                   patient outreach kit generator
  useAgentRun.ts                client hook: SSE consumption + run state
  useAuth.ts                    client hook: local mock auth
  types.ts                      shared domain + event types
mcp-server/index.ts             custom office-memory MCP server (SQLite)
```
