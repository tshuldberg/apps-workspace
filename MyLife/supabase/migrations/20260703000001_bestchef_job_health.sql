-- BestChef job health surface (plan 33 Phase 0 Task 6).
--
-- Why: the scheduled-jobs migration (20260610000001) fails SILENTLY in two
-- ways: (1) if the bc_job_config rows are missing, bc_run_account_deletion_worker
-- returns without error forever, so GDPR deletion requests pile up in
-- 'requested' with zero signal; (2) if pg_cron/pg_net are unavailable, the jobs
-- are simply never scheduled (the scheduling block swallows the exception).
-- bc_job_health() makes both failure modes observable in one call.
--
-- Access: service_role only (same posture as bc_run_account_deletion_worker).
-- The plan 33 Phase 1 moderator console surfaces it; until then:
--   select bc_job_health();  -- via service-role SQL or the dashboard.

create or replace function public.bc_job_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_url boolean;
  v_has_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker')
        into v_rankings_job, v_deletion_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'healthy',
      v_has_url and v_has_secret and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
