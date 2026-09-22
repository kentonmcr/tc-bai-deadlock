-- match_reviews had nowhere to store the structured match context
-- (hero, win/loss, item timeline, etc.) used to generate the review —
-- only the free-text review itself and the raw match_id. Without this,
-- both the owner's own review view and the publish flow would need to
-- re-fetch from the live Deadlock API just to show basic match context.
alter table match_reviews add column summary jsonb;
