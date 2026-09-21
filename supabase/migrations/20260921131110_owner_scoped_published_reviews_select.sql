-- Fix: the previous migration revoked SELECT on published_reviews from
-- authenticated entirely, which was too blunt and broke the owner's own
-- publish flow. Verified live: the owner's own INSERT into
-- published_reviews started failing with "permission denied for table
-- published_reviews", because Postgres requires SELECT privilege on any
-- column an RLS policy's USING/WITH CHECK clause references (here,
-- user_id) for the querying role — and PostgREST's insert/delete calls
-- need it too, independent of returned columns.
--
-- The correct fix is a genuinely owner-scoped SELECT policy, not
-- `using (true)` and not no access at all: an authenticated user's own
-- published_reviews row is fully visible to them (satisfies the RLS
-- predicate, and will back a future "my published reviews" management
-- UI), but another user's row is not — closing the "any signed-in user
-- can dump every user's published_reviews" gap without breaking
-- publish/unpublish. anon still has zero base-table access, reading only
-- the column-narrowed published_review_shares view.
drop policy "anyone can read a published review by slug" on published_reviews;

create policy "owner can read their own published review row"
  on published_reviews for select
  to authenticated
  using (auth.uid() = user_id);

grant select on published_reviews to authenticated;
