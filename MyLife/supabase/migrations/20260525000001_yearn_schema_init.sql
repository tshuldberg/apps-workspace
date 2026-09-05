-- Yearn dating app — isolated schema in shared Supabase project.
-- Cohabits with MyWorkouts in `public`. All Yearn data lives under `yearn.*`.
--
-- Apply via the Supabase MCP `apply_migration` tool, or paste into the
-- SQL editor in the dashboard. Idempotent.

create schema if not exists yearn;

-- =========================================
-- PROFILES
-- =========================================
create table if not exists yearn.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  birthday date not null,
  pronouns text not null default '',
  intention text not null default '',
  relationship_structure text not null default '',
  photos jsonb not null default '[]'::jsonb,
  prompts jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  is_verified boolean not null default false,
  is_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_updated_idx on yearn.profiles (updated_at desc);
create index if not exists profiles_active_idx on yearn.profiles (is_paused) where is_paused = false;

-- =========================================
-- LIKES
-- =========================================
create table if not exists yearn.likes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  note text default null check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

create index if not exists likes_recipient_idx on yearn.likes (recipient_id, created_at desc);
create index if not exists likes_sender_idx on yearn.likes (sender_id, created_at desc);

-- =========================================
-- PASSES
-- =========================================
create table if not exists yearn.passes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

create index if not exists passes_sender_idx on yearn.passes (sender_id);

-- =========================================
-- MATCHES (canonical ordered pair, written by trigger)
-- =========================================
create table if not exists yearn.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists matches_user_a_idx on yearn.matches (user_a, created_at desc);
create index if not exists matches_user_b_idx on yearn.matches (user_b, created_at desc);

-- =========================================
-- Trigger helpers
-- =========================================
create or replace function yearn.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on yearn.profiles;
create trigger profiles_set_updated_at
before update on yearn.profiles
for each row execute function yearn.set_updated_at();

create or replace function yearn.handle_new_like()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  mutual boolean;
  a uuid;
  b uuid;
begin
  select exists (
    select 1 from yearn.likes
    where sender_id = new.recipient_id and recipient_id = new.sender_id
  ) into mutual;

  if mutual then
    a := least(new.sender_id, new.recipient_id);
    b := greatest(new.sender_id, new.recipient_id);
    insert into yearn.matches (user_a, user_b)
    values (a, b)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists likes_handle_new on yearn.likes;
create trigger likes_handle_new
after insert on yearn.likes
for each row execute function yearn.handle_new_like();

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================
alter table yearn.profiles enable row level security;
alter table yearn.likes    enable row level security;
alter table yearn.passes   enable row level security;
alter table yearn.matches  enable row level security;

drop policy if exists "profiles select active" on yearn.profiles;
create policy "profiles select active"
on yearn.profiles for select
to authenticated
using (id = auth.uid() or is_paused = false);

drop policy if exists "profiles insert own" on yearn.profiles;
create policy "profiles insert own"
on yearn.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles update own" on yearn.profiles;
create policy "profiles update own"
on yearn.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles delete own" on yearn.profiles;
create policy "profiles delete own"
on yearn.profiles for delete
to authenticated
using (id = auth.uid());

drop policy if exists "likes select involving me" on yearn.likes;
create policy "likes select involving me"
on yearn.likes for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "likes insert as sender" on yearn.likes;
create policy "likes insert as sender"
on yearn.likes for insert
to authenticated
with check (sender_id = auth.uid());

drop policy if exists "likes delete as sender" on yearn.likes;
create policy "likes delete as sender"
on yearn.likes for delete
to authenticated
using (sender_id = auth.uid());

drop policy if exists "passes select own" on yearn.passes;
create policy "passes select own"
on yearn.passes for select
to authenticated
using (sender_id = auth.uid());

drop policy if exists "passes insert own" on yearn.passes;
create policy "passes insert own"
on yearn.passes for insert
to authenticated
with check (sender_id = auth.uid());

drop policy if exists "matches select mine" on yearn.matches;
create policy "matches select mine"
on yearn.matches for select
to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "matches delete mine" on yearn.matches;
create policy "matches delete mine"
on yearn.matches for delete
to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

-- Expose schema to PostgREST so the Supabase client can target it.
grant usage on schema yearn to anon, authenticated;
grant select, insert, update, delete on all tables in schema yearn to authenticated;
alter default privileges in schema yearn
  grant select, insert, update, delete on tables to authenticated;
