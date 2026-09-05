-- DoWork workout shares + social engagement.
--
-- A "workout share" is a cloud post derived from a completed local
-- workout session. The original session stays on-device in `wk_*`
-- tables; only sanitized summary fields are uploaded.

create table if not exists public.dw_workout_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  duration_seconds integer not null check (duration_seconds >= 0),
  total_volume_kg numeric(10,2) not null default 0,
  exercise_count integer not null default 0,
  category text,
  hero_image_url text,
  privacy text not null default 'public' check (privacy in ('public','followers','private')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dw_workout_shares_user_created_idx
  on public.dw_workout_shares (user_id, created_at desc);

create index if not exists dw_workout_shares_public_created_idx
  on public.dw_workout_shares (created_at desc)
  where privacy = 'public' and is_hidden = false;

alter table public.dw_workout_shares enable row level security;

create policy dw_workout_shares_owner_all
  on public.dw_workout_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy dw_workout_shares_public_select
  on public.dw_workout_shares
  for select
  using (privacy = 'public' and is_hidden = false);

-- Likes
create table if not exists public.dw_likes (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.dw_workout_shares(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (share_id, user_id)
);

create index if not exists dw_likes_share_idx on public.dw_likes (share_id);

alter table public.dw_likes enable row level security;

create policy dw_likes_select_public
  on public.dw_likes
  for select
  using (
    exists (
      select 1 from public.dw_workout_shares s
      where s.id = share_id
        and (s.privacy = 'public' or s.user_id = auth.uid())
        and s.is_hidden = false
    )
  );

create policy dw_likes_owner_insert
  on public.dw_likes
  for insert
  with check (auth.uid() = user_id);

create policy dw_likes_owner_delete
  on public.dw_likes
  for delete
  using (auth.uid() = user_id);

-- Comments
create table if not exists public.dw_comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.dw_workout_shares(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dw_comments_share_created_idx
  on public.dw_comments (share_id, created_at);

alter table public.dw_comments enable row level security;

create policy dw_comments_select_public
  on public.dw_comments
  for select
  using (
    is_hidden = false
    and exists (
      select 1 from public.dw_workout_shares s
      where s.id = share_id
        and (s.privacy = 'public' or s.user_id = auth.uid())
        and s.is_hidden = false
    )
  );

create policy dw_comments_owner_modify
  on public.dw_comments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
