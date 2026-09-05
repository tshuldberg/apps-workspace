import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  type YearnMembershipActivateDeps,
  type YearnMembershipSupabaseClient,
} from '../index.ts';
import {
  verifyYearnBoostTransaction,
  type YearnBoostVerificationResult,
} from '../../yearn-boost-activate/verify.ts';
import {
  createTestCertificateChain,
  signTestTransaction,
  validTransactionPayload,
} from '../../yearn-boost-activate/__tests__/fixtures.ts';

const BUNDLE_ID = 'com.mylife.yearn';
const MEMBERSHIP_PRODUCT = 'com.mylife.yearn.membership';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ACCESS_TOKEN = 'signed-user-jwt';
const NOW = new Date('2026-07-30T12:00:00.000Z');
const FUTURE_MS = NOW.getTime() + 30 * 24 * 3600 * 1000;
const PAST_MS = NOW.getTime() - 24 * 3600 * 1000;

interface HarnessOptions {
  authUserId?: string | null;
  envOverrides?: Record<string, string | undefined>;
  rpcError?: unknown;
  verification?: YearnBoostVerificationResult;
}

function validVerification(
  overrides: Partial<Extract<YearnBoostVerificationResult, { valid: true }>> = {},
): YearnBoostVerificationResult {
  return {
    valid: true,
    originalTransactionId: 'orig-membership-1',
    transactionId: 'txn-membership-1',
    appAccountToken: USER_ID,
    environment: 'production',
    expiresDate: FUTURE_MS,
    ...overrides,
  };
}

function makeRequest(
  body: unknown,
  options: { authorization?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const authorization = options.authorization === undefined
    ? `Bearer ${ACCESS_TOKEN}`
    : options.authorization;
  if (authorization) headers.set('Authorization', authorization);
  return new Request('http://localhost/functions/v1/yearn-membership-activate', {
    method: options.method ?? 'POST',
    headers,
    body: options.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function createHarness(options: HarnessOptions = {}) {
  const authGetUser = vi.fn().mockResolvedValue({
    data: {
      user: options.authUserId === null ? null : { id: options.authUserId ?? USER_ID },
    },
    error: null,
  });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: options.rpcError ?? null });
  const schema = vi.fn().mockReturnValue({ rpc });
  const client: YearnMembershipSupabaseClient = {
    auth: { getUser: authGetUser },
    schema,
  };
  const createClient = vi.fn().mockReturnValue(client);
  const env: Record<string, string | undefined> = {
    YEARN_APPSTORE_BUNDLE_ID: BUNDLE_ID,
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ...options.envOverrides,
  };
  const verifyTransaction = vi.fn().mockResolvedValue(
    options.verification ?? validVerification(),
  );
  const deps: YearnMembershipActivateDeps = {
    env: (key) => env[key],
    createClient,
    verifyTransaction,
    now: () => NOW,
  };
  return { deps, rpc, schema, verifyTransaction };
}

describe('yearn-membership-activate', () => {
  it('fails closed with 503 when configuration is missing', async () => {
    const { deps } = createHarness({ envOverrides: { YEARN_APPSTORE_BUNDLE_ID: undefined } });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(503);
  });

  it('requires an authenticated caller', async () => {
    const { deps, rpc } = createHarness({ authUserId: null });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('verifies with the subscription type and membership product', async () => {
    const { deps, verifyTransaction } = createHarness();
    await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(verifyTransaction).toHaveBeenCalledWith('jws', expect.objectContaining({
      expectedBundleId: BUNDLE_ID,
      expectedProductId: MEMBERSHIP_PRODUCT,
      expectedType: 'Auto-Renewable Subscription',
    }));
  });

  it('passes verifier rejections through and performs no write', async () => {
    const { deps, rpc } = createHarness({
      verification: { valid: false, reason: 'wrong_product' },
    });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'wrong_product' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects sandbox transactions unless explicitly allowed', async () => {
    const { deps, rpc } = createHarness({
      verification: validVerification({ environment: 'sandbox' }),
    });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'sandbox_not_allowed' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a transaction without appAccountToken (binding is required)', async () => {
    const { deps, rpc } = createHarness({
      verification: validVerification({ appAccountToken: undefined }),
    });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'account_mismatch' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a token bound to another user', async () => {
    const { deps, rpc } = createHarness({
      verification: validVerification({ appAccountToken: OTHER_USER_ID }),
    });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'account_mismatch' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records an active entitlement and answers with server truth', async () => {
    const { deps, rpc, schema } = createHarness();
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(200);
    expect(schema).toHaveBeenCalledWith('yearn');
    expect(rpc).toHaveBeenCalledWith('upsert_entitlement', {
      p_user_id: USER_ID,
      p_product_id: MEMBERSHIP_PRODUCT,
      p_original_transaction_id: 'orig-membership-1',
      p_status: 'active',
      p_environment: 'Production',
      p_expires_at: new Date(FUTURE_MS).toISOString(),
    });
    await expect(response.json()).resolves.toEqual({
      status: 'active',
      expiresAt: new Date(FUTURE_MS).toISOString(),
      isMember: true,
    });
  });

  it('records an already-expired transaction honestly as expired', async () => {
    const { deps, rpc } = createHarness({
      verification: validVerification({ expiresDate: PAST_MS }),
    });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'upsert_entitlement',
      expect.objectContaining({ p_status: 'expired' }),
    );
    await expect(response.json()).resolves.toMatchObject({ isMember: false });
  });

  it('maps an entitlement write failure to 500', async () => {
    const { deps } = createHarness({ rpcError: { message: 'db down' } });
    const response = await handleRequest(makeRequest({ signedTransaction: 'jws' }), deps);
    expect(response.status).toBe(500);
  });
});

describe('verify.ts subscription support (real chain fixtures)', () => {
  it('accepts a signed subscription transaction and extracts expiresDate', async () => {
    const chain = await createTestCertificateChain({
      notBefore: '20250101000000Z',
      notAfter: '20300101000000Z',
    });
    const payload = {
      ...validTransactionPayload({}),
      productId: MEMBERSHIP_PRODUCT,
      type: 'Auto-Renewable Subscription',
      appAccountToken: USER_ID,
      expiresDate: FUTURE_MS,
    };
    const signed = await signTestTransaction(chain, payload);
    const result = await verifyYearnBoostTransaction(signed, {
      expectedBundleId: BUNDLE_ID,
      expectedProductId: MEMBERSHIP_PRODUCT,
      expectedType: 'Auto-Renewable Subscription',
      trustedRootDer: chain.root.certificateDer,
      now: NOW,
    });
    expect(result).toMatchObject({
      valid: true,
      appAccountToken: USER_ID,
      expiresDate: FUTURE_MS,
    });
  });

  it('rejects a subscription-typed check against a consumable transaction', async () => {
    const chain = await createTestCertificateChain({
      notBefore: '20250101000000Z',
      notAfter: '20300101000000Z',
    });
    const signed = await signTestTransaction(chain, {
      ...validTransactionPayload({}),
      productId: MEMBERSHIP_PRODUCT,
      appAccountToken: USER_ID,
    });
    const result = await verifyYearnBoostTransaction(signed, {
      expectedBundleId: BUNDLE_ID,
      expectedProductId: MEMBERSHIP_PRODUCT,
      expectedType: 'Auto-Renewable Subscription',
      trustedRootDer: chain.root.certificateDer,
      now: NOW,
    });
    expect(result).toEqual({ valid: false, reason: 'not_consumable' });
  });

  it('rejects a subscription transaction without expiresDate', async () => {
    const chain = await createTestCertificateChain({
      notBefore: '20250101000000Z',
      notAfter: '20300101000000Z',
    });
    const signed = await signTestTransaction(chain, {
      ...validTransactionPayload({}),
      productId: MEMBERSHIP_PRODUCT,
      type: 'Auto-Renewable Subscription',
      appAccountToken: USER_ID,
    });
    const result = await verifyYearnBoostTransaction(signed, {
      expectedBundleId: BUNDLE_ID,
      expectedProductId: MEMBERSHIP_PRODUCT,
      expectedType: 'Auto-Renewable Subscription',
      trustedRootDer: chain.root.certificateDer,
      now: NOW,
    });
    expect(result).toEqual({ valid: false, reason: 'malformed_jws' });
  });
});
