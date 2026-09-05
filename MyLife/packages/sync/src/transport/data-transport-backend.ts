/**
 * Data-transport backend contract + availability model (Plan 20, Phase 11).
 *
 * The WebRTC, Nearby, and BLE transports each wrap an injectable backend. In a
 * dev/EAS build the app (apps/meerkat) supplies a REAL native backend through a
 * factory that lazy-requires the native module (mirroring
 * apps/meerkat/app/(root)/data/lan-backend.ts). When the native module is
 * absent the factory returns null and the transport falls back to an in-memory
 * Simulated backend.
 *
 * A Simulated backend (or a missing native module) MUST NOT be presentable as a
 * live rung. Every real native backend carries `isReal: true`; the Simulated
 * doubles leave it false. `isRealBackend()` is the single availability gate the
 * transports and the selector consult, so a build with only the Simulated
 * backend reports the rung "Not available on this build" and the selector never
 * offers or dials it (NC-11 / L8).
 *
 * This module is pure TypeScript (no native imports), so it is safe on both the
 * RN native barrel and the web barrel. The real react-native-webrtc / Nearby /
 * BLE adapters live in apps/meerkat and are never imported here.
 */

import type { WebRTCBackend } from './webrtc-transport';
import type { NearbyPeerBackend } from './nearby-transport';
import type { BleBackend } from './ble-transport';

/**
 * Availability marker shared by every transport backend.
 *
 * A real native byte-mover (or wake radio, for BLE) sets `isReal: true`. The
 * in-memory Simulated doubles leave it false/undefined, so the owning transport
 * reports `isAvailable === false` and the selector treats the rung as
 * unavailable on this build.
 */
export interface RealTransportBackendMarker {
  /** True ONLY for a real native backend present on this build. */
  readonly isReal?: boolean;
}

/** Copy shown when a rung has no real native backend on this build. */
export const TRANSPORT_UNAVAILABLE_MESSAGE = 'Not available on this build';

/**
 * The single availability gate: a backend counts as a live rung only when it is
 * a real native backend. A null/undefined backend (native module absent) or any
 * Simulated double returns false.
 */
export function isRealBackend(
  backend: RealTransportBackendMarker | null | undefined,
): boolean {
  return backend?.isReal === true;
}

/**
 * App-supplied factory that lazy-requires the real native WebRTC backend and
 * returns it, or null when react-native-webrtc is absent (Expo Go / web).
 */
export type WebRTCBackendFactory = () => WebRTCBackend | null;

/**
 * App-supplied factory that lazy-requires the real native Nearby backend
 * (Apple Multipeer / Android Wi-Fi Direct) or null when it is absent.
 */
export type NearbyBackendFactory = () => NearbyPeerBackend | null;

/**
 * App-supplied factory that lazy-requires the real native BLE wake backend
 * (CoreBluetooth / android.bluetooth) or null when it is absent. BLE is
 * wake-only and never carries data bytes.
 */
export type BleBackendFactory = () => BleBackend | null;

/**
 * Bundle of the real native backend factories the app injects into the
 * TransportManager. Each is optional; an omitted or null-returning factory
 * leaves its rung unavailable (Simulated fallback), never dialed.
 */
export interface DataTransportBackendFactories {
  /** Real WebRTC (react-native-webrtc) backend factory. */
  loadWebRTCBackend?: WebRTCBackendFactory;
  /** Real Nearby (Multipeer / Wi-Fi Direct) backend factory. */
  loadNearbyBackend?: NearbyBackendFactory;
  /** Real BLE wake (CoreBluetooth / android.bluetooth) backend factory. */
  loadBleBackend?: BleBackendFactory;
}
