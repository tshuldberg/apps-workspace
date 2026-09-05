export const ADAPTER_CONTRACTS_SQL = `
-- Phase 1 adapter contracts. This migration only expands or safely corrects
-- version 2 state so the preceding release can remain online during rollout.

-- Request-bound idempotency claims. The all-zero digest is the explicit legacy
-- marker for rows written before request digests existed.
ALTER TABLE ops.idempotency_results
  ALTER COLUMN result DROP NOT NULL,
  ADD COLUMN request_digest bytea NOT NULL DEFAULT decode(repeat('00', 32), 'hex'),
  ADD COLUMN state text NOT NULL DEFAULT 'committed',
  ADD COLUMN claim_owner text,
  ADD COLUMN claim_expires_at timestamptz,
  ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

ALTER TABLE ops.idempotency_results
  ADD CONSTRAINT idempotency_request_digest_length
    CHECK (octet_length(request_digest) = 32),
  ADD CONSTRAINT idempotency_state_known
    CHECK (state IN ('in_progress', 'committed')),
  ADD CONSTRAINT idempotency_claim_owner_present
    CHECK (claim_owner IS NULL OR length(claim_owner) BETWEEN 1 AND 256),
  ADD CONSTRAINT idempotency_fencing_nonnegative
    CHECK (fencing_token >= 0),
  ADD CONSTRAINT idempotency_state_coherent CHECK (
    (state = 'committed'
      AND result IS NOT NULL
      AND claim_owner IS NULL
      AND claim_expires_at IS NULL)
    OR
    (state = 'in_progress'
      AND result IS NULL
      AND claim_owner IS NOT NULL
      AND claim_expires_at IS NOT NULL
      AND fencing_token > 0)
  );

CREATE INDEX idempotency_claim_expiry_idx
  ON ops.idempotency_results (claim_expires_at, scope, idempotency_key)
  WHERE state = 'in_progress';

ALTER TABLE ops.job_leases
  ADD COLUMN fencing_token bigint,
  ADD COLUMN acquired_at timestamptz,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp();

UPDATE ops.job_leases
SET fencing_token = attempt::bigint,
    acquired_at = LEAST(updated_at, leased_until);

ALTER TABLE ops.job_leases
  ALTER COLUMN fencing_token SET NOT NULL,
  ALTER COLUMN fencing_token SET DEFAULT 1,
  ALTER COLUMN acquired_at SET NOT NULL,
  ALTER COLUMN acquired_at SET DEFAULT clock_timestamp(),
  ADD CONSTRAINT job_lease_fencing_positive CHECK (fencing_token > 0),
  ADD CONSTRAINT job_lease_expiry_order CHECK (leased_until >= acquired_at);

CREATE INDEX job_leases_fenced_cursor_idx
  ON ops.job_leases (queue, leased_until, fencing_token, job_id);

ALTER TABLE ops.backup_restore_proofs
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD CONSTRAINT restore_proof_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT restore_proof_source_present CHECK (length(source_backup_id) BETWEEN 1 AND 256),
  ADD CONSTRAINT restore_proof_release_present CHECK (length(release_sha) BETWEEN 1 AND 256);

CREATE INDEX backup_restore_proofs_restored_cursor_idx
  ON ops.backup_restore_proofs (restored_at DESC, proof_id DESC);

CREATE INDEX backup_restore_proofs_recorded_cursor_idx
  ON ops.backup_restore_proofs (recorded_at DESC, proof_id DESC);

ALTER TABLE ops.release_manifests
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN manifest_digest bytea NOT NULL DEFAULT decode(repeat('00', 32), 'hex'),
  ADD COLUMN supersedes_release_id text REFERENCES ops.release_manifests(release_id),
  ADD CONSTRAINT release_manifest_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT release_manifest_digest_length CHECK (octet_length(manifest_digest) = 32),
  ADD CONSTRAINT release_manifest_git_sha_present CHECK (length(git_sha) BETWEEN 1 AND 256),
  ADD CONSTRAINT release_manifest_not_self_superseding
    CHECK (supersedes_release_id IS NULL OR supersedes_release_id <> release_id),
  ADD CONSTRAINT release_manifest_approval_order
    CHECK (approved_at IS NULL OR approved_at >= created_at);

CREATE INDEX release_manifests_created_cursor_idx
  ON ops.release_manifests (created_at DESC, release_id DESC);

-- Typed directory lookup state. Existing signed records are deliberately parsed
-- during upgrade. A corrupt record aborts the migration instead of becoming an
-- untyped row that could be served differently by old and new processes.
ALTER TABLE directory.publications
  ADD COLUMN owner_device_id text,
  ADD COLUMN community_id text,
  ADD COLUMN content_id text,
  ADD COLUMN publication_kind text,
  ADD COLUMN category text,
  ADD COLUMN descriptor_revision bigint,
  ADD COLUMN descriptor_status text,
  ADD COLUMN descriptor_updated_at timestamptz,
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1;

UPDATE directory.publications
SET owner_device_id = signed_record::jsonb #>> '{descriptor,ownerDeviceId}',
    community_id = signed_record::jsonb #>> '{descriptor,communityId}',
    content_id = signed_record::jsonb #>> '{descriptor,contentId}',
    publication_kind = signed_record::jsonb #>> '{descriptor,kind}',
    category = signed_record::jsonb #>> '{descriptor,category}',
    descriptor_revision = (signed_record::jsonb #>> '{descriptor,revision}')::bigint,
    descriptor_status = signed_record::jsonb #>> '{descriptor,status}',
    descriptor_updated_at = (signed_record::jsonb #>> '{descriptor,updatedAt}')::timestamptz;

ALTER TABLE directory.publications
  ALTER COLUMN owner_device_id SET NOT NULL,
  ALTER COLUMN community_id SET NOT NULL,
  ALTER COLUMN content_id SET NOT NULL,
  ALTER COLUMN publication_kind SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN descriptor_revision SET NOT NULL,
  ALTER COLUMN descriptor_status SET NOT NULL,
  ALTER COLUMN descriptor_updated_at SET NOT NULL,
  ADD CONSTRAINT directory_publication_kind_known
    CHECK (publication_kind IN ('community', 'channel', 'forum', 'post')),
  ADD CONSTRAINT directory_publication_category_known
    CHECK (category IN (
      'technology', 'gaming', 'news', 'sports', 'local',
      'hobbies', 'creative', 'discussion', 'other'
    )),
  ADD CONSTRAINT directory_publication_status_known
    CHECK (descriptor_status IN ('active', 'unpublished', 'killed')),
  ADD CONSTRAINT directory_publication_revision_nonnegative CHECK (descriptor_revision >= 0),
  ADD CONSTRAINT directory_publication_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE FUNCTION directory.hydrate_publication_lookup_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, directory
AS $meerkat_hydrate_publication_lookup$
DECLARE
  descriptor jsonb := NEW.signed_record::jsonb -> 'descriptor';
BEGIN
  NEW.owner_device_id := descriptor ->> 'ownerDeviceId';
  NEW.community_id := descriptor ->> 'communityId';
  NEW.content_id := descriptor ->> 'contentId';
  NEW.publication_kind := descriptor ->> 'kind';
  NEW.category := descriptor ->> 'category';
  NEW.descriptor_revision := (descriptor ->> 'revision')::bigint;
  NEW.descriptor_status := descriptor ->> 'status';
  NEW.descriptor_updated_at := (descriptor ->> 'updatedAt')::timestamptz;
  RETURN NEW;
END
$meerkat_hydrate_publication_lookup$;

REVOKE ALL ON FUNCTION directory.hydrate_publication_lookup_columns() FROM PUBLIC;

CREATE TRIGGER directory_publications_hydrate_lookup
BEFORE INSERT OR UPDATE OF signed_record ON directory.publications
FOR EACH ROW EXECUTE FUNCTION directory.hydrate_publication_lookup_columns();

CREATE TABLE directory.publication_rids (
  publication_id text NOT NULL REFERENCES directory.publications(publication_id) ON DELETE CASCADE,
  rid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (rid, publication_id),
  CONSTRAINT directory_publication_rid_canonical CHECK (rid ~ '^[0-9a-f]{16,64}$')
);

INSERT INTO directory.publication_rids (publication_id, rid)
SELECT publications.publication_id, rid
FROM directory.publications AS publications
CROSS JOIN LATERAL unnest(publications.rids) AS rid
ON CONFLICT DO NOTHING;

CREATE INDEX directory_publication_rids_publication_idx
  ON directory.publication_rids (publication_id, rid);

CREATE INDEX directory_publications_active_category_cursor_idx
  ON directory.publications (
    category, descriptor_updated_at DESC, publication_id DESC
  )
  WHERE descriptor_status = 'active';

CREATE INDEX directory_publications_owner_expiry_cursor_idx
  ON directory.publications (owner_device_id, expires_at, publication_id);

CREATE INDEX directory_publications_community_expiry_cursor_idx
  ON directory.publications (community_id, expires_at, publication_id);

CREATE INDEX directory_publications_content_expiry_cursor_idx
  ON directory.publications (content_id, expires_at, publication_id);

CREATE FUNCTION directory.sync_publication_rids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, directory
AS $meerkat_sync_publication_rids$
BEGIN
  DELETE FROM directory.publication_rids
  WHERE publication_id = NEW.publication_id;

  INSERT INTO directory.publication_rids (publication_id, rid)
  SELECT NEW.publication_id, rid
  FROM (SELECT DISTINCT unnest(NEW.rids) AS rid) AS normalized
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END
$meerkat_sync_publication_rids$;

REVOKE ALL ON FUNCTION directory.sync_publication_rids() FROM PUBLIC;

CREATE TRIGGER directory_publications_sync_rids
AFTER INSERT OR UPDATE OF rids ON directory.publications
FOR EACH ROW EXECUTE FUNCTION directory.sync_publication_rids();

ALTER TABLE directory.host_announcements
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN announced_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD CONSTRAINT directory_host_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT directory_host_announcer_hash_present
    CHECK (length(announcer_hash) BETWEEN 32 AND 128),
  ADD CONSTRAINT directory_host_opaque_record_present
    CHECK (length(opaque_record) BETWEEN 1 AND 65536);

CREATE INDEX directory_host_announcements_live_cursor_idx
  ON directory.host_announcements (rid, expires_at, announcer_hash);

-- CAS versions for mutable community records used by replicated services.
ALTER TABLE community.publications
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT community_publication_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE community.publication_freezes
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT publication_freeze_lifecycle_positive CHECK (lifecycle_version > 0);

-- Humanity and persona domain validation plus indexed lifecycle cursors.
ALTER TABLE humanity.challenges
  ADD CONSTRAINT humanity_challenge_kind_known
    CHECK (kind IN ('app-attest', 'play-integrity', 'turnstile')),
  ADD CONSTRAINT humanity_challenge_expiry_order CHECK (expires_at > issued_at);

ALTER TABLE humanity.spent_tokens
  ADD CONSTRAINT humanity_spent_expiry_order CHECK (expires_at > spent_at);

ALTER TABLE humanity.issuance_counts
  ADD CONSTRAINT humanity_issuance_day_nonnegative CHECK (day_bucket >= 0),
  ADD CONSTRAINT humanity_issuance_key_present CHECK (length(key_hash) BETWEEN 32 AND 256);

CREATE INDEX humanity_challenges_issued_cursor_idx
  ON humanity.challenges (issued_at DESC, challenge_id DESC);

ALTER TABLE persona.records
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT persona_record_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT persona_record_pubkey_present CHECK (length(persona_pubkey) BETWEEN 32 AND 256);

ALTER TABLE persona.alias_tombstones
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT persona_tombstone_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT persona_tombstone_cooldown_order CHECK (cooldown_until >= released_at);

ALTER TABLE persona.revocations
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT persona_revocation_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT persona_revocation_reason_present CHECK (length(reason) BETWEEN 1 AND 512);

ALTER TABLE persona.sessions
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT persona_session_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT persona_session_revocation_order
    CHECK (revoked_at IS NULL OR revoked_at >= issued_at);

CREATE INDEX persona_records_created_cursor_idx
  ON persona.records (created_at DESC, alias DESC);

CREATE INDEX persona_revocations_cursor_idx
  ON persona.revocations (revoked_at DESC, persona_pubkey DESC);

-- Hosted metadata separates policy and expiring byte reservations from active
-- object references. PostgreSQL never stores the object bytes.
ALTER TABLE hosted.subscriptions
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_subscription_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE hosted.app_purchases
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_app_purchase_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE hosted.app_links
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_app_link_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT hosted_app_link_consumed_order
    CHECK (consumed_at IS NULL OR consumed_at >= created_at);

ALTER TABLE hosted.app_persona_bindings
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_app_binding_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE hosted.storage_tenants
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_storage_tenant_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE hosted.storage_objects
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN metadata_status text NOT NULL DEFAULT 'legacy_unbound',
  ADD CONSTRAINT hosted_storage_object_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT hosted_storage_object_deleted_order
    CHECK (deleted_at IS NULL OR deleted_at >= created_at);

UPDATE hosted.storage_objects
SET metadata_status = 'verified'
WHERE size_bytes > 0
  AND checksum ~ '^[a-f0-9]{64}$'
  AND version_id IS NOT NULL
  AND length(version_id) BETWEEN 1 AND 512;

ALTER TABLE hosted.storage_objects
  ADD CONSTRAINT hosted_storage_object_metadata_status_known CHECK (
    metadata_status IN ('verified', 'legacy_unbound')
  ),
  ADD CONSTRAINT hosted_storage_object_verified_metadata_coherent CHECK (
    metadata_status = 'legacy_unbound'
    OR (
      size_bytes > 0
      AND checksum ~ '^[a-f0-9]{64}$'
      AND version_id IS NOT NULL
      AND length(version_id) BETWEEN 1 AND 512
    )
  );

CREATE INDEX hosted_storage_objects_legacy_readiness_idx
  ON hosted.storage_objects (metadata_status, subject_id, content_id, block_index)
  WHERE metadata_status = 'legacy_unbound' AND deleted_at IS NULL;

ALTER TABLE hosted.seeder_manifests
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT hosted_seeder_manifest_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE TABLE hosted.storage_tenant_policies (
  subject_id text PRIMARY KEY REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  policy_version bigint NOT NULL DEFAULT 1,
  max_object_bytes bigint NOT NULL,
  max_object_count bigint NOT NULL,
  max_concurrent_reservations integer NOT NULL,
  reservation_ttl_seconds integer NOT NULL,
  retention_days integer NOT NULL,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hosted_storage_policy_version_positive CHECK (policy_version > 0),
  CONSTRAINT hosted_storage_policy_object_bytes_positive CHECK (max_object_bytes > 0),
  CONSTRAINT hosted_storage_policy_object_count_positive CHECK (max_object_count > 0),
  CONSTRAINT hosted_storage_policy_reservations_positive CHECK (max_concurrent_reservations > 0),
  CONSTRAINT hosted_storage_policy_ttl_positive CHECK (reservation_ttl_seconds > 0),
  CONSTRAINT hosted_storage_policy_retention_nonnegative CHECK (retention_days >= 0),
  CONSTRAINT hosted_storage_policy_lifecycle_positive CHECK (lifecycle_version > 0)
);

-- Every version 2 tenant must remain addressable through the joined metadata
-- adapter. These conservative compatibility defaults are explicit: an object
-- may consume at most the tenant cap, object count is bounded by both the cap
-- and the platform metadata ceiling while never undercutting existing objects,
-- at most 32 reservations may be open, claims expire after one hour, and no
-- additional retention window is inferred for a legacy tenant.
WITH legacy_object_counts AS (
  SELECT subject_id, count(*)::bigint AS object_count
  FROM hosted.storage_objects
  WHERE deleted_at IS NULL
  GROUP BY subject_id
)
INSERT INTO hosted.storage_tenant_policies (
  subject_id, policy_version, max_object_bytes, max_object_count,
  max_concurrent_reservations, reservation_ttl_seconds, retention_days
)
SELECT
  tenants.subject_id,
  1,
  tenants.cap_bytes,
  GREATEST(
    1::bigint,
    LEAST(tenants.cap_bytes, 100000::bigint),
    COALESCE(object_counts.object_count, 0::bigint)
  ),
  LEAST(
    32::bigint,
    GREATEST(
      1::bigint,
      LEAST(tenants.cap_bytes, 100000::bigint),
      COALESCE(object_counts.object_count, 0::bigint)
    )
  )::integer,
  3600,
  0
FROM hosted.storage_tenants AS tenants
LEFT JOIN legacy_object_counts AS object_counts USING (subject_id)
ON CONFLICT (subject_id) DO NOTHING;

CREATE TABLE hosted.storage_reservations (
  reservation_id text PRIMARY KEY,
  subject_id text NOT NULL REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  content_id text NOT NULL,
  block_index integer NOT NULL,
  object_key text NOT NULL UNIQUE,
  checksum text NOT NULL,
  size_bytes bigint NOT NULL,
  state text NOT NULL,
  fencing_token bigint NOT NULL,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  staged_at timestamptz,
  activated_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hosted_storage_reservation_id_present
    CHECK (length(reservation_id) BETWEEN 1 AND 256),
  CONSTRAINT hosted_storage_reservation_block_nonnegative CHECK (block_index >= 0),
  CONSTRAINT hosted_storage_reservation_size_positive CHECK (size_bytes > 0),
  CONSTRAINT hosted_storage_reservation_state_known
    CHECK (state IN ('reserved', 'staged', 'activated', 'released', 'expired', 'failed')),
  CONSTRAINT hosted_storage_reservation_fencing_positive CHECK (fencing_token > 0),
  CONSTRAINT hosted_storage_reservation_lifecycle_positive CHECK (lifecycle_version > 0),
  CONSTRAINT hosted_storage_reservation_expiry_order CHECK (expires_at > created_at),
  CONSTRAINT hosted_storage_reservation_timestamps_ordered CHECK (
    (staged_at IS NULL OR staged_at >= created_at)
    AND (activated_at IS NULL OR (staged_at IS NOT NULL AND activated_at >= staged_at))
    AND (released_at IS NULL OR released_at >= created_at)
  ),
  CONSTRAINT hosted_storage_reservation_state_coherent CHECK (
    (state = 'reserved' AND staged_at IS NULL AND activated_at IS NULL AND released_at IS NULL)
    OR (state = 'staged' AND staged_at IS NOT NULL AND activated_at IS NULL AND released_at IS NULL)
    OR (state = 'activated' AND staged_at IS NOT NULL AND activated_at IS NOT NULL AND released_at IS NULL)
    OR (state IN ('released', 'expired', 'failed') AND released_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX hosted_storage_reservations_active_block_idx
  ON hosted.storage_reservations (subject_id, content_id, block_index)
  WHERE state IN ('reserved', 'staged', 'activated');

CREATE INDEX hosted_storage_reservations_expiry_cursor_idx
  ON hosted.storage_reservations (state, expires_at, reservation_id);

CREATE INDEX hosted_storage_reservations_subject_cursor_idx
  ON hosted.storage_reservations (subject_id, created_at DESC, reservation_id DESC);

-- Moderation state machines and lease-bound export claims.
ALTER TABLE moderation.triage
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT moderation_triage_status_known
    CHECK (status IN ('reviewed', 'dismissed', 'actioned')),
  ADD CONSTRAINT moderation_triage_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE INDEX moderation_triage_status_cursor_idx
  ON moderation.triage (status, updated_at DESC, report_key DESC);

ALTER TABLE moderation.ncmec_reports
  ADD COLUMN claim_owner text,
  ADD COLUMN claim_expires_at timestamptz,
  ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN last_error_code text,
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT moderation_ncmec_status_known CHECK (status IN ('queued', 'exported', 'filed')),
  ADD CONSTRAINT moderation_ncmec_claim_coherent CHECK (
    (claim_owner IS NULL AND claim_expires_at IS NULL)
    OR (status = 'queued'
      AND claim_owner IS NOT NULL
      AND length(claim_owner) BETWEEN 1 AND 256
      AND claim_expires_at IS NOT NULL
      AND fencing_token > 0)
  ),
  ADD CONSTRAINT moderation_ncmec_fencing_nonnegative CHECK (fencing_token >= 0),
  ADD CONSTRAINT moderation_ncmec_attempt_nonnegative CHECK (attempt_count >= 0),
  ADD CONSTRAINT moderation_ncmec_payload_bounded
    CHECK (octet_length(payload::text) <= 65536),
  ADD CONSTRAINT moderation_ncmec_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE INDEX ncmec_claim_cursor_idx
  ON moderation.ncmec_reports (
    status, next_attempt_at, claim_expires_at, detected_at, report_id
  );

ALTER TABLE moderation.dmca_claims
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT moderation_dmca_status_known
    CHECK (status IN ('received', 'actioned', 'counter_noticed', 'rejected')),
  ADD CONSTRAINT moderation_dmca_lifecycle_positive CHECK (lifecycle_version > 0);

-- Push attempt claims use explicit fencing so a stale provider worker cannot
-- record acceptance after another worker has reclaimed the attempt.
ALTER TABLE push.registrations
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT push_registration_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT push_registration_invalidation_order
    CHECK (invalidated_at IS NULL OR invalidated_at >= created_at);

ALTER TABLE push.capabilities
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT push_capability_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT push_capability_revocation_order
    CHECK (revoked_at IS NULL OR revoked_at >= created_at);

ALTER TABLE push.attempts
  ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0,
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1;

-- Version 2 workers did not carry fencing tokens. Revoke every legacy claim
-- before enforcing the fenced contract. The delivery outcome is not known, so
-- a leased push attempt becomes retryable rather than being reported as sent or
-- failed. Clearing the owner also makes an in-flight worker's owner-bound
-- completion update affect zero rows, while the advanced token fences any
-- delayed completion after a later worker reclaims the attempt.
UPDATE push.attempts
SET state = CASE WHEN state = 'leased' THEN 'retryable' ELSE state END,
    provider_status = CASE WHEN state = 'leased' THEN 'unknown' ELSE provider_status END,
    lease_owner = NULL,
    leased_until = NULL,
    fencing_token = GREATEST(attempt_count::bigint, 0) + 1,
    next_attempt_at = clock_timestamp(),
    last_error_code = COALESCE(last_error_code, 'lease_revoked_for_fencing_upgrade'),
    updated_at = clock_timestamp()
WHERE state = 'leased' OR lease_owner IS NOT NULL OR leased_until IS NOT NULL;

ALTER TABLE push.attempts
  ADD CONSTRAINT push_attempt_provider_status_known CHECK (
    provider_status IN ('pending', 'provider_accepted', 'provider_rejected', 'unknown')
  ),
  ADD CONSTRAINT push_attempt_state_known CHECK (
    state IN ('queued', 'leased', 'succeeded', 'retryable', 'failed', 'cancelled')
  ),
  ADD CONSTRAINT push_attempt_lease_coherent CHECK (
    (state = 'leased'
      AND lease_owner IS NOT NULL
      AND length(lease_owner) BETWEEN 1 AND 256
      AND leased_until IS NOT NULL
      AND fencing_token > 0)
    OR
    (state <> 'leased' AND lease_owner IS NULL AND leased_until IS NULL)
  ),
  ADD CONSTRAINT push_attempt_fencing_nonnegative CHECK (fencing_token >= 0),
  ADD CONSTRAINT push_attempt_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE INDEX push_attempts_fenced_claim_idx
  ON push.attempts (state, next_attempt_at, leased_until, fencing_token, attempt_id);

-- Align archive identity with the signed protocol. UUID version 2 identifiers are
-- preserved as text for rollback compatibility; all new protocol jobs use the
-- deterministic 32-character lowercase hexadecimal identifier.
ALTER TABLE archive.scans DROP CONSTRAINT scans_job_id_fkey;

ALTER TABLE archive.jobs
  ALTER COLUMN job_id TYPE text USING job_id::text;

ALTER TABLE archive.scans
  ALTER COLUMN job_id TYPE text USING job_id::text;

ALTER TABLE archive.scans
  ADD CONSTRAINT scans_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES archive.jobs(job_id) ON DELETE CASCADE;

ALTER TABLE archive.jobs DROP CONSTRAINT archive_tier_known;

UPDATE archive.jobs SET tier = 'self_host' WHERE tier = 'self_hosted';

CREATE FUNCTION archive.normalize_job_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, archive
AS $meerkat_normalize_archive_tier$
BEGIN
  IF NEW.tier = 'self_hosted' THEN
    NEW.tier := 'self_host';
  END IF;
  RETURN NEW;
END
$meerkat_normalize_archive_tier$;

REVOKE ALL ON FUNCTION archive.normalize_job_tier() FROM PUBLIC;

CREATE TRIGGER archive_jobs_normalize_tier
BEFORE INSERT OR UPDATE OF tier ON archive.jobs
FOR EACH ROW EXECUTE FUNCTION archive.normalize_job_tier();

ALTER TABLE archive.jobs
  ADD COLUMN signed_job jsonb,
  ADD COLUMN job_signature text,
  ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0,
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1;

-- An existing archive lease has no fencing token known to its worker. Preserve
-- the job and its workflow status, but revoke ownership and advance the fence
-- before the coherence constraint is installed. The work remains reclaimable;
-- an owner-bound completion from the displaced worker can no longer commit.
UPDATE archive.jobs
SET lease_owner = NULL,
    leased_until = NULL,
    fencing_token = GREATEST(attempt_count::bigint, 0) + 1,
    last_error_code = COALESCE(last_error_code, 'lease_revoked_for_fencing_upgrade'),
    updated_at = clock_timestamp()
WHERE lease_owner IS NOT NULL OR leased_until IS NOT NULL;

ALTER TABLE archive.jobs
  ADD CONSTRAINT archive_job_id_text_compatible CHECK (
    job_id ~ '^[0-9a-f]{32}$'
    OR job_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  ADD CONSTRAINT archive_tier_known CHECK (tier IN ('self_host', 'managed')),
  ADD CONSTRAINT archive_signed_job_coherent CHECK (
    (signed_job IS NULL AND job_signature IS NULL)
    OR (jsonb_typeof(signed_job) = 'object'
      AND job_signature IS NOT NULL
      AND length(job_signature) BETWEEN 1 AND 4096)
  ),
  ADD CONSTRAINT archive_job_lease_coherent CHECK (
    (lease_owner IS NULL AND leased_until IS NULL)
    OR (lease_owner IS NOT NULL
      AND length(lease_owner) BETWEEN 1 AND 256
      AND leased_until IS NOT NULL
      AND fencing_token > 0)
  ),
  ADD CONSTRAINT archive_job_fencing_nonnegative CHECK (fencing_token >= 0),
  ADD CONSTRAINT archive_job_lifecycle_positive CHECK (lifecycle_version > 0);

CREATE INDEX archive_jobs_status_cursor_idx
  ON archive.jobs (status, created_at, job_id);

CREATE INDEX archive_jobs_publication_cursor_idx
  ON archive.jobs (publication_id, updated_at DESC, job_id DESC);

ALTER TABLE archive.objects
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT archive_object_status_known CHECK (
    status IN ('uploading', 'quarantined', 'verified', 'durable', 'deleting', 'deleted', 'failed')
  ),
  ADD CONSTRAINT archive_object_lifecycle_positive CHECK (lifecycle_version > 0);

ALTER TABLE archive.scans
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT archive_scan_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT archive_scan_completion_order
    CHECK (completed_at IS NULL OR completed_at >= started_at);

ALTER TABLE archive.pins
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT archive_pin_lifecycle_positive CHECK (lifecycle_version > 0),
  ADD CONSTRAINT archive_pin_disabled_order
    CHECK (disabled_at IS NULL OR last_verified_at IS NULL OR disabled_at >= last_verified_at),
  ADD CONSTRAINT archive_pin_deletion_order
    CHECK (deletion_verified_at IS NULL OR disabled_at IS NULL OR deletion_verified_at >= disabled_at);

CREATE INDEX archive_pins_state_cursor_idx
  ON archive.pins (state, last_verified_at, publication_id, host_id);
`;
