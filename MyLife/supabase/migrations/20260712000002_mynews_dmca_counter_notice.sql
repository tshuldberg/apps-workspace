-- MyNews DMCA and counter-notice production workflow (Plan 48 WP2).
--
-- This migration keeps the original 20260705000008 notice and strike schema
-- intact, then adds the missing legal-intake guarantees:
--   * takedown and counter-notice records have distinct schemas;
--   * canonical public URLs resolve inside the same transaction that creates
--     the legal record and, for a resolved takedown, its copyright report;
--   * unresolved URLs remain queue-visible as needs_resolution;
--   * anonymous throttling is durable, keyed only by salted hashes, and
--     callable only by the service role;
--   * every workflow mutation is made by one security-definer RPC and appends
--     an immutable nw_dmca_events row;
--   * the counter-notice restoration window uses 10 and 14 business-day
--     timestamps and cannot restore before the earliest date.
--
-- Counsel approval of the published text and designated-agent registration
-- remain founder-operated launch gates. No schema or function below represents
-- either gate as complete.

-- ============================================================ legal report source

-- Ordinary reports remain attributable. A null reporter is permitted only for
-- a DMCA-sourced report that points back to a real takedown notice.
alter table public.nw_reports
  add column if not exists intake_source text not null default 'user',
  add column if not exists dmca_notice_id uuid references public.nw_dmca_notices (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_reports_intake_source_check'
      and conrelid = 'public.nw_reports'::regclass
  ) then
    alter table public.nw_reports
      add constraint nw_reports_intake_source_check
      check (intake_source in ('user', 'dmca'));
  end if;
end;
$$;

create unique index if not exists idx_nw_reports_dmca_notice
  on public.nw_reports (dmca_notice_id)
  where dmca_notice_id is not null;

create or replace function public.nw_reports_guard_client_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'nw_reports: reports are created only through an approved intake function';
  end if;
  if new.reporter_id is null
     and (new.intake_source <> 'dmca' or new.dmca_notice_id is null) then
    raise exception 'nw_reports: an attributable reporter or linked DMCA notice is required';
  end if;
  if new.intake_source = 'dmca' and new.dmca_notice_id is null then
    raise exception 'nw_reports: DMCA reports require a notice link';
  end if;
  return new;
end;
$$;

-- ============================================================ takedown workflow

alter table public.nw_dmca_notices
  drop constraint if exists nw_dmca_notices_status_check;

alter table public.nw_dmca_notices
  add column if not exists good_faith_attestation_text text not null default
    'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.',
  add column if not exists good_faith_attestation_version text not null default '2026-07-12',
  add column if not exists accuracy_attestation_text text not null default
    'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.',
  add column if not exists accuracy_attestation_version text not null default '2026-07-12',
  add column if not exists assigned_moderator_ref text,
  add column if not exists acknowledgment_due_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists forwarded_at timestamptz,
  add column if not exists forwarded_to_email text,
  add column if not exists actioned_at timestamptz,
  add column if not exists restored_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists disposition text,
  add column if not exists strike_profile_id uuid references public.nw_profiles (id) on delete set null,
  add column if not exists strike_action_id uuid references public.nw_moderation_actions (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.nw_dmca_notices
set status = case status
  when 'open' then 'received'
  when 'actioned' then 'actioned'
  when 'no_action' then 'closed'
  else status
end;

update public.nw_dmca_notices
set acknowledgment_due_at = created_at + interval '72 hours'
where acknowledgment_due_at is null;

alter table public.nw_dmca_notices
  alter column acknowledgment_due_at set default (now() + interval '72 hours'),
  alter column acknowledgment_due_at set not null,
  add constraint nw_dmca_notices_status_check check (
    status in (
      'needs_resolution', 'received', 'acknowledged', 'forwarded',
      'actioned', 'restored', 'closed'
    )
  );

create index if not exists idx_nw_dmca_notices_workflow
  on public.nw_dmca_notices (status, acknowledgment_due_at, created_at);
create index if not exists idx_nw_dmca_notices_assignee
  on public.nw_dmca_notices (assigned_moderator_ref, status);

-- The legacy mixed-kind intake RPC can create incomplete counter rows and does
-- not resolve URLs transactionally. New service code must use the two distinct
-- intake RPCs below.
revoke execute on function public.nw_submit_dmca_notice(
  text, uuid, text, text, text, text, text, text, text, text
) from service_role;

-- ============================================================ counter notices

create table if not exists public.nw_dmca_counter_notices (
  id uuid primary key default gen_random_uuid(),
  submitter_profile_id uuid references public.nw_profiles (id) on delete set null,
  original_notice_id uuid references public.nw_dmca_notices (id) on delete set null,
  original_notice_reference text,
  counter_notifier_name text not null,
  counter_notifier_address text not null,
  counter_notifier_phone text not null,
  counter_notifier_email text not null,
  removed_material text not null,
  material_location_before_removal text not null,
  target_kind text check (
    target_kind is null or target_kind in ('article', 'suggestion', 'profile')
  ),
  target_id text,
  good_faith_mistake_or_misidentification boolean not null,
  statement_under_penalty_of_perjury boolean not null,
  mistake_attestation_text text not null,
  mistake_attestation_version text not null,
  consent_to_federal_jurisdiction boolean not null,
  jurisdiction_attestation_text text not null,
  jurisdiction_attestation_version text not null,
  acceptance_of_service_of_process boolean not null,
  service_attestation_text text not null,
  service_attestation_version text not null,
  signature text not null,
  status text not null default 'received' check (
    status in (
      'needs_resolution', 'received', 'forwarded_to_claimant', 'waiting_period',
      'restored', 'litigation_hold', 'closed'
    )
  ),
  assigned_moderator_ref text,
  acknowledgment_due_at timestamptz not null default (now() + interval '72 hours'),
  acknowledged_at timestamptz,
  received_at timestamptz not null default now(),
  forwarded_to_claimant_at timestamptz,
  forwarded_to_email text,
  waiting_period_started_at timestamptz,
  restoration_eligible_at timestamptz,
  restoration_deadline_at timestamptz,
  restored_at timestamptz,
  litigation_hold_at timestamptz,
  closed_at timestamptz,
  disposition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nw_dmca_counter_attested check (
    good_faith_mistake_or_misidentification
    and statement_under_penalty_of_perjury
    and consent_to_federal_jurisdiction
    and acceptance_of_service_of_process
  ),
  constraint nw_dmca_counter_contact_complete check (
    length(trim(counter_notifier_name)) > 0
    and length(trim(counter_notifier_address)) > 0
    and length(trim(counter_notifier_phone)) > 0
    and length(trim(counter_notifier_email)) > 0
  ),
  constraint nw_dmca_counter_material_complete check (
    length(trim(removed_material)) > 0
    and length(trim(material_location_before_removal)) > 0
    and length(trim(signature)) > 0
  ),
  constraint nw_dmca_counter_waiting_window check (
    restoration_deadline_at is null
    or restoration_eligible_at is null
    or restoration_deadline_at >= restoration_eligible_at
  )
);

alter table public.nw_dmca_counter_notices enable row level security;
revoke all on table public.nw_dmca_counter_notices from public, anon, authenticated;

create index if not exists idx_nw_dmca_counter_queue
  on public.nw_dmca_counter_notices (status, acknowledgment_due_at, created_at);
create index if not exists idx_nw_dmca_counter_original
  on public.nw_dmca_counter_notices (original_notice_id, created_at);
create index if not exists idx_nw_dmca_counter_email
  on public.nw_dmca_counter_notices (counter_notifier_email, created_at);
create index if not exists idx_nw_dmca_counter_assignee
  on public.nw_dmca_counter_notices (assigned_moderator_ref, status);

-- ============================================================ immutable event log

create table if not exists public.nw_dmca_events (
  id uuid primary key default gen_random_uuid(),
  notice_kind text not null check (notice_kind in ('takedown', 'counter')),
  takedown_notice_id uuid references public.nw_dmca_notices (id) on delete restrict,
  counter_notice_id uuid references public.nw_dmca_counter_notices (id) on delete restrict,
  event text not null,
  actor_ref text not null,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nw_dmca_event_exactly_one_notice check (
    (notice_kind = 'takedown' and takedown_notice_id is not null and counter_notice_id is null)
    or
    (notice_kind = 'counter' and counter_notice_id is not null and takedown_notice_id is null)
  )
);

alter table public.nw_dmca_events enable row level security;
revoke all on table public.nw_dmca_events from public, anon, authenticated;

create index if not exists idx_nw_dmca_events_takedown
  on public.nw_dmca_events (takedown_notice_id, created_at);
create index if not exists idx_nw_dmca_events_counter
  on public.nw_dmca_events (counter_notice_id, created_at);

create or replace function public.nw_dmca_events_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'nw_dmca_events is append-only';
end;
$$;

drop trigger if exists nw_dmca_events_no_mutation on public.nw_dmca_events;
create trigger nw_dmca_events_no_mutation
  before update or delete on public.nw_dmca_events
  for each row execute function public.nw_dmca_events_append_only();

-- ============================================================ URL resolver

-- Canonical public URL shapes:
--   /article/<slug-or-uuid> (legacy /a/<slug-or-uuid> is also accepted)
--   /journalist/<handle> or /profile/<handle>
--   /suggestion/<uuid>
-- Query strings and fragments are ignored. Encoded slashes, extra segments,
-- malformed UUIDs, non-HTTPS URLs, and draft-only article URLs resolve to no
-- row rather than raising.
create or replace function public.nw_resolve_public_url(p_url text)
returns table (target_kind text, target_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
  v_path text;
  v_match text[];
  v_token text;
  v_uuid uuid;
  v_id uuid;
begin
  v_url := trim(coalesce(p_url, ''));
  if length(v_url) = 0 or length(v_url) > 2000
     or v_url !~* '^https://[^[:space:]]+$' then
    return;
  end if;

  v_url := split_part(split_part(v_url, '#', 1), '?', 1);
  v_path := regexp_replace(v_url, '^https://[^/]+', '', 'i');
  if v_path = '' then
    v_path := '/';
  end if;

  v_match := regexp_match(v_path, '^/(article|a)/([a-z0-9-]{3,120})/?$', 'i');
  if v_match is not null then
    v_token := lower(v_match[2]);
    begin
      v_uuid := v_token::uuid;
    exception when others then
      v_uuid := null;
    end;
    select a.id into v_id
    from public.nw_articles a
    where a.status <> 'draft'
      and ((v_uuid is not null and a.id = v_uuid) or lower(a.slug) = v_token)
    order by case when v_uuid is not null and a.id = v_uuid then 0 else 1 end
    limit 1;
    if v_id is not null then
      target_kind := 'article';
      target_id := v_id::text;
      return next;
    end if;
    return;
  end if;

  v_match := regexp_match(v_path, '^/(journalist|profile)/([a-z0-9_]{3,30})/?$', 'i');
  if v_match is not null then
    v_token := lower(v_match[2]);
    select p.id into v_id
    from public.nw_profiles p
    where lower(p.handle) = v_token
    limit 1;
    if v_id is not null then
      target_kind := 'profile';
      target_id := v_id::text;
      return next;
    end if;
    return;
  end if;

  v_match := regexp_match(v_path, '^/suggestion/([a-f0-9-]{36})/?$', 'i');
  if v_match is not null then
    begin
      v_uuid := v_match[1]::uuid;
    exception when others then
      v_uuid := null;
    end;
    if v_uuid is not null then
      select s.id into v_id
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = v_uuid and a.status <> 'draft'
      limit 1;
    end if;
    if v_id is not null then
      target_kind := 'suggestion';
      target_id := v_id::text;
      return next;
    end if;
  end if;
end;
$$;

revoke all on function public.nw_resolve_public_url(text) from public, anon, authenticated;
grant execute on function public.nw_resolve_public_url(text) to service_role;

-- ============================================================ durable rate limit

-- No raw IP address or email is stored. The edge function derives independent
-- salted HMACs for each and a final composite key before calling this RPC.
create table if not exists public.nw_dmca_rate_counters (
  rate_key text primary key,
  ip_hash text not null,
  email_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now(),
  constraint nw_dmca_rate_hashes_check check (
    rate_key ~ '^[a-f0-9]{64}$'
    and ip_hash ~ '^[a-f0-9]{64}$'
    and email_hash ~ '^[a-f0-9]{64}$'
  )
);

alter table public.nw_dmca_rate_counters enable row level security;
revoke all on table public.nw_dmca_rate_counters from public, anon, authenticated;

create index if not exists idx_nw_dmca_rate_window
  on public.nw_dmca_rate_counters (window_started_at);

create or replace function public.nw_consume_dmca_rate_limit(
  p_rate_key text,
  p_ip_hash text,
  p_email_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_count integer;
begin
  if p_rate_key !~ '^[a-f0-9]{64}$'
     or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_email_hash !~ '^[a-f0-9]{64}$' then
    return 'bad-key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nw-dmca-rate:' || p_rate_key, 0));

  select window_started_at, request_count
    into v_window_started_at, v_count
  from public.nw_dmca_rate_counters
  where rate_key = p_rate_key
  for update;

  if v_window_started_at is null then
    insert into public.nw_dmca_rate_counters
      (rate_key, ip_hash, email_hash, window_started_at, request_count, updated_at)
    values
      (p_rate_key, p_ip_hash, p_email_hash, v_now, 1, v_now);
    return 'allowed';
  end if;

  if v_window_started_at <= v_now - interval '10 minutes' then
    update public.nw_dmca_rate_counters
      set ip_hash = p_ip_hash,
          email_hash = p_email_hash,
          window_started_at = v_now,
          request_count = 1,
          updated_at = v_now
      where rate_key = p_rate_key;
    return 'allowed';
  end if;

  if v_count >= 5 then
    return 'rate-limited';
  end if;

  update public.nw_dmca_rate_counters
    set request_count = request_count + 1,
        updated_at = v_now
    where rate_key = p_rate_key;
  return 'allowed';
end;
$$;

revoke all on function public.nw_consume_dmca_rate_limit(text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_consume_dmca_rate_limit(text, text, text)
  to service_role;

-- ============================================================ business-day helper

create or replace function public.nw_add_business_days(
  p_started_at timestamptz,
  p_days integer
)
returns timestamptz
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_result timestamptz := p_started_at;
  v_added integer := 0;
begin
  if p_started_at is null or p_days is null or p_days < 0 or p_days > 366 then
    raise exception 'nw_add_business_days: invalid input';
  end if;
  while v_added < p_days loop
    v_result := v_result + interval '1 day';
    if extract(isodow from (v_result at time zone 'UTC')) between 1 and 5 then
      v_added := v_added + 1;
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.nw_add_business_days(timestamptz, integer)
  from public, anon, authenticated;

-- ============================================================ transactional intake

create or replace function public.nw_submit_dmca_takedown(
  p_submitter_profile_id uuid,
  p_complainant_name text,
  p_complainant_email text,
  p_complainant_address text,
  p_copyrighted_work text,
  p_infringing_url text,
  p_good_faith boolean,
  p_good_faith_attestation_text text,
  p_good_faith_attestation_version text,
  p_accuracy_under_penalty boolean,
  p_accuracy_attestation_text text,
  p_accuracy_attestation_version text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice_id uuid;
  v_report_id uuid;
  v_target_kind text;
  v_target_id text;
  v_status text;
begin
  if length(trim(coalesce(p_complainant_name, ''))) = 0
     or length(trim(coalesce(p_complainant_name, ''))) > 200
     or length(trim(coalesce(p_complainant_email, ''))) = 0
     or length(trim(coalesce(p_complainant_email, ''))) > 320
     or trim(p_complainant_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(trim(coalesce(p_complainant_address, ''))) > 1000
     or length(trim(coalesce(p_copyrighted_work, ''))) = 0
     or length(trim(coalesce(p_copyrighted_work, ''))) > 2000
     or length(trim(coalesce(p_infringing_url, ''))) = 0
     or length(trim(coalesce(p_infringing_url, ''))) > 2000
     or trim(p_infringing_url) !~* '^https://[^[:space:]]+$'
     or length(trim(coalesce(p_signature, ''))) = 0
     or length(trim(coalesce(p_signature, ''))) > 200
     or p_good_faith is not true
     or p_accuracy_under_penalty is not true
     or p_good_faith_attestation_version <> '2026-07-12'
     or p_accuracy_attestation_version <> '2026-07-12'
     or p_good_faith_attestation_text <>
       'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.'
     or p_accuracy_attestation_text <>
       'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  select r.target_kind, r.target_id
    into v_target_kind, v_target_id
  from public.nw_resolve_public_url(p_infringing_url) r
  limit 1;
  v_status := case when v_target_kind is null then 'needs_resolution' else 'received' end;

  insert into public.nw_dmca_notices (
    kind, submitter_profile_id, complainant_name, complainant_email,
    complainant_address, copyrighted_work, infringing_url, target_kind,
    target_id, good_faith, accuracy_under_penalty, signature, status,
    good_faith_attestation_text, good_faith_attestation_version,
    accuracy_attestation_text, accuracy_attestation_version
  ) values (
    'takedown', p_submitter_profile_id, trim(p_complainant_name),
    lower(trim(p_complainant_email)), trim(coalesce(p_complainant_address, '')),
    trim(p_copyrighted_work), trim(p_infringing_url), v_target_kind,
    v_target_id, true, true, trim(p_signature), v_status,
    p_good_faith_attestation_text, p_good_faith_attestation_version,
    p_accuracy_attestation_text, p_accuracy_attestation_version
  ) returning id into v_notice_id;

  if v_target_kind is not null then
    insert into public.nw_reports (
      reporter_id, target_kind, target_id, reason, detail, intake_source,
      dmca_notice_id
    ) values (
      null, v_target_kind, v_target_id, 'copyright',
      'DMCA takedown: ' || left(trim(p_copyrighted_work), 500), 'dmca',
      v_notice_id
    ) returning id into v_report_id;

    update public.nw_dmca_notices
      set report_id = v_report_id, updated_at = now()
      where id = v_notice_id;
  end if;

  insert into public.nw_dmca_events (
    notice_kind, takedown_notice_id, event, actor_ref, note, metadata
  ) values (
    'takedown', v_notice_id,
    case when v_status = 'needs_resolution' then 'needs_resolution' else 'received' end,
    'system:intake', '',
    jsonb_build_object(
      'targetKind', v_target_kind,
      'targetId', v_target_id,
      'reportId', v_report_id
    )
  );

  if not exists (select 1 from public.nw_dmca_notices where id = v_notice_id)
     or (v_target_kind is not null and not exists (
       select 1 from public.nw_reports
       where id = v_report_id and dmca_notice_id = v_notice_id and status = 'open'
     )) then
    raise exception 'nw_submit_dmca_takedown: queue visibility invariant failed';
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'referenceId', v_notice_id,
    'resolutionStatus', case when v_status = 'needs_resolution' then 'needs-resolution' else 'resolved' end,
    'targetKind', v_target_kind,
    'targetId', v_target_id,
    'queueVisible', true
  );
end;
$$;

revoke all on function public.nw_submit_dmca_takedown(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.nw_submit_dmca_takedown(
  uuid, text, text, text, text, text, boolean, text, text, boolean, text, text, text
) to service_role;

create or replace function public.nw_submit_dmca_counter_notice(
  p_submitter_profile_id uuid,
  p_original_notice_reference text,
  p_counter_notifier_name text,
  p_counter_notifier_address text,
  p_counter_notifier_phone text,
  p_counter_notifier_email text,
  p_removed_material text,
  p_material_location_before_removal text,
  p_good_faith_mistake_or_misidentification boolean,
  p_statement_under_penalty_of_perjury boolean,
  p_mistake_attestation_text text,
  p_mistake_attestation_version text,
  p_consent_to_federal_jurisdiction boolean,
  p_jurisdiction_attestation_text text,
  p_jurisdiction_attestation_version text,
  p_acceptance_of_service_of_process boolean,
  p_service_attestation_text text,
  p_service_attestation_version text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter_id uuid;
  v_original_notice_id uuid;
  v_candidate_original_id uuid;
  v_original_reference text := nullif(trim(coalesce(p_original_notice_reference, '')), '');
  v_target_kind text;
  v_target_id text;
  v_status text;
begin
  if length(trim(coalesce(p_counter_notifier_name, ''))) = 0
     or length(trim(coalesce(p_counter_notifier_name, ''))) > 200
     or length(trim(coalesce(p_counter_notifier_address, ''))) = 0
     or length(trim(coalesce(p_counter_notifier_address, ''))) > 1000
     or length(trim(coalesce(p_counter_notifier_phone, ''))) = 0
     or length(trim(coalesce(p_counter_notifier_phone, ''))) > 50
     or length(trim(coalesce(p_counter_notifier_email, ''))) = 0
     or length(trim(coalesce(p_counter_notifier_email, ''))) > 320
     or trim(p_counter_notifier_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(trim(coalesce(p_removed_material, ''))) = 0
     or length(trim(coalesce(p_removed_material, ''))) > 4000
     or length(trim(coalesce(p_material_location_before_removal, ''))) = 0
     or length(trim(coalesce(p_material_location_before_removal, ''))) > 2000
     or trim(p_material_location_before_removal) !~* '^https://[^[:space:]]+$'
     or length(trim(coalesce(p_signature, ''))) = 0
     or length(trim(coalesce(p_signature, ''))) > 200
     or p_good_faith_mistake_or_misidentification is not true
     or p_statement_under_penalty_of_perjury is not true
     or p_consent_to_federal_jurisdiction is not true
     or p_acceptance_of_service_of_process is not true
     or p_mistake_attestation_version <> '2026-07-12'
     or p_jurisdiction_attestation_version <> '2026-07-12'
     or p_service_attestation_version <> '2026-07-12'
     or p_mistake_attestation_text <>
       'I state under penalty of perjury that I have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.'
     or p_jurisdiction_attestation_text <>
       'I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or if my address is outside the United States, for any judicial district in which MyNews may be found.'
     or p_service_attestation_text <>
       'I will accept service of process from the person who submitted the original notice of claimed infringement, or that person''s agent.' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  if v_original_reference is not null then
    begin
      v_candidate_original_id := v_original_reference::uuid;
    exception when others then
      v_candidate_original_id := null;
    end;
    if v_candidate_original_id is not null then
      select n.id into v_original_notice_id
      from public.nw_dmca_notices n
      where n.id = v_candidate_original_id
      limit 1;
    end if;
  end if;

  select r.target_kind, r.target_id
    into v_target_kind, v_target_id
  from public.nw_resolve_public_url(p_material_location_before_removal) r
  limit 1;
  v_status := case when v_target_kind is null then 'needs_resolution' else 'received' end;

  insert into public.nw_dmca_counter_notices (
    submitter_profile_id, original_notice_id, original_notice_reference,
    counter_notifier_name, counter_notifier_address, counter_notifier_phone,
    counter_notifier_email, removed_material, material_location_before_removal,
    target_kind, target_id, good_faith_mistake_or_misidentification,
    statement_under_penalty_of_perjury, mistake_attestation_text,
    mistake_attestation_version, consent_to_federal_jurisdiction,
    jurisdiction_attestation_text, jurisdiction_attestation_version,
    acceptance_of_service_of_process, service_attestation_text,
    service_attestation_version, signature, status
  ) values (
    p_submitter_profile_id, v_original_notice_id, v_original_reference,
    trim(p_counter_notifier_name), trim(p_counter_notifier_address),
    trim(p_counter_notifier_phone), lower(trim(p_counter_notifier_email)),
    trim(p_removed_material), trim(p_material_location_before_removal),
    v_target_kind, v_target_id, true, true, p_mistake_attestation_text,
    p_mistake_attestation_version, true, p_jurisdiction_attestation_text,
    p_jurisdiction_attestation_version, true, p_service_attestation_text,
    p_service_attestation_version, trim(p_signature), v_status
  ) returning id into v_counter_id;

  insert into public.nw_dmca_events (
    notice_kind, counter_notice_id, event, actor_ref, note, metadata
  ) values (
    'counter', v_counter_id,
    case when v_status = 'needs_resolution' then 'needs_resolution' else 'received' end,
    'system:intake', '',
    jsonb_build_object(
      'targetKind', v_target_kind,
      'targetId', v_target_id,
      'originalNoticeId', v_original_notice_id,
      'originalNoticeReference', v_original_reference,
      'originalMatched', v_original_notice_id is not null
    )
  );

  if not exists (
    select 1 from public.nw_dmca_counter_notices where id = v_counter_id
  ) then
    raise exception 'nw_submit_dmca_counter_notice: queue visibility invariant failed';
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'referenceId', v_counter_id,
    'resolutionStatus', case when v_status = 'needs_resolution' then 'needs-resolution' else 'resolved' end,
    'originalNoticeMatched', v_original_notice_id is not null,
    'targetKind', v_target_kind,
    'targetId', v_target_id,
    'queueVisible', true
  );
end;
$$;

revoke all on function public.nw_submit_dmca_counter_notice(
  uuid, text, text, text, text, text, text, text, boolean, boolean, text, text,
  boolean, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.nw_submit_dmca_counter_notice(
  uuid, text, text, text, text, text, text, text, boolean, boolean, text, text,
  boolean, text, text, boolean, text, text, text
) to service_role;

-- ============================================================ workflow actions

create or replace function public.nw_dmca_apply_action(
  p_notice_id uuid,
  p_notice_kind text,
  p_action text,
  p_moderator_ref text,
  p_note text,
  p_value text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_url text;
  v_target_kind text;
  v_target_id text;
  v_report_id uuid;
  v_original_notice_id uuid;
  v_value_uuid uuid;
  v_forward_email text;
  v_restore_uuid uuid;
  v_found boolean;
  v_assignee text;
begin
  if length(trim(coalesce(p_moderator_ref, ''))) = 0 then
    return 'bad-moderator';
  end if;
  if p_notice_kind not in ('takedown', 'counter') then
    return 'bad-kind';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nw-dmca-action:' || p_notice_kind || ':' || p_notice_id::text, 0)
  );

  if p_notice_kind = 'takedown' then
    select status, infringing_url, target_kind, target_id, report_id
      into v_status, v_url, v_target_kind, v_target_id, v_report_id
    from public.nw_dmca_notices
    where id = p_notice_id
    for update;
    if v_status is null then
      return 'not-found';
    end if;

    if p_action = 'assign' then
      v_assignee := coalesce(nullif(trim(coalesce(p_value, '')), ''), trim(p_moderator_ref));
      update public.nw_dmca_notices
        set assigned_moderator_ref = v_assignee, updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'assigned', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('assignee', v_assignee));
      return 'assigned';
    elsif p_action = 'add_note' then
      if length(trim(coalesce(p_note, ''))) = 0 then return 'note-required'; end if;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'communication', p_moderator_ref, trim(p_note));
      return 'noted';
    elsif p_action = 'acknowledge' then
      if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
      update public.nw_dmca_notices
        set acknowledged_at = coalesce(acknowledged_at, v_now),
            status = case when status = 'received' then 'acknowledged' else status end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'acknowledged', p_moderator_ref, coalesce(p_note, ''));
      return 'acknowledged';
    elsif p_action = 'forward' then
      if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
      v_forward_email := nullif(lower(trim(coalesce(p_value, ''))), '');
      if v_forward_email is null then return 'email-required'; end if;
      update public.nw_dmca_notices
        set forwarded_at = v_now,
            forwarded_to_email = v_forward_email,
            status = case when status = 'needs_resolution' then status else 'forwarded' end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'forwarded', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('to', v_forward_email));
      return 'forwarded';
    elsif p_action = 'resolve_url' then
      select r.target_kind, r.target_id
        into v_target_kind, v_target_id
      from public.nw_resolve_public_url(v_url) r
      limit 1;
      if v_target_kind is null then
        insert into public.nw_dmca_events
          (notice_kind, takedown_notice_id, event, actor_ref, note)
        values
          ('takedown', p_notice_id, 'resolution_retry_failed', p_moderator_ref,
           coalesce(p_note, ''));
        return 'still-needs-resolution';
      end if;
      if v_report_id is null then
        insert into public.nw_reports (
          reporter_id, target_kind, target_id, reason, detail, intake_source,
          dmca_notice_id
        )
        select null, v_target_kind, v_target_id, 'copyright',
               'DMCA takedown: ' || left(copyrighted_work, 500), 'dmca', id
        from public.nw_dmca_notices
        where id = p_notice_id
        returning id into v_report_id;
      end if;
      update public.nw_dmca_notices
        set target_kind = v_target_kind,
            target_id = v_target_id,
            report_id = v_report_id,
            status = case when acknowledged_at is null then 'received' else 'acknowledged' end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'target_resolved', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('targetKind', v_target_kind, 'targetId', v_target_id,
                            'reportId', v_report_id));
      return 'resolved';
    elsif p_action = 'link_strike' then
      begin
        v_value_uuid := trim(coalesce(p_value, ''))::uuid;
      exception when others then
        return 'bad-strike';
      end;
      select true into v_found
      from public.nw_moderation_actions
      where id = v_value_uuid and action = 'suspend_profile';
      if not coalesce(v_found, false) then return 'bad-strike'; end if;
      update public.nw_dmca_notices n
        set strike_action_id = a.id,
            strike_profile_id = case when a.target_kind = 'profile' then a.target_id::uuid else null end,
            status = 'actioned',
            actioned_at = v_now,
            updated_at = v_now
      from public.nw_moderation_actions a
      where n.id = p_notice_id and a.id = v_value_uuid;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'strike_linked', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('strikeActionId', v_value_uuid));
      return 'strike-linked';
    elsif p_action = 'close' then
      if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
      update public.nw_dmca_notices
        set status = 'closed', closed_at = v_now, disposition = trim(p_note), updated_at = v_now
        where id = p_notice_id;
      if v_report_id is not null then
        update public.nw_reports set status = 'no_action'
        where id = v_report_id and status = 'open';
      end if;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'closed', p_moderator_ref, trim(p_note));
      return 'closed';
    end if;
    return 'bad-action';
  end if;

  -- Counter-notice state machine:
  -- needs_resolution -> received -> forwarded_to_claimant -> waiting_period
  -- -> restored | litigation_hold | closed.
  select status, material_location_before_removal, target_kind, target_id,
         original_notice_id
    into v_status, v_url, v_target_kind, v_target_id, v_original_notice_id
  from public.nw_dmca_counter_notices
  where id = p_notice_id
  for update;
  if v_status is null then
    return 'not-found';
  end if;

  if p_action = 'assign' then
    v_assignee := coalesce(nullif(trim(coalesce(p_value, '')), ''), trim(p_moderator_ref));
    update public.nw_dmca_counter_notices
      set assigned_moderator_ref = v_assignee, updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'assigned', p_moderator_ref, coalesce(p_note, ''),
       jsonb_build_object('assignee', v_assignee));
    return 'assigned';
  elsif p_action = 'add_note' then
    if length(trim(coalesce(p_note, ''))) = 0 then return 'note-required'; end if;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'communication', p_moderator_ref, trim(p_note));
    return 'noted';
  elsif p_action = 'acknowledge' then
    if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
    update public.nw_dmca_counter_notices
      set acknowledged_at = coalesce(acknowledged_at, v_now), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'acknowledged', p_moderator_ref, coalesce(p_note, ''));
    return 'acknowledged';
  elsif p_action = 'resolve_url' then
    select r.target_kind, r.target_id
      into v_target_kind, v_target_id
    from public.nw_resolve_public_url(v_url) r
    limit 1;
    if v_target_kind is null then
      insert into public.nw_dmca_events
        (notice_kind, counter_notice_id, event, actor_ref, note)
      values
        ('counter', p_notice_id, 'resolution_retry_failed', p_moderator_ref,
         coalesce(p_note, ''));
      return 'still-needs-resolution';
    end if;
    update public.nw_dmca_counter_notices
      set target_kind = v_target_kind, target_id = v_target_id,
          status = case when status = 'needs_resolution' then 'received' else status end,
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'target_resolved', p_moderator_ref, coalesce(p_note, ''),
       jsonb_build_object('targetKind', v_target_kind, 'targetId', v_target_id));
    return 'resolved';
  elsif p_action = 'link_original' then
    begin
      v_value_uuid := trim(coalesce(p_value, ''))::uuid;
    exception when others then
      return 'bad-original';
    end;
    if not exists (select 1 from public.nw_dmca_notices where id = v_value_uuid) then
      return 'bad-original';
    end if;
    update public.nw_dmca_counter_notices
      set original_notice_id = v_value_uuid,
          original_notice_reference = v_value_uuid::text,
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'original_notice_linked', p_moderator_ref,
       coalesce(p_note, ''), jsonb_build_object('originalNoticeId', v_value_uuid));
    return 'original-linked';
  elsif p_action = 'unlink_original' then
    update public.nw_dmca_counter_notices
      set original_notice_id = null, updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values
      ('counter', p_notice_id, 'original_notice_unlinked', p_moderator_ref,
       coalesce(p_note, ''));
    return 'original-unlinked';
  elsif p_action = 'forward_to_claimant' then
    if v_status <> 'received' then return 'bad-transition'; end if;
    if v_original_notice_id is null then return 'original-required'; end if;
    select complainant_email into v_forward_email
    from public.nw_dmca_notices where id = v_original_notice_id;
    if v_forward_email is null then return 'original-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'forwarded_to_claimant', forwarded_to_claimant_at = v_now,
          forwarded_to_email = v_forward_email, updated_at = v_now
      where id = p_notice_id;
    update public.nw_dmca_notices
      set forwarded_at = v_now, forwarded_to_email = v_forward_email, updated_at = v_now
      where id = v_original_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'forwarded_to_claimant', p_moderator_ref,
       coalesce(p_note, ''), jsonb_build_object('to', v_forward_email));
    return 'forwarded-to-claimant';
  elsif p_action = 'start_waiting_period' then
    if v_status <> 'forwarded_to_claimant' then return 'bad-transition'; end if;
    update public.nw_dmca_counter_notices
      set status = 'waiting_period', waiting_period_started_at = v_now,
          restoration_eligible_at = public.nw_add_business_days(v_now, 10),
          restoration_deadline_at = public.nw_add_business_days(v_now, 14),
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'waiting_period_started', p_moderator_ref,
       coalesce(p_note, ''),
       jsonb_build_object('minimumBusinessDays', 10, 'maximumBusinessDays', 14));
    return 'waiting-period';
  elsif p_action = 'restore_content' then
    if v_status <> 'waiting_period' then return 'bad-transition'; end if;
    if not exists (
      select 1 from public.nw_dmca_counter_notices
      where id = p_notice_id and restoration_eligible_at <= v_now
    ) then
      return 'waiting-period-active';
    end if;
    begin
      v_restore_uuid := v_target_id::uuid;
    exception when others then
      v_restore_uuid := null;
    end;
    if v_restore_uuid is null then return 'bad-target'; end if;
    if v_target_kind = 'article' then
      update public.nw_articles set status = 'published' where id = v_restore_uuid
      returning true into v_found;
    elsif v_target_kind = 'suggestion' then
      update public.nw_edit_suggestions set status = 'open' where id = v_restore_uuid
      returning true into v_found;
    else
      return 'bad-target';
    end if;
    if not coalesce(v_found, false) then return 'bad-target'; end if;
    update public.nw_dmca_counter_notices
      set status = 'restored', restored_at = v_now, disposition = nullif(trim(coalesce(p_note, '')), ''),
          updated_at = v_now
      where id = p_notice_id;
    if v_original_notice_id is not null then
      update public.nw_dmca_notices
        set status = 'restored', restored_at = v_now, updated_at = v_now
        where id = v_original_notice_id;
      select report_id into v_report_id
      from public.nw_dmca_notices where id = v_original_notice_id;
    end if;
    insert into public.nw_moderation_actions
      (report_id, moderator_ref, action, target_kind, target_id, note)
    values
      (v_report_id, p_moderator_ref, 'restore', v_target_kind, v_target_id,
       coalesce(p_note, 'DMCA counter-notice restoration'));
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'content_restored', p_moderator_ref, coalesce(p_note, ''));
    if v_original_notice_id is not null then
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', v_original_notice_id, 'content_restored', p_moderator_ref,
         coalesce(p_note, ''), jsonb_build_object('counterNoticeId', p_notice_id));
    end if;
    return 'restored';
  elsif p_action = 'litigation_hold' then
    if v_status not in ('forwarded_to_claimant', 'waiting_period') then
      return 'bad-transition';
    end if;
    if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'litigation_hold', litigation_hold_at = v_now,
          disposition = trim(p_note), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'litigation_hold', p_moderator_ref, trim(p_note));
    return 'litigation-hold';
  elsif p_action = 'close' then
    if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'closed', closed_at = v_now, disposition = trim(p_note), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'closed', p_moderator_ref, trim(p_note));
    return 'closed';
  end if;

  return 'bad-action';
end;
$$;

revoke all on function public.nw_dmca_apply_action(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_dmca_apply_action(uuid, text, text, text, text, text)
  to service_role;

-- ============================================================ authenticated status lookup

-- mynews-my-notices remains JWT-gated. The caller must also supply the exact
-- authenticated account email and notice ID; an email/ID pair alone is never a
-- public read credential.
create or replace function public.nw_get_my_dmca_submission_status(
  p_user_id uuid,
  p_notice_kind text,
  p_notice_id uuid,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_notice_kind not in ('takedown', 'counter')
     or length(trim(coalesce(p_email, ''))) = 0
     or not exists (
       select 1 from auth.users u
       where u.id = p_user_id and lower(u.email) = lower(trim(p_email))
     ) then
    return null;
  end if;

  if p_notice_kind = 'takedown' then
    select jsonb_build_object(
      'kind', 'takedown', 'referenceId', n.id, 'status', n.status,
      'resolutionStatus', case when n.target_kind is null then 'needs-resolution' else 'resolved' end,
      'acknowledgmentDueAt', n.acknowledgment_due_at,
      'acknowledgedAt', n.acknowledged_at, 'createdAt', n.created_at
    ) into v_result
    from public.nw_dmca_notices n
    where n.id = p_notice_id
      and lower(n.complainant_email) = lower(trim(p_email));
  else
    select jsonb_build_object(
      'kind', 'counter', 'referenceId', c.id, 'status', c.status,
      'resolutionStatus', case when c.target_kind is null then 'needs-resolution' else 'resolved' end,
      'acknowledgmentDueAt', c.acknowledgment_due_at,
      'acknowledgedAt', c.acknowledged_at,
      'restorationEligibleAt', c.restoration_eligible_at,
      'restorationDeadlineAt', c.restoration_deadline_at,
      'createdAt', c.created_at
    ) into v_result
    from public.nw_dmca_counter_notices c
    where c.id = p_notice_id
      and lower(c.counter_notifier_email) = lower(trim(p_email));
  end if;
  return v_result;
end;
$$;

revoke all on function public.nw_get_my_dmca_submission_status(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.nw_get_my_dmca_submission_status(uuid, text, uuid, text)
  to service_role;
