-- P1-A: Notifications, followers graph, rank history, submission region/restaurant flag,
--        and vote-score decomposition columns.
-- Triggers maintaining decomposition counts land in P1-B.

-- 1. Notifications activity feed
create table public.bc_notifications (
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
create index bc_notifications_user_unread on public.bc_notifications (user_id, is_read, created_at desc);
alter publication supabase_realtime add table public.bc_notifications;
alter table public.bc_notifications enable row level security;
create policy "owner reads" on public.bc_notifications for select using (auth.uid() = user_id);
create policy "owner updates" on public.bc_notifications for update using (auth.uid() = user_id);
create policy "owner deletes" on public.bc_notifications for delete using (auth.uid() = user_id);
-- Inserts go through SECURITY DEFINER fanout fns only (P1-C).

-- 2. Followers graph
create table public.bc_followers (
  follower_id uuid not null references public.social_profiles(id) on delete cascade,
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, chef_id),
  check (follower_id <> chef_id)
);
create index bc_followers_chef_idx on public.bc_followers (chef_id, created_at desc);
create index bc_followers_follower_idx on public.bc_followers (follower_id, created_at desc);
alter table public.bc_followers enable row level security;
create policy "anyone reads counts" on public.bc_followers for select using (true);
create policy "self follows/unfollows" on public.bc_followers for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- 3. Rank history (sparkline)
create table public.bc_rank_history (
  chef_id uuid not null references public.social_profiles(id) on delete cascade,
  week date not null,
  rank int not null,
  total_chefs int not null,
  primary key (chef_id, week)
);
alter table public.bc_rank_history enable row level security;
create policy "rank history public read" on public.bc_rank_history for select using (true);

-- 4. Submission region + restaurant flag
alter table public.bc_submissions
  add column if not exists region text,
  add column if not exists is_restaurant boolean not null default false;
create index bc_submissions_region_idx on public.bc_submissions (region) where region is not null;

-- 5. Vote-score decomposition (triggers come in P1-B)
alter table public.bc_submissions
  add column if not exists upvote_count int not null default 0,
  add column if not exists downvote_count int not null default 0,
  add column if not exists reviewed_count int not null default 0,
  add column if not exists tap_count int not null default 0;
