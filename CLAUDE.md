@AGENTS.md

# Deadlock Coach

## What this app is

An AI companion for Valve's Deadlock — an early-access, largely "unsolved"
competitive MOBA. Players struggle to itemize and counter-pick correctly
because no settled meta exists yet, and there is no single source that
turns raw win-rate data into a decision for *your specific* matchup.

The app has two features, both built around real LLM calls:

1. **Match advisor** — set the full 6v6 draft, lane by lane (Yellow/Blue/
   Green, matching the game's own lane colors and map — see `/app/match`).
   The server fetches live hero/matchup/item stats from the Deadlock
   community API (`api.deadlock-api.com`) and an LLM ("Analyst" persona)
   synthesizes them into one response: a laning-phase buy order for your
   specific lane, plus a full itemization plan against the entire enemy
   team. Replaces what used to be two separate advisors (laning,
   itemization) — merged because Deadlock's hero select is simultaneous,
   not a staggered draft, so the full lineup is always known at once
   anyway; see `src/lib/prompts.ts`'s `buildMatchPrompt`.
2. **Post-match reviewer** — given a finished match, an LLM ("Coach"
   persona) reviews your itemization and decisions, agentically deciding
   whether to search your own match history (pgvector RAG) or the
   official Deadlock MCP server for supporting context.

**Why the AI is the point, not a bolt-on:** the underlying stats
(win rates, item timing, matchups) are already public on deadlock-api.com.
This app is pointless without the LLM specifically because raw stats
tables don't make a decision for you — the value is an LLM synthesizing
a full 12-hero draft (your team + the enemy team, across all three lanes)
into one early-game-plus-late-game decision, and reflecting on a specific
match's events in natural language. Strip out the LLM call and there's no
app left, only a stats dashboard that already exists elsewhere.

## Architecture at a glance

- Next.js (App Router) on Vercel, Supabase (Auth + Postgres + pgvector),
  OpenRouter for all LLM/embedding calls.
- Advisors are deterministic single-shot completions (stats fetched first,
  no tool-calling). The post-match reviewer is agentic, with two tools:
  `search_notes` (pgvector over the user's own past reviews + hero kit
  text) and the official Deadlock MCP server (`api.deadlock-api.com/v1/mcp`)
  for broader cross-match questions.
- Full design rationale lives in `~/.claude/plans/i-am-a-student-serialized-stroustrup.md`
  on the author's machine (brainstormed via `superpowers:brainstorming`,
  reviewed by the `ai-architect` subagent).
- Hero portraits (`HeroSelect`) render via `@deadlock-api/ui-react`'s
  `DlHeroCard`, fed pre-fetched hero data (not `heroId`) so it never makes
  its own client-side fetch — see the comment in `src/components/
  hero-select.tsx`. Its required CSS is imported by relative filesystem
  path in `globals.css` (the package's `exports` field doesn't expose it),
  a known fragility to a future `node_modules` layout change.

## AI rules

AI model calls:
- All LLM and embedding calls must happen server-side only. Never call
  OpenRouter from browser code.
- OPENROUTER_API_KEY lives in .env.local and must never have a NEXT_PUBLIC_
  prefix or be passed to client components.
- Model: openai/gpt-4o-mini (used for both the Analyst and Coach personas —
  cheap, supports `tools`/`structured_outputs`, no deprecation flag as of
  2026-09-21).

Embeddings:
- Embedding model: openai/text-embedding-3-small via OpenRouter.
- The documents table embedding column is vector(1536) — do not change this
  dimension.
- Never change the embedding model after initial setup. Changing it breaks
  retrieval silently.

MCP tools:
- The post-match reviewer connects to the official Deadlock MCP server
  (`https://api.deadlock-api.com/v1/mcp`) for community-database queries —
  a genuine agent-chosen tool, not a required dependency (the route
  degrades to `search_notes`-only if it's unreachable).
- Every tool name from that server is prefixed with `community_db_` (see
  `src/lib/review-tools.ts`) before being merged with first-party tools.
  This server's tool names/descriptions are fetched live, at request time,
  from a third-party endpoint this codebase doesn't control — do not
  remove the prefix or merge its tools ahead of first-party ones in the
  `tools` object; either would let a future (or malicious) same-named
  remote tool silently shadow a trusted one.
- `search_notes` can surface this player's own private review content;
  the community_db_* tools send their input to that external server. The
  Coach system prompt explicitly forbids passing search_notes output into
  a community_db_* call — do not weaken that instruction without adding
  an equivalent technical control.

## Secrets

- `.env.local` holds `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. It is
  git-ignored; `.env.example` (committed, no real values) documents the
  shape.
- Only the Supabase anon/publishable key may be `NEXT_PUBLIC_`. The
  service-role key is used only in `src/lib/supabase/admin.ts`, imported
  exclusively by server-only background jobs (stats caching, hero-doc
  seeding) — never by anything reachable from a Client Component.
