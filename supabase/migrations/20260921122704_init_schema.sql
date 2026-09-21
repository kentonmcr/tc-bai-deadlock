-- Deadlock Coach — initial schema
-- Every table storing data is owner-scoped via RLS. See docs/ for the
-- pgvector reference and CLAUDE.md for why the embedding dimension is
-- pinned at 1536.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- advisor_sessions — saved laning/itemization advice (base persistence
-- requirement, independent of the RAG pieces below).
-- ---------------------------------------------------------------------
create table advisor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  advisor_type text not null check (advisor_type in ('laning', 'itemization')),
  input jsonb not null,
  advice text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index advisor_sessions_user_id_idx on advisor_sessions (user_id);

alter table advisor_sessions enable row level security;

create policy "owner can read their advisor sessions"
  on advisor_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "owner can insert their advisor sessions"
  on advisor_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "owner can delete their advisor sessions"
  on advisor_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- match_reviews — private post-match coaching reviews. This table never
-- gets a public policy; sharing goes through published_reviews instead
-- so a mistake here can't leak every user's private reviews.
-- ---------------------------------------------------------------------
create table match_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id text not null,
  review text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index match_reviews_user_id_idx on match_reviews (user_id);

alter table match_reviews enable row level security;

create policy "owner can read their match reviews"
  on match_reviews for select
  to authenticated
  using (auth.uid() = user_id);

create policy "owner can insert their match reviews"
  on match_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "owner can delete their match reviews"
  on match_reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- published_reviews — the Shareable AI Outputs surface. Holds only a
-- safe-to-show snapshot, keyed by a random slug (never derived from the
-- match id or the source review's id). Publicly readable, but nothing
-- else in the schema is, so a public policy here can't cascade into a
-- leak of private data elsewhere.
-- ---------------------------------------------------------------------
create table published_reviews (
  id uuid primary key default gen_random_uuid(),
  match_review_id uuid not null references match_reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  review_excerpt text not null,
  match_summary jsonb,
  published_at timestamptz not null default now()
);

alter table published_reviews enable row level security;

create policy "anyone can read a published review by slug"
  on published_reviews for select
  to anon, authenticated
  using (true);

create policy "owner can publish their own review"
  on published_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "owner can unpublish their own review"
  on published_reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- documents — pgvector RAG store. Two kinds of rows: hero/item kit text
-- (user_id null, seeded by the service role, readable by any signed-in
-- user) and embeddings of a user's own past match reviews (user_id set,
-- owner-scoped). Embedding model: openai/text-embedding-3-small via
-- OpenRouter — see CLAUDE.md. Do not change the vector dimension.
-- ---------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  source_review_id uuid references match_reviews (id) on delete cascade,
  kind text not null check (kind in ('hero_kit', 'match_review')),
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index documents_embedding_idx on documents
  using hnsw (embedding vector_cosine_ops);

create index documents_user_id_idx on documents (user_id);

alter table documents enable row level security;

create policy "authenticated users can read public hero docs and their own"
  on documents for select
  to authenticated
  using (user_id is null or auth.uid() = user_id);

create policy "owner can insert their own review embeddings"
  on documents for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- stats_cache — short-TTL cache of Deadlock community API responses.
-- Not user data, but still RLS-enabled rather than left open: readable
-- by any signed-in user, writable only by the service role (background
-- fetch/seed jobs), never by a client request.
-- ---------------------------------------------------------------------
create table stats_cache (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  response jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (endpoint, params)
);

alter table stats_cache enable row level security;

create policy "authenticated users can read cached stats"
  on stats_cache for select
  to authenticated
  using (true);
