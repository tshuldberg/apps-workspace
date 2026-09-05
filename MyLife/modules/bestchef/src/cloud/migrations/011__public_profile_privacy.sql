-- P13-B (F-020): Public profile privacy + public read view.
--
-- Adds an is_public flag to social_profiles so chefs can opt out of having
-- their profile shown to logged-out web visitors. Also exposes a minimal
-- read-only view (bc_public_profiles_v) that surfaces only the fields that
-- are safe to render server-side without auth.
--
-- Idempotent: every column/view uses IF NOT EXISTS or CREATE OR REPLACE.

alter table public.social_profiles
  add column if not exists is_public boolean not null default true,
  add column if not exists cuisine text,
  add column if not exists region text;

-- Public read view -- only exposes profiles where is_public = true.
-- Used by the marketing /c/[handle] route on web.
create or replace view public.bc_public_profiles_v as
  select id, handle, display_name, bio, avatar_url, cuisine, region
  from public.social_profiles
  where is_public = true;

grant select on public.bc_public_profiles_v to anon, authenticated;
