/**
 * Additive durable rehearsal-drill proof (Plan 44 WP-7A).
 *
 * A rehearsal drill is a production-readiness exercise an operator RUNS OUT OF
 * BAND (a load test, a 48-hour soak, a staging failover, a secret rotation, a
 * regional object recovery, an incident tabletop) against real or test-shaped
 * infrastructure. This table is the DURABLE, honest record of each drill so a
 * release gate or later audit can see exactly which drill ran, who ran it, what
 * verdict it reached, and on what evidence. The tool never RUNS the drill and
 * never invents a verdict: it records the outcome the operator (or a harness)
 * ALREADY produced. A drill that was not run is not a row; a recorded row proves
 * the record, not the infrastructure.
 *
 * Each row is an IMMUTABLE append: a drill proof is never updated in place. seq
 * gives a TOTAL insert order (clock_timestamp() is not unique, and a lexical
 * drill-id tie-breaker could pick the wrong "latest" row when two drills land in
 * the same microsecond); ordering by seq is unambiguous.
 *
 * HONESTY CHECK (mirrors the rollback-honesty backstop of ops.release_promotions).
 * A `passed` verdict is a positive readiness claim, so a `passed` row MUST carry
 * real evidence: the CHECK refuses a `passed` row whose evidence is the empty
 * object. A bare "it passed" with nothing attached is refused AT THE DATABASE,
 * not just in the store. `failed` and `aborted` verdicts may carry any evidence
 * (including {}), because the honest record of a failure need not prove anything.
 *
 * release_id is NULLABLE: many drills (a raw load test, an incident tabletop) are
 * not tied to a specific release candidate. When it IS supplied, the store
 * verifies the release manifest exists (a cross-table reference a jsonb CHECK
 * cannot express) and stamps the manifest's approval state into the evidence so
 * the export is honest about whether the drill ran against an approved candidate;
 * approval is NOT required, because drills legitimately run against unapproved
 * candidates.
 *
 * TRUST BOUNDARY (stated, matching every proof table in this repo). The verdict,
 * kind, and passed-requires-evidence CHECKs are row-local backstops. The lease
 * fence, the release-existence reference, and the started_at skew bound are
 * enforced by the STORE under its job lease. A writer issuing raw SQL with the
 * ops credential can append a row that bypasses the store's checks, exactly as it
 * could tamper any other proof table; that credential is inside the trust
 * boundary and its use outside the store is an incident, not a supported path.
 */
export const REHEARSAL_PROOFS_SQL = `
CREATE TABLE ops.rehearsal_proofs (
  drill_id text PRIMARY KEY,
  -- seq gives a TOTAL insert order: clock_timestamp() is not unique, and a lexical
  -- drill-id tie-breaker could select the wrong "latest" row when two drills land
  -- in the same microsecond. Ordering by seq is unambiguous.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  drill_kind text NOT NULL,
  release_id text,
  operator text NOT NULL,
  verdict text NOT NULL,
  evidence jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT rehearsal_drill_id_safe CHECK (drill_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  CONSTRAINT rehearsal_operator_present CHECK (length(operator) BETWEEN 1 AND 256),
  CONSTRAINT rehearsal_release_id_bounded CHECK (
    release_id IS NULL OR length(release_id) BETWEEN 1 AND 512
  ),
  CONSTRAINT rehearsal_evidence_object CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT rehearsal_kind_known CHECK (
    drill_kind IN (
      'load', 'soak', 'failover', 'dependency_outage', 'secret_rotation',
      'migration_rollback', 'backup_restore', 'regional_object_recovery',
      'queue_backlog', 'incident', 'canary_stop_rollback'
    )
  ),
  CONSTRAINT rehearsal_verdict_known CHECK (verdict IN ('passed', 'failed', 'aborted')),
  -- A 'passed' verdict is a positive readiness claim; it must carry real evidence.
  -- jsonb_strip_nulls catches null-dressed emptiness ({"a":null}, a whitespace key
  -- over null) in addition to the literal '{}'. Deeper vacuity ({"x":{}} nests) is
  -- refused by the STORE's isVacuousEvidence gate; this CHECK is the row-local
  -- backstop, per the stated trust boundary. 'failed'/'aborted' may carry any
  -- evidence, including empty.
  CONSTRAINT rehearsal_passed_requires_evidence CHECK (
    verdict <> 'passed' OR (
      evidence <> '{}'::jsonb AND jsonb_strip_nulls(evidence) <> '{}'::jsonb
    )
  )
);

-- Latest-per-kind lookup (status/export) walks a kind newest-first by insert order.
CREATE INDEX rehearsal_proofs_kind_cursor_idx
  ON ops.rehearsal_proofs (drill_kind, seq DESC);

-- The recency cursor for history listing across kinds.
CREATE INDEX rehearsal_proofs_recorded_cursor_idx
  ON ops.rehearsal_proofs (recorded_at DESC, drill_id DESC);
`;
