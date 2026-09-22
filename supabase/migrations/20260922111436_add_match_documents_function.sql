-- pgvector similarity search backing the post-match reviewer's
-- search_notes tool. Functions default to SECURITY INVOKER unless marked
-- otherwise (unlike views, which default the other way — see
-- 20260921124459_fix_review_shares_view_invoker.sql), so this correctly
-- runs as the calling authenticated user, and auth.uid() resolves to
-- their real id from the request's JWT. RLS on documents already
-- enforces the same "public hero docs or my own rows" boundary; the
-- WHERE clause here matches it explicitly so the intent is visible in
-- the query itself, not just inherited silently from the table's policy.
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (id uuid, kind text, content text, similarity float)
language sql
stable
security invoker
set search_path = public
as $$
  select id, kind, content, 1 - (embedding <=> query_embedding) as similarity
  from documents
  where user_id is null or user_id = auth.uid()
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Same CLI-migration-grants gotcha as every table so far — functions
-- need an explicit grant too, not just RLS on the underlying table.
grant execute on function match_documents(vector, int) to authenticated;
