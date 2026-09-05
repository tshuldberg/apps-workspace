-- DoWork user blocks (App Review Guideline 1.2, production audit C5).
--
-- One-directional block list. The blocker owns the row; feed and comment
-- queries exclude blocked authors at read time. Owner-only RLS so block
-- lists are private.

create table if not exists public.dw_user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

create index if not exists dw_user_blocks_user_idx
  on public.dw_user_blocks (user_id);

alter table public.dw_user_blocks enable row level security;

create policy dw_user_blocks_owner_select
  on public.dw_user_blocks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy dw_user_blocks_owner_insert
  on public.dw_user_blocks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy dw_user_blocks_owner_delete
  on public.dw_user_blocks
  for delete
  to authenticated
  using (auth.uid() = user_id);
