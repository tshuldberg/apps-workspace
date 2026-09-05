import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresOperationsStore } from '../stores/operations-store';
import { PostgresPromotionStore } from '../stores/promotion-store';
import {
  canonicalizeManifest,
  parseReleaseManifest,
  type ReleaseManifest,
} from '../../release/release-manifest';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const GIT_SHA = 'a'.repeat(40);
const DIGEST_A = `sha256:${'0'.repeat(64)}`;

function buildManifest(): ReleaseManifest {
  return parseReleaseManifest({
    schemaVersion: 1,
    gitSha: GIT_SHA,
    images: [
      {
        name: 'relay',
        repository: 'ghcr.io/meerkat/relay',
        digest: DIGEST_A,
        sbomRef: 'ghcr.io/meerkat/relay:sbom',
        scanResultRef: 'ghcr.io/meerkat/relay:scan',
        attestationRef: 'ghcr.io/meerkat/relay:attest',
        signatureRef: 'ghcr.io/meerkat/relay:sig',
      },
    ],
    migrationRange: { lowest: 1, highest: 11 },
    configSchemaDigest: 'b'.repeat(64),
    mobileBuild: null,
    webArtifact: null,
    rollbackReleaseId: null,
  });
}

function digestFor(manifest: ReleaseManifest): string {
  return createHash('sha256').update(canonicalizeManifest(manifest), 'utf8').digest('hex');
}

describePostgres('release promotion state machine (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const scratchDb = `meerkat_test_promotion_${suffix}`;
  let adminPool: Pool;
  let scratchPool: Pool;
  let operations: PostgresOperationsStore;
  let store: PostgresPromotionStore;

  /** Record + approve a release manifest so it is promotable, returning its id. */
  async function approvedRelease(id: string): Promise<string> {
    const manifest = buildManifest();
    await operations.recordReleaseManifest({
      releaseId: id,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex: digestFor(manifest),
    });
    const version = await operations.approveReleaseManifest(id, 1);
    expect(version).toBe(2);
    return id;
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Release promotion integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${scratchDb}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${scratchDb}`;
    scratchPool = new Pool({ connectionString: url.toString(), max: 6, statement_timeout: 30_000 });
    scratchPool.on('error', () => undefined);
    await runPostgresMigrations(scratchPool);
    const database = new PostgresStoreContext(scratchPool);
    operations = new PostgresOperationsStore(database);
    store = new PostgresPromotionStore(database);
  });

  afterAll(async () => {
    await scratchPool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  it('records the full legal ladder staging -> staging_canary -> production_canary -> production', async () => {
    const releaseId = await approvedRelease(`rel-ladder-${suffix}`);
    expect(await store.currentPromotionState(releaseId)).toBe('none');

    const rungs = ['staging', 'staging_canary', 'production_canary', 'production'] as const;
    for (const [i, to] of rungs.entries()) {
      const result = await store.recordForwardPromotion({
        promotionId: `p-${suffix}-${to}`,
        releaseId,
        toState: to,
        operator: 'ops',
        evidence: { rung: i },
      });
      expect(result.status).toBe('recorded');
      expect(await store.currentPromotionState(releaseId)).toBe(to);
    }
    const history = await store.listPromotions(releaseId);
    expect(history.map((p) => p.toState)).toEqual([...rungs].reverse());
  });

  it('refuses an illegal jump (staging -> production)', async () => {
    const releaseId = await approvedRelease(`rel-jump-${suffix}`);
    const staging = await store.recordForwardPromotion({
      promotionId: `pj-${suffix}-staging`,
      releaseId,
      toState: 'staging',
      operator: 'ops',
      evidence: {},
    });
    expect(staging.status).toBe('recorded');

    const jump = await store.recordForwardPromotion({
      promotionId: `pj-${suffix}-prod`,
      releaseId,
      toState: 'production',
      operator: 'ops',
      evidence: {},
    });
    expect(jump.status).toBe('refused');
    if (jump.status === 'refused') expect(jump.reason).toBe('from_state_mismatch');
    expect(await store.currentPromotionState(releaseId)).toBe('staging');
  });

  it('refuses a from-state mismatch when the release is already advanced', async () => {
    const releaseId = await approvedRelease(`rel-mismatch-${suffix}`);
    await store.recordForwardPromotion({ promotionId: `pm-${suffix}-1`, releaseId, toState: 'staging', operator: 'ops', evidence: {} });
    await store.recordForwardPromotion({ promotionId: `pm-${suffix}-2`, releaseId, toState: 'staging_canary', operator: 'ops', evidence: {} });
    // Try to record staging again: the release is at staging_canary now.
    const stale = await store.recordForwardPromotion({
      promotionId: `pm-${suffix}-3`,
      releaseId,
      toState: 'staging',
      operator: 'ops',
      evidence: {},
    });
    expect(stale.status).toBe('refused');
    if (stale.status === 'refused') expect(stale.reason).toBe('from_state_mismatch');
  });

  it('refuses to promote an unapproved (and an unknown) manifest', async () => {
    // Recorded but NOT approved.
    const manifest = buildManifest();
    const unapproved = `rel-unapproved-${suffix}`;
    await operations.recordReleaseManifest({
      releaseId: unapproved,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex: digestFor(manifest),
    });
    const refusedUnapproved = await store.recordForwardPromotion({
      promotionId: `pu-${suffix}`,
      releaseId: unapproved,
      toState: 'staging',
      operator: 'ops',
      evidence: {},
    });
    expect(refusedUnapproved.status).toBe('refused');
    if (refusedUnapproved.status === 'refused') expect(refusedUnapproved.reason).toBe('release_not_approved');

    const refusedUnknown = await store.recordForwardPromotion({
      promotionId: `pk-${suffix}`,
      releaseId: `rel-missing-${suffix}`,
      toState: 'staging',
      operator: 'ops',
      evidence: {},
    });
    expect(refusedUnknown.status).toBe('refused');
    if (refusedUnknown.status === 'refused') expect(refusedUnknown.reason).toBe('release_not_found');
  });

  it('rolls back to an earlier approved target, refusing non-existent / unapproved / non-earlier targets', async () => {
    // Earlier approved target, recorded first so its createdAt predates the new release.
    const target = await approvedRelease(`rel-target-${suffix}`);
    await new Promise((r) => setTimeout(r, 10));
    const releaseId = await approvedRelease(`rel-rollback-${suffix}`);
    await store.recordForwardPromotion({ promotionId: `rb-${suffix}-staging`, releaseId, toState: 'staging', operator: 'ops', evidence: {} });

    // Non-existent target.
    const missing = await store.recordRollback({
      promotionId: `rb-${suffix}-missing`,
      releaseId,
      rollbackToReleaseId: `rel-nope-${suffix}`,
      operator: 'ops',
      evidence: {},
    });
    expect(missing.status).toBe('refused');
    if (missing.status === 'refused') expect(missing.reason).toBe('rollback_target_not_found');

    // Unapproved target (recorded, not approved).
    const unapprovedTarget = `rel-target-unapproved-${suffix}`;
    const m = buildManifest();
    await operations.recordReleaseManifest({
      releaseId: unapprovedTarget,
      gitSha: m.gitSha,
      manifest: m as unknown as Record<string, unknown>,
      manifestDigestHex: digestFor(m),
    });
    const unapproved = await store.recordRollback({
      promotionId: `rb-${suffix}-unapproved`,
      releaseId,
      rollbackToReleaseId: unapprovedTarget,
      operator: 'ops',
      evidence: {},
    });
    expect(unapproved.status).toBe('refused');
    if (unapproved.status === 'refused') expect(unapproved.reason).toBe('rollback_target_not_approved');

    // A later-created approved release cannot be a rollback target (not earlier).
    await new Promise((r) => setTimeout(r, 10));
    const laterTarget = await approvedRelease(`rel-target-later-${suffix}`);
    const notEarlier = await store.recordRollback({
      promotionId: `rb-${suffix}-later`,
      releaseId,
      rollbackToReleaseId: laterTarget,
      operator: 'ops',
      evidence: {},
    });
    expect(notEarlier.status).toBe('refused');
    if (notEarlier.status === 'refused') expect(notEarlier.reason).toBe('rollback_target_not_earlier');

    // The legal rollback to the earlier approved target records with honest markers.
    const ok = await store.recordRollback({
      promotionId: `rb-${suffix}-ok`,
      releaseId,
      rollbackToReleaseId: target,
      operator: 'ops',
      evidence: { canaryExit: 2 },
    });
    expect(ok.status).toBe('recorded');
    if (ok.status === 'recorded') {
      expect(ok.promotion.toState).toBe('rolled_back');
      expect(ok.promotion.evidence).toMatchObject({
        dataReversalClaimed: false,
        postgresWritesAfterFlipReversed: false,
        rollbackToReleaseId: target,
        canaryExit: 2,
      });
    }
    expect(await store.currentPromotionState(releaseId)).toBe('rolled_back');
  });

  it('refuses rollback evidence that claims data reversal (NC-44.5)', async () => {
    const target = await approvedRelease(`rel-honest-target-${suffix}`);
    await new Promise((r) => setTimeout(r, 10));
    const releaseId = await approvedRelease(`rel-honest-${suffix}`);
    await store.recordForwardPromotion({ promotionId: `h-${suffix}-staging`, releaseId, toState: 'staging', operator: 'ops', evidence: {} });

    const dishonest = await store.recordRollback({
      promotionId: `h-${suffix}-lie`,
      releaseId,
      rollbackToReleaseId: target,
      operator: 'ops',
      evidence: { dataReversalClaimed: true },
    });
    expect(dishonest.status).toBe('refused');
    if (dishonest.status === 'refused') expect(dishonest.reason).toBe('evidence_claims_data_reversal');
    expect(await store.currentPromotionState(releaseId)).toBe('staging');
  });

  it('refuses a reversal claim smuggled at depth or as a string, and a rollback to a rolled-back target', async () => {
    const targetA = await approvedRelease(`rel-deep-target-a-${suffix}`);
    await new Promise((r) => setTimeout(r, 10));
    const targetB = await approvedRelease(`rel-deep-target-b-${suffix}`);
    await new Promise((r) => setTimeout(r, 10));
    const releaseId = await approvedRelease(`rel-deep-${suffix}`);
    await store.recordForwardPromotion({ promotionId: `d-${suffix}-staging`, releaseId, toState: 'staging', operator: 'ops', evidence: {} });

    // Nested and string-typed reversal claims are refused, not just top-level booleans.
    for (const evidence of [
      { claims: { dataReversalClaimed: true } },
      { dataReversalClaimed: 'true' },
      { notes: [{ postgresWritesAfterFlipReversed: true }] },
    ]) {
      const smuggled = await store.recordRollback({
        promotionId: `d-${suffix}-smuggle-${Math.random().toString(36).slice(2, 8)}`,
        releaseId,
        rollbackToReleaseId: targetB,
        operator: 'ops',
        evidence: evidence as Record<string, unknown>,
      });
      expect(smuggled.status).toBe('refused');
      if (smuggled.status === 'refused') expect(smuggled.reason).toBe('evidence_claims_data_reversal');
    }

    // Roll targetB back (to targetA), then a rollback pointing AT targetB is refused.
    await store.recordForwardPromotion({ promotionId: `d-${suffix}-tb-staging`, releaseId: targetB, toState: 'staging', operator: 'ops', evidence: {} });
    const tbRollback = await store.recordRollback({
      promotionId: `d-${suffix}-tb-rb`,
      releaseId: targetB,
      rollbackToReleaseId: targetA,
      operator: 'ops',
      evidence: {},
    });
    expect(tbRollback.status).toBe('recorded');
    const toRetreated = await store.recordRollback({
      promotionId: `d-${suffix}-to-retreated`,
      releaseId,
      rollbackToReleaseId: targetB,
      operator: 'ops',
      evidence: {},
    });
    expect(toRetreated.status).toBe('refused');
    if (toRetreated.status === 'refused') expect(toRetreated.reason).toBe('rollback_target_rolled_back');
    expect(await store.currentPromotionState(releaseId)).toBe('staging');
  });

  it('serializes two concurrent transitions for the same release (one recorded, one contended)', async () => {
    const releaseId = await approvedRelease(`rel-concurrent-${suffix}`);
    // Both attempt the SAME first transition (none -> staging) at once. The lease
    // serializes them: exactly ONE records. The loser is blocked in one of two honest
    // ways depending on who wins the lease race: `contended` (it never got the lease),
    // or `refused` with from_state_mismatch (it got the lease AFTER the winner already
    // advanced state to staging, so its derived from-state no longer matches). Either
    // way the ladder is not double-advanced.
    const [a, b] = await Promise.all([
      store.recordForwardPromotion({ promotionId: `c-${suffix}-a`, releaseId, toState: 'staging', operator: 'ops-a', evidence: {} }),
      store.recordForwardPromotion({ promotionId: `c-${suffix}-b`, releaseId, toState: 'staging', operator: 'ops-b', evidence: {} }),
    ]);
    const recorded = [a, b].filter((r) => r.status === 'recorded');
    const blocked = [a, b].filter((r) => r.status === 'contended' || r.status === 'refused');
    expect(recorded).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect(await store.currentPromotionState(releaseId)).toBe('staging');
    // Exactly one staging row exists.
    const history = await store.listPromotions(releaseId);
    expect(history.filter((p) => p.toState === 'staging')).toHaveLength(1);
  });
});
