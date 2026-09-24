-- The laning and itemization advisors are being replaced by one combined
-- match advisor. Widening rather than replacing the constraint — existing
-- rows already carry 'laning'/'itemization' and must stay valid.
alter table advisor_sessions drop constraint advisor_sessions_advisor_type_check;
alter table advisor_sessions add constraint advisor_sessions_advisor_type_check
  check (advisor_type in ('laning', 'itemization', 'match'));
