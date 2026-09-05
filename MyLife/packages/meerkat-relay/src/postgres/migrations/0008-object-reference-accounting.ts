/** Additive durable authority for object reference accounting and fenced deletion jobs (Plan 44 WP-2C). */
export const OBJECT_REFERENCE_ACCOUNTING_SQL = `
CREATE TABLE ops.object_reference_keys (
  object_key text PRIMARY KEY,
  reference_count bigint NOT NULL,
  unreferenced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT object_reference_key_valid CHECK (
    length(object_key) BETWEEN 1 AND 512
    AND object_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:@/-]*$'
  ),
  CONSTRAINT object_reference_count_nonnegative CHECK (reference_count >= 0),
  CONSTRAINT object_reference_zero_marker_coherent CHECK (
    (reference_count = 0 AND unreferenced_at IS NOT NULL)
    OR (reference_count > 0 AND unreferenced_at IS NULL)
  )
);

CREATE INDEX object_reference_keys_unreferenced_idx
  ON ops.object_reference_keys (unreferenced_at, object_key)
  WHERE reference_count = 0;

CREATE TABLE ops.object_reference_edges (
  object_key text NOT NULL
    REFERENCES ops.object_reference_keys(object_key) ON DELETE CASCADE,
  referrer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (object_key, referrer),
  CONSTRAINT object_reference_edge_referrer_valid CHECK (
    length(referrer) BETWEEN 1 AND 512
    AND referrer ~ '^[A-Za-z0-9_][[:print:]]*$'
  )
);

CREATE TABLE ops.object_deletion_jobs (
  object_key text PRIMARY KEY,
  state text NOT NULL DEFAULT 'pending',
  version_id text,
  attempt integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error text,
  enqueued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  claim_owner text,
  claim_expires_at timestamptz,
  fencing_token bigint NOT NULL DEFAULT 0,
  CONSTRAINT object_deletion_job_key_valid CHECK (
    length(object_key) BETWEEN 1 AND 512
    AND object_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:@/-]*$'
  ),
  CONSTRAINT object_deletion_job_state_known
    CHECK (state IN ('pending', 'leased', 'deleted', 'poison')),
  CONSTRAINT object_deletion_job_attempt_nonnegative CHECK (attempt >= 0),
  CONSTRAINT object_deletion_job_version_id_bounded
    CHECK (version_id IS NULL OR length(version_id) BETWEEN 1 AND 256),
  CONSTRAINT object_deletion_job_last_error_bounded
    CHECK (last_error IS NULL OR length(last_error) <= 2048),
  CONSTRAINT object_deletion_job_owner_bounded
    CHECK (claim_owner IS NULL OR length(claim_owner) BETWEEN 1 AND 256),
  CONSTRAINT object_deletion_job_lease_coherent CHECK (
    (state = 'leased' AND claim_owner IS NOT NULL AND claim_expires_at IS NOT NULL)
    OR (state <> 'leased' AND claim_owner IS NULL AND claim_expires_at IS NULL)
  ),
  CONSTRAINT object_deletion_job_fencing_nonnegative CHECK (fencing_token >= 0)
);

CREATE INDEX object_deletion_jobs_claim_idx
  ON ops.object_deletion_jobs (state, next_attempt_at, object_key)
  WHERE state IN ('pending', 'leased');

CREATE INDEX object_deletion_jobs_poison_idx
  ON ops.object_deletion_jobs (state, updated_at, object_key)
  WHERE state = 'poison';

CREATE TABLE ops.object_deletion_audit (
  audit_seq bigserial PRIMARY KEY,
  object_key text NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT object_deletion_audit_key_valid CHECK (
    length(object_key) BETWEEN 1 AND 512
    AND object_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:@/-]*$'
  ),
  CONSTRAINT object_deletion_audit_action_known
    CHECK (action IN (
      'enqueued', 'deleted', 'retry_scheduled', 'poisoned',
      'reconcile_quarantined', 'reconcile_swept', 'reconcile_missing',
      'reconcile_drift'
    )),
  CONSTRAINT object_deletion_audit_detail_object
    CHECK (jsonb_typeof(detail) = 'object'),
  CONSTRAINT object_deletion_audit_detail_bounded
    CHECK (octet_length(detail::text) <= 65536)
);

CREATE INDEX object_deletion_audit_key_seq_idx
  ON ops.object_deletion_audit (object_key, audit_seq);

CREATE TABLE ops.object_orphan_sightings (
  object_key text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT object_orphan_sighting_key_valid CHECK (
    length(object_key) BETWEEN 1 AND 512
    AND object_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:@/-]*$'
  )
);

CREATE TABLE ops.object_reconciliation_runs (
  scan_id text PRIMARY KEY,
  cursor_key text,
  entries_scanned bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT object_reconciliation_scan_id_bounded
    CHECK (length(scan_id) BETWEEN 1 AND 128),
  CONSTRAINT object_reconciliation_cursor_valid CHECK (
    cursor_key IS NULL
    OR (
      length(cursor_key) BETWEEN 1 AND 512
      AND cursor_key ~ '^[A-Za-z0-9_][A-Za-z0-9_.:@/-]*$'
    )
  ),
  CONSTRAINT object_reconciliation_entries_nonnegative CHECK (entries_scanned >= 0)
);
`;
