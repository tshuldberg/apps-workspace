/**
 * Additive durable cutover-and-rollback proof (Plan 44 WP-3C).
 *
 * A cutover from file state to PostgreSQL is an operator-driven, multi-phase
 * process. The env flip (per-service `MEERKAT_STORE_BACKEND`) and restart are
 * operator actions performed OUT OF BAND between CLI phases; this table is the
 * DURABLE, honest record of each phase so the release gate and any later audit
 * can see exactly what was verified, attested, and when.
 *
 * The row is a fenced state machine (lifecycle_version guards each transition,
 * exactly like ops.backup_restore_proofs):
 *   preflighted -> the source (file) digest captured, source roots dry-run
 *                  enumerated, an explicit writer-freeze ATTESTATION recorded,
 *                  and any liveness probes recorded. The tool cannot prove every
 *                  writer is stopped; it records the attestation honestly.
 *   executed    -> the final delta imported and the file vs PostgreSQL digests
 *                  proven IDENTICAL (the gate). This must pass before an operator
 *                  flips env.
 *   verified    -> after the env flip + restart, the post-boot PostgreSQL digest
 *                  recorded and matched. PostgreSQL is now the authority.
 *   rolled_back -> flipped back to the UNTOUCHED file state. The rollback window
 *                  and the digest delta (with the explicit LOSS list) are recorded
 *                  honestly; any PostgreSQL writes taken after the flip are
 *                  ORPHANED (retained for forensics, not served), and the file
 *                  tree resumes as authority.
 *   aborted     -> abandoned before verify (e.g. the gate failed).
 *
 * Digests are jsonb maps of store id -> { count, rollupHex }, the same semantic
 * digest the import engine produces, never a byte serialization. The preflight
 * report records dry-run counts and probe results.
 */
export const CUTOVER_PROOFS_SQL = `
CREATE TABLE ops.cutover_proofs (
  cutover_id text PRIMARY KEY,
  release_sha text NOT NULL,
  state text NOT NULL DEFAULT 'preflighted',
  operator text NOT NULL,
  writers_frozen_by text NOT NULL,
  source_digest jsonb NOT NULL,
  preflight_report jsonb NOT NULL,
  executed_digest jsonb,
  post_boot_digest jsonb,
  rollback_digest_delta jsonb,
  preflighted_at timestamptz,
  executed_at timestamptz,
  flipped_at timestamptz,
  verified_at timestamptz,
  rolled_back_at timestamptz,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT cutover_id_safe CHECK (cutover_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  CONSTRAINT cutover_release_sha_present CHECK (length(release_sha) BETWEEN 1 AND 256),
  CONSTRAINT cutover_operator_present CHECK (length(operator) BETWEEN 1 AND 256),
  CONSTRAINT cutover_frozen_by_present CHECK (length(writers_frozen_by) BETWEEN 1 AND 256),
  CONSTRAINT cutover_state_known CHECK (
    state IN ('preflighted', 'executed', 'verified', 'rolled_back', 'aborted')
  ),
  CONSTRAINT cutover_source_digest_object CHECK (jsonb_typeof(source_digest) = 'object'),
  CONSTRAINT cutover_preflight_report_object CHECK (jsonb_typeof(preflight_report) = 'object'),
  CONSTRAINT cutover_executed_digest_object CHECK (
    executed_digest IS NULL OR jsonb_typeof(executed_digest) = 'object'
  ),
  CONSTRAINT cutover_post_boot_digest_object CHECK (
    post_boot_digest IS NULL OR jsonb_typeof(post_boot_digest) = 'object'
  ),
  CONSTRAINT cutover_rollback_delta_object CHECK (
    rollback_digest_delta IS NULL OR jsonb_typeof(rollback_digest_delta) = 'object'
  ),
  CONSTRAINT cutover_lifecycle_positive CHECK (lifecycle_version > 0),
  CONSTRAINT cutover_update_order CHECK (updated_at >= created_at),
  -- The gate: an executed row must carry the executed (verified-identical) digest.
  CONSTRAINT cutover_executed_coherent CHECK (
    state <> 'executed'
    OR (executed_digest IS NOT NULL AND executed_at IS NOT NULL)
  ),
  -- A verify must carry the post-boot digest and both the flip and verify instants.
  CONSTRAINT cutover_verified_coherent CHECK (
    state <> 'verified'
    OR (post_boot_digest IS NOT NULL AND flipped_at IS NOT NULL AND verified_at IS NOT NULL)
  ),
  -- A rollback must carry the rollback instant and the honest digest delta.
  CONSTRAINT cutover_rollback_coherent CHECK (
    state <> 'rolled_back'
    OR (rolled_back_at IS NOT NULL AND rollback_digest_delta IS NOT NULL)
  )
);

CREATE INDEX cutover_proofs_created_cursor_idx
  ON ops.cutover_proofs (created_at DESC, cutover_id DESC);

CREATE INDEX cutover_proofs_state_idx
  ON ops.cutover_proofs (state, created_at DESC);
`;
