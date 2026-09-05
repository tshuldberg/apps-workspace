/**
 * Rendezvous client (plan 14, MK-016).
 *
 * A friend code resolves, via a relay's rendezvous store, to a published
 * record. This is the client half: open a short-lived WebSocket to a Meerkat
 * relay, publish (or resolve-and-consume) an OPAQUE record under a hex short id,
 * then close. The relay never parses the record -- to it, `rec` is opaque base64
 * exactly like a forwarded envelope. What the record contains (a signed identity
 * bundle, encrypted or not) is the caller's concern; see
 * node/friend-rendezvous.ts for the identity-bundle layer on top.
 *
 * Uses the platform global `WebSocket` (React Native, browsers, Node 22+), so it
 * adds no dependency. One operation per connection: publish or resolve, then bye.
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
  code?: string;
  msg?: string;
  expiresAt?: unknown;
}

function parseFrame(data: unknown): ServerFrame | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as ServerFrame;
  } catch {
    return null;
  }
}

export interface RendezvousClientOptions {
  /** Inject a WebSocket constructor (defaults to the global one). */
  webSocketImpl?: WebSocketCtor;
  /** Timeout for the whole publish/resolve round-trip. Default 10s. */
  timeoutMs?: number;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
}

export interface PublishRendezvousInput extends RendezvousClientOptions {
  url: string;
  /** Hex short id (a friend code's rendezvous id, hex-encoded). */
  rid: string;
  /** Opaque record stored verbatim by the relay. */
  record: string;
  /** Requested TTL; the relay clamps it to its own maximum. */
  ttlMs?: number;
}

export interface ResolveRendezvousInput extends RendezvousClientOptions {
  url: string;
  rid: string;
}

/** A single WS round-trip: open, send one frame, await one reply, close. */
function rendezvousRoundTrip<T>(
  url: string,
  options: RendezvousClientOptions,
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

    const timer = setTimeout(() => finish(() => reject(new Error('Rendezvous timed out.'))), timeoutMs);
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

    socket.addEventListener('error', () => finish(() => reject(new Error('Rendezvous connection failed.'))));
    socket.addEventListener('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Rendezvous connection closed before a reply.'));
    });
  });
}

export interface PublishRendezvousReceipt {
  /** Actual server deadline, or null for older relays that do not return it. */
  expiresAt: number | null;
}

/** Publish an opaque record under a short id. Rejects on relay error. */
export function publishRendezvous(input: PublishRendezvousInput): Promise<PublishRendezvousReceipt> {
  const request: Record<string, unknown> = { t: 'pub', rid: input.rid, rec: input.record };
  if (input.ttlMs != null) request.ttlMs = input.ttlMs;
  if (input.entitlementToken) request.entitlement = input.entitlementToken;
  return rendezvousRoundTrip<PublishRendezvousReceipt>(input.url, input, request, (frame, resolve, reject) => {
    if (frame.t === 'pubok' && frame.rid === input.rid) resolve({
      expiresAt: typeof frame.expiresAt === 'number' && Number.isSafeInteger(frame.expiresAt) && frame.expiresAt > 0
        ? frame.expiresAt : null,
    });
    else if (frame.t === 'err') reject(new Error(`Rendezvous publish rejected: ${frame.code ?? 'unknown'}`));
  });
}

/**
 * Resolve and consume a record by short id. Returns the opaque record string, or
 * null when nothing is published for that id (unknown, expired, or already used).
 */
export function resolveRendezvous(input: ResolveRendezvousInput): Promise<string | null> {
  const request: Record<string, unknown> = { t: 'res', rid: input.rid };
  if (input.entitlementToken) request.entitlement = input.entitlementToken;
  return rendezvousRoundTrip<string | null>(input.url, input, request, (frame, resolve, reject) => {
    if (frame.t === 'rec' && typeof frame.rec === 'string') resolve(frame.rec);
    else if (frame.t === 'err') {
      if (frame.code === 'not_found') resolve(null);
      else reject(new Error(`Rendezvous resolve rejected: ${frame.code ?? 'unknown'}`));
    }
  });
}
