import { describe, expect, it, vi } from 'vitest';
import { handleProductIdentityRequest } from '../index.ts';
import { createInMemoryRateLimiter, type BrokerDeps } from '../../_shared/broker.ts';

const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

const ANON_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'anon-1', is_anonymous: true }));
  return `${header}.${payload}.sig`;
})();

interface DepsOverrides {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  rateLimit?: BrokerDeps['rateLimit'];
  now?: BrokerDeps['now'];
  quota?: BrokerDeps['quota'];
}

function makeDeps(overrides: DepsOverrides = {}): BrokerDeps {
  const env = overrides.env ?? {};
  return {
    env: (key) => env[key],
    fetch: overrides.fetch ?? ((async () => new Response('', { status: 200 })) as typeof fetch),
    now: overrides.now ?? (() => 0),
    rateLimit: overrides.rateLimit ?? createInMemoryRateLimiter(),
    quota: overrides.quota ?? (async () => ({ allowed: true, reason: 'ok' as const })),
  };
}

function makeRequest(body: unknown, opts: { auth?: string | null } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/bestchef-product-identity', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('bestchef-product-identity handler', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'open_food_facts', barcode: '049000042566' }, { auth: null }),
      makeDeps(),
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid barcodes', async () => {
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'open_food_facts', barcode: 'abc' }),
      makeDeps(),
    );
    expect(res.status).toBe(400);
  });

  it('returns OFF product on a happy path', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: 'Whole Milk', brands: 'Organic Valley', categories_tags: ['en:dairies'] },
        }),
        { status: 200 },
      ),
    );
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'open_food_facts', barcode: '049000042566' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      data: { product: { product_name: 'Whole Milk', brand: 'Organic Valley', category: 'en:dairies' } },
    });
  });

  it('returns not_configured when GS1 credentials are missing', async () => {
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'gs1', barcode: '049000042566' }),
      makeDeps({ env: {} }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.product).toBeNull();
    expect(json.data.status.code).toBe('not_configured');
  });

  it('returns GS1 product when credentials are present', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(
        JSON.stringify({ productName: 'Whole Milk', brand: 'Organic Valley', category: 'Dairy' }),
        { status: 200 },
      ),
    );
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'gs1', barcode: '049000042566' }),
      makeDeps({
        env: {
          GS1_CLIENT_ID: 'id',
          GS1_CLIENT_SECRET: 'secret',
          GS1_ENDPOINT: 'https://gs1.example.com/api',
        },
        fetch: fetchStub as unknown as typeof fetch,
      }),
    );
    const json = await res.json();
    expect(json.data.product).toMatchObject({ product_name: 'Whole Milk' });
  });

  it('returns not_found when OFF status != 1', async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 }));
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'open_food_facts', barcode: '049000042566' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.data.status.code).toBe('not_found');
  });

  it('fail-closes on rate limit', async () => {
    const rateLimit = { consume: vi.fn(() => false) };
    const res = await handleProductIdentityRequest(
      makeRequest({ source: 'open_food_facts', barcode: '049000042566' }),
      makeDeps({ rateLimit }),
    );
    expect(res.status).toBe(429);
  });
});

describe('product-identity provider cost controls', () => {
  it('fails closed when the kill switch is enabled', async () => {
    const res = await handleProductIdentityRequest(
      makeRequest({}),
      makeDeps({ env: { BESTCHEF_PROVIDER_KILL_SWITCH: '1' } }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('returns 429 when the durable quota denies with user_rate_limit', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    const res = await handleProductIdentityRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
    expect(quota).toHaveBeenCalledTimes(1);
  });

  it('fails closed with 503 when the quota system errors', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'quota_error' as const }));
    const res = await handleProductIdentityRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('applies the stricter anonymous cap to the durable quota', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    await handleProductIdentityRequest(makeRequest({}, { auth: `Bearer ${ANON_JWT}` }), makeDeps({ quota }));
    expect(quota).toHaveBeenCalledWith('anon-1', 'product-identity', 20, 60_000);
  });
});
