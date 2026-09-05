import { issueMeerkatHostedEntitlement } from '@mylife/entitlements/server';
/**
 * End-to-end: the real @mylife/sync WebSocketRelayBackend moving real sealed
 * ciphertext through the real relay server. This is the first time bytes
 * actually cross between two independent transport clients in this codebase,
 * over a live WebSocket, with the real node crypto on top. (Plan 14, M0:
 * MK-005 server + MK-006 client backend.)
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  generateDeviceIdentity,
  createSealedShare,
  openSealedShare,
  WebSocketRelayBackend,
  createHostedRelayAccess,
  publishRendezvous,
  resolveRendezvous,
  withHostedRelayAccess,
  type RelaySession,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const TOKEN = '9'.repeat(64);
const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

let server: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (server) {
    await server.close();
    server = null;
  }
});

function collectOnce(session: RelaySession): Promise<Uint8Array> {
  return new Promise((resolve) => session.onMessage(resolve));
}

describe('relay e2e via WebSocketRelayBackend', () => {
  it('round-trips raw ciphertext bytes between two sessions on one token', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const a = await backend.connect(url, TOKEN);
    const b = await backend.connect(url, TOKEN);

    const received = collectOnce(b);
    const payload = new Uint8Array([0, 1, 2, 250, 251, 255]);
    await a.send(payload);

    const got = await received;
    expect(Array.from(got)).toEqual(Array.from(payload));
  });

  it('seals content on device A and opens it on device B across the relay', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const author = generateDeviceIdentity('Device A');
    const content = enc('a real secret, sealed on A, opened on B, only ciphertext crossed the relay');
    const { share, linkKey } = createSealedShare(content, { name: 'note', identity: author });

    const a = await backend.connect(url, TOKEN);
    const b = await backend.connect(url, TOKEN);

    // B reconstructs the share from the bytes it receives over the relay.
    const received = collectOnce(b);
    // A ships the sealed share (manifest + signature + ciphertext blocks) as one
    // envelope. The relay only ever sees these opaque bytes.
    await a.send(enc(JSON.stringify(share)));

    const wireBytes = await received;
    const shareOnB = JSON.parse(dec(wireBytes)) as typeof share;

    // The link key arrives out of band (the share link), as designed.
    const result = openSealedShare(shareOnB, linkKey, { expectedAuthor: author.publicKey });
    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.content)).toBe(dec(content));
  });
});


it('acquires a signed hosted token and waits for real paid-relay admission', async () => {
  const issued = await issueMeerkatHostedEntitlement({
    secret: 'local-test-secret', expiresAt: new Date(Date.now() + 120_000).toISOString(),
  });
  server = await startRelayServer({ port: 0, host: '127.0.0.1', hostedEntitlement: { required: true, secret: 'local-test-secret' } });
  backend = new WebSocketRelayBackend();
  const url = `ws://127.0.0.1:${server.port}`;
  await expect(backend.connect(url, TOKEN)).rejects.toThrow('entitlement_required');
  const access = createHostedRelayAccess({
    relayUrl: url, apiUrl: 'https://billing.example', createAuthorization: () => 'fixture-device-proof',
    fetchFn: async () => new Response(JSON.stringify(issued)),
  });
  const authenticated = withHostedRelayAccess(backend, access);
  const sender = await authenticated.connect(url, TOKEN);
  const recipient = await authenticated.connect(url, TOKEN);
  const received = collectOnce(recipient);
  await sender.send(enc('paid-relay admission preceded this envelope'));
  expect(dec(await received)).toBe('paid-relay admission preceded this envelope');
});


it('returns the actual clamped friend-code expiry and refuses resolution after it', async () => {
  let now = 1_800_000_000_000;
  server = await startRelayServer({ port: 0, host: '127.0.0.1', now: () => now, limits: { rendezvousTtlMs: 500 } });
  const url = `ws://127.0.0.1:${server.port}`;
  const rid = 'ab'.repeat(8);
  expect(await publishRendezvous({ url, rid, record: 'opaque', ttlMs: 60_000 })).toEqual({ expiresAt: now + 500 });
  now += 501;
  expect(await resolveRendezvous({ url, rid })).toBeNull();
});
