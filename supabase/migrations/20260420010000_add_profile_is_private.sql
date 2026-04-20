-- =============================================================
-- profiles に非公開設定フラグを追加
-- true の場合、非友達には投稿・メモリータブを非公開にする
-- =============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
