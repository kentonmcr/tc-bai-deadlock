-- Fix (found by supabase-security-scanner, verified live): anon and
-- authenticated hold TRUNCATE, TRIGGER, REFERENCES, and MAINTAIN on every
-- table, inherited from Supabase's platform-level schema bootstrap rather
-- than granted deliberately by any migration here. RLS does not govern
-- TRUNCATE at all — any principal able to reach Postgres as one of these
-- roles directly (bypassing PostgREST, e.g. via a leaked pooler
-- connection string in some future job) could wipe every row in every
-- table regardless of RLS policy. Not reachable through the app's actual
-- attack surface today (PostgREST has no TRUNCATE endpoint), but removed
-- as defense-in-depth since these roles have no legitimate use for them.
revoke truncate, trigger, references, maintain
  on all tables in schema public
  from anon, authenticated;
