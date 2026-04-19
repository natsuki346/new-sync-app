-- message_type の CHECK 制約を更新して 'call_ended', 'call_missed' を追加
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- 旧 'call_started' 行（制約外になる）を削除してから制約を設定
DELETE FROM messages
  WHERE message_type NOT IN ('text', 'image', 'audio', 'call_ended', 'call_missed');

ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'audio', 'call_ended', 'call_missed'));

-- call_id カラムが未追加なら追加（既に追加済みなら IF NOT EXISTS でスキップ）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES calls(id) ON DELETE SET NULL;

-- インデックス（call_id からメッセージを引く用途がないなら不要だが、念のため）
CREATE INDEX IF NOT EXISTS idx_messages_call_id ON messages(call_id) WHERE call_id IS NOT NULL;
