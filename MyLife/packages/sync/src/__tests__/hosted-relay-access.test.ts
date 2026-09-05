import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostedRelayAccess, isHostedRelayTarget, withHostedRelayAccess } from '../node/hosted-relay-access';
import type { RelayBackend } from '../transport/relay-transport';

const RELAY = 'wss://paid.example/relay';
const API = 'https://api.example';
const NOW = 1_800_000_000_000;
const grant = (token = 'signed-token', expiresAt = NOW + 120_000): Response => new Response(JSON.stringify({
  token, entitlements: { expiresAt: new Date(expiresAt).toISOString() },
}), { status: 200 });

afterEach(() => vi.useRealTimers());

describe('hosted relay access', () => {
  it('scopes credentials to the exact secure endpoint and never calls billing for own servers', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const authorize = vi.fn(() => 'signed-proof');
    const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: API, fetchFn, createAuthorization: authorize });
    for (const target of ['wss://paid.example/other', 'wss://paid.example.evil/relay', 'ws://paid.example/relay', 'wss://paid.example/relay?x=1', 'wss://user@paid.example/relay', 'wss://paid.example/relay#x', 'wss://own.example']) {
      expect(await access.tokenFor(target)).toBeUndefined();
    }
    expect(fetchFn).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(isHostedRelayTarget('wss://PAID.example:443/relay', RELAY)).toBe(true);
    expect(isHostedRelayTarget(RELAY, '')).toBe(false);
  });

  it('coalesces acquisitions, refreshes before expiry and forbids HTTP redirects', async () => {
    let clock = NOW;
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => grant());
    const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: API, fetchFn, createAuthorization: () => 'proof', now: () => clock });
    const first = access.tokenFor(RELAY);
    expect(access.tokenFor(RELAY)).toBe(first);
    expect(await first).toBe('signed-token');
    await access.tokenFor(RELAY);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(`${API}/api/entitlements/meerkat`, expect.objectContaining({
      redirect: 'error', headers: { Authorization: 'Bearer proof' },
    }));
    clock += 60_001;
    await access.tokenFor(RELAY);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('bounds failed acquisition attempts and permits explicit recovery without trusting an old token', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 402 }))
      .mockImplementation(async () => grant());
    const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: API, fetchFn, createAuthorization: () => 'proof', now: () => NOW });
    for (let i = 0; i < 10; i += 1) await expect(access.tokenFor(RELAY)).rejects.toThrow('active hosted plan');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    access.reset();
    await expect(access.tokenFor(RELAY)).resolves.toBe('signed-token');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('refuses expired, missing-expiry, oversized and malformed grants', async () => {
    for (const response of [grant('expired', NOW), new Response('{"token":"no-expiry"}'), grant('x'.repeat(16_385)), new Response('null')]) {
      const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: API, fetchFn: async () => response, createAuthorization: () => 'proof', now: () => NOW });
      await expect(access.tokenFor(RELAY)).rejects.toThrow('no current entitlement');
    }
  });

  it('does not send device authorization to insecure nonlocal API URLs', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: 'http://api.example', fetchFn, createAuthorization: () => 'proof' });
    await expect(access.tokenFor(RELAY)).rejects.toThrow('not configured securely');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not dial after destruction during acquisition or leak supplied credentials to another relay', async () => {
    let release!: (value: string | undefined) => void;
    const pending = new Promise<string | undefined>((resolve) => { release = resolve; });
    const connect = vi.fn<RelayBackend['connect']>();
    const destroy = vi.fn();
    const backend = withHostedRelayAccess({ connect, destroy }, { tokenFor: () => pending, reset: () => {} });
    const waiting = backend.connect(RELAY, 'rendezvous');
    const rejected = expect(waiting).rejects.toThrow('destroyed');
    backend.destroy();
    release('token');
    await rejected;
    expect(connect).not.toHaveBeenCalled();
    const own = withHostedRelayAccess({ connect, destroy }, { tokenFor: async () => undefined, reset: () => {} });
    await own.connect('wss://own.example', 'rendezvous', { entitlementToken: 'must-not-leak' });
    expect(connect).toHaveBeenCalledWith('wss://own.example', 'rendezvous', undefined);
  });
});


it('settles a stalled acquisition even if the fetch ignores abort, without caching a late response', async () => {
  vi.useFakeTimers();
  let release!: (response: Response) => void;
  const fetchFn = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
    .mockImplementation(async () => grant('fresh'));
  const access = createHostedRelayAccess({ relayUrl: RELAY, apiUrl: API, fetchFn, createAuthorization: () => 'proof', now: () => NOW });
  const rejected = expect(access.tokenFor(RELAY)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(10_000);
  await rejected;
  release(grant('late'));
  await Promise.resolve();
  access.reset();
  expect(await access.tokenFor(RELAY)).toBe('fresh');
});
