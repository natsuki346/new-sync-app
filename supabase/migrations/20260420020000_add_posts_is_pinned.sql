-- =============================================================
-- posts にピン止めフラグを追加
-- true の場合、expires_at に関係なくプロフィールに常時表示される
-- =============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
