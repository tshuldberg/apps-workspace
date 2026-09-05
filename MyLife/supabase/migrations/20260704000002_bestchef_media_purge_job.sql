-- BestChef media purge job wiring (TS-04, plan 33 Phase 4.1 item).
--
-- The bestchef-media-purge Edge Function deletes storage objects for
-- purgeable bc_media_assets rows (user/account deletions immediately;
-- moderation rejections only after the 183-day appeal-evidence window).
-- Deploying the function alone leaves it dormant (review 2026-07-04):
-- this migration schedules it and folds it into bc_job_health().
--
-- Per-environment ops setup (staging + production), service-role SQL:
--   insert into public.bc_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('media_purge_worker_secret', '<BESTCHEF_MEDIA_PURGE_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();

-- Invoke the purge worker. Quiet no-op when unconfigured, when nothing is
-- purgeable, or when pg_net is missing (mirrors bc_run_account_deletion_worker).
create or replace function bc_run_media_purge_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_purgeable integer;
begin
  select value into v_url from public.bc_job_config where key = 'functions_base_url';
  select value into v_secret from public.bc_job_config where key = 'media_purge_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_purgeable
  from public.bc_media_assets
  where storage_key is not null
    and metadata ->> 'purged_at' is null
    and (
      upload_status = 'deleted'
      or (moderation_status = 'rejected' and updated_at < now() - interval '183 days')
    );
  if v_purgeable = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-media-purge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_media_purge_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_media_purge_worker() from public, anon, authenticated;
grant execute on function bc_run_media_purge_worker() to service_role;

-- Daily is plenty: the batch limit bounds each run and the appeal window
-- means rejections wait months anyway.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-media-purge-worker',
      '43 3 * * *',
      $job$select public.bc_run_media_purge_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: media purge job not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'media purge job scheduling skipped: %', sqlerrm;
end $$;

-- bc_job_health() now reports the purge job too.
create or replace function public.bc_job_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_url boolean;
  v_has_secret boolean;
  v_has_purge_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_purge_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from public.bc_job_config where key = 'media_purge_worker_secret')
    into v_has_purge_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_purge_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker')
        into v_rankings_job, v_deletion_job, v_purge_job;
    exception when others then
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  select count(*)
    from public.bc_media_assets
    where storage_key is not null
      and metadata ->> 'purged_at' is null
      and (
        upload_status = 'deleted'
        or (moderation_status = 'rejected' and updated_at < now() - interval '183 days')
      )
    into v_purgeable_media;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'config_media_purge_secret', v_has_purge_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'media_purge_job_scheduled', v_purge_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
