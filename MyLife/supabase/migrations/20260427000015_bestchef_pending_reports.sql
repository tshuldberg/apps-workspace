-- BestChef public-launch pending moderation reports queue (B-003).
-- Best-effort cloud backup for moderation reports that failed to insert
-- into bc_flags on first attempt (offline, transient outage). The local
-- rc_pending_reports row is the source of truth; the sweeper retries
-- until the cloud insert succeeds.

create table if not exists public.bc_pending_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  attempt_count int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  synced boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bc_pending_reports enable row level security;

drop policy if exists "owner all" on public.bc_pending_reports;
create policy "owner all" on public.bc_pending_reports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists bc_pending_reports_user_idx
  on public.bc_pending_reports(user_id, created_at desc);

create index if not exists bc_pending_reports_next_attempt_idx
  on public.bc_pending_reports(next_attempt_at)
  where synced = false;
