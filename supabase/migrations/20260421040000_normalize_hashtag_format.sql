-- =============================================================
-- posts.hashtags を # 付きに統一し、hashtag_engagements を再集計
-- 背景: posts.hashtags が '#' なし ('music') で格納されており、
--       follows.tag ('＃music') との overlaps() マッチが永久に失敗していた
-- =============================================================

-- 1. posts.hashtags を # 付きに正規化
UPDATE posts
SET hashtags = ARRAY(
  SELECT CASE
    WHEN tag LIKE '#%' THEN tag
    ELSE '#' || tag
  END
  FROM unnest(hashtags) AS tag
)
WHERE hashtags IS NOT NULL AND array_length(hashtags, 1) > 0;

-- 2. hashtag_engagements を正規化後のデータで再集計
--    (# あり / なし の重複を避けるため TRUNCATE → 全件 INSERT)
TRUNCATE TABLE hashtag_engagements;

-- posts → post_count (# 付きタグで集計)
INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
SELECT
  p.user_id,
  t.tag,
  COUNT(*)::integer AS post_count,
  0                 AS reaction_count,
  false             AS is_owner
FROM posts p
CROSS JOIN LATERAL unnest(p.hashtags) AS t(tag)
WHERE p.hashtags IS NOT NULL
  AND array_length(p.hashtags, 1) > 0
GROUP BY p.user_id, t.tag
ON CONFLICT (user_id, tag)
DO UPDATE SET post_count = EXCLUDED.post_count;

-- reactions (target_type='post') → reaction_count
INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
SELECT
  r.user_id,
  t.tag,
  0                   AS post_count,
  COUNT(*)::integer   AS reaction_count,
  false               AS is_owner
FROM reactions r
JOIN posts p ON p.id = r.target_id
CROSS JOIN LATERAL unnest(p.hashtags) AS t(tag)
WHERE r.target_type = 'post'
  AND p.hashtags IS NOT NULL
  AND array_length(p.hashtags, 1) > 0
GROUP BY r.user_id, t.tag
ON CONFLICT (user_id, tag)
DO UPDATE SET reaction_count = EXCLUDED.reaction_count;
