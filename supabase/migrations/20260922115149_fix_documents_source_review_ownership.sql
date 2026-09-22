-- Fix (found by supabase-security-scanner, verified live and exploitable):
-- the documents INSERT policy only checked `auth.uid() = user_id`, never
-- that `source_review_id` actually belongs to a match_reviews row the
-- inserting user owns. Confirmed live: user A could insert a documents
-- row with user_id = A but source_review_id pointing at user B's private
-- match_reviews row. This didn't leak B's review content (the SELECT
-- policy still filters by user_id), but it did two real things: (1) a
-- cross-user existence oracle — an FK-violation vs. success distinguishes
-- "this UUID is a real match_reviews row" from "it isn't," for rows the
-- caller has no access to; (2) forged attribution that rides
-- source_review_id's `on delete cascade` — if B ever deletes their own
-- review, A's row silently disappears too, an unexpected cross-user side
-- effect one user could trigger on another's data.
drop policy "owner can insert their own review embeddings" on documents;

create policy "owner can insert their own review embeddings"
  on documents for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      source_review_id is null
      or exists (
        select 1 from match_reviews mr
        where mr.id = source_review_id and mr.user_id = auth.uid()
      )
    )
  );
