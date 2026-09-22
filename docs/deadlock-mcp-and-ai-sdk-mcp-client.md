Source: https://deadlock-api.com/data-dumps
Also: AI SDK MCP client docs, bundled at node_modules/ai/docs/03-ai-sdk-core/16-mcp-tools.mdx (mirrors https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — MCP section)

# Deadlock MCP server + AI SDK MCP client — notes for this project

Reference notes on the official Deadlock community MCP server and the
Vercel AI SDK's MCP client, and how they shaped the post-match reviewer
in `src/lib/review-tools.ts` and `src/app/api/review/route.ts`.

## What the server actually is

`https://deadlock-api.com/data-dumps` advertises "Query daily snapshots
of the Deadlock API database from your AI assistant via MCP" at
`https://api.deadlock-api.com/v1/mcp` — free, read-only, no auth. Live
inspection (connecting with `@ai-sdk/mcp`'s `createMCPClient` and calling
`.tools()`) showed it's not one fixed lookup but four genuine tools:
`execute_query` (raw read-only SQL, DuckDB dialect, against **hourly**
DuckDB snapshots — fresher than the page's own "daily" framing), plus
`list_databases`/`list_tables`/`list_columns` for schema discovery. This
is why it's wired in as a real agentic tool for the reviewer rather than
a fixed API call like the advisors use — the model can explore the
schema and decide what to query.

## Two things learned only by testing live, not from either doc

1. **Unfiltered or broadly-scoped queries against `match_player` (151
   parquet files, incremental export) can take 30s+ and even hit the MCP
   server's own 120-second Cloudflare proxy timeout.** Neither the
   server's tool descriptions nor the AI SDK docs surface this — it only
   showed up by actually running `execute_query` with a real query.
   `COACH_SYSTEM_PROMPT` now explicitly tells the model to scope queries
   narrowly, and `src/lib/review-tools.ts` bounds the MCP connect +
   `tools()` listing with a manual timeout (the AI SDK's own `tools()`
   method doesn't accept a `RequestOptions`/timeout parameter, unlike
   `listTools()`/`callTool()` — confirmed by reading
   `node_modules/@ai-sdk/mcp/dist/index.d.ts`), and `streamText`'s
   `timeout: { toolMs, totalMs }` bounds the agentic loop itself.

2. **A third-party MCP server's tool names, descriptions, and schemas are
   fetched live, at request time, and are not something this codebase
   controls.** The AI SDK's own docs call this out as the "rug pull" tool
   drift class of risk and ship `fingerprintTools`/`detectToolDrift` for
   it — not implemented here (out of scope for this project), but the
   cheaper, structural mitigation is applied: every tool name from this
   server gets a `community_db_` prefix before merging with first-party
   tools, so a same-named remote tool can never silently shadow
   `search_notes` regardless of object-merge order. See CLAUDE.md's "MCP
   tools" section.
