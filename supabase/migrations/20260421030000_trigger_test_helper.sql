-- =============================================================
-- トリガー動作確認用ヘルパー（一時的。本番データに影響しないよう
-- 固定 UUID を使い、テスト後に自己削除する）
-- =============================================================

CREATE OR REPLACE FUNCTION public.test_hashtag_trigger(p_user_id uuid, p_tag text)
RETURNS TABLE (phase text, post_count integer, reaction_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_test_id  uuid := 'ffffffff-0000-0000-0000-000000000001';
  v_pc_before integer;
  v_rc_before integer;
  v_pc_after  integer;
  v_rc_after  integer;
BEGIN
  -- 残存テストデータをクリーンアップ
  DELETE FROM posts WHERE id = v_test_id;

  -- BEFORE INSERT の値
  SELECT COALESCE(he.post_count, 0), COALESCE(he.reaction_count, 0)
    INTO v_pc_before, v_rc_before
  FROM (SELECT 1) dummy
  LEFT JOIN hashtag_engagements he
    ON he.user_id = p_user_id AND he.tag = p_tag;

  phase := 'before_insert'; post_count := v_pc_before; reaction_count := v_rc_before;
  RETURN NEXT;

  -- テスト投稿 INSERT（トリガー発火）
  INSERT INTO posts (id, user_id, content, hashtags, is_mutual)
  VALUES (v_test_id, p_user_id, 'trigger test', ARRAY[p_tag], false);

  -- AFTER INSERT の値
  SELECT COALESCE(he.post_count, 0), COALESCE(he.reaction_count, 0)
    INTO v_pc_after, v_rc_after
  FROM (SELECT 1) dummy
  LEFT JOIN hashtag_engagements he
    ON he.user_id = p_user_id AND he.tag = p_tag;

  phase := 'after_insert'; post_count := v_pc_after; reaction_count := v_rc_after;
  RETURN NEXT;

  -- テスト投稿 DELETE（トリガー発火）
  DELETE FROM posts WHERE id = v_test_id;

  -- AFTER DELETE の値
  SELECT COALESCE(he.post_count, 0), COALESCE(he.reaction_count, 0)
    INTO v_pc_after, v_rc_after
  FROM (SELECT 1) dummy
  LEFT JOIN hashtag_engagements he
    ON he.user_id = p_user_id AND he.tag = p_tag;

  phase := 'after_delete'; post_count := v_pc_after; reaction_count := v_rc_after;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_hashtag_trigger(uuid, text) TO authenticated;
