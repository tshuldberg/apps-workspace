-- Yearn moderation operations: report-threshold auto-hide and the
-- service-role RPC surface consumed by the yearn-moderation edge function.
-- Completes plan 47 Phase 3 item 2 (operational queue workflow).
-- Idempotent and safely re-runnable after 20260712000004.

-- =========================================
-- REPORT THRESHOLD AUTO-HIDE
-- =========================================
-- Underage reports already auto-hide via yearn.handle_underage_report.
-- Other report reasons auto-hide only once several DISTINCT reporters file
-- within a rolling window, so a single hostile reporter cannot take a
-- profile down (dogpile abuse is bounded by the per-reporter rate limits
-- from 20260712000003).
create or replace function yearn.handle_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_distinct_reporters int;
  v_hidden boolean := false;
begin
  -- Underage reports take the immediate path in handle_underage_report.
  if new.reason = 'underage' then
    return new;
  end if;

  select count(distinct r.reporter_id)
    into v_distinct_reporters
  from yearn.reports r
  where r.reported_id = new.reported_id
    and r.status in ('open', 'reviewing')
    and r.created_at > new.created_at - interval '24 hours';

  if v_distinct_reporters < 3 then
    return new;
  end if;

  update yearn.profiles
  set moderation_status = 'hidden_pending_review'
  where id = new.reported_id
    and moderation_status = 'active'
  returning true into v_hidden;

  if v_hidden then
    insert into yearn.moderation_actions (
      report_id,
      target_user_id,
      actor,
      action,
      reason,
      detail
    ) values (
      new.id,
      new.reported_id,
      'system:auto',
      'hide_pending_review',
      'Report threshold reached; profile hidden pending review',
      jsonb_build_object(
        'source', 'report_threshold',
        'distinct_reporters_24h', v_distinct_reporters
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reports_threshold_autohide on yearn.reports;
create trigger reports_threshold_autohide
after insert on yearn.reports
for each row execute function yearn.handle_report_threshold();

revoke all on function yearn.handle_report_threshold()
  from public, anon, authenticated;

-- =========================================
-- SERVICE-ROLE OPS RPCS (yearn-moderation edge function surface)
-- =========================================
create or replace function yearn.list_reports(
  p_status text default null,
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  id uuid,
  reporter_id uuid,
  reported_id uuid,
  reported_display_name text,
  reported_moderation_status text,
  reason text,
  details text,
  status text,
  reviewed_at timestamptz,
  reviewed_by text,
  resolution_note text,
  escalation_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    r.id,
    r.reporter_id,
    r.reported_id,
    p.display_name,
    p.moderation_status,
    r.reason,
    r.details,
    r.status,
    r.reviewed_at,
    r.reviewed_by,
    r.resolution_note,
    e.status,
    r.created_at
  from yearn.reports r
  left join yearn.profiles p on p.id = r.reported_id
  left join yearn.safety_escalations e on e.report_id = r.id
  where (p_status is null or r.status = p_status)
    and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function yearn.list_reports(text, int, timestamptz)
  from public, anon, authenticated;
grant execute on function yearn.list_reports(text, int, timestamptz)
  to service_role;

create or replace function yearn.get_report_detail(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = yearn, public
as $$
declare
  v_report jsonb;
  v_actions jsonb;
  v_escalation jsonb;
begin
  select to_jsonb(x)
    into v_report
  from (
    select
      r.id,
      r.reporter_id,
      r.reported_id,
      p.display_name as reported_display_name,
      p.moderation_status as reported_moderation_status,
      p.suspended_until as reported_suspended_until,
      r.reason,
      r.details,
      r.status,
      r.reviewed_at,
      r.reviewed_by,
      r.resolution_note,
      r.created_at
    from yearn.reports r
    left join yearn.profiles p on p.id = r.reported_id
    where r.id = p_report_id
  ) x;

  if v_report is null then
    raise exception 'get_report_detail: report % not found', p_report_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_actions
  from yearn.moderation_actions a
  where a.report_id = p_report_id;

  select to_jsonb(e)
    into v_escalation
  from yearn.safety_escalations e
  where e.report_id = p_report_id;

  return jsonb_build_object(
    'report', v_report,
    'actions', v_actions,
    'escalation', v_escalation
  );
end;
$$;

revoke all on function yearn.get_report_detail(uuid)
  from public, anon, authenticated;
grant execute on function yearn.get_report_detail(uuid)
  to service_role;

create or replace function yearn.list_safety_escalations(
  p_status text default null,
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  id uuid,
  report_id uuid,
  target_user_id uuid,
  kind text,
  status text,
  evidence jsonb,
  detected_at timestamptz,
  transmitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    e.id,
    e.report_id,
    e.target_user_id,
    e.kind,
    e.status,
    e.evidence,
    e.detected_at,
    e.transmitted_at,
    e.created_at,
    e.updated_at
  from yearn.safety_escalations e
  where (p_status is null or e.status = p_status)
    and (p_before is null or e.detected_at < p_before)
  order by e.detected_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function yearn.list_safety_escalations(text, int, timestamptz)
  from public, anon, authenticated;
grant execute on function yearn.list_safety_escalations(text, int, timestamptz)
  to service_role;

-- advance_safety_escalation moves the workflow seam forward. It can never
-- write 'transmitted': that transition requires registered ESP status under
-- 18 U.S.C. 2258A and a separately authored migration (see 20260712000004).
-- The safety_escalations_immutability trigger enforces the same rule as
-- defense in depth.
create or replace function yearn.advance_safety_escalation(
  p_escalation_id uuid,
  p_new_status text,
  p_operator text
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_target_user_id uuid;
  v_report_id uuid;
  v_old_status text;
begin
  if p_new_status is null
     or p_new_status not in ('ready_for_transmission', 'dismissed') then
    raise exception
      'advance_safety_escalation: invalid status % (transmitted requires registered ESP status; founder item)',
      p_new_status;
  end if;

  if p_operator is null or btrim(p_operator) = '' then
    raise exception 'advance_safety_escalation: operator is required';
  end if;

  select e.target_user_id, e.report_id, e.status
    into v_target_user_id, v_report_id, v_old_status
  from yearn.safety_escalations e
  where e.id = p_escalation_id
  for update;

  if not found then
    raise exception 'advance_safety_escalation: escalation % not found', p_escalation_id;
  end if;

  update yearn.safety_escalations
  set status = p_new_status
  where id = p_escalation_id;

  if v_target_user_id is not null then
    insert into yearn.moderation_actions (
      report_id,
      target_user_id,
      actor,
      action,
      reason,
      detail
    ) values (
      v_report_id,
      v_target_user_id,
      btrim(p_operator),
      'warn',
      null,
      jsonb_build_object(
        'event', 'escalation_status_change',
        'previous_status', v_old_status,
        'new_status', p_new_status
      )
    );
  end if;
end;
$$;

revoke all on function yearn.advance_safety_escalation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function yearn.advance_safety_escalation(uuid, text, text)
  to service_role;
