/**
 * Additive durable release-promotion proof (Plan 44 WP-6C).
 *
 * A promotion is an operator moving a signed, APPROVED release along the deploy
 * ladder. The actual deploy (pulling the pinned images, restarting the stack) is
 * an operator action performed OUT OF BAND; this table is the DURABLE, honest
 * record of each transition so a release gate or later audit can see exactly what
 * rung a release reached, who moved it, and on what canary evidence.
 *
 * Each row is an IMMUTABLE append: a promotion is never updated in place, unlike
 * the cutover proof's single mutable row. The CURRENT state of a release is the
 * to_state of its latest row (by recorded_at, promotion_id). The state machine:
 *   staging           -> the release is deployed to staging.
 *   staging_canary    -> a canary cohort on staging is receiving the release.
 *   production_canary -> a canary cohort in production is receiving the release.
 *   production        -> the release is fully rolled out in production.
 *   rolled_back       -> the deploy was reverted to an EARLIER approved release.
 *
 * Legal transitions (enforced by a CHECK on the from_state/to_state pair AND by
 * code that requires from_state to equal the release's current state):
 *   (start)            -> staging            (from_state 'none')
 *   staging            -> staging_canary
 *   staging_canary     -> production_canary
 *   production_canary  -> production
 *   <any non-rolled_back state> -> rolled_back
 *
 * ROLLBACK HONESTY (NC-44.5). A rollback re-points the deploy at a prior approved
 * release's images. It NEVER un-writes the database: PostgreSQL rows written while
 * the new release was live remain. The evidence for a rolled_back row therefore
 * MUST carry the explicit honest markers postgresWritesAfterFlipReversed=false and
 * dataReversalClaimed=false; a CHECK constraint refuses any rollback row whose
 * evidence claims data reversal. The rollback target (an earlier approved manifest)
 * is validated in code (the store), since a jsonb CHECK cannot cross-reference
 * ops.release_manifests.
 *
 * evidence is a jsonb object (canary verdict outputs, probe exit codes, operator
 * notes). recorded_at comes from database time, never the CLI host clock.
 *
 * TRUST BOUNDARY (stated, matching every proof table in this repo). The pairwise
 * transition CHECK and the rollback-honesty CHECK are row-local backstops; per-
 * release CONTINUITY (each row's from_state equals the actual latest to_state, no
 * forward row after rolled_back) is enforced by the STORE under its lease fence.
 * A writer issuing raw SQL with the ops credential can append a discontinuous row,
 * exactly as it could tamper any other proof table; that credential is inside the
 * trust boundary and its use outside the store is an incident, not a supported path.
 */
export const RELEASE_PROMOTIONS_SQL = `
CREATE TABLE ops.release_promotions (
  promotion_id text PRIMARY KEY,
  -- seq gives a TOTAL insert order: clock_timestamp() is not unique, and a
  -- lexical promotion-id tie-breaker could select the wrong "latest" row when two
  -- transitions land in the same microsecond. Ordering by seq is unambiguous.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  release_id text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  operator text NOT NULL,
  evidence jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT release_promotion_id_safe CHECK (promotion_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  CONSTRAINT release_promotion_release_id_present CHECK (length(release_id) BETWEEN 1 AND 512),
  CONSTRAINT release_promotion_operator_present CHECK (length(operator) BETWEEN 1 AND 256),
  CONSTRAINT release_promotion_evidence_object CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT release_promotion_from_state_known CHECK (
    from_state IN ('none', 'staging', 'staging_canary', 'production_canary', 'production')
  ),
  CONSTRAINT release_promotion_to_state_known CHECK (
    to_state IN ('staging', 'staging_canary', 'production_canary', 'production', 'rolled_back')
  ),
  -- The state machine, encoded as the set of legal (from_state, to_state) pairs.
  -- Any non-rolled_back state may transition to rolled_back; the forward ladder is
  -- strictly single-step. from_state 'none' is the release's very first promotion.
  CONSTRAINT release_promotion_transition_legal CHECK (
    (from_state = 'none' AND to_state = 'staging')
    OR (from_state = 'staging' AND to_state = 'staging_canary')
    OR (from_state = 'staging_canary' AND to_state = 'production_canary')
    OR (from_state = 'production_canary' AND to_state = 'production')
    OR (to_state = 'rolled_back' AND from_state <> 'none')
  ),
  -- A rollback row must carry the honest non-reversal markers (NC-44.5): the deploy
  -- was re-pointed at prior images, the database was NOT un-written. A rollback that
  -- claims data reversal, or omits the markers, is refused at write time.
  CONSTRAINT release_promotion_rollback_honest CHECK (
    to_state <> 'rolled_back'
    OR (
      (evidence -> 'dataReversalClaimed') = to_jsonb(false)
      AND (evidence -> 'postgresWritesAfterFlipReversed') = to_jsonb(false)
    )
  )
);

-- The per-release history cursor: the current state is the latest row for a
-- release_id by insert order (seq), and listing walks newest-first.
CREATE INDEX release_promotions_release_cursor_idx
  ON ops.release_promotions (release_id, seq DESC);

CREATE INDEX release_promotions_recorded_cursor_idx
  ON ops.release_promotions (recorded_at DESC, promotion_id DESC);
`;
