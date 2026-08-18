-- Convert event deletion from hard delete to soft delete so the admin
-- history panel can surface events that were previously wiped from the DB.
--
-- Pairs with a change to the deleteEvent action in the join Edge Function
-- (it now sets deleted_at on the event + canceled_at on its still-active
-- signups instead of DELETEing the rows).

ALTER TABLE join_events
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
