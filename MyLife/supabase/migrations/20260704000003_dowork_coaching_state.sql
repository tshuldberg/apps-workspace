-- DoWork coaching-state correctness (dp-audit-2026-07-04 findings H4 + H7).
--
-- 1. Ended coaching relationships become read-only: new feedback inserts now
--    require an ACTIVE client link (matching the form-check upload path).
--    Historical reads keep working through the unchanged select policy.
--
-- 2. Private form-check UGC becomes reportable: dw_reports accepts
--    form_check and form_feedback target kinds so abusive private coaching
--    content has an in-context safety exit.

drop policy if exists dw_form_feedback_participant_insert on public.dw_form_feedback;
create policy dw_form_feedback_participant_insert
  on public.dw_form_feedback
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and public.dw_form_feedback_participant(form_check_id, true)
  );

alter table public.dw_reports
  drop constraint if exists dw_reports_target_kind_check;
alter table public.dw_reports
  add constraint dw_reports_target_kind_check
  check (target_kind in (
    'share', 'comment', 'trainer_video', 'profile', 'form_check', 'form_feedback'
  ));
