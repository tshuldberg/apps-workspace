// @mylife/meerkat-native-transport
//
// The owned Expo native module bridge for Meerkat's Nearby data rung and BLE
// wake-only rung. This TS surface exposes EXACTLY the callback-style contracts
// apps/meerkat/app/(root)/data/nearby-backend.ts and ble-backend.ts already
// probe (NativeNearbyModule with connect(...), NativeBleModule with
// createPeripheral()/createCentral()), so those adapters can drop their
// speculative third-party module names and probe only this package.
//
// HONESTY (Plan 42 execution contract): when the native side is absent -- Expo
// Go, plain Node/vitest, or a dev build that has not compiled the Swift/Kotlin
// yet -- every loader here returns null. The adapter then returns null, the
// engine's isRealBackend() gate reports the rung unavailable, and the UI shows
// "Not available on this build". Nothing in this file fabricates a session, a
// peer, a byte, or an isReal:true. The native module names are looked up through
// the shared loader (loader.ts); no static import of expo-modules-core runs at
// module-eval time.

import { loadExpoNativeModule } from './loader';
import type {
  RawNativeBleWakeModule,
  RawNativeNearbyModule,
} from './native-types';

export type { NativeSubscription } from './native-types';

// Native module registration names. These MUST match expo-module.config.json
// and the native module `Name(...)` definitions the Swift/Kotlin sources declare.
export const NEARBY_NATIVE_MODULE_NAME = 'MeerkatNearby';
export const BLE_WAKE_NATIVE_MODULE_NAME = 'MeerkatBleWake';

// --- Adapter-facing Nearby contract (what nearby-backend.ts probes) ----------

/** One open nearby session, callback-style, as the app adapter consumes it. */
export interface NativeNearbySession {
  peerId: string;
  send(bytes: Uint8Array): Promise<void>;
  onData(handler: (bytes: Uint8Array) => void): void;
  close(): Promise<void>;
}

/**
 * The nearby module contract apps/meerkat probes. `connect` is the capability
 * probe the adapter's coerceNearbyModule uses, so it must be a real function
 * only when a real native module is present.
 */
export interface NativeNearbyModule {
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

// --- Adapter-facing BLE contract (what ble-backend.ts probes) ----------------

export interface NativeBlePeripheral {
  startAdvertising(payload: Uint8Array): Promise<void>;
  stopAdvertising(): Promise<void>;
  destroy(): void;
}

export interface NativeBleCentral {
  startScanning(onPayload: (bytes: Uint8Array) => void): Promise<void>;
  stopScanning(): Promise<void>;
  destroy(): void;
}

/**
 * The BLE wake module contract apps/meerkat probes. createPeripheral +
 * createCentral are the capability probes the adapter's coerceBleModule checks.
 */
export interface NativeBleModule {
  createPeripheral(): NativeBlePeripheral;
  createCentral(): NativeBleCentral;
}

// --- Nearby bridge -----------------------------------------------------------

/**
 * Wrap the raw event-based native Nearby module into the callback-style
 * NativeNearbyModule the adapter consumes. Sessions are keyed by the random
 * native sessionId; a per-session data handler is dispatched from the single
 * module-level `data` listener. All listeners are removed on destroy().
 */
class NearbyBridge implements NativeNearbyModule {
  private readonly raw: RawNativeNearbyModule;
  private readonly subscriptions: { remove(): void }[] = [];
  /** Per-session inbound-data handlers, keyed by native sessionId. */
  private readonly dataHandlers = new Map<string, (bytes: Uint8Array) => void>();
  /** peerId -> the session wrapper the app is awaiting from connect(). */
  private incomingHandler: ((session: NativeNearbySession) => void) | null = null;

  constructor(raw: RawNativeNearbyModule) {
    this.raw = raw;
    // Fan the single module-level data event out to the right session handler.
    this.subscriptions.push(
      raw.addListener('data', ({ sessionId, bytes }) => {
        this.dataHandlers.get(sessionId)?.(bytes);
      }),
    );
    // A remote-initiated session surfaces as an incoming session wrapper.
    this.subscriptions.push(
      raw.addListener('sessionOpened', ({ sessionId, peerId }) => {
        if (this.incomingHandler) {
          this.incomingHandler(this.makeSession(sessionId, peerId));
        }
      }),
    );
    // Drop the per-session handler when the native side closes a session, so a
    // closed session's bytes are never dispatched and the map cannot grow
    // unbounded.
    this.subscriptions.push(
      raw.addListener('sessionClosed', ({ sessionId }) => {
        this.dataHandlers.delete(sessionId);
      }),
    );
  }

  private makeSession(sessionId: string, peerId: string): NativeNearbySession {
    const raw = this.raw;
    const dataHandlers = this.dataHandlers;
    return {
      peerId,
      async send(bytes: Uint8Array): Promise<void> {
        await raw.send({ sessionId, bytes });
      },
      onData(handler: (bytes: Uint8Array) => void): void {
        dataHandlers.set(sessionId, handler);
      },
      async close(): Promise<void> {
        dataHandlers.delete(sessionId);
        await raw.closeSession({ sessionId });
      },
    };
  }

  advertise(serviceType: string, displayName: string): void {
    void this.raw.advertise({ serviceType, displayName });
  }

  browse(serviceType: string): void {
    void this.raw.browse({ serviceType });
  }

  stopAdvertising(): void {
    void this.raw.stopAdvertising();
  }

  stopBrowsing(): void {
    void this.raw.stopBrowsing();
  }

  async connect(peerId: string): Promise<NativeNearbySession> {
    const sessionId = await this.raw.connect({ peerId });
    return this.makeSession(sessionId, peerId);
  }

  onPeerFound(handler: (peer: { id: string; displayName: string }) => void): void {
    this.subscriptions.push(
      this.raw.addListener('peerFound', ({ peerId, displayName }) => {
        handler({ id: peerId, displayName });
      }),
    );
  }

  onPeerLost(handler: (peerId: string) => void): void {
    this.subscriptions.push(
      this.raw.addListener('peerLost', ({ peerId }) => {
        handler(peerId);
      }),
    );
  }

  onIncomingSession(handler: (session: NativeNearbySession) => void): void {
    this.incomingHandler = handler;
  }

  destroy(): void {
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions.length = 0;
    this.dataHandlers.clear();
    this.incomingHandler = null;
    void this.raw.destroy();
  }
}

/**
 * Wrap a raw native Nearby module into the app-facing contract. Exported as a
 * test seam so the bridge adaptation (session dispatch, listener teardown) can be
 * unit-tested with a fake raw module without a native build. Returns null when
 * the raw module lacks the `connect` capability probe.
 */
export function bridgeNativeNearbyModule(raw: RawNativeNearbyModule | null): NativeNearbyModule | null {
  if (!raw || typeof raw.connect !== 'function') return null;
  return new NearbyBridge(raw);
}

/**
 * Load the owned Nearby native module, adapted to the app's NativeNearbyModule
 * contract, or null when the native side is absent (Expo Go / Node / an
 * uncompiled dev build). Null keeps the Nearby rung honestly unavailable.
 */
export function loadNativeNearbyModule(): NativeNearbyModule | null {
  return bridgeNativeNearbyModule(loadExpoNativeModule<RawNativeNearbyModule>(NEARBY_NATIVE_MODULE_NAME));
}

// --- BLE wake bridge ---------------------------------------------------------

/**
 * Wrap the raw event-based native BLE module into the createPeripheral /
 * createCentral factory shape the adapter probes. Both roles share the one raw
 * module; the peripheral advertises the bounded wake payload and the central
 * scans for it. No data channel is ever opened here (NC-42.6): the ENTIRE BLE
 * payload is the opaque wake bytes the app-side codec bounds.
 */
class BleWakeBridge implements NativeBleModule {
  private readonly raw: RawNativeBleWakeModule;

  constructor(raw: RawNativeBleWakeModule) {
    this.raw = raw;
  }

  createPeripheral(): NativeBlePeripheral {
    const raw = this.raw;
    return {
      async startAdvertising(payload: Uint8Array): Promise<void> {
        await raw.advertise({ payload });
      },
      async stopAdvertising(): Promise<void> {
        await raw.stopAdvertising();
      },
      destroy(): void {
        void raw.stopAdvertising();
      },
    };
  }

  createCentral(): NativeBleCentral {
    const raw = this.raw;
    let subscription: { remove(): void } | null = null;
    return {
      async startScanning(onPayload: (bytes: Uint8Array) => void): Promise<void> {
        subscription?.remove();
        subscription = raw.addListener('wake', ({ payload }) => {
          onPayload(payload);
        });
        await raw.scan();
      },
      async stopScanning(): Promise<void> {
        subscription?.remove();
        subscription = null;
        await raw.stopScanning();
      },
      destroy(): void {
        subscription?.remove();
        subscription = null;
        void raw.stopScanning();
      },
    };
  }
}

/**
 * Wrap a raw native BLE module into the app-facing createPeripheral/createCentral
 * contract. Exported as a test seam. Returns null when the raw module lacks the
 * scan/advertise capability probes.
 */
export function bridgeNativeBleWakeModule(raw: RawNativeBleWakeModule | null): NativeBleModule | null {
  if (!raw || typeof raw.scan !== 'function' || typeof raw.advertise !== 'function') {
    return null;
  }
  return new BleWakeBridge(raw);
}

/**
 * Load the owned BLE wake native module, adapted to the app's NativeBleModule
 * contract, or null when the native side is absent. Null keeps the BLE wake rung
 * honestly unavailable. BLE is wake-only and never carries data bytes.
 */
export function loadNativeBleWakeModule(): NativeBleModule | null {
  return bridgeNativeBleWakeModule(loadExpoNativeModule<RawNativeBleWakeModule>(BLE_WAKE_NATIVE_MODULE_NAME));
}
