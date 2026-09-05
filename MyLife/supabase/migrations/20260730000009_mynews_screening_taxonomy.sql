-- MyNews pre-publication screening, report taxonomy expansion, and the
-- journalist verification center (plan 48 WP8; audit findings H01, H02, D).
--
-- Three things land together because they share one severity vocabulary:
--
--   1. Screening. Publish, suggest, review, and comment now run a deterministic
--      local screening engine before the store write. High-risk content is
--      stored NON-PUBLIC and a decision row is created in the same transaction,
--      so there is no state where content is held without an audit row or
--      audited without being held. Human review approves or rejects; the author
--      can appeal. False-positive and false-negative rates are measurable from
--      the decision rows themselves.
--
--   2. Taxonomy. WP1 shipped a seven-reason report vocabulary and an immutable
--      severity rank. Six reasons are added (child-safety, hate, self-harm,
--      doxxing-privacy, fraud-scam, threats) with child-safety at the NCII tier,
--      and the NCII urgent case lane generalizes into an urgent lane that
--      child-safety shares at a 24 hour deadline. An SLA routing table becomes
--      the single source for every deadline, replacing the hardcoded 48.
--
--   3. Verification center. nw_journalist_verifications existed as a table with
--      no workflow. It gains the full lifecycle (request, approve with expiry,
--      deny with reason, revoke, re-verify, expire), the journalist tier follows
--      the verification state instead of being set by hand, and the verification
--      state becomes a credibility input alongside account age and coordinated
--      endorsement ring suspicion.
--
-- Quarantine representation (important): a held article stays status 'draft'
-- and carries screening_status = 'quarantined'. Every existing public read path
-- in migrations 20260703000001 and 20260703000003 excludes drafts already, so
-- adding a new status value would have been the risky change: it would have
-- silently satisfied a dozen "status <> 'draft'" predicates. Held revisions on
-- an already published article carry their own screening_status and do NOT
-- advance nw_articles.current_rev, so readers keep seeing the last cleared
-- revision. Only three existing public policies need tightening, all below.
--
-- Fail-closed invariants:
--   quarantine and its audit row commit together or not at all
--   an approval that cannot safely release content reports 'stale-rev' rather
--     than publishing something whose head moved underneath it
--   child-safety and self-harm classes are human-only: no automated path clears
--     them, and no vendor verdict can lower a local class score
--   a child-safety report opens an urgent case or the whole submission rolls back
--
-- Append-only: migrations 20260703000001 through 20260730000007 are untouched.
-- Policies and functions this migration supersedes are dropped and recreated
-- here by name.

-- ############################################################################
-- SECTION 1: report taxonomy and SLA routing
-- ############################################################################

-- ---------------------------------------------------------------- reason set

-- The bootstrap inline CHECK is auto-named nw_reports_reason_check. Guarded
-- drop-and-replace so re-running this migration is safe and so the widened
-- constraint carries an explicit name.
do $$
begin
  alter table public.nw_reports drop constraint if exists nw_reports_reason_check;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_reports_reason_taxonomy_v2'
      and conrelid = 'public.nw_reports'::regclass
  ) then
    alter table public.nw_reports
      add constraint nw_reports_reason_taxonomy_v2
      check (reason in (
        'child-safety',
        'ncii',
        'threats',
        'violence',
        'self-harm',
        'hate',
        'harassment',
        'impersonation',
        'doxxing-privacy',
        'fraud-scam',
        'copyright',
        'spam',
        'other'
      ));
  end if;
end;
$$;

-- ------------------------------------------------------------- SLA routing

-- Class to deadline routing. This table is the single source of truth for
-- report deadlines: the urgent case lane reads deadline_hours from it instead
-- of hardcoding 48, and the console reads it for aging badges. Twin:
-- REPORT_SLA_HOURS / REPORT_URGENT_REASONS in modules/mynews/src/data/report.ts
-- and the edge mirror in supabase/functions/_shared/mynews-store.ts, both
-- drift-pinned against this seed by report-taxonomy-migration.test.ts.
create table if not exists public.nw_report_sla (
  reason text primary key,
  deadline_hours integer not null check (deadline_hours > 0),
  lane text not null check (lane in ('urgent', 'standard')),
  updated_at timestamptz not null default now()
);
alter table public.nw_report_sla enable row level security;
revoke all on table public.nw_report_sla from public, anon, authenticated;

insert into public.nw_report_sla (reason, deadline_hours, lane) values
  ('child-safety', 24, 'urgent'),
  ('ncii', 48, 'urgent'),
  ('threats', 24, 'standard'),
  ('violence', 24, 'standard'),
  ('self-harm', 24, 'standard'),
  ('doxxing-privacy', 48, 'standard'),
  ('hate', 72, 'standard'),
  ('harassment', 72, 'standard'),
  ('impersonation', 72, 'standard'),
  ('fraud-scam', 72, 'standard'),
  ('copyright', 240, 'standard'),
  ('spam', 168, 'standard'),
  ('other', 168, 'standard')
on conflict (reason) do update
  set deadline_hours = excluded.deadline_hours,
      lane = excluded.lane,
      updated_at = now();

-- Deadline hours for a reason. Unknown reasons fall back to the tightest
-- deadline in the table rather than a permissive default: an unrouted safety
-- report must not sit longer than a routed one.
create or replace function public.nw_report_sla_hours(p_reason text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select deadline_hours from public.nw_report_sla where reason = p_reason),
    (select min(deadline_hours) from public.nw_report_sla)
  );
$$;

revoke all on function public.nw_report_sla_hours(text) from public, anon, authenticated;
grant execute on function public.nw_report_sla_hours(text) to service_role;

/* True for reasons that open an urgent case with a statutory-style clock. */
create or replace function public.nw_report_reason_is_urgent(p_reason text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nw_report_sla where reason = p_reason and lane = 'urgent'
  );
$$;

revoke all on function public.nw_report_reason_is_urgent(text) from public, anon, authenticated;
grant execute on function public.nw_report_reason_is_urgent(text) to service_role;

-- ---------------------------------------------------------- severity rank

-- Twin of REPORT_SEVERITY_RANK in modules/mynews/src/data/report.ts and the
-- Deno constant in supabase/functions/_shared/mynews-store.ts. WP1 rank
-- (ncii 100 > violence 80 > harassment = impersonation 60 > copyright 40 >
-- spam = other 20) is preserved exactly; the six new reasons are inserted at
-- the tier the plan dictates, with child-safety at the NCII tier.
create or replace function public.nw_report_severity_rank(p_reason text)
returns integer
language sql
immutable
security definer
set search_path = public
as $$
  select case p_reason
    when 'child-safety' then 100
    when 'ncii' then 100
    when 'threats' then 80
    when 'violence' then 80
    when 'self-harm' then 70
    when 'hate' then 60
    when 'harassment' then 60
    when 'impersonation' then 60
    when 'doxxing-privacy' then 60
    when 'copyright' then 40
    when 'fraud-scam' then 40
    when 'spam' then 20
    when 'other' then 20
    else 0
  end;
$$;

revoke all on function public.nw_report_severity_rank(text) from public, anon, authenticated;
grant execute on function public.nw_report_severity_rank(text) to service_role;

-- ------------------------------------------------------------- urgent lane

-- nw_ncii_cases becomes the shared urgent case table rather than an
-- NCII-only one. case_class distinguishes the lanes so the console and the
-- worker can label them honestly; existing rows are NCII by construction.
alter table public.nw_ncii_cases
  add column if not exists case_class text not null default 'ncii';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_ncii_cases_case_class_check'
      and conrelid = 'public.nw_ncii_cases'::regclass
  ) then
    alter table public.nw_ncii_cases
      add constraint nw_ncii_cases_case_class_check
      check (case_class in ('ncii', 'child-safety'));
  end if;
end;
$$;

create index if not exists idx_nw_ncii_cases_class_deadline
  on public.nw_ncii_cases (case_class, deadline_at)
  where status <> 'cleared';

-- Generalized urgent-case repair. This is the WP1 nw_reconcile_ncii_case body
-- with three changes: the reason set comes from the SLA lane instead of the
-- literal 'ncii', the deadline comes from nw_report_sla instead of a literal
-- 48, and case_class records which lane opened the case. The deadline stays
-- anchored to the ORIGINAL report time, so reconciliation never restarts the
-- clock. Advisory locking keeps concurrent worker runs idempotent, and the lock
-- key keeps the WP1 'nw-ncii:' prefix so an in-flight WP1 intake and this
-- function still serialize against each other.
create or replace function public.nw_reconcile_urgent_case(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid;
  v_kind text;
  v_id text;
  v_reason text;
  v_report_created_at timestamptz;
  v_status text := 'queued';
  v_existing uuid;
  v_case_id uuid;
  v_article_uuid uuid;
  v_suggestion_uuid uuid;
  v_deadline_hours integer;
  v_label text;
begin
  select reporter_id, target_kind, target_id, reason
    into v_reporter_id, v_kind, v_id, v_reason
  from public.nw_reports
  where id = p_report_id
    and status = 'open'
    and public.nw_report_reason_is_urgent(reason);
  if v_kind is null then
    return 'not-urgent';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'nw-ncii:' || coalesce(v_reporter_id::text, '') || ':' || v_kind || ':' || v_id,
      0
    )
  );

  select target_kind, target_id, reason, created_at
    into v_kind, v_id, v_reason, v_report_created_at
  from public.nw_reports
  where id = p_report_id
    and status = 'open'
    and public.nw_report_reason_is_urgent(reason)
  for update;
  if v_kind is null then
    return 'not-urgent';
  end if;

  select id into v_existing
  from public.nw_ncii_cases
  where report_id = p_report_id and status <> 'cleared'
  limit 1
  for update;
  if v_existing is not null then
    return 'exists';
  end if;

  v_deadline_hours := public.nw_report_sla_hours(v_reason);
  v_label := case
    when v_reason = 'child-safety' then 'CHILD SAFETY: automatic takedown pending human review'
    else 'TAKE IT DOWN: automatic NCII takedown pending human review'
  end;

  if v_kind in ('article', 'revision') then
    begin
      v_article_uuid := v_id::uuid;
    exception when others then
      v_article_uuid := null;
    end;
    if v_article_uuid is not null then
      update public.nw_articles set status = 'retracted' where id = v_article_uuid;
      if found then
        v_status := 'removed';
        insert into public.nw_moderation_actions
          (report_id, moderator_ref, action, target_kind, target_id, note)
        values
          (p_report_id, 'ncii-auto', 'hide_article', 'article', v_id, v_label);
      end if;
    end if;
  elsif v_kind = 'suggestion' then
    begin
      v_suggestion_uuid := v_id::uuid;
    exception when others then
      v_suggestion_uuid := null;
    end;
    if v_suggestion_uuid is not null then
      update public.nw_edit_suggestions set status = 'rejected' where id = v_suggestion_uuid;
      if found then
        v_status := 'removed';
        insert into public.nw_moderation_actions
          (report_id, moderator_ref, action, target_kind, target_id, note)
        values
          (p_report_id, 'ncii-auto', 'hide_suggestion', 'suggestion', v_id, v_label);
      end if;
    end if;
  end if;

  insert into public.nw_ncii_cases
    (report_id, target_kind, target_id, deadline_at, status, case_class)
  values
    (p_report_id, v_kind, v_id,
     v_report_created_at + make_interval(hours => v_deadline_hours),
     v_status,
     case when v_reason = 'child-safety' then 'child-safety' else 'ncii' end)
  on conflict (report_id) where status <> 'cleared' do nothing
  returning id into v_case_id;

  if v_case_id is null then
    return 'exists';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.nw_reconcile_urgent_case(uuid) from public, anon, authenticated;
grant execute on function public.nw_reconcile_urgent_case(uuid) to service_role;

-- The WP1 entry point keeps its name, signature, and return vocabulary
-- ('ok' | 'exists' | 'not-ncii') because the store, the worker, and their tests
-- depend on it. It now delegates, so there is exactly one urgent-case
-- implementation.
create or replace function public.nw_reconcile_ncii_case(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome text;
begin
  select public.nw_reconcile_urgent_case(p_report_id) into v_outcome;
  if v_outcome = 'not-urgent' then
    return 'not-ncii';
  end if;
  return v_outcome;
end;
$$;

revoke all on function public.nw_reconcile_ncii_case(uuid) from public, anon, authenticated;
grant execute on function public.nw_reconcile_ncii_case(uuid) to service_role;

-- ------------------------------------------------------------ atomic intake

-- WP1's nw_submit_report with the widened reason vocabulary and the urgent
-- branch generalized. Everything else is byte-for-byte the WP1 behavior:
-- target validation, severity-aware dedupe and escalation, the escalation
-- audit row, and the all-or-nothing urgent case.
create or replace function public.nw_submit_report(
  p_reporter_profile_id uuid,
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
declare
  v_target_uuid uuid;
  v_target_exists boolean := false;
  v_report_id uuid;
  v_existing_reason text;
  v_existing_detail text;
  v_outcome text := 'submitted';
  v_urgent_outcome text;
  v_is_urgent boolean;
begin
  if p_target_kind is null or p_target_kind not in (
    'article', 'revision', 'suggestion', 'profile', 'media'
  ) then
    return 'bad-target';
  end if;

  begin
    v_target_uuid := p_target_id::uuid;
  exception when others then
    v_target_uuid := null;
  end;
  if v_target_uuid is null then
    return 'bad-target';
  end if;

  if p_target_kind in ('article', 'revision') then
    select true into v_target_exists
    from public.nw_articles
    where id = v_target_uuid;
  elsif p_target_kind = 'suggestion' then
    select true into v_target_exists
    from public.nw_edit_suggestions
    where id = v_target_uuid;
  elsif p_target_kind = 'profile' then
    select true into v_target_exists
    from public.nw_profiles
    where id = v_target_uuid;
  elsif p_target_kind = 'media' then
    select true into v_target_exists
    from public.nw_media_assets
    where id = v_target_uuid;
  end if;
  if not coalesce(v_target_exists, false) then
    return 'bad-target';
  end if;

  if p_reporter_profile_id is null or not exists (
    select 1 from public.nw_profiles where id = p_reporter_profile_id
  ) then
    raise exception 'nw_submit_report: reporter profile not found';
  end if;
  -- The reason vocabulary is the SLA table, so a routed reason and an accepted
  -- reason can never drift apart: a reason with no deadline row is rejected.
  if p_reason is null or not exists (
    select 1 from public.nw_report_sla where reason = p_reason
  ) then
    raise exception 'nw_submit_report: unsupported reason';
  end if;

  v_is_urgent := public.nw_report_reason_is_urgent(p_reason);

  -- Match the reconciliation lock order before taking the report row lock, so
  -- an intake upgrade and an orphan worker cannot deadlock each other.
  if v_is_urgent then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'nw-ncii:' || p_reporter_profile_id::text || ':' || p_target_kind || ':' || p_target_id,
        0
      )
    );
  end if;

  -- Serialize the exact partial-unique-index dimension before reading it.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_reporter_profile_id::text || ':' || p_target_kind || ':' || p_target_id,
      0
    )
  );

  select id, reason, detail
    into v_report_id, v_existing_reason, v_existing_detail
  from public.nw_reports
  where reporter_id = p_reporter_profile_id
    and target_kind = p_target_kind
    and target_id = p_target_id
    and status = 'open'
  limit 1
  for update;

  if v_report_id is null then
    insert into public.nw_reports
      (reporter_id, target_kind, target_id, reason, detail, status)
    values
      (p_reporter_profile_id, p_target_kind, p_target_id, p_reason,
       coalesce(p_detail, ''), 'open')
    returning id into v_report_id;
  else
    if public.nw_report_severity_rank(v_existing_reason)
       >= public.nw_report_severity_rank(p_reason) then
      return 'already-reported';
    end if;

    update public.nw_reports
      set reason = p_reason,
          detail = coalesce(v_existing_detail, '') || E'\n---escalated---\n' || coalesce(p_detail, '')
      where id = v_report_id;

    insert into public.nw_report_escalations
      (report_id, from_reason, to_reason, prior_detail, escalated_detail)
    values
      (v_report_id, v_existing_reason, p_reason,
       coalesce(v_existing_detail, ''), coalesce(p_detail, ''));
    v_outcome := 'escalated';
  end if;

  if v_is_urgent then
    select public.nw_reconcile_urgent_case(v_report_id) into v_urgent_outcome;
    if v_urgent_outcome is null or v_urgent_outcome not in ('ok', 'exists') then
      raise exception 'nw_submit_report: urgent case creation failed (%)', v_urgent_outcome;
    end if;
  end if;

  return v_outcome;
end;
$$;

revoke all on function public.nw_submit_report(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_submit_report(uuid, text, text, text, text)
  to service_role;

-- --------------------------------------------------------------- orphan scan

-- Orphan scan across every urgent reason, not just NCII. Name and shape are
-- unchanged so the worker keeps compiling.
create or replace function public.nw_find_orphaned_ncii_reports()
returns table (report_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select r.id as report_id
  from public.nw_reports r
  where r.status = 'open'
    and public.nw_report_reason_is_urgent(r.reason)
    and not exists (
      select 1
      from public.nw_ncii_cases c
      where c.report_id = r.id and c.status <> 'cleared'
    )
  order by r.created_at asc;
$$;

revoke all on function public.nw_find_orphaned_ncii_reports()
  from public, anon, authenticated;
grant execute on function public.nw_find_orphaned_ncii_reports()
  to service_role;

create or replace function public.nw_run_ncii_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_pending integer;
begin
  select value into v_url from public.nw_job_config where key = 'functions_base_url';
  select value into v_secret from public.nw_job_config where key = 'ncii_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.nw_ncii_cases
  where status in ('queued', 'escalated');

  if v_pending = 0 then
    select count(*) into v_pending
    from public.nw_reports r
    where r.status = 'open'
      and public.nw_report_reason_is_urgent(r.reason)
      and not exists (
        select 1 from public.nw_ncii_cases c
        where c.report_id = r.id and c.status <> 'cleared'
      );
  end if;
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/mynews-ncii-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MyNews-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'nw_run_ncii_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.nw_run_ncii_worker() from public, anon, authenticated;
grant execute on function public.nw_run_ncii_worker() to service_role;

-- ############################################################################
-- SECTION 2: screening quarantine
-- ############################################################################

-- ------------------------------------------------------- content hold columns

-- Note on nw_articles.screening_status: it is a LABEL for operators, not an
-- access control. What keeps a held article non-public is that it stays
-- status = 'draft', and what keeps a held revision non-public is the revision's
-- own screening_status, which the public policy below filters on. The
-- authoritative hold record is always the nw_screening_decisions row. Reading
-- the article label as a permission would be a mistake: an author who publishes
-- DIFFERENT, screened text over a held draft goes through nw_publish_article,
-- which correctly makes the article public while the held revision stays hidden,
-- and that path does not know about this column.
alter table public.nw_articles
  add column if not exists screening_status text not null default 'cleared';
alter table public.nw_article_revisions
  add column if not exists screening_status text not null default 'cleared';
alter table public.nw_suggestion_events
  add column if not exists screening_status text not null default 'cleared';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_articles_screening_status_check'
      and conrelid = 'public.nw_articles'::regclass
  ) then
    alter table public.nw_articles
      add constraint nw_articles_screening_status_check
      check (screening_status in ('cleared', 'quarantined', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_article_revisions_screening_status_check'
      and conrelid = 'public.nw_article_revisions'::regclass
  ) then
    alter table public.nw_article_revisions
      add constraint nw_article_revisions_screening_status_check
      check (screening_status in ('cleared', 'quarantined', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_suggestion_events_screening_status_check'
      and conrelid = 'public.nw_suggestion_events'::regclass
  ) then
    alter table public.nw_suggestion_events
      add constraint nw_suggestion_events_screening_status_check
      check (screening_status in ('cleared', 'quarantined', 'rejected'));
  end if;
end;
$$;

-- Suggestions carry the hold in their existing status column, because every
-- read path already filters on it ('open' for the queue and the dupe scan,
-- accepted/partial/rejected for the aggregates), so 'quarantined' is excluded
-- from all of them by construction.
do $$
begin
  alter table public.nw_edit_suggestions drop constraint if exists nw_edit_suggestions_status_check;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_edit_suggestions_status_check_v2'
      and conrelid = 'public.nw_edit_suggestions'::regclass
  ) then
    alter table public.nw_edit_suggestions
      add constraint nw_edit_suggestions_status_check_v2
      check (status in ('open', 'accepted', 'partial', 'rejected', 'stale', 'quarantined'));
  end if;
end;
$$;

-- --------------------------------------------------------- policy tightening

-- Held revisions on a published article: the article is still public, so the
-- revision policy is the only thing standing between a quarantined revision and
-- every reader. Owner reads are unaffected (nw_article_revisions_owner_select
-- from 20260703000003 has no screening predicate, on purpose: an author must be
-- able to see what is being held).
drop policy if exists nw_article_revisions_public_select on public.nw_article_revisions;
create policy nw_article_revisions_public_select on public.nw_article_revisions
  for select using (
    screening_status = 'cleared'
    and exists (
      select 1 from public.nw_articles a
      where a.id = article_id and a.status <> 'draft'
    )
  );

-- Held suggestions. The bootstrap policy filtered on the article only.
drop policy if exists nw_edit_suggestions_public_select on public.nw_edit_suggestions;
create policy nw_edit_suggestions_public_select on public.nw_edit_suggestions
  for select using (
    status <> 'quarantined'
    and exists (
      select 1 from public.nw_articles a
      where a.id = article_id and a.status <> 'draft'
    )
  );

-- An editor must be able to see their own held suggestion, which the bootstrap
-- policy set never allowed (there was no editor self-select at all).
drop policy if exists nw_edit_suggestions_editor_select on public.nw_edit_suggestions;
create policy nw_edit_suggestions_editor_select on public.nw_edit_suggestions
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = editor_id)
  );

-- Held comments, on both the public arm and the newsroom-member arm from
-- 20260703000003. A held comment is visible to nobody but its author and the
-- console until a human clears it.
drop policy if exists nw_suggestion_events_public_select on public.nw_suggestion_events;
create policy nw_suggestion_events_public_select on public.nw_suggestion_events
  for select using (
    screening_status = 'cleared'
    and exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = suggestion_id and a.status <> 'draft'
    )
  );

drop policy if exists nw_suggestion_events_newsroom_member_select on public.nw_suggestion_events;
create policy nw_suggestion_events_newsroom_member_select on public.nw_suggestion_events
  for select using (
    screening_status = 'cleared'
    and exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = suggestion_id
        and a.status = 'draft'
        and a.newsroom_id is not null
        and public.nw_is_newsroom_member(a.newsroom_id, auth.uid())
    )
  );

drop policy if exists nw_suggestion_events_actor_select on public.nw_suggestion_events;
create policy nw_suggestion_events_actor_select on public.nw_suggestion_events
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = actor_id)
  );

create index if not exists idx_nw_article_revisions_screening
  on public.nw_article_revisions (article_id, screening_status)
  where screening_status <> 'cleared';
create index if not exists idx_nw_suggestion_events_screening
  on public.nw_suggestion_events (suggestion_id, screening_status)
  where screening_status <> 'cleared';
create index if not exists idx_nw_edit_suggestions_quarantined
  on public.nw_edit_suggestions (article_id, created_at)
  where status = 'quarantined';

-- ------------------------------------------------------- decision audit table

-- One row per screening verdict that matters: every hold, and every allow whose
-- score cleared the record threshold. The generated columns turn the audit trail
-- into the false-positive and false-negative measurement the plan requires,
-- with no separate metrics pipeline to drift out of sync.
create table if not exists public.nw_screening_decisions (
  id uuid primary key default gen_random_uuid(),
  content_kind text not null check (
    content_kind in ('article', 'revision', 'suggestion', 'comment', 'revision-proposal')
  ),
  /* article id, suggestion id, or suggestion event id. Text, matching nw_reports.target_id. */
  content_id text not null,
  /* Revision number for article and revision kinds, else null. */
  content_rev integer,
  author_profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  /* sha256 of the exact screened bytes, used to key post-approval allowances. */
  content_sha256 text not null default '',
  engine_version text not null,
  provider text not null default 'local',
  provider_state text not null default 'unconfigured' check (
    provider_state in ('unconfigured', 'scored', 'declined', 'failed', 'timed-out')
  ),
  risk_score numeric(4, 3) not null check (risk_score >= 0 and risk_score <= 1),
  top_class text,
  class_scores jsonb not null default '{}',
  threshold_hit text,
  requires_human_review boolean not null default false,
  signals jsonb not null default '[]',
  explanations jsonb not null default '[]',
  /* What the engine did: allowed and recorded, held non-public, or held a proposal. */
  auto_action text not null check (auto_action in ('allowed', 'quarantined', 'held')),
  decision text not null default 'pending' check (
    decision in ('pending', 'approved', 'rejected', 'auto-allowed')
  ),
  reviewer_ref text,
  reviewed_at timestamptz,
  review_reason text not null default '',
  appeal_state text not null default 'none' check (
    appeal_state in ('none', 'requested', 'granted', 'denied')
  ),
  appeal_reason text not null default '',
  appeal_reviewer_ref text,
  appeal_decided_at timestamptz,
  /* For 'revision-proposal' holds: the flagged revision envelope, so a reviewer
     can read exactly what was refused without it existing as content. */
  held_payload jsonb,
  /* Shingle signature of the screened text, so a reviewer can see how close a
     held submission is to the author's other work. */
  content_signature jsonb,
  /* Measurement. A hold a human approves was a false positive; a hold a human
     rejects was a true positive; a recorded allow a human later rejects was a
     false negative. */
  is_false_positive boolean generated always as (
    auto_action <> 'allowed' and decision = 'approved'
  ) stored,
  is_true_positive boolean generated always as (
    auto_action <> 'allowed' and decision = 'rejected'
  ) stored,
  is_false_negative boolean generated always as (
    auto_action = 'allowed' and decision = 'rejected'
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nw_screening_decisions enable row level security;
revoke all on table public.nw_screening_decisions from public, anon, authenticated;

create index if not exists idx_nw_screening_decisions_pending
  on public.nw_screening_decisions (created_at)
  where decision = 'pending';
create index if not exists idx_nw_screening_decisions_appeals
  on public.nw_screening_decisions (created_at)
  where appeal_state = 'requested';
create index if not exists idx_nw_screening_decisions_author
  on public.nw_screening_decisions (author_profile_id, created_at desc);
create index if not exists idx_nw_screening_decisions_content
  on public.nw_screening_decisions (content_kind, content_id);
create index if not exists idx_nw_screening_decisions_measurement
  on public.nw_screening_decisions (top_class, created_at);

-- Author self-read, WP3 pattern: an owner-rights security-barrier view scoped
-- to the caller's own profile, granted to authenticated, instead of a client
-- policy on the base table. The view deliberately omits signals, class scores,
-- and thresholds: an author is entitled to know their content is held, which
-- class held it, and how to appeal, but handing them the detector's internals
-- turns the appeal screen into an evasion oracle.
create or replace view public.nw_my_screening_decisions
with (security_barrier = true) as
select
  d.id,
  d.content_kind,
  d.content_id,
  d.content_rev,
  d.auto_action,
  d.decision,
  d.top_class,
  d.requires_human_review,
  d.review_reason,
  d.appeal_state,
  d.appeal_reason,
  d.created_at,
  d.reviewed_at,
  d.appeal_decided_at
from public.nw_screening_decisions d
join public.nw_profiles p on p.id = d.author_profile_id
where p.user_id = auth.uid()
  and d.auto_action <> 'allowed';

grant select on public.nw_my_screening_decisions to authenticated;

-- Aggregate measurement, service role only. Rates are only meaningful over
-- dispositioned rows, so pending holds are counted separately rather than
-- silently treated as correct.
create or replace view public.nw_screening_measurement as
select
  coalesce(top_class, 'none') as top_class,
  count(*) filter (where auto_action <> 'allowed') as holds,
  count(*) filter (where auto_action <> 'allowed' and decision = 'pending') as holds_pending,
  count(*) filter (where is_false_positive) as false_positives,
  count(*) filter (where is_true_positive) as true_positives,
  count(*) filter (where auto_action = 'allowed') as recorded_allows,
  count(*) filter (where is_false_negative) as false_negatives,
  case
    when count(*) filter (where is_false_positive or is_true_positive) = 0 then null
    else round(
      count(*) filter (where is_false_positive)::numeric
        / count(*) filter (where is_false_positive or is_true_positive),
      4
    )
  end as false_positive_rate
from public.nw_screening_decisions
group by coalesce(top_class, 'none');

revoke all on public.nw_screening_measurement from public, anon, authenticated;

-- ------------------------------------------------------- signature history

-- Near-duplicate flood detection needs to compare a submission against what
-- this author posted recently, and decision rows are not that history: they only
-- exist for holds and above-threshold allows, so a stream of individually clean
-- reposts would be invisible. Every screened submission writes its shingle
-- signature here instead. A signature is 32 integers, not content, so this stays
-- small and is trimmed to the last N per author on every insert.
create table if not exists public.nw_content_signatures (
  id bigserial primary key,
  author_profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  content_kind text not null,
  signature jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.nw_content_signatures enable row level security;
revoke all on table public.nw_content_signatures from public, anon, authenticated;

create index if not exists idx_nw_content_signatures_author
  on public.nw_content_signatures (author_profile_id, created_at desc);

/* How many recent signatures are kept per author, and therefore the widest
   window flood detection can see. */
create or replace function public.nw_content_signature_history()
returns integer
language sql
immutable
as $$ select 50; $$;

create or replace function public.nw_screening_record_signature(
  p_author_profile_id uuid,
  p_content_kind text,
  p_signature jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_author_profile_id is null or p_signature is null then
    return 'bad-payload';
  end if;
  if not exists (select 1 from public.nw_profiles where id = p_author_profile_id) then
    return 'no-profile';
  end if;

  insert into public.nw_content_signatures (author_profile_id, content_kind, signature)
  values (p_author_profile_id, p_content_kind, p_signature);

  delete from public.nw_content_signatures
  where author_profile_id = p_author_profile_id
    and id not in (
      select id from public.nw_content_signatures
      where author_profile_id = p_author_profile_id
      order by created_at desc, id desc
      limit public.nw_content_signature_history()
    );

  return 'ok';
end;
$$;

revoke all on function public.nw_screening_record_signature(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_screening_record_signature(uuid, text, jsonb) to service_role;

/* The author's recent signatures, newest first, as a JSON array. */
create or replace function public.nw_screening_recent_signatures(
  p_author_profile_id uuid,
  p_limit integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.signature order by s.created_at desc), '[]'::jsonb)
  from (
    select signature, created_at
    from public.nw_content_signatures
    where author_profile_id = p_author_profile_id
    order by created_at desc, id desc
    limit greatest(1, least(coalesce(p_limit, 25), public.nw_content_signature_history()))
  ) s;
$$;

revoke all on function public.nw_screening_recent_signatures(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.nw_screening_recent_signatures(uuid, integer) to service_role;

-- ---------------------------------------------------------------- allowances

-- Post-approval allowance. Without this, an author whose held content is
-- approved would be quarantined again the moment they resubmitted the same
-- bytes, which is exactly what happens on the review-accept path where the
-- server cannot compose article text on the author's behalf. Keyed on the
-- content hash and the author, so an allowance for one author's text is not an
-- allowance for anyone else's.
create table if not exists public.nw_screening_allowances (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  content_sha256 text not null,
  decision_id uuid references public.nw_screening_decisions (id) on delete set null,
  reviewer_ref text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (author_profile_id, content_sha256)
);
alter table public.nw_screening_allowances enable row level security;
revoke all on table public.nw_screening_allowances from public, anon, authenticated;

create index if not exists idx_nw_screening_allowances_expiry
  on public.nw_screening_allowances (expires_at);

/* Default allowance lifetime. Long enough for an author to finish a piece,
   short enough that an approval is not a permanent bypass. */
create or replace function public.nw_screening_allowance_days()
returns integer
language sql
immutable
as $$ select 30; $$;

create or replace function public.nw_screening_allowance_exists(
  p_author_profile_id uuid,
  p_content_sha256 text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nw_screening_allowances
    where author_profile_id = p_author_profile_id
      and content_sha256 = p_content_sha256
      and content_sha256 <> ''
      and expires_at > now()
  );
$$;

revoke all on function public.nw_screening_allowance_exists(uuid, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_allowance_exists(uuid, text) to service_role;

-- ------------------------------------------------------------ audit vocabulary

-- nw_moderation_actions is the DSA Art 17 statement-of-reasons source
-- (nw_get_my_moderation_notices, migration 20260705000010). A screening hold is
-- an adverse action against the author, so it gets its own action value and
-- shows up in their notices; a screening release reuses 'restore', which that
-- function already excludes because a restoration is not adverse.
do $$
begin
  alter table public.nw_moderation_actions drop constraint if exists nw_moderation_actions_action_check;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_moderation_actions_action_check_v2'
      and conrelid = 'public.nw_moderation_actions'::regclass
  ) then
    alter table public.nw_moderation_actions
      add constraint nw_moderation_actions_action_check_v2
      check (action in (
        'hide_article', 'hide_suggestion', 'suspend_profile', 'dismiss', 'restore',
        'screening_hold'
      ));
  end if;
end;
$$;

/* Audit target for a screening decision. Comments are audited against their
   suggestion (the event id is not a resolvable target for the DSA notices
   read), and a held revision proposal against its article. */
create or replace function public.nw_screening_audit_target(
  p_content_kind text,
  p_content_id text
)
returns table (target_kind text, target_id text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case p_content_kind
      when 'comment' then 'suggestion'
      when 'revision-proposal' then 'revision'
      else p_content_kind
    end as target_kind,
    case
      when p_content_kind = 'comment' then coalesce(
        (
          select e.suggestion_id::text
          from public.nw_suggestion_events e
          where e.id::text = p_content_id
        ),
        p_content_id
      )
      else p_content_id
    end as target_id;
$$;

revoke all on function public.nw_screening_audit_target(text, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_audit_target(text, text) to service_role;

-- ------------------------------------------------------------- decision write

/* Shared insert for every screening outcome. p_verdict is the engine's verdict
   as JSON; the columns are projected out of it so a verdict shape change cannot
   silently stop being audited. */
create or replace function public.nw_screening_insert_decision(
  p_content_kind text,
  p_content_id text,
  p_content_rev integer,
  p_author_profile_id uuid,
  p_content_sha256 text,
  p_auto_action text,
  p_verdict jsonb,
  p_held_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_audit_kind text;
  v_audit_id text;
begin
  insert into public.nw_screening_decisions (
    content_kind, content_id, content_rev, author_profile_id, content_sha256,
    engine_version, provider, provider_state, risk_score, top_class,
    class_scores, threshold_hit, requires_human_review, signals, explanations,
    auto_action, decision, held_payload, content_signature
  ) values (
    p_content_kind,
    p_content_id,
    p_content_rev,
    p_author_profile_id,
    coalesce(p_content_sha256, ''),
    coalesce(p_verdict->>'engineVersion', 'unknown'),
    coalesce(p_verdict->>'provider', 'local'),
    coalesce(p_verdict->>'providerState', 'unconfigured'),
    least(1, greatest(0, coalesce((p_verdict->>'score')::numeric, 0))),
    nullif(p_verdict->>'topClass', ''),
    coalesce(p_verdict->'classScores', '{}'::jsonb),
    nullif(p_verdict->>'thresholdHit', ''),
    coalesce((p_verdict->>'requiresHumanReview')::boolean, false),
    coalesce(p_verdict->'signals', '[]'::jsonb),
    coalesce(p_verdict->'explanations', '[]'::jsonb),
    p_auto_action,
    case when p_auto_action = 'allowed' then 'auto-allowed' else 'pending' end,
    p_held_payload,
    p_verdict->'signature'
  )
  returning id into v_id;

  -- A hold is an adverse action, so it gets its statement of reasons at the
  -- moment it happens rather than when a human eventually looks at it. Recorded
  -- allows produce no audit row: nothing adverse happened.
  if p_auto_action <> 'allowed' then
    select t.target_kind, t.target_id
      into v_audit_kind, v_audit_id
    from public.nw_screening_audit_target(p_content_kind, p_content_id) t;
    insert into public.nw_moderation_actions
      (report_id, moderator_ref, action, target_kind, target_id, note)
    values (
      null, 'screening-auto', 'screening_hold', v_audit_kind, v_audit_id,
      'held for human review by pre-publication screening ('
        || coalesce(p_verdict->>'thresholdHit', 'unspecified threshold') || ')'
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.nw_screening_insert_decision(
  text, text, integer, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.nw_screening_insert_decision(
  text, text, integer, uuid, text, text, jsonb, jsonb
) to service_role;

/* Record a below-threshold allow for measurement. Returns the decision id. */
create or replace function public.nw_screening_record_allow(
  p_content_kind text,
  p_content_id text,
  p_content_rev integer,
  p_author_profile_id uuid,
  p_content_sha256 text,
  p_verdict jsonb
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.nw_screening_insert_decision(
    p_content_kind, p_content_id, p_content_rev, p_author_profile_id,
    p_content_sha256, 'allowed', p_verdict, null
  );
$$;

revoke all on function public.nw_screening_record_allow(text, text, integer, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_screening_record_allow(text, text, integer, uuid, text, jsonb)
  to service_role;

-- --------------------------------------------------------- quarantine writes

/* Quarantined publish. Mirrors nw_publish_article's structure exactly, with two
   differences that keep the content non-public: a brand new article lands
   status 'draft' with screening_status 'quarantined' (drafts are excluded from
   every public read path), and a new revision on an existing article does NOT
   advance current_rev, so readers keep the last cleared revision. The decision
   row is inserted in the same transaction, so there is no held-without-audit
   state. Returns 'ok:<decision id>' | 'rev-conflict' | 'slug-conflict'. */
create or replace function public.nw_screening_quarantine_article(
  p_article jsonb,
  p_revision jsonb,
  p_verdict jsonb,
  p_content_sha256 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid := (p_article->>'id')::uuid;
  v_author uuid := (p_article->>'authorProfileId')::uuid;
  v_rev integer := (p_revision->>'rev')::integer;
  v_newsroom uuid := (nullif(p_article->>'newsroomId', ''))::uuid;
  v_current integer;
  v_decision uuid;
begin
  select current_rev into v_current
    from public.nw_articles where id = v_article_id for update;

  if v_current is null then
    if v_rev <> 1 then
      return 'rev-conflict';
    end if;
    if exists (select 1 from public.nw_articles where slug = p_article->>'slug') then
      return 'slug-conflict';
    end if;
    insert into public.nw_articles
      (id, author_id, newsroom_id, kind, status, slug, current_rev, published_at, screening_status)
    values (
      v_article_id,
      v_author,
      v_newsroom,
      p_article->>'kind',
      'draft',
      p_article->>'slug',
      1,
      null,
      'quarantined'
    );
  else
    if v_rev <> v_current + 1 then
      return 'rev-conflict';
    end if;
    -- current_rev deliberately unchanged: the head stays on the last cleared
    -- revision until a human approves this one.
    update public.nw_articles
      set screening_status = 'quarantined'
      where id = v_article_id and status = 'draft';
  end if;

  insert into public.nw_article_revisions
    (article_id, rev, headline, dek, body_md, signature, signer_pubkey,
     changelog_json, created_at, screening_status)
  values (
    v_article_id,
    v_rev,
    p_revision->>'headline',
    nullif(p_revision->>'dek', ''),
    p_revision->>'bodyMd',
    p_revision->>'signature',
    p_revision->>'signerPubkey',
    coalesce((p_revision->>'changelogJson')::jsonb, '[]'::jsonb),
    (p_revision->>'createdAt')::timestamptz,
    'quarantined'
  );

  v_decision := public.nw_screening_insert_decision(
    case when v_current is null then 'article' else 'revision' end,
    v_article_id::text,
    v_rev,
    v_author,
    p_content_sha256,
    'quarantined',
    p_verdict,
    null
  );

  return 'ok:' || v_decision::text;
end;
$$;

revoke all on function public.nw_screening_quarantine_article(jsonb, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_quarantine_article(jsonb, jsonb, jsonb, text)
  to service_role;

/* Quarantined suggestion. Status 'quarantined' keeps it out of the public
   policy, out of the open-suggestion queue, out of the near-dupe scan, and out
   of every credibility aggregate. Returns 'ok:<decision id>' |
   'unknown-article'. */
create or replace function public.nw_screening_quarantine_suggestion(
  p_suggestion jsonb,
  p_verdict jsonb,
  p_content_sha256 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article uuid := (p_suggestion->>'articleId')::uuid;
  v_editor uuid := (p_suggestion->>'editorProfileId')::uuid;
  v_id uuid := (p_suggestion->>'id')::uuid;
  v_decision uuid;
begin
  if not exists (select 1 from public.nw_articles where id = v_article) then
    return 'unknown-article';
  end if;

  -- Column list mirrors nw_insert_suggestion exactly, including the
  -- signer_pubkey carry added by 20260730000009's predecessor 20260730000008,
  -- so the key-chain stamp trigger resolves the same row it would on the
  -- non-quarantined path. Only `status` differs.
  insert into public.nw_edit_suggestions
    (id, article_id, base_rev, editor_id, type, diff_json, citations, rationale,
     signature, signer_pubkey, status, created_at)
  values (
    v_id,
    v_article,
    (p_suggestion->>'baseRev')::integer,
    v_editor,
    p_suggestion->>'type',
    (p_suggestion->>'diffJson')::jsonb,
    coalesce(p_suggestion->'citations', '[]'::jsonb),
    p_suggestion->>'rationale',
    coalesce(p_suggestion->>'signature', ''),
    coalesce(p_suggestion->>'signerPubkey', ''),
    'quarantined',
    coalesce((p_suggestion->>'createdAt')::timestamptz, now())
  );

  v_decision := public.nw_screening_insert_decision(
    'suggestion', v_id::text, null, v_editor, p_content_sha256,
    'quarantined', p_verdict, null
  );

  return 'ok:' || v_decision::text;
end;
$$;

revoke all on function public.nw_screening_quarantine_suggestion(jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_quarantine_suggestion(jsonb, jsonb, text)
  to service_role;

/* Quarantined comment. Returns 'ok:<decision id>' | 'unknown-suggestion' |
   'unknown-actor'. */
create or replace function public.nw_screening_quarantine_comment(
  p_suggestion_id uuid,
  p_actor_id uuid,
  p_body text,
  p_verdict jsonb,
  p_content_sha256 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_decision uuid;
begin
  if not exists (select 1 from public.nw_edit_suggestions where id = p_suggestion_id) then
    return 'unknown-suggestion';
  end if;
  if not exists (select 1 from public.nw_profiles where id = p_actor_id) then
    return 'unknown-actor';
  end if;

  insert into public.nw_suggestion_events
    (suggestion_id, actor_id, action, payload, screening_status)
  values (
    p_suggestion_id, p_actor_id, 'comment',
    jsonb_build_object('body', p_body), 'quarantined'
  )
  returning id into v_event;

  v_decision := public.nw_screening_insert_decision(
    'comment', v_event::text, null, p_actor_id, p_content_sha256,
    'quarantined', p_verdict, null
  );

  return 'ok:' || v_decision::text;
end;
$$;

revoke all on function public.nw_screening_quarantine_comment(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_quarantine_comment(uuid, uuid, text, jsonb, text)
  to service_role;

/* Held revision proposal (the mynews-review accept path). Review requires an
   author-signed revision and the server never composes article text, so a
   flagged accept cannot be stored as a pending revision and replayed later
   without the server deciding what the article says. Instead the proposal is
   held as an audit row carrying the exact refused envelope, and an approval
   issues a content allowance so the author's identical resubmission goes
   through. Returns 'ok:<decision id>'. */
create or replace function public.nw_screening_hold_revision_proposal(
  p_article_id uuid,
  p_author_profile_id uuid,
  p_rev integer,
  p_payload jsonb,
  p_verdict jsonb,
  p_content_sha256 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision uuid;
begin
  v_decision := public.nw_screening_insert_decision(
    'revision-proposal', p_article_id::text, p_rev, p_author_profile_id,
    p_content_sha256, 'held', p_verdict, p_payload
  );
  return 'ok:' || v_decision::text;
end;
$$;

revoke all on function public.nw_screening_hold_revision_proposal(uuid, uuid, integer, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_hold_revision_proposal(uuid, uuid, integer, jsonb, jsonb, text)
  to service_role;

-- ------------------------------------------------------------ console actions

/* Approve a held decision: release the content and issue an allowance for the
   exact bytes, in one transaction. A reason is required. Returns
   'ok' | 'not-found' | 'not-pending' | 'bad-reviewer' | 'bad-reason' |
   'stale-rev'. 'stale-rev' means the article head moved past the held revision
   while it was queued, so releasing it would rewrite history: the decision is
   still recorded as approved and the allowance is still issued, so the author
   can resubmit against the current head. */
create or replace function public.nw_screening_approve(
  p_decision_id uuid,
  p_reviewer_ref text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_content_id text;
  v_rev integer;
  v_author uuid;
  v_sha text;
  v_decision text;
  v_auto text;
  v_article uuid;
  v_current integer;
  v_status text;
  v_outcome text := 'ok';
  v_audit_kind text;
  v_audit_id text;
begin
  if p_reviewer_ref is null or btrim(p_reviewer_ref) = '' then
    return 'bad-reviewer';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return 'bad-reason';
  end if;

  select content_kind, content_id, content_rev, author_profile_id, content_sha256,
         decision, auto_action
    into v_kind, v_content_id, v_rev, v_author, v_sha, v_decision, v_auto
  from public.nw_screening_decisions
  where id = p_decision_id
  for update;
  if v_kind is null then
    return 'not-found';
  end if;
  if v_decision <> 'pending' then
    return 'not-pending';
  end if;

  if v_kind in ('article', 'revision') then
    v_article := v_content_id::uuid;
    select current_rev, status into v_current, v_status
      from public.nw_articles where id = v_article for update;
    if v_current is null then
      v_outcome := 'stale-rev';
    elsif v_kind = 'article' then
      -- First revision of a held article: publish it now.
      update public.nw_articles
        set status = 'published',
            published_at = coalesce(published_at, now()),
            screening_status = 'cleared',
            current_rev = v_rev
        where id = v_article;
      update public.nw_article_revisions
        set screening_status = 'cleared'
        where article_id = v_article and rev = v_rev;
    elsif v_current = v_rev - 1 then
      update public.nw_articles
        set current_rev = v_rev, screening_status = 'cleared'
        where id = v_article;
      update public.nw_article_revisions
        set screening_status = 'cleared'
        where article_id = v_article and rev = v_rev;
    else
      -- The head moved. Leave the held revision held rather than rewriting the
      -- article, and tell the caller honestly.
      v_outcome := 'stale-rev';
    end if;
  elsif v_kind = 'suggestion' then
    update public.nw_edit_suggestions
      set status = 'open'
      where id = v_content_id::uuid and status = 'quarantined';
    if not found then
      v_outcome := 'stale-rev';
    end if;
  elsif v_kind = 'comment' then
    update public.nw_suggestion_events
      set screening_status = 'cleared'
      where id = v_content_id::uuid and screening_status = 'quarantined';
    if not found then
      v_outcome := 'stale-rev';
    end if;
  end if;
  -- 'revision-proposal' releases nothing: the allowance below is the release.

  update public.nw_screening_decisions
    set decision = 'approved',
        reviewer_ref = p_reviewer_ref,
        reviewed_at = now(),
        review_reason = p_reason,
        updated_at = now()
    where id = p_decision_id;

  if coalesce(v_sha, '') <> '' then
    insert into public.nw_screening_allowances
      (author_profile_id, content_sha256, decision_id, reviewer_ref, expires_at)
    values (
      v_author, v_sha, p_decision_id, p_reviewer_ref,
      now() + make_interval(days => public.nw_screening_allowance_days())
    )
    on conflict (author_profile_id, content_sha256) do update
      set decision_id = excluded.decision_id,
          reviewer_ref = excluded.reviewer_ref,
          expires_at = excluded.expires_at;
  end if;

  select t.target_kind, t.target_id
    into v_audit_kind, v_audit_id
  from public.nw_screening_audit_target(v_kind, v_content_id) t;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values (
    null, p_reviewer_ref, 'restore', v_audit_kind, v_audit_id,
    'screening approved: ' || p_reason
  );

  return v_outcome;
end;
$$;

revoke all on function public.nw_screening_approve(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_approve(uuid, text, text) to service_role;

/* Reject a held decision. Content stays non-public permanently: a held article
   stays a draft and is marked rejected, a held revision is marked rejected, a
   held suggestion is rejected, a held comment is marked rejected. Nothing is
   deleted, so the audit trail and any later appeal have the evidence. A reason
   is required. Returns 'ok' | 'not-found' | 'not-pending' | 'bad-reviewer' |
   'bad-reason'. */
create or replace function public.nw_screening_reject(
  p_decision_id uuid,
  p_reviewer_ref text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_content_id text;
  v_rev integer;
  v_decision text;
  v_audit_kind text;
  v_audit_id text;
begin
  if p_reviewer_ref is null or btrim(p_reviewer_ref) = '' then
    return 'bad-reviewer';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return 'bad-reason';
  end if;

  select content_kind, content_id, content_rev, decision
    into v_kind, v_content_id, v_rev, v_decision
  from public.nw_screening_decisions
  where id = p_decision_id
  for update;
  if v_kind is null then
    return 'not-found';
  end if;
  if v_decision <> 'pending' then
    return 'not-pending';
  end if;

  if v_kind = 'article' then
    update public.nw_articles
      set screening_status = 'rejected'
      where id = v_content_id::uuid and status = 'draft';
    update public.nw_article_revisions
      set screening_status = 'rejected'
      where article_id = v_content_id::uuid and rev = v_rev;
  elsif v_kind = 'revision' then
    update public.nw_article_revisions
      set screening_status = 'rejected'
      where article_id = v_content_id::uuid and rev = v_rev;
    update public.nw_articles
      set screening_status = 'cleared'
      where id = v_content_id::uuid and status <> 'draft';
  elsif v_kind = 'suggestion' then
    update public.nw_edit_suggestions
      set status = 'rejected'
      where id = v_content_id::uuid and status = 'quarantined';
  elsif v_kind = 'comment' then
    update public.nw_suggestion_events
      set screening_status = 'rejected'
      where id = v_content_id::uuid and screening_status = 'quarantined';
  end if;

  update public.nw_screening_decisions
    set decision = 'rejected',
        reviewer_ref = p_reviewer_ref,
        reviewed_at = now(),
        review_reason = p_reason,
        updated_at = now()
    where id = p_decision_id;

  select t.target_kind, t.target_id
    into v_audit_kind, v_audit_id
  from public.nw_screening_audit_target(v_kind, v_content_id) t;
  insert into public.nw_moderation_actions
    (report_id, moderator_ref, action, target_kind, target_id, note)
  values (
    null, p_reviewer_ref, 'screening_hold', v_audit_kind, v_audit_id,
    'screening rejected: ' || p_reason
  );

  return 'ok';
end;
$$;

revoke all on function public.nw_screening_reject(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_reject(uuid, text, text) to service_role;

/* Author appeal request. Only the author of the held content may appeal, only
   once, and only on a decision that actually held something. Returns 'ok' |
   'not-found' | 'not-author' | 'not-appealable' | 'already-appealed' |
   'bad-reason'. */
create or replace function public.nw_screening_appeal_request(
  p_decision_id uuid,
  p_author_profile_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_auto text;
  v_appeal text;
begin
  if p_reason is null or btrim(p_reason) = '' or char_length(p_reason) > 2000 then
    return 'bad-reason';
  end if;

  select author_profile_id, auto_action, appeal_state
    into v_author, v_auto, v_appeal
  from public.nw_screening_decisions
  where id = p_decision_id
  for update;
  if v_author is null then
    return 'not-found';
  end if;
  if v_author <> p_author_profile_id then
    return 'not-author';
  end if;
  if v_auto = 'allowed' then
    return 'not-appealable';
  end if;
  if v_appeal <> 'none' then
    return 'already-appealed';
  end if;

  update public.nw_screening_decisions
    set appeal_state = 'requested',
        appeal_reason = p_reason,
        updated_at = now()
    where id = p_decision_id;
  return 'ok';
end;
$$;

revoke all on function public.nw_screening_appeal_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_appeal_request(uuid, uuid, text) to service_role;

/* Appeal disposition. Granting an appeal on a still-pending decision runs the
   full approval path (release plus allowance) so a granted appeal actually
   restores the content instead of only changing a label. Granting after a
   rejection reopens the decision to pending first, again so the release path is
   the single implementation. Returns the approve outcome, or 'ok' for a denial.
   Codes: 'not-found' | 'no-appeal' | 'bad-reviewer' | 'bad-reason'. */
create or replace function public.nw_screening_appeal_disposition(
  p_decision_id uuid,
  p_reviewer_ref text,
  p_grant boolean,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appeal text;
  v_decision text;
  v_outcome text;
begin
  if p_reviewer_ref is null or btrim(p_reviewer_ref) = '' then
    return 'bad-reviewer';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return 'bad-reason';
  end if;

  select appeal_state, decision into v_appeal, v_decision
  from public.nw_screening_decisions
  where id = p_decision_id
  for update;
  if v_appeal is null then
    return 'not-found';
  end if;
  if v_appeal <> 'requested' then
    return 'no-appeal';
  end if;

  if p_grant then
    if v_decision <> 'pending' then
      update public.nw_screening_decisions
        set decision = 'pending', reviewed_at = null, updated_at = now()
        where id = p_decision_id;
    end if;
    select public.nw_screening_approve(p_decision_id, p_reviewer_ref, p_reason) into v_outcome;
    update public.nw_screening_decisions
      set appeal_state = 'granted',
          appeal_reviewer_ref = p_reviewer_ref,
          appeal_decided_at = now(),
          updated_at = now()
      where id = p_decision_id;
    return v_outcome;
  end if;

  update public.nw_screening_decisions
    set appeal_state = 'denied',
        appeal_reviewer_ref = p_reviewer_ref,
        appeal_decided_at = now(),
        updated_at = now()
    where id = p_decision_id;
  return 'ok';
end;
$$;

revoke all on function public.nw_screening_appeal_disposition(uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_appeal_disposition(uuid, text, boolean, text)
  to service_role;

/* Author-facing read, keyed on the verified JWT subject like
   nw_get_my_moderation_notices. Deliberately omits signals and class scores. */
create or replace function public.nw_get_my_screening_decisions(p_user uuid)
returns table (
  id uuid,
  content_kind text,
  content_id text,
  content_rev integer,
  auto_action text,
  decision text,
  top_class text,
  requires_human_review boolean,
  review_reason text,
  appeal_state text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.content_kind, d.content_id, d.content_rev, d.auto_action,
         d.decision, d.top_class, d.requires_human_review, d.review_reason,
         d.appeal_state, d.created_at, d.reviewed_at
  from public.nw_screening_decisions d
  join public.nw_profiles p on p.id = d.author_profile_id
  where p.user_id = p_user
    and d.auto_action <> 'allowed'
  order by d.created_at desc;
$$;

revoke all on function public.nw_get_my_screening_decisions(uuid)
  from public, anon, authenticated;
grant execute on function public.nw_get_my_screening_decisions(uuid) to service_role;

-- ############################################################################
-- SECTION 3: journalist verification center
-- ############################################################################

alter table public.nw_journalist_verifications
  add column if not exists requested_by uuid references public.nw_profiles (id) on delete set null;
alter table public.nw_journalist_verifications
  add column if not exists evidence_json jsonb not null default '[]';
alter table public.nw_journalist_verifications
  add column if not exists decision_reason text not null default '';
alter table public.nw_journalist_verifications
  add column if not exists decided_at timestamptz;
alter table public.nw_journalist_verifications
  add column if not exists expires_at timestamptz;
alter table public.nw_journalist_verifications
  add column if not exists revoked_at timestamptz;
alter table public.nw_journalist_verifications
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.nw_journalist_verifications
    drop constraint if exists nw_journalist_verifications_status_check;
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_journalist_verifications_status_check_v2'
      and conrelid = 'public.nw_journalist_verifications'::regclass
  ) then
    alter table public.nw_journalist_verifications
      add constraint nw_journalist_verifications_status_check_v2
      check (status in ('pending', 'approved', 'rejected', 'revoked', 'expired'));
  end if;
end;
$$;

-- At most one live request per journalist, so an operator queue cannot fill with
-- duplicates and a second approval cannot race the first.
create unique index if not exists uq_nw_journalist_verifications_open
  on public.nw_journalist_verifications (journalist_id)
  where status = 'pending';
create index if not exists idx_nw_journalist_verifications_status
  on public.nw_journalist_verifications (status, created_at);
create index if not exists idx_nw_journalist_verifications_expiry
  on public.nw_journalist_verifications (expires_at)
  where status = 'approved';

/* Current verification state for a journalist. 'approved' only while an
   approval is live and unexpired; anything else reports the most recent
   terminal state, or 'none' when there is no record at all. This is the single
   definition the credibility engine, the public view, and the app all read. */
create or replace function public.nw_verification_state(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select 'approved'
      from public.nw_journalist_verifications
      where journalist_id = p_profile_id
        and status = 'approved'
        and (expires_at is null or expires_at > now())
      limit 1
    ),
    (
      select status
      from public.nw_journalist_verifications
      where journalist_id = p_profile_id
      order by coalesce(decided_at, created_at) desc
      limit 1
    ),
    'none'
  );
$$;

revoke all on function public.nw_verification_state(uuid) from public, anon;
grant execute on function public.nw_verification_state(uuid) to authenticated, service_role;

/* Live approval expiry for a journalist, or null. */
create or replace function public.nw_verification_expires_at(p_profile_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select expires_at
  from public.nw_journalist_verifications
  where journalist_id = p_profile_id
    and status = 'approved'
    and (expires_at is null or expires_at > now())
  order by coalesce(decided_at, created_at) desc
  limit 1;
$$;

revoke all on function public.nw_verification_expires_at(uuid) from public, anon;
grant execute on function public.nw_verification_expires_at(uuid) to authenticated, service_role;

/* Request verification. The journalist row must exist (verification is for
   journalists), the method must be one of the supported ones, and only one
   pending request may exist. Evidence references are stored as JSON so a
   request can carry several (a masthead URL, a byline, an ORCID). Returns
   'ok:<id>' | 'no-journalist' | 'bad-method' | 'already-pending' |
   'already-verified'. */
create or replace function public.nw_verification_request(
  p_profile_id uuid,
  p_method text,
  p_evidence_ref text,
  p_evidence jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_method is null or p_method not in ('domain_email', 'orcid', 'byline', 'manual') then
    return 'bad-method';
  end if;
  if not exists (select 1 from public.nw_journalists where profile_id = p_profile_id) then
    return 'no-journalist';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nw-verify:' || p_profile_id::text, 0));

  if exists (
    select 1 from public.nw_journalist_verifications
    where journalist_id = p_profile_id and status = 'pending'
  ) then
    return 'already-pending';
  end if;
  if public.nw_verification_state(p_profile_id) = 'approved' then
    return 'already-verified';
  end if;

  insert into public.nw_journalist_verifications
    (journalist_id, method, evidence_ref, status, requested_by, evidence_json)
  values (
    p_profile_id, p_method, coalesce(p_evidence_ref, ''), 'pending',
    p_profile_id, coalesce(p_evidence, '[]'::jsonb)
  )
  returning id into v_id;

  return 'ok:' || v_id::text;
end;
$$;

revoke all on function public.nw_verification_request(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_verification_request(uuid, text, text, jsonb) to service_role;

/* Operator decision. Approving stamps the expiry and sets the journalist tier
   to 'verified' in the same transaction, so the tier can never claim a
   verification that does not exist. Denying records the reason and leaves the
   tier alone. A reason is required either way. Returns 'ok' | 'not-found' |
   'not-pending' | 'bad-reviewer' | 'bad-reason' | 'bad-expiry'. */
create or replace function public.nw_verification_decide(
  p_verification_id uuid,
  p_reviewer_ref text,
  p_approve boolean,
  p_reason text,
  p_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journalist uuid;
  v_status text;
begin
  if p_reviewer_ref is null or btrim(p_reviewer_ref) = '' then
    return 'bad-reviewer';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return 'bad-reason';
  end if;
  if p_approve and (p_expires_at is null or p_expires_at <= now()) then
    return 'bad-expiry';
  end if;

  select journalist_id, status into v_journalist, v_status
  from public.nw_journalist_verifications
  where id = p_verification_id
  for update;
  if v_journalist is null then
    return 'not-found';
  end if;
  if v_status <> 'pending' then
    return 'not-pending';
  end if;

  update public.nw_journalist_verifications
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = p_reviewer_ref,
        decision_reason = p_reason,
        decided_at = now(),
        expires_at = case when p_approve then p_expires_at else null end,
        updated_at = now()
    where id = p_verification_id;

  if p_approve then
    update public.nw_journalists set tier = 'verified' where profile_id = v_journalist;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.nw_verification_decide(uuid, text, boolean, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.nw_verification_decide(uuid, text, boolean, text, timestamptz)
  to service_role;

/* Revoke a live approval. Tier drops to 'open' in the same transaction, and the
   reason is recorded. Returns 'ok' | 'not-found' | 'not-approved' |
   'bad-reviewer' | 'bad-reason'. */
create or replace function public.nw_verification_revoke(
  p_verification_id uuid,
  p_reviewer_ref text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journalist uuid;
  v_status text;
begin
  if p_reviewer_ref is null or btrim(p_reviewer_ref) = '' then
    return 'bad-reviewer';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return 'bad-reason';
  end if;

  select journalist_id, status into v_journalist, v_status
  from public.nw_journalist_verifications
  where id = p_verification_id
  for update;
  if v_journalist is null then
    return 'not-found';
  end if;
  if v_status <> 'approved' then
    return 'not-approved';
  end if;

  update public.nw_journalist_verifications
    set status = 'revoked',
        revoked_at = now(),
        decision_reason = p_reason,
        reviewed_by = p_reviewer_ref,
        updated_at = now()
    where id = p_verification_id;

  if public.nw_verification_state(v_journalist) <> 'approved' then
    update public.nw_journalists set tier = 'open' where profile_id = v_journalist;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.nw_verification_revoke(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_verification_revoke(uuid, text, text) to service_role;

/* Expire approvals past their expiry and drop the tier with them. Idempotent
   and batched; returns how many rows expired. Called by the worker so a lapsed
   verification stops carrying a badge without anyone having to notice. */
create or replace function public.nw_verification_expire_due(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer := 0;
begin
  select coalesce(array_agg(id), '{}')
    into v_ids
  from (
    select id
    from public.nw_journalist_verifications
    where status = 'approved'
      and expires_at is not null
      and expires_at <= now()
    order by expires_at asc
    limit greatest(1, coalesce(p_limit, 200))
    for update skip locked
  ) due;

  if array_length(v_ids, 1) is null then
    return 0;
  end if;

  update public.nw_journalist_verifications
    set status = 'expired', updated_at = now()
    where id = any(v_ids);
  v_count := array_length(v_ids, 1);

  update public.nw_journalists j
    set tier = 'open'
    where j.profile_id in (
      select journalist_id from public.nw_journalist_verifications where id = any(v_ids)
    )
    and public.nw_verification_state(j.profile_id) <> 'approved';

  return v_count;
end;
$$;

revoke all on function public.nw_verification_expire_due(integer)
  from public, anon, authenticated;
grant execute on function public.nw_verification_expire_due(integer) to service_role;

/* Author-facing read of their own verification history, keyed on the JWT
   subject. Evidence stays private: the operator sees it, the requester sees
   only that they submitted it. */
create or replace function public.nw_get_my_verification(p_user uuid)
returns table (
  id uuid,
  method text,
  status text,
  decision_reason text,
  created_at timestamptz,
  decided_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.method, v.status, v.decision_reason, v.created_at,
         v.decided_at, v.expires_at, v.revoked_at
  from public.nw_journalist_verifications v
  join public.nw_profiles p on p.id = v.journalist_id
  where p.user_id = p_user
  order by v.created_at desc;
$$;

revoke all on function public.nw_get_my_verification(uuid) from public, anon, authenticated;
grant execute on function public.nw_get_my_verification(uuid) to service_role;

-- --------------------------------------------------------------- public view

-- The WP3 public journalist view gains the verification state and expiry.
-- Appending columns is the only shape change create or replace view allows, and
-- the existing five columns keep their positions so every current reader is
-- unaffected. Evidence, reviewer identity, and denial reasons stay private.
create or replace view public.nw_public_journalists
with (security_barrier = true) as
select
  profile_id,
  tier,
  bio,
  beats,
  region,
  created_at,
  public.nw_verification_state(profile_id) as verification_state,
  public.nw_verification_expires_at(profile_id) as verification_expires_at
from public.nw_journalists;

grant select on public.nw_public_journalists to anon, authenticated;

-- ---------------------------------------------------------------- ring flags

-- Persisted output of the coordinated-endorsement-ring detector
-- (modules/mynews/src/engines/rings.ts). The detector is pure TypeScript over
-- the endorsement graph, so SQL stores its verdict rather than reimplementing
-- it: the console recomputes and upserts, and nw_editor_aggregates reads the
-- stored suspicion so the trust gate applies at the edge without the edge
-- having to walk the graph on every suggestion.
create table if not exists public.nw_ring_flags (
  profile_id uuid primary key references public.nw_profiles (id) on delete cascade,
  suspicion numeric(4, 3) not null default 0 check (suspicion >= 0 and suspicion <= 1),
  findings jsonb not null default '[]',
  detector_version text not null default '',
  computed_by text not null default '',
  computed_at timestamptz not null default now()
);
alter table public.nw_ring_flags enable row level security;
revoke all on table public.nw_ring_flags from public, anon, authenticated;

create index if not exists idx_nw_ring_flags_suspicion
  on public.nw_ring_flags (suspicion desc, computed_at desc);

create or replace function public.nw_ring_flags_upsert(
  p_profile_id uuid,
  p_suspicion numeric,
  p_findings jsonb,
  p_detector_version text,
  p_computed_by text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null or not exists (
    select 1 from public.nw_profiles where id = p_profile_id
  ) then
    return 'no-profile';
  end if;
  insert into public.nw_ring_flags
    (profile_id, suspicion, findings, detector_version, computed_by, computed_at)
  values (
    p_profile_id,
    least(1, greatest(0, coalesce(p_suspicion, 0))),
    coalesce(p_findings, '[]'::jsonb),
    coalesce(p_detector_version, ''),
    coalesce(p_computed_by, ''),
    now()
  )
  on conflict (profile_id) do update
    set suspicion = excluded.suspicion,
        findings = excluded.findings,
        detector_version = excluded.detector_version,
        computed_by = excluded.computed_by,
        computed_at = now();
  return 'ok';
end;
$$;

revoke all on function public.nw_ring_flags_upsert(uuid, numeric, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_ring_flags_upsert(uuid, numeric, jsonb, text, text)
  to service_role;

-- --------------------------------------------------------------- aggregates

-- nw_editor_aggregates gains three WP8 Sybil inputs: account age, verification
-- state, and stored ring suspicion. Every existing key keeps its name, type,
-- and meaning, so the edge cap check and the app views are unaffected except
-- that they can now see the new signals. Body is otherwise the 20260703000003
-- version verbatim.
create or replace function public.nw_editor_aggregates(p_editor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_open integer;
  v_decided integer;
  v_accepted integer;
  v_accepted_copyedits integer;
  v_distinct integer;
  v_endorsements integer;
  v_max_pair_share numeric;
  v_created_at timestamptz;
  v_verification text;
  v_ring numeric;
begin
  select count(*) into v_open
    from public.nw_edit_suggestions where editor_id = p_editor and status = 'open';
  select count(*) into v_decided
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial', 'rejected');
  select count(*) into v_accepted
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial');
  select count(*) into v_accepted_copyedits
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial') and type = 'copyedit';
  select count(distinct a.author_id) into v_distinct
    from public.nw_edit_suggestions s
    join public.nw_articles a on a.id = s.article_id
    where s.editor_id = p_editor and s.status in ('accepted', 'partial');
  select count(*) into v_endorsements
    from public.nw_suggestion_dupes d
    join public.nw_edit_suggestions s on s.id = d.original_id
    where s.editor_id = p_editor;
  select coalesce(max(per_author.merged)::numeric / nullif(sum(per_author.merged), 0), 0)
    into v_max_pair_share
    from (
      select a.author_id, count(*) as merged
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.editor_id = p_editor and s.status in ('accepted', 'partial')
      group by a.author_id
    ) per_author;

  select created_at into v_created_at from public.nw_profiles where id = p_editor;
  v_verification := public.nw_verification_state(p_editor);
  select coalesce(suspicion, 0) into v_ring from public.nw_ring_flags where profile_id = p_editor;

  return jsonb_build_object(
    'openCount', v_open,
    'decidedSampleSize', v_decided,
    'acceptanceRate', case when v_decided = 0 then 1 else v_accepted::numeric / v_decided end,
    'acceptedTotal', v_accepted,
    'acceptedCopyedits', v_accepted_copyedits,
    'distinctAuthors', v_distinct,
    'endorsementsReceived', v_endorsements,
    'maxPairShare', v_max_pair_share,
    'sanctionsInLast90d', 0,
    'authorStanding', 0.5,
    -- Plan 48 WP8. accountAgeMs is null only when the profile row is gone,
    -- which is the one case where age must not gate anything.
    'accountAgeMs', case
      when v_created_at is null then null
      else floor(extract(epoch from (now() - v_created_at)) * 1000)
    end,
    'verification', v_verification,
    'ringSuspicion', coalesce(v_ring, 0)
  );
end;
$$;

revoke execute on function public.nw_editor_aggregates(uuid) from public, anon, authenticated;
grant execute on function public.nw_editor_aggregates(uuid) to service_role;
