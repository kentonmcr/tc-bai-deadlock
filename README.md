# Deadlock Coach

An AI companion for Valve's Deadlock — an early-access, largely "unsolved" competitive MOBA where players struggle to itemize and counter-pick correctly because no settled meta exists yet.

## What it does, and why the AI is the point

Three features, each built around a real OpenRouter LLM call, not a decorative chatbot bolted onto a stats page:

1. **Laning Advisor** — pick your hero, lane partner, and enemy laner(s). An LLM ("Analyst" persona) synthesizes live win-rate/matchup/item data from the [Deadlock community API](https://api.deadlock-api.com) into a concrete laning buy order.
2. **Itemization Advisor** — same idea, reasoning across the entire 6-hero enemy team at once and weighing trade-offs a static stats page can't.
3. **Post-Match Reviewer** — given a finished match, an LLM ("Coach" persona) reviews your performance agentically: it decides for itself whether to search your own past reviews (pgvector RAG) or query the official [Deadlock MCP server](https://deadlock-api.com/data-dumps) for broader context, rather than always doing either.

**Why it's pointless without the LLM:** the underlying stats are already public on deadlock-api.com. The value here is an LLM synthesizing up to 7 simultaneous hero matchups into one decision, and reflecting on a specific match's events in natural language — strip out the LLM call and there's no app left, just a stats dashboard that already exists elsewhere.

## Live app

**[Deploy URL — added after deployment]**

## Optional task(s) completed

This project completed five optional tasks (against a minimum of one):

- **Agentic RAG** (Hard) — the post-match reviewer's `search_notes` tool does real pgvector semantic search over hero-kit text and the player's own past reviews; the model decides whether/what to search, not a fixed retrieval step.
- **Shareable AI Outputs** (Hard) — published reviews get a public, unauthenticated `/review/[slug]` URL; everything else in the app stays behind auth.
- **Tuned System-Prompt Persona** (Medium) — two deliberately distinct voices: the Analyst (terse, decisive, buy-order-first) and the Coach (reflective, teaching), tuned as their own focused passes.
- **Playwright Tests** (Medium) — `e2e/` covers the AI feature's happy path (a real, non-mocked AI response) and the signed-out visitor lockout.
- **Deploy to Vercel** (Medium) — see the live URL above.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in the four values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on a sign-in page — sign up for an account to reach the app.

### Environment variables

Set these in `.env.local` (never commit this file — it's git-ignored):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → your project → **Project Settings → API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → the `anon` / `publishable` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → the `service_role` / `secret` key — **server-only, never expose this** |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) → Create Key |

You'll also need the Supabase schema applied — with the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked to your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

And the hero-knowledge RAG documents seeded once:

```bash
node --env-file=.env.local scripts/seed-hero-docs.mjs
```

### Running the Playwright tests

```bash
npm run test:e2e
```

Uses the same `.env.local` (needs the service-role key to create/delete its own throwaway test accounts) and makes a real OpenRouter call for the happy-path test — no mocking, to genuinely prove the AI feature works end to end.

## Screenshot

**[Screenshot added below]**

## Tech stack

Next.js (App Router) on Vercel · Supabase (Auth + Postgres + pgvector) · OpenRouter (`openai/gpt-4o-mini` + `openai/text-embedding-3-small`) via the Vercel AI SDK · the official Deadlock community API and MCP server.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and AI rules, and [`docs/`](./docs) for cited references on the pgvector and MCP integration decisions.
