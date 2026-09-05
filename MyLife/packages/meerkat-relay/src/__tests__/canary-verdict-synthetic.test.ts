/**
 * Drives the canary-verdict synthetic's pure logic (deploy/observability/synthetics/
 * canary-verdict.mjs, Plan 44 WP-6C).
 *
 * The critical honesty assertions: zero requested checks is a FAIL (never a vacuous
 * pass), a skipped check never lifts the verdict, and the aggregate is the WORST ran
 * check. We also prove the service-spec parser rejects unknown/malformed specs.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- importing the .mjs probe for its exported pure helpers.
import { aggregateVerdict, verdictExitCode, parseServiceSpec } from '../../deploy/observability/synthetics/canary-verdict.mjs';

describe('canary-verdict aggregateVerdict (pure)', () => {
  it('fails hard on zero checks (never a vacuous pass)', () => {
    expect(aggregateVerdict([])).toMatchObject({ verdict: 'fail', reason: 'no_checks_requested' });
  });

  it('fails when every requested check was skipped (nothing actually ran)', () => {
    const checks = [
      { name: 'relay-healthz-shape', verdict: 'skipped', detail: 'no --relay-url requested' },
      { name: 'readyz', verdict: 'skipped', detail: 'no --service requested' },
    ];
    expect(aggregateVerdict(checks)).toMatchObject({ verdict: 'fail', reason: 'no_checks_ran' });
  });

  it('is ok only when every RAN check is ok (skipped does not lift or count as pass)', () => {
    const checks = [
      { name: 'relay-healthz-shape', verdict: 'ok', detail: 'shape_exact' },
      { name: 'readyz:persona', verdict: 'skipped', detail: 'no --service requested' },
    ];
    expect(aggregateVerdict(checks)).toMatchObject({ verdict: 'ok', reason: 'all_ran_checks_ok' });
  });

  it('degrades on any degraded ran check when none failed', () => {
    const checks = [
      { name: 'relay-healthz-shape', verdict: 'ok', detail: 'shape_exact' },
      { name: 'readyz:persona', verdict: 'degraded', detail: 'not_ready' },
    ];
    expect(aggregateVerdict(checks)).toMatchObject({ verdict: 'degraded', reason: 'check_degraded' });
  });

  it('fails closed on an unknown verdict value (never a false green)', () => {
    expect(aggregateVerdict([{ name: 'x', verdict: 'error', detail: 'drifted contract' }])).toMatchObject({
      verdict: 'fail',
      reason: 'check_failed',
    });
  });

  it('takes the WORST verdict: any fail dominates a degraded', () => {
    const checks = [
      { name: 'relay-healthz-shape', verdict: 'degraded', detail: 'missing_cors' },
      { name: 'readyz:humanity', verdict: 'fail', detail: 'unreachable' },
    ];
    expect(aggregateVerdict(checks)).toMatchObject({ verdict: 'fail', reason: 'check_failed' });
  });
});

describe('canary-verdict verdictExitCode (pure)', () => {
  it('maps ok/degraded/fail to 0/1/2', () => {
    expect(verdictExitCode('ok')).toBe(0);
    expect(verdictExitCode('degraded')).toBe(1);
    expect(verdictExitCode('fail')).toBe(2);
    // Anything unknown is treated as a fail exit, never a pass.
    expect(verdictExitCode('nonsense')).toBe(2);
  });
});

describe('canary-verdict parseServiceSpec (pure)', () => {
  it('parses name:host:port and name:host (default port)', () => {
    expect(parseServiceSpec('persona:persona-canary:8894')).toEqual({
      name: 'persona',
      host: 'persona-canary',
      port: 8894,
    });
    expect(parseServiceSpec('humanity:humanity-host')).toEqual({
      name: 'humanity',
      host: 'humanity-host',
      port: 8892,
    });
  });

  it('rejects a spec with extra components instead of truncating it', () => {
    expect(parseServiceSpec('persona:host:8894:garbage')).toBeNull();
  });

  it('rejects an unknown service, a missing host, or a bad port', () => {
    expect(parseServiceSpec('unknown:host:1234')).toBeNull();
    expect(parseServiceSpec('persona')).toBeNull();
    expect(parseServiceSpec('persona:host:0')).toBeNull();
    expect(parseServiceSpec('persona:host:99999')).toBeNull();
  });
});
