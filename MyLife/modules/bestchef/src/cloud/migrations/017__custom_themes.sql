-- P15-C (F-029, F-030): named custom theme profiles + share/import scheme.
--
-- Cloud mirror of the local rc_custom_themes table. Each row is a user-named
-- saved ThemeProfile so a chef's custom themes can roam across devices and
-- be exchanged via the JSON / QR share scheme. Local SQLite remains the
-- offline cache; this table is the durable source of truth post-launch.
--
-- Idempotent: every CREATE uses IF NOT EXISTS, policies drop-then-create.

create table if not exists public.bc_custom_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_overrides jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists bc_custom_themes_user_idx
  on public.bc_custom_themes (user_id, created_at desc);

alter table public.bc_custom_themes enable row level security;

drop policy if exists "bc_custom_themes_owner_all" on public.bc_custom_themes;
create policy "bc_custom_themes_owner_all"
  on public.bc_custom_themes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
