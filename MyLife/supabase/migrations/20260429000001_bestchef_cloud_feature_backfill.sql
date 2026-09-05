-- BestChef cloud feature backfill for TestFlight persistence.
--
-- This root migration mirrors active module-level cloud migrations used by
-- the standalone app so production testers do not hit missing tables,
-- columns, queues, or storage buckets.

insert into storage.buckets (id, name, public)
values
  ('bc-avatars', 'bc-avatars', true),
  ('bestchef-submission-images', 'bestchef-submission-images', true),
  ('bestchef-submission-videos', 'bestchef-submission-videos', false),
  ('bestchef-thumbnails', 'bestchef-thumbnails', false),
  ('bestchef-product-evidence', 'bestchef-product-evidence', false),
  ('bestchef-receipt-evidence', 'bestchef-receipt-evidence', false),
  ('bestchef-quarantine', 'bestchef-quarantine', false)
on conflict (id) do update set
  public = excluded.public;

alter table public.social_profiles
  add column if not exists signature_submission_ids uuid[] not null default '{}',
  add column if not exists is_public boolean not null default true,
  add column if not exists cuisine text,
  add column if not exists region text;

create unique index if not exists social_profiles_handle_unique_lower_idx
  on public.social_profiles (lower(handle));

create table if not exists public.bc_handle_history (
  handle text not null,
  released_at timestamptz not null default now(),
  primary key (handle, released_at)
);

alter table public.bc_handle_history enable row level security;

drop policy if exists "bc_handle_history_read" on public.bc_handle_history;
create policy "bc_handle_history_read"
  on public.bc_handle_history for select
  using (true);

create or replace function public.bc_record_handle_release()
returns trigger
language plpgsql
as $$
begin
  if old.handle is not null and old.handle is distinct from new.handle then
    insert into public.bc_handle_history (handle)
    values (lower(old.handle));
  end if;
  return new;
end;
$$;

drop trigger if exists bc_handle_history_t on public.social_profiles;
create trigger bc_handle_history_t
  before update of handle on public.social_profiles
  for each row execute function public.bc_record_handle_release();

create table if not exists public.bc_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'upvote','reviewed_vote','rank_up','rank_milestone','follow',
    'comment','mention','badge','competition','system'
  )),
  category text not null check (category in ('votes','ranks','social','system')),
  title text not null,
  body text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_color text,
  target_type text check (target_type in ('submission','chef','dish','badge','challenge') or target_type is null),
  target_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bc_notifications_user_unread
  on public.bc_notifications (user_id, is_read, created_at desc);

alter table public.bc_notifications enable row level security;

drop policy if exists "bc_notifications_owner_select" on public.bc_notifications;
create policy "bc_notifications_owner_select"
  on public.bc_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "bc_notifications_owner_update" on public.bc_notifications;
create policy "bc_notifications_owner_update"
  on public.bc_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bc_notifications_owner_delete" on public.bc_notifications;
create policy "bc_notifications_owner_delete"
  on public.bc_notifications for delete
  using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.bc_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create table if not exists public.bc_followers (
  follower_id uuid not null references public.social_profiles(id) on delete cascade,
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, chef_id),
  check (follower_id <> chef_id)
);

create index if not exists bc_followers_chef_idx
  on public.bc_followers (chef_id, created_at desc);
create index if not exists bc_followers_follower_idx
  on public.bc_followers (follower_id, created_at desc);

alter table public.bc_followers enable row level security;

drop policy if exists "bc_followers_public_read" on public.bc_followers;
create policy "bc_followers_public_read"
  on public.bc_followers for select
  using (true);

drop policy if exists "bc_followers_owner_insert" on public.bc_followers;
create policy "bc_followers_owner_insert"
  on public.bc_followers for insert
  with check (
    exists (
      select 1 from public.social_profiles p
      where p.id = follower_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "bc_followers_owner_delete" on public.bc_followers;
create policy "bc_followers_owner_delete"
  on public.bc_followers for delete
  using (
    exists (
      select 1 from public.social_profiles p
      where p.id = follower_id
        and p.user_id = auth.uid()
    )
  );

create table if not exists public.bc_rank_history (
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  week date not null,
  rank int not null,
  total_chefs int not null,
  primary key (chef_id, week)
);

alter table public.bc_rank_history enable row level security;

drop policy if exists "bc_rank_history_public_read" on public.bc_rank_history;
create policy "bc_rank_history_public_read"
  on public.bc_rank_history for select
  using (true);

alter table public.bc_submissions
  add column if not exists region text,
  add column if not exists is_restaurant boolean not null default false,
  add column if not exists upvote_count int not null default 0,
  add column if not exists downvote_count int not null default 0,
  add column if not exists reviewed_count int not null default 0,
  add column if not exists tap_count int not null default 0,
  add column if not exists like_count int not null default 0;

create index if not exists bc_submissions_region_idx
  on public.bc_submissions (region)
  where region is not null;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'bc_votes'
       and column_name = 'tier'
       and data_type <> 'text'
  ) then
    alter table public.bc_votes add column if not exists tier_text text;

    update public.bc_votes
       set tier_text = case tier::text
         when '0' then 'like'
         when '1' then 'bronze'
         when '2' then 'silver'
         when '3' then 'gold'
         else 'like'
       end
     where tier_text is null;

    alter table public.bc_votes drop column tier;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'bc_votes'
       and column_name = 'tier'
  ) and exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'bc_votes'
       and column_name = 'tier_text'
  ) then
    alter table public.bc_votes rename column tier_text to tier;
  end if;
end $$;

alter table public.bc_votes
  alter column tier set not null;

alter table public.bc_votes
  drop constraint if exists bc_votes_tier_check;

alter table public.bc_votes
  add constraint bc_votes_tier_check
  check (tier in ('gold', 'silver', 'bronze', 'like', 'tap_up', 'tap_down'));

create or replace function public.bc_submissions_decompose_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 when tg_op = 'DELETE' then -1 else 0 end;
  v_tier text;
  v_sub_id uuid;
begin
  if tg_op = 'INSERT' then
    v_tier := new.tier;
    v_sub_id := new.submission_id;
  elsif tg_op = 'DELETE' then
    v_tier := old.tier;
    v_sub_id := old.submission_id;
  else
    return null;
  end if;

  update public.bc_submissions s set
    upvote_count = upvote_count + (case when v_tier in ('gold','silver','bronze','like','tap_up') then delta else 0 end),
    downvote_count = downvote_count + (case when v_tier = 'tap_down' then delta else 0 end),
    reviewed_count = reviewed_count + (case when v_tier in ('gold','silver','bronze') then delta else 0 end),
    tap_count = tap_count + (case when v_tier in ('tap_up','tap_down') then delta else 0 end)
  where s.id = v_sub_id;

  return null;
end;
$$;

drop trigger if exists bc_votes_decompose on public.bc_votes;
create trigger bc_votes_decompose
  after insert or delete on public.bc_votes
  for each row execute function public.bc_submissions_decompose_counts();

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

create table if not exists public.bc_submission_sync_queue (
  local_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  last_error text,
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bc_submission_sync_queue enable row level security;

drop policy if exists "bc_submission_sync_queue_owner_all" on public.bc_submission_sync_queue;
create policy "bc_submission_sync_queue_owner_all"
  on public.bc_submission_sync_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.bc_dishes
  add column if not exists proposed_by uuid references public.social_profiles(id) on delete set null,
  add column if not exists proposed_at timestamptz;

create index if not exists bc_dishes_pending_idx
  on public.bc_dishes (status)
  where status = 'pending';

alter table public.bc_comments
  add column if not exists parent_id uuid references public.bc_comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists bc_comments_parent_idx
  on public.bc_comments (parent_id, created_at)
  where parent_id is not null;

create table if not exists public.bc_custom_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_overrides jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists bc_custom_themes_user_idx
  on public.bc_custom_themes (user_id, created_at desc);

alter table public.bc_custom_themes enable row level security;

drop policy if exists "bc_custom_themes_owner_all" on public.bc_custom_themes;
create policy "bc_custom_themes_owner_all"
  on public.bc_custom_themes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
  on public.bc_challenges for select
  using (true);

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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bc_challenge_enrollments_public_read" on public.bc_challenge_enrollments;
create policy "bc_challenge_enrollments_public_read"
  on public.bc_challenge_enrollments for select
  using (true);

create index if not exists bc_challenge_enrollments_user_idx
  on public.bc_challenge_enrollments (user_id);
create index if not exists bc_challenge_enrollments_challenge_idx
  on public.bc_challenge_enrollments (challenge_id);

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

create or replace view public.bc_profile_activity_v as
select
  concat('rank:', chef_id::text, ':', week::text) as id,
  chef_id,
  'rank_change'::text as kind,
  'trophy.fill' as icon,
  '#EAB308' as tint,
  concat('Climbed to #', rank) as title,
  concat('Week of ', to_char(week, 'Mon DD')) as subtitle,
  week::timestamptz as occurred_at,
  null::text as target_route
from public.bc_rank_history
where week >= current_date - interval '30 days'
union all
select
  concat('reviewed:', v.id) as id,
  s.profile_id as chef_id,
  'reviewed_vote'::text as kind,
  'checkmark.seal.fill' as icon,
  '#22C55E' as tint,
  concat(initcap(v.tier::text), ' vote received') as title,
  'On your submission' as subtitle,
  v.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier in ('gold', 'silver', 'bronze')
  and v.created_at >= now() - interval '14 days'
union all
select
  concat('follow:', follower_id::text, ':', chef_id::text) as id,
  chef_id,
  'new_follower'::text as kind,
  'person.badge.plus' as icon,
  '#3B82F6' as tint,
  'New follower' as title,
  '' as subtitle,
  created_at as occurred_at,
  null::text as target_route
from public.bc_followers
where created_at >= now() - interval '14 days'
union all
select
  concat('badge:', cb.id) as id,
  cb.profile_id as chef_id,
  'badge'::text as kind,
  'rosette' as icon,
  '#F97316' as tint,
  concat(bd.name, ' unlocked') as title,
  bd.description as subtitle,
  cb.earned_at as occurred_at,
  null::text as target_route
from public.bc_chef_badges cb
join public.bc_badge_definitions bd on bd.id = cb.badge_id
where cb.earned_at >= now() - interval '30 days'
union all
select
  concat('upvotes:', s.id, ':', date_trunc('day', v.created_at)::text) as id,
  s.profile_id as chef_id,
  'upvotes'::text as kind,
  'hand.thumbsup.fill' as icon,
  '#EF4444' as tint,
  concat(count(v.id), ' new upvotes') as title,
  'On your submission' as subtitle,
  max(v.created_at) as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier = 'tap_up'
  and v.created_at >= now() - interval '7 days'
group by s.id, s.profile_id, date_trunc('day', v.created_at)
union all
select
  concat('posted:', s.id) as id,
  s.profile_id as chef_id,
  'posted_recipe'::text as kind,
  'fork.knife' as icon,
  '#A855F7' as tint,
  'Posted a recipe' as title,
  'Entered the competition' as subtitle,
  s.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_submissions s
where s.created_at >= now() - interval '14 days'
  and s.moderation_status = 'approved';

create or replace function public.bc_profile_user_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.social_profiles where id = p_profile_id limit 1
$$;

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
  v_asset public.bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
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

  if not exists (
    select 1
      from public.bc_submissions s
     where s.id = p_submission_id
       and s.moderation_status = 'approved'
  ) then
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

  if exists (
    select 1
      from public.bc_submissions s
     where s.id = p_submission_id
       and s.profile_id = v_profile_id
  ) then
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
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

create or replace function public.bc_notify_upvote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_title text;
  v_sub_title text;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle, 'Someone')
    into v_actor_user_id, v_title
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  select coalesce(r.title, d.name, 'your recipe') into v_sub_title
    from public.bc_submissions s
    join public.bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
    join public.bc_dishes d on d.id = s.dish_id
   where s.id = submission_id;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
  values
    (v_author_user_id, 'upvote', 'votes',
     v_title || ' upvoted your recipe',
     coalesce(v_sub_title, 'your recipe'),
     v_actor_user_id, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_reviewed_vote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_title text;
  v_tier_label text;
begin
  if tier not in ('gold', 'silver', 'bronze') then
    return;
  end if;

  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle, 'Someone')
    into v_actor_user_id, v_title
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  v_tier_label := case tier
    when 'gold' then 'Best Chef'
    when 'silver' then 'As good as momma''s'
    when 'bronze' then 'I''d eat that'
    else tier
  end;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
  values
    (v_author_user_id, 'reviewed_vote', 'votes',
     v_title || ' rated your recipe',
     v_tier_label,
     v_actor_user_id, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_follow(
  follower_id uuid,
  chef_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chef_user_id uuid;
  v_follower_user_id uuid;
  v_name text;
begin
  if follower_id = chef_id then
    return;
  end if;

  select user_id, coalesce(display_name, handle, 'Someone')
    into v_follower_user_id, v_name
    from public.social_profiles
   where id = follower_id;

  select user_id into v_chef_user_id
    from public.social_profiles
   where id = chef_id;

  if v_chef_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, actor_user_id, target_type, target_id)
  values
    (v_chef_user_id, 'follow', 'social',
     v_name || ' started following you',
     v_follower_user_id, 'chef', follower_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_comment(
  submission_id uuid,
  comment_id uuid,
  actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
  v_body text;
  v_parent_id uuid;
  v_parent_author_profile_id uuid;
  v_parent_author_user_id uuid;
  v_handle text;
  v_mention_profile_id uuid;
  v_mention_user_id uuid;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  if v_author_profile_id is null then
    return;
  end if;

  select p.user_id, coalesce(p.display_name, p.handle, 'Someone')
    into v_actor_user_id, v_actor_name
    from public.social_profiles p
   where p.id = actor_id;

  select c.body, c.parent_id
    into v_body, v_parent_id
    from public.bc_comments c
   where c.id = comment_id;

  if v_author_profile_id <> actor_id and v_author_user_id is not null then
    insert into public.bc_notifications
      (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
    values
      (v_author_user_id, 'comment', 'social',
       v_actor_name || ' commented on your recipe',
       left(coalesce(v_body, ''), 120),
       v_actor_user_id, 'submission', submission_id::text);
  end if;

  if v_parent_id is not null then
    select c.profile_id, p.user_id
      into v_parent_author_profile_id, v_parent_author_user_id
      from public.bc_comments c
      join public.social_profiles p on p.id = c.profile_id
     where c.id = v_parent_id;

    if v_parent_author_profile_id is not null
       and v_parent_author_profile_id <> actor_id
       and v_parent_author_profile_id <> v_author_profile_id
       and v_parent_author_user_id is not null then
      insert into public.bc_notifications
        (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
      values
        (v_parent_author_user_id, 'comment', 'social',
         v_actor_name || ' replied to your comment',
         left(coalesce(v_body, ''), 120),
         v_actor_user_id, 'submission', submission_id::text);
    end if;
  end if;

  if v_body is not null then
    for v_handle in
      select distinct (regexp_matches(v_body, '@([A-Za-z0-9_]+)', 'g'))[1]
    loop
      select p.id, p.user_id
        into v_mention_profile_id, v_mention_user_id
        from public.social_profiles p
       where lower(p.handle) = lower(v_handle)
       limit 1;

      if v_mention_profile_id is not null
         and v_mention_profile_id <> actor_id
         and v_mention_user_id is not null then
        insert into public.bc_notifications
          (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
        values
          (v_mention_user_id, 'mention', 'social',
           v_actor_name || ' mentioned you in a comment',
           left(v_body, 120),
           v_actor_user_id, 'submission', submission_id::text);
      end if;
    end loop;
  end if;
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_rank_change(
  chef_id uuid,
  old_rank int,
  new_rank int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_kind text;
  v_title text;
  v_body text;
  v_milestone int;
begin
  if new_rank >= old_rank then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  v_kind := 'rank_up';
  foreach v_milestone in array array[1, 3, 10, 25, 50, 100] loop
    if old_rank > v_milestone and new_rank <= v_milestone then
      v_kind := 'rank_milestone';
      exit;
    end if;
  end loop;

  v_title := case
    when v_kind = 'rank_milestone' then 'You climbed to #' || new_rank || '!'
    else 'You moved up to #' || new_rank
  end;

  v_body := 'Up ' || (old_rank - new_rank) || ' rank' ||
            case when (old_rank - new_rank) > 1 then 's' else '' end ||
            ' this week';

  insert into public.bc_notifications
    (user_id, kind, category, title, body, target_type, target_id)
  values
    (v_user_id, v_kind, 'ranks', v_title, v_body, 'chef', chef_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_badge(
  chef_id uuid,
  badge_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_desc text;
begin
  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  select name, description into v_name, v_desc
    from public.bc_badge_definitions
   where id = badge_id;

  if v_name is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, target_type, target_id)
  values
    (v_user_id, 'badge', 'system',
     v_name || ' unlocked',
     coalesce(v_desc, ''),
     'badge', badge_id);
exception when others then
  null;
end;
$$;

grant execute on function public.bc_notify_upvote(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.bc_notify_reviewed_vote(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.bc_notify_follow(uuid, uuid) to authenticated, service_role;
grant execute on function public.bc_notify_comment(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.bc_notify_rank_change(uuid, int, int) to authenticated, service_role;
grant execute on function public.bc_notify_badge(uuid, text) to authenticated, service_role;
