/**
 * MK-036 acceptance: a client probes a pool of relays and picks the nearest
 * HEALTHY one, against real relay /healthz endpoints. A down relay in the pool
 * is skipped; the live relay is chosen and is actually usable for a session.
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import {
  selectRelay,
  relayHealthUrl,
  WebSocketRelayBackend,
  type RelayProbe,
  type RelaySession,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

/** Real HTTP probe over node:http (the vitest guard stubs global fetch). */
const httpProbe: RelayProbe = (url, timeoutMs) =>
  new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(relayHealthUrl(url), (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        if ((res.statusCode ?? 500) >= 400) {
          resolve({ url, healthy: false, latencyMs });
          return;
        }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { ok?: boolean; connections?: number };
          resolve({ url, healthy: body.ok !== false, latencyMs, connections: body.connections });
        } catch {
          resolve({ url, healthy: true, latencyMs });
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ url, healthy: false, latencyMs: Infinity }); });
    req.on('error', () => resolve({ url, healthy: false, latencyMs: Infinity }));
  });

let servers: RelayServer[] = [];
let backend: WebSocketRelayBackend | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

describe('relay selection e2e (MK-036)', () => {
  it('responds to GET /healthz with live counts', async () => {
    const server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    servers.push(server);
    const health = await httpProbe(`ws://127.0.0.1:${server.port}`, 2000);
    expect(health.healthy).toBe(true);
    expect(health.connections).toBe(0);
  });

  it('picks a live relay over a dead one and the choice actually carries a session', async () => {
    const live = await startRelayServer({ port: 0, host: '127.0.0.1' });
    servers.push(live);
    const liveUrl = `ws://127.0.0.1:${live.port}`;
    const deadUrl = 'ws://127.0.0.1:9'; // nothing listening on port 9

    const chosen = await selectRelay({ candidates: [deadUrl, liveUrl], probe: httpProbe, timeoutMs: 2000 });
    expect(chosen?.url).toBe(liveUrl);

    // The chosen relay is real: two clients connect on it and one envelope crosses.
    backend = new WebSocketRelayBackend();
    const token = '7'.repeat(64);
    const a = await backend.connect(chosen!.url, token);
    const b = await backend.connect(chosen!.url, token);
    const received = new Promise<Uint8Array>((res) => (b as RelaySession).onMessage(res));
    await a.send(new Uint8Array([1, 2, 3]));
    expect(Array.from(await received)).toEqual([1, 2, 3]);
  });

  it('returns null when every relay in the pool is down', async () => {
    const chosen = await selectRelay({
      candidates: ['ws://127.0.0.1:9', 'ws://127.0.0.1:10'],
      probe: httpProbe,
      timeoutMs: 1000,
    });
    expect(chosen).toBeNull();
  });
});
