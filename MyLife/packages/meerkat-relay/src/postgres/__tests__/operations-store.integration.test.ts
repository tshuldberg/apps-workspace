import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresOperationsStore } from '../stores/operations-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;

describePostgres('PostgresOperationsStore multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_operations_${suffix}`;
  let adminPool: Pool | undefined;
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let first: PostgresOperationsStore;
  let second: PostgresOperationsStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    const currentName = current.rows[0]?.name ?? '';
    if (!destructiveTestEnabled || !/^meerkat_(?:ci|test)(?:_|$)/u.test(currentName)) {
      throw new Error(
        'Destructive PostgreSQL integration tests require MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS=true and a meerkat_ci or meerkat_test database',
      );
    }

    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-operations-integration-a',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-operations-integration-b',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresOperationsStore(new PostgresStoreContext(firstPool));
    second = new PostgresOperationsStore(new PostgresStoreContext(secondPool));
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('stores one request-bound result and replays it across service instances', async () => {
    const input = {
      scope: 'push.send',
      key: `idempotency-${randomUUID()}`,
      requestDigestHex: 'ab'.repeat(32),
      owner: 'worker-a',
      leaseMs: 30_000,
    };
    const claims = await Promise.all([
      first.claimIdempotency<{ attemptId: string }>(input),
      second.claimIdempotency<{ attemptId: string }>({ ...input, owner: 'worker-b' }),
    ]);
    const winner = claims.find((claim) => claim.status === 'acquired');
    expect(claims.filter((claim) => claim.status === 'acquired')).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === 'in_progress')).toHaveLength(1);
    if (!winner || winner.status !== 'acquired') throw new Error('No idempotency winner');

    const winningOwner = claims[0]?.status === 'acquired' ? 'worker-a' : 'worker-b';
    await expect(first.completeIdempotency({
      ...input,
      owner: winningOwner,
      fencingToken: winner.fencingToken,
      result: { attemptId: 'attempt-1' },
      resultTtlMs: 60_000,
    })).resolves.toBe(true);
    await expect(second.claimIdempotency({
      ...input,
      owner: 'worker-c',
    })).resolves.toEqual({
      status: 'replay',
      result: { attemptId: 'attempt-1' },
    });
    await expect(second.claimIdempotency({
      ...input,
      owner: 'worker-c',
      requestDigestHex: 'cd'.repeat(32),
    })).resolves.toEqual({ status: 'conflict' });
  });

  it('prevents an expired idempotency owner from committing after takeover', async () => {
    const input = {
      scope: 'archive.submit',
      key: `idempotency-${randomUUID()}`,
      requestDigestHex: 'ef'.repeat(32),
      owner: 'worker-old',
      leaseMs: 30_000,
    };
    const original = await first.claimIdempotency(input);
    expect(original.status).toBe('acquired');
    if (original.status !== 'acquired') throw new Error('Initial claim failed');
    await firstPool!.query(
      `UPDATE ops.idempotency_results
       SET claim_expires_at = clock_timestamp() - interval '1 second'
       WHERE scope = $1 AND idempotency_key = $2`,
      [input.scope, input.key],
    );

    const replacement = await second.claimIdempotency({ ...input, owner: 'worker-new' });
    expect(replacement.status).toBe('acquired');
    if (replacement.status !== 'acquired') throw new Error('Takeover failed');
    expect(replacement.fencingToken).toBeGreaterThan(original.fencingToken);
    await expect(first.completeIdempotency({
      ...input,
      fencingToken: original.fencingToken,
      result: { owner: 'old' },
    })).resolves.toBe(false);
    await expect(second.completeIdempotency({
      ...input,
      owner: 'worker-new',
      fencingToken: replacement.fencingToken,
      result: { owner: 'new' },
    })).resolves.toBe(true);
  });

  it('preserves idempotency fencing generations after an explicit abandon', async () => {
    const input = {
      scope: 'push.cancel',
      key: `idempotency-${randomUUID()}`,
      requestDigestHex: 'ac'.repeat(32),
      owner: 'stable-worker',
      leaseMs: 30_000,
    };
    const original = await first.claimIdempotency(input);
    expect(original.status).toBe('acquired');
    if (original.status !== 'acquired') throw new Error('Initial claim failed');
    await expect(first.abandonIdempotency({
      ...input,
      fencingToken: original.fencingToken,
    })).resolves.toBe(true);

    const replacement = await second.claimIdempotency(input);
    expect(replacement.status).toBe('acquired');
    if (replacement.status !== 'acquired') throw new Error('Replacement claim failed');
    expect(replacement.fencingToken).toBeGreaterThan(original.fencingToken);
    await expect(first.completeIdempotency({
      ...input,
      fencingToken: original.fencingToken,
      result: { owner: 'stale' },
    })).resolves.toBe(false);
    await expect(second.completeIdempotency({
      ...input,
      fencingToken: replacement.fencingToken,
      result: { owner: 'current' },
    })).resolves.toBe(true);
  });

  it('fences generic job leases across two workers', async () => {
    const input = {
      queue: 'backup.verify',
      jobId: `job-${randomUUID()}`,
      owner: 'worker-a',
      leaseMs: 30_000,
    };
    const claims = await Promise.all([
      first.claimJobLease(input),
      second.claimJobLease({ ...input, owner: 'worker-b' }),
    ]);
    const winner = claims.find((claim) => claim !== null);
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    if (!winner) throw new Error('No lease winner');
    await firstPool!.query(
      `UPDATE ops.job_leases
       SET leased_until = acquired_at
       WHERE queue = $1 AND job_id = $2`,
      [input.queue, input.jobId],
    );
    const replacement = await second.claimJobLease({ ...input, owner: 'worker-new' });
    expect(replacement?.fencingToken).toBeGreaterThan(winner.fencingToken);
    await expect(first.releaseJobLease(winner)).resolves.toBe(false);
    if (!replacement) throw new Error('No replacement lease');
    await expect(second.renewJobLease(replacement, 60_000)).resolves.toMatchObject({
      fencingToken: replacement.fencingToken,
      owner: 'worker-new',
    });
  });

  it('does not reuse a job fence after release and reacquisition by the same owner', async () => {
    const input = {
      queue: 'archive.reconcile',
      jobId: `job-${randomUUID()}`,
      owner: 'stable-worker',
      leaseMs: 30_000,
    };
    const original = await first.claimJobLease(input);
    if (!original) throw new Error('Initial lease failed');
    await expect(first.releaseJobLease(original)).resolves.toBe(true);

    const replacement = await second.claimJobLease(input);
    if (!replacement) throw new Error('Replacement lease failed');
    expect(replacement.fencingToken).toBeGreaterThan(original.fencingToken);
    await expect(first.renewJobLease(original, 60_000)).resolves.toBeNull();
    await expect(first.releaseJobLease(original)).resolves.toBe(false);
    await expect(second.renewJobLease(replacement, 60_000)).resolves.toMatchObject({
      fencingToken: replacement.fencingToken,
    });
  });

  it('records immutable recovery and release evidence with stable pages and CAS approval', async () => {
    const proofId = `proof-${randomUUID()}`;
    await expect(first.recordBackupRestoreProof({
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'abc123',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 30,
      rtoSeconds: 90,
      semanticDigests: { community: 'sha256:one' },
      verified: true,
    })).resolves.toBe('inserted');
    await expect(second.recordBackupRestoreProof({
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'different',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 1,
      rtoSeconds: 1,
      semanticDigests: {},
      verified: false,
    })).resolves.toBe('duplicate');
    const proofs = await second.listBackupRestoreProofs({ limit: 10 });
    expect(proofs.find((proof) => proof.proofId === proofId)).toMatchObject({
      releaseSha: 'abc123',
      verified: true,
      lifecycleVersion: 1,
    });

    const releaseId = `release-${randomUUID()}`;
    await expect(first.recordReleaseManifest({
      releaseId,
      gitSha: 'abc123',
      manifest: { images: [{ name: 'relay', digest: 'sha256:one' }] },
      manifestDigestHex: '12'.repeat(32),
    })).resolves.toBe(true);
    const approvals = await Promise.all([
      first.approveReleaseManifest(releaseId, 1),
      second.approveReleaseManifest(releaseId, 1),
    ]);
    expect(approvals.filter((version) => version === 2)).toHaveLength(1);
    expect(approvals.filter((version) => version === null)).toHaveLength(1);
    await expect(second.listReleaseManifests({ limit: 10 })).resolves.toContainEqual(
      expect.objectContaining({
        releaseId,
        manifestDigestHex: '12'.repeat(32),
        lifecycleVersion: 2,
      }),
    );
  });
});
