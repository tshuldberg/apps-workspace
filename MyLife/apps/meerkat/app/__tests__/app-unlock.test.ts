import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createRevenueCatAppUserId,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';

// react-native + react-native-purchases are native; mock them so the wrapper is
// testable in the Node env (mirrors the "only this module imports the SDK" contract).
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const { configure, setLogLevel, getProducts, purchaseStoreProduct, restorePurchases, getAppUserID } = vi.hoisted(() => ({
  configure: vi.fn(),
  setLogLevel: vi.fn(),
  getProducts: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  restorePurchases: vi.fn(),
  getAppUserID: vi.fn(),
}));

vi.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure, setLogLevel, getProducts, purchaseStoreProduct, restorePurchases, getAppUserID },
  LOG_LEVEL: { WARN: 'WARN' },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  __resetAppUnlockStateForTest,
  ensurePurchasesConfigured,
  getUnlockPriceLabel,
  mintMobileAppUnlockLink,
  publicPurchaseEnv,
  purchaseAppUnlock,
  resolveRevenueCatKey,
  restoreAppUnlock,
  unlockFromCustomerInfo,
  validateLinkedAppUnlock,
} from '../(root)/data/app-unlock';

const UNLOCK_ID = 'meerkat_app_unlock';
let identity: DeviceIdentity;
let subject: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  identity = generateDeviceIdentity('Billing test');
  subject = createRevenueCatAppUserId(identity);
  __resetAppUnlockStateForTest();
  vi.clearAllMocks();
});

describe('resolveRevenueCatKey', () => {
  it('is unavailable with no key', () => {
    expect(resolveRevenueCatKey({}, 'ios')).toEqual({ ok: false, error: expect.any(String) });
  });
  it('rejects a wrong-store prefix', () => {
    const r = resolveRevenueCatKey({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'goog_x' }, 'ios');
    expect(r.ok).toBe(false);
  });
  it('accepts a matching key', () => {
    expect(resolveRevenueCatKey({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' }, 'ios')).toEqual({ ok: true, apiKey: 'appl_abc' });
  });
});

describe('ensurePurchasesConfigured (fail closed)', () => {
  it('stays unconfigured with no key', () => {
    expect(ensurePurchasesConfigured({}, 'ios', identity)).toMatchObject({ configured: false });
    expect(configure).not.toHaveBeenCalled();
  });
  it('stays unconfigured until the device identity is ready', () => {
    expect(ensurePurchasesConfigured({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' }, 'ios')).toMatchObject({ configured: false });
    expect(configure).not.toHaveBeenCalled();
  });
  it('configures once with a valid key', () => {
    expect(ensurePurchasesConfigured({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' }, 'ios', identity)).toMatchObject({ configured: true });
    ensurePurchasesConfigured({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' }, 'ios', identity);
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({ apiKey: 'appl_abc', appUserID: subject });
  });
  it('refuses an identity change after configuration', () => {
    ensurePurchasesConfigured({ EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' }, 'ios', identity);
    const other = generateDeviceIdentity('Other billing test');
    expect(ensurePurchasesConfigured(
      { EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' },
      'ios',
      other,
    )).toMatchObject({ configured: false });
    expect(configure).toHaveBeenCalledTimes(1);
  });
});

describe('publicPurchaseEnv (release-bundle inlining contract)', () => {
  it('reads the RC keys at call time', () => {
    vi.stubEnv('EXPO_PUBLIC_MEERKAT_RC_KEY_IOS', 'appl_calltime');
    expect(publicPurchaseEnv().EXPO_PUBLIC_MEERKAT_RC_KEY_IOS).toBe('appl_calltime');
    vi.unstubAllEnvs();
  });

  // babel-preset-expo inlines ONLY literal `process.env.EXPO_PUBLIC_NAME` member
  // expressions into a release bundle; a captured process.env object yields
  // undefined in TestFlight/production, silently disabling the purchase rail.
  // Guard the source so the pattern cannot regress.
  it('never captures the process.env object for EXPO_PUBLIC reads', () => {
    const source = readFileSync(join(__dirname, '..', '(root)', 'data', 'app-unlock.ts'), 'utf8');
    expect(source).not.toMatch(/=\s*process\.env as/u);
    expect(source).toContain('process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS');
    expect(source).toContain('process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID');
  });
});

describe('unlockFromCustomerInfo (real receipt derivation)', () => {
  it('unlocks on a real non-subscription transaction for the unlock product', () => {
    const info = {
      nonSubscriptionTransactions: [{ productIdentifier: UNLOCK_ID, purchaseDate: '2026-07-06T00:00:00.000Z' }],
    } as never;
    expect(unlockFromCustomerInfo(info)).toEqual({ unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' });
  });
  it('stays locked for empty or unrelated purchases', () => {
    expect(unlockFromCustomerInfo({ nonSubscriptionTransactions: [] } as never)).toEqual({ unlocked: false, purchaseDate: null });
    expect(
      unlockFromCustomerInfo({ nonSubscriptionTransactions: [{ productIdentifier: 'mylife_books_unlock', purchaseDate: 'x' }] } as never),
    ).toEqual({ unlocked: false, purchaseDate: null });
  });
});

describe('purchase + restore', () => {
  const cfgEnv = { EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_abc' };

  it('fails closed (not configured) without a key', async () => {
    process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS = '';
    const r = await purchaseAppUnlock(identity);
    expect(r.ok).toBe(false);
  });

  it('unlocks after a real store purchase', async () => {
    ensurePurchasesConfigured(cfgEnv, 'ios', identity);
    getProducts.mockResolvedValue([{ identifier: UNLOCK_ID, priceString: '$4.99' }]);
    purchaseStoreProduct.mockResolvedValue({
      customerInfo: { nonSubscriptionTransactions: [{ productIdentifier: UNLOCK_ID, purchaseDate: '2026-07-06T00:00:00.000Z' }] },
    });
    const r = await purchaseAppUnlock(identity);
    expect(r).toEqual({ ok: true, unlock: { unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' } });
  });

  it('treats a user cancellation as a soft dismissal', async () => {
    ensurePurchasesConfigured(cfgEnv, 'ios', identity);
    getProducts.mockResolvedValue([{ identifier: UNLOCK_ID, priceString: '$4.99' }]);
    purchaseStoreProduct.mockRejectedValue({ userCancelled: true });
    expect(await purchaseAppUnlock(identity)).toEqual({ ok: false, cancelled: true });
  });

  it('reads the store price string', async () => {
    ensurePurchasesConfigured(cfgEnv, 'ios', identity);
    getProducts.mockResolvedValue([{ identifier: UNLOCK_ID, priceString: '£3.99' }]);
    expect(await getUnlockPriceLabel(identity)).toEqual({ ok: true, priceLabel: '£3.99' });
  });

  it('restore unlocks from a real prior purchase', async () => {
    ensurePurchasesConfigured(cfgEnv, 'ios', identity);
    restorePurchases.mockResolvedValue({ nonSubscriptionTransactions: [{ productIdentifier: UNLOCK_ID, purchaseDate: '2026-07-06T00:00:00.000Z' }] });
    expect(await restoreAppUnlock(identity)).toEqual({ ok: true, unlock: { unlocked: true, purchaseDate: '2026-07-06T00:00:00.000Z' } });
  });
});

describe('mintMobileAppUnlockLink', () => {
  const previousKey = process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS = 'appl_abc';
    getAppUserID.mockResolvedValue(subject);
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_MEERKAT_RC_KEY_IOS = previousKey;
  });

  it('binds the RevenueCat customer to a device-signed hosted request', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/u) });
      expect(JSON.parse(String(init?.body))).toEqual({ rail: 'storekit', receipt: subject });
      return new Response(JSON.stringify({ code: 'MK-123', expiresAt: '2026-07-09T12:10:00.000Z' }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(mintMobileAppUnlockLink(identity, 'https://api.meerkat.test/', fetchImpl)).resolves.toEqual({
      ok: true,
      code: 'MK-123',
      expiresAt: '2026-07-09T12:10:00.000Z',
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.meerkat.test/api/link/meerkat-app', expect.any(Object));
  });

  it('refuses a mismatched RevenueCat customer before network access', async () => {
    getAppUserID.mockResolvedValue('cd'.repeat(32));
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(mintMobileAppUnlockLink(identity, 'https://api.meerkat.test', fetchImpl)).resolves.toEqual({
      ok: false,
      error: 'The store purchase identity does not match this device.',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('validateLinkedAppUnlock', () => {
  it('binds a server grant to the device-signed recipient request', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.meerkat.test/api/entitlements/meerkat-app?grant=signed.grant');
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/u),
      });
      return new Response(JSON.stringify({
        unlocked: true,
        purchaseDate: '2026-07-09T00:00:00.000Z',
        grant: 'signed.grant',
      }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(validateLinkedAppUnlock(
      identity,
      'https://api.meerkat.test/',
      'signed.grant',
      fetchImpl,
    )).resolves.toEqual({
      ok: true,
      unlock: { unlocked: true, purchaseDate: '2026-07-09T00:00:00.000Z' },
      grant: 'signed.grant',
    });
  });

  it('fails closed when the source purchase has been revoked or the service is unavailable', async () => {
    const revoked = vi.fn(async () => new Response(JSON.stringify({
      unlocked: false,
      purchaseDate: null,
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(validateLinkedAppUnlock(identity, 'https://api.meerkat.test', 'grant', revoked))
      .resolves.toMatchObject({ ok: true, unlock: { unlocked: false } });
    const unavailable = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(validateLinkedAppUnlock(identity, 'https://api.meerkat.test', 'grant', unavailable))
      .resolves.toMatchObject({ ok: false });
  });
});
