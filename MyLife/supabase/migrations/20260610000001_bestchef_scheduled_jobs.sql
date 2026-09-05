-- BestChef scheduled jobs (launch Wave 2 ops): hosted leaderboard rebuild cron and
-- account-deletion worker invocation, previously manual-only.
--
-- Design constraints:
-- * Environment-agnostic: the deletion worker needs this project's functions URL and the
--   worker secret, which must not be hardcoded in a migration. They live in bc_job_config
--   (RLS enabled, no policies: service-role only). Until ops inserts both rows, the job
--   runs as a quiet no-op.
-- * Safe where pg_cron/pg_net are unavailable (some local stacks): extension creation and
--   scheduling are wrapped so the migration never fails; it just skips scheduling.
--
-- Per-environment ops setup (staging + production), service-role SQL:
--   insert into public.bc_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('account_deletion_worker_secret', '<BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();

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

-- Service-role-only job configuration (no anon/authenticated policies on purpose).
create table if not exists public.bc_job_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.bc_job_config enable row level security;

-- Invoke the bestchef-delete-account Edge Function for open deletion requests.
-- Quiet no-op when unconfigured, when there is nothing to process, or when pg_net
-- is missing, so the cron job never spams errors in partially-provisioned envs.
create or replace function bc_run_account_deletion_worker()
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
  select value into v_url from public.bc_job_config where key = 'functions_base_url';
  select value into v_secret from public.bc_job_config where key = 'account_deletion_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.bc_account_deletion_requests
  where status in ('requested', 'processing');
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-delete-account',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_account_deletion_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_account_deletion_worker() from public, anon, authenticated;
grant execute on function bc_run_account_deletion_worker() to service_role;

-- Schedule both jobs when pg_cron is present. cron.schedule upserts by job name,
-- so re-running this migration is idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-rebuild-rankings',
      '17 * * * *',
      $job$select public.bc_rebuild_rankings();$job$
    );
    perform cron.schedule(
      'bestchef-account-deletion-worker',
      '*/15 * * * *',
      $job$select public.bc_run_account_deletion_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: BestChef jobs not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'BestChef job scheduling skipped: %', sqlerrm;
end $$;
