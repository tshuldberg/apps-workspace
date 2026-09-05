// Real BLE WAKE-ONLY backend (Plan 20, Phase 11).
//
// Implements @mylife/sync's BleBackend over a platform BLE peripheral (advertise
// + GATT notify) and central (scan + read). Loaded lazily and this factory
// returns null when the BLE modules are absent (Expo Go / the node test env),
// EXACTLY like lan-backend.ts, so Expo Go still boots.
//
// HONESTY (NC-12 / BLE stays wake-only):
//   - BLE carries NO file/media bytes. The ENTIRE payload is the three wake
//     fields {deviceId, pendingModules[], totalBytes} (encode/decode below), a
//     signal that says "I have pending changes, escalate to LAN / nearby / relay
//     for the real transfer." BLE is excluded from DATA_TRANSPORT_LAYER_IDS.
//   - decodeBleWakePayload keeps ONLY the three fields, so nothing (e.g. smuggled
//     data bytes) can ride along on the wake notify.
//   - The real two-device wake is a dev/EAS build (founder-ops), never Expo Go.

import type { BleBackendFactory } from '@mylife/sync';
import { loadNativeBleWakeModule } from '@mylife/meerkat-native-transport';

// The app resolves @mylife/sync to its pure barrel (index.ts), which exports the
// factory types but NOT the backend interface NAMES. Derive the contract we
// implement from the public factory type so we stay on the public surface.
type BleBackend = NonNullable<ReturnType<BleBackendFactory>>;
type BleWakeUpPayload = Parameters<BleBackend['startAdvertising']>[0];

// --- Wake payload codec (pure, testable) -------------------------------------

/**
 * Encode the wake payload for the GATT notify characteristic. This is the ENTIRE
 * BLE payload: three small fields, never file/media bytes.
 */
export function encodeBleWakePayload(payload: BleWakeUpPayload): Uint8Array {
  const canonical = {
    deviceId: payload.deviceId,
    pendingModules: [...payload.pendingModules],
    totalBytes: payload.totalBytes,
  };
  return new TextEncoder().encode(JSON.stringify(canonical));
}

/**
 * Decode a wake notify back into a BleWakeUpPayload, keeping ONLY the three
 * wake fields. Returns null on malformed input. Any extra fields (e.g. an
 * attempt to smuggle data bytes) are dropped: BLE stays wake-only.
 */
export function decodeBleWakePayload(bytes: Uint8Array): BleWakeUpPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const { deviceId, pendingModules, totalBytes } = record;
  if (typeof deviceId !== 'string' || deviceId.length === 0) return null;
  if (!Array.isArray(pendingModules) || !pendingModules.every((m) => typeof m === 'string')) {
    return null;
  }
  if (typeof totalBytes !== 'number' || !Number.isFinite(totalBytes) || totalBytes < 0) {
    return null;
  }
  // Reconstruct from ONLY the three fields; extra keys never survive.
  return {
    deviceId,
    pendingModules: pendingModules as string[],
    totalBytes,
  };
}

// --- Minimal native BLE surface (only what this adapter uses) ----------------

interface NativeBlePeripheral {
  startAdvertising(payload: Uint8Array): Promise<void> | void;
  stopAdvertising(): Promise<void> | void;
  destroy?(): void;
}

interface NativeBleCentral {
  startScanning(onPayload: (bytes: Uint8Array) => void): Promise<void> | void;
  stopScanning(): Promise<void> | void;
  destroy?(): void;
}

interface NativeBleModule {
  createPeripheral(): NativeBlePeripheral;
  createCentral(): NativeBleCentral;
}

/**
 * Load the platform BLE wake module, or null when it is absent (NC-42.2). All
 * platform probing now lives in the OWNED @mylife/meerkat-native-transport
 * package (CoreBluetooth / android.bluetooth), which supplies a peripheral
 * (advertise + GATT notify) and a central (scan + read) and returns null when
 * the native side is absent (Expo Go / Node / an uncompiled dev build). This
 * file no longer references any speculative third-party module name. BLE stays
 * wake-only: the codec above is the only place the three wake fields are shaped.
 */
function loadBleModule(): NativeBleModule | null {
  return loadNativeBleWakeModule() as NativeBleModule | null;
}

/** The real BLE wake backend (isReal:true). */
class NativeBleBackend implements BleBackend {
  readonly isReal = true;
  private readonly peripheral: NativeBlePeripheral;
  private readonly central: NativeBleCentral;
  private wakeHandler: ((payload: BleWakeUpPayload) => void) | null = null;

  constructor(mod: NativeBleModule) {
    this.peripheral = mod.createPeripheral();
    this.central = mod.createCentral();
  }

  startAdvertising(payload: BleWakeUpPayload): void {
    // Advertise ONLY the encoded three-field wake payload. No data bytes.
    void this.peripheral.startAdvertising(encodeBleWakePayload(payload));
  }

  startScanning(): void {
    void this.central.startScanning((bytes) => {
      const payload = decodeBleWakePayload(bytes);
      // Fail-closed: a malformed / oversized notify is dropped, never delivered.
      if (payload) this.wakeHandler?.(payload);
    });
  }

  stopAdvertising(): void {
    void this.peripheral.stopAdvertising();
  }

  stopScanning(): void {
    void this.central.stopScanning();
  }

  onWakeUp(handler: (payload: BleWakeUpPayload) => void): void {
    this.wakeHandler = handler;
  }

  destroy(): void {
    this.wakeHandler = null;
    this.peripheral.destroy?.();
    this.central.destroy?.();
  }
}

/** Test-only injection: pass a fake native BLE module. */
export interface LoadBleBackendOptions {
  /** @internal Inject a fake native module for unit tests. */
  module?: NativeBleModule;
}

/**
 * Load the real BLE wake backend, or null when the native module is absent.
 * Matches the BleBackendFactory shape ( () => BleBackend | null ).
 */
export function loadBleBackend(options: LoadBleBackendOptions = {}): BleBackend | null {
  const mod = options.module ?? loadBleModule();
  if (
    !mod
    || typeof mod.createPeripheral !== 'function'
    || typeof mod.createCentral !== 'function'
  ) {
    return null;
  }
  return new NativeBleBackend(mod);
}
