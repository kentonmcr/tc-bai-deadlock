-- Postgres grants EXECUTE to PUBLIC (which includes anon) by default on
-- every newly created function. anon currently has no SELECT on
-- documents, so this was never exploitable, but it's a dangling grant
-- with no defense-in-depth: if a future migration ever grants anon
-- SELECT on documents (e.g. to let signed-out visitors browse hero-kit
-- text), this would immediately let anonymous callers run vector search
-- against the table with no additional review. Found by
-- supabase-security-scanner.
revoke execute on function match_documents(vector, int) from public;
