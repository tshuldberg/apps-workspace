-- BestChef signed playback URL re-sign job (audit H6).
--
-- apps/bestchef-console/lib/media-promotion.ts signs a 365-day playback URL
-- (PROMOTED_URL_TTL_SECONDS) when a submission video is approved, or when an
-- overturned rejection re-promotes one. Nothing ever re-signs it. Every
-- approved video therefore goes dark in one silent expiry cohort roughly a
-- year after its approval date, with no worker to catch it. The CDN/streaming
-- migration is founder item F4 and out of scope here; this job is needed
-- regardless of when F4 lands, since even a CDN-backed delivery path will
-- likely keep signed origin URLs with an expiry.
--
-- EXPIRY MODEL: bc_media_assets had no expiry column. This migration adds
-- playback_url_expires_at and backfills every row that already has a
-- remote_url from updated_at + 365 days (the best available proxy: the
-- console never separately recorded promotion time, and updated_at is set by
-- the bc_media_assets_set_updated_at trigger on the same UPDATE that patches
-- remote_url in attachPlaybackUrl). Going forward, attachPlaybackUrl itself
-- writes the real value at sign time (see media-promotion.ts), so the
-- backfill proxy only matters for rows promoted before this migration.
--
-- Per-environment ops setup (staging + production), service-role SQL:
--   insert into public.bc_job_config (key, value) values
--     ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('url_resign_worker_secret', '<BESTCHEF_URL_RESIGN_WORKER_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- IMPORTANT FOR THE NEXT EDITOR: bc_job_health() has been rewritten from
-- scratch multiple times and previously LOST fields when an editor started
-- `create or replace function` from an earlier copy of the body (see the
-- drift history in 20260711000008_bestchef_job_health_quota_fields.sql). This
-- migration's copy of bc_job_health() starts from 20260711000008 (the most
-- complete version at the time of writing) and carries every existing field
-- forward, adding only the url-resign fields. Any FUTURE edit to
-- bc_job_health() must do the same: start from this version, not an earlier
-- migration.

-- ── Schema: expiry tracking column ─────────────────────────────────────

alter table public.bc_media_assets
  add column if not exists playback_url_expires_at timestamptz;

comment on column public.bc_media_assets.playback_url_expires_at is
  'Expiry of the signed URL currently stored in remote_url. Set by attachPlaybackUrl() '
  'on promotion and by bc_run_url_resign_worker() on re-sign. Null means no signed URL '
  'has ever been attached (e.g. non-video assets, or a video never approved).';

-- Backfill existing promoted videos. approved + a remote_url present means a
-- signed URL was already issued; updated_at on that same row is the closest
-- available timestamp to when it was signed (attachPlaybackUrl's UPDATE sets
-- both remote_url and updated_at together).
update public.bc_media_assets
set playback_url_expires_at = updated_at + interval '365 days'
where playback_url_expires_at is null
  and remote_url is not null
  and media_kind = 'video'
  and moderation_status = 'approved';

create index if not exists bc_media_assets_playback_expiry_idx
  on public.bc_media_assets (playback_url_expires_at)
  where playback_url_expires_at is not null;

-- ── Worker scheduling ────────────────────────────────────────────────────

-- Invoke the URL re-sign worker. Quiet no-op when unconfigured, when nothing
-- is within the rolling expiry window, or when pg_net is missing. Mirrors
-- bc_run_media_purge_worker / bc_run_media_screening_worker exactly.
create or replace function bc_run_url_resign_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_expiring integer;
begin
  select value into v_url from public.bc_job_config where key = 'functions_base_url';
  select value into v_secret from public.bc_job_config where key = 'url_resign_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_expiring
  from public.bc_media_assets
  where media_kind = 'video'
    and moderation_status = 'approved'
    and remote_url is not null
    and storage_bucket is not null
    and storage_key is not null
    and playback_url_expires_at is not null
    and playback_url_expires_at < now() + interval '30 days';
  if v_expiring = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-url-resign',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_url_resign_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function bc_run_url_resign_worker() from public, anon, authenticated;
grant execute on function bc_run_url_resign_worker() to service_role;

-- Weekly is plenty: the worker's 30-day rolling window means a row gets many
-- chances to be re-signed well before it actually expires, even if a run or
-- two is skipped.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-url-resign-worker',
      '0 6 * * 0',
      $job$select public.bc_run_url_resign_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: BestChef URL re-sign worker job not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'BestChef URL re-sign worker job scheduling skipped: %', sqlerrm;
end $$;

-- ── bc_job_health(): carry every existing field forward, add url-resign ──

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
  v_has_url_resign_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_purge_job boolean;
  v_vote_proof_job boolean;
  v_media_screening_job boolean;
  v_prune_job boolean;
  v_url_resign_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
  v_pending_vote_proofs bigint;
  v_pending_media_screening bigint;
  v_action_limits bigint;
  v_action_kill boolean;
  v_expiring_playback_urls bigint;
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
  select exists (select 1 from public.bc_job_config where key = 'url_resign_worker_secret')
    into v_has_url_resign_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_purge_job := false;
  v_vote_proof_job := false;
  v_media_screening_job := false;
  v_prune_job := false;
  v_url_resign_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-vote-proof-moderation-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-screening-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-prune-action-usage'),
        exists (select 1 from cron.job where jobname = 'bestchef-url-resign-worker')
        into v_rankings_job, v_deletion_job, v_purge_job, v_vote_proof_job,
          v_media_screening_job, v_prune_job, v_url_resign_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
      v_vote_proof_job := false;
      v_media_screening_job := false;
      v_prune_job := false;
      v_url_resign_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  -- Mirrors the worker's candidate filter, including the child-safety evidence
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

  select count(*) from public.bc_action_limits where enabled into v_action_limits;
  select kill_switch from public.bc_action_controls where id = true into v_action_kill;

  -- Mirrors bc_run_url_resign_worker's candidate filter (audit H6).
  select count(*)
    from public.bc_media_assets
    where media_kind = 'video'
      and moderation_status = 'approved'
      and remote_url is not null
      and storage_bucket is not null
      and storage_key is not null
      and playback_url_expires_at is not null
      and playback_url_expires_at < now() + interval '30 days'
    into v_expiring_playback_urls;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'config_media_purge_secret', v_has_purge_secret,
    'config_vote_proof_moderation_secret', v_has_vote_proof_secret,
    'config_media_screening_secret', v_has_media_screening_secret,
    'config_url_resign_secret', v_has_url_resign_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'media_purge_job_scheduled', v_purge_job,
    'vote_proof_moderation_job_scheduled', v_vote_proof_job,
    'media_screening_job_scheduled', v_media_screening_job,
    'action_usage_prune_job_scheduled', v_prune_job,
    'url_resign_job_scheduled', v_url_resign_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'pending_vote_proof_moderation', v_pending_vote_proofs,
    'pending_media_screening', v_pending_media_screening,
    'action_limits_enabled_rows', v_action_limits,
    'action_kill_switch', coalesce(v_action_kill, false),
    'expiring_playback_urls', v_expiring_playback_urls,
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret
      and v_has_vote_proof_secret and v_has_media_screening_secret
      and v_has_url_resign_secret
      and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job
      and v_vote_proof_job and v_media_screening_job and v_prune_job
      and v_url_resign_job
      and v_action_limits > 0 and not coalesce(v_action_kill, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
