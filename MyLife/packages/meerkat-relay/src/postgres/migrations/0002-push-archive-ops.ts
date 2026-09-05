export const PUSH_ARCHIVE_OPS_SQL = `
CREATE TABLE push.registrations (
  registration_id_hash bytea PRIMARY KEY,
  registration_secret_hash bytea NOT NULL UNIQUE,
  platform text NOT NULL,
  token_ciphertext bytea NOT NULL,
  token_key_version integer NOT NULL,
  token_generation bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT push_registration_id_hash_length CHECK (octet_length(registration_id_hash) = 32),
  CONSTRAINT push_registration_secret_hash_length CHECK (octet_length(registration_secret_hash) = 32),
  CONSTRAINT push_platform_known CHECK (platform IN ('apns', 'fcm', 'webpush')),
  CONSTRAINT push_key_version_positive CHECK (token_key_version > 0),
  CONSTRAINT push_token_generation_positive CHECK (token_generation > 0)
);

CREATE TABLE push.capabilities (
  capability_hash bytea PRIMARY KEY,
  registration_id_hash bytea NOT NULL REFERENCES push.registrations(registration_id_hash) ON DELETE CASCADE,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT push_capability_hash_length CHECK (octet_length(capability_hash) = 32),
  CONSTRAINT push_capability_scope_known CHECK (scope IN ('sync_wake', 'call_wake'))
);

CREATE TABLE push.attempts (
  attempt_id uuid PRIMARY KEY,
  capability_hash bytea NOT NULL REFERENCES push.capabilities(capability_hash) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  provider_status text NOT NULL,
  provider_reference text,
  state text NOT NULL,
  lease_owner text,
  leased_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT push_attempt_count_nonnegative CHECK (attempt_count >= 0)
);

CREATE INDEX push_attempts_claim_idx
  ON push.attempts (state, next_attempt_at, attempt_id);

CREATE INDEX push_attempts_capability_created_idx
  ON push.attempts (capability_hash, created_at DESC, attempt_id DESC);

CREATE INDEX push_registrations_expiry_idx
  ON push.registrations (expires_at, registration_id_hash);

CREATE INDEX push_capabilities_registration_idx
  ON push.capabilities (registration_id_hash, scope, expires_at, capability_hash);

CREATE INDEX push_capabilities_expiry_idx
  ON push.capabilities (expires_at, capability_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE archive.jobs (
  job_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  publication_id text NOT NULL,
  content_id text NOT NULL,
  owner_subject_hash bytea NOT NULL,
  tier text NOT NULL,
  status text NOT NULL,
  rights_json jsonb NOT NULL,
  rights_signature text NOT NULL,
  expected_bytes bigint NOT NULL,
  received_bytes bigint NOT NULL DEFAULT 0,
  lease_owner text,
  leased_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (publication_id, content_id),
  CONSTRAINT archive_owner_subject_hash_present CHECK (octet_length(owner_subject_hash) BETWEEN 16 AND 128),
  CONSTRAINT archive_tier_known CHECK (tier IN ('self_hosted', 'managed')),
  CONSTRAINT archive_status_known CHECK (status IN (
    'created', 'uploading', 'quarantined', 'scanning', 'review_required', 'approved',
    'pinned', 'announced', 'rejected', 'takedown_pending', 'removed', 'failed'
  )),
  CONSTRAINT archive_rights_object CHECK (jsonb_typeof(rights_json) = 'object'),
  CONSTRAINT archive_rights_signature_present CHECK (length(rights_signature) BETWEEN 1 AND 4096),
  CONSTRAINT archive_sizes_nonnegative CHECK (expected_bytes >= 0 AND received_bytes >= 0),
  CONSTRAINT archive_received_within_expected CHECK (received_bytes <= expected_bytes),
  CONSTRAINT archive_attempt_count_nonnegative CHECK (attempt_count >= 0)
);

CREATE INDEX archive_jobs_claim_idx
  ON archive.jobs (status, leased_until, created_at, job_id);

CREATE TABLE archive.objects (
  content_id text NOT NULL,
  object_index integer NOT NULL,
  object_hash text NOT NULL,
  object_bytes bigint NOT NULL,
  quarantine_key text NOT NULL,
  durable_key text,
  storage_checksum text,
  status text NOT NULL,
  PRIMARY KEY (content_id, object_index),
  CONSTRAINT archive_object_index_nonnegative CHECK (object_index >= 0),
  CONSTRAINT archive_object_bytes_nonnegative CHECK (object_bytes >= 0),
  CONSTRAINT archive_object_status_present CHECK (length(status) BETWEEN 1 AND 64)
);

CREATE INDEX archive_objects_status_idx
  ON archive.objects (status, content_id, object_index);

CREATE TABLE archive.scans (
  scan_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES archive.jobs(job_id) ON DELETE CASCADE,
  engine text NOT NULL,
  engine_version text NOT NULL,
  definitions_version text,
  result text NOT NULL,
  result_code text,
  evidence jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT archive_scan_result_known CHECK (result IN ('clean', 'malware', 'abuse_hash_match', 'flagged', 'error')),
  CONSTRAINT archive_scan_evidence_object CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE INDEX archive_scans_job_started_idx
  ON archive.scans (job_id, started_at DESC, scan_id DESC);

CREATE TABLE archive.pins (
  publication_id text NOT NULL,
  content_id text NOT NULL,
  host_id text NOT NULL,
  state text NOT NULL,
  last_verified_at timestamptz,
  disabled_at timestamptz,
  deletion_verified_at timestamptz,
  PRIMARY KEY (publication_id, host_id),
  CONSTRAINT archive_pin_state_known CHECK (state IN ('pinning', 'active', 'removing', 'removed', 'error'))
);

CREATE TABLE ops.backup_restore_proofs (
  proof_id text PRIMARY KEY,
  source_backup_id text NOT NULL,
  release_sha text NOT NULL,
  restored_at timestamptz NOT NULL,
  rpo_seconds integer NOT NULL,
  rto_seconds integer NOT NULL,
  semantic_digests jsonb NOT NULL,
  verified boolean NOT NULL,
  CONSTRAINT restore_rpo_nonnegative CHECK (rpo_seconds >= 0),
  CONSTRAINT restore_rto_nonnegative CHECK (rto_seconds >= 0),
  CONSTRAINT restore_digests_object CHECK (jsonb_typeof(semantic_digests) = 'object')
);

CREATE TABLE ops.release_manifests (
  release_id text PRIMARY KEY,
  git_sha text NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  CONSTRAINT release_manifest_object CHECK (jsonb_typeof(manifest) = 'object')
);
`;
