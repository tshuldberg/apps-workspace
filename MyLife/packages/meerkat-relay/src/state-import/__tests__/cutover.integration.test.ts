import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../postgres/migrate';
import { PostgresStoreContext } from '../../postgres/store-context';
import { PostgresCutoverStore } from '../../postgres/stores/cutover-store';
import {
  preflightCutover,
  executeCutover,
  verifyCutover,
  rollbackCutover,
  getCutover,
  type CutoverTarget,
  type LivenessProbe,
} from '..';
import type { StateServiceRoots } from '../enumerate-file';
import type { StateStoreId } from '../model';

/**
 * Live cutover-and-rollback state machine (Plan 44 WP-3C). Proves preflight ->
 * execute -> verify stage progression with durable proofs, the execute digest gate
 * fails closed on divergence, rollback records the honest LOSS statement, and a
 * concurrent second run is refused as `contended`.
 */

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const hex = (id: string) => Buffer.from(id, 'utf8').toString('hex');

const STORES: StateStoreId[] = ['community.descriptor-revisions', 'community.kills'];

// A probe that reports everything DOWN (frozen), so preflight passes by default.
const allDownProbe: LivenessProbe = async (url) => ({ url, live: false, detail: 'connection refused' });
// A probe that reports LIVE, which must FAIL preflight.
const stillLiveProbe: LivenessProbe = async (url) => ({ url, live: true, detail: 'responded 200' });

async function seedFiles(root: string): Promise<StateServiceRoots> {
  const community = path.join(root, 'community');
  await fs.mkdir(path.join(community, 'descriptors'), { recursive: true });
  await fs.writeFile(path.join(community, 'descriptors', `${hex('c1')}.rev.json`),
    JSON.stringify({ revision: 3, descriptorHash: 'a'.repeat(128) }));
  await fs.mkdir(path.join(community, 'kills'), { recursive: true });
  await fs.writeFile(path.join(community, 'kills', `${hex('c9')}.kill.json`),
    JSON.stringify({ kill: { communityId: 'c9' }, signature: 'sig' }));
  return { community };
}

describePostgres('cutover and rollback orchestration (WP-3C)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_cutover_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let target: CutoverTarget;
  let root: string;
  let roots: StateServiceRoots;

  const preflightOk = (cutoverId: string, releaseSha: string) => preflightCutover(target, roots, {
    cutoverId, releaseSha, operator: 'op@test', writersFrozenBy: 'sre@test', probeUrls: [],
  }, STORES, allDownProbe);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('WP-3C test requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    target = { database: new PostgresStoreContext(pool) };
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-cutover-'));
    roots = await seedFiles(root);
  });

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    if (pool) await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE
      community.descriptor_revisions, community.kills, ops.cutover_proofs
      RESTART IDENTITY CASCADE`);
    await pool.query('TRUNCATE TABLE ops.idempotency_results RESTART IDENTITY');
  });

  it('preflight -> execute -> verify progresses stages with durable proofs', async () => {
    const id = `cut-${suffix}-clean`;
    const pre = await preflightOk(id, 'sha-abc');
    expect(pre.ok).toBe(true);
    expect(pre.transition?.status).toBe('ok');
    expect(pre.report.schemaVersion).toBe(pre.report.expectedSchemaVersion);

    const preVersion = pre.transition!.status === 'ok' ? pre.transition!.proof.lifecycleVersion : 0;
    const exec = await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    expect(exec.gatePassed).toBe(true);
    expect(exec.comparisons.every((c) => c.status === 'identical')).toBe(true);
    expect(exec.transition?.status).toBe('ok');

    const execVersion = exec.transition!.status === 'ok' ? exec.transition!.proof.lifecycleVersion : 0;
    const verify = await verifyCutover(target, {
      cutoverId: id, operator: 'op@test', expectedVersion: execVersion,
    }, STORES);
    expect(verify.matched).toBe(true);
    expect(verify.transition?.status).toBe('ok');

    const proof = await getCutover(target, id);
    expect(proof!.state).toBe('verified');
    expect(proof!.writersFrozenBy).toBe('sre@test');
    expect(proof!.executedDigest).not.toBeNull();
    expect(proof!.postBootDigest).not.toBeNull();
    expect(proof!.verifiedAt).not.toBeNull();
    expect(proof!.flippedAt).not.toBeNull();
    const dryRun = (proof!.preflightReport as { dryRun: Record<string, number> }).dryRun;
    expect(dryRun['community.descriptor-revisions']).toBe(1);
  });

  it('preflight FAILS (no proof) when a probed service is still live', async () => {
    const id = `cut-${suffix}-live`;
    const result = await preflightCutover(target, roots, {
      cutoverId: id, releaseSha: 'sha', operator: 'op@test', writersFrozenBy: 'sre@test',
      probeUrls: ['http://localhost:8890/healthz'],
    }, STORES, stillLiveProbe);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('still live'))).toBe(true);
    expect(await getCutover(target, id)).toBeNull();
  });

  it('preflight FAILS without a writer-freeze attestation', async () => {
    const id = `cut-${suffix}-noattest`;
    const result = await preflightCutover(target, roots, {
      cutoverId: id, releaseSha: 'sha', operator: 'op@test', writersFrozenBy: '', probeUrls: [],
    }, STORES, allDownProbe);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('attestation'))).toBe(true);
    expect(await getCutover(target, id)).toBeNull();
  });

  it('execute gate FAILS closed when the target diverges; no completion proof', async () => {
    const id = `cut-${suffix}-diverge`;
    const pre = await preflightOk(id, 'sha-def');
    const preVersion = pre.transition!.status === 'ok' ? pre.transition!.proof.lifecycleVersion : 0;

    await pool.query(
      `INSERT INTO community.descriptor_revisions (community_id, revision, descriptor_hash)
       VALUES ('rogue', 9, $1)`, ['f'.repeat(128)]);

    const exec = await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    expect(exec.gatePassed).toBe(false);
    const proof = await getCutover(target, id);
    expect(proof!.state).toBe('preflighted');
    expect(proof!.executedDigest).toBeNull();
    const descriptorCompare = exec.comparisons.find((c) => c.storeId === 'community.descriptor-revisions');
    expect(descriptorCompare!.status).toBe('extra_in_target');
  });

  it('rollback records the honest window + LOSS list and never claims writes survived', async () => {
    const id = `cut-${suffix}-rollback`;
    const pre = await preflightOk(id, 'sha-ghi');
    const preVersion = pre.transition!.status === 'ok' ? pre.transition!.proof.lifecycleVersion : 0;
    const exec = await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    const execVersion = exec.transition!.status === 'ok' ? exec.transition!.proof.lifecycleVersion : 0;

    await pool.query(
      `INSERT INTO community.descriptor_revisions (community_id, revision, descriptor_hash)
       VALUES ('post-cutover', 1, $1)`, ['b'.repeat(128)]);

    const rollback = await rollbackCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: execVersion, reason: 'staging smoke failed',
    }, STORES);
    expect(rollback.transition.status).toBe('ok');
    expect(rollback.lostStores).toContain('community.descriptor-revisions');
    expect(rollback.delta.postgresWritesAfterCutoverPreserved).toBe(false);
    expect(rollback.delta.authorityAfterRollback).toBe('file');
    expect(rollback.delta.orphanedPostgresRowsRetainedForForensics).toBe(true);

    const proof = await getCutover(target, id);
    expect(proof!.state).toBe('rolled_back');
    expect(proof!.rolledBackAt).not.toBeNull();
    const delta = proof!.rollbackDigestDelta as { lostStores: string[]; windowStart: string };
    expect(delta.lostStores).toContain('community.descriptor-revisions');
    expect(delta.windowStart).toBeTruthy();
    // The orphaned post-cutover row is NOT deleted (retained for forensics).
    const remaining = await pool.query<{ n: string }>(
      "SELECT count(*) AS n FROM community.descriptor_revisions WHERE community_id = 'post-cutover'");
    expect(Number(remaining.rows[0]!.n)).toBe(1);
  });

  it('a concurrent second run of the same cutover id is refused as contended', async () => {
    const id = `cut-${suffix}-contended`;
    const pre = await preflightOk(id, 'sha-con');
    const preVersion = pre.transition!.status === 'ok' ? pre.transition!.proof.lifecycleVersion : 0;

    // Simulate a live concurrent run by holding the cutover LEASE through the same
    // operations store the cutover store uses to fence phases.
    const store = new PostgresCutoverStore(target.database);
    const ops = (store as unknown as { operations: {
      claimJobLease: (i: Record<string, unknown>) => Promise<unknown | null>;
    } }).operations;
    const held = await ops.claimJobLease({
      queue: 'cutover', jobId: id, owner: 'other-operator', leaseMs: 60_000,
    });
    expect(held).not.toBeNull();

    const exec = await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    expect(exec.transition?.status).toBe('contended');
    const proof = await getCutover(target, id);
    expect(proof!.state).toBe('preflighted');
  });

  it('a stale expected-version is rejected as a version conflict, not a silent success', async () => {
    const id = `cut-${suffix}-fence`;
    const pre = await preflightOk(id, 'sha-jkl');
    const preVersion = pre.transition!.status === 'ok' ? pre.transition!.proof.lifecycleVersion : 0;
    await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    const stale = await executeCutover(target, roots, {
      cutoverId: id, operator: 'op@test', expectedVersion: preVersion,
    }, STORES);
    expect(stale.gatePassed).toBe(true);
    expect(stale.transition?.status).not.toBe('ok');
  });
});
