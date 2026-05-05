-- ── reports テーブル ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type      text        NOT NULL CHECK (content_type IN ('bubble', 'dm')),
  content_id        text        NOT NULL,
  reason            text        NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'other')),
  content_snapshot  text,
  ai_flagged        boolean     NOT NULL DEFAULT false,
  ai_score          float,
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ── bubbles テーブルに is_hidden カラムを追加 ──────────────────────────────
ALTER TABLE public.bubbles
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- ── messages テーブルに is_hidden カラムを追加 ─────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
