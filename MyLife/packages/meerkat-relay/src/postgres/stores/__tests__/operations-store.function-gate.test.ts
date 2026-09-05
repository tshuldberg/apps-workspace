import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import type { PostgresStoreContext } from '../../store-context';
import {
  PostgresOperationsStore,
  type JobLease,
} from '../operations-store';

interface ScriptedResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

class ScriptedDatabase {
  readonly calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  transactions = 0;

  constructor(private readonly results: ScriptedResult[]) {}

  async query(sql: string, values: readonly unknown[] = []): Promise<ScriptedResult> {
    this.calls.push({ sql, values });
    const result = this.results.shift();
    if (!result) throw new Error('Unexpected query');
    return result;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation();
  }
}

const database = (results: ScriptedResult[]): {
  store: PostgresOperationsStore;
  script: ScriptedDatabase;
} => {
  const script = new ScriptedDatabase(results);
  return {
    store: new PostgresOperationsStore(script as unknown as PostgresStoreContext),
    script,
  };
};

const claimInput = {
  scope: 'push.send',
  key: 'request-1',
  requestDigestHex: 'ab'.repeat(32),
  owner: 'worker-1',
  leaseMs: 30_000,
};

describe('PostgresOperationsStore function quality gate', () => {
  it('atomically acquires, replays, rejects conflicts, and fences expired claims', async () => {
    const acquired = database([{
      rows: [{
        request_digest_hex: claimInput.requestDigestHex,
        state: 'in_progress',
        result: null,
        claim_owner: claimInput.owner,
        claim_expires_at: new Date('2026-07-10T12:00:30Z'),
        fencing_token: '1',
      }],
      rowCount: 1,
    }]);
    await expect(acquired.store.claimIdempotency(claimInput)).resolves.toEqual({
      status: 'acquired', fencingToken: 1,
    });
    expect(acquired.script.transactions).toBe(1);
    expect(acquired.script.calls[0]?.sql).toContain('ON CONFLICT (scope, idempotency_key)');
    expect(acquired.script.calls[0]?.sql).toContain('clock_timestamp()');

    const replay = database([
      { rows: [], rowCount: 0 },
      {
        rows: [{
          request_digest_hex: claimInput.requestDigestHex,
          state: 'committed',
          result: { attemptId: 'attempt-1' },
          claim_owner: null,
          claim_expires_at: null,
          fencing_token: 2,
        }],
        rowCount: 1,
      },
    ]);
    await expect(replay.store.claimIdempotency(claimInput)).resolves.toEqual({
      status: 'replay', result: { attemptId: 'attempt-1' },
    });
    expect(replay.script.calls[1]?.sql).toContain('FOR UPDATE');

    const conflict = database([
      { rows: [], rowCount: 0 },
      {
        rows: [{
          request_digest_hex: 'cd'.repeat(32),
          state: 'committed',
          result: {},
          claim_owner: null,
          claim_expires_at: null,
          fencing_token: 1,
        }],
        rowCount: 1,
      },
    ]);
    await expect(conflict.store.claimIdempotency(claimInput)).resolves.toEqual({
      status: 'conflict',
    });

    const takeover = database([
      { rows: [], rowCount: 0 },
      {
        rows: [{
          request_digest_hex: claimInput.requestDigestHex,
          state: 'in_progress',
          result: null,
          claim_owner: 'old-worker',
          claim_expires_at: new Date('2026-07-10T11:59:00Z'),
          fencing_token: 3,
        }],
        rowCount: 1,
      },
      {
        rows: [{
          request_digest_hex: claimInput.requestDigestHex,
          state: 'in_progress',
          result: null,
          claim_owner: claimInput.owner,
          claim_expires_at: new Date('2026-07-10T12:00:30Z'),
          fencing_token: '4',
        }],
        rowCount: 1,
      },
    ]);
    await expect(takeover.store.claimIdempotency(claimInput)).resolves.toEqual({
      status: 'acquired', fencingToken: 4,
    });
    expect(takeover.script.calls[2]?.sql).toContain('claim_expires_at <= clock_timestamp()');
  });

  it('allows only the live claim fence to complete a stored result', async () => {
    const { store, script } = database([{ rows: [], rowCount: 1 }]);
    await expect(store.completeIdempotency({
      ...claimInput,
      fencingToken: 7,
      result: { ok: true },
      resultTtlMs: 60_000,
    })).resolves.toBe(true);
    expect(script.calls[0]?.sql).toContain('claim_expires_at > clock_timestamp()');
    expect(script.calls[0]?.sql).toContain('fencing_token = $5');
    expect(script.calls[0]?.values).toEqual([
      claimInput.scope,
      claimInput.key,
      claimInput.requestDigestHex,
      claimInput.owner,
      7,
      '{"ok":true}',
      60_000,
    ]);

    const invalid = database([{ rows: [], rowCount: 1 }]);
    await expect(invalid.store.completeIdempotency({
      ...claimInput,
      fencingToken: 7,
      result: undefined,
    })).rejects.toThrow(/JSON serializable/);
    expect(invalid.script.calls).toHaveLength(0);
  });

  it('uses database time and stable fencing for job leases', async () => {
    const leaseRow = {
      queue: 'archive.scan',
      job_id: 'job-1',
      owner: 'scanner-1',
      attempt: '2',
      fencing_token: '8',
      acquired_at: new Date('2026-07-10T12:00:00Z'),
      leased_until: new Date('2026-07-10T12:01:00Z'),
    };
    const { store, script } = database([{ rows: [leaseRow], rowCount: 1 }]);
    await expect(store.claimJobLease({
      queue: 'archive.scan',
      jobId: 'job-1',
      owner: 'scanner-1',
      leaseMs: 60_000,
    })).resolves.toEqual({
      queue: 'archive.scan',
      jobId: 'job-1',
      owner: 'scanner-1',
      attempt: 2,
      fencingToken: 8,
      acquiredAt: '2026-07-10T12:00:00.000Z',
      leasedUntil: '2026-07-10T12:01:00.000Z',
    });
    expect(script.calls[0]?.sql).toContain('fencing_token = ops.job_leases.fencing_token + 1');
    expect(script.calls[0]?.sql).toContain('leased_until <= clock_timestamp()');

    const lease: JobLease = {
      queue: 'archive.scan',
      jobId: 'job-1',
      owner: 'scanner-1',
      attempt: 2,
      fencingToken: 8,
      acquiredAt: '2026-07-10T12:00:00.000Z',
      leasedUntil: '2026-07-10T12:01:00.000Z',
    };
    const released = database([{ rows: [], rowCount: 0 }]);
    await expect(released.store.releaseJobLease(lease)).resolves.toBe(false);
    expect(released.script.calls[0]?.values).toEqual([
      'archive.scan', 'job-1', 'scanner-1', 8,
    ]);
  });

  it('maps bounded proof and release pages with stable cursors', async () => {
    const proofDb = database([{
      rows: [{
        proof_id: 'proof-1',
        source_backup_id: 'backup-1',
        release_sha: 'abc123',
        restored_at: new Date('2026-07-10T10:00:00Z'),
        rpo_seconds: 30,
        rto_seconds: 90,
        semantic_digests: { community: 'sha256:one' },
        verified: true,
        lifecycle_version: 1,
        recorded_at: new Date('2026-07-10T10:01:00Z'),
      }],
      rowCount: 1,
    }]);
    await expect(proofDb.store.listBackupRestoreProofs({ limit: 25 })).resolves.toEqual([{
      proofId: 'proof-1',
      sourceBackupId: 'backup-1',
      releaseSha: 'abc123',
      restoredAt: '2026-07-10T10:00:00.000Z',
      rpoSeconds: 30,
      rtoSeconds: 90,
      semanticDigests: { community: 'sha256:one' },
      verified: true,
      lifecycleVersion: 1,
      recordedAt: '2026-07-10T10:01:00.000Z',
    }]);
    expect(proofDb.script.calls[0]?.sql).toContain('ORDER BY restored_at DESC, proof_id DESC');
    expect(proofDb.script.calls[0]?.values[2]).toBe(25);

    const releaseDb = database([{
      rows: [{
        release_id: 'release-1',
        git_sha: 'abc123',
        manifest: { images: [] },
        manifest_digest_hex: 'ef'.repeat(32),
        supersedes_release_id: null,
        created_at: new Date('2026-07-10T11:00:00Z'),
        approved_at: null,
        lifecycle_version: '1',
      }],
      rowCount: 1,
    }]);
    const releases = await releaseDb.store.listReleaseManifests();
    expect(releases[0]?.manifestDigestHex).toBe('ef'.repeat(32));
    expect(releaseDb.script.calls[0]?.sql).toContain('ORDER BY created_at DESC, release_id DESC');
  });

  it('rejects invalid claim inputs without querying and passes deterministic fuzz', async () => {
    await runDeterministicFuzz({
      label: 'PostgresOperationsStore claim validation fuzz',
      iterations: 100,
      seed: 44,
      makeCase: (rng) => ({
        digest: rng() > 0.5 ? 'ab'.repeat(32) : `not-a-digest-${rng()}`,
        leaseMs: rng() > 0.5 ? 1 + Math.floor(rng() * 60_000) : 0,
      }),
      assertCase: async ({ digest, leaseMs }) => {
        const scripted = database([{
          rows: [{ fencing_token: 1 }], rowCount: 1,
        }]);
        const action = scripted.store.claimIdempotency({
          ...claimInput,
          requestDigestHex: digest,
          leaseMs,
        });
        if (/^[a-f0-9]{64}$/.test(digest) && leaseMs > 0) {
          await expect(action).resolves.toEqual({ status: 'acquired', fencingToken: 1 });
        } else {
          await expect(action).rejects.toThrow();
          expect(scripted.script.calls).toHaveLength(0);
        }
      },
    });
  });

  it('stays within constant orchestration complexity and bounded memory', async () => {
    const setup = () => database([{
      rows: [{ fencing_token: 1 }], rowCount: 1,
    }]).store;
    await assertComplexitySlope({
      label: 'PostgresOperationsStore.claimIdempotency',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup,
      run: (store) => store.claimIdempotency(claimInput),
    });
    await assertMemoryBudget({
      label: 'PostgresOperationsStore.claimIdempotency',
      repeats: 100,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup,
      run: (store) => store.claimIdempotency(claimInput),
    });
  });
});
