/** Additive archive lifecycle fields required by the durable store contract. */
export const ARCHIVE_LIFECYCLE_SQL = `
ALTER TABLE archive.jobs
  ADD COLUMN request_digest_hex text,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN identity_status text NOT NULL DEFAULT 'legacy_unbound',
  ADD CONSTRAINT archive_request_digest_hex_valid CHECK (
    request_digest_hex IS NULL OR request_digest_hex ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT archive_identity_status_known CHECK (
    identity_status IN ('verified', 'legacy_unbound')
  ),
  ADD CONSTRAINT archive_identity_status_coherent CHECK (
    (identity_status = 'verified'
      AND request_digest_hex IS NOT NULL
      AND signed_job IS NOT NULL
      AND job_signature IS NOT NULL)
    OR
    (identity_status = 'legacy_unbound'
      AND (request_digest_hex IS NULL OR signed_job IS NULL))
  ),
  ADD CONSTRAINT archive_next_attempt_not_before_creation CHECK (
    next_attempt_at >= created_at
  ),
  ADD CONSTRAINT archive_signed_job_metadata_bounded CHECK (
    signed_job IS NULL OR octet_length(signed_job::text) <= 65536
  );

ALTER TABLE archive.objects
  ADD COLUMN metadata_status text NOT NULL DEFAULT 'legacy_unbound',
  ADD CONSTRAINT archive_object_metadata_status_known CHECK (
    metadata_status IN ('verified', 'legacy_unbound')
  ),
  ADD CONSTRAINT archive_object_verified_metadata_coherent CHECK (
    metadata_status = 'legacy_unbound'
    OR (
      object_index < 100000
      AND object_bytes > 0
      AND object_hash ~ '^[0-9a-f]{64}$'
      AND length(quarantine_key) BETWEEN 1 AND 512
      AND quarantine_key ~ '^[A-Za-z0-9_.:@/-]+$'
      AND (durable_key IS NULL OR (
        length(durable_key) BETWEEN 1 AND 512
        AND durable_key ~ '^[A-Za-z0-9_.:@/-]+$'
      ))
      AND (storage_checksum IS NULL OR storage_checksum ~ '^[0-9a-f]{64}$')
    )
  );

ALTER TABLE archive.scans
  ADD CONSTRAINT archive_scan_evidence_bounded CHECK (octet_length(evidence::text) <= 65536);

CREATE INDEX archive_jobs_worker_claim_idx
  ON archive.jobs (status, next_attempt_at, leased_until, created_at, job_id);

CREATE INDEX archive_jobs_idempotency_digest_idx
  ON archive.jobs (idempotency_key, request_digest_hex);

CREATE INDEX archive_objects_content_status_idx
  ON archive.objects (content_id, metadata_status, status, object_index);

CREATE INDEX archive_scans_job_result_idx
  ON archive.scans (job_id, result, completed_at DESC, scan_id DESC);
`;
