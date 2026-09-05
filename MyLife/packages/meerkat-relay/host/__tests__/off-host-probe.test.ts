/**
 * Off-host reachability probe (Plan 20, Phase 5.3). TC-10 / AC-9 / honesty L3.
 *
 * The probe is the ONLY thing that may feed `gateReachability` a "reachable"
 * verdict, and only via a REAL off-host round-trip. These tests inject a fake
 * fetch so the success / failure / timeout / self-answer branches are
 * deterministic (no real network, no real child process), and run the two
 * honesty-critical cases end-to-end THROUGH the real `gateReachability` to prove
 * a NAT-hairpin self-answer can never flip the state to 'reachable'.
 */

import { describe, it, expect, vi } from 'vitest';
import { createOffHostProbe, type ProbeFetch, type ProbeResponse } from '../off-host-probe';
import { gateReachability } from '../reachability';

const PUBLIC_URL = 'wss://abc.trycloudflare.com';
const SERVICE_URL = 'https://reach.example/check';

/** A fake ProbeResponse from an arbitrary JSON body. */
function jsonResponse(body: unknown, opts?: { ok?: boolean; status?: number }): ProbeResponse {
  return {
    ok: opts?.ok ?? true,
    status: opts?.status ?? 200,
    json: async () => body,
  };
}

describe('createOffHostProbe (off-host vantage only)', () => {
  it('a mocked service success returns reachedFromOutside:true vantage:off-host', async () => {
    const fetchImpl: ProbeFetch = vi.fn(async () => jsonResponse({ reached: true, vantage: 'off-host' }));
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    const result = await probe();
    expect(result).toEqual({ reachedFromOutside: true, vantage: 'off-host' });
  });

  it('defaults an absent service vantage to off-host (a real third-party service, not a loopback)', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ reached: true });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    expect(await probe()).toEqual({ reachedFromOutside: true, vantage: 'off-host' });
  });

  it('calls the EXTERNAL service (with the candidate as target), never the host URL itself', async () => {
    const fetchImpl: ProbeFetch = vi.fn(async () => jsonResponse({ reached: true }));
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    await probe();
    const calledWith = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    const u = new URL(calledWith);
    expect(u.host).toBe('reach.example');
    expect(u.searchParams.get('target')).toBe(PUBLIC_URL);
  });

  it('a service that says reached:false returns false', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ reached: false });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'off-host' });
  });

  it('a network failure returns false (never a fabricated reachable)', async () => {
    const fetchImpl: ProbeFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'off-host' });
  });

  it('a non-2xx response returns false', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ reached: true }, { ok: false, status: 502 });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'off-host' });
  });

  it('a malformed service body returns false', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ nope: 1 });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'off-host' });
  });

  it('a timeout aborts the fetch and returns false', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: ProbeFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      const probe = createOffHostProbe({
        publicUrl: PUBLIC_URL,
        serviceUrl: SERVICE_URL,
        fetchImpl,
        timeoutMs: 1000,
      });
      const pending = probe();
      await vi.advanceTimersByTimeAsync(1001);
      expect(await pending).toEqual({ reachedFromOutside: false, vantage: 'off-host' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('honesty: a self-answer / hairpin must NOT pass gateReachability (AC-9)', () => {
  it('a service that reports vantage:self is rejected by gateReachability', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ reached: true, vantage: 'self' });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    // The probe surfaces the self vantage verbatim...
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'self' });
    // ...and the pure gate turns that into 'unverified', never 'reachable'.
    const gated = await gateReachability({ publicUrl: PUBLIC_URL, offHostProbe: probe });
    expect(gated.state).toBe('unverified');
  });

  it('a NAT-hairpin self-fetch (service URL == the candidate host) is flagged self and rejected', async () => {
    // Misconfigured to "probe" the host's own public URL -- a hairpin can answer
    // locally without ever leaving the network. The fetch must never even run.
    const fetchImpl: ProbeFetch = vi.fn(async () => jsonResponse({ reached: true, vantage: 'off-host' }));
    const probe = createOffHostProbe({
      publicUrl: PUBLIC_URL,
      serviceUrl: 'https://abc.trycloudflare.com/check',
      fetchImpl,
    });
    expect(await probe()).toEqual({ reachedFromOutside: false, vantage: 'self' });
    expect(fetchImpl).not.toHaveBeenCalled();
    const gated = await gateReachability({ publicUrl: PUBLIC_URL, offHostProbe: probe });
    expect(gated.state).toBe('unverified');
  });

  it('a genuine off-host success DOES flip gateReachability to reachable', async () => {
    const fetchImpl: ProbeFetch = async () => jsonResponse({ reached: true, vantage: 'off-host' });
    const probe = createOffHostProbe({ publicUrl: PUBLIC_URL, serviceUrl: SERVICE_URL, fetchImpl });
    const gated = await gateReachability({ publicUrl: PUBLIC_URL, offHostProbe: probe });
    expect(gated.state).toBe('reachable');
  });
});
