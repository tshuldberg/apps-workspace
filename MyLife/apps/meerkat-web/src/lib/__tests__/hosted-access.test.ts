import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isFirstPartyHostedRelay,
  relayRequiresHostedPayment,
  startAppUnlockCheckout,
  fetchAppUnlockState,
  redeemAppUnlockLink,
  mintAppUnlockLink,
  setCachedAppUnlock,
  subscribeCachedAppUnlock,
} from '../hosted-access';

const API = 'https://hosted.example';

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe('Meerkat web hosted access', () => {
  it('only treats the configured first-party relay as paid hosted access', () => {
    expect(isFirstPartyHostedRelay(
      'wss://relay.meerkat.example/',
      'wss://relay.meerkat.example',
    )).toBe(true);
    expect(isFirstPartyHostedRelay(
      'wss://self-host.example',
      'wss://relay.meerkat.example',
    )).toBe(false);
  });

  it('does not require payment when no hosted relay URL is configured', () => {
    expect(relayRequiresHostedPayment('wss://self-host.example')).toBe(false);
  });
});

describe('Meerkat web app-unlock rail (Plan 22 Part 1)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('starts a one-time checkout and returns the redirect URL', async () => {
    mockFetch(200, { url: 'https://stripe.example/pay' });
    await expect(startAppUnlockCheckout('tok', 'https://m/ok', 'https://m/no', API)).resolves.toBe('https://stripe.example/pay');
  });

  it('fails closed when no API URL is configured', async () => {
    await expect(startAppUnlockCheckout('tok', 'https://m/ok', 'https://m/no', '')).rejects.toThrow(/not configured/i);
  });

  it('restores the unlock state from the account', async () => {
    mockFetch(200, { unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
    await expect(fetchAppUnlockState('tok', API)).resolves.toEqual({ unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
  });

  it('revalidates a cross-rail grant instead of trusting the local cache', async () => {
    mockFetch(200, { unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z', grant: 'signed.grant' });
    await expect(fetchAppUnlockState('recipient-auth', API, 'signed.grant')).resolves.toMatchObject({
      unlocked: true,
      grant: 'signed.grant',
    });
    expect(fetch).toHaveBeenCalledWith(`${API}/api/entitlements/meerkat-app?grant=signed.grant`, {
      headers: { Authorization: 'Bearer recipient-auth' },
    });
  });

  it('redeems a cross-rail link code for the authenticated recipient and surfaces a locked result honestly', async () => {
    mockFetch(200, { unlocked: false });
    await expect(redeemAppUnlockLink('nope', 'recipient-auth', API)).resolves.toEqual({ unlocked: false });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('?link=nope'), {
      headers: { Authorization: 'Bearer recipient-auth' },
    });
  });

  it('mints a link for an active purchase, and reports no-purchase (402) honestly', async () => {
    mockFetch(200, { code: 'abc', expiresAt: 'later' });
    await expect(mintAppUnlockLink('tok', API)).resolves.toEqual({ code: 'abc', expiresAt: 'later' });
    mockFetch(402, { error: 'no_active_purchase' });
    await expect(mintAppUnlockLink('tok', API)).rejects.toThrow(/no active purchase/i);
  });

  // 2026-08-30: a byte-identical cache write previously fired NO listeners, so a
  // successful Restore that confirmed the already-cached unlock never told the
  // shell, leaving it locked while Settings claimed "Unlocked on this browser."
  it('setCachedAppUnlock notifies listeners even when the write is byte-identical', () => {
    const state = { unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' };
    let calls = 0;
    const unsubscribe = subscribeCachedAppUnlock(() => { calls += 1; });
    try {
      setCachedAppUnlock(state);
      setCachedAppUnlock(state);
      expect(calls).toBe(2);
    } finally {
      unsubscribe();
    }
  });
});
