-- MyNews NCII / TAKE IT DOWN 48-hour SLA pipeline (Plan 39 T10, Track 1 P5).
-- The TAKE IT DOWN Act requires removal of non-consensual intimate imagery
-- within 48 hours of a valid request. This migration adds the case tracker on
-- top of the reporting (T6) + moderation (T8) machinery already shipped.
--
-- TAKE-DOWN-FIRST (the safer, statute-aligned choice): an ncii report does NOT
-- wait for human review before the content comes down. nw_open_ncii_case
-- immediately retracts the reported article (or, for a suggestion, rejects it)
-- via the SAME enforcement path a moderator would use, writes the moderation
-- audit row, and records an nw_ncii_cases row with status 'removed'. The 48h
-- deadline the case carries is the window for the HUMAN review of that removal
-- (confirm + optional restore only on an explicit human clear), NOT a window in
-- which the content is allowed to stay up. A profile/media target that has no
-- server-side content row to retract lands as status 'queued' so the worker and
-- a human still drive it to resolution; it is never silently left alone.
--
--   status flow:
--     queued    -> case open, target not yet provably removed (profile/media,
--                  or an immediate-hold that could not retract a content row).
--                  Fail-closed: the worker escalates queued cases at/over the
--                  deadline; a human removes.
--     removed   -> the content target was retracted/hidden (the common path for
--                  article/suggestion reports; set at intake).
--     escalated -> the worker flagged an unresolved case at/over the 48h SLA;
--                  needs urgent human attention (and the worker has ensured
--                  removal where a content row exists).
--     cleared   -> a human reviewed and explicitly cleared the case (e.g. a
--                  verified false report). Requires human confirmation in the
--                  console; the worker NEVER moves a case to cleared.
--
--   hash_match_status: the known-NCII/CSAM hash-matching vendor verdict seam.
--     'pending' by default (no external match configured -> human review, never
--     auto-clear). Founder-ops wires the vendor (StopNCII/PhotoDNA) and the seam
--     writes 'match' | 'no_match' | 'error'. A 'match' NEVER auto-clears; it can
--     only strengthen the case toward escalation/NCMEC.
--
--   ncmec_ref: the CSAM reporting reference (NCMEC CyberTipline). Null until a
--     confirmed-CSAM case is reported through the seam; recording it leaves an
--     auditable reporting hook. Founder-ops wires the real CyberTipline creds.
--
-- Append-only migration: 20260703000001..000003 and 20260705000001..000008 stay
-- untouched. The canonical signing bytes / fixtures are not touched.

-- ============================================================ case table

create table if not exists public.nw_ncii_cases (
  id uuid primary key default gen_random_uuid(),
  -- The ncii report that opened this case (one open case per report).
  report_id uuid not null references public.nw_reports (id) on delete cascade,
  target_kind text not null check (
    target_kind in ('article', 'revision', 'suggestion', 'profile', 'media')
  ),
  target_id text not null,
  -- created + 48h. The worker's SLA backstop reads this.
  deadline_at timestamptz not null,
  status text not null default 'queued' check (
    status in ('queued', 'removed', 'escalated', 'cleared')
  ),
  -- Known-NCII/CSAM hash-match vendor verdict seam. 'pending' = no verdict yet
  -- (human review); never auto-clears.
  hash_match_status text not null default 'pending' check (
    hash_match_status in ('pending', 'match', 'no_match', 'error')
  ),
  -- NCMEC CyberTipline reference for a confirmed-CSAM case (seam; null until set).
  ncmec_ref text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS on, zero client policies: the NCII case tracker is service-role-only,
-- exactly like nw_moderation_actions / nw_dmca_notices. No client (anon or
-- authenticated) reads or writes it.
alter table public.nw_ncii_cases enable row level security;

-- One open (queued/removed/escalated) case per report; a cleared case does not
-- block a fresh one on the same report (reports are one-open-per-target anyway).
create unique index if not exists idx_nw_ncii_cases_one_open_per_report
  on public.nw_ncii_cases (report_id)
  where status <> 'cleared';
-- The worker's SLA scan: unresolved cases ordered by deadline.
create index if not exists idx_nw_ncii_cases_deadline
  on public.nw_ncii_cases (status, deadline_at);

-- Keep updated_at honest on every case mutation.
create or replace function public.nw_ncii_cases_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nw_ncii_cases_touch on public.nw_ncii_cases;
create trigger nw_ncii_cases_touch
  before update on public.nw_ncii_cases
  for each row execute function public.nw_ncii_cases_touch_updated_at();

-- ============================================================ intake RPC (take-down-first)

-- Open an NCII case for an ncii report AND immediately take the target down.
-- security definer so the mynews-report edge function calls it via PostgREST rpc
-- right after inserting the report; the definer runs as the table owner and can
-- retract any author's content (bypassing the owner-only client RLS), exactly
-- like nw_moderate_hide_article. Idempotent on report_id: a re-run returns the
-- existing case id without re-removing or duplicating.
--
-- Fail-closed: for an article/revision target the article is retracted and the
-- case is 'removed'; for a suggestion it is rejected and 'removed'. A
-- profile/media target (no single content row to retract) lands 'queued' so the
-- worker + a human finish the takedown; the content is never assumed safe.
create or replace function public.nw_open_ncii_case(
  p_report_id uuid,
  p_deadline_hours integer default 48
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_id text;
  v_hours integer := case when p_deadline_hours is null or p_deadline_hours <= 0 then 48 else p_deadline_hours end;
  v_status text := 'queued';
  v_existing uuid;
  v_article_uuid uuid;
  v_suggestion_uuid uuid;
begin
  -- Resolve the report; only ncii reports open a case here.
  select target_kind, target_id into v_kind, v_id
  from public.nw_reports
  where id = p_report_id and reason = 'ncii';
  if v_kind is null then
    return 'not-ncii';
  end if;

  -- Idempotent: an existing non-cleared case wins.
  select id into v_existing
  from public.nw_ncii_cases
  where report_id = p_report_id and status <> 'cleared'
  limit 1;
  if v_existing is not null then
    return 'exists';
  end if;

  -- Take-down-first. Retract the content target now, via the same state
  -- transition a moderator RPC uses, and audit it as an ncii removal.
  if v_kind in ('article', 'revision') then
    begin
      v_article_uuid := v_id::uuid;
    exception when others then
      v_article_uuid := null;
    end;
    if v_article_uuid is not null then
      update public.nw_articles set status = 'retracted' where id = v_article_uuid;
      if found then
        v_status := 'removed';
        insert into public.nw_moderation_actions
          (report_id, moderator_ref, action, target_kind, target_id, note)
        values
          (p_report_id, 'ncii-auto', 'hide_article', 'article', v_id,
           'TAKE IT DOWN: automatic NCII takedown pending human review');
      end if;
    end if;
  elsif v_kind = 'suggestion' then
    begin
      v_suggestion_uuid := v_id::uuid;
    exception when others then
      v_suggestion_uuid := null;
    end;
    if v_suggestion_uuid is not null then
      update public.nw_edit_suggestions set status = 'rejected' where id = v_suggestion_uuid;
      if found then
        v_status := 'removed';
        insert into public.nw_moderation_actions
          (report_id, moderator_ref, action, target_kind, target_id, note)
        values
          (p_report_id, 'ncii-auto', 'hide_suggestion', 'suggestion', v_id,
           'TAKE IT DOWN: automatic NCII takedown pending human review');
      end if;
    end if;
  end if;
  -- profile/media (or an unresolvable id) stays 'queued' for the worker + human.

  insert into public.nw_ncii_cases
    (report_id, target_kind, target_id, deadline_at, status)
  values
    (p_report_id, v_kind, v_id, now() + make_interval(hours => v_hours), v_status);
  return 'ok';
end;
$$;

revoke all on function public.nw_open_ncii_case(uuid, integer) from public;
revoke all on function public.nw_open_ncii_case(uuid, integer) from anon, authenticated;
grant execute on function public.nw_open_ncii_case(uuid, integer) to service_role;

-- ============================================================ worker enforcement RPC

-- Fail-closed SLA enforcement for one NCII case (worker + console call this).
-- p_action:
--   'ensure_removed' -> for a queued/escalated content case, ensure the content
--                       row is retracted (idempotent) and set status 'removed'.
--                       For a profile/media case with no content row, mark
--                       'escalated' (a human must finish the takedown). NEVER
--                       leaves NCII up: ambiguity escalates, it does not clear.
--   'escalate'       -> mark the case 'escalated' + audit (worker at/over SLA).
--   'clear'          -> HUMAN-ONLY resolve to 'cleared' (verified false report);
--                       requires a non-'ncii-auto' moderator ref.
-- p_hash_status / p_ncmec_ref optionally record the vendor + CyberTipline seam
-- outputs; they never auto-clear a case.
create or replace function public.nw_ncii_enforce(
  p_case_id uuid,
  p_action text,
  p_moderator_ref text,
  p_note text default '',
  p_hash_status text default null,
  p_ncmec_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_id text;
  v_status text;
  v_article_uuid uuid;
  v_suggestion_uuid uuid;
  v_new_status text;
begin
  if p_moderator_ref is null or length(trim(p_moderator_ref)) = 0 then
    return 'bad-moderator';
  end if;
  if p_action not in ('ensure_removed', 'escalate', 'clear') then
    return 'bad-action';
  end if;

  select target_kind, target_id, status into v_kind, v_id, v_status
  from public.nw_ncii_cases
  where id = p_case_id;
  if v_kind is null then
    return 'not-found';
  end if;

  -- Clearing is a human-only, deliberate action; the worker uses 'ncii-auto'
  -- and must never be able to clear a case.
  if p_action = 'clear' then
    if p_moderator_ref = 'ncii-auto' then
      return 'clear-not-allowed';
    end if;
    update public.nw_ncii_cases
      set status = 'cleared',
          hash_match_status = coalesce(p_hash_status, hash_match_status),
          ncmec_ref = coalesce(p_ncmec_ref, ncmec_ref),
          note = coalesce(nullif(trim(p_note), ''), note)
      where id = p_case_id;
    insert into public.nw_moderation_actions
      (report_id, moderator_ref, action, target_kind, target_id, note)
    values
      ((select report_id from public.nw_ncii_cases where id = p_case_id),
       p_moderator_ref, 'restore', v_kind, v_id,
       'NCII case cleared (human-reviewed): ' || coalesce(p_note, ''));
    return 'cleared';
  end if;

  -- ensure_removed / escalate both drive toward removal, never away from it.
  v_new_status := 'escalated';
  if v_kind in ('article', 'revision') then
    begin
      v_article_uuid := v_id::uuid;
    exception when others then
      v_article_uuid := null;
    end;
    if v_article_uuid is not null then
      -- Idempotent retract: already-retracted stays retracted.
      update public.nw_articles set status = 'retracted'
        where id = v_article_uuid and status <> 'retracted';
      -- Whether or not this call flipped it, a content row that exists is now
      -- provably removed.
      if exists (select 1 from public.nw_articles where id = v_article_uuid) then
        v_new_status := case when p_action = 'ensure_removed' then 'removed' else 'escalated' end;
      end if;
    end if;
  elsif v_kind = 'suggestion' then
    begin
      v_suggestion_uuid := v_id::uuid;
    exception when others then
      v_suggestion_uuid := null;
    end;
    if v_suggestion_uuid is not null then
      update public.nw_edit_suggestions set status = 'rejected'
        where id = v_suggestion_uuid and status <> 'rejected';
      if exists (select 1 from public.nw_edit_suggestions where id = v_suggestion_uuid) then
        v_new_status := case when p_action = 'ensure_removed' then 'removed' else 'escalated' end;
      end if;
    end if;
  end if;
  -- profile/media with no content row: v_new_status stays 'escalated' so a human
  -- finishes the takedown. Fail-closed.

  -- An explicit escalate action always escalates (SLA breach signal), even if a
  -- content row was removed, so the human queue still surfaces it.
  if p_action = 'escalate' then
    v_new_status := 'escalated';
  end if;

  update public.nw_ncii_cases
    set status = v_new_status,
        hash_match_status = coalesce(p_hash_status, hash_match_status),
        ncmec_ref = coalesce(p_ncmec_ref, ncmec_ref),
        note = coalesce(nullif(trim(p_note), ''), note)
    where id = p_case_id;

  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values
    ((select report_id from public.nw_ncii_cases where id = p_case_id),
     p_moderator_ref,
     case when v_kind in ('article', 'revision') then 'hide_article'
          when v_kind = 'suggestion' then 'hide_suggestion'
          else 'suspend_profile' end,
     v_kind, v_id,
     'NCII SLA enforce (' || p_action || ' -> ' || v_new_status || '): ' || coalesce(p_note, ''));
  return v_new_status;
end;
$$;

revoke all on function public.nw_ncii_enforce(uuid, text, text, text, text, text) from public;
revoke all on function public.nw_ncii_enforce(uuid, text, text, text, text, text) from anon, authenticated;
grant execute on function public.nw_ncii_enforce(uuid, text, text, text, text, text) to service_role;

-- ============================================================ scheduled worker invocation

-- pg_cron / pg_net are created best-effort so this migration never fails on a
-- local stack that lacks them (mirrors 20260610000001_bestchef_scheduled_jobs).
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron unavailable in this environment: %', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net unavailable in this environment: %', sqlerrm;
end $$;

-- Invoke the mynews-ncii-worker Edge Function when there are unresolved cases.
-- Quiet no-op when unconfigured (nw_job_config missing the URL/secret rows),
-- when nothing is pending, or when pg_net is absent, so the cron never spams a
-- partially-provisioned env. Ops inserts the two config rows per environment:
--   insert into public.nw_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('ncii_worker_secret', '<MYNEWS_NCII_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value;
create or replace function public.nw_run_ncii_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_pending integer;
begin
  select value into v_url from public.nw_job_config where key = 'functions_base_url';
  select value into v_secret from public.nw_job_config where key = 'ncii_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  -- Anything not yet at a terminal-safe state is worth a worker pass: queued or
  -- escalated cases still need the fail-closed removal + SLA handling.
  select count(*) into v_pending
  from public.nw_ncii_cases
  where status in ('queued', 'escalated');
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/mynews-ncii-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MyNews-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'nw_run_ncii_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.nw_run_ncii_worker() from public, anon, authenticated;
grant execute on function public.nw_run_ncii_worker() to service_role;

-- Schedule the worker every 10 minutes when pg_cron is present. cron.schedule
-- upserts by job name, so re-running this migration is idempotent. A 10-minute
-- cadence keeps the effective SLA well inside 48h even if intake's immediate
-- hold ever failed to remove a content row.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'mynews-ncii-worker',
      '*/10 * * * *',
      $job$select public.nw_run_ncii_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: mynews-ncii-worker not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'mynews-ncii-worker scheduling skipped: %', sqlerrm;
end $$;
