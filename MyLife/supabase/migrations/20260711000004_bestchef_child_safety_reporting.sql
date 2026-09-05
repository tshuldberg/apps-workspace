-- BestChef child-safety reporting workflow data model + seam RPC (audit C5).
--
-- SCOPE: this migration builds the REPORTING WORKFLOW SEAM only. It does NOT
-- contain hash lists, hash-matching logic, or NCMEC transmission code. The
-- actual hash-match detection stays behind the ChildSafetyHashMatchProvider
-- interface in supabase/functions/_shared/bestchef-moderation-providers.ts,
-- pending a contracted vendor and NCMEC registration (founder item F3).
--
-- On a confirmed hash hit, the child-safety provider path in the
-- bestchef-media-screening worker calls bc_record_child_safety_hit(...), which:
--   1. Blocks the media asset (moderation_status='quarantined', visibility
--      forced non-public) so it is never served while a report is open.
--   2. Inserts a bc_child_safety_reports row with status='pending_registration'.
--   3. Preserves evidence pointers (storage bucket/key, content hash) so the
--      report can be transmitted once F3 is complete.
--
-- NO TRANSMISSION HAPPENS HERE. Transmission to NCMEC requires the org to be a
-- registered electronic service provider (18 U.S.C. 2258A). Until that is done
-- (founder item F3), reports stay in status='pending_registration'. The status
-- transition to 'transmitted' is a future, separately-authored step.

-- ── Reporting table (definer-only: zero client policies) ────────────────────
--
-- RLS is enabled with NO anon/authenticated policies on purpose. Only the
-- service role (via the SECURITY DEFINER functions below) may touch this table.
-- Child-safety evidence is among the most sensitive data in the system and must
-- never be reachable from a client.
create table if not exists public.bc_child_safety_reports (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.bc_media_assets(id) on delete restrict,
  owner_profile_id uuid references social_profiles(id) on delete set null,
  -- Opaque vendor reference for the matched hash-list entry. No hash values or
  -- lists are stored here; this is only a pointer supplied by the provider seam.
  hash_provider text not null,
  hash_match_ref text,
  -- Evidence retention pointers: enough to locate the preserved object for a
  -- future, F3-gated transmission. The object bytes are protected from the
  -- media-purge worker because bc_record_child_safety_hit forces the asset to
  -- moderation_status='quarantined', and bestchef-media-purge's
  -- buildPurgeCandidatesFilter excludes quarantined assets (audit C5). These
  -- columns just record where the retained object lives.
  evidence_storage_bucket text,
  evidence_storage_key text,
  evidence_content_hash text,
  -- Lifecycle. Default is pending_registration because NCMEC registration is not
  -- done (F3). Allowed transitions are enforced by the immutability trigger and
  -- the status-transition function below.
  status text not null default 'pending_registration'
    check (status in ('pending_registration', 'ready_for_transmission', 'transmitted', 'dismissed')),
  detected_at timestamptz not null default now(),
  transmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One open report per asset: re-detection updates the existing row rather than
  -- piling on duplicates.
  constraint bc_child_safety_reports_asset_unique unique (media_asset_id)
);

create index if not exists bc_child_safety_reports_status_idx
  on public.bc_child_safety_reports (status, detected_at);
create index if not exists bc_child_safety_reports_profile_idx
  on public.bc_child_safety_reports (owner_profile_id, detected_at desc);

alter table public.bc_child_safety_reports enable row level security;
-- No policies: service-role only. Deliberately unreachable from any client.

revoke all on table public.bc_child_safety_reports from public, anon, authenticated;

-- ── Immutability trigger ────────────────────────────────────────────────────
--
-- Evidence rows are append-mostly: once created, the only mutation allowed is a
-- forward status transition (and its timestamps) performed by the service role.
-- Any attempt to rewrite the asset ref, owner, evidence pointers, or detection
-- context is rejected. This makes the report chain-of-custody tamper-evident.
create or replace function public.bc_child_safety_reports_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_from text[];
begin
  -- Immutable evidence fields.
  if new.media_asset_id is distinct from old.media_asset_id
     or new.hash_provider is distinct from old.hash_provider
     or new.hash_match_ref is distinct from old.hash_match_ref
     or new.evidence_storage_bucket is distinct from old.evidence_storage_bucket
     or new.evidence_storage_key is distinct from old.evidence_storage_key
     or new.evidence_content_hash is distinct from old.evidence_content_hash
     or new.detected_at is distinct from old.detected_at
     or new.created_at is distinct from old.created_at then
    raise exception 'bc_child_safety_reports: evidence fields are immutable';
  end if;

  -- Only forward status transitions are permitted.
  v_allowed_from := case new.status
    when 'ready_for_transmission' then array['pending_registration']
    when 'transmitted' then array['ready_for_transmission']
    when 'dismissed' then array['pending_registration', 'ready_for_transmission']
    when 'pending_registration' then array['pending_registration']
    else array[]::text[]
  end;

  if new.status is distinct from old.status
     and not (old.status = any(v_allowed_from)) then
    raise exception 'bc_child_safety_reports: illegal status transition % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bc_child_safety_reports_immutability on public.bc_child_safety_reports;
create trigger bc_child_safety_reports_immutability
  before update on public.bc_child_safety_reports
  for each row
  execute function public.bc_child_safety_reports_immutable();

-- ── Seam RPC: record a confirmed hash hit ───────────────────────────────────
--
-- Called by the ChildSafetyHashMatchProvider dispatch path in the
-- bestchef-media-screening worker on a 'hit'. It does NOT decide whether the
-- content is unsafe (the provider already did, behind the seam); it records the
-- outcome, blocks the asset, and files the pending_registration report.
create or replace function public.bc_record_child_safety_hit(
  p_media_asset_id uuid,
  p_owner_profile_id uuid default null,
  p_match_ref text default null,
  p_provider text default 'child_safety_hash',
  p_detected_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.bc_media_assets%rowtype;
  v_report_id uuid;
begin
  select * into v_asset from public.bc_media_assets where id = p_media_asset_id;
  if not found then
    raise exception 'bc_record_child_safety_hit: media asset % not found', p_media_asset_id;
  end if;

  -- 1. Block the asset: quarantine + force non-public so it is never served.
  update public.bc_media_assets
     set moderation_status = 'quarantined',
         visibility = 'private',
         updated_at = now()
   where id = p_media_asset_id;

  -- 2. File / refresh the pending_registration report, preserving evidence refs.
  insert into public.bc_child_safety_reports (
    media_asset_id,
    owner_profile_id,
    hash_provider,
    hash_match_ref,
    evidence_storage_bucket,
    evidence_storage_key,
    evidence_content_hash,
    status,
    detected_at
  ) values (
    p_media_asset_id,
    coalesce(p_owner_profile_id, v_asset.owner_profile_id),
    coalesce(p_provider, 'child_safety_hash'),
    p_match_ref,
    v_asset.storage_bucket,
    v_asset.storage_key,
    v_asset.content_hash,
    'pending_registration',
    coalesce(p_detected_at, now())
  )
  on conflict (media_asset_id) do update
    set hash_match_ref = coalesce(excluded.hash_match_ref, public.bc_child_safety_reports.hash_match_ref),
        detected_at = excluded.detected_at,
        updated_at = now()
  returning id into v_report_id;

  -- 3. Transmission is intentionally NOT performed here. NCMEC registration is
  --    founder item F3; the report stays pending_registration until that lands.
  --    Ops runbook: docs/runbooks/bestchef-moderation-ops-runbook.md (F3 section).
  return v_report_id;
end;
$$;

revoke all on function public.bc_record_child_safety_hit(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.bc_record_child_safety_hit(uuid, uuid, text, text, timestamptz)
  to service_role;

comment on table public.bc_child_safety_reports is
  'Child-safety hash-hit reporting workflow (audit C5). Definer-only, no client policies. '
  'Reports stay pending_registration until NCMEC registration (founder item F3). No transmission code lives here.';
comment on function public.bc_record_child_safety_hit(uuid, uuid, text, text, timestamptz) is
  'Seam RPC called on a confirmed child-safety hash hit: blocks the asset and files a '
  'pending_registration report. No detection logic and no NCMEC transmission (founder item F3).';
