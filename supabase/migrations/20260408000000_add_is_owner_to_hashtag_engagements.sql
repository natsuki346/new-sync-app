-- ハッシュタグオーナー機能: hashtag_engagements に is_owner カラムを追加
ALTER TABLE hashtag_engagements
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
