-- Adds admin approval gating to join_events.
--
-- Anyone can still create an event and it stays visible on the calendar,
-- but sign-ups from anyone other than the host are blocked until the
-- admin sets approved_at (via the approveEvent action / admin page).
--
-- Backwards compatibility: existing rows get approved_at = now() so nothing
-- that was already visible before this change is retroactively locked out.

ALTER TABLE join_events
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

UPDATE join_events
    SET approved_at = now()
    WHERE approved_at IS NULL;
