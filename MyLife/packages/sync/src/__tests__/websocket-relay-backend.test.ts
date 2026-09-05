import { publishRendezvous } from '../transport/rendezvous-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketRelayBackend } from '../transport/websocket-relay-backend';

class Socket {
  static latest: Socket;
  readonly readyState = 1;
  sent: string[] = [];
  closed = false;
  private handlers = new Map<string, Array<(event: { data: unknown }) => void>>();
  constructor(readonly url: string) { Socket.latest = this; }
  addEventListener(type: string, handler: (event: { data: unknown }) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.closed = true; this.emit('close'); }
  emit(type: string, data?: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler({ data });
  }
}

afterEach(() => vi.useRealTimers());

describe('relay admission', () => {
  it('does not resolve until ready and buffers mailbox frames arriving with admission', async () => {
    const backend = new WebSocketRelayBackend({ webSocketImpl: Socket });
    let resolved = false;
    const pending = backend.connect('wss://relay.example', 'token').then((session) => { resolved = true; return session; });
    const socket = Socket.latest;
    socket.emit('open');
    await Promise.resolve();
    expect(resolved).toBe(false);
    socket.emit('message', JSON.stringify({ t: 'ready', peers: 0, queued: 1 }));
    socket.emit('message', JSON.stringify({ t: 'env', env: 'AQID' }));
    const session = await pending;
    const received: Uint8Array[] = [];
    session.onMessage((bytes) => received.push(bytes));
    expect(received).toEqual([new Uint8Array([1, 2, 3])]);
    backend.destroy();
  });

  it('rejects payment denial rather than returning a usable session', async () => {
    const backend = new WebSocketRelayBackend({ webSocketImpl: Socket });
    const pending = backend.connect('wss://relay.example', 'token');
    const rejected = expect(pending).rejects.toThrow('payment_required');
    Socket.latest.emit('open');
    Socket.latest.emit('message', JSON.stringify({ t: 'err', code: 'payment_required', msg: 'denied' }));
    await rejected;
    expect(Socket.latest.closed).toBe(true);
    backend.destroy();
  });

  it('rejects early close and destruction without waiting for timeout', async () => {
    for (const destroy of [false, true]) {
      const backend = new WebSocketRelayBackend({ webSocketImpl: Socket });
      const rejected = expect(backend.connect('wss://relay.example', 'token')).rejects.toThrow('closed');
      if (destroy) backend.destroy();
      else Socket.latest.close();
      await rejected;
      backend.destroy();
    }
  });

  it('bounds the entire admission handshake and closes the socket', async () => {
    vi.useFakeTimers();
    const backend = new WebSocketRelayBackend({ webSocketImpl: Socket, connectTimeoutMs: 100 });
    const rejected = expect(backend.connect('wss://relay.example', 'token')).rejects.toThrow('timed out');
    Socket.latest.emit('open');
    Socket.latest.emit('message', 'not json');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(Socket.latest.closed).toBe(true);
    backend.destroy();
  });
});


describe('friend publication receipts', () => {
  it.each([undefined, NaN, -1, 1_800_000_010_000])('reports only a valid expiry returned by the matching publication: %s', async (expiresAt) => {
    const pending = publishRendezvous({ url: 'wss://relay.example', rid: 'ab'.repeat(8), record: 'sealed', webSocketImpl: Socket });
    Socket.latest.emit('open');
    Socket.latest.emit('message', JSON.stringify({ t: 'pubok', rid: 'ab'.repeat(8), expiresAt }));
    expect(await pending).toEqual({ expiresAt: typeof expiresAt === 'number' && expiresAt > 0 ? expiresAt : null });
  });
});
