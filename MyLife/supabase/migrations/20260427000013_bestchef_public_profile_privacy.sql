-- P13-B (F-020): Public profile privacy + public read view.
-- Mirror of modules/bestchef/src/cloud/migrations/011__public_profile_privacy.sql.

alter table public.social_profiles
  add column if not exists is_public boolean not null default true,
  add column if not exists cuisine text,
  add column if not exists region text;

create or replace view public.bc_public_profiles_v as
  select id, handle, display_name, bio, avatar_url, cuisine, region
  from public.social_profiles
  where is_public = true;

grant select on public.bc_public_profiles_v to anon, authenticated;
