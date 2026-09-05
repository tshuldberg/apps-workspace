// Real Nearby peer backend (Plan 20, Phase 11).
//
// Implements @mylife/sync's NearbyPeerBackend over a platform nearby module:
// Apple MultipeerConnectivity on iOS, Wi-Fi Direct / Nearby Connections on
// Android. The native bridge is loaded lazily and this factory returns null
// when the module is absent (Expo Go / the node test env), EXACTLY like
// lan-backend.ts, so Expo Go still boots. When present, the backend carries
// isReal:true so the Nearby rung reports available; when absent the rung stays
// "Not available on this build" and is never offered or dialed.
//
// HONESTY: this file only MOVES BYTES over the nearby session. The @mylife/sync
// Noise handshake / SAS / frame envelope / sealed shares run UNCHANGED on top of
// those bytes; no crypto is reimplemented here. The exact native module + a real
// two-device transfer are a dev/EAS build (founder-ops), never Expo Go.

import type { NearbyBackendFactory } from '@mylife/sync';
import { loadNativeNearbyModule } from '@mylife/meerkat-native-transport';

// The app resolves @mylife/sync to its pure barrel (index.ts), which exports the
// factory types but NOT the backend interface NAMES. Derive the contract we
// implement from the public factory type so we stay on the public surface.
type NearbyPeerBackend = NonNullable<ReturnType<NearbyBackendFactory>>;
type NearbySession = Awaited<ReturnType<NearbyPeerBackend['connectToPeer']>>;

// --- Minimal native nearby surface (only what this adapter uses) -------------

interface NativeNearbySession {
  peerId: string;
  send(bytes: Uint8Array): Promise<void> | void;
  onData(handler: (bytes: Uint8Array) => void): void;
  close(): Promise<void> | void;
}

interface NativeNearbyModule {
  advertise(serviceType: string, displayName: string): void;
  browse(serviceType: string): void;
  stopAdvertising(): void;
  stopBrowsing(): void;
  connect(peerId: string): Promise<NativeNearbySession>;
  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void;
  onPeerLost(handler: (peerId: string) => void): void;
  onIncomingSession(handler: (session: NativeNearbySession) => void): void;
  destroy(): void;
}

/**
 * Load the platform nearby module, or null when it is absent (NC-42.2). All
 * platform probing now lives in the OWNED @mylife/meerkat-native-transport
 * package: iOS MultipeerConnectivity, Android Wi-Fi Direct + DNS-SD. That
 * package lazy-looks-up its native module through expo-modules-core and returns
 * null when the native side is absent (Expo Go / Node / an uncompiled dev
 * build), so this file no longer references any speculative third-party module
 * name. Null keeps the Nearby rung honestly unavailable.
 */
function loadNearbyModule(): NativeNearbyModule | null {
  return loadNativeNearbyModule() as NativeNearbyModule | null;
}

/** Wrap a native nearby session into @mylife/sync's NearbySession. */
function wrapSession(native: NativeNearbySession): NearbySession {
  return {
    peerId: native.peerId,
    async send(data: Uint8Array): Promise<void> {
      await native.send(data);
    },
    onData(handler: (data: Uint8Array) => void): void {
      native.onData(handler);
    },
    async close(): Promise<void> {
      await native.close();
    },
  };
}

/** The real platform nearby backend (isReal:true). */
class NativeNearbyBackend implements NearbyPeerBackend {
  readonly isReal = true;
  private readonly mod: NativeNearbyModule;

  constructor(mod: NativeNearbyModule) {
    this.mod = mod;
  }

  advertise(serviceType: string, displayName: string): void {
    this.mod.advertise(serviceType, displayName);
  }

  browse(serviceType: string): void {
    this.mod.browse(serviceType);
  }

  stopAdvertising(): void {
    this.mod.stopAdvertising();
  }

  stopBrowsing(): void {
    this.mod.stopBrowsing();
  }

  async connectToPeer(peerId: string): Promise<NearbySession> {
    return wrapSession(await this.mod.connect(peerId));
  }

  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void {
    this.mod.onPeerFound(handler);
  }

  onPeerLost(handler: (peerId: string) => void): void {
    this.mod.onPeerLost(handler);
  }

  onIncomingSession(handler: (session: NearbySession) => void): void {
    this.mod.onIncomingSession((native) => handler(wrapSession(native)));
  }

  destroy(): void {
    this.mod.destroy();
  }
}

/** Test-only injection: pass a fake native nearby module. */
export interface LoadNearbyBackendOptions {
  /** @internal Inject a fake native module for unit tests. */
  module?: NativeNearbyModule;
}

/**
 * Load the real Nearby backend, or null when the native module is absent.
 * Matches the NearbyBackendFactory shape ( () => NearbyPeerBackend | null ).
 */
export function loadNearbyBackend(options: LoadNearbyBackendOptions = {}): NearbyPeerBackend | null {
  const mod = options.module ?? loadNearbyModule();
  if (!mod || typeof mod.connect !== 'function') return null;
  return new NativeNearbyBackend(mod);
}
