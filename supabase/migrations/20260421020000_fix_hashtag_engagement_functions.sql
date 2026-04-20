-- =============================================================
-- hashtag_engagements 関数・トリガー修正
-- 問題: 20260421010000 で引数順 (text,uuid) の新関数が作られ、
--       旧 (uuid,text) オーバーロードと共存してしまった。
-- 対処: 旧オーバーロードを DROP → 統一シグネチャに整理
--       トリガー関数も named params 呼び出しに統一
--       再集計を再実行して確実にデータを投入
-- =============================================================

-- -------------------------------------------------------------
-- 1. 旧シグネチャのオーバーロードを削除
-- -------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_hashtag_post(uuid, text);
DROP FUNCTION IF EXISTS public.increment_hashtag_reaction(uuid, text);


-- -------------------------------------------------------------
-- 2. ヘルパー関数（確定シグネチャ: p_user_id uuid, p_tag text）
--    クライアント named params { p_user_id, p_tag } に合わせる
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_hashtag_post(p_user_id uuid, p_tag text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
  VALUES (p_user_id, p_tag, 1, 0, false)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET post_count = hashtag_engagements.post_count + 1;
$$;

CREATE OR REPLACE FUNCTION public.decrement_hashtag_post(p_user_id uuid, p_tag text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE hashtag_engagements
  SET post_count = GREATEST(0, post_count - 1)
  WHERE user_id = p_user_id
    AND tag     = p_tag;
$$;

CREATE OR REPLACE FUNCTION public.increment_hashtag_reaction(p_user_id uuid, p_tag text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
  VALUES (p_user_id, p_tag, 0, 1, false)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET reaction_count = hashtag_engagements.reaction_count + 1;
$$;

CREATE OR REPLACE FUNCTION public.decrement_hashtag_reaction(p_user_id uuid, p_tag text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE hashtag_engagements
  SET reaction_count = GREATEST(0, reaction_count - 1)
  WHERE user_id = p_user_id
    AND tag     = p_tag;
$$;

-- decrement の旧 (text,uuid) シグネチャも念のため削除
DROP FUNCTION IF EXISTS public.decrement_hashtag_post(text, uuid);
DROP FUNCTION IF EXISTS public.decrement_hashtag_reaction(text, uuid);
-- increment の旧 (text,uuid) シグネチャも削除
DROP FUNCTION IF EXISTS public.increment_hashtag_post(text, uuid);
DROP FUNCTION IF EXISTS public.increment_hashtag_reaction(text, uuid);


-- -------------------------------------------------------------
-- 3. トリガー関数を named params 呼び出しに修正
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_hashtag_engagements_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tag text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.hashtags IS NOT NULL AND array_length(NEW.hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY NEW.hashtags LOOP
        PERFORM public.increment_hashtag_post(p_user_id => NEW.user_id, p_tag => v_tag);
      END LOOP;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.hashtags IS NOT NULL AND array_length(OLD.hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY OLD.hashtags LOOP
        PERFORM public.decrement_hashtag_post(p_user_id => OLD.user_id, p_tag => v_tag);
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_hashtag_engagements_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hashtags text[];
  v_tag      text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type <> 'post' THEN RETURN NULL; END IF;

    SELECT hashtags INTO v_hashtags FROM posts WHERE id = NEW.target_id;

    IF v_hashtags IS NOT NULL AND array_length(v_hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY v_hashtags LOOP
        PERFORM public.increment_hashtag_reaction(p_user_id => NEW.user_id, p_tag => v_tag);
      END LOOP;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type <> 'post' THEN RETURN NULL; END IF;

    SELECT hashtags INTO v_hashtags FROM posts WHERE id = OLD.target_id;

    IF v_hashtags IS NOT NULL AND array_length(v_hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY v_hashtags LOOP
        PERFORM public.decrement_hashtag_reaction(p_user_id => OLD.user_id, p_tag => v_tag);
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- トリガー自体はそのまま（関数を差し替えたので再作成不要）


-- -------------------------------------------------------------
-- 4. 検証用 RPC（SECURITY DEFINER で RLS をバイパス）
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_hashtag_engagements_for_user(p_user_id uuid)
RETURNS TABLE (
  tag             text,
  post_count      integer,
  reaction_count  integer,
  is_owner        boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tag, post_count, reaction_count, is_owner
  FROM hashtag_engagements
  WHERE user_id = p_user_id
  ORDER BY post_count DESC, reaction_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_hashtag_engagements_for_user(uuid) TO authenticated;


-- -------------------------------------------------------------
-- 5. データ再集計（TRUNCATE → 全件 INSERT）
-- -------------------------------------------------------------

TRUNCATE TABLE hashtag_engagements;

-- posts → post_count
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

-- reactions (target_type='post') → reaction_count（リアクターのuser_idで記録）
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
