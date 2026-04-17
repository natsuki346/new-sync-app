-- ハッシュタグごとのフォロワー数を集計するRPC
CREATE OR REPLACE FUNCTION get_hashtag_follower_counts()
RETURNS TABLE(tag text, follower_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    tag,
    COUNT(*) AS follower_count
  FROM follows
  WHERE type = 'hashtag'
    AND tag IS NOT NULL
  GROUP BY tag
  ORDER BY follower_count DESC;
$$;

-- 認証ユーザー全員に実行権限を付与
GRANT EXECUTE ON FUNCTION get_hashtag_follower_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_hashtag_follower_counts() TO anon;

-- パフォーマンス向上のためのインデックス（既に存在する可能性あり）
CREATE INDEX IF NOT EXISTS idx_follows_type_tag
  ON follows(type, tag)
  WHERE type = 'hashtag' AND tag IS NOT NULL;
