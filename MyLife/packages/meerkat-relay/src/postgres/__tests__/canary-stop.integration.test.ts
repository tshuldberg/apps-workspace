import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/**
 * Canary-stop rollout proof (Plan 44 WP-7C, part 3c; AC-44.11 rollout-stop half).
 *
 * Drives the REAL promotion bin (spawnSync, like promotion-cli.test.ts) against a
 * scratch database holding a recorded + approved release already promoted to staging.
 * A FAILING canary verdict file must REFUSE the staging_canary promotion (nonzero
 * exit, verdict-not-ok fatal) and land NO promotion row; a PASSING verdict then
 * records the rung. The refusal IS the proof: the gate exists so a bad canary cannot
 * be recorded as a healthy promotion.
 *
 * No provider fleet is deployed here. This proves the repo-owned evidence gate in
 * promotion-cli (assertOkVerdict) end to end through the shipped bin.
 */

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const promotionBin = fileURLToPath(new URL('../../../bin/meerkat-promotion.mjs', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

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

describePostgres('canary stop refuses a promotion recorded on a failing verdict (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const scratchDb = `meerkat_test_canary_${suffix}`;
  let adminPool: Pool;
  let scratchPool: Pool;
  let scratchUrl: string;
  let store: PostgresPromotionStore;
  const evidenceFiles: string[] = [];

  // The bin connects with the scratch db over MEERKAT_POSTGRES_URL; SSL disabled for
  // the local test container. Password/URL are never asserted against; only exits + rows.
  function runPromotionBin(args: string[]) {
    const env = { ...process.env };
    for (const key of ['MEERKAT_POSTGRES_SSL_MODE', 'MEERKAT_POSTGRES_SSL_CA_FILE']) delete env[key];
    return spawnSync(promotionBin, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...env,
        MEERKAT_POSTGRES_URL: scratchUrl,
        MEERKAT_POSTGRES_SSL_MODE: 'disable',
      },
    });
  }

  function stdoutLines(stdout: string): Record<string, unknown>[] {
    return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  async function writeEvidence(name: string, lines: unknown[]): Promise<string> {
    const path = join(tmpdir(), `canary-${name}-${suffix}.ndjson`);
    await fs.writeFile(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    evidenceFiles.push(path);
    return path;
  }

  async function approvedReleaseAtStaging(id: string): Promise<string> {
    const database = new PostgresStoreContext(scratchPool);
    const operations = new PostgresOperationsStore(database);
    const manifest = buildManifest();
    await operations.recordReleaseManifest({
      releaseId: id,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex: digestFor(manifest),
    });
    await operations.approveReleaseManifest(id, 1);
    const staged = await store.recordForwardPromotion({
      promotionId: `stg-${id}`,
      releaseId: id,
      toState: 'staging',
      operator: 'ops',
      evidence: { note: 'initial staging deploy' },
    });
    expect(staged.status).toBe('recorded');
    return id;
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Canary-stop integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${scratchDb}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${scratchDb}`;
    scratchUrl = url.toString();
    scratchPool = new Pool({ connectionString: scratchUrl, max: 6, statement_timeout: 30_000 });
    scratchPool.on('error', () => undefined);
    await runPostgresMigrations(scratchPool);
    store = new PostgresPromotionStore(new PostgresStoreContext(scratchPool));
  });

  afterAll(async () => {
    await Promise.all(evidenceFiles.map((f) => fs.rm(f, { force: true }).catch(() => undefined)));
    await scratchPool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  it('refuses staging_canary on a FAILING verdict and records it on a PASSING one', async () => {
    const releaseId = await approvedReleaseAtStaging(`rel-canary-${suffix}`);
    expect(await store.currentPromotionState(releaseId)).toBe('staging');

    // A failing canary verdict, the exact NDJSON shape canary-verdict.mjs emits when a
    // check fails: the final line's verdict is not "ok".
    const failing = await writeEvidence('fail', [
      { probe: 'canary-verdict', verdict: 'fail', reason: 'check_failed', checks: [{ name: 'readyz:persona', verdict: 'fail', detail: 'unreachable' }] },
    ]);
    const refused = runPromotionBin(['--promote', '--release-id', releaseId, '--to', 'staging_canary', '--operator', 'ops', '--evidence', failing]);
    // Nonzero exit and the verdict-not-ok fatal: the bin refuses BEFORE any store write.
    expect(refused.status).not.toBe(0);
    expect(stdoutLines(refused.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('not "ok"'),
    });
    // The refusal left the ladder untouched: no staging_canary row, still at staging.
    expect(await store.currentPromotionState(releaseId)).toBe('staging');
    const afterRefusal = await store.listPromotions(releaseId);
    expect(afterRefusal.some((p) => p.toState === 'staging_canary')).toBe(false);

    // A degraded verdict is likewise refused (a canary that answered but is not healthy).
    const degraded = await writeEvidence('degraded', [
      { probe: 'canary-verdict', verdict: 'degraded', reason: 'check_degraded', checks: [] },
    ]);
    const refusedDegraded = runPromotionBin(['--promote', '--release-id', releaseId, '--to', 'staging_canary', '--operator', 'ops', '--evidence', degraded]);
    expect(refusedDegraded.status).not.toBe(0);
    expect(await store.currentPromotionState(releaseId)).toBe('staging');

    // A PASSING verdict records the rung: the same gate that refuses a bad canary must
    // let a real green one through, or the gate would be a blanket block, not a proof.
    const passing = await writeEvidence('pass', [
      { probe: 'canary-verdict', verdict: 'ok', reason: 'all_ran_checks_ok', checks: [{ name: 'readyz:persona', verdict: 'ok', detail: 'ready' }] },
    ]);
    const recorded = runPromotionBin(['--promote', '--release-id', releaseId, '--to', 'staging_canary', '--operator', 'ops', '--evidence', passing]);
    expect(recorded.status).toBe(0);
    expect(stdoutLines(recorded.stdout).at(-1)).toMatchObject({
      event: 'promotion_recorded',
      toState: 'staging_canary',
    });
    expect(await store.currentPromotionState(releaseId)).toBe('staging_canary');
  });
});
