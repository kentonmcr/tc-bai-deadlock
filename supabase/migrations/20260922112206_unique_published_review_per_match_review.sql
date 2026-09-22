-- Without this, clicking "Publish" twice on the same review creates two
-- separate public slugs pointing at the same content — messy for the
-- owner (which one do they share/unpublish?) and pointless duplication.
-- One review, at most one published copy.
alter table published_reviews
  add constraint published_reviews_match_review_id_key unique (match_review_id);
