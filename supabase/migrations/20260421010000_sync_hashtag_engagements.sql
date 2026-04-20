-- =============================================================
-- hashtag_engagements 自動同期
-- 1. increment / decrement ヘルパー関数
-- 2. posts トリガー
-- 3. reactions トリガー
-- 4. 既存データ再集計
-- =============================================================


-- -------------------------------------------------------------
-- 1. ヘルパー関数
-- -------------------------------------------------------------

-- post_count += 1（行がなければ INSERT）
CREATE OR REPLACE FUNCTION public.increment_hashtag_post(p_tag text, p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count)
  VALUES (p_user_id, p_tag, 1, 0)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET post_count = hashtag_engagements.post_count + 1;
$$;

-- post_count -= 1（0 未満にしない）
CREATE OR REPLACE FUNCTION public.decrement_hashtag_post(p_tag text, p_user_id uuid)
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

-- reaction_count += 1（行がなければ INSERT）
CREATE OR REPLACE FUNCTION public.increment_hashtag_reaction(p_tag text, p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count)
  VALUES (p_user_id, p_tag, 0, 1)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET reaction_count = hashtag_engagements.reaction_count + 1;
$$;

-- reaction_count -= 1（0 未満にしない）
CREATE OR REPLACE FUNCTION public.decrement_hashtag_reaction(p_tag text, p_user_id uuid)
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


-- -------------------------------------------------------------
-- 2. posts トリガー
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
        PERFORM public.increment_hashtag_post(v_tag, NEW.user_id);
      END LOOP;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.hashtags IS NOT NULL AND array_length(OLD.hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY OLD.hashtags LOOP
        PERFORM public.decrement_hashtag_post(v_tag, OLD.user_id);
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hashtag_engagements_post ON public.posts;

CREATE TRIGGER trg_sync_hashtag_engagements_post
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hashtag_engagements_on_post();


-- -------------------------------------------------------------
-- 3. reactions トリガー
-- -------------------------------------------------------------

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

    SELECT hashtags INTO v_hashtags
    FROM posts
    WHERE id = NEW.target_id;

    IF v_hashtags IS NOT NULL AND array_length(v_hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY v_hashtags LOOP
        PERFORM public.increment_hashtag_reaction(v_tag, NEW.user_id);
      END LOOP;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type <> 'post' THEN RETURN NULL; END IF;

    -- 投稿が既に削除されていた場合は SKIP
    SELECT hashtags INTO v_hashtags
    FROM posts
    WHERE id = OLD.target_id;

    IF v_hashtags IS NOT NULL AND array_length(v_hashtags, 1) > 0 THEN
      FOREACH v_tag IN ARRAY v_hashtags LOOP
        PERFORM public.decrement_hashtag_reaction(v_tag, OLD.user_id);
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hashtag_engagements_reaction ON public.reactions;

CREATE TRIGGER trg_sync_hashtag_engagements_reaction
  AFTER INSERT OR DELETE ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hashtag_engagements_on_reaction();


-- -------------------------------------------------------------
-- 4. 既存データ再集計（TRUNCATE → 全件 UPSERT）
-- -------------------------------------------------------------

TRUNCATE TABLE hashtag_engagements;

-- posts から post_count を集計
INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count)
SELECT
  p.user_id,
  t.tag,
  COUNT(*)::integer AS post_count,
  0                 AS reaction_count
FROM posts p
CROSS JOIN LATERAL unnest(p.hashtags) AS t(tag)
WHERE p.hashtags IS NOT NULL
  AND array_length(p.hashtags, 1) > 0
GROUP BY p.user_id, t.tag
ON CONFLICT (user_id, tag)
DO UPDATE SET post_count = EXCLUDED.post_count;

-- reactions (target_type='post') から reaction_count を集計
-- リアクター(reactions.user_id) の活動として記録
INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count)
SELECT
  r.user_id,
  t.tag,
  0                   AS post_count,
  COUNT(*)::integer   AS reaction_count
FROM reactions r
JOIN posts p ON p.id = r.target_id
CROSS JOIN LATERAL unnest(p.hashtags) AS t(tag)
WHERE r.target_type = 'post'
  AND p.hashtags IS NOT NULL
  AND array_length(p.hashtags, 1) > 0
GROUP BY r.user_id, t.tag
ON CONFLICT (user_id, tag)
DO UPDATE SET reaction_count = EXCLUDED.reaction_count;
