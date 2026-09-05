-- BestChef anonymous vote integrity floor extension (audit C11).
--
-- What this closes, in one migration because the pieces share the vote path:
--   1. Anonymous Supabase accounts could each cast a vote that contributed to
--      vote_score and therefore changed public rankings and leaderboard snapshots.
--      Votes cast while anonymous now remain recorded but never affect scoring.
--   2. The anonymity flag is derived from auth.users by a definer trigger. Client
--      input is ignored on insert, and the cast-time value cannot be changed later.
--   3. Bursts of anonymous votes on one submission and very young anonymous
--      accounts add review signals to the existing vote-proof moderation item.
--      These signals queue context only and never block an otherwise valid vote.

-- ---------------------------------------------------------------------------
-- 1. Durable cast-time anonymity stamp and defensive backfill
-- ---------------------------------------------------------------------------

-- Add the column as nullable first so existing rows can be distinguished from
-- votes stamped after this migration. The final schema is NOT NULL DEFAULT false.
alter table if exists public.bc_votes
  add column if not exists voter_is_anonymous boolean;

-- Resolve every pre-migration vote through its profile and auth user. LEFT JOINs
-- make orphaned profiles or auth rows fall back to false instead of failing.
with resolved_vote_anonymity as (
  select
    v.id,
    coalesce(u.is_anonymous, false) as voter_is_anonymous
  from public.bc_votes v
  left join public.social_profiles sp on sp.id = v.voter_profile_id
  left join auth.users u on u.id = sp.user_id
)
update public.bc_votes v
set voter_is_anonymous = resolved.voter_is_anonymous
from resolved_vote_anonymity resolved
where v.id = resolved.id
  and v.voter_is_anonymous is null;

alter table if exists public.bc_votes
  alter column voter_is_anonymous set default false;

alter table if exists public.bc_votes
  alter column voter_is_anonymous set not null;

create index if not exists bc_votes_anonymous_submission_created_idx
  on public.bc_votes (submission_id, created_at desc)
  where voter_is_anonymous = true;

create or replace function public.bc_stamp_vote_anonymity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_anonymous boolean := false;
begin
  if tg_op = 'UPDATE' then
    -- This is a cast-time fact. Ignore attempts to rewrite it after insertion.
    new.voter_is_anonymous := old.voter_is_anonymous;
    return new;
  end if;

  select coalesce(u.is_anonymous, false)
    into v_is_anonymous
    from public.social_profiles sp
    left join auth.users u on u.id = sp.user_id
   where sp.id = new.voter_profile_id
   limit 1;

  new.voter_is_anonymous := coalesce(v_is_anonymous, false);
  return new;
end;
$$;

revoke all on function public.bc_stamp_vote_anonymity() from public, anon, authenticated;

drop trigger if exists bc_votes_stamp_anonymity_insert on public.bc_votes;
create trigger bc_votes_stamp_anonymity_insert
  before insert on public.bc_votes
  for each row execute function public.bc_stamp_vote_anonymity();

drop trigger if exists bc_votes_preserve_anonymity_update on public.bc_votes;
create trigger bc_votes_preserve_anonymity_update
  before update of voter_is_anonymous on public.bc_votes
  for each row execute function public.bc_stamp_vote_anonymity();

-- ---------------------------------------------------------------------------
-- 2. Ranking score choke point: active non-anonymous votes only
-- ---------------------------------------------------------------------------

create or replace function public.bc_weighted_wilson_score(p_submission_id uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n double precision;
  weighted_sum double precision;
  p_hat double precision;
  z double precision := 1.96;
  z_squared double precision := 3.8416;
  denominator double precision;
  center double precision;
  spread double precision;
begin
  select count(*)::double precision,
    coalesce(sum(case tier
      when 'tap_down' then 0
      when 'bronze' then 1
      when 'like' then 1
      when 'tap_up' then 1
      when 'silver' then 3
      when 'gold' then 5
      else 0
    end), 0)::double precision
  into n, weighted_sum
  from public.bc_votes
  where submission_id = p_submission_id
    and status = 'active'
    and voter_is_anonymous = false;

  if n is null or n = 0 then
    return 0;
  end if;

  p_hat := weighted_sum / (n * 5);
  denominator := 1 + z_squared / n;
  center := p_hat + z_squared / (2 * n);
  spread := z * sqrt((p_hat * (1 - p_hat) + z_squared / (4 * n)) / n);

  return greatest(0, least(1, (center - spread) / denominator));
end;
$$;

-- Re-fire the existing score-refresh trigger once for each affected submission.
-- Filtering to stale scores keeps reruns idempotent and avoids timestamp churn.
with anonymous_vote_submissions as (
  select distinct v.submission_id
  from public.bc_votes v
  where v.voter_is_anonymous = true
),
stale_submission_scores as (
  select affected.submission_id
  from anonymous_vote_submissions affected
  join public.bc_submissions s on s.id = affected.submission_id
  where s.vote_score is distinct from public.bc_weighted_wilson_score(s.id)
),
score_refresh_votes as (
  select distinct on (v.submission_id) v.id
  from public.bc_votes v
  join stale_submission_scores stale on stale.submission_id = v.submission_id
  order by v.submission_id, v.id
)
update public.bc_votes v
set updated_at = v.updated_at
from score_refresh_votes refresh
where v.id = refresh.id;

-- ---------------------------------------------------------------------------
-- 3. bc_cast_vote v5: v4 behavior plus anonymous sybil review signals
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
  v_is_anonymous boolean := false;
  v_account_created_at timestamptz;
  v_recent_anonymous_vote_count integer := 0;
  v_anonymous_vote_burst boolean := false;
  v_young_anonymous_account boolean := false;
  v_anonymous_vote_burst_threshold constant integer := 5;
  v_anonymous_vote_burst_window constant interval := interval '15 minutes';
  v_young_anonymous_account_max_age constant interval := interval '1 hour';
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

  -- Audit C11 signals. Account age is server-owned auth data, and these signals
  -- add moderation context only. They do not reject or delay the vote.
  select coalesce(u.is_anonymous, false), u.created_at
    into v_is_anonymous, v_account_created_at
    from auth.users u
   where u.id = v_user_id;

  v_is_anonymous := coalesce(v_is_anonymous, false);
  v_young_anonymous_account := v_is_anonymous
    and v_account_created_at is not null
    and v_account_created_at > now() - v_young_anonymous_account_max_age;

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

  -- Count after insertion so the threshold includes the current stamped vote.
  select count(*)::integer
    into v_recent_anonymous_vote_count
    from public.bc_votes v
   where v.submission_id = p_submission_id
     and v.voter_is_anonymous = true
     and v.created_at > now() - v_anonymous_vote_burst_window;

  v_anonymous_vote_burst :=
    v_recent_anonymous_vote_count >= v_anonymous_vote_burst_threshold;

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
    || case
         when v_anonymous_vote_burst then jsonb_build_object(
           'anonymous_vote_burst', true,
           'anonymous_vote_burst_count', v_recent_anonymous_vote_count,
           'anonymous_vote_burst_threshold', v_anonymous_vote_burst_threshold,
           'anonymous_vote_burst_window_seconds',
             extract(epoch from v_anonymous_vote_burst_window)::integer
         )
         else '{}'::jsonb
       end
    || case
         when v_young_anonymous_account then jsonb_build_object(
           'young_anonymous_account', true,
           'anonymous_account_age_seconds',
             greatest(0, extract(epoch from (now() - v_account_created_at)))::bigint,
           'young_anonymous_account_max_age_seconds',
             extract(epoch from v_young_anonymous_account_max_age)::integer
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
