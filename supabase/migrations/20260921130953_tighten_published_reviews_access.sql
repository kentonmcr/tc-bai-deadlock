-- Fixes two issues found by an ai-code-reviewer pass on PR #1:
--
-- 1. The previous migration granted `authenticated` full SELECT on the
--    published_reviews base table (needed, at the time, for a
--    not-yet-built owner-management UI). Combined with the table's
--    `using (true)` read policy, this let ANY signed-in user dump every
--    user's published_reviews rows directly — not just the safe columns
--    via the column-narrowed view, and not scoped to a known slug at
--    all. No app code depends on this yet, so it's safe to revoke.
revoke select on published_reviews from authenticated;

-- 2. published_review_shares runs with security_invoker = false so it
--    can read published_reviews without anon needing a base-table grant.
--    But that means it runs as the table owner, and table owners are
--    exempt from RLS by default — not just today's `using (true)`
--    policy, but ANY future policy. If a later migration tightened the
--    base policy (e.g. to hide unpublished rows), the view would keep
--    ignoring it silently, since owner-exemption bypasses RLS
--    evaluation entirely, not just this specific policy.
--
--    FORCE ROW LEVEL SECURITY removes the owner-exemption, so the
--    security_invoker = false view actually re-evaluates whatever
--    policy exists on published_reviews, now and in the future. It does
--    NOT affect the service-role admin client used elsewhere in this
--    project — that role bypasses RLS via its BYPASSRLS role attribute,
--    which FORCE cannot override (FORCE only removes the OWNER-based
--    exemption).
alter table published_reviews force row level security;
