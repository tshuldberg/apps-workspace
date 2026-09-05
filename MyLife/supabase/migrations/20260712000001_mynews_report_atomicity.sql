-- MyNews report atomicity and NCII orphan repair (Plan 48 WP1).
-- Migration 20260705000005 locked report writes behind the edge function, but
-- target validation, dedupe, report insertion, and NCII case creation remained
-- separate calls. Migration 20260705000009 added take-down-first enforcement,
-- but a case-open failure could still leave an open NCII report with no case.
-- This migration makes the complete intake one transaction, permits a higher
-- severity reason to upgrade an existing open report, adds authoritative media
-- assets, and gives the worker an idempotent orphan-repair path.
--
-- Fail-closed invariant: nw_submit_report either commits the report mutation,
-- escalation audit, immediate takedown, and NCII case together, or PostgreSQL
-- rolls the whole call back. Controlled target misses return 'bad-target'; all
-- other database failures propagate to the edge function as retryable errors.
-- Prior migrations remain untouched.

-- ============================================================ severity rank

-- Twin of REPORT_SEVERITY_RANK in modules/mynews/src/data/report.ts and the
-- Deno-compatible constant in supabase/functions/_shared/mynews-store.ts.
create or replace function public.nw_report_severity_rank(p_reason text)
returns integer
language sql
immutable
security definer
set search_path = public
as $$
  select case p_reason
    when 'ncii' then 100
    when 'violence' then 80
    when 'harassment' then 60
    when 'impersonation' then 60
    when 'copyright' then 40
    when 'spam' then 20
    when 'other' then 20
    else 0
  end;
$$;

revoke all on function public.nw_report_severity_rank(text) from public, anon, authenticated;
grant execute on function public.nw_report_severity_rank(text) to service_role;

-- ============================================================ media assets

-- Authoritative media identity for report targets. RLS is enabled with zero
-- client policies, matching nw_ncii_cases and nw_moderation_actions. Upload and
-- quarantine workflows remain service-role-only until their product path lands.
create table if not exists public.nw_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.nw_profiles (id),
  storage_path text not null,
  sha256 text not null,
  status text not null default 'pending' check (
    status in ('pending', 'quarantined', 'approved', 'removed')
  ),
  created_at timestamptz not null default now()
);
alter table public.nw_media_assets enable row level security;
revoke all on table public.nw_media_assets from public, anon, authenticated;

create index if not exists idx_nw_media_assets_owner
  on public.nw_media_assets (owner_profile_id, created_at);
create index if not exists idx_nw_media_assets_sha256
  on public.nw_media_assets (sha256);

-- Dedicated, service-role-only reason-upgrade audit. The moderation action enum
-- describes enforcement actions, so report escalation is kept in its own table
-- instead of overloading an unrelated action value such as dismiss or restore.
create table if not exists public.nw_report_escalations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.nw_reports (id) on delete cascade,
  from_reason text not null,
  to_reason text not null,
  prior_detail text not null default '',
  escalated_detail text not null default '',
  created_at timestamptz not null default now()
);
alter table public.nw_report_escalations enable row level security;
revoke all on table public.nw_report_escalations from public, anon, authenticated;

create index if not exists idx_nw_report_escalations_report
  on public.nw_report_escalations (report_id, created_at);

-- ============================================================ NCII repair RPC

-- Repair one open NCII report that has no non-cleared case. The deadline stays
-- anchored to the original report time, so reconciliation never restarts the
-- statutory clock. Advisory locking makes concurrent worker runs idempotent.
create or replace function public.nw_reconcile_ncii_case(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid;
  v_kind text;
  v_id text;
  v_report_created_at timestamptz;
  v_status text := 'queued';
  v_existing uuid;
  v_case_id uuid;
  v_article_uuid uuid;
  v_suggestion_uuid uuid;
begin
  select reporter_id, target_kind, target_id
    into v_reporter_id, v_kind, v_id
  from public.nw_reports
  where id = p_report_id and status = 'open' and reason = 'ncii';
  if v_kind is null then
    return 'not-ncii';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'nw-ncii:' || coalesce(v_reporter_id::text, '') || ':' || v_kind || ':' || v_id,
      0
    )
  );

  select target_kind, target_id, created_at
    into v_kind, v_id, v_report_created_at
  from public.nw_reports
  where id = p_report_id and status = 'open' and reason = 'ncii'
  for update;
  if v_kind is null then
    return 'not-ncii';
  end if;

  select id into v_existing
  from public.nw_ncii_cases
  where report_id = p_report_id and status <> 'cleared'
  limit 1
  for update;
  if v_existing is not null then
    return 'exists';
  end if;

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

  insert into public.nw_ncii_cases
    (report_id, target_kind, target_id, deadline_at, status)
  values
    (p_report_id, v_kind, v_id,
     v_report_created_at + make_interval(hours => 48), v_status)
  on conflict (report_id) where status <> 'cleared' do nothing
  returning id into v_case_id;

  if v_case_id is null then
    return 'exists';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.nw_reconcile_ncii_case(uuid) from public, anon, authenticated;
grant execute on function public.nw_reconcile_ncii_case(uuid) to service_role;

-- ============================================================ atomic intake

create or replace function public.nw_submit_report(
  p_reporter_profile_id uuid,
  p_target_kind text,
  p_target_id text,
  p_reason text,
  p_detail text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_uuid uuid;
  v_target_exists boolean := false;
  v_report_id uuid;
  v_existing_reason text;
  v_existing_detail text;
  v_outcome text := 'submitted';
  v_ncii_outcome text;
begin
  if p_target_kind is null or p_target_kind not in (
    'article', 'revision', 'suggestion', 'profile', 'media'
  ) then
    return 'bad-target';
  end if;

  begin
    v_target_uuid := p_target_id::uuid;
  exception when others then
    v_target_uuid := null;
  end;
  if v_target_uuid is null then
    return 'bad-target';
  end if;

  if p_target_kind in ('article', 'revision') then
    select true into v_target_exists
    from public.nw_articles
    where id = v_target_uuid;
  elsif p_target_kind = 'suggestion' then
    select true into v_target_exists
    from public.nw_edit_suggestions
    where id = v_target_uuid;
  elsif p_target_kind = 'profile' then
    select true into v_target_exists
    from public.nw_profiles
    where id = v_target_uuid;
  elsif p_target_kind = 'media' then
    select true into v_target_exists
    from public.nw_media_assets
    where id = v_target_uuid;
  end if;
  if not coalesce(v_target_exists, false) then
    return 'bad-target';
  end if;

  if p_reporter_profile_id is null or not exists (
    select 1 from public.nw_profiles where id = p_reporter_profile_id
  ) then
    raise exception 'nw_submit_report: reporter profile not found';
  end if;
  if p_reason is null or p_reason not in (
    'harassment', 'violence', 'ncii', 'copyright', 'impersonation', 'spam', 'other'
  ) then
    raise exception 'nw_submit_report: unsupported reason';
  end if;

  -- Match the reconciliation lock order before taking the report row lock, so
  -- an intake upgrade and an orphan worker cannot deadlock each other.
  if p_reason = 'ncii' then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'nw-ncii:' || p_reporter_profile_id::text || ':' || p_target_kind || ':' || p_target_id,
        0
      )
    );
  end if;

  -- Serialize the exact partial-unique-index dimension before reading it. The
  -- index remains the database backstop; this lock keeps concurrent upgrades
  -- deterministic instead of turning an idempotent retry into a unique error.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_reporter_profile_id::text || ':' || p_target_kind || ':' || p_target_id,
      0
    )
  );

  select id, reason, detail
    into v_report_id, v_existing_reason, v_existing_detail
  from public.nw_reports
  where reporter_id = p_reporter_profile_id
    and target_kind = p_target_kind
    and target_id = p_target_id
    and status = 'open'
  limit 1
  for update;

  if v_report_id is null then
    insert into public.nw_reports
      (reporter_id, target_kind, target_id, reason, detail, status)
    values
      (p_reporter_profile_id, p_target_kind, p_target_id, p_reason,
       coalesce(p_detail, ''), 'open')
    returning id into v_report_id;
  else
    if public.nw_report_severity_rank(v_existing_reason)
       >= public.nw_report_severity_rank(p_reason) then
      return 'already-reported';
    end if;

    update public.nw_reports
      set reason = p_reason,
          detail = coalesce(v_existing_detail, '') || E'\n---escalated---\n' || coalesce(p_detail, '')
      where id = v_report_id;

    insert into public.nw_report_escalations
      (report_id, from_reason, to_reason, prior_detail, escalated_detail)
    values
      (v_report_id, v_existing_reason, p_reason,
       coalesce(v_existing_detail, ''), coalesce(p_detail, ''));
    v_outcome := 'escalated';
  end if;

  if p_reason = 'ncii' then
    select public.nw_reconcile_ncii_case(v_report_id) into v_ncii_outcome;
    if v_ncii_outcome is null or v_ncii_outcome not in ('ok', 'exists') then
      raise exception 'nw_submit_report: NCII case creation failed (%)', v_ncii_outcome;
    end if;
  end if;

  return v_outcome;
end;
$$;

revoke all on function public.nw_submit_report(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_submit_report(uuid, text, text, text, text)
  to service_role;

-- ============================================================ orphan scan

create or replace function public.nw_find_orphaned_ncii_reports()
returns table (report_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select r.id as report_id
  from public.nw_reports r
  where r.status = 'open'
    and r.reason = 'ncii'
    and not exists (
      select 1
      from public.nw_ncii_cases c
      where c.report_id = r.id and c.status <> 'cleared'
    )
  order by r.created_at asc;
$$;

revoke all on function public.nw_find_orphaned_ncii_reports()
  from public, anon, authenticated;
grant execute on function public.nw_find_orphaned_ncii_reports()
  to service_role;

-- The existing cron wrapper previously skipped invocation when only orphaned
-- reports existed. Include both due cases and orphans so reconciliation runs
-- even when nw_ncii_cases is empty.
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

  select count(*) into v_pending
  from public.nw_ncii_cases
  where status in ('queued', 'escalated');

  if v_pending = 0 then
    select count(*) into v_pending
    from public.nw_reports r
    where r.status = 'open'
      and r.reason = 'ncii'
      and not exists (
        select 1 from public.nw_ncii_cases c
        where c.report_id = r.id and c.status <> 'cleared'
      );
  end if;
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
