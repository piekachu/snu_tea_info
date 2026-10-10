-- Redesign 회비 관리 based on admin feedback after first use:
--
--  1. 행사명/금액 used to be free text re-typed on every add, so a slightly
--     different spelling of the same event's name silently created a
--     second, unrelated-looking group. Now an "event" (name + amount) is
--     created once in its own `dues_events` row, then *selected* — never
--     retyped — when adding participants.
--
--  2. The `paid` boolean is replaced with a proper `status` column, so
--     상태 can be 미입금 / 입금완료 / 신청취소 / 불참비 부과 / 불참비 부과 완료,
--     not just paid-or-not.
--
-- This migration is data-preserving: the 6 real rows already in
-- dues_members (as of 2026-10-11, after manually deleting the Enter-key
-- double-submit duplicates — see the no-show-fee conversation) are backfilled
-- into the new shape, not dropped.

-- ── dues_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dues_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  amount      INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dues_events_name_idx ON dues_events (name);

-- one dues_events row per distinct (event_name, amount) already in use
INSERT INTO dues_events (name, amount)
SELECT DISTINCT event_name, amount FROM dues_members;

-- ── dues_members: event_name/amount -> event_id, paid -> status ────────────
ALTER TABLE dues_members ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES dues_events(id) ON DELETE CASCADE;
UPDATE dues_members dm SET event_id = de.id
  FROM dues_events de
  WHERE dm.event_name = de.name AND dm.amount = de.amount AND dm.event_id IS NULL;
ALTER TABLE dues_members ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE dues_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unpaid';
UPDATE dues_members SET status = CASE WHEN paid THEN 'paid' ELSE 'unpaid' END;
-- status values: 'unpaid' | 'paid' | 'canceled' | 'noshow_charged' | 'noshow_paid'
ALTER TABLE dues_members ADD CONSTRAINT dues_members_status_check
  CHECK (status IN ('unpaid', 'paid', 'canceled', 'noshow_charged', 'noshow_paid'));

ALTER TABLE dues_members DROP COLUMN IF EXISTS event_name;
ALTER TABLE dues_members DROP COLUMN IF EXISTS amount;
ALTER TABLE dues_members DROP COLUMN IF EXISTS paid;
ALTER TABLE dues_members DROP COLUMN IF EXISTS paid_at;

DROP INDEX IF EXISTS dues_members_event_idx;
CREATE INDEX IF NOT EXISTS dues_members_event_idx ON dues_members (event_id, created_at);
