-- Fix: service_role never got explicit grants on any table in this
-- schema (same root-cause class as the anon/authenticated gap fixed in
-- an earlier migration — CLI-applied migrations don't get Supabase
-- Dashboard-style auto-grants). Verified live: the admin client reading
-- stats_cache in lib/deadlock-api.ts returned "permission denied," which
-- went unnoticed because cachedFetch() doesn't check that error and
-- silently falls through to a live API fetch — meaning the read-through
-- cache has never actually cached anything since it was written.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Cover future tables too, so this can't recur for service_role
-- specifically. This is safe to make automatic (unlike anon/authenticated,
-- which stay deliberate and per-table) because service_role is already
-- meant to have unrestricted access by design — it bypasses RLS via its
-- own role attribute regardless of grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
