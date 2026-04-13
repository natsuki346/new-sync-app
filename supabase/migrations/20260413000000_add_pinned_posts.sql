-- ピン止め投稿テーブル（最大3件）
CREATE TABLE IF NOT EXISTS pinned_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE pinned_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anyone can view pinned posts" ON pinned_posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can manage own pins" ON pinned_posts FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- profilesにheader_urlカラム追加（なければ）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS header_url text;
