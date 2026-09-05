import { describe, expect, it } from 'vitest';
import { defaultLivenessProbe } from '..';

/**
 * Non-live unit coverage for the preflight liveness probe. The DB-backed flow
 * (schema check, dry-run, attestation, proof) is covered by the live integration
 * test; here we prove the probe's honest liveness semantics without a network peer.
 */

describe('defaultLivenessProbe', () => {
  it('reports a service as NOT live when the port is unreachable', async () => {
    // Port 1 is reserved and never listening in the sandbox; the probe must not throw.
    const result = await defaultLivenessProbe('http://127.0.0.1:1/healthz');
    expect(result.live).toBe(false);
    expect(result.url).toBe('http://127.0.0.1:1/healthz');
    expect(typeof result.detail).toBe('string');
  });

  it('reports a malformed URL as NOT live rather than throwing', async () => {
    const result = await defaultLivenessProbe('not-a-url');
    expect(result.live).toBe(false);
  });
});
