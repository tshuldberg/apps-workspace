-- BestChef block-list (App Store Review Guideline 1.2: ability to block abusive users).
-- Server-backed so a block survives reinstall and is enforceable across surfaces.
-- A profile may block another profile; blocked users' content is hidden from the blocker.

create table if not exists public.bc_blocks (
  blocker_id uuid not null references public.social_profiles(id) on delete cascade,
  blocked_id uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists bc_blocks_blocker_idx on public.bc_blocks (blocker_id, created_at desc);
create index if not exists bc_blocks_blocked_idx on public.bc_blocks (blocked_id);

alter table public.bc_blocks enable row level security;

-- A profile may see, create, and remove only its OWN blocks. The select policy keys
-- on the blocker, so a blocked user cannot discover who blocked them.
drop policy if exists "bc_blocks_select" on public.bc_blocks;
create policy "bc_blocks_select" on public.bc_blocks
  for select to authenticated
  using (bc_profile_owned(blocker_id));

drop policy if exists "bc_blocks_insert" on public.bc_blocks;
create policy "bc_blocks_insert" on public.bc_blocks
  for insert to authenticated
  with check (bc_profile_owned(blocker_id));

drop policy if exists "bc_blocks_delete" on public.bc_blocks;
create policy "bc_blocks_delete" on public.bc_blocks
  for delete to authenticated
  using (bc_profile_owned(blocker_id));

grant select, insert, delete on public.bc_blocks to authenticated;
