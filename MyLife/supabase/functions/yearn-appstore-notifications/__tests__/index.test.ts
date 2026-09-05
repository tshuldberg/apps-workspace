import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  statusForNotification,
  type YearnNotificationsDeps,
  type YearnNotificationsSupabaseClient,
} from '../index.ts';
import type { AppleSignedJwsResult } from '../../yearn-boost-activate/verify.ts';

const BUNDLE_ID = 'com.mylife.yearn';
const MEMBERSHIP_PRODUCT = 'com.mylife.yearn.membership';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-07-30T12:00:00.000Z');
const FUTURE_MS = NOW.getTime() + 300 * 24 * 3600 * 1000;

interface HarnessOptions {
  envOverrides?: Record<string, string | undefined>;
  /** Payloads keyed by JWS input string; unknown inputs are invalid. */
  jwsPayloads?: Record<string, Record<string, unknown>>;
  lookupUserId?: string | null;
  upsertError?: unknown;
}

function transactionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    bundleId: BUNDLE_ID,
    productId: MEMBERSHIP_PRODUCT,
    type: 'Auto-Renewable Subscription',
    originalTransactionId: 'orig-membership-1',
    transactionId: 'txn-membership-2',
    appAccountToken: USER_ID,
    environment: 'Production',
    expiresDate: FUTURE_MS,
    ...overrides,
  };
}

function envelopePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    notificationType: 'DID_RENEW',
    data: {
      bundleId: BUNDLE_ID,
      signedTransactionInfo: 'inner-jws',
    },
    ...overrides,
  };
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/functions/v1/yearn-appstore-notifications', {
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function createHarness(options: HarnessOptions = {}) {
  const payloads = options.jwsPayloads ?? {
    'outer-jws': envelopePayload(),
    'inner-jws': transactionPayload(),
  };
  const verifyJws = vi.fn().mockImplementation(
    (jws: string): Promise<AppleSignedJwsResult> =>
      Promise.resolve(
        payloads[jws]
          ? { valid: true, payload: payloads[jws]! }
          : { valid: false, reason: 'bad_signature' },
      ),
  );
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'entitlement_user_for_transaction') {
      return Promise.resolve({
        data: options.lookupUserId === undefined ? null : options.lookupUserId,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: options.upsertError ?? null });
  });
  const schema = vi.fn().mockReturnValue({ rpc });
  const client: YearnNotificationsSupabaseClient = { schema };
  const env: Record<string, string | undefined> = {
    YEARN_APPSTORE_BUNDLE_ID: BUNDLE_ID,
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ...options.envOverrides,
  };
  const deps: YearnNotificationsDeps = {
    env: (key) => env[key],
    createClient: vi.fn().mockReturnValue(client),
    verifyJws,
    now: () => NOW,
  };
  return { deps, rpc, verifyJws };
}

describe('statusForNotification', () => {
  it('revokes on refund and revoke regardless of expiry', () => {
    expect(statusForNotification('REFUND', null, FUTURE_MS, NOW.getTime())).toBe('revoked');
    expect(statusForNotification('REVOKE', null, FUTURE_MS, NOW.getTime())).toBe('revoked');
  });

  it('expires on explicit expiration events', () => {
    expect(statusForNotification('EXPIRED', 'VOLUNTARY', FUTURE_MS, NOW.getTime())).toBe('expired');
    expect(statusForNotification('GRACE_PERIOD_EXPIRED', null, FUTURE_MS, NOW.getTime())).toBe(
      'expired',
    );
  });

  it('grants grace during a failed renewal grace period', () => {
    expect(statusForNotification('DID_FAIL_TO_RENEW', 'GRACE_PERIOD', null, NOW.getTime())).toBe(
      'grace',
    );
  });

  it('derives active/expired from expiry otherwise', () => {
    expect(statusForNotification('DID_RENEW', null, FUTURE_MS, NOW.getTime())).toBe('active');
    expect(statusForNotification('SUBSCRIBED', null, NOW.getTime() - 1, NOW.getTime())).toBe(
      'expired',
    );
    expect(statusForNotification('SUBSCRIBED', null, null, NOW.getTime())).toBe('expired');
  });
});

describe('yearn-appstore-notifications', () => {
  it('fails closed with 503 when unconfigured', async () => {
    const { deps } = createHarness({ envOverrides: { SUPABASE_SERVICE_ROLE_KEY: undefined } });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(503);
  });

  it('rejects an unverifiable envelope', async () => {
    const { deps, rpc } = createHarness();
    const response = await handleRequest(makeRequest({ signedPayload: 'forged-jws' }), deps);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'bad_signature' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('acknowledges TEST notifications without a transaction', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': { notificationType: 'TEST', data: { bundleId: BUNDLE_ID } },
      },
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: 'no_transaction' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a transaction for a different bundle', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload({ data: { signedTransactionInfo: 'inner-jws' } }),
        'inner-jws': transactionPayload({ bundleId: 'com.evil.app' }),
      },
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('acknowledges non-membership products without writing', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload({ notificationType: 'ONE_TIME_CHARGE' }),
        'inner-jws': transactionPayload({ productId: 'com.mylife.yearn.boost' }),
      },
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: 'product' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('acknowledges sandbox notifications without writing unless allowed', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload(),
        'inner-jws': transactionPayload({ environment: 'Sandbox' }),
      },
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: 'sandbox' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records a renewal as active via the account binding', async () => {
    const { deps, rpc } = createHarness();
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('upsert_entitlement', {
      p_user_id: USER_ID,
      p_product_id: MEMBERSHIP_PRODUCT,
      p_original_transaction_id: 'orig-membership-1',
      p_status: 'active',
      p_environment: 'Production',
      p_expires_at: new Date(FUTURE_MS).toISOString(),
    });
  });

  it('records a refund as revoked', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload({ notificationType: 'REFUND' }),
        'inner-jws': transactionPayload(),
      },
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'upsert_entitlement',
      expect.objectContaining({ p_status: 'revoked' }),
    );
  });

  it('resolves the user by original transaction id when the binding is absent', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload(),
        'inner-jws': transactionPayload({ appAccountToken: undefined }),
      },
      lookupUserId: USER_ID,
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('entitlement_user_for_transaction', {
      p_original_transaction_id: 'orig-membership-1',
    });
    expect(rpc).toHaveBeenCalledWith(
      'upsert_entitlement',
      expect.objectContaining({ p_user_id: USER_ID }),
    );
  });

  it('acknowledges an unattributable notification without writing', async () => {
    const { deps, rpc } = createHarness({
      jwsPayloads: {
        'outer-jws': envelopePayload(),
        'inner-jws': transactionPayload({ appAccountToken: undefined }),
      },
      lookupUserId: null,
    });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: 'no_user' });
    expect(rpc).not.toHaveBeenCalledWith('upsert_entitlement', expect.anything());
  });

  it('returns 500 on a write failure so Apple retries', async () => {
    const { deps } = createHarness({ upsertError: { message: 'db down' } });
    const response = await handleRequest(makeRequest({ signedPayload: 'outer-jws' }), deps);
    expect(response.status).toBe(500);
  });
});
