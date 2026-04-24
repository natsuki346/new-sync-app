-- =============================================================
-- 全 posts の expires_at を NOW() + 24 hours に再設定
-- 背景: モック投稿が 2026-04-09〜20 頃の expires_at で登録されており、
--       今日(2026-04-24) 時点で全件期限切れ → タイムラインが空になっていた
-- =============================================================

-- is_pinned = false の投稿を 24h に延長
UPDATE posts
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE is_pinned = false OR is_pinned IS NULL;

-- ピン止め投稿は expires_at を NULL にして永続化
UPDATE posts
SET expires_at = NULL
WHERE is_pinned = true;
