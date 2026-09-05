/**
 * Real WebSocket relay backend (plan 14, MK-006).
 *
 * Implements the RelayBackend contract against a live @mylife/meerkat-relay
 * server using the platform global `WebSocket` (present in React Native,
 * browsers, and Node 22+), so it adds no dependency and runs everywhere the
 * app does. It speaks the relay wire protocol: send a `hello` with the
 * ephemeral token, then exchange `env` frames carrying base64 ciphertext.
 *
 * The relay sees only the opaque token and base64 envelopes; this backend
 * never sends device identity or plaintext.
 */

import naclUtil from 'tweetnacl-util';
import type { RelayBackend, RelayConnectOptions, RelaySession } from './relay-transport';

const { encodeBase64, decodeBase64 } = naclUtil;

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
    throw new Error('No global WebSocket available; pass a WebSocket constructor to WebSocketRelayBackend.');
  }
  return g.WebSocket;
}

class WebSocketRelaySession implements RelaySession {
  private readonly handlers: Array<(envelope: Uint8Array) => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  // Envelopes that arrive before a handler is attached (e.g. the relay drains
  // its mailbox to a peer immediately on join, before the app calls onMessage).
  // Buffer them and flush to the first handler so store-and-forward is not lost.
  private readonly pending: Uint8Array[] = [];
  private closed = false;
  private socketClosed = false;

  constructor(private readonly socket: MinimalWebSocket) {
    socket.addEventListener('close', () => {
      if (this.socketClosed) return;
      this.socketClosed = true;
      const handlers = this.closeHandlers.splice(0, this.closeHandlers.length);
      for (const h of handlers) {
        try {
          h();
        } catch {
          // A listener failure cannot break session teardown.
        }
      }
    });
    socket.addEventListener('message', (ev) => {
      if (this.closed) return;
      const env = this.extractEnv(ev.data);
      if (!env) return;
      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(env);
      } catch {
        return;
      }
      if (this.handlers.length === 0) {
        this.pending.push(bytes);
        return;
      }
      for (const h of this.handlers) h(bytes);
    });
  }

  async send(envelope: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('RelaySession is closed.');
    this.socket.send(JSON.stringify({ t: 'env', env: encodeBase64(envelope) }));
  }

  onMessage(handler: (envelope: Uint8Array) => void): void {
    this.handlers.push(handler);
    if (this.pending.length > 0) {
      const queued = this.pending.splice(0, this.pending.length);
      for (const bytes of queued) handler(bytes);
    }
  }

  onClose(handler: () => void): void {
    if (this.socketClosed) {
      handler();
      return;
    }
    this.closeHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.handlers.length = 0;
    try {
      this.socket.send(JSON.stringify({ t: 'bye' }));
    } catch {
      // ignore: socket may already be closing
    }
    this.socket.close(1000, 'closed');
  }

  private extractEnv(data: unknown): string | null {
    const text = typeof data === 'string' ? data : null;
    if (!text) return null;
    try {
      const frame = JSON.parse(text) as { t?: string; env?: string };
      return frame.t === 'env' && typeof frame.env === 'string' ? frame.env : null;
    } catch {
      return null;
    }
  }
}

export interface WebSocketRelayBackendOptions {
  /** Inject a WebSocket constructor (defaults to the global one). */
  webSocketImpl?: WebSocketCtor;
  /** Timeout for the open + ready handshake. Default 10s. */
  connectTimeoutMs?: number;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string | (() => string | null | undefined);
}

/**
 * RelayBackend backed by a real WebSocket connection to a Meerkat relay server.
 */
export class WebSocketRelayBackend implements RelayBackend {
  private readonly WS: WebSocketCtor;
  private readonly connectTimeoutMs: number;
  private readonly entitlementToken?: string | (() => string | null | undefined);
  private readonly sockets = new Set<MinimalWebSocket>();
  private destroyed = false;

  constructor(options: WebSocketRelayBackendOptions = {}) {
    this.WS = resolveWebSocket(options.webSocketImpl);
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.entitlementToken = options.entitlementToken;
  }

  connect(url: string, token: string, options: RelayConnectOptions = {}): Promise<RelaySession> {
    if (this.destroyed) return Promise.reject(new Error('Backend is destroyed.'));
    if (token.trim().length === 0) return Promise.reject(new Error('Relay token is required.'));

    return new Promise<RelaySession>((resolve, reject) => {
      let settled = false;
      const socket = new this.WS(url);
      this.sockets.add(socket);

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.sockets.delete(socket);
        try { socket.close(); } catch { /* Preserve the admission failure. */ }
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('Relay connect timed out.')), this.connectTimeoutMs);
      (timer as { unref?: () => void }).unref?.();

      // Attach before admission so queued envelopes cannot be lost between ready
      // and the caller registering its handler.
      const session = new WebSocketRelaySession(socket);
      socket.addEventListener('open', () => {
        if (settled) return;
        try {
          const entitlement = options.entitlementToken ?? this.resolveEntitlementToken();
          const hello: { t: 'hello'; token: string; entitlement?: string } = { t: 'hello', token };
          if (entitlement) hello.entitlement = entitlement;
          socket.send(JSON.stringify(hello));
        } catch {
          fail(new Error('Relay hello failed.'));
        }
      });
      socket.addEventListener('message', (event) => {
        if (settled || typeof event.data !== 'string') return;
        let frame: { t?: unknown; code?: unknown };
        try { frame = JSON.parse(event.data) as typeof frame; } catch { return; }
        if (!frame || typeof frame !== 'object') return;
        if (frame.t === 'err') {
          const code = typeof frame.code === 'string' && /^[a-z_]{1,64}$/u.test(frame.code)
            ? frame.code : 'rejected';
          fail(new Error(`Relay access rejected (${code}).`));
        } else if (frame.t === 'ready') {
          settled = true;
          clearTimeout(timer);
          resolve(session);
        }
      });
      socket.addEventListener('error', () => fail(new Error('Relay connection failed.')));
      socket.addEventListener('close', () => {
        this.sockets.delete(socket);
        fail(new Error('Relay closed before accepting the connection.'));
      });
    });
  }

  private resolveEntitlementToken(): string | undefined {
    const value = typeof this.entitlementToken === 'function'
      ? this.entitlementToken()
      : this.entitlementToken;
    return value?.trim() ? value : undefined;
  }

  destroy(): void {
    for (const socket of this.sockets) {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
    this.sockets.clear();
    this.destroyed = true;
  }
}
