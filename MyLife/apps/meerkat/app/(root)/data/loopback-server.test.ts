// Plan 38 Phase 6a (MOBILE): the loopback GLUE tests. The pure protocol brain is
// covered by loopback-server-core.test.ts; here we prove the socket pump and head
// serializer against an in-memory duplex (no real socket), plus the honest
// native-absent path (like lan-backend's null-out test) and the playback-hold
// registry.

import { describe, it, expect } from 'vitest';
import { createSealedShare, generateDeviceIdentity, type SealedShare } from '@mylife/sync';
import {
  serializeResponseHead,
  pumpLoopbackConnection,
  startLoopbackServer,
  holdPlayback,
  releasePlayback,
  isPlaybackHeld,
  LOOPBACK_UNAVAILABLE,
  type LoopbackSocket,
} from './loopback-server';
import {
  type LoopbackServerState,
  type LoopbackItem,
  type PlaybackToken,
} from './loopback-server-core';

// --- Real sealed fixture (same shape as the core test) -----------------------

const CHUNK_SIZE = 16;
const TOTAL = 70;
const PLAINTEXT = new Uint8Array(TOTAL);
for (let i = 0; i < TOTAL; i += 1) PLAINTEXT[i] = i;

const IDENTITY = generateDeviceIdentity('Loopback Glue Tester');
const SEALED = createSealedShare(PLAINTEXT, {
  name: 'clip.bin',
  identity: IDENTITY,
  scope: 'shared_workspace',
  chunkSize: CHUNK_SIZE,
  createdAt: '2026-07-05T00:00:00.000Z',
});
const SHARE: SealedShare = SEALED.share;
const CONTENT_ID = SHARE.manifest.contentId;
const SEALED_CHUNK_IDS = [...SHARE.sealedChunks].sort((a, b) => a.index - b.index).map((c) => c.sealedId);
const TOKEN = 'session-token-xyz';

function payloadMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of SHARE.sealedChunks) m.set(c.sealedId, c.payload);
  return m;
}

function makeItem(): LoopbackItem {
  return {
    manifest: { contentId: CONTENT_ID, chunkSize: CHUNK_SIZE, chunkHashes: SHARE.manifest.chunkHashes, size: TOTAL },
    sealedChunkIds: SEALED_CHUNK_IDS,
    dek: Uint8Array.from(SEALED.linkKey),
    mime: 'video/mp4',
  };
}

function makeState(over?: Partial<LoopbackServerState>): LoopbackServerState {
  const base = payloadMap();
  const token: PlaybackToken = { value: TOKEN, createdAtMs: 0, maxAgeMs: 1_000_000 };
  return {
    token,
    now: () => 1000,
    resolveItem: (id) => (id === CONTENT_ID ? makeItem() : null),
    getBlockPayload: async (id) => base.get(id) ?? null,
    ...over,
  };
}

// --- In-memory socket --------------------------------------------------------

function makeFakeSocket(): { socket: LoopbackSocket; feed: (b: Uint8Array) => void; collected: () => Uint8Array } {
  let onDataHandler: ((c: Uint8Array) => void) | null = null;
  let onCloseHandler: (() => void) | null = null;
  const writes: Uint8Array[] = [];
  return {
    socket: {
      write: (d) => writes.push(d),
      onData: (h) => { onDataHandler = h; },
      onClose: (h) => { onCloseHandler = h; },
      close: () => { onCloseHandler?.(); },
    },
    feed: (b) => onDataHandler?.(b),
    collected: () => {
      const total = writes.reduce((n, w) => n + w.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const w of writes) { out.set(w, o); o += w.length; }
      return out;
    },
  };
}

function rawRequest(target: string, headers: string[] = [], method = 'GET'): Uint8Array {
  const text = [`${method} ${target} HTTP/1.1`, 'Host: 127.0.0.1', ...headers].join('\r\n') + '\r\n\r\n';
  return new TextEncoder().encode(text);
}

function splitHeadBody(bytes: Uint8Array): { head: string; body: Uint8Array } {
  const text = new TextDecoder('latin1').decode(bytes);
  const idx = text.indexOf('\r\n\r\n');
  const head = text.slice(0, idx);
  return { head, body: bytes.subarray(idx + 4) };
}

describe('serializeResponseHead', () => {
  it('emits a status line, headers, and a Connection: close terminator', () => {
    const out = serializeResponseHead({ status: 206, statusText: 'Partial Content', headers: { 'Content-Length': '31' } });
    expect(out.startsWith('HTTP/1.1 206 Partial Content\r\n')).toBe(true);
    expect(out).toContain('Content-Length: 31\r\n');
    expect(out).toContain('Connection: close\r\n');
    expect(out.endsWith('\r\n\r\n')).toBe(true);
  });
});

describe('pumpLoopbackConnection', () => {
  it('serves a 206 range with the exact verified bytes over the socket', async () => {
    const fake = makeFakeSocket();
    const p = pumpLoopbackConnection(makeState(), fake.socket);
    fake.feed(rawRequest(`/v1/${TOKEN}/${CONTENT_ID}`, ['Range: bytes=20-50']));
    await p;
    const { head, body } = splitHeadBody(fake.collected());
    expect(head).toContain('HTTP/1.1 206 Partial Content');
    expect(head).toContain('Content-Range: bytes 20-50/70');
    expect(body).toEqual(PLAINTEXT.slice(20, 51));
  });

  it('serves a full 200 when there is no Range header', async () => {
    const fake = makeFakeSocket();
    const p = pumpLoopbackConnection(makeState(), fake.socket);
    fake.feed(rawRequest(`/v1/${TOKEN}/${CONTENT_ID}`));
    await p;
    const { head, body } = splitHeadBody(fake.collected());
    expect(head).toContain('HTTP/1.1 200 OK');
    expect(body).toEqual(PLAINTEXT);
  });

  it('returns 401 with no body on a wrong token', async () => {
    const fake = makeFakeSocket();
    const p = pumpLoopbackConnection(makeState(), fake.socket);
    fake.feed(rawRequest(`/v1/not-the-token/${CONTENT_ID}`));
    await p;
    const { head, body } = splitHeadBody(fake.collected());
    expect(head).toContain('HTTP/1.1 401 Unauthorized');
    expect(body.length).toBe(0);
  });

  it('accepts a request split across two socket reads', async () => {
    const fake = makeFakeSocket();
    const full = rawRequest(`/v1/${TOKEN}/${CONTENT_ID}`, ['Range: bytes=0-15']);
    const p = pumpLoopbackConnection(makeState(), fake.socket);
    fake.feed(full.subarray(0, 12));
    fake.feed(full.subarray(12));
    await p;
    const { head, body } = splitHeadBody(fake.collected());
    expect(head).toContain('206');
    expect(body).toEqual(PLAINTEXT.slice(0, 16));
  });
});

describe('playback hold registry', () => {
  it('tracks holds so a future evictor can skip a playing item', () => {
    expect(isPlaybackHeld('cid-1')).toBe(false);
    holdPlayback('cid-1');
    expect(isPlaybackHeld('cid-1')).toBe(true);
    releasePlayback('cid-1');
    expect(isPlaybackHeld('cid-1')).toBe(false);
  });
});

describe('startLoopbackServer (native absent)', () => {
  it('throws the honest LOOPBACK_UNAVAILABLE when tcp-socket is not present', async () => {
    // In Node there is no react-native-tcp-socket; pass a prng so ONLY the socket
    // module is missing. The honest error path fires -- no crash, no fake server.
    await expect(
      startLoopbackServer({
        db: {} as never,
        store: {} as never,
        identity: IDENTITY,
        item: { tombstone: false } as never,
        prng: (n: number) => new Uint8Array(n),
      }),
    ).rejects.toThrow(LOOPBACK_UNAVAILABLE);
  });
});
