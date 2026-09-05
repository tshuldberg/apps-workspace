/**
 * Env caps enforced through startRelayServer (Plan 20, Phase 2, Tier B).
 *
 * Proves the resolved limits actually GOVERN a live relay, not just the data
 * object:
 *  - the hub-level rate cap is enforced from injected limits (rate_limited);
 *  - the two previously un-wired module-level reads in server.ts now consume the
 *    resolved limits: maxConnections (the server-level admission guard at
 *    server.ts:194) via an injected limit AND via the real process.env path that
 *    the slim bin uses (TC-5);
 *  - /healthz still returns ONLY { ok, connections } (NC-5) under custom caps.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { startRelayServer, type RelayServer } from '../server';
import { resolveRelayLimits } from '../protocol';

const TOKEN = 'a'.repeat(64);

let server: RelayServer | null = null;
const openSockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of openSockets) {
    try { s.terminate(); } catch { /* ignore */ }
  }
  openSockets.length = 0;
  if (server) {
    await server.close();
    server = null;
  }
});

/** Connect and resolve once OPEN. */
function client(port: number, forwardedFor?: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
    ...(forwardedFor ? { headers: { 'x-forwarded-for': forwardedFor } } : {}),
  });
  openSockets.push(ws);
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

async function join(ws: WebSocket): Promise<Record<string, unknown>> {
  const frame = nextFrame(ws, 'ready');
  ws.send(JSON.stringify({ t: 'hello', token: TOKEN }));
  return frame;
}

/** Connect and resolve with the first `err` frame the server sends. */
function connectExpectingErr(port: number): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    openSockets.push(ws);
    ws.on('message', (raw: WebSocket.RawData) => {
      const f = JSON.parse(raw.toString('utf8')) as { t: string; code?: string };
      if (f.t === 'err') resolve({ code: f.code ?? '' });
    });
    ws.once('error', reject);
  });
}

function nextFrame(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    function onMsg(raw: WebSocket.RawData) {
      const frame = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
      if (frame.t === type) {
        ws.off('message', onMsg);
        resolve(frame);
      }
    }
    ws.on('message', onMsg);
  });
}

describe('relay fair-use caps (live server)', () => {
  it('ignores spoofed forwarding headers unless proxy trust is explicit', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: { maxConnectionsPerClient: 1 },
    });
    await join(await client(server.port, '203.0.113.1'));

    const second = await client(server.port, '203.0.113.2');
    const err = nextFrame(second, 'err');
    second.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    expect((await err).code).toBe('too_many_connections');
  });

  it('uses the client address behind an explicitly trusted proxy hop', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      trustedProxyHops: 1,
      limits: { maxConnectionsPerClient: 1 },
    });
    await join(await client(server.port, '203.0.113.1'));
    await expect(join(await client(server.port, '203.0.113.2'))).resolves.toMatchObject({ t: 'ready' });
  });

  it('enforces an injected rate cap (rate_limited after the budget)', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: { rateMaxPerWindow: 2, rateWindowMs: 60_000 },
    });
    const a = await client(server.port);
    a.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    await nextFrame(a, 'ready');

    const err = nextFrame(a, 'err');
    a.send(JSON.stringify({ t: 'env', env: 'AAAA' })); // 1 (ok)
    a.send(JSON.stringify({ t: 'env', env: 'AAAA' })); // 2 (ok)
    a.send(JSON.stringify({ t: 'env', env: 'AAAA' })); // 3 (over budget)
    expect((await err).code).toBe('rate_limited');
  });

  it('consumes an injected maxConnections at the server-level admission guard', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: { maxConnections: 1 },
    });
    await client(server.port); // 1st connection occupies the only slot
    const err = await connectExpectingErr(server.port); // 2nd is rejected
    expect(err.code).toBe('server_full');
  });

  it('TC-5: reads RELAY_MAX_CONNECTIONS from process.env (the slim bin path)', async () => {
    const prev = process.env.RELAY_MAX_CONNECTIONS;
    process.env.RELAY_MAX_CONNECTIONS = '8'; // clamp min; valid
    try {
      server = await startRelayServer({ port: 0, host: '127.0.0.1' }); // no injected limits
      for (let i = 0; i < 8; i++) await client(server.port); // fill all 8 slots
      const err = await connectExpectingErr(server.port); // the 9th is rejected
      expect(err.code).toBe('server_full');
    } finally {
      if (prev === undefined) delete process.env.RELAY_MAX_CONNECTIONS;
      else process.env.RELAY_MAX_CONNECTIONS = prev;
    }
  });

  it('NC-5: /healthz still exposes only { ok, connections } under custom caps', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      limits: resolveRelayLimits({ RELAY_ENV_RATE: '50', RELAY_MAILBOX_TTL_MS: '600000' }),
    });
    const res = await fetch(`http://127.0.0.1:${server.port}/healthz`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['connections', 'ok']);
    expect(body).toEqual({ ok: true, connections: 0 });
  });
});
