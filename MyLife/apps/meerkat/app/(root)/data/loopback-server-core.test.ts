/**
 * Plan 38 Phase 6a -- loopback A/V range server PURE CORE tests (amendment D.5
 * + Codex amendment 7). Everything is exercised against REAL sealed fixtures
 * (createSealedShare with a small chunkSize) -- the crypto is never mocked, so a
 * green run proves the range math, the seek, the chunk-boundary decrypt, and the
 * fail-closed abort against the actual sealed-share format.
 */

import { describe, it, expect } from 'vitest';
import { createSealedShare, generateDeviceIdentity, type SealedShare } from '@mylife/sync';
import {
  buildFullHead,
  buildPartialHead,
  buildUnsatisfiableHead,
  buildErrorHead,
  constantTimeEquals,
  handleLoopbackRequest,
  isPlaybackTokenExpired,
  makeChunkStream,
  mintPlaybackToken,
  parseHttpRequest,
  parsePlaybackPath,
  parseRangeHeader,
  rangeToChunkWindow,
  validatePlaybackToken,
  MAX_REQUEST_BYTES,
  type LoopbackItem,
  type LoopbackServerState,
  type PlaybackToken,
} from './loopback-server-core';

// --- Real sealed fixture: 70 bytes over 16-byte chunks -> 5 chunks. ----------

const CHUNK_SIZE = 16;
const TOTAL = 70;
const PLAINTEXT = new Uint8Array(TOTAL);
for (let i = 0; i < TOTAL; i += 1) PLAINTEXT[i] = i;

const IDENTITY = generateDeviceIdentity('Loopback Tester');
const SEALED = createSealedShare(PLAINTEXT, {
  name: 'clip.bin',
  identity: IDENTITY,
  scope: 'shared_workspace',
  chunkSize: CHUNK_SIZE,
  createdAt: '2026-07-05T00:00:00.000Z',
});
const SHARE: SealedShare = SEALED.share;
const CONTENT_ID = SHARE.manifest.contentId;
const SEALED_CHUNK_IDS = [...SHARE.sealedChunks]
  .sort((a, b) => a.index - b.index)
  .map((c) => c.sealedId);

function payloadMap(share: SealedShare): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of share.sealedChunks) m.set(c.sealedId, c.payload);
  return m;
}

function makeGetBlockPayload(overrides?: Map<string, string>) {
  const base = payloadMap(SHARE);
  return async (sealedId: string): Promise<string | null> => {
    if (overrides?.has(sealedId)) return overrides.get(sealedId)!;
    return base.get(sealedId) ?? null;
  };
}

const NOW = 1_000_000;
const TOKEN = 'session-token-abc';

function armedToken(): PlaybackToken {
  return { value: TOKEN, createdAtMs: NOW, maxAgeMs: 10_000 };
}

function makeItem(): LoopbackItem {
  return {
    manifest: {
      contentId: CONTENT_ID,
      chunkSize: CHUNK_SIZE,
      chunkHashes: SHARE.manifest.chunkHashes,
      size: TOTAL,
    },
    sealedChunkIds: SEALED_CHUNK_IDS,
    // Fresh DEK copy per call -- makeChunkStream zeroes it after each stream.
    dek: Uint8Array.from(SEALED.linkKey),
    mime: 'video/mp4',
  };
}

function makeState(over?: Partial<LoopbackServerState>): LoopbackServerState {
  return {
    token: armedToken(),
    now: () => NOW,
    resolveItem: (id) => (id === CONTENT_ID ? makeItem() : null),
    getBlockPayload: makeGetBlockPayload(),
    ...over,
  };
}

function rawRequest(method: string, target: string, headers: string[] = []): string {
  return [`${method} ${target} HTTP/1.1`, 'Host: 127.0.0.1', ...headers].join('\r\n') + '\r\n\r\n';
}

function playbackTarget(token = TOKEN, contentId = CONTENT_ID): string {
  return `/v1/${token}/${contentId}`;
}

async function drain(body: AsyncGenerator<Uint8Array> | null): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const parts: Uint8Array[] = [];
  for await (const p of body) parts.push(p);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// --- HTTP request parsing ----------------------------------------------------

describe('parseHttpRequest', () => {
  it('parses a GET with lower-cased headers, ignoring the body region', () => {
    const raw = rawRequest('GET', playbackTarget(), ['Range: bytes=0-15', 'User-Agent: AVPlayer']);
    const res = parseHttpRequest(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.request.method).toBe('GET');
    expect(res.request.path).toBe(playbackTarget());
    expect(res.request.headers['range']).toBe('bytes=0-15');
    expect(res.request.headers['user-agent']).toBe('AVPlayer');
  });

  it('tolerates bare LF line endings', () => {
    const raw = `HEAD ${playbackTarget()} HTTP/1.1\nRange: bytes=-10\n\n`;
    const res = parseHttpRequest(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.request.method).toBe('HEAD');
    expect(res.request.headers['range']).toBe('bytes=-10');
  });

  it('accepts a Uint8Array request head', () => {
    const raw = rawRequest('GET', playbackTarget());
    const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    const res = parseHttpRequest(bytes);
    expect(res.ok).toBe(true);
  });

  it('rejects an empty / request-line-less head as 400', () => {
    expect(parseHttpRequest('')).toEqual({ ok: false, status: 400 });
    expect(parseHttpRequest('GET\r\n\r\n')).toEqual({ ok: false, status: 400 });
  });

  it('rejects an oversized head as 431 before parsing', () => {
    const huge = 'GET / HTTP/1.1\r\n' + 'X-Pad: ' + 'a'.repeat(MAX_REQUEST_BYTES) + '\r\n\r\n';
    expect(parseHttpRequest(huge)).toEqual({ ok: false, status: 431 });
  });

  it('rejects a header-line flood as 431', () => {
    const floods = Array.from({ length: 200 }, (_, i) => `X-H${i}: v`);
    const raw = rawRequest('GET', playbackTarget(), floods);
    expect(parseHttpRequest(raw)).toEqual({ ok: false, status: 431 });
  });
});

describe('parsePlaybackPath', () => {
  it('parses /v1/<token>/<contentId> and ignores a query string', () => {
    expect(parsePlaybackPath('/v1/tok/cid')).toEqual({ token: 'tok', contentId: 'cid' });
    expect(parsePlaybackPath('/v1/tok/cid?x=1')).toEqual({ token: 'tok', contentId: 'cid' });
  });

  it('returns null for any other shape', () => {
    expect(parsePlaybackPath('/v1/tok')).toBeNull();
    expect(parsePlaybackPath('/v2/tok/cid')).toBeNull();
    expect(parsePlaybackPath('/tok/cid')).toBeNull();
    expect(parsePlaybackPath('/v1//cid')).toBeNull();
    expect(parsePlaybackPath('/v1/tok/cid/extra')).toBeNull();
  });

  it('fails closed (null, never throws) on malformed percent-encoding', () => {
    // decodeURIComponent throws URIError on a truncated escape like '%E0%A4%A';
    // the parser must swallow it and return null so the server answers a bounded 404.
    expect(() => parsePlaybackPath('/v1/tok/%E0%A4%A')).not.toThrow();
    expect(parsePlaybackPath('/v1/tok/%E0%A4%A')).toBeNull();
    expect(parsePlaybackPath('/v1/tok/%')).toBeNull();
    expect(parsePlaybackPath('/v1/tok/%zz')).toBeNull();
    // A well-formed escape still decodes normally.
    expect(parsePlaybackPath('/v1/tok/a%2Fb')).toEqual({ token: 'tok', contentId: 'a/b' });
  });
});

// --- Token: mint / constant-time / TTL ---------------------------------------

describe('playback token', () => {
  it('mints a >=32-byte url-safe base64 token from the injected prng', () => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) bytes[i] = (i * 7 + 251) & 0xff;
    const token = mintPlaybackToken(() => bytes);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes -> 43 base64url chars
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('throws if the prng returns fewer than 32 bytes', () => {
    expect(() => mintPlaybackToken(() => new Uint8Array(16))).toThrow();
  });

  it('constantTimeEquals is length-safe and correct', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
    expect(constantTimeEquals('', '')).toBe(true);
    expect(constantTimeEquals('a', '')).toBe(false);
  });

  it('validates a fresh token and rejects an expired one or a null active token', () => {
    const token = armedToken();
    expect(isPlaybackTokenExpired(token, NOW)).toBe(false);
    expect(isPlaybackTokenExpired(token, NOW + 10_000)).toBe(true);
    expect(validatePlaybackToken(token, TOKEN, NOW)).toBe(true);
    expect(validatePlaybackToken(token, 'wrong', NOW)).toBe(false);
    expect(validatePlaybackToken(token, TOKEN, NOW + 10_000)).toBe(false); // expired
    expect(validatePlaybackToken(null, TOKEN, NOW)).toBe(false); // not armed
  });
});

// --- Range parsing + chunk window --------------------------------------------

describe('parseRangeHeader', () => {
  it('no header -> full', () => {
    expect(parseRangeHeader(undefined, TOTAL)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('', TOTAL)).toEqual({ kind: 'full' });
  });

  it('bytes=a-b (inclusive), clamping the end to EOF', () => {
    expect(parseRangeHeader('bytes=20-50', TOTAL)).toEqual({ kind: 'range', range: { start: 20, end: 50 } });
    expect(parseRangeHeader('bytes=60-999', TOTAL)).toEqual({ kind: 'range', range: { start: 60, end: 69 } });
  });

  it('bytes=a- (open-ended)', () => {
    expect(parseRangeHeader('bytes=32-', TOTAL)).toEqual({ kind: 'range', range: { start: 32, end: 69 } });
  });

  it('bytes=-suffix (last N bytes)', () => {
    expect(parseRangeHeader('bytes=-10', TOTAL)).toEqual({ kind: 'range', range: { start: 60, end: 69 } });
    expect(parseRangeHeader('bytes=-999', TOTAL)).toEqual({ kind: 'range', range: { start: 0, end: 69 } });
  });

  it('unknown unit, multi-range, and malformed values fall back to full (200)', () => {
    expect(parseRangeHeader('items=0-5', TOTAL)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=0-5,10-15', TOTAL)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=abc', TOTAL)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=1-x', TOTAL)).toEqual({ kind: 'full' });
  });

  it('a well-formed but out-of-bounds range is unsatisfiable (416)', () => {
    expect(parseRangeHeader('bytes=70-80', TOTAL)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=100-200', TOTAL)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=-0', TOTAL)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=0-0', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=5-6', 5)).toEqual({ kind: 'unsatisfiable' });
  });
});

describe('rangeToChunkWindow', () => {
  it('maps a mid-chunk seek to a skip into the first chunk', () => {
    expect(rangeToChunkWindow({ start: 20, end: 50 }, CHUNK_SIZE)).toEqual({
      firstChunk: 1,
      lastChunk: 3,
      skipBytesInFirst: 4,
      takeBytes: 31,
    });
  });

  it('maps an exact single chunk', () => {
    expect(rangeToChunkWindow({ start: 16, end: 31 }, CHUNK_SIZE)).toEqual({
      firstChunk: 1,
      lastChunk: 1,
      skipBytesInFirst: 0,
      takeBytes: 16,
    });
  });

  it('maps a chunk-boundary crossing', () => {
    expect(rangeToChunkWindow({ start: 15, end: 16 }, CHUNK_SIZE)).toEqual({
      firstChunk: 0,
      lastChunk: 1,
      skipBytesInFirst: 15,
      takeBytes: 2,
    });
  });
});

// --- Response head builders --------------------------------------------------

describe('response head builders', () => {
  it('200 full head', () => {
    const h = buildFullHead(TOTAL, 'video/mp4');
    expect(h.status).toBe(200);
    expect(h.headers['Content-Length']).toBe('70');
    expect(h.headers['Accept-Ranges']).toBe('bytes');
    expect(h.headers['Content-Type']).toBe('video/mp4');
    expect(h.headers['Content-Range']).toBeUndefined();
  });

  it('206 partial head', () => {
    const h = buildPartialHead({ start: 20, end: 50 }, TOTAL, 'video/mp4');
    expect(h.status).toBe(206);
    expect(h.headers['Content-Range']).toBe('bytes 20-50/70');
    expect(h.headers['Content-Length']).toBe('31');
  });

  it('416 unsatisfiable head carries bytes */total', () => {
    const h = buildUnsatisfiableHead(TOTAL);
    expect(h.status).toBe(416);
    expect(h.headers['Content-Range']).toBe('bytes */70');
    expect(h.headers['Content-Length']).toBe('0');
  });

  it('405 advertises Allow', () => {
    expect(buildErrorHead(405).headers['Allow']).toBe('GET, HEAD');
  });
});

// --- End-to-end through the orchestrator with REAL sealed fixtures -----------

describe('handleLoopbackRequest (real sealed blocks)', () => {
  it('206 happy path: correct Content-Range/Length and verified bytes', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=20-50']));
    expect(res.head.status).toBe(206);
    expect(res.head.headers['Content-Range']).toBe('bytes 20-50/70');
    expect(res.head.headers['Content-Length']).toBe('31');
    const body = await drain(res.body);
    expect(body).toEqual(PLAINTEXT.slice(20, 51));
  });

  it('bytes=a- open-ended range streams to EOF', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=32-']));
    expect(res.head.status).toBe(206);
    expect(res.head.headers['Content-Range']).toBe('bytes 32-69/70');
    expect(await drain(res.body)).toEqual(PLAINTEXT.slice(32, 70));
  });

  it('bytes=-suffix range streams the last N bytes', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=-10']));
    expect(res.head.status).toBe(206);
    expect(res.head.headers['Content-Range']).toBe('bytes 60-69/70');
    expect(await drain(res.body)).toEqual(PLAINTEXT.slice(60, 70));
  });

  it('seek into the MIDDLE of a chunk starts at the exact byte', async () => {
    // start=21 is 5 bytes into chunk 1 (16..31): decrypt-then-skip must be exact.
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=21-27']));
    expect(res.head.status).toBe(206);
    expect(await drain(res.body)).toEqual(PLAINTEXT.slice(21, 28));
  });

  it('a range crossing a chunk boundary reassembles correctly', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=15-16']));
    expect(res.head.status).toBe(206);
    expect(await drain(res.body)).toEqual(PLAINTEXT.slice(15, 17));
  });

  it('no Range header -> 200 with the full verified content', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget()));
    expect(res.head.status).toBe(200);
    expect(res.head.headers['Content-Length']).toBe('70');
    expect(await drain(res.body)).toEqual(PLAINTEXT);
  });

  it('416 for a past-EOF range, with no body', async () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(), ['Range: bytes=70-99']));
    expect(res.head.status).toBe(416);
    expect(res.head.headers['Content-Range']).toBe('bytes */70');
    expect(res.body).toBeNull();
  });

  it('401 on a wrong token (through the constant-time path), no body', () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget('not-the-token')));
    expect(res.head.status).toBe(401);
    expect(res.body).toBeNull();
  });

  it('401 on an expired token', () => {
    const res = handleLoopbackRequest(
      makeState({ now: () => NOW + 20_000 }),
      rawRequest('GET', playbackTarget()),
    );
    expect(res.head.status).toBe(401);
  });

  it('401 when the server is not armed (null active token)', () => {
    const res = handleLoopbackRequest(makeState({ token: null }), rawRequest('GET', playbackTarget()));
    expect(res.head.status).toBe(401);
  });

  it('404 for an unknown contentId', () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', playbackTarget(TOKEN, 'deadbeef')));
    expect(res.head.status).toBe(404);
    expect(res.body).toBeNull();
  });

  it('404 for a malformed path shape', () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('GET', '/wrong/shape'));
    expect(res.head.status).toBe(404);
  });

  it('405 for POST (and any non GET/HEAD verb), advertising Allow', () => {
    const res = handleLoopbackRequest(makeState(), rawRequest('POST', playbackTarget()));
    expect(res.head.status).toBe(405);
    expect(res.head.headers['Allow']).toBe('GET, HEAD');
    expect(res.body).toBeNull();
  });

  it('HEAD returns the GET headers with no body', () => {
    const full = handleLoopbackRequest(makeState(), rawRequest('HEAD', playbackTarget()));
    expect(full.head.status).toBe(200);
    expect(full.head.headers['Content-Length']).toBe('70');
    expect(full.body).toBeNull();

    const partial = handleLoopbackRequest(makeState(), rawRequest('HEAD', playbackTarget(), ['Range: bytes=20-50']));
    expect(partial.head.status).toBe(206);
    expect(partial.head.headers['Content-Range']).toBe('bytes 20-50/70');
    expect(partial.head.headers['Content-Length']).toBe('31');
    expect(partial.body).toBeNull();
  });

  it('431 for an oversized request head', () => {
    const huge = 'GET / HTTP/1.1\r\nX-Pad: ' + 'a'.repeat(MAX_REQUEST_BYTES) + '\r\n\r\n';
    const res = handleLoopbackRequest(makeState(), huge);
    expect(res.head.status).toBe(431);
  });

  it('a tampered block payload aborts the stream mid-flight (fail-closed)', async () => {
    // Corrupt chunk 2's ciphertext so authenticated decrypt fails.
    const good = payloadMap(SHARE);
    const targetId = SEALED_CHUNK_IDS[2]!;
    const original = good.get(targetId)!;
    const dot = original.indexOf('.');
    const ct = original.slice(dot + 1);
    const flipped = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    const overrides = new Map<string, string>([[targetId, `${original.slice(0, dot)}.${flipped}`]]);

    const state = makeState({ getBlockPayload: makeGetBlockPayload(overrides) });
    // Range spans chunks 1..3; chunk 2 is tampered, so the drain must reject.
    const res = handleLoopbackRequest(state, rawRequest('GET', playbackTarget(), ['Range: bytes=20-60']));
    expect(res.head.status).toBe(206);
    await expect(drain(res.body)).rejects.toThrow();
  });

  it('a missing block aborts the stream', async () => {
    const state = makeState({ getBlockPayload: async () => null });
    const res = handleLoopbackRequest(state, rawRequest('GET', playbackTarget(), ['Range: bytes=0-15']));
    await expect(drain(res.body)).rejects.toThrow();
  });
});

// --- makeChunkStream contract: hash verification + DEK zeroing ---------------

describe('makeChunkStream', () => {
  it('verifies each chunk against the SIGNED manifest before yielding', async () => {
    const dek = Uint8Array.from(SEALED.linkKey);
    const window = rangeToChunkWindow({ start: 0, end: TOTAL - 1 }, CHUNK_SIZE);
    const gen = makeChunkStream({
      getBlockPayload: makeGetBlockPayload(),
      manifest: {
        contentId: CONTENT_ID,
        chunkSize: CHUNK_SIZE,
        chunkHashes: SHARE.manifest.chunkHashes,
        size: TOTAL,
      },
      sealedChunkIds: SEALED_CHUNK_IDS,
      dek,
      window,
    });
    expect(await drain(gen)).toEqual(PLAINTEXT);
  });

  it('zeroes the DEK after the stream completes', async () => {
    const dek = Uint8Array.from(SEALED.linkKey);
    const window = rangeToChunkWindow({ start: 0, end: 15 }, CHUNK_SIZE);
    await drain(
      makeChunkStream({
        getBlockPayload: makeGetBlockPayload(),
        manifest: {
          contentId: CONTENT_ID,
          chunkSize: CHUNK_SIZE,
          chunkHashes: SHARE.manifest.chunkHashes,
          size: TOTAL,
        },
        sealedChunkIds: SEALED_CHUNK_IDS,
        dek,
        window,
      }),
    );
    expect(dek.every((b) => b === 0)).toBe(true);
  });

  it('rejects when the manifest hash does not match the decrypted plaintext', async () => {
    const dek = Uint8Array.from(SEALED.linkKey);
    const badHashes = [...SHARE.manifest.chunkHashes];
    badHashes[0] = 'deadbeef';
    const gen = makeChunkStream({
      getBlockPayload: makeGetBlockPayload(),
      manifest: { contentId: CONTENT_ID, chunkSize: CHUNK_SIZE, chunkHashes: badHashes, size: TOTAL },
      sealedChunkIds: SEALED_CHUNK_IDS,
      dek,
      window: rangeToChunkWindow({ start: 0, end: 15 }, CHUNK_SIZE),
    });
    await expect(drain(gen)).rejects.toThrow();
  });
});
