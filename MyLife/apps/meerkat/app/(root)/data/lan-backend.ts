// LAN backends (MK-007, device-only): adapt react-native-tcp-socket to
// @mylife/sync's LanSocketBackend and react-native-zeroconf to its
// DiscoveryBackend. Both are NATIVE modules: they exist only in a dev build,
// never in Expo Go or a simulator without them. They are therefore loaded
// lazily and failures surface as null so the relay flow keeps working and the
// UI can show honest recovery guidance instead of crashing.
//
// The protocol on top (length-prefix framing + the engine session) is the
// exact code proven over node:net in @mylife/sync's lan-tcp-e2e test; these
// adapters only supply the sockets.

import type { DiscoveryBackend, LanSocket, LanSocketBackend, ResolvedService } from '@mylife/sync';

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
  createConnection(
    options: { host: string; port: number },
    callback: () => void,
  ): TcpSocketLike;
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

function wrapTcpSocket(socket: TcpSocketLike): LanSocket {
  return {
    write: (data) => socket.write(data),
    onData: (handler) => socket.on('data', (chunk) => handler(toBytes(chunk))),
    onClose: (handler) => socket.on('close', handler),
    close: () => socket.destroy(),
  };
}

/**
 * Load the TCP socket backend, or null when the native module is absent
 * (Expo Go / a build without react-native-tcp-socket).
 */
export function loadLanSocketBackend(): LanSocketBackend | null {
  let TcpSocket: TcpSocketModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TcpSocket = require('react-native-tcp-socket') as TcpSocketModule;
  } catch {
    return null;
  }

  return {
    connect: (host, port) =>
      new Promise<LanSocket>((resolve, reject) => {
        try {
          const socket = TcpSocket.createConnection({ host, port }, () => {
            resolve(wrapTcpSocket(socket));
          });
          socket.on('error', (error) => {
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }),
    listen: (port, onSocket) =>
      new Promise((resolve, reject) => {
        try {
          const server = TcpSocket.createServer((socket) => onSocket(wrapTcpSocket(socket)));
          server.listen({ port, host: '0.0.0.0' }, () => {
            resolve({
              port: server.address()?.port ?? port,
              close: () => new Promise<void>((done) => server.close(() => done())),
            });
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }),
  };
}

// --- zeroconf discovery -------------------------------------------------------

interface ZeroconfService {
  name: string;
  host?: string;
  port?: number;
  addresses?: string[];
  txt?: Record<string, string>;
}

interface ZeroconfLike {
  on(event: 'resolved', handler: (service: ZeroconfService) => void): void;
  on(event: 'remove', handler: (name: string) => void): void;
  scan(type: string, protocol: string, domain: string): void;
  stop(): void;
  publishService(
    type: string,
    protocol: string,
    domain: string,
    name: string,
    port: number,
    txt: Record<string, string>,
  ): void;
  unpublishService(name: string): void;
  removeDeviceListeners?(): void;
}

interface ZeroconfModule {
  default: new () => ZeroconfLike;
}

/** '_mylife-sync._tcp' -> { type: 'mylife-sync', protocol: 'tcp' } */
function splitServiceType(serviceType: string): { type: string; protocol: string } {
  const [rawType = '', rawProtocol = 'tcp'] = serviceType.split('.');
  return { type: rawType.replace(/^_/, ''), protocol: rawProtocol.replace(/^_/, '') };
}

/**
 * Load a react-native-zeroconf implementation of @mylife/sync's
 * DiscoveryBackend, or null when the native module is absent. Feed it to
 * LANDiscovery to advertise this node and browse for peers.
 */
export function loadDiscoveryBackend(): DiscoveryBackend | null {
  let zeroconf: ZeroconfLike;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-zeroconf') as ZeroconfModule;
    zeroconf = new mod.default();
  } catch {
    return null;
  }

  let publishedName: string | null = null;
  let foundHandler: ((service: ResolvedService) => void) | null = null;
  let lostHandler: ((name: string) => void) | null = null;

  zeroconf.on('resolved', (service) => {
    const host = service.addresses?.[0] ?? service.host;
    if (!host || typeof service.port !== 'number') return;
    foundHandler?.({ name: service.name, host, port: service.port, txt: service.txt ?? {} });
  });
  zeroconf.on('remove', (name) => lostHandler?.(name));

  return {
    advertise(serviceType, port, txtRecord) {
      const { type, protocol } = splitServiceType(serviceType);
      publishedName = `meerkat-${txtRecord.deviceId?.slice(0, 8) ?? 'node'}`;
      zeroconf.publishService(type, protocol, 'local.', publishedName, port, txtRecord);
    },
    browse(serviceType) {
      const { type, protocol } = splitServiceType(serviceType);
      zeroconf.scan(type, protocol, 'local.');
    },
    stopAdvertising() {
      if (publishedName) zeroconf.unpublishService(publishedName);
      publishedName = null;
    },
    stopBrowsing() {
      zeroconf.stop();
    },
    onServiceFound(handler) {
      foundHandler = handler;
    },
    onServiceLost(handler) {
      lostHandler = handler;
    },
    destroy() {
      if (publishedName) zeroconf.unpublishService(publishedName);
      zeroconf.stop();
      zeroconf.removeDeviceListeners?.();
    },
  };
}

/** Honest, actionable copy for the iOS Local Network permission path (TN3179). */
export const LAN_RECOVERY_GUIDANCE =
  'LAN sync needs the Local Network permission and a development build that '
  + 'includes the TCP socket module. If you denied the permission, enable it in '
  + 'Settings > Privacy & Security > Local Network > Meerkat, or use a relay '
  + 'session instead; relay sync always works.';
