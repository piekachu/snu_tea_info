-- Two new, unrelated admin-side tracking tables, both backing new actions on
-- the existing `content` Edge Function (supabase/functions/content/index.ts).
-- Run this once in the Supabase SQL editor, then redeploy that function.

-- ── 소모임 지원금 신청 (meetup support-fund applications) ───────────────────
-- A member who hosted/attended a 소모임 and wrote a 시음기 (tasting note)
-- applies here for the per-meetup support stipend. Public write (anyone with
-- the link can submit — no admin password), admin-only read/update so the
-- accounting team can track who applied, see the 시음기 photo + participant
-- list, approve, and mark the payment as sent.
CREATE TABLE IF NOT EXISTS support_fund_applications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_date       TEXT        NOT NULL,             -- "YYYY-MM-DD"
  meetup_time       TEXT,                             -- "HH:MM" or free text, optional
  tasting_note_url  TEXT        NOT NULL,              -- 시음기 photo, content-images bucket
  bank_name         TEXT,
  account_holder    TEXT,
  account_number    TEXT        NOT NULL,
  participants      JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- array of name strings
  applicant_name    TEXT,                             -- who submitted the application
  applicant_contact TEXT,
  -- 'submitted' -> 'approved' -> 'paid', or 'rejected' at the approval step
  status            TEXT        NOT NULL DEFAULT 'submitted',
  admin_note        TEXT,
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_fund_applications_status_idx
  ON support_fund_applications (status, created_at DESC);

-- ── 회비 관리 (dues / per-event payment tracking) ───────────────────────────
-- Admin-only, invisible to the public site. Upgraded replacement for the
-- standalone Tkinter 동아리 회비 관리 프로그램 (soeldayeon_money.py) — same
-- "event name / person / amount / paid or not" shape, now shared across
-- whoever on the accounting team has the admin password instead of living
-- in one autosave.txt on one laptop.
CREATE TABLE IF NOT EXISTS dues_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  amount      INTEGER     NOT NULL,
  paid        BOOLEAN     NOT NULL DEFAULT false,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dues_members_event_idx ON dues_members (event_name, created_at);

-- ── Storage ──────────────────────────────────────────────────────────────
-- 시음기 photos reuse the existing public "content-images" bucket (see
-- 2026-08-30_content_tables.sql) via a new, unauthenticated
-- `uploadSupportFundImage` action — deliberately separate from the
-- password-gated `uploadImage` action so applicants don't need the admin
-- password just to attach a photo. No new bucket/policy needed.
