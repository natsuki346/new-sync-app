-- =============================================================
-- 通話ステータス自動化マイグレーション
-- 1. messages.user_id の NULL 許容確認
-- 2. call_participants 変更 → calls.status 同期トリガー
-- 3. pg_cron: ringing 30秒超過 → missed
-- 4. calls.status = 'missed' 遷移 → call_missed メッセージ自動投稿
-- =============================================================


-- -------------------------------------------------------------
-- 1. messages.user_id の NOT NULL 制約を確実に外す
--    既に NULL 可なら ALTER は何もしない（PostgreSQL の正常動作）
-- -------------------------------------------------------------
ALTER TABLE messages ALTER COLUMN user_id DROP NOT NULL;


-- -------------------------------------------------------------
-- 2. call_participants.status 変更 → calls.status 同期
--    - 'declined': 全員辞退なら calls.status = 'declined'
--    - 'joined'  : 初回参加で calls.status = 'ongoing'
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_call_status_on_participant_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_initiated_by uuid;
  v_active_count int;
BEGIN
  -- 'declined' 遷移: 全員が辞退/不在/退出済みなら calls を declined に
  IF NEW.status = 'declined' AND OLD.status <> 'declined' THEN
    SELECT initiated_by INTO v_initiated_by
    FROM calls
    WHERE id = NEW.call_id;

    SELECT COUNT(*) INTO v_active_count
    FROM call_participants
    WHERE call_id = NEW.call_id
      AND user_id <> v_initiated_by
      AND status NOT IN ('declined', 'missed', 'left');

    IF v_active_count = 0 THEN
      UPDATE calls
      SET status = 'declined', ended_at = now()
      WHERE id = NEW.call_id
        AND status = 'ringing';
    END IF;
  END IF;

  -- 'joined' 遷移: 最初の joined で calls を ongoing に
  IF NEW.status = 'joined' AND OLD.status <> 'joined' THEN
    UPDATE calls
    SET status = 'ongoing',
        answered_at = COALESCE(answered_at, now())
    WHERE id = NEW.call_id
      AND status = 'ringing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_call_status ON public.call_participants;

CREATE TRIGGER trg_sync_call_status
  AFTER UPDATE ON public.call_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_call_status_on_participant_update();


-- -------------------------------------------------------------
-- 3. pg_cron: 30秒ごとに ringing 超過通話を missed に遷移
--    冪等化: 先に unschedule し、未登録なら EXCEPTION を握りつぶす
-- -------------------------------------------------------------

DO $$
BEGIN
  PERFORM cron.unschedule('expire-ringing-calls');
EXCEPTION WHEN OTHERS THEN
  -- ジョブが未登録の場合はスルー
  NULL;
END;
$$;

SELECT cron.schedule(
  'expire-ringing-calls',
  '*/30 * * * * *',
  $$
    UPDATE calls
    SET status = 'missed', ended_at = now()
    WHERE status = 'ringing'
      AND started_at < now() - interval '30 seconds';

    UPDATE call_participants
    SET status = 'missed'
    WHERE status = 'invited'
      AND call_id IN (
        SELECT id FROM calls
        WHERE status = 'missed'
          AND ended_at > now() - interval '5 minutes'
      );
  $$
);


-- -------------------------------------------------------------
-- 4. calls.status = 'ringing' → 'missed' 遷移時に
--    messages へ call_missed レコードを自動投稿する
--    SECURITY DEFINER: pg_cron (postgres ロール) から RLS を回避
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_call_missed_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- WHEN 句でガード済みだが念のため確認
  IF OLD.status = 'ringing' AND NEW.status = 'missed' THEN
    INSERT INTO messages (conversation_id, user_id, message_type, call_id)
    VALUES (NEW.conversation_id, NULL, 'call_missed', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_call_missed_message ON public.calls;

CREATE TRIGGER trg_post_call_missed_message
  AFTER UPDATE OF status ON public.calls
  FOR EACH ROW
  WHEN (OLD.status = 'ringing' AND NEW.status = 'missed')
  EXECUTE FUNCTION public.post_call_missed_message();
