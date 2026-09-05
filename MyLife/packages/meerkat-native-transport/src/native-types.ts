// The RAW native-module surface, as the Swift (MeerkatNearbyModule /
// MeerkatBleWakeModule) and Kotlin implementations expose it through
// expo-modules-core. This is the plan's Native Module Contract (Plan 42, lines
// 184-200): an event-emitter style module with promise-returning methods and an
// `addListener(event, cb)` subscription. The bridge in index.ts adapts THIS
// surface into the callback-style contracts apps/meerkat's nearby-backend.ts and
// ble-backend.ts already probe, so the app side is unchanged.
//
// No implementation lives here; these are the shapes the native code fulfills.

/** A removable event subscription, as returned by an Expo EventEmitter. */
export interface NativeSubscription {
  remove(): void;
}

/** Peer discovered while browsing. `id` is an OPAQUE native handle, never an identity. */
export interface NativePeerFoundEvent {
  peerId: string;
  displayName: string;
}

/** A byte payload delivered on a session. */
export interface NativeDataEvent {
  /** The session the bytes arrived on. */
  sessionId: string;
  /** Raw bytes. Crosses the bridge as a Uint8Array. */
  bytes: Uint8Array;
}

export interface NativeSessionEvent {
  /** Random local session handle. */
  sessionId: string;
  /** The peer this session is with (opaque native handle). */
  peerId: string;
}

/**
 * Raw Nearby native module (MultipeerConnectivity on iOS, Wi-Fi Direct + DNS-SD
 * on Android). Every method rejects with a STABLE error code string on failure;
 * JS never parses a localized platform message.
 */
export interface RawNativeNearbyModule {
  advertise(input: { serviceType: string; displayName: string }): Promise<void>;
  browse(input: { serviceType: string }): Promise<void>;
  stopAdvertising(): Promise<void>;
  stopBrowsing(): Promise<void>;
  /** Invite + connect to a discovered peer; resolves the random local sessionId. */
  connect(input: { peerId: string }): Promise<string>;
  /** Enqueue bytes on an open session (bounded/backpressured natively). */
  send(input: { sessionId: string; bytes: Uint8Array }): Promise<void>;
  /** Close one session exactly once. */
  closeSession(input: { sessionId: string }): Promise<void>;
  /** Tear down all advertising/browsing/sessions and remove native listeners. */
  destroy(): Promise<void>;
  addListener(eventName: 'peerFound', listener: (event: NativePeerFoundEvent) => void): NativeSubscription;
  addListener(eventName: 'peerLost', listener: (event: { peerId: string }) => void): NativeSubscription;
  addListener(eventName: 'sessionOpened', listener: (event: NativeSessionEvent) => void): NativeSubscription;
  addListener(eventName: 'data', listener: (event: NativeDataEvent) => void): NativeSubscription;
  addListener(eventName: 'sessionClosed', listener: (event: { sessionId: string }) => void): NativeSubscription;
}

/**
 * Raw BLE wake-only native module (CoreBluetooth on iOS, android.bluetooth on
 * Android). It advertises/notifies and scans ONLY the bounded wake payload; it
 * never opens a data-carrying channel (NC-42.6). The payload the native side
 * carries is opaque bytes; the app-side codec (ble-backend.ts) is the only place
 * that shapes the three wake fields.
 */
export interface RawNativeBleWakeModule {
  /** Advertise / GATT-notify the bounded wake payload bytes. */
  advertise(input: { payload: Uint8Array }): Promise<void>;
  stopAdvertising(): Promise<void>;
  /** Begin scanning for wake payloads. */
  scan(): Promise<void>;
  stopScanning(): Promise<void>;
  /** Stop all BLE activity and remove native listeners. */
  destroy(): Promise<void>;
  addListener(eventName: 'wake', listener: (event: { payload: Uint8Array }) => void): NativeSubscription;
}
