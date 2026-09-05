-- Social server schema for MyLife and BestChef public/community features.
-- This activates the package/social tables that the client already expects.

create or replace function social_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists social_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text,
  avatar_url text,
  privacy_settings jsonb not null default '{
    "discoverable": false,
    "showModules": false,
    "showStreaks": false,
    "openFollows": false,
    "moduleSettings": []
  }'::jsonb,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  enabled_modules text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_profiles_handle_unique unique (handle),
  constraint social_profiles_user_id_unique unique (user_id),
  constraint social_profiles_handle_format check (handle ~ '^[a-z0-9_]{3,30}$'),
  constraint social_profiles_display_name_length check (char_length(display_name) between 1 and 64),
  constraint social_profiles_bio_length check (bio is null or char_length(bio) <= 280)
);

create index if not exists social_profiles_handle_idx on social_profiles (handle);
create index if not exists social_profiles_user_id_idx on social_profiles (user_id);

create table if not exists social_friend_links (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references social_profiles(id) on delete cascade,
  friend_profile_id uuid references social_profiles(id) on delete set null,
  code_hash text not null,
  code_hint text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_friend_links_code_hash_unique unique (code_hash),
  constraint social_friend_links_no_self check (friend_profile_id is null or creator_profile_id != friend_profile_id),
  constraint social_friend_links_note_length check (note is null or char_length(note) <= 200)
);

create index if not exists social_friend_links_creator_idx on social_friend_links (creator_profile_id, created_at desc);
create index if not exists social_friend_links_friend_idx on social_friend_links (friend_profile_id, created_at desc);
create index if not exists social_friend_links_status_idx on social_friend_links (status, created_at desc);

create table if not exists social_friendships (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references social_profiles(id) on delete cascade,
  profile_b_id uuid not null references social_profiles(id) on delete cascade,
  created_by_profile_id uuid not null references social_profiles(id) on delete cascade,
  source_link_id uuid references social_friend_links(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_friendships_no_self check (profile_a_id != profile_b_id)
);

create unique index if not exists social_friendships_pair_unique_idx
  on social_friendships (
    least(profile_a_id::text, profile_b_id::text),
    greatest(profile_a_id::text, profile_b_id::text)
  );
create index if not exists social_friendships_profile_a_idx on social_friendships (profile_a_id, created_at desc);
create index if not exists social_friendships_profile_b_idx on social_friendships (profile_b_id, created_at desc);

create table if not exists social_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references social_profiles(id) on delete cascade,
  followee_id uuid not null references social_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  constraint social_follows_unique unique (follower_id, followee_id),
  constraint social_follows_no_self check (follower_id != followee_id)
);

create index if not exists social_follows_follower_idx on social_follows (follower_id);
create index if not exists social_follows_followee_idx on social_follows (followee_id);

create table if not exists social_activities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references social_profiles(id) on delete cascade,
  module_id text,
  type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  kudos_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint social_activities_title_length check (char_length(title) <= 200),
  constraint social_activities_description_length check (description is null or char_length(description) <= 1000)
);

create index if not exists social_activities_profile_idx on social_activities (profile_id);
create index if not exists social_activities_created_idx on social_activities (created_at desc);
create index if not exists social_activities_module_idx on social_activities (module_id);
create index if not exists social_activities_type_idx on social_activities (type);

create table if not exists social_kudos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references social_activities(id) on delete cascade,
  giver_id uuid not null references social_profiles(id) on delete cascade,
  emoji text not null check (emoji in ('fire', 'clap', 'muscle', 'heart', 'mind_blown', 'wave')),
  created_at timestamptz not null default now(),
  constraint social_kudos_unique unique (activity_id, giver_id)
);

create index if not exists social_kudos_activity_idx on social_kudos (activity_id);
create index if not exists social_kudos_giver_idx on social_kudos (giver_id);

create table if not exists social_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references social_activities(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_comments_body_length check (char_length(body) between 1 and 500)
);

create index if not exists social_comments_activity_idx on social_comments (activity_id);
create index if not exists social_comments_profile_idx on social_comments (profile_id);

create table if not exists social_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  creator_id uuid not null references social_profiles(id) on delete cascade,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  member_count integer not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_challenges_title_length check (char_length(title) between 1 and 100),
  constraint social_challenges_description_length check (description is null or char_length(description) <= 1000),
  constraint social_challenges_dates check (ends_at > starts_at)
);

create index if not exists social_challenges_creator_idx on social_challenges (creator_id);
create index if not exists social_challenges_status_idx on social_challenges (status);

create table if not exists social_challenge_goals (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references social_challenges(id) on delete cascade,
  module_id text not null,
  activity_type text not null,
  target_count integer not null check (target_count > 0),
  unit text not null,
  description text not null,
  constraint social_challenge_goals_unit_length check (char_length(unit) <= 30),
  constraint social_challenge_goals_description_length check (char_length(description) <= 200)
);

create index if not exists social_challenge_goals_challenge_idx on social_challenge_goals (challenge_id);

create table if not exists social_challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references social_challenges(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'completed', 'dropped')),
  progress jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint social_challenge_members_unique unique (challenge_id, profile_id)
);

create index if not exists social_challenge_members_challenge_idx on social_challenge_members (challenge_id);
create index if not exists social_challenge_members_profile_idx on social_challenge_members (profile_id);

create table if not exists social_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  creator_id uuid not null references social_profiles(id) on delete cascade,
  member_count integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_groups_name_length check (char_length(name) between 1 and 100),
  constraint social_groups_description_length check (description is null or char_length(description) <= 1000)
);

create index if not exists social_groups_creator_idx on social_groups (creator_id);

create table if not exists social_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references social_groups(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  constraint social_group_members_unique unique (group_id, profile_id)
);

create index if not exists social_group_members_group_idx on social_group_members (group_id);
create index if not exists social_group_members_profile_idx on social_group_members (profile_id);

create table if not exists social_leaderboard_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('global', 'group', 'challenge', 'friends')),
  scope_id uuid,
  timeframe text not null check (timeframe in ('daily', 'weekly', 'monthly', 'all_time')),
  scoring jsonb not null default '{}'::jsonb,
  modules text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint social_leaderboard_configs_name_length check (char_length(name) between 1 and 100)
);

alter table social_profiles enable row level security;
alter table social_friend_links enable row level security;
alter table social_friendships enable row level security;
alter table social_follows enable row level security;
alter table social_activities enable row level security;
alter table social_kudos enable row level security;
alter table social_comments enable row level security;
alter table social_challenges enable row level security;
alter table social_challenge_goals enable row level security;
alter table social_challenge_members enable row level security;
alter table social_groups enable row level security;
alter table social_group_members enable row level security;
alter table social_leaderboard_configs enable row level security;

create or replace function social_profile_owned(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from social_profiles
    where id = profile_id
      and user_id = auth.uid()
  );
$$;

create or replace function social_profile_visible(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from social_profiles
    where id = profile_id
      and (
        user_id = auth.uid()
        or coalesce((privacy_settings->>'discoverable')::boolean, false)
      )
  );
$$;

create or replace function social_activity_visible(activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from social_activities a
    where a.id = activity_id
      and (
        a.visibility = 'public'
        or social_profile_owned(a.profile_id)
        or (
          a.visibility = 'followers'
          and exists (
            select 1
            from social_follows f
            join social_profiles viewer on viewer.id = f.follower_id
            where f.followee_id = a.profile_id
              and f.status = 'active'
              and viewer.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function social_since_for_timeframe(timeframe text)
returns timestamptz
language sql
stable
as $$
  select case timeframe
    when 'daily' then now() - interval '1 day'
    when 'weekly' then now() - interval '7 days'
    when 'monthly' then now() - interval '30 days'
    else null
  end;
$$;

drop policy if exists "social_profiles_select" on social_profiles;
create policy "social_profiles_select"
  on social_profiles for select
  using (social_profile_owned(id) or coalesce((privacy_settings->>'discoverable')::boolean, false));

drop policy if exists "social_profiles_insert" on social_profiles;
create policy "social_profiles_insert"
  on social_profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "social_profiles_update" on social_profiles;
create policy "social_profiles_update"
  on social_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "social_profiles_delete" on social_profiles;
create policy "social_profiles_delete"
  on social_profiles for delete
  using (user_id = auth.uid());

drop policy if exists "social_friend_links_select" on social_friend_links;
create policy "social_friend_links_select"
  on social_friend_links for select
  using (social_profile_owned(creator_profile_id) or social_profile_owned(friend_profile_id));

drop policy if exists "social_friend_links_insert" on social_friend_links;
create policy "social_friend_links_insert"
  on social_friend_links for insert
  with check (social_profile_owned(creator_profile_id));

drop policy if exists "social_friend_links_update" on social_friend_links;
create policy "social_friend_links_update"
  on social_friend_links for update
  using (social_profile_owned(creator_profile_id) or social_profile_owned(friend_profile_id))
  with check (social_profile_owned(creator_profile_id) or social_profile_owned(friend_profile_id));

drop policy if exists "social_friend_links_delete" on social_friend_links;
create policy "social_friend_links_delete"
  on social_friend_links for delete
  using (social_profile_owned(creator_profile_id));

drop policy if exists "social_friendships_select" on social_friendships;
create policy "social_friendships_select"
  on social_friendships for select
  using (social_profile_owned(profile_a_id) or social_profile_owned(profile_b_id));

drop policy if exists "social_friendships_delete" on social_friendships;
create policy "social_friendships_delete"
  on social_friendships for delete
  using (social_profile_owned(profile_a_id) or social_profile_owned(profile_b_id));

drop policy if exists "social_follows_select" on social_follows;
create policy "social_follows_select"
  on social_follows for select
  using (social_profile_owned(follower_id) or social_profile_owned(followee_id) or social_profile_visible(followee_id));

drop policy if exists "social_follows_insert" on social_follows;
create policy "social_follows_insert"
  on social_follows for insert
  with check (social_profile_owned(follower_id));

drop policy if exists "social_follows_update" on social_follows;
create policy "social_follows_update"
  on social_follows for update
  using (social_profile_owned(followee_id))
  with check (social_profile_owned(followee_id));

drop policy if exists "social_follows_delete" on social_follows;
create policy "social_follows_delete"
  on social_follows for delete
  using (social_profile_owned(follower_id) or social_profile_owned(followee_id));

drop policy if exists "social_activities_select" on social_activities;
create policy "social_activities_select"
  on social_activities for select
  using (social_activity_visible(id));

drop policy if exists "social_activities_all" on social_activities;
create policy "social_activities_all"
  on social_activities for all
  using (social_profile_owned(profile_id))
  with check (social_profile_owned(profile_id));

drop policy if exists "social_kudos_select" on social_kudos;
create policy "social_kudos_select"
  on social_kudos for select
  using (social_activity_visible(activity_id));

drop policy if exists "social_kudos_all" on social_kudos;
create policy "social_kudos_all"
  on social_kudos for all
  using (social_profile_owned(giver_id))
  with check (social_profile_owned(giver_id));

drop policy if exists "social_comments_select" on social_comments;
create policy "social_comments_select"
  on social_comments for select
  using (social_activity_visible(activity_id));

drop policy if exists "social_comments_all" on social_comments;
create policy "social_comments_all"
  on social_comments for all
  using (social_profile_owned(profile_id))
  with check (social_profile_owned(profile_id));

drop policy if exists "social_challenges_select" on social_challenges;
create policy "social_challenges_select"
  on social_challenges for select
  using (
    visibility = 'public'
    or social_profile_owned(creator_id)
    or exists (
      select 1 from social_challenge_members m
      where m.challenge_id = social_challenges.id
        and social_profile_owned(m.profile_id)
    )
  );

drop policy if exists "social_challenges_all" on social_challenges;
create policy "social_challenges_all"
  on social_challenges for all
  using (social_profile_owned(creator_id))
  with check (social_profile_owned(creator_id));

drop policy if exists "social_challenge_goals_select" on social_challenge_goals;
create policy "social_challenge_goals_select"
  on social_challenge_goals for select
  using (exists (select 1 from social_challenges c where c.id = challenge_id));

drop policy if exists "social_challenge_goals_all" on social_challenge_goals;
create policy "social_challenge_goals_all"
  on social_challenge_goals for all
  using (exists (select 1 from social_challenges c where c.id = challenge_id and social_profile_owned(c.creator_id)))
  with check (exists (select 1 from social_challenges c where c.id = challenge_id and social_profile_owned(c.creator_id)));

drop policy if exists "social_challenge_members_select" on social_challenge_members;
create policy "social_challenge_members_select"
  on social_challenge_members for select
  using (
    social_profile_owned(profile_id)
    or exists (select 1 from social_challenges c where c.id = challenge_id and c.visibility = 'public')
    or exists (
      select 1 from social_challenge_members viewer
      where viewer.challenge_id = social_challenge_members.challenge_id
        and social_profile_owned(viewer.profile_id)
    )
  );

drop policy if exists "social_challenge_members_all" on social_challenge_members;
create policy "social_challenge_members_all"
  on social_challenge_members for all
  using (social_profile_owned(profile_id))
  with check (social_profile_owned(profile_id));

drop policy if exists "social_groups_select" on social_groups;
create policy "social_groups_select"
  on social_groups for select
  using (
    is_public
    or social_profile_owned(creator_id)
    or exists (
      select 1 from social_group_members m
      where m.group_id = social_groups.id
        and social_profile_owned(m.profile_id)
    )
  );

drop policy if exists "social_groups_all" on social_groups;
create policy "social_groups_all"
  on social_groups for all
  using (social_profile_owned(creator_id))
  with check (social_profile_owned(creator_id));

drop policy if exists "social_group_members_select" on social_group_members;
create policy "social_group_members_select"
  on social_group_members for select
  using (
    social_profile_owned(profile_id)
    or exists (select 1 from social_groups g where g.id = group_id and g.is_public)
    or exists (
      select 1 from social_group_members viewer
      where viewer.group_id = social_group_members.group_id
        and social_profile_owned(viewer.profile_id)
    )
  );

drop policy if exists "social_group_members_all" on social_group_members;
create policy "social_group_members_all"
  on social_group_members for all
  using (social_profile_owned(profile_id))
  with check (social_profile_owned(profile_id));

drop policy if exists "social_leaderboard_configs_select" on social_leaderboard_configs;
create policy "social_leaderboard_configs_select"
  on social_leaderboard_configs for select
  using (exists (select 1 from social_profiles where user_id = auth.uid()));

create or replace function social_update_follow_counts()
returns trigger as $$
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    update social_profiles set follower_count = follower_count + 1 where id = new.followee_id;
    update social_profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'UPDATE' and old.status <> 'active' and new.status = 'active' then
    update social_profiles set follower_count = follower_count + 1 where id = new.followee_id;
    update social_profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active' then
    update social_profiles set follower_count = greatest(0, follower_count - 1) where id = old.followee_id;
    update social_profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  elsif tg_op = 'DELETE' and old.status = 'active' then
    update social_profiles set follower_count = greatest(0, follower_count - 1) where id = old.followee_id;
    update social_profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists social_follow_count_trigger on social_follows;
create trigger social_follow_count_trigger
  after insert or update or delete on social_follows
  for each row execute function social_update_follow_counts();

create or replace function social_update_kudos_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_activities set kudos_count = kudos_count + 1 where id = new.activity_id;
  elsif tg_op = 'DELETE' then
    update social_activities set kudos_count = greatest(0, kudos_count - 1) where id = old.activity_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists social_kudos_count_trigger on social_kudos;
create trigger social_kudos_count_trigger
  after insert or delete on social_kudos
  for each row execute function social_update_kudos_count();

create or replace function social_update_comment_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_activities set comment_count = comment_count + 1 where id = new.activity_id;
  elsif tg_op = 'DELETE' then
    update social_activities set comment_count = greatest(0, comment_count - 1) where id = old.activity_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists social_comment_count_trigger on social_comments;
create trigger social_comment_count_trigger
  after insert or delete on social_comments
  for each row execute function social_update_comment_count();

create or replace function social_update_challenge_member_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_challenges set member_count = member_count + 1 where id = new.challenge_id;
  elsif tg_op = 'DELETE' then
    update social_challenges set member_count = greatest(0, member_count - 1) where id = old.challenge_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists social_challenge_member_count_trigger on social_challenge_members;
create trigger social_challenge_member_count_trigger
  after insert or delete on social_challenge_members
  for each row execute function social_update_challenge_member_count();

create or replace function social_update_group_member_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_groups set member_count = member_count + 1 where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update social_groups set member_count = greatest(0, member_count - 1) where id = old.group_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function social_guard_profile_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.follower_count is distinct from old.follower_count
    or new.following_count is distinct from old.following_count then
    raise exception 'Server-controlled profile counts cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function social_guard_follow_user_update()
returns trigger as $$
begin
  if new.follower_id is distinct from old.follower_id
    or new.followee_id is distinct from old.followee_id then
    raise exception 'Follow endpoints cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function social_guard_activity_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.kudos_count is distinct from old.kudos_count
    or new.comment_count is distinct from old.comment_count then
    raise exception 'Server-controlled activity counts cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function social_guard_challenge_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.member_count is distinct from old.member_count then
    raise exception 'Server-controlled challenge counts cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function social_guard_group_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.member_count is distinct from old.member_count then
    raise exception 'Server-controlled group counts cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists social_group_member_count_trigger on social_group_members;
create trigger social_group_member_count_trigger
  after insert or delete on social_group_members
  for each row execute function social_update_group_member_count();

drop trigger if exists social_profiles_guard_user_update on social_profiles;
create trigger social_profiles_guard_user_update before update on social_profiles
  for each row execute function social_guard_profile_user_update();

drop trigger if exists social_follows_guard_user_update on social_follows;
create trigger social_follows_guard_user_update before update on social_follows
  for each row execute function social_guard_follow_user_update();

drop trigger if exists social_activities_guard_user_update on social_activities;
create trigger social_activities_guard_user_update before update on social_activities
  for each row execute function social_guard_activity_user_update();

drop trigger if exists social_challenges_guard_user_update on social_challenges;
create trigger social_challenges_guard_user_update before update on social_challenges
  for each row execute function social_guard_challenge_user_update();

drop trigger if exists social_groups_guard_user_update on social_groups;
create trigger social_groups_guard_user_update before update on social_groups
  for each row execute function social_guard_group_user_update();

drop trigger if exists social_profiles_set_updated_at on social_profiles;
create trigger social_profiles_set_updated_at before update on social_profiles
  for each row execute function social_set_updated_at();

drop trigger if exists social_friend_links_set_updated_at on social_friend_links;
create trigger social_friend_links_set_updated_at before update on social_friend_links
  for each row execute function social_set_updated_at();

drop trigger if exists social_friendships_set_updated_at on social_friendships;
create trigger social_friendships_set_updated_at before update on social_friendships
  for each row execute function social_set_updated_at();

drop trigger if exists social_challenges_set_updated_at on social_challenges;
create trigger social_challenges_set_updated_at before update on social_challenges
  for each row execute function social_set_updated_at();

drop trigger if exists social_groups_set_updated_at on social_groups;
create trigger social_groups_set_updated_at before update on social_groups
  for each row execute function social_set_updated_at();

drop trigger if exists social_comments_set_updated_at on social_comments;
create trigger social_comments_set_updated_at before update on social_comments
  for each row execute function social_set_updated_at();

create or replace function social_confirm_friend_link(
  link_code_hash text,
  claimant_profile_id uuid
)
returns jsonb as $$
declare
  target_link social_friend_links%rowtype;
  confirmed_friendship social_friendships%rowtype;
  low_profile uuid;
  high_profile uuid;
begin
  if claimant_profile_id is null or not social_profile_owned(claimant_profile_id) then
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

  insert into social_friendships (
    profile_a_id,
    profile_b_id,
    created_by_profile_id,
    source_link_id
  )
  values (low_profile, high_profile, claimant_profile_id, target_link.id)
  on conflict do nothing;

  select *
  into confirmed_friendship
  from social_friendships
  where least(profile_a_id::text, profile_b_id::text) = low_profile::text
    and greatest(profile_a_id::text, profile_b_id::text) = high_profile::text
  limit 1;

  update social_friend_links
  set friend_profile_id = claimant_profile_id,
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now()),
      updated_at = now()
  where id = target_link.id;

  insert into social_follows (follower_id, followee_id, status)
  values (target_link.creator_profile_id, claimant_profile_id, 'active')
  on conflict (follower_id, followee_id) do update set status = 'active';

  insert into social_follows (follower_id, followee_id, status)
  values (claimant_profile_id, target_link.creator_profile_id, 'active')
  on conflict (follower_id, followee_id) do update set status = 'active';

  return to_jsonb(confirmed_friendship);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function compute_leaderboard(
  config_id uuid,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  profile_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  score numeric,
  rank integer,
  module_scores jsonb
) as $$
declare
  cfg social_leaderboard_configs%rowtype;
  since_at timestamptz;
begin
  select * into cfg from social_leaderboard_configs where id = config_id;
  if not found then
    return;
  end if;

  since_at := social_since_for_timeframe(cfg.timeframe);

  return query
  with visible_activities as (
    select a.*
    from social_activities a
    where social_activity_visible(a.id)
      and (array_length(cfg.modules, 1) is null or a.module_id = any(cfg.modules))
      and (since_at is null or a.created_at >= since_at)
  ),
  module_rollups as (
    select
      a.profile_id,
      a.module_id,
      count(*)::numeric
        + coalesce(sum(
          case
            when (a.metadata->>'score') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then (a.metadata->>'score')::numeric
            else 0
          end
        ), 0) as module_score
    from visible_activities a
    group by a.profile_id, a.module_id
  ),
  totals as (
    select
      mr.profile_id,
      sum(mr.module_score) as total_score,
      jsonb_object_agg(coalesce(mr.module_id, 'general'), mr.module_score) as module_score_map
    from module_rollups mr
    group by mr.profile_id
  )
  select
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    totals.total_score,
    rank() over (order by totals.total_score desc)::integer,
    totals.module_score_map
  from totals
  join social_profiles p on p.id = totals.profile_id
  order by totals.total_score desc, p.handle asc
  limit least(greatest(result_limit, 0), 100)
  offset greatest(result_offset, 0);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function compute_friends_leaderboard(
  p_timeframe text default 'weekly',
  result_limit integer default 50
)
returns table (
  profile_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  score numeric,
  rank integer,
  module_scores jsonb
) as $$
declare
  viewer_profile uuid;
  since_at timestamptz;
begin
  if p_timeframe not in ('daily', 'weekly', 'monthly', 'all_time') then
    raise exception 'Unsupported leaderboard timeframe';
  end if;

  select id into viewer_profile from social_profiles where user_id = auth.uid() limit 1;
  if viewer_profile is null then
    return;
  end if;

  since_at := social_since_for_timeframe(p_timeframe);

  return query
  with friends as (
    select viewer_profile as id
    union
    select followee_id from social_follows
    where follower_id = viewer_profile
      and status = 'active'
  ),
  visible_activities as (
    select a.*
    from social_activities a
    where a.profile_id in (select id from friends)
      and social_activity_visible(a.id)
      and (since_at is null or a.created_at >= since_at)
  ),
  module_rollups as (
    select
      a.profile_id,
      a.module_id,
      count(*)::numeric
        + coalesce(sum(
          case
            when (a.metadata->>'score') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then (a.metadata->>'score')::numeric
            else 0
          end
        ), 0) as module_score
    from visible_activities a
    group by a.profile_id, a.module_id
  ),
  totals as (
    select
      mr.profile_id,
      sum(mr.module_score) as total_score,
      jsonb_object_agg(coalesce(mr.module_id, 'general'), mr.module_score) as module_score_map
    from module_rollups mr
    group by mr.profile_id
  )
  select
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    totals.total_score,
    rank() over (order by totals.total_score desc)::integer,
    totals.module_score_map
  from totals
  join social_profiles p on p.id = totals.profile_id
  order by totals.total_score desc, p.handle asc
  limit least(greatest(result_limit, 0), 100);
end;
$$ language plpgsql security definer set search_path = public;
