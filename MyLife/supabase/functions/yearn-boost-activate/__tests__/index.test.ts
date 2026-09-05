import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  type YearnBoostActivateDeps,
  type YearnBoostCreateClient,
  type YearnBoostSupabaseClient,
} from '../index.ts';
import {
  verifyYearnBoostTransaction,
  type YearnBoostVerificationReason,
} from '../verify.ts';
import {
  createTestCertificateChain,
  signTestTransaction,
  validTransactionPayload,
  type TestCertificateChain,
} from './fixtures.ts';

const BUNDLE_ID = 'com.mylife.yearn';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ORIGINAL_TRANSACTION_ID = '1000000123456789';
const TRANSACTION_ID = '2000000123456789';
const EXPIRES_AT = '2026-07-19T12:00:00.000Z';
const ACCESS_TOKEN = 'signed-user-jwt';
const ANON_KEY = 'anon-key';
const SERVICE_ROLE_KEY = 'service-role-key';
const NOW = new Date('2026-07-12T12:00:00.000Z');

interface SignedTransactionFixture {
  chain: TestCertificateChain;
  signedTransaction: string;
}

interface HarnessOptions {
  authError?: unknown;
  authUserId?: string | null;
  envOverrides?: Record<string, string | undefined>;
  now?: Date;
  rpcData?: unknown;
  rpcError?: unknown;
  trustedRootDer?: Uint8Array;
  verifyTransaction?: YearnBoostActivateDeps['verifyTransaction'];
}

function generalizedTime(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  const second = String(value.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}Z`;
}

async function createSignedTransaction(
  payloadOverrides: Record<string, unknown> = {},
  certificateOptions: { notAfter?: Date; notBefore?: Date } = {},
): Promise<SignedTransactionFixture> {
  const chain = await createTestCertificateChain({
    notBefore: generalizedTime(
      certificateOptions.notBefore ?? new Date('2025-01-01T00:00:00.000Z'),
    ),
    notAfter: generalizedTime(
      certificateOptions.notAfter ?? new Date('2030-01-01T00:00:00.000Z'),
    ),
  });
  const payload = {
    ...validTransactionPayload({
      originalTransactionId: ORIGINAL_TRANSACTION_ID,
      transactionId: TRANSACTION_ID,
    }),
    // The server now REQUIRES the account binding; the default fixture
    // carries it so unrelated tests exercise the happy path.
    appAccountToken: USER_ID,
    ...payloadOverrides,
  };
  return {
    chain,
    signedTransaction: await signTestTransaction(chain, payload),
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
  return new Request('http://localhost/functions/v1/yearn-boost-activate', {
    method: options.method ?? 'POST',
    headers,
    body: options.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function createHarness(options: HarnessOptions = {}) {
  const authGetUser = vi.fn().mockResolvedValue({
    data: { user: options.authUserId === null ? null : { id: options.authUserId ?? USER_ID } },
    error: options.authError ?? null,
  });
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcData ?? [{ expires_at: EXPIRES_AT, duplicate: false }],
    error: options.rpcError ?? null,
  });
  const schema = vi.fn((name: string) => {
    if (name !== 'yearn') throw new Error(`Unexpected schema ${name}.`);
    return { rpc };
  });
  const unusedSchema = vi.fn(() => ({ rpc: vi.fn() }));
  const anonClient: YearnBoostSupabaseClient = {
    auth: { getUser: authGetUser },
    schema: unusedSchema,
  };
  const serviceClient: YearnBoostSupabaseClient = {
    auth: { getUser: vi.fn() },
    schema,
  };
  const createClient = vi.fn(
    (_url: string, key: string): YearnBoostSupabaseClient => {
      if (key === ANON_KEY) return anonClient;
      if (key === SERVICE_ROLE_KEY) return serviceClient;
      throw new Error(`Unexpected Supabase key ${key}.`);
    },
  );
  const environment: Record<string, string | undefined> = {
    YEARN_APPSTORE_BUNDLE_ID: BUNDLE_ID,
    SUPABASE_URL: 'https://yearn.example.supabase.co',
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    ...options.envOverrides,
  };
  const verifyTransaction = options.verifyTransaction ?? (
    (signedTransaction, verifyOptions) => verifyYearnBoostTransaction(signedTransaction, {
      ...verifyOptions,
      trustedRootDer: options.trustedRootDer,
    })
  );
  const deps: YearnBoostActivateDeps = {
    env: (key) => environment[key],
    createClient: createClient as unknown as YearnBoostCreateClient,
    verifyTransaction,
    now: () => options.now ?? NOW,
  };
  return { authGetUser, createClient, deps, rpc, schema };
}

async function fixtureForReason(reason: YearnBoostVerificationReason): Promise<{
  signedTransaction: string;
  trustedRootDer: Uint8Array;
}> {
  if (reason === 'malformed_jws') {
    return { signedTransaction: 'not-a-jws', trustedRootDer: new Uint8Array([1]) };
  }
  if (reason === 'bad_chain') {
    const signed = await createSignedTransaction();
    const unrelatedChain = await createTestCertificateChain({
      rootCommonName: 'Unrelated Test Root',
    });
    return {
      signedTransaction: signed.signedTransaction,
      trustedRootDer: unrelatedChain.root.certificateDer,
    };
  }
  if (reason === 'bad_signature') {
    const chain = await createTestCertificateChain();
    const unrelatedChain = await createTestCertificateChain({
      leafCommonName: 'Unrelated Signer',
    });
    const signedTransaction = await signTestTransaction(
      chain,
      validTransactionPayload({
        originalTransactionId: ORIGINAL_TRANSACTION_ID,
        transactionId: TRANSACTION_ID,
      }),
      { privateKey: unrelatedChain.leaf.privateKey },
    );
    return {
      signedTransaction,
      trustedRootDer: chain.root.certificateDer,
    };
  }
  if (reason === 'expired_cert') {
    const signed = await createSignedTransaction({}, {
      notBefore: new Date('2020-01-01T00:00:00.000Z'),
      notAfter: new Date('2021-01-01T00:00:00.000Z'),
    });
    return {
      signedTransaction: signed.signedTransaction,
      trustedRootDer: signed.chain.root.certificateDer,
    };
  }

  const payloadByReason: Record<
    Exclude<YearnBoostVerificationReason, 'malformed_jws' | 'bad_chain' | 'bad_signature' | 'expired_cert'>,
    Record<string, unknown>
  > = {
    wrong_bundle: { bundleId: 'com.example.imposter' },
    wrong_product: { productId: 'com.mylife.yearn.membership' },
    revoked: { revocationDate: Date.parse('2026-07-01T00:00:00.000Z') },
    not_consumable: { type: 'Auto-Renewable Subscription' },
  };
  const signed = await createSignedTransaction(payloadByReason[reason]);
  return {
    signedTransaction: signed.signedTransaction,
    trustedRootDer: signed.chain.root.certificateDer,
  };
}

describe('handleRequest', () => {
  it.each([
    'YEARN_APPSTORE_BUNDLE_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])('returns 503 and performs no external calls when %s is missing', async (missingKey) => {
    const harness = createHarness({ envOverrides: { [missingKey]: undefined } });

    const response = await handleRequest(makeRequest({ signedTransaction: 'ignored' }), harness.deps);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'not_configured' });
    expect(harness.createClient).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('returns 405 for non-POST requests', async () => {
    const harness = createHarness();

    const response = await handleRequest(makeRequest(null, { method: 'GET' }), harness.deps);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: 'method_not_allowed' });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const harness = createHarness();
    const request = new Request('http://localhost/functions/v1/yearn-boost-activate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    });

    const response = await handleRequest(request, harness.deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'malformed_body' });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it('returns 400 when signedTransaction is absent', async () => {
    const harness = createHarness();

    const response = await handleRequest(makeRequest({}), harness.deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'malformed_body' });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token is absent', async () => {
    const harness = createHarness();

    const response = await handleRequest(
      makeRequest({ signedTransaction: 'ignored' }, { authorization: null }),
      harness.deps,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(harness.createClient).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('returns 401 and performs no write when auth.getUser cannot resolve the caller', async () => {
    const harness = createHarness({ authUserId: null });

    const response = await handleRequest(
      makeRequest({ signedTransaction: 'ignored' }),
      harness.deps,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(harness.authGetUser).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it.each<YearnBoostVerificationReason>([
    'malformed_jws',
    'bad_chain',
    'bad_signature',
    'wrong_bundle',
    'wrong_product',
    'revoked',
    'expired_cert',
    'not_consumable',
  ])('returns 400 for verifier reason %s and performs no write', async (reason) => {
    const fixture = await fixtureForReason(reason);
    const harness = createHarness({ trustedRootDer: fixture.trustedRootDer });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: reason });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the verifier throws unexpectedly', async () => {
    const verifyTransaction = vi.fn().mockRejectedValue(new Error('verification unavailable'));
    const harness = createHarness({ verifyTransaction });

    const response = await handleRequest(
      makeRequest({ signedTransaction: 'signed-transaction' }),
      harness.deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'malformed_jws' });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('rejects sandbox boosts by default and performs no write', async () => {
    const fixture = await createSignedTransaction({ environment: 'Sandbox' });
    const harness = createHarness({ trustedRootDer: fixture.chain.root.certificateDer });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'sandbox_not_allowed' });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('allows sandbox boosts only when YEARN_ALLOW_SANDBOX_BOOST is exactly true', async () => {
    const fixture = await createSignedTransaction({ environment: 'Sandbox' });
    const harness = createHarness({
      envOverrides: { YEARN_ALLOW_SANDBOX_BOOST: 'true' },
      trustedRootDer: fixture.chain.root.certificateDer,
    });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expiresAt: EXPIRES_AT, duplicate: false });
    expect(harness.rpc).toHaveBeenCalledWith('activate_boost_validated', {
      p_user_id: USER_ID,
      p_original_transaction_id: TRANSACTION_ID,
      p_environment: 'sandbox',
    });
  });

  it('rejects an appAccountToken bound to another user and performs no write', async () => {
    const fixture = await createSignedTransaction({ appAccountToken: OTHER_USER_ID });
    const harness = createHarness({ trustedRootDer: fixture.chain.root.certificateDer });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'account_mismatch' });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('uses the authenticated user and per-purchase transaction id for activation', async () => {
    const fixture = await createSignedTransaction({ appAccountToken: USER_ID });
    const harness = createHarness({ trustedRootDer: fixture.chain.root.certificateDer });

    const response = await handleRequest(makeRequest({
      signedTransaction: fixture.signedTransaction,
      userId: 'attacker-controlled-user',
      originalTransactionId: 'attacker-controlled-original-transaction',
      transactionId: 'attacker-controlled-transaction',
    }), harness.deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expiresAt: EXPIRES_AT, duplicate: false });
    expect(harness.schema).toHaveBeenCalledWith('yearn');
    expect(harness.rpc).toHaveBeenCalledWith('activate_boost_validated', {
      p_user_id: USER_ID,
      p_original_transaction_id: TRANSACTION_ID,
      p_environment: 'production',
    });
  });

  it('rejects signed transactions without appAccountToken (binding is required)', async () => {
    const fixture = await createSignedTransaction({ appAccountToken: undefined });
    const harness = createHarness({ trustedRootDer: fixture.chain.root.certificateDer });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'account_mismatch' });
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('passes an idempotent duplicate result through to the client', async () => {
    const fixture = await createSignedTransaction();
    const harness = createHarness({
      trustedRootDer: fixture.chain.root.certificateDer,
      rpcData: [{ expires_at: EXPIRES_AT, duplicate: true }],
    });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expiresAt: EXPIRES_AT, duplicate: true });
    expect(harness.rpc).toHaveBeenCalledOnce();
  });

  it('returns activation_failed when the service-role RPC fails', async () => {
    const fixture = await createSignedTransaction();
    const harness = createHarness({
      trustedRootDer: fixture.chain.root.certificateDer,
      rpcError: { message: 'database unavailable' },
    });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'activation_failed' });
  });

  it('returns activation_failed for a malformed RPC response', async () => {
    const fixture = await createSignedTransaction();
    const harness = createHarness({
      trustedRootDer: fixture.chain.root.certificateDer,
      rpcData: [{ expires_at: null, duplicate: false }],
    });

    const response = await handleRequest(
      makeRequest({ signedTransaction: fixture.signedTransaction }),
      harness.deps,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'activation_failed' });
  });
});
