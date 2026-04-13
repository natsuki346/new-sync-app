-- ハッシュタグエンゲージメント RPC 関数
-- hashtag_engagements テーブルの reaction_count / post_count をアトミックにインクリメント
-- （row がなければ INSERT、あれば UPDATE）

-- 一意制約（まだなければ追加）
DO $$ BEGIN
  ALTER TABLE hashtag_engagements
    ADD CONSTRAINT hashtag_engagements_user_tag_unique UNIQUE (user_id, tag);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- リアクション +1
CREATE OR REPLACE FUNCTION increment_hashtag_reaction(p_user_id UUID, p_tag TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
  VALUES (p_user_id, p_tag, 0, 1, false)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET reaction_count = hashtag_engagements.reaction_count + 1;
END;
$$;

-- 投稿 +1
CREATE OR REPLACE FUNCTION increment_hashtag_post(p_user_id UUID, p_tag TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO hashtag_engagements (user_id, tag, post_count, reaction_count, is_owner)
  VALUES (p_user_id, p_tag, 1, 0, false)
  ON CONFLICT (user_id, tag)
  DO UPDATE SET post_count = hashtag_engagements.post_count + 1;
END;
$$;
