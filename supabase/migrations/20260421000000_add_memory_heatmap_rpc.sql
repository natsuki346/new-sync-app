-- =============================================================
-- get_memory_heatmap: 日付別活動量集計 RPC
-- 引数: p_user_id uuid
-- 返り値: activity_date, post_count, reaction_count, connection_count
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_memory_heatmap(p_user_id uuid)
RETURNS TABLE (
  activity_date    date,
  post_count       integer,
  reaction_count   integer,
  connection_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH

  -- 投稿数: 全期間・全件（expires_at / is_pinned 無視）
  post_agg AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::integer                      AS cnt
    FROM posts
    WHERE user_id = p_user_id
    GROUP BY 1
  ),

  -- リアクション数
  reaction_agg AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::integer                      AS cnt
    FROM reactions
    WHERE user_id = p_user_id
    GROUP BY 1
  ),

  -- つながり数:
  --   当日 accepted になった follows 行のうち、p_user_id が関与するペアを重複排除。
  --   A→B と B→A が同日に存在しても LEAST/GREATEST で1ペアに正規化してから COUNT DISTINCT。
  connection_pairs AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date     AS d,
      LEAST(follower_id, following_id)           AS uid_a,
      GREATEST(follower_id, following_id)        AS uid_b
    FROM follows
    WHERE type   = 'user'
      AND status = 'accepted'
      AND (follower_id = p_user_id OR following_id = p_user_id)
  ),
  connection_agg AS (
    SELECT
      d,
      COUNT(DISTINCT (uid_a, uid_b))::integer AS cnt
    FROM connection_pairs
    GROUP BY 1
  ),

  -- 全日付を FULL OUTER JOIN で揃える
  all_dates AS (
    SELECT d FROM post_agg
    UNION
    SELECT d FROM reaction_agg
    UNION
    SELECT d FROM connection_agg
  )

  SELECT
    all_dates.d                           AS activity_date,
    COALESCE(post_agg.cnt,       0)       AS post_count,
    COALESCE(reaction_agg.cnt,   0)       AS reaction_count,
    COALESCE(connection_agg.cnt, 0)       AS connection_count
  FROM all_dates
  LEFT JOIN post_agg       ON post_agg.d       = all_dates.d
  LEFT JOIN reaction_agg   ON reaction_agg.d   = all_dates.d
  LEFT JOIN connection_agg ON connection_agg.d = all_dates.d
  ORDER BY all_dates.d ASC;
$$;

-- 認証済みユーザーなら誰でも実行可能
GRANT EXECUTE ON FUNCTION public.get_memory_heatmap(uuid) TO authenticated;
