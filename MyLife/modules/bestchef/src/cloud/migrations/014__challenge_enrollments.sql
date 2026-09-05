-- P13-E (F-012, F-013, B-009): Challenges interactive cards + reward redemption.
--
-- Adds the bc_challenges catalog (server-of-record for live challenges) and
-- bc_challenge_enrollments (per-user join + completion + claim state). Also
-- ships an idempotent SECURITY DEFINER RPC bc_claim_challenge_reward that
-- stamps reward_claimed_at and inserts the badge defined by the challenge.
--
-- Idempotent: every CREATE uses IF NOT EXISTS, policies drop-then-create.

-- ── bc_challenges ────────────────────────────────────────────────────
-- Live challenge instances (one row per active/closed challenge run).
create table if not exists public.bc_challenges (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  title text not null,
  description text not null default '',
  reward text not null default '',
  badge_id text,
  metric text not null default 'submissions',
  target_count integer not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  claim_deadline timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  constraint bc_challenges_target_positive check (target_count > 0)
);

create index if not exists bc_challenges_status_idx
  on public.bc_challenges (status);
create index if not exists bc_challenges_ends_at_idx
  on public.bc_challenges (ends_at);

alter table public.bc_challenges enable row level security;

drop policy if exists "bc_challenges_public_read" on public.bc_challenges;
create policy "bc_challenges_public_read"
  on public.bc_challenges for select using (true);

-- ── bc_challenge_enrollments ─────────────────────────────────────────
-- One row per (challenge, user). Tracks join, completion, claim.
create table if not exists public.bc_challenge_enrollments (
  challenge_id uuid not null references public.bc_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  reward_claimed_at timestamptz,
  primary key (challenge_id, user_id)
);

alter table public.bc_challenge_enrollments enable row level security;

drop policy if exists "bc_challenge_enrollments_owner_all" on public.bc_challenge_enrollments;
create policy "bc_challenge_enrollments_owner_all"
  on public.bc_challenge_enrollments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bc_challenge_enrollments_public_read" on public.bc_challenge_enrollments;
create policy "bc_challenge_enrollments_public_read"
  on public.bc_challenge_enrollments for select using (true);

create index if not exists bc_challenge_enrollments_user_idx
  on public.bc_challenge_enrollments (user_id);
create index if not exists bc_challenge_enrollments_challenge_idx
  on public.bc_challenge_enrollments (challenge_id);

-- ── bc_claim_challenge_reward RPC ────────────────────────────────────
-- Idempotent claim. Stamps reward_claimed_at and inserts the badge defined
-- by the challenge (if any) into bc_chef_badges. Subsequent calls are no-ops.
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

  -- Confirm enrollment exists and is complete.
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

  -- Already claimed: idempotent return.
  if v_existing_claim is not null then
    return query select v_existing_claim, v_badge_id, false;
    return;
  end if;

  -- Stamp the claim.
  update public.bc_challenge_enrollments
     set reward_claimed_at = v_now
   where challenge_id = p_challenge_id
     and user_id = v_user_id;

  -- Award the badge if one is defined and the user does not have it.
  if v_badge_id is not null and v_badge_id <> '' then
    select sp.id into v_profile_id
      from public.social_profiles sp
     where sp.user_id = v_user_id
     limit 1;

    if v_profile_id is not null then
      insert into public.bc_chef_badges (profile_id, badge_id, earned_at)
      values (v_profile_id, v_badge_id, v_now)
      on conflict (profile_id, badge_id) do nothing;

      v_newly_awarded := true;
    end if;
  end if;

  return query select v_now, v_badge_id, v_newly_awarded;
end;
$$;

revoke all on function public.bc_claim_challenge_reward(uuid) from public;
grant execute on function public.bc_claim_challenge_reward(uuid) to authenticated;
