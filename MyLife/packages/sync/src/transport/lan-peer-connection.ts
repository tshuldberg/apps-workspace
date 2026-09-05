/**
 * LAN peer connections over an injectable socket backend (MK-007).
 *
 * Mirrors the relay pattern that made WAN transport real: the platform
 * supplies a LanSocketBackend (react-native-tcp-socket on phones, node:net on
 * desktops/tests), and this module turns raw sockets into the framed
 * TransportConnections the sync session protocol speaks. Length-prefix framing
 * (frame-codec.ts) restores message boundaries on the TCP byte stream, and
 * envelopes that arrive before the session attaches its handler are buffered,
 * never dropped (the relay mailbox-race lesson).
 *
 * Authentication is NOT this layer's job: the Ed25519 handshake inside the
 * session verifies the peer, so a wrong host:port fails the session instead of
 * impersonating a device. RN-safe: no Node imports; the backend is injected.
 */

import type { TransportConnection } from '../types';
import { FrameDecoder, encodeFrame } from './frame-codec';

/** A raw duplex byte-stream socket, as the platform provides it. */
export interface LanSocket {
  write(data: Uint8Array): void;
  onData(handler: (chunk: Uint8Array) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

/** A bound listener accepting inbound LAN sockets. */
export interface LanListener {
  /** The port actually bound (resolves port 0 to the assigned one). */
  port: number;
  close(): Promise<void>;
}

/**
 * Platform-agnostic LAN socket backend.
 *
 * Implementations:
 * - Phones: react-native-tcp-socket (injected by the app)
 * - Desktop/tests: node:net
 */
export interface LanSocketBackend {
  connect(host: string, port: number): Promise<LanSocket>;
  listen(port: number, onSocket: (socket: LanSocket) => void): Promise<LanListener>;
}

let lanPeerCounter = 0;

/** Wrap a raw socket in framing and expose it as a TransportConnection. */
export function lanSocketToConnection(
  socket: LanSocket,
  remoteDeviceId: string,
): TransportConnection {
  const decoder = new FrameDecoder();
  const handlers: Array<(data: Uint8Array) => void> = [];
  const pending: Uint8Array[] = [];
  let closed = false;

  socket.onData((chunk) => {
    if (closed) return;
    let frames: Uint8Array[];
    try {
      frames = decoder.push(chunk);
    } catch {
      // Oversized frame: protocol violation; drop the connection.
      closed = true;
      socket.close();
      return;
    }
    for (const frame of frames) {
      if (handlers.length === 0) {
        pending.push(frame);
        continue;
      }
      for (const handler of [...handlers]) handler(frame);
    }
  });
  socket.onClose(() => {
    closed = true;
  });

  return {
    id: `lan-peer-${++lanPeerCounter}-${Date.now().toString(36)}`,
    remoteDeviceId,
    transport: 'lan',
    async send(data: Uint8Array): Promise<void> {
      if (closed) throw new Error('LAN connection is closed.');
      socket.write(encodeFrame(data));
    },
    onData(handler: (data: Uint8Array) => void): void {
      handlers.push(handler);
      if (pending.length > 0) {
        const queued = pending.splice(0, pending.length);
        for (const frame of queued) handler(frame);
      }
    },
    async close(): Promise<void> {
      closed = true;
      socket.close();
    },
  };
}

export interface ConnectLanPeerOptions {
  backend: LanSocketBackend;
  host: string;
  port: number;
  /** Device id (Ed25519 pubkey hex) we expect on the other end. */
  remoteDeviceId: string;
}

/** Dial a peer's LAN listener and return a framed TransportConnection. */
export async function connectLanPeer(
  options: ConnectLanPeerOptions,
): Promise<TransportConnection> {
  const socket = await options.backend.connect(options.host, options.port);
  return lanSocketToConnection(socket, options.remoteDeviceId);
}

export interface StartLanListenerOptions {
  backend: LanSocketBackend;
  /** Port to bind (0 = ephemeral). */
  port: number;
  /**
   * Called with a framed TransportConnection per inbound socket. The remote
   * device id is unknown until the handshake; it is reported as 'unknown' and
   * authenticated by the session.
   */
  onConnection: (connection: TransportConnection) => void;
}

/** Bind a LAN listener that wraps every inbound socket in framing. */
export async function startLanListener(
  options: StartLanListenerOptions,
): Promise<LanListener> {
  return options.backend.listen(options.port, (socket) => {
    options.onConnection(lanSocketToConnection(socket, 'unknown'));
  });
}
