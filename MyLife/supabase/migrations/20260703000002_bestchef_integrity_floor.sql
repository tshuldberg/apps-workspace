-- BestChef trust/safety integrity floor (plan 33 Phase 1.2 + 1.5, findings N3 + N13).
--
-- What this closes, in one migration because the pieces share the same functions:
--   1. Proof-of-cook dedup was per-submission (unique(submission_id, content_hash)):
--      one staged photo could justify weighted votes on unlimited submissions.
--      Now a durable per-user GLOBAL ledger (bc_proof_hash_ledger) owns dedup, and
--      it survives vote deletion, so delete+recast churn never frees a hash.
--   2. Cross-user hash reuse (vote rings sharing one photo) flags the proof's
--      moderation-queue row instead of passing silently.
--   3. bc_delete_vote was free and unthrottled. Now a durable daily cap, and each
--      delete stamps bc_action_usage with the submission context so bc_cast_vote
--      can enforce a 24h recast cooldown (recasts also re-enter moderation because
--      new votes are always 'proof_pending').
--   4. Votes, comments, reports, follows, likes, and media uploads get durable
--      rate limits through one bc_consume_action_quota() engine in the CHF-1
--      pattern (ledger + caps table + kill switch), enforced server-side inside
--      the write RPCs and BEFORE INSERT triggers -- never in the client. Triggers
--      (not client-visible RPC swaps) keep existing TestFlight clients working.
--   5. Blocks become server-enforced (N13): bc_blocked_between() feeds
--      bc_submission_visible(), the submission/comment read policies, the vote
--      path, the comment path, and the follow path. Previously bc_blocks was
--      client-side filtering only; a blocked user's content stayed API-readable.
--
-- Ops levers (service-role SQL):
--   update bc_action_controls set kill_switch = true;        -- freeze rate-limited social writes
--   update bc_action_limits set max_count = ... where action = '...';
--   select bc_job_health();                                   -- now also reports quota engine state

-- ---------------------------------------------------------------------------
-- 1. Block enforcement helpers + read-side policies (N13)
-- ---------------------------------------------------------------------------

-- True when either profile has blocked the other. SECURITY DEFINER because
-- bc_blocks RLS intentionally hides "who blocked me" from the blocked party;
-- enforcement still needs to see both directions. Not client-callable (a user
-- could otherwise probe "has X blocked me?").
create or replace function public.bc_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when a is null or b is null or a = b then false
    else exists (
      select 1
      from public.bc_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$$;

revoke all on function public.bc_blocked_between(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bc_blocked_between(uuid, uuid) to service_role;

-- v2: block-aware. Owners always see their own rows; admins bypass; everyone
-- else sees approved submissions only when no block exists in either direction
-- between the viewer and the author. Anonymous viewers have no profile, so
-- bc_blocked_between(null, ...) = false and visibility is unchanged for them.
create or replace function public.bc_submission_visible(submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bc_submissions s
    where s.id = submission_id
      and (
        bc_profile_owned(s.profile_id)
        or (
          s.moderation_status = 'approved'
          and (
            bc_is_admin()
            or not public.bc_blocked_between(public.bc_current_profile_id(), s.profile_id)
          )
        )
      )
  );
$$;

-- The base-table read policy must match the helper, or blocked content stays
-- reachable by querying bc_submissions directly.
drop policy if exists "bc_submissions_read" on public.bc_submissions;
create policy "bc_submissions_read" on public.bc_submissions for select using (
  bc_profile_owned(profile_id)
  or (
    moderation_status = 'approved'
    and (
      bc_is_admin()
      or not public.bc_blocked_between(public.bc_current_profile_id(), profile_id)
    )
  )
);

-- Comments: hide a blocked author's comments too (the submission-level check
-- above only covers the submission author).
drop policy if exists "bc_comments_read" on public.bc_comments;
create policy "bc_comments_read" on public.bc_comments for select using (
  bc_profile_owned(profile_id)
  or (
    moderation_status = 'approved'
    and bc_submission_visible(submission_id)
    and (
      bc_is_admin()
      or not public.bc_blocked_between(public.bc_current_profile_id(), profile_id)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Durable action-quota engine (N3, CHF-1 pattern)
-- ---------------------------------------------------------------------------

create table if not exists public.bc_action_limits (
  action text primary key,
  max_count integer not null check (max_count >= 0),
  window_seconds integer not null check (window_seconds > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.bc_action_limits enable row level security;
-- No anon/authenticated policies: service-role/definer only.

insert into public.bc_action_limits (action, max_count, window_seconds) values
  ('vote',         25,  3600),
  ('vote_delete',   5, 86400),
  ('comment',      20,  3600),
  ('report',       20, 86400),
  ('follow',       60,  3600),
  ('like',        200,  3600),
  ('media_upload', 40, 86400)
on conflict (action) do nothing;

create table if not exists public.bc_action_controls (
  id boolean primary key default true check (id),
  kill_switch boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.bc_action_controls (id) values (true) on conflict (id) do nothing;
alter table public.bc_action_controls enable row level security;

-- Usage ledger. FK cascade means account deletion erases a user's action
-- history (GDPR posture matches the rest of the bc_ ledgers).
create table if not exists public.bc_action_usage (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  action text not null,
  context uuid,
  called_at timestamptz not null default now()
);
create index if not exists bc_action_usage_profile_action_idx
  on public.bc_action_usage (profile_id, action, called_at desc);
create index if not exists bc_action_usage_called_at_idx
  on public.bc_action_usage (called_at);
alter table public.bc_action_usage enable row level security;

-- Atomic check-and-log. Denials are not logged (they consume nothing).
-- A missing/disabled bc_action_limits row means "no cap configured": the call
-- is allowed and still logged, so observability survives a deleted config row
-- instead of silently disabling enforcement (the N5 lesson). bc_job_health()
-- reports the seeded-row count so a gap is visible.
create or replace function public.bc_consume_action_quota(
  p_profile_id uuid,
  p_action text,
  p_context uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kill boolean;
  v_max integer;
  v_window integer;
  v_has_limit boolean := false;
  v_count integer;
begin
  if p_profile_id is null or nullif(trim(coalesce(p_action, '')), '') is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  end if;

  select kill_switch into v_kill from public.bc_action_controls where id = true;
  if coalesce(v_kill, false) then
    return jsonb_build_object('allowed', false, 'reason', 'kill_switch');
  end if;

  select max_count, window_seconds into v_max, v_window
  from public.bc_action_limits
  where action = p_action and enabled;
  if found then
    v_has_limit := true;
    select count(*) into v_count
    from public.bc_action_usage
    where profile_id = p_profile_id
      and action = p_action
      and called_at > now() - make_interval(secs => greatest(v_window, 1));
    if v_count >= v_max then
      return jsonb_build_object('allowed', false, 'reason', 'rate_limited');
    end if;
  end if;

  insert into public.bc_action_usage (profile_id, action, context)
  values (p_profile_id, p_action, p_context);
  return jsonb_build_object(
    'allowed', true,
    'reason', case when v_has_limit then 'ok' else 'no_limit' end
  );
end;
$$;

revoke all on function public.bc_consume_action_quota(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.bc_consume_action_quota(uuid, text, uuid) to service_role;

-- Ledger hygiene: nothing reads usage older than the largest window (24h);
-- 35 days keeps a generous forensic tail without unbounded growth.
create or replace function public.bc_prune_action_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bc_action_usage
  where called_at < now() - interval '35 days';
$$;

revoke all on function public.bc_prune_action_usage() from public, anon, authenticated;
grant execute on function public.bc_prune_action_usage() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Per-user global proof-hash ledger (N3)
-- ---------------------------------------------------------------------------

-- One content hash may back at most ONE vote per user, ever, across all
-- submissions. Rows intentionally outlive the vote/proof (vote deletion does
-- not free the hash); account deletion cascades the user's rows away.
create table if not exists public.bc_proof_hash_ledger (
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  content_hash text not null,
  first_vote_id uuid,
  first_submission_id uuid,
  created_at timestamptz not null default now(),
  primary key (profile_id, content_hash)
);
create index if not exists bc_proof_hash_ledger_hash_idx
  on public.bc_proof_hash_ledger (content_hash);
alter table public.bc_proof_hash_ledger enable row level security;
-- No anon/authenticated policies: definer-path only.

-- Backfill from every proof that exists today (any status): hashes already
-- spent stay spent.
insert into public.bc_proof_hash_ledger
  (profile_id, content_hash, first_vote_id, first_submission_id, created_at)
select profile_id, content_hash, vote_id, submission_id, created_at
from public.bc_vote_proofs
on conflict (profile_id, content_hash) do nothing;

-- ---------------------------------------------------------------------------
-- 4. bc_cast_vote v4: block check, recast cooldown, durable quota,
--    global hash dedup, cross-user reuse flag
-- ---------------------------------------------------------------------------

create or replace function public.bc_cast_vote(
  p_submission_id uuid,
  p_tier text,
  p_media_asset_id uuid
) returns table (
  vote_id uuid,
  proof_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_author_profile_id uuid;
  v_asset public.bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
  v_quota jsonb;
  v_hash_reuse integer := 0;
begin
  if v_user_id is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  select id
    into v_profile_id
    from public.social_profiles
   where user_id = v_user_id
   limit 1;

  if v_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'profile_not_found'::text;
    return;
  end if;

  if p_tier not in ('gold', 'silver', 'bronze', 'like') then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text;
    return;
  end if;

  select s.profile_id
    into v_author_profile_id
    from public.bc_submissions s
   where s.id = p_submission_id
     and s.moderation_status = 'approved';

  if v_author_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  -- Server-side block enforcement (N13). Indistinguishable from a missing
  -- submission on purpose: do not reveal blocks.
  if public.bc_blocked_between(v_profile_id, v_author_profile_id) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  select *
    into v_asset
    from public.bc_media_assets
   where id = p_media_asset_id;

  if not found
     or v_asset.owner_profile_id is distinct from v_profile_id
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind <> 'vote_proof'
     or nullif(trim(coalesce(v_asset.content_hash, '')), '') is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text;
    return;
  end if;

  if v_author_profile_id = v_profile_id then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text;
    return;
  end if;

  select id
    into v_existing_vote_id
    from public.bc_votes
   where submission_id = p_submission_id
     and voter_profile_id = v_profile_id
   limit 1;

  if v_existing_vote_id is not null then
    return query select v_existing_vote_id, null::uuid, null::text, 'vote_already_exists'::text;
    return;
  end if;

  -- Recast cooldown: deleting a vote on this submission starts a 24h clock
  -- before a new vote is accepted (and the new vote re-enters moderation as
  -- 'proof_pending' like every vote).
  if exists (
    select 1
    from public.bc_action_usage u
    where u.profile_id = v_profile_id
      and u.action = 'vote_delete'
      and u.context = p_submission_id
      and u.called_at > now() - interval '24 hours'
  ) then
    return query select null::uuid, null::uuid, null::text, 'recast_cooldown'::text;
    return;
  end if;

  -- Durable rate limit, consumed only after all validation passes.
  v_quota := public.bc_consume_action_quota(v_profile_id, 'vote', p_submission_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, null::uuid, null::text, 'rate_limited'::text;
    return;
  end if;

  -- Cross-user reuse count BEFORE we insert our own ledger row.
  select count(*)
    into v_hash_reuse
    from public.bc_proof_hash_ledger l
   where l.content_hash = v_asset.content_hash
     and l.profile_id <> v_profile_id;

  insert into public.bc_votes (
    id,
    submission_id,
    voter_profile_id,
    tier,
    status,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_submission_id,
    v_profile_id,
    p_tier,
    'proof_pending',
    now()
  )
  returning id into v_vote_id;

  -- Per-user GLOBAL dedup: one hash, one vote, ever (N3).
  begin
    insert into public.bc_proof_hash_ledger
      (profile_id, content_hash, first_vote_id, first_submission_id)
    values
      (v_profile_id, v_asset.content_hash, v_vote_id, p_submission_id);
  exception
    when unique_violation then
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  begin
    insert into public.bc_vote_proofs (
      id,
      vote_id,
      submission_id,
      profile_id,
      media_asset_id,
      content_hash,
      status
    )
    values (
      gen_random_uuid(),
      v_vote_id,
      p_submission_id,
      v_profile_id,
      p_media_asset_id,
      v_asset.content_hash,
      'pending'
    )
    returning id into v_proof_id;
  exception
    when unique_violation then
      -- (submission_id, content_hash) collision: another user already used
      -- this exact photo on this submission. Roll our rows back.
      delete from public.bc_proof_hash_ledger
       where profile_id = v_profile_id
         and content_hash = v_asset.content_hash
         and first_vote_id = v_vote_id;
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  insert into public.bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    'vote_proof',
    v_proof_id,
    v_profile_id,
    'queued',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'media_asset_id', p_media_asset_id
    )
    || case
         when v_hash_reuse > 0 then jsonb_build_object(
           'cross_user_hash_reuse', true,
           'hash_reuse_other_profiles', v_hash_reuse
         )
         else '{}'::jsonb
       end
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. bc_delete_vote v3: durable daily throttle + recast-cooldown stamp
-- ---------------------------------------------------------------------------

create or replace function public.bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_media_asset_id uuid;
  v_deleted_at timestamptz := now();
  v_max integer;
  v_window integer;
  v_recent integer;
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  -- Durable throttle (N3). Checked manually (not bc_consume_action_quota)
  -- because usage must be stamped only when a vote actually gets deleted, and
  -- the kill switch must not stop users removing their own content.
  select max_count, window_seconds into v_max, v_window
  from public.bc_action_limits
  where action = 'vote_delete' and enabled;
  if found then
    select count(*) into v_recent
    from public.bc_action_usage
    where profile_id = v_profile_id
      and action = 'vote_delete'
      and called_at > now() - make_interval(secs => greatest(v_window, 1));
    if v_recent >= v_max then
      raise exception 'vote_delete_rate_limited';
    end if;
  end if;

  select p.media_asset_id
  into v_media_asset_id
  from bc_votes v
  join bc_vote_proofs p on p.vote_id = v.id
  where v.submission_id = p_submission_id
    and v.voter_profile_id = v_profile_id
  limit 1;

  delete from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id;
  get diagnostics v_deleted = row_count;

  -- Stamp only real deletions: powers both the daily cap and the 24h recast
  -- cooldown in bc_cast_vote. The hash stays spent in bc_proof_hash_ledger.
  if v_deleted > 0 then
    insert into public.bc_action_usage (profile_id, action, context)
    values (v_profile_id, 'vote_delete', p_submission_id);
  end if;

  if v_media_asset_id is not null then
    update bc_media_assets
    set upload_status = 'deleted',
        moderation_status = 'rejected',
        visibility = 'private',
        metadata = metadata || jsonb_build_object(
          'deleted_by', 'bc_delete_vote',
          'deleted_at', v_deleted_at,
          'deletion_reason', 'user_deleted_vote',
          'storage_purge', 'pending_server_worker'
        ),
        updated_at = v_deleted_at
    where id = v_media_asset_id
      and owner_profile_id = v_profile_id
      and owner_kind = 'vote_proof';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Enforcement triggers on the remaining write paths
--    (triggers, not RPC swaps: every path is covered, including the direct
--    table writes existing TestFlight clients already ship.)
-- ---------------------------------------------------------------------------

-- Generic quota trigger: tg_argv[0] = action, tg_argv[1] = profile-id column.
create or replace function public.bc_enforce_action_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := tg_argv[0];
  v_profile_id uuid;
  v_quota jsonb;
begin
  -- Server contexts (migrations, workers) and admins bypass.
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;
  v_profile_id := (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v_profile_id is null then
    return new;
  end if;
  v_quota := public.bc_consume_action_quota(v_profile_id, v_action, null);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = v_action,
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;
  return new;
end;
$$;

-- Comments need more than a cap: the submission must be approved and visible
-- to the commenter, blocks must hold (N13), and threaded replies must stay on
-- their own submission.
create or replace function public.bc_comments_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_quota jsonb;
begin
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;

  select s.profile_id
    into v_author_profile_id
    from public.bc_submissions s
   where s.id = new.submission_id
     and s.moderation_status = 'approved';

  if v_author_profile_id is null then
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if public.bc_blocked_between(new.profile_id, v_author_profile_id) then
    -- Indistinguishable from a missing submission: do not reveal blocks.
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if new.parent_id is not null and not exists (
    select 1
    from public.bc_comments c
    where c.id = new.parent_id
      and c.submission_id = new.submission_id
  ) then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;

  v_quota := public.bc_consume_action_quota(new.profile_id, 'comment', new.submission_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = 'comment',
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;

  return new;
end;
$$;

-- Follows: social_follows is suite-shared, but BestChef is the only public
-- social surface; the cap is generous and admins/server contexts bypass.
-- Also block-enforced: you cannot follow across a block in either direction.
create or replace function public.bc_social_follows_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota jsonb;
begin
  if auth.uid() is null or bc_is_admin() then
    return new;
  end if;

  if public.bc_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  v_quota := public.bc_consume_action_quota(new.follower_id, 'follow', new.followee_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    raise exception 'rate_limited' using
      errcode = 'P0001',
      detail = 'follow',
      hint = coalesce(v_quota ->> 'reason', 'rate_limited');
  end if;

  return new;
end;
$$;

drop trigger if exists bc_comments_integrity_gate on public.bc_comments;
create trigger bc_comments_integrity_gate
  before insert on public.bc_comments
  for each row execute function public.bc_comments_enforce_integrity();

drop trigger if exists bc_flags_action_quota on public.bc_flags;
create trigger bc_flags_action_quota
  before insert on public.bc_flags
  for each row execute function public.bc_enforce_action_quota('report', 'flagger_id');

drop trigger if exists bc_submission_likes_action_quota on public.bc_submission_likes;
create trigger bc_submission_likes_action_quota
  before insert on public.bc_submission_likes
  for each row execute function public.bc_enforce_action_quota('like', 'profile_id');

drop trigger if exists bc_photo_reports_action_quota on public.bc_photo_reports;
create trigger bc_photo_reports_action_quota
  before insert on public.bc_photo_reports
  for each row execute function public.bc_enforce_action_quota('report', 'reporter_id');

drop trigger if exists bc_comment_helpful_action_quota on public.bc_comment_helpful;
create trigger bc_comment_helpful_action_quota
  before insert on public.bc_comment_helpful
  for each row execute function public.bc_enforce_action_quota('like', 'voter_profile_id');

drop trigger if exists bc_social_follows_gate on public.social_follows;
create trigger bc_social_follows_gate
  before insert on public.social_follows
  for each row execute function public.bc_social_follows_enforce();

-- ---------------------------------------------------------------------------
-- 7. Ledger prune job + job-health v2 (quota engine observability)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'bestchef-prune-action-usage',
      '41 3 * * *',
      $job$select public.bc_prune_action_usage();$job$
    );
  else
    raise notice 'pg_cron not installed: bestchef-prune-action-usage not scheduled.';
  end if;
exception when others then
  raise notice 'BestChef prune job scheduling skipped: %', sqlerrm;
end $$;

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
  v_prune_job boolean;
  v_last_rankings_update timestamptz;
  v_pending_deletions bigint;
  v_oldest_pending timestamptz;
  v_action_limits bigint;
  v_action_kill boolean;
begin
  select exists (select 1 from public.bc_job_config where key = 'functions_base_url')
    into v_has_url;
  select exists (select 1 from public.bc_job_config where key = 'account_deletion_worker_secret')
    into v_has_secret;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_pg_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into v_pg_net;

  v_rankings_job := false;
  v_deletion_job := false;
  v_prune_job := false;
  if v_pg_cron then
    begin
      select
        exists (select 1 from cron.job where jobname = 'bestchef-rebuild-rankings'),
        exists (select 1 from cron.job where jobname = 'bestchef-account-deletion-worker'),
        exists (select 1 from cron.job where jobname = 'bestchef-prune-action-usage')
        into v_rankings_job, v_deletion_job, v_prune_job;
    exception when others then
      -- cron schema unreadable: report unscheduled rather than erroring out.
      v_rankings_job := false;
      v_deletion_job := false;
      v_prune_job := false;
    end;
  end if;

  select max(updated_at) from public.bc_rankings into v_last_rankings_update;

  select count(*), min(requested_at)
    from public.bc_account_deletion_requests
    where status in ('requested', 'processing')
    into v_pending_deletions, v_oldest_pending;

  select count(*) from public.bc_action_limits where enabled into v_action_limits;
  select kill_switch from public.bc_action_controls where id = true into v_action_kill;

  return jsonb_build_object(
    'config_functions_base_url', v_has_url,
    'config_worker_secret', v_has_secret,
    'pg_cron_installed', v_pg_cron,
    'pg_net_installed', v_pg_net,
    'rankings_job_scheduled', v_rankings_job,
    'deletion_job_scheduled', v_deletion_job,
    'action_usage_prune_job_scheduled', v_prune_job,
    'last_rankings_update', v_last_rankings_update,
    'pending_deletion_requests', v_pending_deletions,
    'oldest_pending_deletion_requested_at', v_oldest_pending,
    'action_limits_enabled_rows', v_action_limits,
    'action_kill_switch', coalesce(v_action_kill, false),
    'healthy',
      v_has_url and v_has_secret and v_pg_cron and v_pg_net
      and v_rankings_job and v_deletion_job and v_prune_job
      and v_action_limits > 0 and not coalesce(v_action_kill, false),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.bc_job_health() from public, anon, authenticated;
grant execute on function public.bc_job_health() to service_role;
