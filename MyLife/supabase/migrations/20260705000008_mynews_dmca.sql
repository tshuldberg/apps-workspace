-- MyNews DMCA notice intake + repeat-infringer policy (Plan 39 T9, Track 1 P4).
-- DMCA safe harbor (17 U.S.C. 512) needs three things this migration provides:
--   1. A structured takedown-notice path that captures the 512(c)(3) elements
--      (complainant name + contact, the copyrighted work, the infringing URL/
--      target, a good-faith statement, an accuracy statement under penalty of
--      perjury, and a signature). Notices land in nw_dmca_notices. A rights-
--      holder is often NOT a MyNews user, so a notice may be filed anonymously
--      (submitter_profile_id null); the mynews-dmca edge function rate-limits and
--      validates before inserting under the service role. Every takedown notice
--      also spawns a linked nw_reports row (reason='copyright') so it surfaces in
--      the existing moderation queue. Counter-notices (kind='counter') are the
--      author's documented rebuttal path and do NOT spawn a report.
--   2. A repeat-infringer strike counter on nw_profiles (copyright_strikes). It
--      is service-role-only writable (extends the suspension guard from
--      20260705000007 so a client can never move it).
--   3. The teeth: nw_moderate_strike_and_maybe_suspend increments an author's
--      strike count, writes an nw_moderation_actions audit row, and suspends the
--      profile once the strike count reaches the threshold (default 3). Service-
--      role only, security definer, audited.
--
-- Append-only migration: 20260703000001..000003 and 20260705000001..000007 stay
-- untouched. The canonical signing bytes / fixtures are not touched.

-- ============================================================ strike counter

alter table public.nw_profiles
  add column if not exists copyright_strikes integer not null default 0;

-- Extend the client-write guard so neither suspended_until NOR copyright_strikes
-- can be moved by an authenticated/anon session. The service role (moderation
-- RPC) is exempt because current_user is not 'authenticated'/'anon' under the
-- service-role JWT. This replaces the 20260705000007 guard body in place; the
-- trigger from that migration keeps firing this function.
create or replace function public.nw_profiles_guard_suspension_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.suspended_until is distinct from old.suspended_until then
      raise exception 'nw_profiles: suspension is set only by the moderation console';
    end if;
    if new.copyright_strikes is distinct from old.copyright_strikes then
      raise exception 'nw_profiles: copyright strikes are set only by the moderation console';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================ notice table

create table if not exists public.nw_dmca_notices (
  id uuid primary key default gen_random_uuid(),
  -- 'takedown' = rights-holder claim; 'counter' = author counter-notice.
  kind text not null default 'takedown' check (kind in ('takedown', 'counter')),
  -- Null when a non-user rights-holder files anonymously (the common case).
  submitter_profile_id uuid references public.nw_profiles (id) on delete set null,
  -- Linked moderation report (takedown notices only). null for counter-notices.
  report_id uuid references public.nw_reports (id) on delete set null,
  complainant_name text not null,
  complainant_email text not null,
  complainant_address text not null default '',
  copyrighted_work text not null,
  infringing_url text not null,
  -- Optional MyNews target coordinates when the URL maps to a known row.
  target_kind text check (
    target_kind is null
    or target_kind in ('article', 'revision', 'suggestion', 'profile', 'media')
  ),
  target_id text,
  good_faith boolean not null,
  accuracy_under_penalty boolean not null,
  signature text not null,
  status text not null default 'open' check (status in ('open', 'actioned', 'no_action')),
  created_at timestamptz not null default now(),
  -- Both attestations are required by statute; a row can never persist without them.
  constraint nw_dmca_attested check (good_faith and accuracy_under_penalty)
);
-- RLS on, zero client policies: the notice queue is service-role-only, exactly
-- like nw_moderation_actions. No client (anon or authenticated) reads or writes
-- it directly; the mynews-dmca function is the only writer.
alter table public.nw_dmca_notices enable row level security;

create index if not exists idx_nw_dmca_notices_open
  on public.nw_dmca_notices (status, created_at);
create index if not exists idx_nw_dmca_notices_email_recent
  on public.nw_dmca_notices (complainant_email, created_at);

-- ============================================================ notice insert RPC

-- Service-role insert path for a DMCA notice. security definer so the mynews-dmca
-- function calls it via PostgREST rpc; the edge function has ALREADY validated the
-- 512(c)(3) elements and rate-limited by complainant email. A takedown notice
-- spawns a linked copyright report so it surfaces in the moderation queue; a
-- counter-notice is recorded without a report. reporter_id on the spawned report
-- is the submitter profile when known, else null (the report client-guard's
-- non-null-reporter rule is a CLIENT guard; this definer path is exempt, so an
-- anonymous rights-holder can still route a notice to the queue).
create or replace function public.nw_submit_dmca_notice(
  p_kind text,
  p_submitter_profile_id uuid,
  p_complainant_name text,
  p_complainant_email text,
  p_complainant_address text,
  p_copyrighted_work text,
  p_infringing_url text,
  p_target_kind text,
  p_target_id text,
  p_signature text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_id uuid;
begin
  if p_kind not in ('takedown', 'counter') then
    return 'bad-payload';
  end if;
  if p_complainant_name is null or length(trim(p_complainant_name)) = 0
     or p_complainant_email is null or length(trim(p_complainant_email)) = 0
     or p_copyrighted_work is null or length(trim(p_copyrighted_work)) = 0
     or p_infringing_url is null or length(trim(p_infringing_url)) = 0
     or p_signature is null or length(trim(p_signature)) = 0 then
    return 'bad-payload';
  end if;

  -- Takedown notices spawn a copyright report keyed to the target when known,
  -- so the moderation queue picks them up alongside in-app reports.
  if p_kind = 'takedown' and p_target_kind is not null and p_target_id is not null then
    insert into public.nw_reports (reporter_id, target_kind, target_id, reason, detail)
    values (
      p_submitter_profile_id,
      p_target_kind,
      p_target_id,
      'copyright',
      'DMCA takedown: ' || left(p_copyrighted_work, 500)
    )
    returning id into v_report_id;
  end if;

  insert into public.nw_dmca_notices (
    kind, submitter_profile_id, report_id, complainant_name, complainant_email,
    complainant_address, copyrighted_work, infringing_url, target_kind, target_id,
    good_faith, accuracy_under_penalty, signature
  ) values (
    p_kind, p_submitter_profile_id, v_report_id, trim(p_complainant_name), trim(p_complainant_email),
    coalesce(p_complainant_address, ''), p_copyrighted_work, p_infringing_url, p_target_kind, p_target_id,
    true, true, trim(p_signature)
  );
  return 'ok';
end;
$$;

revoke all on function public.nw_submit_dmca_notice(text, uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.nw_submit_dmca_notice(text, uuid, text, text, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.nw_submit_dmca_notice(text, uuid, text, text, text, text, text, text, text, text) to service_role;

-- ============================================================ strike RPC (teeth)

-- Repeat-infringer teeth. Increments an author's copyright_strikes, writes an
-- audit row, and suspends the profile once strikes reach p_threshold (default 3
-- when null/<=0). security definer bypasses the client-write guard. Returns a
-- scalar text: 'suspended' when the threshold was reached and the profile was
-- suspended, 'struck' when incremented below threshold, 'not-found' for an
-- unknown profile, 'bad-moderator' for a blank moderator ref.
create or replace function public.nw_moderate_strike_and_maybe_suspend(
  p_profile_id uuid,
  p_moderator_ref text,
  p_note text,
  p_report_id uuid default null,
  p_threshold integer default 3,
  p_suspend_until timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold integer := case when p_threshold is null or p_threshold <= 0 then 3 else p_threshold end;
  v_strikes integer;
  v_until timestamptz;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;

  update public.nw_profiles
    set copyright_strikes = copyright_strikes + 1
    where id = p_profile_id
    returning copyright_strikes into v_strikes;
  if v_strikes is null then
    return 'not-found';
  end if;

  -- Audit the strike itself (reuses the 'suspend_profile' action set; the note
  -- carries the strike count for the trail).
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    (
      p_report_id,
      p_moderator_ref,
      'suspend_profile',
      'profile',
      p_profile_id::text,
      'copyright strike ' || v_strikes || '/' || v_threshold ||
        case when coalesce(p_note, '') = '' then '' else ': ' || p_note end
    );

  if v_strikes >= v_threshold then
    -- Default: permanent suspension at threshold (a moderator may pass an
    -- explicit p_suspend_until for a fixed term).
    v_until := coalesce(p_suspend_until, timestamptz '2999-12-31 23:59:59+00');
    update public.nw_profiles set suspended_until = v_until where id = p_profile_id;
    insert into public.nw_moderation_actions
      (report_id, moderator_ref, action, target_kind, target_id, note)
    values
      (
        p_report_id,
        p_moderator_ref,
        'suspend_profile',
        'profile',
        p_profile_id::text,
        'repeat-infringer suspension at ' || v_strikes || ' strikes'
      );
    return 'suspended';
  end if;

  return 'struck';
end;
$$;

revoke all on function public.nw_moderate_strike_and_maybe_suspend(uuid, text, text, uuid, integer, timestamptz) from public;
revoke all on function public.nw_moderate_strike_and_maybe_suspend(uuid, text, text, uuid, integer, timestamptz) from anon, authenticated;
grant execute on function public.nw_moderate_strike_and_maybe_suspend(uuid, text, text, uuid, integer, timestamptz) to service_role;

-- ============================================================ notice queue read helper

-- Resolve a single DMCA notice by its linked report (for the console when a
-- moderator opens a copyright report that came from a takedown notice). A plain
-- read helper; the service-role client selects nw_dmca_notices directly, so no
-- RPC is strictly required, but this keeps the join in one auditable place.
create or replace function public.nw_dmca_notice_for_report(p_report_id uuid)
returns setof public.nw_dmca_notices
language sql
security definer
set search_path = public
as $$
  select * from public.nw_dmca_notices where report_id = p_report_id order by created_at desc limit 1;
$$;

revoke all on function public.nw_dmca_notice_for_report(uuid) from public;
revoke all on function public.nw_dmca_notice_for_report(uuid) from anon, authenticated;
grant execute on function public.nw_dmca_notice_for_report(uuid) to service_role;
