import { describe, expect, it, vi } from 'vitest';
import { handleNutritionRequest } from '../index.ts';
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
  const env = overrides.env ?? { USDA_FDC_API_KEY: 'usda-test' };
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
  return new Request('http://localhost/functions/bestchef-nutrition', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('bestchef-nutrition handler', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }, { auth: null }),
      makeDeps({}),
    );
    expect(res.status).toBe(401);
  });

  it('rejects unsupported sources', async () => {
    const res = await handleNutritionRequest(
      makeRequest({ source: 'unknown' }),
      makeDeps({}),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'invalid_input' } });
  });

  it('returns USDA candidates on a happy path', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(
        JSON.stringify({
          foods: [
            {
              fdcId: 173944,
              description: 'Milk, whole',
              dataType: 'Foundation',
              foodNutrients: [{ nutrientName: 'Energy', value: 61, unitName: 'kcal' }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.candidates[0]).toMatchObject({
      source: 'usda_fdc',
      source_id: '173944',
      product_name: 'Milk, whole',
      nutrients: { calories: 61 },
    });
  });

  it('returns not_configured when USDA key missing', async () => {
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }),
      makeDeps({ env: {} }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status.code).toBe('not_configured');
    expect(json.data.candidates).toEqual([]);
  });

  it('marks USDA upstream 5xx as error status', async () => {
    const fetchStub = vi.fn(async () => new Response('boom', { status: 502 }));
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status.code).toBe('error');
  });

  it('returns rate_limited when USDA returns 429', async () => {
    const fetchStub = vi.fn(async () => new Response('rate', { status: 429 }));
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.data.status.code).toBe('rate_limited');
  });

  it('returns OFF candidate when product is found', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name: 'Whole Milk',
            brands: 'Organic Valley',
            nutriments: { 'energy-kcal_100g': 61, fat_100g: 3.3 },
          },
        }),
        { status: 200 },
      ),
    );
    const res = await handleNutritionRequest(
      makeRequest({ source: 'open_food_facts', barcode: '049000042566' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.data.candidates[0]).toMatchObject({
      source: 'open_food_facts',
      product_name: 'Whole Milk',
    });
  });

  it('fail-closes on rate limit', async () => {
    const rateLimit = { consume: vi.fn(() => false) };
    const res = await handleNutritionRequest(
      makeRequest({ source: 'usda_fdc', query: 'milk' }),
      makeDeps({ rateLimit }),
    );
    expect(res.status).toBe(429);
  });
});

describe('nutrition provider cost controls', () => {
  it('fails closed when the kill switch is enabled', async () => {
    const res = await handleNutritionRequest(
      makeRequest({}),
      makeDeps({ env: { BESTCHEF_PROVIDER_KILL_SWITCH: '1' } }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('returns 429 when the durable quota denies with user_rate_limit', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    const res = await handleNutritionRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
    expect(quota).toHaveBeenCalledTimes(1);
  });

  it('fails closed with 503 when the quota system errors', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'quota_error' as const }));
    const res = await handleNutritionRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('applies the stricter anonymous cap to the durable quota', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    await handleNutritionRequest(makeRequest({}, { auth: `Bearer ${ANON_JWT}` }), makeDeps({ quota }));
    expect(quota).toHaveBeenCalledWith('anon-1', 'nutrition', 20, 60_000);
  });
});
