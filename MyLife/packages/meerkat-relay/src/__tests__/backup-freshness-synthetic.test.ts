/**
 * Drives the backup-freshness synthetic's pure logic (deploy/observability/synthetics/
 * backup-freshness.mjs, Plan 44 WP-5A).
 *
 * The critical assertion (NC-44.3): a missing or unverified latest proof is a hard FAIL,
 * a stale proof is a FAIL, and only a recent verified proof within the RPO budget is
 * fresh. We also prove the thresholds are read straight from slo-definitions.json with no
 * new dependency.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error -- importing the .mjs probe for its exported pure helpers.
import { evaluateFreshness, readThresholds } from '../../deploy/observability/synthetics/backup-freshness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sloPath = path.resolve(here, '..', '..', 'deploy', 'observability', 'slo-definitions.json');

const thresholds = { maxProofAgeSeconds: 604800, maxRpoSeconds: 86400 };
const now = '2026-07-10T00:00:00.000Z';

describe('backup-freshness synthetic evaluator', () => {
  it('fails hard on a missing or unverified proof (NC-44.3)', () => {
    expect(evaluateFreshness({ latest: null, now, thresholds })).toMatchObject({
      verdict: 'fail',
      reason: 'no_verified_proof',
    });
    expect(evaluateFreshness({
      latest: { proofId: 'p', restoredAt: now, verified: false, rpoSeconds: 0 },
      now,
      thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'no_verified_proof' });
  });

  it('passes a recent verified proof and fails a stale one', () => {
    expect(evaluateFreshness({
      latest: { proofId: 'p', restoredAt: '2026-07-09T00:00:00.000Z', verified: true, rpoSeconds: 30 },
      now,
      thresholds,
    })).toMatchObject({ verdict: 'ok', reason: 'fresh' });
    expect(evaluateFreshness({
      latest: { proofId: 'p', restoredAt: '2026-05-01T00:00:00.000Z', verified: true, rpoSeconds: 30 },
      now,
      thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'proof_stale' });
  });

  it('degrades a fresh proof whose recorded RPO exceeds budget', () => {
    expect(evaluateFreshness({
      latest: { proofId: 'p', restoredAt: now, verified: true, rpoSeconds: thresholds.maxRpoSeconds + 1 },
      now,
      thresholds,
    })).toMatchObject({ verdict: 'degraded', reason: 'rpo_exceeded' });
  });

  it('fails a future-dated proof instead of clamping it to fresh', () => {
    expect(evaluateFreshness({
      latest: { proofId: 'p', restoredAt: '2026-09-01T00:00:00.000Z', verified: true, rpoSeconds: 0 },
      now,
      thresholds,
    })).toMatchObject({ verdict: 'fail', reason: 'proof_in_future' });
  });

  it('reads the thresholds straight from slo-definitions.json', () => {
    const parsed = readThresholds(sloPath);
    expect(parsed).toEqual(thresholds);
  });

  it('returns null (probe hard-fails) on a missing or malformed SLO file, never permissive defaults', () => {
    expect(readThresholds('/nonexistent/slo-definitions.json')).toBeNull();
  });
});
