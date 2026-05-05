-- reports.content_type に 'post' と 'profile' を追加
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_content_type_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_content_type_check
    CHECK (content_type IN ('bubble', 'dm', 'post', 'profile'));
