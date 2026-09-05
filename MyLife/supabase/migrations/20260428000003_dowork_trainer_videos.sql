-- DoWork trainer videos (cloud demo asset registry).
--
-- Trainers upload exercise demo videos that other users can browse from
-- the exercise detail screen. Storage objects live in a separate Supabase
-- Storage bucket (configured out-of-band); this table is the metadata
-- registry that screens read.

create table if not exists public.dw_trainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists dw_trainers_active_idx on public.dw_trainers (is_active);

alter table public.dw_trainers enable row level security;

create policy dw_trainers_select_public
  on public.dw_trainers
  for select
  using (is_active = true);

create policy dw_trainers_owner_modify
  on public.dw_trainers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.dw_trainer_videos (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.dw_trainers(id) on delete cascade,
  exercise_slug text not null,
  storage_path text not null,
  thumbnail_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  angle text check (angle in ('front','side','three_quarter','overhead','back')),
  is_primary boolean not null default false,
  is_hidden boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dw_trainer_videos_exercise_idx
  on public.dw_trainer_videos (exercise_slug, sort_order);

create index if not exists dw_trainer_videos_primary_idx
  on public.dw_trainer_videos (exercise_slug, is_primary)
  where is_hidden = false;

alter table public.dw_trainer_videos enable row level security;

create policy dw_trainer_videos_select_public
  on public.dw_trainer_videos
  for select
  using (is_hidden = false);

create policy dw_trainer_videos_trainer_modify
  on public.dw_trainer_videos
  for all
  using (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  );
