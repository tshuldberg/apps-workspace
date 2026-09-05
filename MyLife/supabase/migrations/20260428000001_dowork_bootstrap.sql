-- DoWork bootstrap schema: identity + profile.
--
-- Cloud tables for DoWork live alongside BestChef's bc_* tables but use a
-- distinct dw_* prefix so the two apps stay isolated even if a user is
-- signed in to the same Supabase project. Public access is RLS-gated.

create table if not exists public.dw_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dw_user_profiles enable row level security;

create policy dw_user_profiles_self_select
  on public.dw_user_profiles
  for select
  using (auth.uid() = user_id);

create policy dw_user_profiles_self_upsert
  on public.dw_user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy dw_user_profiles_self_update
  on public.dw_user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read of non-sensitive profile fields for social feed enrichment.
create or replace view public.dw_public_profiles
with (security_invoker = true) as
select
  user_id,
  handle,
  display_name,
  avatar_url,
  bio
from public.dw_user_profiles;

grant select on public.dw_public_profiles to anon, authenticated;
