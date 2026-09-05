import { afterEach, describe, expect, it } from 'vitest';
import {
  createHealthEndpoints,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  postgresReadyProbe,
  objectStoreReadyProbe,
  dataDirWritableProbe,
  type MetricsListener,
  type ReadinessCheck,
} from '../service-health';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const listeners: MetricsListener[] = [];
afterEach(async () => {
  await Promise.all(listeners.splice(0).map((l) => l.close()));
});

const okCheck = (name: string, required = true): ReadinessCheck => ({
  name,
  required,
  probe: () => ({ ok: true, detailClass: 'ok' }),
});

describe('createHealthEndpoints readiness aggregation', () => {
  it('is ready when every required check passes', async () => {
    const health = createHealthEndpoints({ service: 'svc', checks: [okCheck('a'), okCheck('b')] });
    const report = await health.evaluateReadiness();
    expect(report.ready).toBe(true);
    expect(report.checks).toEqual([
      { name: 'a', ok: true, detailClass: 'ok' },
      { name: 'b', ok: true, detailClass: 'ok' },
    ]);
  });

  it('is NOT ready when a required check fails', async () => {
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [
        okCheck('a'),
        { name: 'db', required: true, probe: () => ({ ok: false, detailClass: 'unavailable' }) },
      ],
    });
    const report = await health.evaluateReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.name === 'db')).toEqual({
      name: 'db',
      ok: false,
      detailClass: 'unavailable',
    });
  });

  it('stays ready when an OPTIONAL check is down (surfaced, not gating)', async () => {
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [
        okCheck('a'),
        { name: 'verifier', required: false, probe: () => ({ ok: false, detailClass: 'not_configured' }) },
      ],
    });
    const report = await health.evaluateReadiness();
    expect(report.ready).toBe(true);
    expect(report.checks.find((c) => c.name === 'verifier')).toEqual({
      name: 'verifier',
      ok: false,
      detailClass: 'not_configured',
    });
  });

  it('classes a check that exceeds its timeout as not-ready with a timeout class', async () => {
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [
        {
          name: 'slow',
          required: true,
          timeoutMs: 10,
          probe: () => new Promise(() => {}), // never resolves
        },
      ],
    });
    const report = await health.evaluateReadiness();
    expect(report.ready).toBe(false);
    expect(report.checks[0]).toEqual({ name: 'slow', ok: false, detailClass: 'timeout' });
  });

  it('classes a thrown probe as faulted and discards the error text', async () => {
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [
        {
          name: 'boom',
          required: true,
          probe: () => {
            throw new Error('postgres://user:secretpassword@db/meerkat is down');
          },
        },
      ],
    });
    const report = await health.evaluateReadiness();
    const serialized = JSON.stringify(report);
    expect(report.checks[0]).toEqual({ name: 'boom', ok: false, detailClass: 'faulted' });
    expect(serialized).not.toContain('secretpassword');
    expect(serialized).not.toContain('postgres://');
  });

  it('readyz responses carry NO free-form strings, only enum classes', async () => {
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [
        { name: 'db', required: true, probe: () => ({ ok: false, detailClass: 'unavailable' }) },
      ],
    });
    const report = await health.evaluateReadiness();
    for (const check of report.checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.ok).toBe('boolean');
      expect(['ok', 'unavailable', 'timeout', 'faulted', 'not_configured']).toContain(check.detailClass);
      // Only three keys, no `detail`, `message`, `error`, etc.
      expect(Object.keys(check).sort()).toEqual(['detailClass', 'name', 'ok']);
    }
  });
});

describe('health endpoint handler routing', () => {
  it('serves /livez and /readyz over http and 200/503 accordingly', async () => {
    const registry = createMetricsRegistry();
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [{ name: 'db', required: true, probe: () => ({ ok: true, detailClass: 'ok' }) }],
    });
    const listener = await startMetricsListener({ registry, config: { host: '127.0.0.1', port: 0 }, health });
    listeners.push(listener);
    const base = `http://127.0.0.1:${listener.port}`;

    const livez = await fetch(`${base}/livez`);
    expect(livez.status).toBe(200);
    expect(await livez.json()).toMatchObject({ ok: true, service: 'svc' });

    const readyz = await fetch(`${base}/readyz`);
    expect(readyz.status).toBe(200);
    expect(await readyz.json()).toMatchObject({ ready: true });
  });

  it('readyz returns 503 when a required dependency is down', async () => {
    const registry = createMetricsRegistry();
    const health = createHealthEndpoints({
      service: 'svc',
      checks: [{ name: 'db', required: true, probe: () => ({ ok: false, detailClass: 'unavailable' }) }],
    });
    const listener = await startMetricsListener({ registry, config: { host: '127.0.0.1', port: 0 }, health });
    listeners.push(listener);
    const readyz = await fetch(`http://127.0.0.1:${listener.port}/readyz`);
    expect(readyz.status).toBe(503);
    expect(await readyz.json()).toMatchObject({ ready: false });
  });
});

describe('Prometheus text format', () => {
  it('renders counters and gauges with static labels, sorted deterministically', async () => {
    const registry = createMetricsRegistry();
    const requests = registry.counter('meerkat_requests_total', 'Total requests');
    requests.inc({ service: 'svc', outcome: 'ok' });
    requests.inc({ service: 'svc', outcome: 'ok' });
    requests.inc({ service: 'svc', outcome: 'error' });
    const depth = registry.gauge('meerkat_pool_connections', 'Pool connections');
    depth.set({ service: 'svc', state: 'idle' }, 3);

    const text = await registry.render();
    expect(text).toContain('# HELP meerkat_requests_total Total requests');
    expect(text).toContain('# TYPE meerkat_requests_total counter');
    expect(text).toContain('meerkat_requests_total{outcome="error",service="svc"} 1');
    expect(text).toContain('meerkat_requests_total{outcome="ok",service="svc"} 2');
    expect(text).toContain('# TYPE meerkat_pool_connections gauge');
    expect(text).toContain('meerkat_pool_connections{service="svc",state="idle"} 3');
    // Trailing newline for valid exposition.
    expect(text.endsWith('\n')).toBe(true);
  });

  it('supports lazy collectors for on-demand gauges', async () => {
    const registry = createMetricsRegistry();
    let live = 7;
    registry.collect('meerkat_pool_total', 'Pool total', () => [
      { labels: { service: 'svc' }, value: live },
    ]);
    expect(await registry.render()).toContain('meerkat_pool_total{service="svc"} 7');
    live = 9;
    expect(await registry.render()).toContain('meerkat_pool_total{service="svc"} 9');
  });

  it('supports ASYNC collectors (a store stats() promise)', async () => {
    const registry = createMetricsRegistry();
    registry.collect('meerkat_store_async', 'Async store', async () => {
      await Promise.resolve();
      return [{ labels: { service: 'svc', kind: 'spent' }, value: 42 }];
    });
    expect(await registry.render()).toContain('meerkat_store_async{kind="spent",service="svc"} 42');
  });

  it('rejects invalid metric and label names', () => {
    const registry = createMetricsRegistry();
    expect(() => registry.counter('has spaces', 'x')).toThrow();
    const c = registry.counter('valid_total', 'x');
    expect(() => c.inc({ 'bad-label': 'v' })).toThrow();
  });

  it('escapes label values so a stray quote cannot corrupt exposition', async () => {
    const registry = createMetricsRegistry();
    registry.gauge('m', 'x').set({ service: 'a"b\\c' }, 1);
    expect(await registry.render()).toContain('m{service="a\\"b\\\\c"} 1');
  });

  it('serves /metrics text over the private listener', async () => {
    const registry = createMetricsRegistry();
    registry.counter('meerkat_events_total', 'Events').inc({ outcome: 'ok' });
    const listener = await startMetricsListener({ registry, config: { host: '127.0.0.1', port: 0 } });
    listeners.push(listener);
    const res = await fetch(`http://127.0.0.1:${listener.port}/metrics`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toContain('meerkat_events_total{outcome="ok"} 1');
  });
});

describe('resolveMetricsListenerConfig (opt-in only)', () => {
  it('returns null when MEERKAT_METRICS_PORT is unset (metrics disabled)', () => {
    expect(resolveMetricsListenerConfig({})).toBeNull();
    expect(resolveMetricsListenerConfig({ MEERKAT_METRICS_HOST: '10.0.0.1' })).toBeNull();
  });

  it('defaults the host to loopback when only the port is set', () => {
    expect(resolveMetricsListenerConfig({ MEERKAT_METRICS_PORT: '9464' })).toEqual({
      host: '127.0.0.1',
      port: 9464,
    });
  });

  it('honors an explicit private host', () => {
    expect(
      resolveMetricsListenerConfig({ MEERKAT_METRICS_PORT: '9464', MEERKAT_METRICS_HOST: '10.1.2.3' }),
    ).toEqual({ host: '10.1.2.3', port: 9464 });
  });

  it('throws on a malformed explicit port', () => {
    expect(() => resolveMetricsListenerConfig({ MEERKAT_METRICS_PORT: 'notaport' })).toThrow();
    expect(() => resolveMetricsListenerConfig({ MEERKAT_METRICS_PORT: '70000' })).toThrow();
  });
});

describe('reusable dependency probes', () => {
  it('postgresReadyProbe reports ok on a live pool and unavailable on a dead one', async () => {
    const alive = postgresReadyProbe({ query: async () => ({ rows: [] }) });
    expect(await alive()).toEqual({ ok: true, detailClass: 'ok' });
    const dead = postgresReadyProbe({
      query: async () => {
        throw new Error('Cannot use a pool after calling end on the pool');
      },
    });
    expect(await dead()).toEqual({ ok: false, detailClass: 'unavailable' });
  });

  it('objectStoreReadyProbe treats a resolved observe (even null) as reachable', async () => {
    const reachable = objectStoreReadyProbe({ observe: async () => null });
    expect(await reachable()).toEqual({ ok: true, detailClass: 'ok' });
    const down = objectStoreReadyProbe({
      observe: async () => {
        throw new Error('bucket unreachable');
      },
    });
    expect(await down()).toEqual({ ok: false, detailClass: 'unavailable' });
  });

  it('dataDirWritableProbe passes for a writable dir and fails for a missing one', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-readyz-'));
    try {
      expect(await dataDirWritableProbe(dir)()).toEqual({ ok: true, detailClass: 'ok' });
      const missing = path.join(dir, 'does', 'not', 'exist');
      expect(await dataDirWritableProbe(missing)()).toEqual({ ok: false, detailClass: 'unavailable' });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
