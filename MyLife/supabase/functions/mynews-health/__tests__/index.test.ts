import { describe, expect, it, vi } from 'vitest';

import {
  createSnapshotReader,
  handleHealthRequest,
  HEALTH_SECRET_HEADER,
  secretMatches,
  wantsDetail,
  type HealthDeps,
} from '../index.ts';
import type { HealthSnapshot } from '../../_shared/mynews-health.ts';

const SECRET = 'health-secret-0123456789';

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    checkedAt: '2026-07-30T12:00:00Z',
    queues: {
      queue_report: { depth: 2, oldestAgeSeconds: 60 },
      queue_ncii: { depth: 0, oldestAgeSeconds: null, pastDeadline: 0 },
      queue_dmca: { depth: 1, oldestAgeSeconds: 120 },
      queue_screening: { depth: 0, oldestAgeSeconds: null },
      queue_deletion: { depth: 0, oldestAgeSeconds: null },
      queue_support_reconciliation: { depth: 1, oldestAgeSeconds: 3_600 },
    },
    workers: {
      'mynews-ncii-worker': {
        ok: true,
        finishedAt: '2026-07-30T11:59:00Z',
        ageSeconds: 60,
        processed: 3,
        failures: 0,
        detail: 'scanned 3',
      },
      'mynews-account-worker': {
        ok: true,
        finishedAt: '2026-07-30T11:30:00Z',
        ageSeconds: 1_800,
        processed: 0,
        failures: 0,
        detail: null,
      },
      'mynews-support-worker': {
        ok: true,
        finishedAt: '2026-07-30T04:00:00Z',
        ageSeconds: 28_800,
        processed: 40,
        failures: 0,
        detail: null,
      },
    },
    thresholds: {
      queue_report: { warnSeconds: 21_600, alarmSeconds: 86_400, enabled: true, description: '' },
      queue_ncii: { warnSeconds: 14_400, alarmSeconds: 43_200, enabled: true, description: '' },
      queue_dmca: { warnSeconds: 43_200, alarmSeconds: 172_800, enabled: true, description: '' },
      queue_screening: { warnSeconds: 14_400, alarmSeconds: 86_400, enabled: true, description: '' },
      queue_deletion: { warnSeconds: 3_600, alarmSeconds: 21_600, enabled: true, description: '' },
      queue_support_reconciliation: {
        warnSeconds: 93_600,
        alarmSeconds: 259_200,
        enabled: true,
        description: '',
      },
      worker_mynews_ncii_worker: {
        warnSeconds: 3_600,
        alarmSeconds: 21_600,
        enabled: true,
        description: '',
      },
      worker_mynews_account_worker: {
        warnSeconds: 10_800,
        alarmSeconds: 43_200,
        enabled: true,
        description: '',
      },
      worker_mynews_support_worker: {
        warnSeconds: 93_600,
        alarmSeconds: 259_200,
        enabled: true,
        description: '',
      },
    },
    ...overrides,
  };
}

function deps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    readSnapshot: async () => snapshot(),
    detailSecret: SECRET,
    ...overrides,
  };
}

function req(
  init: { method?: string; url?: string; secret?: string; detail?: boolean } = {},
): Request {
  const url = new URL(init.url ?? 'https://edge.test/mynews-health');
  if (init.detail) url.searchParams.set('detail', '1');
  return new Request(url, {
    method: init.method ?? 'GET',
    headers: init.secret ? { [HEALTH_SECRET_HEADER]: init.secret } : {},
  });
}

describe('shallow payload', () => {
  it('returns status and checkedAt only, with no queue internals', async () => {
    const res = await handleHealthRequest(req(), deps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual(['checkedAt', 'detailAvailable', 'status']);
    expect(body.data.status).toBe('ok');

    // The whole point of the shallow payload: an unauthenticated caller learns
    // nothing about the safety pipeline's state beyond up or degraded.
    const serialized = JSON.stringify(body);
    for (const leak of ['queue_', 'worker_', 'depth', 'ageSeconds', 'mynews-ncii-worker']) {
      expect(serialized).not.toContain(leak);
    }
  });

  it('reports degraded honestly without naming the failing component', async () => {
    const stale = snapshot();
    stale.queues.queue_ncii = { depth: 4, oldestAgeSeconds: 50_000, pastDeadline: 2 };
    const res = await handleHealthRequest(req(), deps({ readSnapshot: async () => stale }));
    const body = (await res.json()) as { data: { status: string } };
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('degraded');
    expect(JSON.stringify(body)).not.toContain('ncii');
  });

  it('advertises whether detail is available on this deployment', async () => {
    const off = await handleHealthRequest(req(), deps({ detailSecret: null }));
    expect(((await off.json()) as { data: { detailAvailable: boolean } }).data.detailAvailable).toBe(
      false,
    );
  });
});

describe('detailed payload gate', () => {
  it('returns the full typed component list with the right secret', async () => {
    const res = await handleHealthRequest(req({ secret: SECRET }), deps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { detail: boolean; components: { component: string; level: string }[] };
    };
    expect(body.data.detail).toBe(true);
    // Six queues plus three workers, every one of them reported.
    expect(body.data.components).toHaveLength(9);
    expect(body.data.components.map((c) => c.component)).toContain('worker_mynews_support_worker');
    expect(body.data.components.every((c) => typeof c.level === 'string')).toBe(true);
  });

  it('refuses a wrong secret with 401 rather than downgrading to shallow', async () => {
    const res = await handleHealthRequest(req({ secret: 'wrong-secret-value' }), deps());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('unauthorized');
    // A refused detail request must not leak the shallow payload as consolation:
    // silently answering a different question hides the refusal.
    expect(JSON.stringify(body)).not.toContain('status');
  });

  it('refuses a detail request with no secret at all', async () => {
    const res = await handleHealthRequest(req({ detail: true }), deps());
    expect(res.status).toBe(401);
  });

  it('reports detail unavailable when no secret is configured, never open', async () => {
    const res = await handleHealthRequest(
      req({ detail: true, secret: 'anything' }),
      deps({ detailSecret: null }),
    );
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('detail-unavailable');
  });

  it('accepts the secret through the Authorization bearer header too', async () => {
    const request = new Request('https://edge.test/mynews-health', {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const res = await handleHealthRequest(request, deps());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { detail?: boolean } }).data.detail).toBe(true);
  });
});

describe('fail-closed read', () => {
  it('reports down on a 503 when the snapshot cannot be read', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleHealthRequest(
      req(),
      deps({
        readSnapshot: async () => {
          throw new Error('ECONNREFUSED postgres://user:pw@host/db');
        },
      }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string; detail?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('health-unavailable');
    // The connection string never reaches the caller.
    expect(JSON.stringify(body)).not.toContain('postgres://');
    consoleError.mockRestore();
  });

  it('rejects a method that is neither GET nor POST', async () => {
    const res = await handleHealthRequest(req({ method: 'DELETE' }), deps());
    expect(res.status).toBe(405);
  });
});

describe('secretMatches', () => {
  it('matches only an exact secret', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(`${SECRET} `, SECRET)).toBe(false);
    expect(secretMatches(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false);
  });

  it('never matches when either side is absent', () => {
    expect(secretMatches(null, SECRET)).toBe(false);
    expect(secretMatches(SECRET, null)).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches(null, null)).toBe(false);
  });
});

describe('wantsDetail', () => {
  it('is true for an explicit flag or any supplied secret', () => {
    expect(wantsDetail(req({ detail: true }))).toBe(true);
    expect(wantsDetail(req({ secret: 'x' }))).toBe(true);
    expect(
      wantsDetail(new Request('https://edge.test/mynews-health?detail=true')),
    ).toBe(true);
    expect(wantsDetail(req())).toBe(false);
    expect(wantsDetail(new Request('https://edge.test/mynews-health?detail=0'))).toBe(false);
  });
});

describe('createSnapshotReader', () => {
  it('throws rather than returning an empty snapshot without credentials', async () => {
    const read = createSnapshotReader(() => undefined, (async () => new Response('')) as never);
    await expect(read()).rejects.toThrow(/SUPABASE_URL/);
  });

  it('calls the snapshot RPC with the service role key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(snapshot()), { status: 200 });
    }) as unknown as typeof fetch;
    const read = createSnapshotReader(
      (key) => (key === 'SUPABASE_URL' ? 'https://p.supabase.co/' : 'service-key'),
      fetchImpl,
    );
    const result = await read();
    expect(calls[0]!.url).toBe('https://p.supabase.co/rest/v1/rpc/nw_health_snapshot');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer service-key',
    );
    expect(result.checkedAt).toBe('2026-07-30T12:00:00Z');
  });

  it('throws on a non-ok response rather than returning a partial snapshot', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const read = createSnapshotReader(() => 'v', fetchImpl);
    await expect(read()).rejects.toThrow(/HTTP 500/);
  });
});
