import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocket } from 'ws';
import { issueMeerkatHostedEntitlement } from '@mylife/entitlements/server';
import { startRelayServer, type RelayServer } from '../server';

const TOKEN = 'f'.repeat(64);

let server: RelayServer | null = null;
const openSockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of openSockets) {
    try {
      s.terminate();
    } catch {
      // ignore
    }
  }
  openSockets.length = 0;
  if (server) {
    await server.close();
    server = null;
  }
});

function client(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  openSockets.push(ws);
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
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

describe('relay server (live WebSocket)', () => {
  it('relays a ciphertext envelope between two real sockets sharing a token', async () => {
    const logged: string[] = [];
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      log: (event) => logged.push(event), // only events, never envelopes
    });

    const a = await client(server.port);
    const b = await client(server.port);
    a.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    b.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    await nextFrame(a, 'ready');
    await nextFrame(b, 'ready');

    const deliver = nextFrame(b, 'env');
    a.send(JSON.stringify({ t: 'env', env: 'Y2lwaGVydGV4dA==' }));
    const got = await deliver;

    expect(got.env).toBe('Y2lwaGVydGV4dA==');
    // The server logged join/listening events but never an envelope value.
    expect(logged).not.toContain('Y2lwaGVydGV4dA==');
    expect(logged).toContain('join');
  });

  it('rejects an env frame sent before hello', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const a = await client(server.port);
    const err = nextFrame(a, 'err');
    a.send(JSON.stringify({ t: 'env', env: 'AAAA' }));
    expect((await err).code).toBe('not_joined');
  });

  it('rejects a malformed frame', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const a = await client(server.port);
    const err = nextFrame(a, 'err');
    a.send('this is not json');
    expect((await err).code).toBe('bad_frame');
  });

  it('rejects hosted relay joins without a paid entitlement when hosted mode is required', async () => {
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      hostedEntitlement: {
        required: true,
        secret: 'hosted-secret',
      },
    });
    const a = await client(server.port);
    const err = nextFrame(a, 'err');
    a.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    expect((await err).code).toBe('entitlement_required');
  });

  it('allows hosted relay traffic with a valid Meerkat hosted entitlement', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: 'hosted-secret',
      issuedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2026-06-21T00:00:00.000Z',
    });
    server = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      hostedEntitlement: {
        required: true,
        secret: 'hosted-secret',
        nowMs: () => Date.parse('2026-06-20T01:00:00.000Z'),
      },
    });

    const a = await client(server.port);
    const b = await client(server.port);
    a.send(JSON.stringify({ t: 'hello', token: TOKEN, entitlement: issued.token }));
    b.send(JSON.stringify({ t: 'hello', token: TOKEN, entitlement: issued.token }));
    await nextFrame(a, 'ready');
    await nextFrame(b, 'ready');

    const deliver = nextFrame(b, 'env');
    a.send(JSON.stringify({ t: 'env', env: 'Y2lwaGVydGV4dA==' }));
    expect((await deliver).env).toBe('Y2lwaGVydGV4dA==');
  });

  it('exposes only { ok, connections } on /healthz (no metadata)', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const res = await fetch(`http://127.0.0.1:${server.port}/healthz`);
    expect(res.ok).toBe(true);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = (await res.json()) as Record<string, unknown>;
    // Exact shape: liveness + a coarse load count, nothing else. Adding a field
    // here would erode the zero-knowledge guarantee.
    expect(Object.keys(body).sort()).toEqual(['connections', 'ok']);
    expect(body).toEqual({ ok: true, connections: 0 });
  });

  it('the slim production entrypoint imports startRelayServer from ./server, not the barrel', () => {
    // Guards the relay image against re-introducing the @mylife/sync runtime
    // dependency that the src/index.ts barrel pulls in via the seeder/hosted node.
    const here = dirname(fileURLToPath(import.meta.url));
    const bin = readFileSync(join(here, '..', '..', 'bin', 'meerkat-relay-server.mjs'), 'utf8');
    expect(bin).toMatch(/from\s*'\.\.\/src\/server\.ts'/);
    expect(bin).not.toMatch(/from\s*'\.\.\/src\/index(\.ts)?'/);
  });
});
