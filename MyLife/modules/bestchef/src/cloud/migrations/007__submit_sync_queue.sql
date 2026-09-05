-- P11-A: Pending-sync queue for submissions whose cloud write failed (B-005)
-- and proposed dish persistence support columns (F-024).

create table if not exists public.bc_submission_sync_queue (
  local_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  last_error text,
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bc_submission_sync_queue enable row level security;

drop policy if exists "owner all" on public.bc_submission_sync_queue;
create policy "owner all" on public.bc_submission_sync_queue for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.bc_dishes
  add column if not exists proposed_by uuid references public.social_profiles(id) on delete set null,
  add column if not exists proposed_at timestamptz;

create index if not exists bc_dishes_pending_idx on public.bc_dishes (moderation_status)
  where moderation_status = 'pending';
