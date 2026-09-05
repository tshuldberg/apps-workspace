-- BestChef submission content moderation: default pending + fail-closed insert guard.
--
-- Remediation of adversarial audit finding C2: bc_submissions.moderation_status
-- defaulted to 'approved', so any authenticated insert published instantly with no
-- screening. This migration flips new submissions to 'pending', hard-forces
-- moderation_status='pending' for non-admin inserters (a non-admin client that hand-
-- rolls moderation_status='approved' in the insert row can no longer self-publish),
-- and enqueues each pending submission into bc_moderation_queue so a human (or the
-- media-screening worker for its media) can review it. Admin/service_role inserts
-- (seed content, moderation tooling) keep whatever status they set.
--
-- The public read path is already correct and is intentionally NOT touched here:
-- bc_submissions_read (last redefined by 20260703000002_bestchef_integrity_floor.sql
-- lines 88-98) exposes a row only when the caller owns it OR it is approved AND the
-- viewer is not blocked by the author. Re-asserting an older approved-or-owner form
-- would silently drop that block-enforcement (N13) term, since this migration is
-- lexicographically last. The C2 fix is the default flip + the insert guard, not the
-- read filter, so the read policy is left exactly as 20260703000002 set it.

-- 1. New submissions are pending by default.
alter table public.bc_submissions
  alter column moderation_status set default 'pending';

-- 2. Fail-closed insert guard. Non-admin inserters cannot choose their own
--    moderation_status; it is forced to 'pending'. service_role bypasses RLS but
--    NOT triggers, so admin/service inserts are allowed through explicitly:
--      - bc_is_admin(): admin/moderator (and service tokens carrying the role in
--        app_metadata), matching the existing update guard.
--      - top-level JWT `role` claim = service_role: how a raw Supabase
--        service-role request presents even without app_metadata.role, so seed
--        and server tooling keep the status they set.
create or replace function public.bc_guard_submission_insert_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nested trigger writes (e.g. an alias helper running under a definer function
  -- that already vetted the row) are trusted; only guard top-level user inserts.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if bc_is_admin()
     or coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  -- Any non-admin insert is forced pending regardless of what the client sent.
  new.moderation_status := 'pending';
  return new;
end;
$$;

drop trigger if exists bc_submissions_guard_insert_status on public.bc_submissions;
create trigger bc_submissions_guard_insert_status
  before insert on public.bc_submissions
  for each row execute function public.bc_guard_submission_insert_status();

-- 3. (Intentionally no read-policy change - see header note. bc_submissions_read
--    stays exactly as 20260703000002 defined it, preserving block enforcement.)

-- 4. Enqueue every pending submission for human review. Media assets are enqueued
--    separately by bc_enqueue_media_for_moderation (20260529000004); this covers the
--    submission CONTENT record itself (title/description/recipe text) so a pending
--    submission is never invisible to moderators. Approved inserts (admin/seed) are
--    not queued. On conflict do nothing keeps re-inserts idempotent.
create or replace function public.bc_enqueue_submission_for_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation_status = 'pending' then
    insert into public.bc_moderation_queue (kind, target_id, profile_id, status, metadata)
    values (
      'submission',
      new.id,
      new.profile_id,
      'queued',
      jsonb_build_object('owner_kind', 'submission')
    )
    on conflict (kind, target_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bc_submissions_enqueue_moderation on public.bc_submissions;
create trigger bc_submissions_enqueue_moderation
  after insert on public.bc_submissions
  for each row execute function public.bc_enqueue_submission_for_moderation();

comment on function public.bc_guard_submission_insert_status() is
  'Fail-closed: forces non-admin submission inserts to moderation_status=pending (audit C2).';
comment on function public.bc_enqueue_submission_for_moderation() is
  'Enqueues pending submissions into bc_moderation_queue so human review is not skipped (audit C2).';
