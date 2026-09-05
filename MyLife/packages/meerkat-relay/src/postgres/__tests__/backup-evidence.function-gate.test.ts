import { describe, expect, it } from 'vitest';
import {
  buildBackupSnapshot,
  resolveDigestRole,
  serializeSnapshot,
  parseSnapshot,
  compareRestoreAgainstSnapshot,
  buildProofDigests,
  computeRpoSeconds,
  computeRtoSeconds,
  foldInventoryBatch,
  finalizeInventoryRollup,
  evaluateBackupFreshness,
  BACKUP_MAX_DIVERGENCES,
} from '../backup-evidence';
import { assertComplexitySlope } from '../../test/function-quality';

const rollup = (seed: string) => Buffer.from(seed.repeat(64)).toString('hex').slice(0, 64);
const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);

const baseSnapshot = () =>
  buildBackupSnapshot({
    capturedAt: '2026-07-10T00:00:00.000Z',
    releaseSha: 'release-1',
    digestRole: 'meerkat_backup_digest',
    perStore: {
      'community.publications': { count: 3, rollupHex: HEX_A },
      'persona.records': { count: 5, rollupHex: HEX_B },
    },
  });

describe('backup snapshot build + parse', () => {
  it('round-trips a snapshot through serialize/parse', () => {
    const snapshot = baseSnapshot();
    const parsed = parseSnapshot(serializeSnapshot(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it('reads capturedAt as the supplied ISO instant, not wall clock', () => {
    const snapshot = baseSnapshot();
    expect(snapshot.capturedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('rejects an empty store map, a bad rollup, and a wrong kind/version', () => {
    expect(() => buildBackupSnapshot({
      capturedAt: '2026-07-10T00:00:00.000Z', releaseSha: 'r', digestRole: 'x', perStore: {},
    })).toThrow(/at least one store/);
    expect(() => buildBackupSnapshot({
      capturedAt: '2026-07-10T00:00:00.000Z', releaseSha: 'r', digestRole: 'x',
      perStore: { s: { count: 1, rollupHex: 'nothex' } },
    })).toThrow(/invalid digest rollup/);
    expect(() => parseSnapshot(JSON.stringify({ kind: 'wrong', version: 1, perStore: {} }))).toThrow(/wrong kind/);
    expect(() => parseSnapshot('{not json')).toThrow(/not valid JSON/);
  });
});

describe('digest role honesty', () => {
  it('records the actual connection role, never an unverified claim', () => {
    expect(resolveDigestRole('', 'meerkat')).toBe('meerkat');
    expect(resolveDigestRole('meerkat_backup_digest', 'meerkat_backup_digest')).toBe('meerkat_backup_digest');
  });

  it('refuses an asserted role that does not match the connection', () => {
    expect(() => resolveDigestRole('meerkat_backup_digest', 'meerkat')).toThrow(/does not match the connection role/);
    expect(() => resolveDigestRole('', '')).toThrow(/required/);
  });
});

describe('restore comparison', () => {
  it('verifies an identical restore', () => {
    const snapshot = baseSnapshot();
    const result = compareRestoreAgainstSnapshot(snapshot, snapshot.perStore);
    expect(result.verified).toBe(true);
    expect(result.identicalStores).toBe(2);
    expect(result.divergences).toHaveLength(0);
  });

  it('never swallows a mutated record: a rollup mismatch fails and is recorded', () => {
    const snapshot = baseSnapshot();
    const mutated = { ...snapshot.perStore, 'persona.records': { count: 5, rollupHex: rollup('z') } };
    const result = compareRestoreAgainstSnapshot(snapshot, mutated);
    expect(result.verified).toBe(false);
    expect(result.divergences).toEqual([
      expect.objectContaining({ storeId: 'persona.records', reason: 'rollup_mismatch' }),
    ]);
  });

  it('flags a count mismatch, a missing store, and an extra store distinctly', () => {
    const snapshot = baseSnapshot();
    const missing = { 'community.publications': { count: 3, rollupHex: HEX_A } };
    expect(compareRestoreAgainstSnapshot(snapshot, missing).divergences).toEqual([
      expect.objectContaining({ storeId: 'persona.records', reason: 'missing_in_restore' }),
    ]);
    const extra = {
      ...snapshot.perStore,
      'extra.store': { count: 1, rollupHex: HEX_A },
    };
    expect(compareRestoreAgainstSnapshot(snapshot, extra).divergences).toEqual([
      expect.objectContaining({ storeId: 'extra.store', reason: 'extra_in_restore' }),
    ]);
    const badCount = { ...snapshot.perStore, 'persona.records': { count: 9, rollupHex: HEX_B } };
    expect(compareRestoreAgainstSnapshot(snapshot, badCount).divergences).toEqual([
      expect.objectContaining({ storeId: 'persona.records', reason: 'count_mismatch' }),
    ]);
  });

  it('bounds the divergence list', () => {
    const perStore: Record<string, { count: number; rollupHex: string }> = {};
    for (let i = 0; i < BACKUP_MAX_DIVERGENCES + 10; i += 1) perStore[`s${i}`] = { count: 1, rollupHex: HEX_A };
    const snapshot = buildBackupSnapshot({
      capturedAt: '2026-07-10T00:00:00.000Z', releaseSha: 'r', digestRole: 'x', perStore,
    });
    const result = compareRestoreAgainstSnapshot(snapshot, {});
    expect(result.verified).toBe(false);
    expect(result.divergences).toHaveLength(BACKUP_MAX_DIVERGENCES);
    expect(result.truncated).toBe(true);
  });

  it('records divergence detail into the proof digests only when unverified', () => {
    const snapshot = baseSnapshot();
    const ok = buildProofDigests(snapshot, snapshot.perStore);
    expect(ok.comparison.verified).toBe(true);
    expect(ok.digests).not.toHaveProperty('divergences');
    const bad = { ...snapshot.perStore, 'persona.records': { count: 1, rollupHex: HEX_A } };
    const failed = buildProofDigests(snapshot, bad);
    expect(failed.comparison.verified).toBe(false);
    expect(failed.digests).toHaveProperty('divergences');
  });

  it('recomputes the comparison itself, so recorded evidence can never contradict its digest maps', () => {
    const snapshot = baseSnapshot();
    const bad = { ...snapshot.perStore, 'persona.records': { count: 1, rollupHex: HEX_A } };
    // No caller-supplied comparison exists to lie with: the divergence always surfaces.
    const { digests, comparison } = buildProofDigests(snapshot, bad);
    expect(comparison.verified).toBe(false);
    expect(digests.identicalStores).toBe(1);
    expect(digests.rtoMeasures).toBe('digest_verification_only');
  });
});

describe('rpo / rto', () => {
  it('computes the at-risk window as reference minus backup', () => {
    expect(computeRpoSeconds('2026-07-10T00:05:00.000Z', '2026-07-10T00:00:00.000Z')).toBe(300);
  });
  it('clamps a backup taken after the reference to zero', () => {
    expect(computeRpoSeconds('2026-07-10T00:00:00.000Z', '2026-07-10T00:05:00.000Z')).toBe(0);
  });
  it('rounds elapsed ms to whole seconds and rejects a negative', () => {
    expect(computeRtoSeconds(1499)).toBe(1);
    expect(computeRtoSeconds(1500)).toBe(2);
    expect(() => computeRtoSeconds(-1)).toThrow(/non-negative/);
  });
});

describe('object inventory rollup', () => {
  const entry = (key: string, size: number) => ({
    key, checksumSha256: HEX_A, sizeBytes: size, versionId: 'v1', state: 'durable',
  });

  it('is independent of paging order', () => {
    const a = { count: 0, totalBytes: 0, entryHashes: [] as string[] };
    foldInventoryBatch(a, [entry('tenants/x', 10), entry('tenants/y', 20)]);
    const b = { count: 0, totalBytes: 0, entryHashes: [] as string[] };
    foldInventoryBatch(b, [entry('tenants/y', 20)]);
    foldInventoryBatch(b, [entry('tenants/x', 10)]);
    expect(finalizeInventoryRollup('tenants/', a)).toEqual(finalizeInventoryRollup('tenants/', b));
  });

  it('counts and totals bytes and rejects a bad checksum', () => {
    const acc = { count: 0, totalBytes: 0, entryHashes: [] as string[] };
    foldInventoryBatch(acc, [entry('tenants/x', 10), entry('tenants/y', 20)]);
    const rolled = finalizeInventoryRollup('tenants/', acc);
    expect(rolled).toMatchObject({ prefix: 'tenants/', count: 2, totalBytes: 30 });
    expect(() => foldInventoryBatch(acc, [{ ...entry('z', 1), checksumSha256: 'bad' }])).toThrow(/invalid checksum/);
  });
});

describe('backup freshness (NC-44.3)', () => {
  const thresholds = { maxProofAgeSeconds: 7 * 24 * 60 * 60, maxRpoSeconds: 24 * 60 * 60 };
  const now = '2026-07-10T00:00:00.000Z';

  it('fails hard when there is no verified proof', () => {
    expect(evaluateBackupFreshness({ latest: null, now, thresholds }).verdict).toBe('fail');
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: now, verified: false, rpoSeconds: 0, rtoSeconds: 0 },
      now, thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'no_verified_proof' });
  });

  it('is fresh within the window and stale beyond it', () => {
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: '2026-07-09T00:00:00.000Z', verified: true, rpoSeconds: 10, rtoSeconds: 20 },
      now, thresholds,
    })).toMatchObject({ verdict: 'ok', reason: 'fresh' });
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: '2026-06-01T00:00:00.000Z', verified: true, rpoSeconds: 10, rtoSeconds: 20 },
      now, thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'proof_stale' });
  });

  it('degrades a fresh proof whose RPO exceeds budget', () => {
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: now, verified: true, rpoSeconds: thresholds.maxRpoSeconds + 1, rtoSeconds: 20 },
      now, thresholds,
    })).toMatchObject({ verdict: 'degraded', reason: 'rpo_exceeded' });
  });

  it('fails a future-dated proof instead of clamping it to fresh', () => {
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: '2026-09-01T00:00:00.000Z', verified: true, rpoSeconds: 0, rtoSeconds: 1 },
      now, thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'proof_in_future' });
    // Within clock-skew allowance stays fresh.
    expect(evaluateBackupFreshness({
      latest: { proofId: 'p', restoredAt: '2026-07-10T00:02:00.000Z', verified: true, rpoSeconds: 0, rtoSeconds: 1 },
      now, thresholds,
    })).toMatchObject({ verdict: 'ok' });
  });
});

describe('complexity budget', () => {
  it('compare stays linear in store count', async () => {
    await assertComplexitySlope({
      label: 'compareRestoreAgainstSnapshot',
      sizes: [200, 400, 800],
      expected: 'linear',
      setup: (n) => {
        const perStore: Record<string, { count: number; rollupHex: string }> = {};
        for (let i = 0; i < n; i += 1) perStore[`s${i}`] = { count: i, rollupHex: HEX_A };
        return buildBackupSnapshot({
          capturedAt: '2026-07-10T00:00:00.000Z', releaseSha: 'r', digestRole: 'x', perStore,
        });
      },
      run: (snapshot) => compareRestoreAgainstSnapshot(snapshot, snapshot.perStore),
    });
  });
});
