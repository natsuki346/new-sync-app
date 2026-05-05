-- conversations テーブルに status カラムを追加
-- bubble からの初回 DM は 'pending'、通常は 'approved'
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'blocked'));
