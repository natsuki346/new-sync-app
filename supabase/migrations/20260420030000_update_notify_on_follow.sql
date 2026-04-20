-- =============================================================
-- フォロー通知を status で分岐する
-- pending → follow_request、accepted → follow_accepted
-- =============================================================

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type = 'user' THEN
    IF NEW.status = 'pending' THEN
      INSERT INTO notifications (user_id, type, from_user_id, read, created_at)
      VALUES (NEW.following_id, 'follow_request', NEW.follower_id, false, now());
    ELSIF NEW.status = 'accepted' THEN
      INSERT INTO notifications (user_id, type, from_user_id, read, created_at)
      VALUES (NEW.following_id, 'follow_accepted', NEW.follower_id, false, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- トリガーは on_follow_insert として既に存在するのでそのまま使われる
