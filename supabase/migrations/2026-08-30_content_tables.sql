-- Admin-authored content: 공지사항 (notices), 정보 (info), 정기다회 (events).
-- Backs the new `content` Edge Function (supabase/functions/content/index.ts).
-- Run this once in the Supabase SQL editor.
--
-- These are intentionally separate from the hand-authored static pages that
-- already exist (notice/*.html, info/*.html, the 2026*/index.html event
-- folders) — those keep working exactly as they do today. Rows created here
-- are rendered by new generic "view" pages (Phase 2/3) and simply show up
-- alongside the static entries in each section's list.

-- ── 공지사항 (notices) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_notices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  title_en      TEXT,
  date          TEXT        NOT NULL,             -- "YYYY-MM-DD"
  excerpt       TEXT,
  excerpt_en    TEXT,
  body_html     TEXT        NOT NULL DEFAULT '',  -- rendered as-is on the view page
  body_html_en  TEXT,
  pinned        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ                        -- NULL = live; soft-delete otherwise
);

-- ── 정보 (info) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_info (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  title_en      TEXT,
  date          TEXT        NOT NULL,
  excerpt       TEXT,
  excerpt_en    TEXT,
  body_html     TEXT        NOT NULL DEFAULT '',
  body_html_en  TEXT,
  pinned        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- ── 정기다회 (events) — full richness: hero photo + intro + N tea sections ──
CREATE TABLE IF NOT EXISTS content_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date            TEXT        NOT NULL,            -- "YYYY-MM-DD"
  end_date        TEXT,                            -- multi-day events, optional
  time            TEXT,                            -- "HH:MM" or free text, optional
  title           TEXT        NOT NULL,
  title_en        TEXT,
  category        TEXT        NOT NULL DEFAULT 'regulars',  -- 'regulars' | 'specialTea'
  location        TEXT,
  map_link        TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  fee             TEXT,
  capacity        INTEGER,
  hero_image_url  TEXT,
  intro_title     TEXT,
  intro_title_en  TEXT,
  intro_body      TEXT,                            -- html
  intro_body_en   TEXT,
  -- One JSON object per tea section, array order = display order. Shape:
  --   { name, nameEn, subtitle, subtitleEn, photoUrl, detailPhotoUrl,
  --     description, descriptionEn, highlightTitle, highlightTitleEn,
  --     highlightQuote, highlightQuoteEn, highlightBody, highlightBodyEn,
  --     brewTemp, brewVolume, brewTime, brewNote, brewNoteEn }
  -- Mirrors the recipe_wrap/recipe_list_col + brew_stats markup used by the
  -- existing hand-authored event pages (see eventTemplate/index.html), so
  -- the dynamic view page can reproduce the same layout exactly.
  teas            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Helpful indexes for the common "live rows, newest/pinned first" queries.
CREATE INDEX IF NOT EXISTS content_notices_live_idx ON content_notices (pinned DESC, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_info_live_idx    ON content_info    (pinned DESC, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_events_live_idx  ON content_events  (date DESC)              WHERE deleted_at IS NULL;

-- ── Storage ──────────────────────────────────────────────────────────────
-- One-time manual step (Storage isn't managed via SQL): in the Supabase
-- dashboard → Storage, create a bucket named "content-images" and mark it
-- Public. The `content` Edge Function uploads to it with the service-role
-- key (bypasses bucket policies), so no additional RLS/policy setup is
-- needed — the bucket only needs to exist and be public so uploaded photos
-- are viewable by site visitors.
