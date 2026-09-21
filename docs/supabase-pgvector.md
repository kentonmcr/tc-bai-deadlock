Source: https://supabase.com/docs/guides/ai/vector-columns
Also: https://supabase.com/docs/guides/ai/vector-indexes

# Supabase pgvector — notes for this project

Reference notes on the two Supabase AI/vectors docs pages above, and how
they shaped the `documents` table in
`supabase/migrations/20260921122704_init_schema.sql`.

## Enabling the extension

pgvector is enabled per-project via `create extension vector with schema
extensions;` (or the Dashboard's Extensions tab). Our migration runs
`create extension if not exists vector;` — idempotent, safe to re-run.

## Choosing the vector dimension

Supabase's guidance: pick the dimension to match your embedding model's
actual output, and note that "embeddings with fewer dimensions perform
best" for their own example (384-dim `gte-small`). We're not free to
choose here, though — we use `openai/text-embedding-3-small` via
OpenRouter, which is a fixed 1536-dimension model. The `documents.embedding`
column is `vector(1536)` to match, and per CLAUDE.md this is pinned:
changing the embedding model later would silently break retrieval, since
old rows would still be embedded in the previous model's vector space
while new rows used a different one — comparing across the two is
meaningless (Supabase's own docs stress that comparisons only make sense
between embeddings from the *same* model).

## Index choice: HNSW over IVFFlat

Supabase's explicit recommendation: "In general we recommend using HNSW
because of its performance and robustness against changing data." IVFFlat
needs a `lists` parameter tuned to the table's row count, which becomes
stale as data grows and needs periodic rebuilding. HNSW doesn't have that
maintenance burden, which matters here because `documents` grows
continuously (a new row is added on every post-match review and whenever
a user's own history gets embedded) — we don't want an index that needs
manual retuning as usage grows. Hence:

```sql
create index documents_embedding_idx on documents
  using hnsw (embedding vector_cosine_ops);
```

## RLS on a table with a vector column

The pgvector docs don't cover RLS at all — it's an orthogonal concern.
`documents` has RLS enabled like every other table in this schema: public
hero-kit rows (`user_id is null`) are readable by any authenticated user,
and a user's own embedded match reviews are owner-scoped
(`auth.uid() = user_id`). The vector column itself isn't RLS-visible in
any special way — it's just another column, filtered by the same row
policies as everything else in the table.
