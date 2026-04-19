-- message_type の制約を更新して 'audio' を追加
-- NOTE: 既存行に 'call_started' 等がある可能性があるため制約は一旦削除のみ
-- （最終的な制約は 20260419000000 で設定する）
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- 音声ファイル用カラム追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration_seconds INT;
