# Instruction.md — Regulation Transformer (Current State Baseline)

> This document is the **spec-driven development baseline**. It captures exactly what
> the "Regulation Transformer" module does today, as built in Lovable. Every future
> prompt/change to this module should be written as a diff against this document:
> state what changes, why, and which section of this file it updates.
>
> Use case this module sits inside: **"Regulatory change into enterprise action."**
> This module currently implements only the **Received → Interpreted → Obligation-Mapped**
> slice of that end-to-end flow (see Pain Points section in chat for the rest).

---

## 1. Module Identity

- **Name**: Regulation Transformer
- **Stack**: TanStack Start (file-based routing) + React 19 + TypeScript + Tailwind v4 + shadcn/ui (`new-york` style)
- **Build tool**: Vite 8 via `@lovable.dev/vite-tanstack-config`
- **Hosting model**: Lovable-managed, connected to GitHub (AGENTS.md enforces: never rewrite published git history)
- **Route**: single page at `/` (`src/routes/index.tsx`)

---

## 2. Data Source Contract

**File**: `src/lib/databricks.server.ts`

- Backend: Databricks SQL Warehouse, warehouse ID hardcoded (`d379ec542f3028fb`)
- Table: `tcsai.gold.regulation_records` (exported as `REGULATION_TABLE`)
- Access path: not direct — goes through a Lovable **connector gateway**
  (`CONNECTOR_GATEWAY_BASE_URL`, default `https://connector-gateway.lovable.dev/databricks`)
- Auth: two secrets required — `LOVABLE_API_KEY` (gateway auth) and `DATABRICKS_API_KEY`
  (passed as `X-Connection-Api-Key`). Throws if either is missing.
- Query pattern: `POST /2.0/sql/statements`, `wait_timeout: "30s"`, polls for `status.state === "SUCCEEDED"`.
- Output shape: `string[][]` (raw row cells, no typed columns from the warehouse side —
  typing happens client-side in `regulations.server.ts`).

**Known columns consumed** (from `regulations.server.ts` SQL):
`document_id, chunk_id, title, agency, authority, regulation, summary`

There is **no obligation-level or clause-level granularity** in the schema being read —
`chunk_id` exists but is only used to build a composite `id` (`${documentId}::${chunkId}`),
not to preserve exact source text spans for citation.

---

## 3. Domain Model (as implemented)

```
RegulationRecord {
  id: string            // `${documentId}::${chunkId}`
  documentId: string
  chunkId: string
  title: string
  agency: string
  authority: string
  regulation: string
  summary: string
}

TriageResult {
  manufacturing_related: boolean
  confidence: number        // 0–1
  rationale: string
}

ExtractionResult {
  summary: string
  obligations: string[]
  products: string[]
  business_units: string[]
  affected_areas: string[]
  risk: string               // "Low" | "Medium" | "High" | "Unknown" (untyped string)
}
```

**No persistence model exists** for these results beyond the current browser session
(React Query cache only — see §6).

---

## 4. Agent Contracts

**File**: `src/lib/ai.server.ts` — shared `chatJson<T>(system, user)` helper.

- Gateway: `https://ai.gateway.lovable.dev/v1/chat/completions` (OpenAI-compatible)
- Model: `google/gemini-2.5-flash` (hardcoded constant `MODEL`)
- Forces `response_format: { type: "json_object" }`
- Strips ```` ```json ```` fences defensively before `JSON.parse`
- Error handling: explicit messages for HTTP 429 (rate limit) and 402 (credits exhausted);
  generic throw on parse failure or other non-2xx.

### Agent 1 — Triage (`regulations.server.ts::triage`)
- **Role framing**: "regulatory Triage Agent for a manufacturing enterprise (engines,
  powertrain, vehicles, industrial equipment)"
- **Input**: title, agency, regulation, summary (plain text, no schema/citations passed in)
- **Output contract**: strict JSON, no markdown, matches `TriageResult`
- **Decision boundary**: manufacturing relevance only — not compliance risk, not urgency

### Agent 2 — Knowledge Extraction (`regulations.server.ts::extract`)
- **Gated by triage**: only invoked from the UI if `triage.result.manufacturing_related === true`
  (`routes/index.tsx::run()`), not enforced server-side
- **Role framing**: "Knowledge Extraction Agent turning regulations into enterprise actions"
- **Output contract**: `ExtractionResult`, with instructions to keep each list item
  under 200 characters and business units constrained to an example set
  (Engine, Powertrain, Manufacturing, Quality, Legal — not enforced as an enum)
- **No citation requirement**: obligations are free text, not linked back to `chunk_id`
  or any span of the source `summary`/`regulation` field

---

## 5. Server Function Layer

**File**: `src/lib/regulations.functions.ts` — TanStack Start `createServerFn` wrappers,
each with a Zod input validator:

| Function | Method | Input | Delegates to |
|---|---|---|---|
| `listRegulations` | POST | `{ limit: number (default 25), search: string (default "") }` | `fetchRecords` |
| `runTriage` | POST | `{ id: string }` | `triage(id)` |
| `runExtraction` | POST | `{ id: string }` | `extract(id)` |

Search (`fetchRecords`) does a case-insensitive `LIKE` across title/summary/agency/regulation
concatenated server-side in SQL — not a semantic/vector search.

---

## 6. UI / Interaction Contract

**File**: `src/routes/index.tsx`

- Single-page layout: left column = searchable list of regulation records (max 40 fetched
  by default), right column = sticky results panel.
- Interaction sequence per record: click "Run agents" → `run(id)`:
  1. sets `selected`, resets extraction state
  2. awaits `triage.mutateAsync(id)`
  3. if `manufacturing_related`, fires `extraction.mutate(id)` (fire-and-forget)
- State is **entirely client-side** (`useMutation` from TanStack Query) — closing the tab
  or refreshing loses all triage/extraction results. Nothing is written back to Databricks
  or any other store.
- Raw JSON of the extraction result is shown in a collapsible `<details>` block — this is
  the only "audit" surface that currently exists, and it's not persisted or exportable.

---

## 7. Cross-cutting Infrastructure (not domain-specific, but constrains changes)

- **Error capture** (`src/lib/error-capture.ts`): wraps `console.error` to expand
  Error objects (stack + cause chain, depth-limited to 5, 8000-char cap) because h3
  swallows stack traces into generic 500s. Also hooks `window.onerror` /
  `unhandledrejection`. Any new server-side throw path should rely on this rather than
  re-inventing logging.
- **Error UI** (`src/routes/__root.tsx`, `src/lib/error-page.ts`): root `errorComponent`
  reports to `window.__lovableEvents` / `window.__lovableReportRuntimeError` (Lovable
  editor telemetry) and renders a generic "This page didn't load" card. `error-page.ts`
  is a static HTML fallback for cases outside the React tree (likely SSR-level failure).
- **Routing convention** (`src/routes/README.md`): strict TanStack Start file-based
  routing; do not introduce Next.js/Remix-style `pages/` or `app/` directories.
- **Package management**: bun-based (`bunfig.toml`), 24h supply-chain guard on new
  package versions (`minimumReleaseAge`), with an explicit allowlist for `@lovable.dev/*`
  packages that bypass it.
- **Styling**: shadcn `new-york` style, Tailwind v4, CSS variables theme, no `prefix`.

---

## 8. Explicit Non-Goals (today)

These are not bugs — they are simply outside what's built, and should be treated as
open spec decisions for the next iteration, not implicit assumptions:

- No obligation-to-source-clause citation/traceability
- No impact scoring against enterprise assets/systems/contracts (only a flat `risk` string)
- No prioritization logic (no deadline, no severity ranking, no queueing)
- No ownership/assignment model (no accountable person/team field)
- No workflow states or state machine (received/interpreted/etc. are implicit, not modeled)
- No evidence capture or closure record
- No audit log of who/what changed what, when
- No persistence of agent outputs (session-only)
- No human-in-the-loop / legal validation gate before an obligation is considered "final"
- No enum/schema enforcement on `risk`, `business_units`, or other categorical LLM outputs
  (currently plain strings the model is merely instructed, not constrained, to follow)

---

## 9. How to Extend This Spec

For every new capability, add a new numbered section here **before** writing Lovable
prompts, containing:
1. Domain model change (new/changed types)
2. Agent or logic contract (LLM prompt role + input/output schema, or deterministic rule)
3. Persistence change (what table/field, what migration)
4. UI change (what the person sees/does differently)
5. Non-goals explicitly carried forward or retired

This keeps every Lovable prompt traceable to a spec diff instead of an ad hoc instruction.
