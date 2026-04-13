-- 返信（リプライ）機能: posts テーブルに parent_id カラムを追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES posts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS posts_parent_id_idx ON posts(parent_id);
