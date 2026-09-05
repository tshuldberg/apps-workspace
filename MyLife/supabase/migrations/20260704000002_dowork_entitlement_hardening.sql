-- DoWork entitlement hardening (dp-audit-2026-07-04 findings H2 + H3).
--
-- 1. Trainer serving status: the dw_trainer_videos paywall now requires the
--    owning trainer to be active AND verified for every non-owner read path
--    (free, subscription, client link). Moderation flipping
--    dw_trainers.is_active to false stops row reads immediately. Owner
--    preview stays available so a deactivated trainer can review their own
--    uploads. The playback and upload edge functions mirror this rule.
--
-- 2. Paid-through cancellation: a subscription row with status 'cancelled'
--    keeps entitlement until current_period_end. RevenueCat CANCELLATION
--    means auto-renew turned off, not paid access ending; refunds arrive
--    with an expiration at or before now, so they revoke immediately.
--    EXPIRATION later flips the row to 'expired'.

drop policy if exists dw_trainer_videos_select_entitled on public.dw_trainer_videos;
create policy dw_trainer_videos_select_entitled
  on public.dw_trainer_videos
  for select
  using (
    is_hidden = false and (
      -- Owner preview: identity only, survives deactivation.
      exists (select 1 from public.dw_trainers t
              where t.id = trainer_id and t.user_id = auth.uid())
      or (
        -- Every other path requires the trainer to be serving.
        exists (select 1 from public.dw_trainers t
                where t.id = trainer_id and t.is_active and t.is_verified)
        and (
          is_premium = false
          or exists (select 1 from public.dw_trainer_subscriptions s
                     where s.trainer_id = dw_trainer_videos.trainer_id
                       and s.user_id = auth.uid()
                       and (
                         (s.status = 'active'
                          and (s.current_period_end is null or s.current_period_end > now()))
                         or (s.status = 'cancelled' and s.current_period_end > now())
                       ))
          or exists (select 1 from public.dw_client_links c
                     where c.trainer_id = dw_trainer_videos.trainer_id
                       and c.client_user_id = auth.uid() and c.status = 'active')
        )
      )
    )
  );
