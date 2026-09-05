-- DoWork push notification preferences (Plan 36, Phase 6a).
--
-- Per-user notification preferences, enforced SERVER-side by dowork-notify.
-- Expo pushes cannot be filtered on the device after delivery, so an opt-out
-- is only real if the sender drops the recipient before posting to Expo. This
-- table is that source of truth.
--
--   * One row per user. A missing row means the defaults below: the three
--     transactional types on, marketing off (fail-safe to the defaults).
--   * Owner-only CRUD from the app (the notification-preferences screen).
--   * dowork-notify reads this table with the service role to drop opted-out
--     recipients for transactional pushes and to resolve the marketing opt-in
--     audience for promotional pushes.
--
-- All statements idempotent.

create table if not exists public.dw_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  new_video boolean not null default true,
  form_check boolean not null default true,
  form_feedback boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Marketing sends resolve their audience from the opted-in subset only.
create index if not exists dw_notification_prefs_marketing_idx
  on public.dw_notification_prefs (marketing) where marketing = true;

alter table public.dw_notification_prefs enable row level security;

drop policy if exists dw_notification_prefs_owner_select on public.dw_notification_prefs;
create policy dw_notification_prefs_owner_select
  on public.dw_notification_prefs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists dw_notification_prefs_owner_insert on public.dw_notification_prefs;
create policy dw_notification_prefs_owner_insert
  on public.dw_notification_prefs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists dw_notification_prefs_owner_update on public.dw_notification_prefs;
create policy dw_notification_prefs_owner_update
  on public.dw_notification_prefs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists dw_notification_prefs_owner_delete on public.dw_notification_prefs;
create policy dw_notification_prefs_owner_delete
  on public.dw_notification_prefs
  for delete
  to authenticated
  using (user_id = auth.uid());
