-- BestChef moderation worker scheduling (audit C3 part 4).
--
-- The moderate_vote_proof and bestchef-media-screening Edge Functions are
-- deployed but dormant without a scheduler: nothing drains the queues on a
-- hosted cadence. This migration schedules both, following the established
-- bc_run_account_deletion_worker / bc_run_media_purge_worker pattern exactly:
--   * per-environment secrets live in bc_job_config (RLS, no policies), never
--     hardcoded in the migration;
--   * quiet no-op when unconfigured, when nothing is queued, or when pg_net is
--     missing, so partially-provisioned envs never spam errors;
--   * bc_job_health() reports both new jobs so ops can see an unseeded config.
--
-- Per-environment ops setup (staging + production), service-role SQL:
--   insert into public.bc_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('vote_proof_moderation_worker_secret', '<BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET>'),
--     ('media_screening_worker_secret', '<BESTCHEF_MEDIA_SCREENING_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- FAIL-CLOSED NOTE: with no classifier provider configured (the default until
-- founder item F3), both workers route content to HUMAN REVIEW rather than
-- approving. Scheduling them does not enable auto-approval; it just drains the
-- queues into the moderator console on a hosted cadence.

-- Re-align the media-purge no-op guard with the worker's actual candidate set
-- after the child-safety evidence-retention exclusion (audit C5). The worker's
-- buildPurgeCandidatesFilter now excludes quarantined assets so child-safety
-- evidence bytes survive an owner account deletion; this count must match, or the
-- job would fire a wasted run whenever the only "purgeable" rows are quarantined.
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
    and moderation_status <> 'quarantined'
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

-- Invoke the vote-proof moderation worker. Quiet no-op when unconfigured,
-- when there is nothing queued, or when pg_net is missing.
create or replace function bc_run_vote_proof_moderation_worker()
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
  select value into v_secret from public.bc_job_config where key = 'vote_proof_moderation_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.bc_moderation_queue
  where kind = 'vote_proof' and status in ('queued', 'failed');
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/moderate_vote_proof',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_vote_proof_moderation_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_vote_proof_moderation_worker() from public, anon, authenticated;
grant execute on function bc_run_vote_proof_moderation_worker() to service_role;

-- Invoke the media-screening worker. Quiet no-op when unconfigured, when
-- nothing is queued, or when pg_net is missing.
create or replace function bc_run_media_screening_worker()
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
  select value into v_secret from public.bc_job_config where key = 'media_screening_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.bc_moderation_queue
  where kind = 'media_asset' and status = 'queued';
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-media-screening',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_media_screening_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_media_screening_worker() from public, anon, authenticated;
grant execute on function bc_run_media_screening_worker() to service_role;

-- Schedule both jobs when pg_cron is present. cron.schedule upserts by job name,
-- so re-running this migration is idempotent. Every few minutes is plenty: the
-- worker batch limits bound each run and moderation latency of a few minutes is
-- acceptable for content that is already withheld from public view.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-vote-proof-moderation-worker',
      '*/5 * * * *',
      $job$select public.bc_run_vote_proof_moderation_worker();$job$
    );
    perform cron.schedule(
      'bestchef-media-screening-worker',
      '*/5 * * * *',
      $job$select public.bc_run_media_screening_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: BestChef moderation worker jobs not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'BestChef moderation worker job scheduling skipped: %', sqlerrm;
end $$;

-- bc_job_health() now reports the two moderation worker jobs too.
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
  v_has_vote_proof_secret boolean;
  v_has_media_screening_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_purge_job boolean;
  v_vote_proof_job boolean;
  v_media_screening_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
  v_pending_vote_proofs bigint;
  v_pending_media_screening bigint;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from public.bc_job_config where key = 'media_purge_worker_secret')
    into v_has_purge_secret;
  select exists (select 1 from public.bc_job_config where key = 'vote_proof_moderation_worker_secret')
    into v_has_vote_proof_secret;
  select exists (select 1 from public.bc_job_config where key = 'media_screening_worker_secret')
    into v_has_media_screening_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_purge_job := false;
  v_vote_proof_job := false;
  v_media_screening_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-vote-proof-moderation-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-screening-worker')
        into v_rankings_job, v_deletion_job, v_purge_job, v_vote_proof_job, v_media_screening_job;
    exception when others then
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
      v_vote_proof_job := false;
      v_media_screening_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  -- Mirror the worker's candidate filter, including the child-safety evidence
  -- retention exclusion (audit C5): quarantined assets are never purge
  -- candidates, so they are not counted as purgeable here either.
  select count(*)
    from public.bc_media_assets
    where storage_key is not null
      and metadata ->> 'purged_at' is null
      and moderation_status <> 'quarantined'
      and (
        upload_status = 'deleted'
        or (moderation_status = 'rejected' and updated_at < now() - interval '183 days')
      )
    into v_purgeable_media;

  select count(*)
    from public.bc_moderation_queue
    where kind = 'vote_proof' and status in ('queued', 'failed')
    into v_pending_vote_proofs;

  select count(*)
    from public.bc_moderation_queue
    where kind = 'media_asset' and status = 'queued'
    into v_pending_media_screening;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'config_media_purge_secret', v_has_purge_secret,
    'config_vote_proof_moderation_secret', v_has_vote_proof_secret,
    'config_media_screening_secret', v_has_media_screening_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'media_purge_job_scheduled', v_purge_job,
    'vote_proof_moderation_job_scheduled', v_vote_proof_job,
    'media_screening_job_scheduled', v_media_screening_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'pending_vote_proof_moderation', v_pending_vote_proofs,
    'pending_media_screening', v_pending_media_screening,
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret
      and v_has_vote_proof_secret and v_has_media_screening_secret
      and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job
      and v_vote_proof_job and v_media_screening_job,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
