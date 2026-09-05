// Plan 38 Phase 6a (MOBILE, amendment D.5): the react-native-tcp-socket GLUE for
// the loopback A/V range server. The protocol brain is the pure, socket-free
// loopback-server-core.ts (exhaustively tested under node against real sealed
// fixtures); this file only:
//   1. binds 127.0.0.1 on an ephemeral port (loopback ONLY -- never routable),
//   2. pumps raw socket bytes through handleLoopbackRequest and serializes the
//      head + streamed body back,
//   3. mints the per-session URL-path token and hands the player a URL,
//   4. dies with the process (stop() closes the server and zeroes the DEK).
//
// It is a NATIVE-module path exactly like data/lan-backend.ts: react-native-tcp-
// socket exists only in a dev/EAS build, so it is lazy-required and returns null
// in Expo Go. No A/V plaintext is ever written to disk -- the player pulls
// verified plaintext ranges over loopback, and each range is decrypted on the fly
// and zeroed after the stream. The pure pump + head serializer are exported so
// they are testable against an in-memory duplex without a socket.

import type { DatabaseAdapter } from '@mylife/db';
import {
  unwrapLibraryObjectKeyForDevice,
  type DeviceIdentity,
  type NodeStore,
} from '@mylife/sync';
import type { LibraryItemEvent } from './library-data-core';
import {
  handleLoopbackRequest,
  mintPlaybackToken,
  MAX_REQUEST_BYTES,
  type LoopbackItem,
  type LoopbackServerState,
  type PlaybackToken,
  type PrngBytes,
  type ResponseHead,
} from './loopback-server-core';

/** Honest copy when the loopback server cannot run (no dev-build native module). */
export const LOOPBACK_UNAVAILABLE =
  'In-app playback needs a development build (the loopback media module is not in Expo Go).';

/** How long a session token stays valid. A play session is short; the server dies with the screen. */
const DEFAULT_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h ceiling; the server usually stops first.

// ---------------------------------------------------------------------------
// Playback pin hold (amendment C.7 seam): while the loopback server is serving an
// item, its content id is "held" so a future LRU evictor never deletes blocks
// mid-play. Eviction is not wired in this phase; this is the real registry it
// will consult. It is a module singleton (device-local, never synced).
// ---------------------------------------------------------------------------

const playbackHolds = new Set<string>();

/** Register a playback hold for a content id (idempotent). */
export function holdPlayback(contentId: string): void {
  playbackHolds.add(contentId);
}
/** Release a playback hold. */
export function releasePlayback(contentId: string): void {
  playbackHolds.delete(contentId);
}
/** True while `contentId` is being played (the future evictor must skip it). */
export function isPlaybackHeld(contentId: string): boolean {
  return playbackHolds.has(contentId);
}

// ---------------------------------------------------------------------------
// Item resolution: LibraryItemEvent -> a servable LoopbackItem (or null).
// ---------------------------------------------------------------------------

interface ParsedItemManifest {
  manifest: { contentId: string; chunkSize: number; chunkHashes: string[]; size: number };
  sealedChunkIds: string[];
}

function parseItemManifest(manifestJson: string): ParsedItemManifest | null {
  try {
    const parsed = JSON.parse(manifestJson) as {
      manifest?: { contentId?: string; chunkSize?: number; chunkHashes?: unknown; size?: number };
      sealedChunkIds?: unknown;
    };
    const m = parsed.manifest;
    if (!m || typeof m.contentId !== 'string' || typeof m.chunkSize !== 'number'
      || typeof m.size !== 'number' || !Array.isArray(m.chunkHashes)) return null;
    if (!Array.isArray(parsed.sealedChunkIds)) return null;
    const chunkHashes = m.chunkHashes.filter((h): h is string => typeof h === 'string');
    const sealedChunkIds = parsed.sealedChunkIds.filter((s): s is string => typeof s === 'string');
    if (chunkHashes.length !== m.chunkHashes.length || sealedChunkIds.length !== parsed.sealedChunkIds.length) {
      return null;
    }
    return {
      manifest: { contentId: m.contentId, chunkSize: m.chunkSize, chunkHashes, size: m.size },
      sealedChunkIds,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a verified library item into the master DEK + manifest the loopback
 * server serves. Null when this device cannot unwrap the epoch (locked item) or
 * the row's manifest is unparseable. The caller owns the returned DEK and must
 * zero it when the server stops.
 */
export function resolveLoopbackMaster(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  item: LibraryItemEvent,
): { manifest: ParsedItemManifest['manifest']; sealedChunkIds: string[]; dek: Uint8Array; mime?: string } | null {
  if (item.tombstone) return null;
  const parsed = parseItemManifest(item.manifestJson);
  if (!parsed) return null;
  if (parsed.manifest.contentId !== item.contentCid) return null;
  const dek = unwrapLibraryObjectKeyForDevice(db, identity, item.communityId, item.keyEpoch, item.wrappedKey);
  if (!dek) return null;
  return {
    manifest: parsed.manifest,
    sealedChunkIds: parsed.sealedChunkIds,
    dek,
    ...(item.mimeType ? { mime: item.mimeType } : {}),
  };
}

// ---------------------------------------------------------------------------
// Response head serialization + the socket-agnostic connection pump.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Serialize a response head to an HTTP/1.1 head block. Always `Connection: close`. */
export function serializeResponseHead(head: ResponseHead): string {
  const lines = [`HTTP/1.1 ${head.status} ${head.statusText}`];
  for (const [name, value] of Object.entries(head.headers)) lines.push(`${name}: ${value}`);
  lines.push('Connection: close');
  return lines.join('\r\n') + '\r\n\r\n';
}

/** The minimal socket the pump drives (react-native-tcp-socket is adapted to it). */
export interface LoopbackSocket {
  write(data: Uint8Array): void;
  onData(handler: (chunk: Uint8Array) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Index just past the end-of-head blank line (\r\n\r\n or \n\n), or -1. */
function headEndIndex(buf: Uint8Array): number {
  for (let i = 3; i < buf.length; i += 1) {
    if (buf[i - 3] === 0x0d && buf[i - 2] === 0x0a && buf[i - 1] === 0x0d && buf[i] === 0x0a) return i + 1;
  }
  for (let i = 1; i < buf.length; i += 1) {
    if (buf[i - 1] === 0x0a && buf[i] === 0x0a) return i + 1;
  }
  return -1;
}

/**
 * Pump ONE request/response over a connection: accumulate bytes until the head is
 * complete, run it through the pure handler, write the serialized head, then
 * stream the verified body chunks (a decrypt/verify failure aborts by closing the
 * socket -- unverified bytes never reach the player). One request per connection
 * (Connection: close); real players reconnect per range. Resolves when done.
 */
export function pumpLoopbackConnection(state: LoopbackServerState, socket: LoopbackSocket): Promise<void> {
  return new Promise<void>((resolve) => {
    let buffer: Uint8Array = new Uint8Array(0);
    let handled = false;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      try { socket.close(); } catch { /* already closed */ }
      resolve();
    };

    socket.onClose(() => { if (!done) { done = true; resolve(); } });

    socket.onData((chunk) => {
      if (handled) return;
      buffer = concat(buffer, chunk);
      const end = headEndIndex(buffer);
      if (end === -1) {
        // No complete head yet; guard against a head-flood before we allocate more.
        if (buffer.length > MAX_REQUEST_BYTES) {
          handled = true;
          socket.write(encoder.encode(serializeResponseHead({
            status: 431, statusText: 'Request Header Fields Too Large', headers: { 'Content-Length': '0' },
          })));
          finish();
        }
        return;
      }
      handled = true;
      const res = handleLoopbackRequest(state, buffer.subarray(0, end));
      socket.write(encoder.encode(serializeResponseHead(res.head)));
      const body = res.body;
      if (!body) { finish(); return; }
      void (async () => {
        try {
          for await (const part of body) socket.write(part);
        } catch {
          // Fail-closed: a mid-stream verify failure aborts the response by closing.
        } finally {
          finish();
        }
      })();
    });
  });
}

// ---------------------------------------------------------------------------
// The native tcp-socket server (lazy, dev-build only, loopback bind).
// ---------------------------------------------------------------------------

interface TcpSocketLike {
  write(data: Uint8Array): void;
  on(event: 'data', handler: (data: unknown) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: unknown) => void): void;
  destroy(): void;
}
interface TcpServerLike {
  listen(options: { port: number; host: string }, callback?: () => void): void;
  close(callback?: () => void): void;
  address(): { port: number } | null;
}
interface TcpSocketModule {
  createServer(onSocket: (socket: TcpSocketLike) => void): TcpServerLike;
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data && typeof data === 'object' && 'buffer' in (data as Record<string, unknown>)) {
    return new Uint8Array(data as ArrayBufferView as Uint8Array);
  }
  return new Uint8Array(0);
}

function loadTcpSocketModule(): TcpSocketModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-tcp-socket') as TcpSocketModule;
  } catch {
    return null;
  }
}

function loadExpoPrng(): PrngBytes | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as { getRandomBytes: (n: number) => Uint8Array };
    return (n: number) => Crypto.getRandomBytes(n);
  } catch {
    return null;
  }
}

function wrapTcpSocket(socket: TcpSocketLike): LoopbackSocket {
  return {
    write: (data) => socket.write(data),
    onData: (handler) => socket.on('data', (chunk) => handler(toBytes(chunk))),
    onClose: (handler) => {
      socket.on('close', handler);
      socket.on('error', handler);
    },
    close: () => socket.destroy(),
  };
}

export interface StartLoopbackServerArgs {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  item: LibraryItemEvent;
  /** Injectable for tests; defaults to expo-crypto. */
  prng?: PrngBytes;
  tokenTtlMs?: number;
}

export interface RunningLoopbackServer {
  /** The loopback URL the native player opens: http://127.0.0.1:<port>/v1/<token>/<contentId>. */
  url: string;
  stop(): Promise<void>;
}

/**
 * Start the loopback range server for one item. Throws LOOPBACK_UNAVAILABLE in
 * Expo Go (no tcp-socket), and a locked/unplayable error when the item cannot be
 * resolved (no epoch on this device, bad manifest). The DEK is held for the
 * server's life and zeroed on stop.
 */
export async function startLoopbackServer(args: StartLoopbackServerArgs): Promise<RunningLoopbackServer> {
  const tcp = loadTcpSocketModule();
  const prng = args.prng ?? loadExpoPrng();
  if (!tcp || !prng) throw new Error(LOOPBACK_UNAVAILABLE);

  const master = resolveLoopbackMaster(args.db, args.identity, args.item);
  if (!master) throw new Error('This item is not playable on this device yet.');

  const token: PlaybackToken = {
    value: mintPlaybackToken(prng),
    createdAtMs: Date.now(),
    maxAgeMs: args.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS,
  };

  const state: LoopbackServerState = {
    token,
    now: () => Date.now(),
    // A fresh DEK copy per request: makeChunkStream zeroes the DEK it is handed.
    resolveItem: (contentId): LoopbackItem | null =>
      contentId === master.manifest.contentId
        ? {
            manifest: master.manifest,
            sealedChunkIds: master.sealedChunkIds,
            dek: Uint8Array.from(master.dek),
            ...(master.mime ? { mime: master.mime } : {}),
          }
        : null,
    getBlockPayload: (sealedId) => args.store.getBlock(sealedId),
  };

  const server = tcp.createServer((socket) => {
    void pumpLoopbackConnection(state, wrapTcpSocket(socket));
  });

  const port = await new Promise<number>((resolve, reject) => {
    try {
      server.listen({ port: 0, host: '127.0.0.1' }, () => resolve(server.address()?.port ?? 0));
      // A tcp-socket server surfaces bind failures via an 'error' the listen
      // callback never fires for; guard with a short timeout is unnecessary here
      // because 127.0.0.1:0 cannot fail to bind on a live device.
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  if (!port) {
    master.dek.fill(0);
    try { server.close(); } catch { /* ignore */ }
    throw new Error('The loopback server could not bind a local port.');
  }

  holdPlayback(master.manifest.contentId);

  let stopped = false;
  return {
    url: `http://127.0.0.1:${port}/v1/${token.value}/${master.manifest.contentId}`,
    stop: () =>
      new Promise<void>((resolve) => {
        if (stopped) { resolve(); return; }
        stopped = true;
        releasePlayback(master.manifest.contentId);
        master.dek.fill(0);
        try { server.close(() => resolve()); } catch { resolve(); }
      }),
  };
}
