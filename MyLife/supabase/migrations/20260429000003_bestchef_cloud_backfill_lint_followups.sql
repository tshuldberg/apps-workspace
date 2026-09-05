-- Idempotent follow-ups for local databases that already applied the first
-- BestChef cloud backfill while validating release readiness.

alter table public.bc_comments
  add column if not exists parent_id uuid references public.bc_comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists bc_comments_parent_idx
  on public.bc_comments (parent_id, created_at)
  where parent_id is not null;

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
    and status = 'active';

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

create or replace function public.bc_claim_challenge_reward(p_challenge_id uuid)
returns table (
  reward_claimed_at timestamptz,
  badge_id text,
  newly_awarded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_badge_id text;
  v_completed_at timestamptz;
  v_existing_claim timestamptz;
  v_now timestamptz := now();
  v_newly_awarded boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select e.completed_at, e.reward_claimed_at, c.badge_id
    into v_completed_at, v_existing_claim, v_badge_id
    from public.bc_challenge_enrollments e
    join public.bc_challenges c on c.id = e.challenge_id
   where e.challenge_id = p_challenge_id
     and e.user_id = v_user_id
   limit 1;

  if v_completed_at is null then
    raise exception 'Challenge not yet completed';
  end if;

  if v_existing_claim is not null then
    return query select v_existing_claim, v_badge_id, false;
    return;
  end if;

  update public.bc_challenge_enrollments
     set reward_claimed_at = v_now
   where challenge_id = p_challenge_id
     and user_id = v_user_id;

  if v_badge_id is not null and v_badge_id <> '' then
    select sp.id into v_profile_id
      from public.social_profiles sp
     where sp.user_id = v_user_id
     limit 1;

    if v_profile_id is not null then
      insert into public.bc_chef_badges (profile_id, badge_id, earned_at)
      values (v_profile_id, v_badge_id, v_now)
      on conflict on constraint bc_chef_badges_unique do nothing;

      v_newly_awarded := true;
    end if;
  end if;

  return query select v_now, v_badge_id, v_newly_awarded;
end;
$$;

revoke all on function public.bc_claim_challenge_reward(uuid) from public;
grant execute on function public.bc_claim_challenge_reward(uuid) to authenticated;
