-- ============================================================================
-- @mylife/social -- Supabase migration for social/community tables
--
-- Privacy-first: social features are entirely opt-in. No social tables are
-- created per-user until they explicitly create a profile.
--
-- All tables use Row-Level Security (RLS) to enforce visibility and ownership.
-- ============================================================================

-- ── Social Profiles ─────────────────────────────────────────────────────

create table if not exists social_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  handle        text not null,
  display_name  text not null,
  bio           text,
  avatar_url    text,
  privacy_settings jsonb not null default '{
    "discoverable": false,
    "showModules": false,
    "showStreaks": false,
    "openFollows": false,
    "moduleSettings": []
  }'::jsonb,
  follower_count  integer not null default 0,
  following_count integer not null default 0,
  enabled_modules text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint social_profiles_handle_unique unique (handle),
  constraint social_profiles_user_id_unique unique (user_id),
  constraint social_profiles_handle_format check (handle ~ '^[a-z0-9_]{3,30}$'),
  constraint social_profiles_display_name_length check (char_length(display_name) between 1 and 64),
  constraint social_profiles_bio_length check (bio is null or char_length(bio) <= 280)
);

create index social_profiles_handle_idx on social_profiles (handle);
create index social_profiles_user_id_idx on social_profiles (user_id);

alter table social_profiles enable row level security;

-- Anyone can read public profiles (discoverable = true)
create policy "Public profiles are viewable"
  on social_profiles for select
  using (
    (privacy_settings->>'discoverable')::boolean = true
    or user_id = auth.uid()
  );

-- Users can only insert/update/delete their own profile
create policy "Users manage own profile"
  on social_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── Secure Friend Links & Friendships ────────────────────────────────

create table if not exists social_friend_links (
  id                 uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references social_profiles(id) on delete cascade,
  friend_profile_id  uuid references social_profiles(id) on delete set null,
  code_hash          text not null,
  code_hint          text not null,
  note               text,
  status             text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at         timestamptz,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint social_friend_links_code_hash_unique unique (code_hash),
  constraint social_friend_links_no_self check (
    friend_profile_id is null or creator_profile_id != friend_profile_id
  ),
  constraint social_friend_links_note_length check (note is null or char_length(note) <= 200)
);

create index social_friend_links_creator_idx on social_friend_links (creator_profile_id, created_at desc);
create index social_friend_links_friend_idx on social_friend_links (friend_profile_id, created_at desc);
create index social_friend_links_status_idx on social_friend_links (status, created_at desc);

alter table social_friend_links enable row level security;

create policy "Users see own friend links"
  on social_friend_links for select
  using (
    creator_profile_id in (select id from social_profiles where user_id = auth.uid())
    or friend_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Users create own friend links"
  on social_friend_links for insert
  with check (
    creator_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Creators manage own friend links"
  on social_friend_links for update
  using (
    creator_profile_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    creator_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Creators delete own friend links"
  on social_friend_links for delete
  using (
    creator_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create table if not exists social_friendships (
  id                    uuid primary key default gen_random_uuid(),
  profile_a_id          uuid not null references social_profiles(id) on delete cascade,
  profile_b_id          uuid not null references social_profiles(id) on delete cascade,
  created_by_profile_id uuid not null references social_profiles(id) on delete cascade,
  source_link_id        uuid references social_friend_links(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint social_friendships_no_self check (profile_a_id != profile_b_id)
);

create unique index social_friendships_pair_unique_idx
  on social_friendships (
    least(profile_a_id::text, profile_b_id::text),
    greatest(profile_a_id::text, profile_b_id::text)
  );

create index social_friendships_profile_a_idx on social_friendships (profile_a_id, created_at desc);
create index social_friendships_profile_b_idx on social_friendships (profile_b_id, created_at desc);

alter table social_friendships enable row level security;

create policy "Users see own friendships"
  on social_friendships for select
  using (
    profile_a_id in (select id from social_profiles where user_id = auth.uid())
    or profile_b_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Users delete own friendships"
  on social_friendships for delete
  using (
    profile_a_id in (select id from social_profiles where user_id = auth.uid())
    or profile_b_id in (select id from social_profiles where user_id = auth.uid())
  );

create or replace function social_confirm_friend_link(
  link_code_hash text,
  claimant_profile_id uuid
)
returns jsonb as $$
declare
  target_link social_friend_links%rowtype;
  existing_friendship social_friendships%rowtype;
  confirmed_friendship social_friendships%rowtype;
  low_profile uuid;
  high_profile uuid;
begin
  if claimant_profile_id is null then
    raise exception 'claimant_profile_id is required';
  end if;

  if not exists (
    select 1
    from social_profiles
    where id = claimant_profile_id
      and user_id = auth.uid()
  ) then
    raise exception 'Not authorized to redeem this friend link';
  end if;

  select *
  into target_link
  from social_friend_links
  where code_hash = link_code_hash
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  limit 1
  for update;

  if not found then
    return null;
  end if;

  if target_link.creator_profile_id = claimant_profile_id then
    raise exception 'Cannot redeem your own friend link';
  end if;

  low_profile := least(target_link.creator_profile_id::text, claimant_profile_id::text)::uuid;
  high_profile := greatest(target_link.creator_profile_id::text, claimant_profile_id::text)::uuid;

  select *
  into existing_friendship
  from social_friendships
  where least(profile_a_id::text, profile_b_id::text) = low_profile::text
    and greatest(profile_a_id::text, profile_b_id::text) = high_profile::text
  limit 1;

  if found then
    confirmed_friendship := existing_friendship;
  else
    insert into social_friendships (
      profile_a_id,
      profile_b_id,
      created_by_profile_id,
      source_link_id
    )
    values (
      low_profile,
      high_profile,
      claimant_profile_id,
      target_link.id
    )
    returning * into confirmed_friendship;
  end if;

  update social_friend_links
  set friend_profile_id = claimant_profile_id,
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now()),
      updated_at = now()
  where id = target_link.id;

  insert into social_follows (follower_id, followee_id, status)
  values (target_link.creator_profile_id, claimant_profile_id, 'active')
  on conflict (follower_id, followee_id) do update
    set status = 'active';

  insert into social_follows (follower_id, followee_id, status)
  values (claimant_profile_id, target_link.creator_profile_id, 'active')
  on conflict (follower_id, followee_id) do update
    set status = 'active';

  return to_jsonb(confirmed_friendship);
end;
$$ language plpgsql security definer;


-- ── Follows ─────────────────────────────────────────────────────────────

create table if not exists social_follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references social_profiles(id) on delete cascade,
  followee_id  uuid not null references social_profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('active', 'pending')),
  created_at   timestamptz not null default now(),

  constraint social_follows_unique unique (follower_id, followee_id),
  constraint social_follows_no_self check (follower_id != followee_id)
);

create index social_follows_follower_idx on social_follows (follower_id);
create index social_follows_followee_idx on social_follows (followee_id);

alter table social_follows enable row level security;

-- Followers can see their own follow records; followees can see pending requests
create policy "Users see own follows"
  on social_follows for select
  using (
    follower_id in (select id from social_profiles where user_id = auth.uid())
    or followee_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users can create follows from their own profile
create policy "Users create own follows"
  on social_follows for insert
  with check (
    follower_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users can delete their own follows (unfollow) or reject pending requests
create policy "Users manage own follows"
  on social_follows for delete
  using (
    follower_id in (select id from social_profiles where user_id = auth.uid())
    or followee_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Followees can update status (accept/reject pending)
create policy "Followees accept follows"
  on social_follows for update
  using (
    followee_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    followee_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Activities (Feed Items) ────────────────────────────────────────────

create table if not exists social_activities (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references social_profiles(id) on delete cascade,
  module_id     text,
  type          text not null,
  title         text not null,
  description   text,
  metadata      jsonb not null default '{}'::jsonb,
  visibility    text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  kudos_count   integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint social_activities_title_length check (char_length(title) <= 200),
  constraint social_activities_description_length check (description is null or char_length(description) <= 1000)
);

create index social_activities_profile_idx on social_activities (profile_id);
create index social_activities_created_idx on social_activities (created_at desc);
create index social_activities_module_idx on social_activities (module_id);
create index social_activities_type_idx on social_activities (type);

alter table social_activities enable row level security;

-- Public activities are visible to everyone; followers-only requires follow relationship
create policy "Activities visible by visibility"
  on social_activities for select
  using (
    visibility = 'public'
    or profile_id in (select id from social_profiles where user_id = auth.uid())
    or (
      visibility = 'followers'
      and profile_id in (
        select followee_id from social_follows
        where follower_id in (select id from social_profiles where user_id = auth.uid())
        and status = 'active'
      )
    )
  );

-- Users can only create/update/delete their own activities
create policy "Users manage own activities"
  on social_activities for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Kudos (Reactions) ──────────────────────────────────────────────────

create table if not exists social_kudos (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references social_activities(id) on delete cascade,
  giver_id     uuid not null references social_profiles(id) on delete cascade,
  emoji        text not null check (emoji in ('fire', 'clap', 'muscle', 'heart', 'mind_blown', 'wave')),
  created_at   timestamptz not null default now(),

  constraint social_kudos_unique unique (activity_id, giver_id)
);

create index social_kudos_activity_idx on social_kudos (activity_id);
create index social_kudos_giver_idx on social_kudos (giver_id);

alter table social_kudos enable row level security;

-- Kudos are readable if the parent activity is readable (simplified: anyone can see kudos on visible activities)
create policy "Kudos visible with activity"
  on social_kudos for select
  using (
    activity_id in (
      select id from social_activities
      where visibility = 'public'
      or profile_id in (select id from social_profiles where user_id = auth.uid())
      or (
        visibility = 'followers'
        and profile_id in (
          select followee_id from social_follows
          where follower_id in (select id from social_profiles where user_id = auth.uid())
          and status = 'active'
        )
      )
    )
  );

-- Users can give/remove kudos from their own profile
create policy "Users manage own kudos"
  on social_kudos for all
  using (giver_id in (select id from social_profiles where user_id = auth.uid()))
  with check (giver_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Comments ───────────────────────────────────────────────────────────

create table if not exists social_comments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references social_activities(id) on delete cascade,
  profile_id   uuid not null references social_profiles(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint social_comments_body_length check (char_length(body) between 1 and 500)
);

create index social_comments_activity_idx on social_comments (activity_id);
create index social_comments_profile_idx on social_comments (profile_id);

alter table social_comments enable row level security;

-- Comments visible if parent activity is visible
create policy "Comments visible with activity"
  on social_comments for select
  using (
    activity_id in (
      select id from social_activities
      where visibility = 'public'
      or profile_id in (select id from social_profiles where user_id = auth.uid())
      or (
        visibility = 'followers'
        and profile_id in (
          select followee_id from social_follows
          where follower_id in (select id from social_profiles where user_id = auth.uid())
          and status = 'active'
        )
      )
    )
  );

-- Users manage own comments
create policy "Users manage own comments"
  on social_comments for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Challenges ─────────────────────────────────────────────────────────

create table if not exists social_challenges (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  creator_id   uuid not null references social_profiles(id) on delete cascade,
  status       text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  member_count integer not null default 0,
  visibility   text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint social_challenges_title_length check (char_length(title) between 1 and 100),
  constraint social_challenges_description_length check (description is null or char_length(description) <= 1000),
  constraint social_challenges_dates check (ends_at > starts_at)
);

create index social_challenges_creator_idx on social_challenges (creator_id);
create index social_challenges_status_idx on social_challenges (status);

alter table social_challenges enable row level security;

-- Public challenges visible to all; others follow standard visibility rules
create policy "Challenges visible by visibility"
  on social_challenges for select
  using (
    visibility = 'public'
    or creator_id in (select id from social_profiles where user_id = auth.uid())
    or id in (select challenge_id from social_challenge_members where profile_id in (select id from social_profiles where user_id = auth.uid()))
  );

create policy "Users manage own challenges"
  on social_challenges for all
  using (creator_id in (select id from social_profiles where user_id = auth.uid()))
  with check (creator_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Challenge Goals ────────────────────────────────────────────────────

create table if not exists social_challenge_goals (
  id             uuid primary key default gen_random_uuid(),
  challenge_id   uuid not null references social_challenges(id) on delete cascade,
  module_id      text not null,
  activity_type  text not null,
  target_count   integer not null check (target_count > 0),
  unit           text not null,
  description    text not null,

  constraint social_challenge_goals_unit_length check (char_length(unit) <= 30),
  constraint social_challenge_goals_description_length check (char_length(description) <= 200)
);

create index social_challenge_goals_challenge_idx on social_challenge_goals (challenge_id);

alter table social_challenge_goals enable row level security;

-- Goals readable if challenge is readable
create policy "Goals visible with challenge"
  on social_challenge_goals for select
  using (
    challenge_id in (select id from social_challenges)
  );

create policy "Creator manages goals"
  on social_challenge_goals for all
  using (
    challenge_id in (
      select id from social_challenges
      where creator_id in (select id from social_profiles where user_id = auth.uid())
    )
  )
  with check (
    challenge_id in (
      select id from social_challenges
      where creator_id in (select id from social_profiles where user_id = auth.uid())
    )
  );


-- ── Challenge Members ──────────────────────────────────────────────────

create table if not exists social_challenge_members (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references social_challenges(id) on delete cascade,
  profile_id    uuid not null references social_profiles(id) on delete cascade,
  status        text not null default 'joined' check (status in ('joined', 'completed', 'dropped')),
  progress      jsonb not null default '{}'::jsonb,
  joined_at     timestamptz not null default now(),
  completed_at  timestamptz,

  constraint social_challenge_members_unique unique (challenge_id, profile_id)
);

create index social_challenge_members_challenge_idx on social_challenge_members (challenge_id);
create index social_challenge_members_profile_idx on social_challenge_members (profile_id);

alter table social_challenge_members enable row level security;

-- Members visible to other challenge participants
create policy "Challenge members visible to participants"
  on social_challenge_members for select
  using (
    challenge_id in (
      select id from social_challenges where visibility = 'public'
    )
    or profile_id in (select id from social_profiles where user_id = auth.uid())
    or challenge_id in (
      select challenge_id from social_challenge_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

-- Users manage their own membership
create policy "Users manage own membership"
  on social_challenge_members for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Groups ─────────────────────────────────────────────────────────────

create table if not exists social_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  avatar_url    text,
  creator_id    uuid not null references social_profiles(id) on delete cascade,
  member_count  integer not null default 0,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint social_groups_name_length check (char_length(name) between 1 and 100),
  constraint social_groups_description_length check (description is null or char_length(description) <= 1000)
);

create index social_groups_creator_idx on social_groups (creator_id);

alter table social_groups enable row level security;

-- Public groups visible to all; private groups visible to members
create policy "Groups visible by publicity"
  on social_groups for select
  using (
    is_public = true
    or creator_id in (select id from social_profiles where user_id = auth.uid())
    or id in (
      select group_id from social_group_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

create policy "Users manage own groups"
  on social_groups for all
  using (creator_id in (select id from social_profiles where user_id = auth.uid()))
  with check (creator_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Group Members ──────────────────────────────────────────────────────

create table if not exists social_group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references social_groups(id) on delete cascade,
  profile_id  uuid not null references social_profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),

  constraint social_group_members_unique unique (group_id, profile_id)
);

create index social_group_members_group_idx on social_group_members (group_id);
create index social_group_members_profile_idx on social_group_members (profile_id);

alter table social_group_members enable row level security;

-- Group members visible to other members (and public group members visible to all)
create policy "Group members visible"
  on social_group_members for select
  using (
    group_id in (select id from social_groups where is_public = true)
    or profile_id in (select id from social_profiles where user_id = auth.uid())
    or group_id in (
      select group_id from social_group_members
      where profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

create policy "Users manage own group membership"
  on social_group_members for all
  using (profile_id in (select id from social_profiles where user_id = auth.uid()))
  with check (profile_id in (select id from social_profiles where user_id = auth.uid()));


-- ── Leaderboard Configs ────────────────────────────────────────────────

create table if not exists social_leaderboard_configs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  scope       text not null check (scope in ('global', 'group', 'challenge', 'friends')),
  scope_id    uuid,
  timeframe   text not null check (timeframe in ('daily', 'weekly', 'monthly', 'all_time')),
  scoring     jsonb not null default '{}'::jsonb,
  modules     text[] not null default '{}',
  created_at  timestamptz not null default now(),

  constraint social_leaderboard_configs_name_length check (char_length(name) between 1 and 100)
);

alter table social_leaderboard_configs enable row level security;

-- Leaderboard configs are readable by anyone with a social profile
create policy "Leaderboard configs readable"
  on social_leaderboard_configs for select
  using (
    exists (select 1 from social_profiles where user_id = auth.uid())
  );


-- ── Helper Functions ───────────────────────────────────────────────────

-- Auto-update follower/following counts on follow changes
create or replace function update_follow_counts()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.status = 'active' then
    update social_profiles set follower_count = follower_count + 1 where id = NEW.followee_id;
    update social_profiles set following_count = following_count + 1 where id = NEW.follower_id;
  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'active' then
    update social_profiles set follower_count = follower_count + 1 where id = NEW.followee_id;
    update social_profiles set following_count = following_count + 1 where id = NEW.follower_id;
  elsif TG_OP = 'DELETE' and OLD.status = 'active' then
    update social_profiles set follower_count = greatest(0, follower_count - 1) where id = OLD.followee_id;
    update social_profiles set following_count = greatest(0, following_count - 1) where id = OLD.follower_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger follow_count_trigger
  after insert or update or delete on social_follows
  for each row execute function update_follow_counts();

-- Auto-update kudos_count on activities
create or replace function update_kudos_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update social_activities set kudos_count = kudos_count + 1 where id = NEW.activity_id;
  elsif TG_OP = 'DELETE' then
    update social_activities set kudos_count = greatest(0, kudos_count - 1) where id = OLD.activity_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger kudos_count_trigger
  after insert or delete on social_kudos
  for each row execute function update_kudos_count();

-- Auto-update comment_count on activities
create or replace function update_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update social_activities set comment_count = comment_count + 1 where id = NEW.activity_id;
  elsif TG_OP = 'DELETE' then
    update social_activities set comment_count = greatest(0, comment_count - 1) where id = OLD.activity_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger comment_count_trigger
  after insert or delete on social_comments
  for each row execute function update_comment_count();

-- Auto-update member_count on challenges
create or replace function update_challenge_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update social_challenges set member_count = member_count + 1 where id = NEW.challenge_id;
  elsif TG_OP = 'DELETE' then
    update social_challenges set member_count = greatest(0, member_count - 1) where id = OLD.challenge_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger challenge_member_count_trigger
  after insert or delete on social_challenge_members
  for each row execute function update_challenge_member_count();

-- Auto-update member_count on groups
create or replace function update_group_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update social_groups set member_count = member_count + 1 where id = NEW.group_id;
  elsif TG_OP = 'DELETE' then
    update social_groups set member_count = greatest(0, member_count - 1) where id = OLD.group_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger group_member_count_trigger
  after insert or delete on social_group_members
  for each row execute function update_group_member_count();

-- Auto-update updated_at timestamps
create or replace function update_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger social_profiles_updated_at
  before update on social_profiles
  for each row execute function update_updated_at();

create trigger social_friend_links_updated_at
  before update on social_friend_links
  for each row execute function update_updated_at();

create trigger social_friendships_updated_at
  before update on social_friendships
  for each row execute function update_updated_at();

create trigger social_challenges_updated_at
  before update on social_challenges
  for each row execute function update_updated_at();

create trigger social_groups_updated_at
  before update on social_groups
  for each row execute function update_updated_at();

create trigger social_comments_updated_at
  before update on social_comments
  for each row execute function update_updated_at();
