-- Fix (found by supabase-security-scanner, verified live against the
-- linked project via a 401/42501 "permission denied" from PostgREST):
--
-- Supabase CLI-applied migrations don't automatically grant table
-- privileges to anon/authenticated the way tables created through the
-- Dashboard do. PostgreSQL checks table-level GRANTs *before* RLS, so
-- without these grants, every RLS policy from the previous migration was
-- inert — including on the intentionally-public published_reviews table.

grant usage on schema public to anon, authenticated;

grant select, insert, delete on advisor_sessions to authenticated;
grant select, insert, delete on match_reviews to authenticated;
grant select, insert on documents to authenticated;
grant select on stats_cache to authenticated;
grant select, insert, delete on published_reviews to authenticated;

-- Second fix, same scan: published_reviews' SELECT policy is
-- `using (true)` — open by row, to any role. RLS is row-level only, so a
-- plain `select *` would also return the internal user_id/match_review_id
-- columns, which exist for management/cascade, not for public display.
-- The actual threat model for a public share link is an anonymous
-- internet visitor, so anon gets a column-narrowed view instead of any
-- base-table access at all. (authenticated keeps full base-table access
-- above, for the owner-management UI planned in a later build phase;
-- narrowing that further — so one signed-in user can't see another's
-- internal ids on published rows — is a follow-up once that UI exists.)
create view public.published_review_shares
  with (security_invoker = true) as
select slug, review_excerpt, match_summary, published_at
from published_reviews;

grant select on public.published_review_shares to anon, authenticated;
