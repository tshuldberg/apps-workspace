-- DoWork moderation primitives.
--
-- Mirrors BestChef's moderation shape: authenticated users can file
-- reports, server-side workers (admin/service role) write moderation
-- decisions, and target rows transition to is_hidden=true on uphold.

create table if not exists public.dw_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('share','comment','trainer_video','profile')),
  target_id uuid not null,
  reason text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','dismissed','upheld','escalated')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dw_reports_status_created_idx
  on public.dw_reports (status, created_at);

create index if not exists dw_reports_target_idx
  on public.dw_reports (target_kind, target_id);

alter table public.dw_reports enable row level security;

create policy dw_reports_owner_insert
  on public.dw_reports
  for insert
  with check (auth.uid() = reporter_user_id);

create policy dw_reports_owner_select
  on public.dw_reports
  for select
  using (auth.uid() = reporter_user_id);

create table if not exists public.dw_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.dw_reports(id) on delete cascade,
  decision text not null check (decision in ('dismiss','hide','remove','warn','escalate')),
  rationale text,
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now()
);

create index if not exists dw_moderation_decisions_report_idx
  on public.dw_moderation_decisions (report_id);

alter table public.dw_moderation_decisions enable row level security;

-- No public policies — only service-role workers (or admins via RPC) write.
