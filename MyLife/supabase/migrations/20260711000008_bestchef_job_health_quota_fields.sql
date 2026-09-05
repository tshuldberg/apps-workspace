-- Restore bc_job_health() quota-engine fields dropped by drift (audit M9 follow-up).
--
-- Drift history: 20260703000002_bestchef_integrity_floor.sql added quota-engine
-- reporting to bc_job_health() (action_usage_prune_job_scheduled,
-- action_limits_enabled_rows, action_kill_switch). But 20260704000002_bestchef_media_purge_job.sql
-- and 20260711000005_bestchef_moderation_worker_jobs.sql each `create or replace`
-- the function starting from an EARLIER copy of the body (pre-integrity-floor),
-- so every edit after 20260703000002 silently dropped the quota-engine fields
-- again. bc_action_limits/bc_action_controls/bc_prune_action_usage are still
-- live (written to by 20260703000003_bestchef_appeals.sql and
-- 20260704000001_bestchef_saved_submissions.sql) and the console's ops-levers
-- panel still edits that same state, so this was a real reporting gap, not
-- dead code.
--
-- This migration is the UNION of the CURRENT shape (20260711000005: rankings,
-- deletion, media purge, vote-proof moderation, media screening) plus the
-- quota-engine fields from 20260703000002, verbatim. IMPORTANT FOR THE NEXT
-- EDITOR: bc_job_health() has now been rewritten from scratch four times.
-- Any future `create or replace function public.bc_job_health()` MUST start
-- from THIS version (the most complete one) and carry every existing field
-- forward, not from whichever prior migration happens to be closest at hand.

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
  v_prune_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
  v_pending_vote_proofs bigint;
  v_pending_media_screening bigint;
  v_action_limits bigint;
  v_action_kill boolean;
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
  v_prune_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-vote-proof-moderation-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-screening-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-prune-action-usage')
        into v_rankings_job, v_deletion_job, v_purge_job, v_vote_proof_job,
          v_media_screening_job, v_prune_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
      v_vote_proof_job := false;
      v_media_screening_job := false;
      v_prune_job := false;
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
    'action_usage_prune_job_scheduled', v_prune_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'pending_vote_proof_moderation', v_pending_vote_proofs,
    'pending_media_screening', v_pending_media_screening,
    'action_limits_enabled_rows', v_action_limits,
    'action_kill_switch', coalesce(v_action_kill, false),
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret
      and v_has_vote_proof_secret and v_has_media_screening_secret
      and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job
      and v_vote_proof_job and v_media_screening_job and v_prune_job
      and v_action_limits > 0 and not coalesce(v_action_kill, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
