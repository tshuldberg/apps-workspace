import { describe, expect, it, vi } from 'vitest';
import { handleVisionRequest } from '../index.ts';
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
  const env = overrides.env ?? { ANTHROPIC_API_KEY: 'sk-test' };
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
  return new Request('http://localhost/functions/bestchef-vision', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('bestchef-vision handler', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await handleVisionRequest(makeRequest({ task: 'food_recognition' }, { auth: null }), makeDeps({}));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'auth' } });
  });

  it('returns invalid_input for unknown tasks', async () => {
    const res = await handleVisionRequest(makeRequest({ task: 'unknown' }), makeDeps({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'invalid_input' } });
  });

  it('returns provider_outage when ANTHROPIC_API_KEY is missing', async () => {
    const res = await handleVisionRequest(
      makeRequest({ task: 'food_recognition', imageBase64: 'abc' }),
      makeDeps({ env: {} }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('forwards a happy path call to Anthropic and returns ok envelope', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(
        JSON.stringify({ content: [{ text: '{"candidates":[]}' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const res = await handleVisionRequest(
      makeRequest({ task: 'food_recognition', imageBase64: 'abc', photoMime: 'image/png' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      provider: 'anthropic',
      source: 'claude-haiku-4-5-20251001',
      data: { rawText: '{"candidates":[]}' },
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
  });

  it('redacts payment lines from receipt OCR responses', async () => {
    const upstreamText = 'Whole Foods\nMILK $3.99\nVISA **** 4242\nAUTH CODE 12345\nTotal $3.99';
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ text: upstreamText }] }), { status: 200 }),
    );
    const res = await handleVisionRequest(
      makeRequest({ task: 'receipt_ocr', imageBase64: 'abc' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    const json = await res.json();
    expect(json.data.rawText).toContain('[REDACTED]');
    expect(json.data.rawText).not.toContain('VISA **** 4242');
    expect(json.data.rawText).not.toContain('AUTH CODE 12345');
  });

  it('returns provider_outage when upstream is 5xx', async () => {
    const fetchStub = vi.fn(async () => new Response('boom', { status: 503 }));
    const res = await handleVisionRequest(
      makeRequest({ task: 'food_recognition', imageBase64: 'abc' }),
      makeDeps({ fetch: fetchStub as unknown as typeof fetch }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('fail-closes when the rate-limit bucket is exhausted', async () => {
    const rateLimit = {
      consume: vi.fn(() => false),
    };
    const res = await handleVisionRequest(
      makeRequest({ task: 'food_recognition', imageBase64: 'abc' }),
      makeDeps({ rateLimit }),
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
  });
});

describe('vision provider cost controls', () => {
  it('fails closed when the kill switch is enabled', async () => {
    const res = await handleVisionRequest(
      makeRequest({}),
      makeDeps({ env: { BESTCHEF_PROVIDER_KILL_SWITCH: '1' } }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('returns 429 when the durable quota denies with user_rate_limit', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    const res = await handleVisionRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
    expect(quota).toHaveBeenCalledTimes(1);
  });

  it('fails closed with 503 when the quota system errors', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'quota_error' as const }));
    const res = await handleVisionRequest(makeRequest({}), makeDeps({ quota }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: { kind: 'provider_outage' } });
  });

  it('applies the stricter anonymous cap to the durable quota', async () => {
    const quota = vi.fn(async () => ({ allowed: false, reason: 'user_rate_limit' as const }));
    await handleVisionRequest(makeRequest({}, { auth: `Bearer ${ANON_JWT}` }), makeDeps({ quota }));
    expect(quota).toHaveBeenCalledWith('anon-1', 'vision', 10, 60_000);
  });
});
