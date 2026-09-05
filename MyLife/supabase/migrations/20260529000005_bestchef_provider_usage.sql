-- Durable provider rate limiting + global cost ceiling + kill switch (N-28 / OPS-09).
--
-- The in-memory limiter in supabase/functions/_shared/broker.ts resets per Edge isolate,
-- so a user (or a farm of anonymous accounts) can exceed quotas across cold-started
-- instances and drive unbounded paid Anthropic spend. This adds a Postgres-backed usage
-- ledger, a per-user-per-fn sliding window, a GLOBAL daily call cap, and a manual kill
-- switch, all enforced atomically by bc_consume_provider_quota() (service-role only).

create table if not exists public.bc_provider_usage (
  id bigint generated always as identity primary key,
  user_id text not null,
  fn text not null,
  called_at timestamptz not null default now(),
  usage_day date not null default (now() at time zone 'utc')::date
);
create index if not exists bc_provider_usage_user_fn_idx
  on public.bc_provider_usage (user_id, fn, called_at desc);
create index if not exists bc_provider_usage_day_idx
  on public.bc_provider_usage (usage_day);
alter table public.bc_provider_usage enable row level security;
-- No anon/authenticated policies: only the service role (broker) reads/writes this ledger.

-- Singleton controls row: manual kill switch + global daily call ceiling.
create table if not exists public.bc_provider_controls (
  id boolean primary key default true check (id),
  kill_switch boolean not null default false,
  global_daily_cap integer not null default 50000 check (global_daily_cap >= 0),
  updated_at timestamptz not null default now()
);
insert into public.bc_provider_controls (id) values (true) on conflict (id) do nothing;
alter table public.bc_provider_controls enable row level security;

-- Atomic quota check: logs a usage row and returns allowed=true when within limits,
-- otherwise allowed=false with a reason (kill_switch | user_rate_limit | global_daily_cap).
create or replace function bc_consume_provider_quota(
  p_user_id text,
  p_fn text,
  p_max integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kill boolean;
  v_global_cap integer;
  v_user_count integer;
  v_global_count integer;
begin
  select kill_switch, global_daily_cap into v_kill, v_global_cap
  from public.bc_provider_controls where id = true;

  if coalesce(v_kill, false) then
    return jsonb_build_object('allowed', false, 'reason', 'kill_switch');
  end if;

  select count(*) into v_user_count
  from public.bc_provider_usage
  where user_id = p_user_id and fn = p_fn
    and called_at > now() - make_interval(secs => greatest(p_window_seconds, 1));

  if v_user_count >= greatest(p_max, 0) then
    return jsonb_build_object('allowed', false, 'reason', 'user_rate_limit');
  end if;

  select count(*) into v_global_count
  from public.bc_provider_usage
  where usage_day = (now() at time zone 'utc')::date;

  if v_global_count >= coalesce(v_global_cap, 50000) then
    return jsonb_build_object('allowed', false, 'reason', 'global_daily_cap');
  end if;

  insert into public.bc_provider_usage (user_id, fn) values (p_user_id, p_fn);
  return jsonb_build_object('allowed', true, 'reason', 'ok');
end;
$$;

revoke all on function bc_consume_provider_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function bc_consume_provider_quota(text, text, integer, integer) to service_role;
