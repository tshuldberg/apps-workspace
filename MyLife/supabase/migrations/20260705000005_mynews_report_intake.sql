-- MyNews content-report intake lockdown (production audit 2026-07-05, Track 1 P1).
-- nw_reports (bootstrap 20260703000001) shipped an INSERT policy that let ANY
-- session (including anonymous, reporter_id null) insert unvalidated, unlimited
-- reports directly via PostgREST: a metadata-free flood channel that also let a
-- report name a target that does not exist. No client code ever used it; every
-- legitimate report is now written by the mynews-report edge function under the
-- service role, which requires a session, resolves the reporter profile from the
-- JWT sub, validates the target is a real row, dedupes one open report per
-- (reporter, target), and rate-limits per reporter. Close the direct door exactly
-- like the nw_edit_suggestions / nw_article_meta client-guard triggers.
--
-- Dropping the INSERT policy leaves service-role inserts (RLS-exempt) working and
-- keeps nw_reports_reporter_select intact: a reporter still reads only their own
-- rows. Append-only migration: 000001/000002/000003/20260705000001..000004 stay
-- untouched.

drop policy if exists nw_reports_reporter_insert on public.nw_reports;

-- Client-write guard: even with no INSERT policy, defense in depth. An
-- authenticated/anon session can never insert a report directly, and a report
-- with a null reporter_id can never be written (reports are attributable now).
-- The service role (edge) is exempt because current_user is not
-- 'authenticated'/'anon' under the service-role JWT.
create or replace function public.nw_reports_guard_client_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'nw_reports: reports are created only through the mynews-report function';
  end if;
  if new.reporter_id is null then
    raise exception 'nw_reports: an attributable reporter is required';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_reports_insert_guard on public.nw_reports;
create trigger nw_reports_insert_guard
  before insert on public.nw_reports
  for each row execute function public.nw_reports_guard_client_insert();

-- One open report per (reporter, target). Partial unique index so a reporter's
-- resolved (actioned/no_action) report on the same target does not block a new
-- one. The function checks this first for an idempotent 'already-reported'; the
-- index is the race-proof backstop.
create unique index if not exists idx_nw_reports_one_open_per_target
  on public.nw_reports (reporter_id, target_kind, target_id)
  where status = 'open';

-- Per-reporter recency lookup for the rate limit (HEAD count in the edge store).
create index if not exists idx_nw_reports_reporter_recent
  on public.nw_reports (reporter_id, created_at);

-- Service-role insert path. SECURITY DEFINER so mynews-report calls it via
-- PostgREST rpc; the definer runs as the table owner (service-role-equivalent),
-- bypassing the client guard above. The edge function has ALREADY resolved the
-- reporter profile, validated the target, deduped, and rate-limited; this RPC
-- just persists the attributable report. reporter_id is never null here.
create or replace function public.nw_insert_report(
  p_reporter_id uuid,
  p_target_kind text,
  p_target_id text,
  p_reason text,
  p_detail text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reporter_id is null then
    return 'bad-payload';
  end if;
  insert into public.nw_reports (reporter_id, target_kind, target_id, reason, detail)
  values (p_reporter_id, p_target_kind, p_target_id, p_reason, coalesce(p_detail, ''))
  on conflict (reporter_id, target_kind, target_id) where status = 'open' do nothing;
  return 'ok';
end;
$$;

revoke all on function public.nw_insert_report(uuid, text, text, text, text) from public;
revoke all on function public.nw_insert_report(uuid, text, text, text, text) from anon, authenticated;
grant execute on function public.nw_insert_report(uuid, text, text, text, text) to service_role;
