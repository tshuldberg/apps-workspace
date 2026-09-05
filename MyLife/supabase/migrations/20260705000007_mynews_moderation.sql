-- MyNews moderation console + enforcement (Plan 39 T8, Track 1 Phase 3).
-- Reports land in nw_reports (migration 20260705000005). This migration adds the
-- ENFORCEMENT TEETH a moderator needs on top of the report queue:
--   1. Profile suspension: a suspended actor cannot publish, suggest, or report.
--      Suspension is a signal on nw_profiles (suspended_until timestamptz). A row
--      is suspended when suspended_until is in the future; null / past means active.
--      The column is service-role-only writable (client-write guard trigger, same
--      shape as nw_profiles pubkey guard in 20260705000003).
--   2. A moderation audit trail: nw_moderation_actions records every enforcement
--      action. Service-role-only (RLS enabled, zero client policies), like the
--      money/job tables in the bootstrap.
--   3. Enforcement RPCs (security definer, service-role-only): hide an article,
--      hide a suggestion, suspend a profile, resolve a report. Each transitions
--      the target state AND writes an audit row atomically. All revoke from
--      public/anon/authenticated, grant execute to service_role only.
--
-- Append-only migration: 20260703000001..000003 and 20260705000001..000006 stay
-- untouched. The canonical signing bytes / fixtures are not touched.

-- ============================================================ suspension signal

alter table public.nw_profiles
  add column if not exists suspended_until timestamptz;

-- Client-write guard: an authenticated/anon session can update its own profile
-- (nw_profiles_self_update: display_name etc.) but must NEVER move suspended_until.
-- Only the service role (moderation RPC) may change it. current_user is not
-- 'authenticated'/'anon' under the service-role JWT, so the RPC is exempt.
-- This extends the pubkey guard from 20260705000003 (which forbade client pubkey
-- writes); that trigger stays, and this one covers suspension independently so
-- neither depends on the other's ordering.
create or replace function public.nw_profiles_guard_suspension_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.suspended_until is distinct from old.suspended_until then
    raise exception 'nw_profiles: suspension is set only by the moderation console';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_profiles_suspension_guard on public.nw_profiles;
create trigger nw_profiles_suspension_guard
  before update on public.nw_profiles
  for each row execute function public.nw_profiles_guard_suspension_write();

-- ============================================================ audit trail

create table if not exists public.nw_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.nw_reports (id) on delete set null,
  moderator_ref text not null,
  action text not null check (
    action in ('hide_article', 'hide_suggestion', 'suspend_profile', 'dismiss', 'restore')
  ),
  target_kind text not null check (
    target_kind in ('article', 'revision', 'suggestion', 'profile', 'media', 'report')
  ),
  target_id text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
-- RLS on, zero client policies: the audit trail is service-role-only, exactly
-- like nw_transfer_ledger / nw_support_charges in the bootstrap. No client (anon
-- or authenticated) can read or write it.
alter table public.nw_moderation_actions enable row level security;

create index if not exists idx_nw_moderation_actions_report
  on public.nw_moderation_actions (report_id, created_at);
create index if not exists idx_nw_moderation_actions_target
  on public.nw_moderation_actions (target_kind, target_id, created_at);

-- ============================================================ enforcement RPCs

-- Hide (retract) ANY article. The client guard on nw_articles only lets the
-- owner move published->retracted; a moderator needs to retract anyone's article.
-- security definer runs as the table owner, bypassing that RLS. Writes an audit
-- row in the same statement-set so the action is never silent.
create or replace function public.nw_moderate_hide_article(
  p_article_id uuid,
  p_moderator_ref text,
  p_note text,
  p_report_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;
  update public.nw_articles
    set status = 'retracted'
    where id = p_article_id
    returning true into v_found;
  if v_found is null then
    return 'not-found';
  end if;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    (p_report_id, p_moderator_ref, 'hide_article', 'article', p_article_id::text, coalesce(p_note, ''));
  return 'ok';
end;
$$;

revoke all on function public.nw_moderate_hide_article(uuid, text, text, uuid) from public;
revoke all on function public.nw_moderate_hide_article(uuid, text, text, uuid) from anon, authenticated;
grant execute on function public.nw_moderate_hide_article(uuid, text, text, uuid) to service_role;

-- Hide (reject) ANY suggestion. Moves an open/accepted/partial suggestion to
-- 'rejected' so it stops surfacing. Idempotent: re-hiding an already rejected
-- suggestion still writes an audit row (a real moderator action happened) but the
-- status update is a no-op.
create or replace function public.nw_moderate_hide_suggestion(
  p_suggestion_id uuid,
  p_moderator_ref text,
  p_note text,
  p_report_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;
  update public.nw_edit_suggestions
    set status = 'rejected'
    where id = p_suggestion_id
    returning true into v_found;
  if v_found is null then
    return 'not-found';
  end if;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    (p_report_id, p_moderator_ref, 'hide_suggestion', 'suggestion', p_suggestion_id::text, coalesce(p_note, ''));
  return 'ok';
end;
$$;

revoke all on function public.nw_moderate_hide_suggestion(uuid, text, text, uuid) from public;
revoke all on function public.nw_moderate_hide_suggestion(uuid, text, text, uuid) from anon, authenticated;
grant execute on function public.nw_moderate_hide_suggestion(uuid, text, text, uuid) to service_role;

-- Suspend (or lift) a profile. p_until in the future suspends; null lifts (a
-- 'restore' action). The client-write guard forbids any direct client change to
-- suspended_until; this definer RPC is the only writer.
create or replace function public.nw_moderate_suspend_profile(
  p_profile_id uuid,
  p_until timestamptz,
  p_moderator_ref text,
  p_note text,
  p_report_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;
  update public.nw_profiles
    set suspended_until = p_until
    where id = p_profile_id
    returning true into v_found;
  if v_found is null then
    return 'not-found';
  end if;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    (
      p_report_id,
      p_moderator_ref,
      case when p_until is null then 'restore' else 'suspend_profile' end,
      'profile',
      p_profile_id::text,
      coalesce(p_note, '')
    );
  return 'ok';
end;
$$;

revoke all on function public.nw_moderate_suspend_profile(uuid, timestamptz, text, text, uuid) from public;
revoke all on function public.nw_moderate_suspend_profile(uuid, timestamptz, text, text, uuid) from anon, authenticated;
grant execute on function public.nw_moderate_suspend_profile(uuid, timestamptz, text, text, uuid) to service_role;

-- Resolve a report (open -> actioned | no_action). Writes a 'dismiss' audit row
-- for no_action and reuses the report's own target for the audit target. A
-- content-hiding RPC above resolves its report separately via p_report_id; this
-- one is the plain queue-clearing path (dismiss or mark-actioned without content
-- change).
create or replace function public.nw_moderate_resolve_report(
  p_report_id uuid,
  p_status text,
  p_moderator_ref text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_id text;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;
  if p_status not in ('actioned', 'no_action') then
    return 'bad-status';
  end if;
  update public.nw_reports
    set status = p_status
    where id = p_report_id and status = 'open'
    returning target_kind, target_id into v_kind, v_id;
  if v_kind is null then
    return 'not-open';
  end if;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    (
      p_report_id,
      p_moderator_ref,
      case when p_status = 'no_action' then 'dismiss' else 'restore' end,
      v_kind,
      v_id,
      coalesce(p_note, '')
    );
  return 'ok';
end;
$$;

revoke all on function public.nw_moderate_resolve_report(uuid, text, text, text) from public;
revoke all on function public.nw_moderate_resolve_report(uuid, text, text, text) from anon, authenticated;
grant execute on function public.nw_moderate_resolve_report(uuid, text, text, text) to service_role;
