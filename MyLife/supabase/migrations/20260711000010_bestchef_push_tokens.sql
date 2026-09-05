-- BestChef push notifications: token registry + outbox fanout (audit H13).
--
-- BestChef ships a full in-app typed-notification system (bc_notifications
-- rows carrying kind + params, localized client-side from the i18n catalogs)
-- but ZERO push: nothing leaves the server, so a user learns nothing until
-- they next open the app. A rank change, a DSA statement-of-reasons notice, or
-- an appeal outcome can sit unseen for days. This migration adds the durable
-- server-side half of the push pipeline:
--
--   * bc_push_tokens        one row per (user, device token). Owner-only RLS.
--                           Carries the device locale captured at registration
--                           so the fanout worker can render push copy in the
--                           user's language WITHOUT the device being reachable.
--   * bc_push_outbox        durable fanout queue. A definer-only trigger on
--                           bc_notifications enqueues one outbox row per
--                           FLAGSHIP notification (see FLAGSHIP_KINDS below).
--                           The bestchef-push-fanout worker drains it, renders
--                           localized title/body server-side, and sends via the
--                           Expo push service. No RLS grants to end users: the
--                           outbox is server-plumbing, never client-readable.
--   * bc_run_push_fanout_worker + pg_cron schedule to invoke the edge worker.
--
-- LOCALIZATION DECISION (documented for the next editor): push copy is rendered
-- AT SEND, server-side, from kind + params, using the locale stored on the
-- token row. The in-app system localizes at render because the client owns the
-- catalogs; push cannot, because the device may be asleep or offline when the
-- notification fires. So registration (which knows the device locale) stamps
-- bc_push_tokens.locale, and the worker renders from a compact server-side copy
-- map for the flagship kinds, falling back to a localized generic title for any
-- other enqueued kind. Visible localized pushes, never silent data pushes: the
-- whole point is the user learns something actionable with the app closed.
--
-- FLAGSHIP KINDS: rank_up, rank_milestone (the plan's flagship: a rank climb is
-- the single most time-sensitive, re-engagement-driving event), plus
-- moderation_decision and appeal_resolved (DSA Art. 17/20 statements of reasons
-- matter and the user must see them). Everything else stays in-app only for
-- now; widening the flagship set is a one-line change to the trigger's kind
-- filter here plus a copy entry in the worker.
--
-- Ordering: lands after 20260711000009 (url-resign job). This migration's copy
-- of bc_job_health() starts from that latest version and carries EVERY existing
-- field forward, adding only the push-fanout fields (see the drift-history
-- warning in 000008/000009: never start bc_job_health() from an older copy).

-- ── bc_push_tokens: owner-scoped device token registry ────────────────────

create table if not exists public.bc_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  -- Locale captured from the device at registration (a normalized BestChef
  -- language tag, e.g. 'en', 'pt-BR', 'zh-Hans'). The fanout worker renders
  -- push copy from this, falling back to 'en' for anything unrecognized.
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.bc_push_tokens is
  'Expo push tokens per user device (audit H13). Owner-only RLS. locale is the '
  'device language captured at registration; bestchef-push-fanout renders push '
  'copy server-side from it so the device need not be reachable.';

create index if not exists bc_push_tokens_user_idx
  on public.bc_push_tokens (user_id);

-- Keep updated_at honest on every UPDATE.
create or replace function public.bc_push_tokens_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bc_push_tokens_touch on public.bc_push_tokens;
create trigger bc_push_tokens_touch
  before update on public.bc_push_tokens
  for each row execute function public.bc_push_tokens_set_updated_at();

alter table public.bc_push_tokens enable row level security;

-- Owner-only: a user sees and manages only their own device tokens. Tokens
-- unique globally, but a token that moves to a new account (device re-signed-in)
-- is re-owned via the registration RPC below, which deletes stale ownership.
drop policy if exists bc_push_tokens_select_own on public.bc_push_tokens;
create policy bc_push_tokens_select_own on public.bc_push_tokens
  for select using (user_id = auth.uid());

drop policy if exists bc_push_tokens_insert_own on public.bc_push_tokens;
create policy bc_push_tokens_insert_own on public.bc_push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists bc_push_tokens_update_own on public.bc_push_tokens;
create policy bc_push_tokens_update_own on public.bc_push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists bc_push_tokens_delete_own on public.bc_push_tokens;
create policy bc_push_tokens_delete_own on public.bc_push_tokens
  for delete using (user_id = auth.uid());

-- ── Registration RPC: upsert a token, re-owning it if it moved devices ────
-- The client calls this instead of a raw insert so a token that was previously
-- registered to a DIFFERENT user (same physical device, new sign-in) is cleanly
-- re-owned rather than colliding on the unique(token) constraint. security
-- definer so it can delete the stale row regardless of who owned it; still
-- gated on auth.uid() being the caller.

create or replace function public.bc_register_push_token(
  p_token text,
  p_platform text default 'ios',
  p_locale text default 'en'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_platform text := lower(trim(coalesce(p_platform, 'ios')));
  v_locale text := coalesce(nullif(trim(p_locale), ''), 'en');
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token required';
  end if;
  if v_platform not in ('ios', 'android') then
    v_platform := 'ios';
  end if;

  -- Re-own: drop any prior registration of this exact token by another user
  -- (device signed into a new account). The unique(token) constraint otherwise
  -- rejects the upsert.
  delete from public.bc_push_tokens
   where token = trim(p_token) and user_id <> v_user;

  insert into public.bc_push_tokens (user_id, token, platform, locale, last_seen_at)
  values (v_user, trim(p_token), v_platform, v_locale, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        locale = excluded.locale,
        last_seen_at = now();
end;
$$;

revoke all on function public.bc_register_push_token(text, text, text) from public, anon;
grant execute on function public.bc_register_push_token(text, text, text) to authenticated;

-- Unregister a single token (settings toggle OFF / sign-out). Owner-scoped.
create or replace function public.bc_unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  delete from public.bc_push_tokens
   where token = trim(coalesce(p_token, '')) and user_id = v_user;
end;
$$;

revoke all on function public.bc_unregister_push_token(text) from public, anon;
grant execute on function public.bc_unregister_push_token(text) to authenticated;

-- ── bc_push_outbox: durable fanout queue (server-only) ────────────────────

create table if not exists public.bc_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.bc_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}'::jsonb,
  target_type text,
  target_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.bc_push_outbox is
  'Durable push-fanout queue (audit H13). A definer-only trigger on '
  'bc_notifications enqueues one row per flagship notification. '
  'bestchef-push-fanout drains it. Server-plumbing: NO RLS grants to end users.';

-- Drain index: the worker pulls oldest queued rows first, bounded retries.
create index if not exists bc_push_outbox_drain_idx
  on public.bc_push_outbox (status, created_at)
  where status in ('queued', 'failed');

alter table public.bc_push_outbox enable row level security;
-- No policies: RLS enabled with zero policies denies all end-user access.
-- Only the service role (which bypasses RLS) and the definer trigger touch it.

-- Flagship kinds that fan out to push. Kept as a SQL function so the trigger
-- and any future consumer share one source of truth.
create or replace function public.bc_push_is_flagship_kind(p_kind text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_kind in ('rank_up', 'rank_milestone', 'moderation_decision', 'appeal_resolved');
$$;

-- ── Enqueue trigger: one hook for every notification insert path ──────────
-- An AFTER INSERT trigger captures EVERY bc_notifications insert path (upvote,
-- rank, moderation, appeal, and any future bc_notify_* function) uniformly,
-- without editing each fanout function. Only flagship kinds enqueue. Wrapped so
-- a push-queue failure never aborts the notification insert itself (the in-app
-- notification is the source of truth; push is best-effort delivery).

create or replace function public.bc_enqueue_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.bc_push_is_flagship_kind(new.kind) then
    insert into public.bc_push_outbox
      (notification_id, user_id, kind, params, target_type, target_id)
    values
      (new.id, new.user_id, new.kind, coalesce(new.params, '{}'::jsonb),
       new.target_type, new.target_id);
  end if;
  return new;
exception when others then
  -- Never let a push-queue failure roll back the notification.
  raise notice 'bc_enqueue_push_on_notification: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists bc_notifications_enqueue_push on public.bc_notifications;
create trigger bc_notifications_enqueue_push
  after insert on public.bc_notifications
  for each row execute function public.bc_enqueue_push_on_notification();

-- ── Worker scheduling ─────────────────────────────────────────────────────
-- Invoke the push-fanout worker. Quiet no-op when unconfigured, when the outbox
-- is empty, or when pg_net is missing. Mirrors bc_run_url_resign_worker etc.

create or replace function public.bc_run_push_fanout_worker()
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
  select value into v_secret from public.bc_job_config where key = 'push_fanout_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.bc_push_outbox
  where status in ('queued', 'failed') and attempts < 5;
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/bestchef-push-fanout',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BestChef-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'bc_run_push_fanout_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.bc_run_push_fanout_worker() from public, anon, authenticated;
grant execute on function public.bc_run_push_fanout_worker() to service_role;

-- Every 2 minutes: push must feel prompt, and the worker is a cheap no-op when
-- the outbox is empty. pg_net's async POST returns immediately.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-push-fanout-worker',
      '*/2 * * * *',
      $job$select public.bc_run_push_fanout_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: BestChef push-fanout worker job not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'BestChef push-fanout worker job scheduling skipped: %', sqlerrm;
end $$;

-- ── bc_job_health(): carry every existing field forward, add push fanout ──
-- Starts from 20260711000009 (the latest, most complete version) and adds only
-- the push-fanout fields. FUTURE editors: start from THIS version, never older.

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
  v_has_push_fanout_secret boolean;
  v_pg_cron boolean;
  v_pg_net boolean;
  v_rankings_job boolean;
  v_deletion_job boolean;
  v_purge_job boolean;
  v_vote_proof_job boolean;
  v_media_screening_job boolean;
  v_prune_job boolean;
  v_url_resign_job boolean;
  v_push_fanout_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_purgeable_media bigint;
  v_pending_vote_proofs bigint;
  v_pending_media_screening bigint;
  v_action_limits bigint;
  v_action_kill boolean;
  v_expiring_playback_urls bigint;
  v_pending_push bigint;
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
  select exists (select 1 from public.bc_job_config where key = 'push_fanout_worker_secret')
    into v_has_push_fanout_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_purge_job := false;
  v_vote_proof_job := false;
  v_media_screening_job := false;
  v_prune_job := false;
  v_url_resign_job := false;
  v_push_fanout_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-purge-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-vote-proof-moderation-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-media-screening-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-prune-action-usage'),
        exists (select 1 from cron.job where jobname = 'bestchef-url-resign-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-push-fanout-worker')
        into v_rankings_job, v_deletion_job, v_purge_job, v_vote_proof_job,
          v_media_screening_job, v_prune_job, v_url_resign_job, v_push_fanout_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
      v_purge_job := false;
      v_vote_proof_job := false;
      v_media_screening_job := false;
      v_prune_job := false;
      v_url_resign_job := false;
      v_push_fanout_job := false;
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

  -- Mirrors bc_run_push_fanout_worker's candidate filter (audit H13).
  select count(*)
    from public.bc_push_outbox
    where status in ('queued', 'failed') and attempts < 5
    into v_pending_push;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'config_media_purge_secret', v_has_purge_secret,
    'config_vote_proof_moderation_secret', v_has_vote_proof_secret,
    'config_media_screening_secret', v_has_media_screening_secret,
    'config_url_resign_secret', v_has_url_resign_secret,
    'config_push_fanout_secret', v_has_push_fanout_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'media_purge_job_scheduled', v_purge_job,
    'vote_proof_moderation_job_scheduled', v_vote_proof_job,
    'media_screening_job_scheduled', v_media_screening_job,
    'action_usage_prune_job_scheduled', v_prune_job,
    'url_resign_job_scheduled', v_url_resign_job,
    'push_fanout_job_scheduled', v_push_fanout_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'purgeable_media_rows', v_purgeable_media,
    'pending_vote_proof_moderation', v_pending_vote_proofs,
    'pending_media_screening', v_pending_media_screening,
    'action_limits_enabled_rows', v_action_limits,
    'action_kill_switch', coalesce(v_action_kill, false),
    'expiring_playback_urls', v_expiring_playback_urls,
    'pending_push_fanout', v_pending_push,
    'healthy',
      v_has_url and v_has_secret and v_has_purge_secret
      and v_has_vote_proof_secret and v_has_media_screening_secret
      and v_has_url_resign_secret and v_has_push_fanout_secret
      and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_purge_job
      and v_vote_proof_job and v_media_screening_job and v_prune_job
      and v_url_resign_job and v_push_fanout_job
      and v_action_limits > 0 and not coalesce(v_action_kill, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
