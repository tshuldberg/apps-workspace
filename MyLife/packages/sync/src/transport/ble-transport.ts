/**
 * BLE wake-up transport for mesh sync.
 *
 * BLE is used exclusively as a wake-up signal. It does NOT transfer sync data.
 * A GATT notify carries a small payload ({deviceId, pendingModules[], totalBytes})
 * that tells the TransportManager: "I have pending changes, escalate to a
 * higher-bandwidth layer (LAN or nearby)."
 *
 * Platform-specific BLE code (CoreBluetooth on iOS, android.bluetooth on Android)
 * is injected via the BleBackend interface. A SimulatedBleBackend is used for
 * testing and development.
 */

// ---------------------------------------------------------------------------
// Wake-up Payload
// ---------------------------------------------------------------------------

import type { RealTransportBackendMarker } from './data-transport-backend';
import { isRealBackend } from './data-transport-backend';

/**
 * Payload sent via GATT notify to signal pending changes.
 *
 * This is the ENTIRE BLE payload: it carries NO file/media bytes, only the
 * three wake-up fields below. BLE is wake-only and is excluded from the data
 * transport layers (NC-12 / L8).
 */
export interface BleWakeUpPayload {
  /** Device ID of the sender (Ed25519 public key, hex-encoded). */
  deviceId: string;
  /** Module IDs with pending unsynced changes. */
  pendingModules: string[];
  /** Approximate total bytes of pending change data (a hint, NOT the data). */
  totalBytes: number;
}

// ---------------------------------------------------------------------------
// BLE Backend Interface
// ---------------------------------------------------------------------------

/**
 * Platform-agnostic backend for BLE wake-up signals.
 *
 * Implementations:
 * - iOS: wraps CoreBluetooth (CBPeripheralManager for advertising,
 *   CBCentralManager for scanning)
 * - Android: wraps android.bluetooth (BluetoothLeAdvertiser for advertising,
 *   BluetoothLeScanner for scanning)
 * - Test: SimulatedBleBackend (in-memory, no radio, `isReal` false)
 *
 * Extends RealTransportBackendMarker: only a real native backend sets
 * `isReal: true`, flipping `BleTransport.isAvailable` on. BLE never joins the
 * data transport layers regardless; availability only gates wake scanning.
 */
export interface BleBackend extends RealTransportBackendMarker {
  startAdvertising(payload: BleWakeUpPayload): void;
  startScanning(): void;
  stopAdvertising(): void;
  stopScanning(): void;
  onWakeUp(handler: (payload: BleWakeUpPayload) => void): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Simulated Backend (testing / development)
// ---------------------------------------------------------------------------

/**
 * In-memory BLE backend for testing and development.
 *
 * Does not touch any radio hardware. Wake-up payloads are injected via
 * `injectWakeUp` so tests can drive BLE signals deterministically.
 */
export class SimulatedBleBackend implements BleBackend {
  /** In-memory backend: never a live rung. Real adapters set `isReal: true`. */
  readonly isReal = false;

  private _wakeUpHandler: ((payload: BleWakeUpPayload) => void) | null = null;
  private _destroyed = false;

  startAdvertising(_payload: BleWakeUpPayload): void {
    // No-op in simulation mode.
  }

  startScanning(): void {
    // No-op in simulation mode.
  }

  stopAdvertising(): void {
    // No-op in simulation mode.
  }

  stopScanning(): void {
    // No-op in simulation mode.
  }

  onWakeUp(handler: (payload: BleWakeUpPayload) => void): void {
    this._wakeUpHandler = handler;
  }

  destroy(): void {
    this._wakeUpHandler = null;
    this._destroyed = true;
  }

  /** Inject a wake-up signal into the simulated environment. */
  injectWakeUp(payload: BleWakeUpPayload): void {
    if (this._destroyed) return;
    this._wakeUpHandler?.(payload);
  }
}

// ---------------------------------------------------------------------------
// BleTransport Options
// ---------------------------------------------------------------------------

export interface BleTransportOptions {
  /** Injectable BLE backend. Falls back to SimulatedBleBackend. */
  backend?: BleBackend;
  /** Called when a remote device signals it has pending changes. */
  onWakeUp?: (payload: BleWakeUpPayload) => void;
}

// ---------------------------------------------------------------------------
// BleTransport
// ---------------------------------------------------------------------------

/**
 * BLE wake-up transport layer.
 *
 * This is NOT a data transport. It sends and receives small GATT notify
 * payloads that signal the TransportManager to attempt a higher-bandwidth
 * connection (LAN, nearby, or WAN) for actual data sync.
 *
 * Typical flow:
 * 1. Device A has pending changes and calls `startAdvertising(payload)`.
 * 2. Device B is scanning and receives the wake-up via `onWakeUp`.
 * 3. Device B's TransportManager escalates to LAN or nearby to sync.
 *
 * When no backend is provided, a SimulatedBleBackend is used so the
 * class works in tests and on platforms without BLE support.
 */
export class BleTransport {
  private readonly _backend: BleBackend;
  private readonly _available: boolean;
  private readonly _onWakeUp?: (payload: BleWakeUpPayload) => void;
  private _advertising = false;
  private _scanning = false;
  private _destroyed = false;

  constructor(options: BleTransportOptions = {}) {
    // Availability is derived from the injected backend BEFORE the Simulated
    // fallback, so a missing/absent native module reports unavailable.
    this._available = isRealBackend(options.backend);
    this._backend = options.backend ?? new SimulatedBleBackend();
    this._onWakeUp = options.onWakeUp;

    // Wire backend wake-up callback.
    this._backend.onWakeUp((payload) => this._handleWakeUp(payload));
  }

  /**
   * Whether a real native BLE backend is present on this build. False when only
   * the Simulated backend is available (Expo Go / native module absent). BLE is
   * wake-only, so this gates wake scanning/advertising, never a data channel.
   */
  get isAvailable(): boolean {
    return this._available;
  }

  /** Whether the transport is currently advertising a wake-up signal. */
  get isAdvertising(): boolean {
    return this._advertising;
  }

  /** Whether the transport is currently scanning for wake-up signals. */
  get isScanning(): boolean {
    return this._scanning;
  }

  /**
   * Start advertising a BLE wake-up signal.
   *
   * Broadcasts a GATT notify with the given payload so nearby scanning
   * devices know this device has pending changes. On iOS this uses
   * CBPeripheralManager; on Android, BluetoothLeAdvertiser.
   */
  startAdvertising(payload: BleWakeUpPayload): void {
    this._assertNotDestroyed();
    if (this._advertising) return;
    this._advertising = true;
    this._backend.startAdvertising(payload);
  }

  /** Stop advertising. */
  stopAdvertising(): void {
    if (!this._advertising) return;
    this._advertising = false;
    this._backend.stopAdvertising();
  }

  /**
   * Start scanning for BLE wake-up signals from other devices.
   *
   * Discovered wake-up payloads fire the `onWakeUp` callback so the
   * TransportManager can escalate to a higher-bandwidth layer.
   */
  startScanning(): void {
    this._assertNotDestroyed();
    if (this._scanning) return;
    this._scanning = true;
    this._backend.startScanning();
  }

  /** Stop scanning. */
  stopScanning(): void {
    if (!this._scanning) return;
    this._scanning = false;
    this._backend.stopScanning();
  }

  /** Clean up all resources. */
  destroy(): void {
    if (this._destroyed) return;
    this.stopAdvertising();
    this.stopScanning();
    this._backend.destroy();
    this._destroyed = true;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private _handleWakeUp(payload: BleWakeUpPayload): void {
    if (this._destroyed) return;
    this._onWakeUp?.(payload);
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('BleTransport has been destroyed.');
    }
  }
}
