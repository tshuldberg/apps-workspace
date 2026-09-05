/**
 * Content-host registry client (share-link host discovery).
 *
 * The twin of rendezvous-client.ts, against the relay's MULTI-announcer,
 * NON-consuming registry verbs (`ann`/`lk`) instead of the single-record
 * one-time `pub`/`res`. A seeder announces an OPAQUE host record under a derived
 * rid; a resolver looks up the whole live set of records for that rid. As with
 * rendezvous, the relay treats `rec` as opaque base64 it copies verbatim -- what
 * the record contains (here, a secretbox of a web-seed url, keyed by a secret
 * only share-link holders can derive) is the caller's concern; see
 * node/host-registry.ts for the contentId-aware layer on top.
 *
 * Uses the platform global `WebSocket` (React Native, browsers, Node 22+), so it
 * adds no dependency. One operation per connection: announce or lookup, then bye.
 */

interface MinimalWebSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', handler: () => void): void;
  addEventListener(type: 'close', handler: () => void): void;
  addEventListener(type: 'error', handler: (ev: unknown) => void): void;
  addEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
}

type WebSocketCtor = new (url: string) => MinimalWebSocket;

function resolveWebSocket(provided?: WebSocketCtor): WebSocketCtor {
  if (provided) return provided;
  const g = globalThis as unknown as { WebSocket?: WebSocketCtor };
  if (!g.WebSocket) {
    throw new Error('No global WebSocket available; pass a WebSocket constructor.');
  }
  return g.WebSocket;
}

interface ServerFrame {
  t?: string;
  rid?: string;
  rec?: string;
  recs?: unknown;
  code?: string;
  msg?: string;
}

function parseFrame(data: unknown): ServerFrame | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as ServerFrame;
  } catch {
    return null;
  }
}

export interface RegistryClientOptions {
  /** Inject a WebSocket constructor (defaults to the global one). */
  webSocketImpl?: WebSocketCtor;
  /** Timeout for the whole announce/lookup round-trip. Default 10s. */
  timeoutMs?: number;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
}

export interface AnnounceHostInput extends RegistryClientOptions {
  url: string;
  /** Hex registry id (HKDF-derived from a contentId; the relay never sees the id source). */
  rid: string;
  /** Opaque record stored verbatim by the relay. */
  record: string;
  /** Requested TTL; the relay clamps it to its own maximum. */
  ttlMs?: number;
}

export interface LookupHostsInput extends RegistryClientOptions {
  url: string;
  rid: string;
}

/** A single WS round-trip: open, send one frame, await one reply, close. */
function registryRoundTrip<T>(
  url: string,
  options: RegistryClientOptions,
  requestFrame: Record<string, unknown>,
  onReply: (frame: ServerFrame, resolve: (value: T) => void, reject: (err: Error) => void) => void,
): Promise<T> {
  const WS = resolveWebSocket(options.webSocketImpl);
  const timeoutMs = options.timeoutMs ?? 10_000;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const socket = new WS(url);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.send(JSON.stringify({ t: 'bye' }));
      } catch {
        // ignore: socket may already be closing
      }
      socket.close(1000, 'done');
      fn();
    };

    const timer = setTimeout(() => finish(() => reject(new Error('Registry operation timed out.'))), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    socket.addEventListener('open', () => socket.send(JSON.stringify(requestFrame)));

    socket.addEventListener('message', (ev) => {
      const frame = parseFrame(ev.data);
      if (!frame || !frame.t) return;
      onReply(
        frame,
        (value) => finish(() => resolve(value)),
        (err) => finish(() => reject(err)),
      );
    });

    socket.addEventListener('error', () => finish(() => reject(new Error('Registry connection failed.'))));
    socket.addEventListener('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Registry connection closed before a reply.'));
    });
  });
}

/** Announce an opaque host record under a registry rid. Rejects on relay error. */
export function announceHost(input: AnnounceHostInput): Promise<void> {
  const request: Record<string, unknown> = { t: 'ann', rid: input.rid, rec: input.record };
  if (input.ttlMs != null) request.ttlMs = input.ttlMs;
  if (input.entitlementToken) request.entitlement = input.entitlementToken;
  return registryRoundTrip<void>(input.url, input, request, (frame, resolve, reject) => {
    if (frame.t === 'annok') resolve();
    else if (frame.t === 'err') reject(new Error(`Registry announce rejected: ${frame.code ?? 'unknown'}`));
  });
}

/**
 * Look up ALL live opaque host records announced under a registry rid. Returns
 * an empty array when nothing is announced (a normal outcome, not an error).
 */
export function lookupHosts(input: LookupHostsInput): Promise<string[]> {
  const request: Record<string, unknown> = { t: 'lk', rid: input.rid };
  if (input.entitlementToken) request.entitlement = input.entitlementToken;
  return registryRoundTrip<string[]>(input.url, input, request, (frame, resolve, reject) => {
    if (frame.t === 'hosts') {
      const recs = Array.isArray(frame.recs)
        ? frame.recs.filter((r): r is string => typeof r === 'string')
        : [];
      resolve(recs);
    } else if (frame.t === 'err') {
      reject(new Error(`Registry lookup rejected: ${frame.code ?? 'unknown'}`));
    }
  });
}
