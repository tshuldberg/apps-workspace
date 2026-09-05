-- MyNews block / mute list (production audit 2026-07-05, Track 1 P2).
-- Apple Guideline 1.2 requires a UGC app to let a user block an abusive author
-- so they stop seeing that author's content. A block is a personal, self-scoped
-- list exactly like nw_follows: the blocker fully owns their own rows and the
-- blocked user can never learn who blocked them. It is device/account-private
-- and never leaves the blocker, so (unlike nw_reports) a client CAN own it
-- directly. We therefore model the RLS on nw_follows_self_all, NOT on the
-- service-role client-write-guard pattern.
--
-- Enforcement (hiding a blocked author's articles + suggestions from the
-- blocker) is an app-side, signed-in concern: the block set lives in this table
-- and the app filters its Today feed, article suggestion lists, and suggestion
-- threads against it. The public web reader has no viewer identity, so it never
-- filters by a viewer's block list. Append-only migration: 20260703000001..000003
-- and 20260705000001..000005 stay untouched.

create table if not exists public.nw_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.nw_profiles (id) on delete cascade,
  blocked_profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  mode text not null default 'block' check (mode in ('block', 'mute')),
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_profile_id)
);
alter table public.nw_blocks enable row level security;

-- Self-scoped and private, mirroring nw_follows_self_all: the owner (the blocker)
-- fully manages their own rows for every operation, and no other session can
-- read them. The blocked user can never see who blocked them because the only
-- SELECT path is auth.uid() = the blocker's own user_id.
create policy nw_blocks_self_all on public.nw_blocks
  for all using (
    auth.uid() = (select user_id from public.nw_profiles where id = blocker_id)
  ) with check (
    auth.uid() = (select user_id from public.nw_profiles where id = blocker_id)
  );

-- The blocker reads their own list keyed by blocker_id; index it.
create index if not exists idx_nw_blocks_blocker on public.nw_blocks (blocker_id, created_at);
