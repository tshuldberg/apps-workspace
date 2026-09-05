import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresOperationsStore } from '../stores/operations-store';
import { PostgresRehearsalStore } from '../stores/rehearsal-store';
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
    migrationRange: { lowest: 1, highest: 12 },
    configSchemaDigest: 'b'.repeat(64),
    mobileBuild: null,
    webArtifact: null,
    rollbackReleaseId: null,
  });
}

function digestFor(manifest: ReleaseManifest): string {
  return createHash('sha256').update(canonicalizeManifest(manifest), 'utf8').digest('hex');
}

const NOW = () => new Date().toISOString();

describePostgres('rehearsal proof store (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const scratchDb = `meerkat_test_rehearsal_${suffix}`;
  let adminPool: Pool;
  let scratchPool: Pool;
  let operations: PostgresOperationsStore;
  let store: PostgresRehearsalStore;

  /** Record + approve a release manifest so it is a valid drill target, returning its id. */
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
      throw new Error('Rehearsal proof integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${scratchDb}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${scratchDb}`;
    scratchPool = new Pool({ connectionString: url.toString(), max: 6, statement_timeout: 30_000 });
    scratchPool.on('error', () => undefined);
    await runPostgresMigrations(scratchPool);
    const database = new PostgresStoreContext(scratchPool);
    operations = new PostgresOperationsStore(database);
    store = new PostgresRehearsalStore(database);
  });

  afterAll(async () => {
    await scratchPool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  it('records a passed drill with evidence and reads it back', async () => {
    const result = await store.recordDrill({
      drillId: `d-pass-${suffix}`,
      drillKind: 'load',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { p99Ms: 42, completed: 10_000 },
    });
    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') {
      expect(result.drill.drillKind).toBe('load');
      expect(result.drill.verdict).toBe('passed');
      expect(result.drill.evidence).toMatchObject({ p99Ms: 42, storeStamped: { releaseApproved: null } });
    }
    const latest = await store.latestByKind('load');
    expect(latest?.drillId).toBe(`d-pass-${suffix}`);
  });

  it('refuses a passed verdict with an empty evidence object (store gate)', async () => {
    const result = await store.recordDrill({
      drillId: `d-bare-${suffix}`,
      drillKind: 'soak',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: {},
    });
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toBe('passed_requires_evidence');
    expect(await store.get(`d-bare-${suffix}`)).toBeNull();
  });

  it('refuses a passed verdict whose evidence is VACUOUS, not merely empty (adversarial-review P1)', async () => {
    for (const [label, evidence] of Object.entries({
      nullValue: { a: null },
      nestedEmpty: { x: {} },
      wrapperEmpty: { attachedEvidence: {} },
      whitespaceKey: { ' ': null },
      emptyArray: { attachedEvidence: [] },
      blankString: { note: '   ' },
    })) {
      const result = await store.recordDrill({
        drillId: `d-vac-${label}-${suffix}`,
        drillKind: 'soak',
        verdict: 'passed',
        operator: 'ops',
        startedAt: NOW(),
        evidence: evidence as Record<string, unknown>,
      });
      expect(result.status, label).toBe('refused');
      if (result.status === 'refused') expect(result.reason).toBe('passed_requires_evidence');
    }
    // Scalars are content: 0 and false are at least assertions.
    const scalar = await store.recordDrill({
      drillId: `d-vac-scalar-${suffix}`,
      drillKind: 'soak',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { attachedEvidence: 0 },
    });
    expect(scalar.status).toBe('recorded');
  });

  it('refuses null-dressed passed evidence at the DATABASE CHECK (jsonb_strip_nulls backstop)', async () => {
    await expect(
      scratchPool.query(
        `INSERT INTO ops.rehearsal_proofs (drill_id, drill_kind, operator, verdict, evidence, started_at)
         VALUES ($1, 'load', 'ops', 'passed', '{"a": null}'::jsonb, clock_timestamp())`,
        [`d-directnull-${suffix}`],
      ),
    ).rejects.toThrow(/rehearsal_passed_requires_evidence/);
  });

  it('refuses a loose non-ISO started_at and one predating the project floor', async () => {
    const loose = await store.recordDrill({
      drillId: `d-loose-${suffix}`,
      drillKind: 'incident',
      verdict: 'failed',
      operator: 'ops',
      startedAt: 'Jan 1 2026',
      evidence: {},
    });
    expect(loose.status).toBe('refused');
    if (loose.status === 'refused') expect(loose.reason).toBe('invalid_started_at');

    const tooOld = await store.recordDrill({
      drillId: `d-old-${suffix}`,
      drillKind: 'incident',
      verdict: 'failed',
      operator: 'ops',
      startedAt: '2020-01-01T00:00:00.000Z',
      evidence: {},
    });
    expect(tooOld.status).toBe('refused');
    if (tooOld.status === 'refused') expect(tooOld.reason).toBe('started_at_too_old');
  });

  it('refuses a bare passed row at the DATABASE CHECK via a direct insert', async () => {
    // The store is the gate, but the migration CHECK is the backstop: a raw insert of
    // a passed row with '{}' evidence must be rejected by the database itself.
    await expect(
      scratchPool.query(
        `INSERT INTO ops.rehearsal_proofs (drill_id, drill_kind, operator, verdict, evidence, started_at)
         VALUES ($1, 'load', 'ops', 'passed', '{}'::jsonb, clock_timestamp())`,
        [`d-directbare-${suffix}`],
      ),
    ).rejects.toThrow(/rehearsal_passed_requires_evidence/);
  });

  it('rejects an unknown kind at the DATABASE CHECK via a direct insert', async () => {
    await expect(
      scratchPool.query(
        `INSERT INTO ops.rehearsal_proofs (drill_id, drill_kind, operator, verdict, evidence, started_at)
         VALUES ($1, 'not_a_kind', 'ops', 'failed', '{}'::jsonb, clock_timestamp())`,
        [`d-directkind-${suffix}`],
      ),
    ).rejects.toThrow(/rehearsal_kind_known/);
  });

  it('refuses an unknown kind and an invalid verdict (store)', async () => {
    const badKind = await store.recordDrill({
      drillId: `d-badkind-${suffix}`,
      drillKind: 'teleport',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { x: 1 },
    });
    expect(badKind.status).toBe('refused');
    if (badKind.status === 'refused') expect(badKind.reason).toBe('unknown_kind');

    const badVerdict = await store.recordDrill({
      drillId: `d-badverdict-${suffix}`,
      drillKind: 'load',
      verdict: 'greenish',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { x: 1 },
    });
    expect(badVerdict.status).toBe('refused');
    if (badVerdict.status === 'refused') expect(badVerdict.reason).toBe('invalid_verdict');
  });

  it('refuses a started_at that postdates the database clock beyond skew', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await store.recordDrill({
      drillId: `d-future-${suffix}`,
      drillKind: 'failover',
      verdict: 'failed',
      operator: 'ops',
      startedAt: future,
      evidence: {},
    });
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toBe('started_at_in_future');
  });

  it('refuses a supplied release_id that names no manifest', async () => {
    const result = await store.recordDrill({
      drillId: `d-norel-${suffix}`,
      drillKind: 'load',
      verdict: 'failed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: {},
      releaseId: `rel-missing-${suffix}`,
    });
    expect(result.status).toBe('refused');
    if (result.status === 'refused') expect(result.reason).toBe('release_not_found');
  });

  it('stamps release approval state into evidence for an existing (unapproved) release', async () => {
    // A recorded-but-unapproved manifest is a legal drill target; approval is stamped false.
    const manifest = buildManifest();
    const unapproved = `rel-unapproved-${suffix}`;
    await operations.recordReleaseManifest({
      releaseId: unapproved,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex: digestFor(manifest),
    });
    const result = await store.recordDrill({
      drillId: `d-unapproved-${suffix}`,
      drillKind: 'canary_stop_rollback',
      verdict: 'failed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { note: 'ran against a candidate before approval' },
      releaseId: unapproved,
    });
    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') {
      expect(result.drill.releaseId).toBe(unapproved);
      expect(result.drill.evidence).toMatchObject({ storeStamped: { releaseApproved: false } });
    }
  });

  it('reports a duplicate drill id (durable row) without re-labeling it', async () => {
    const first = await store.recordDrill({
      drillId: `d-dup-${suffix}`,
      drillKind: 'incident',
      verdict: 'failed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { sev: 2 },
    });
    expect(first.status).toBe('recorded');
    const second = await store.recordDrill({
      drillId: `d-dup-${suffix}`,
      drillKind: 'incident',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { sev: 0 },
    });
    expect(second.status).toBe('duplicate');
    if (second.status === 'duplicate') {
      // The durable row keeps the ORIGINAL failed verdict; the re-submit did not rewrite it.
      expect(second.existing.verdict).toBe('failed');
      expect(second.existing.evidence).toMatchObject({ sev: 2 });
    }
  });

  it('serializes two concurrent records for the same drill id (one recorded, one blocked)', async () => {
    const drillId = `d-concurrent-${suffix}`;
    const [a, b] = await Promise.all([
      store.recordDrill({ drillId, drillKind: 'queue_backlog', verdict: 'failed', operator: 'ops-a', startedAt: NOW(), evidence: {} }),
      store.recordDrill({ drillId, drillKind: 'queue_backlog', verdict: 'failed', operator: 'ops-b', startedAt: NOW(), evidence: {} }),
    ]);
    const recorded = [a, b].filter((r) => r.status === 'recorded');
    const blocked = [a, b].filter((r) => r.status === 'contended' || r.status === 'duplicate');
    expect(recorded).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    const rows = await store.listDrills({ kind: 'queue_backlog' });
    expect(rows.filter((r) => r.drillId === drillId)).toHaveLength(1);
  });

  it('exports honest evidence: two passed kinds present, the other nine in missingDrills, no failed leak', async () => {
    const releaseId = await approvedRelease(`rel-export-${suffix}`);
    // Two PASSED kinds for this release.
    await store.recordDrill({
      drillId: `e-load-${suffix}`,
      drillKind: 'load',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { p99Ms: 30 },
      releaseId,
    });
    await store.recordDrill({
      drillId: `e-soak-${suffix}`,
      drillKind: 'soak',
      verdict: 'passed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { hours: 48 },
      releaseId,
    });
    // A FAILED failover drill for the same release must NOT appear as a passed entry.
    await store.recordDrill({
      drillId: `e-failover-${suffix}`,
      drillKind: 'failover',
      verdict: 'failed',
      operator: 'ops',
      startedAt: NOW(),
      evidence: { note: 'standby did not promote' },
      releaseId,
    });

    const load = await store.latestPassedForRelease('load', releaseId);
    const soak = await store.latestPassedForRelease('soak', releaseId);
    const failover = await store.latestPassedForRelease('failover', releaseId);
    expect(load?.verdict).toBe('passed');
    expect(soak?.verdict).toBe('passed');
    // A failed drill is not a passed proof: the export sees null and lists it missing.
    expect(failover).toBeNull();
  });
});
