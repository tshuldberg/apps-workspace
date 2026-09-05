-- MyNews health and observability substrate (plan 48 WP11, audit findings
-- C11/C13).
--
-- Three pieces:
--
--   1. nw_worker_runs: a uniform heartbeat row written by every MyNews worker at
--      the end of every pass. Queue depth alone cannot distinguish "the queue is
--      empty because everything is handled" from "the queue is empty because
--      nothing is reading it", and it cannot distinguish "the queue is deep
--      because volume spiked" from "the queue is deep because the worker has been
--      dead for six hours". A heartbeat separates those cases.
--
--      mynews-support-worker already writes nw_support_reconciliation_runs. That
--      row is the reconciliation OUTPUT (ledger invariants); this one is
--      liveness, and every worker writes it in the same shape so health has one
--      thing to read.
--
--   2. nw_health_thresholds: queue-age alarm configuration as data, not as a
--      constant compiled into an edge function. An operator raising the DMCA warn
--      threshold during a spike must not need a deploy. Seeded with defaults that
--      match the legal and policy deadlines that already exist elsewhere in the
--      schema (NCII 48h, urgent child-safety 24h, DMCA counter-notice 72h
--      acknowledgement, account deletion 7-day grace).
--
--   3. nw_health_snapshot(): one SECURITY DEFINER read that returns queue ages,
--      worker heartbeats, and the thresholds to compare them against. Service
--      role only. mynews-health is the only caller, and it decides how much of
--      the snapshot a given caller is allowed to see.
--
-- Fail-closed posture: a threshold row that is missing makes its component
-- 'unknown', never 'ok'. A worker that has never recorded a run reports
-- 'unknown' with a null age, never a fabricated healthy heartbeat.

-- ======================================================== worker heartbeats

create table if not exists public.nw_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker text not null check (worker <> ''),
  ok boolean not null,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  processed integer not null default 0 check (processed >= 0),
  failures integer not null default 0 check (failures >= 0),
  -- A short, code-authored summary. Never a user string, never an error body:
  -- this table is read by an endpoint whose shallow mode is unauthenticated.
  detail text check (detail is null or length(detail) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists nw_worker_runs_recent_idx
  on public.nw_worker_runs (worker, finished_at desc);

alter table public.nw_worker_runs enable row level security;
revoke all on table public.nw_worker_runs from public, anon, authenticated;
grant select, insert on table public.nw_worker_runs to service_role;

-- ======================================================== alarm thresholds

create table if not exists public.nw_health_thresholds (
  component text primary key check (component <> ''),
  -- What the age measures, so an operator editing a row knows what they change.
  description text not null default '',
  -- Age of the OLDEST open item in the queue, or of the LAST run for a worker.
  warn_seconds integer not null check (warn_seconds > 0),
  alarm_seconds integer not null check (alarm_seconds > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint nw_health_thresholds_ordered check (alarm_seconds >= warn_seconds)
);

alter table public.nw_health_thresholds enable row level security;
revoke all on table public.nw_health_thresholds from public, anon, authenticated;
grant select, insert, update on table public.nw_health_thresholds to service_role;

-- Defaults are anchored to deadlines that already exist in this schema, so a
-- threshold cannot quietly disagree with the promise it is meant to guard.
insert into public.nw_health_thresholds
  (component, description, warn_seconds, alarm_seconds)
values
  ('queue_report',
   'Age of the oldest open row in nw_reports.',
   6 * 3600, 24 * 3600),
  ('queue_ncii',
   'Age of the oldest unresolved nw_ncii_cases row. The case deadline is 48h (24h for the urgent child-safety lane), so warn well inside it.',
   4 * 3600, 12 * 3600),
  ('queue_dmca',
   'Age of the oldest open nw_dmca_notices or nw_dmca_counter_notices row. Counter-notice acknowledgement is due within 72h.',
   12 * 3600, 48 * 3600),
  ('queue_screening',
   'Age of the oldest nw_screening_decisions row awaiting human review or holding an open appeal. A held submission is an author waiting.',
   4 * 3600, 24 * 3600),
  ('queue_deletion',
   'Age past grace_ends_at of the oldest nw_deletion_requests row still not terminal. The 7-day grace window is disclosed to the user, so overshoot is a broken promise.',
   3600, 6 * 3600),
  ('queue_support_reconciliation',
   'Age of the most recent nw_support_reconciliation_runs row. Stale means journalist earnings figures are unverified.',
   26 * 3600, 3 * 24 * 3600),
  ('worker_mynews_ncii_worker',
   'Age of the last nw_worker_runs row for mynews-ncii-worker. Scheduled every 10 minutes.',
   3600, 6 * 3600),
  ('worker_mynews_account_worker',
   'Age of the last nw_worker_runs row for mynews-account-worker. Scheduled hourly.',
   3 * 3600, 12 * 3600),
  ('worker_mynews_support_worker',
   'Age of the last nw_worker_runs row for mynews-support-worker. Scheduled daily.',
   26 * 3600, 3 * 24 * 3600)
on conflict (component) do nothing;

-- ======================================================== snapshot read

-- Returns every component's queue age (seconds) and depth, every worker's last
-- run, and the thresholds. It does NOT classify: the classification lives in
-- TypeScript next to the tests that pin it, so the same comparison serves the
-- edge function and the console.
--
-- Ages are computed as "age of the oldest item still owed work", which is the
-- number an operator actually needs. Depth is included because an age without a
-- count cannot distinguish one stuck row from a genuine backlog.
create or replace function public.nw_health_snapshot()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'checkedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'queues', jsonb_build_object(
      'queue_report', (
        select jsonb_build_object(
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else floor(extract(epoch from (now() - min(r.created_at))))::bigint end
        )
        from public.nw_reports r
        where r.status = 'open'
      ),
      'queue_ncii', (
        select jsonb_build_object(
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else floor(extract(epoch from (now() - min(c.created_at))))::bigint end,
          -- Past-deadline count is the number that decides whether a person is
          -- paged, so it is reported separately from raw depth.
          'pastDeadline', count(*) filter (where c.deadline_at < now())
        )
        from public.nw_ncii_cases c
        where c.status = 'queued'
      ),
      'queue_dmca', (
        select jsonb_build_object(
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else floor(extract(epoch from (now() - min(t.created_at))))::bigint end
        )
        from (
          select n.created_at
          from public.nw_dmca_notices n
          where n.status = 'open'
          union all
          select cn.created_at
          from public.nw_dmca_counter_notices cn
          where cn.status in ('needs_resolution', 'received', 'forwarded_to_claimant', 'waiting_period')
        ) t
      ),
      'queue_screening', (
        select jsonb_build_object(
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else floor(extract(epoch from (now() - min(d.created_at))))::bigint end
        )
        from public.nw_screening_decisions d
        where d.decision = 'pending' or d.appeal_state = 'requested'
      ),
      'queue_deletion', (
        -- Age here is time PAST the disclosed grace end, not time since the
        -- request: a request sitting inside its own 7-day window is not late.
        select jsonb_build_object(
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else greatest(0, floor(extract(epoch from (now() - min(dr.grace_ends_at))))::bigint) end
        )
        from public.nw_deletion_requests dr
        where dr.status in ('grace', 'processing', 'failed')
          and dr.grace_ends_at <= now()
      ),
      'queue_support_reconciliation', (
        select jsonb_build_object(
          -- Depth is not a backlog here: it is whether a recent run exists.
          'depth', count(*),
          'oldestAgeSeconds',
            case when count(*) = 0 then null
                 else floor(extract(epoch from (now() - max(rr.finished_at))))::bigint end
        )
        from public.nw_support_reconciliation_runs rr
      )
    ),
    'workers', (
      select coalesce(
        jsonb_object_agg(w.worker, w.payload),
        '{}'::jsonb
      )
      from (
        select distinct on (wr.worker)
          wr.worker,
          jsonb_build_object(
            'ok', wr.ok,
            'finishedAt', to_char(wr.finished_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'ageSeconds', floor(extract(epoch from (now() - wr.finished_at)))::bigint,
            'processed', wr.processed,
            'failures', wr.failures,
            'detail', wr.detail
          ) as payload
        from public.nw_worker_runs wr
        order by wr.worker, wr.finished_at desc
      ) w
    ),
    'thresholds', (
      select coalesce(
        jsonb_object_agg(
          th.component,
          jsonb_build_object(
            'warnSeconds', th.warn_seconds,
            'alarmSeconds', th.alarm_seconds,
            'enabled', th.enabled,
            'description', th.description
          )
        ),
        '{}'::jsonb
      )
      from public.nw_health_thresholds th
    )
  );
$$;

revoke all on function public.nw_health_snapshot() from public, anon, authenticated;
grant execute on function public.nw_health_snapshot() to service_role;

-- ======================================================== support worker cron

-- The support reconciliation worker had no scheduled caller: nw_run_ncii_worker
-- and nw_run_account_worker exist, this one did not, so the append-only support
-- ledger was only ever reconciled by hand. Same shape as its siblings
-- (20260705000009, 20260730000006): configuration lives in nw_job_config rows
-- written by founder-ops, and the function is a no-op until both are present. It
-- never fabricates a call it cannot make.
create or replace function public.nw_run_support_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from public.nw_job_config where key = 'functions_base_url';
  select value into v_secret from public.nw_job_config where key = 'support_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  -- No pending-work short circuit here, unlike the other two. Reconciliation is
  -- a full-ledger invariant check: "nothing new arrived" is exactly when a
  -- silent corruption would go unnoticed, and a daily pass is cheap.
  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/mynews-support-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MyNews-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'nw_run_support_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.nw_run_support_worker() from public, anon, authenticated;
grant execute on function public.nw_run_support_worker() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'mynews-support-worker',
      '23 4 * * *',
      $job$select public.nw_run_support_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: mynews-support-worker not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'mynews-support-worker scheduling skipped: %', sqlerrm;
end $$;
