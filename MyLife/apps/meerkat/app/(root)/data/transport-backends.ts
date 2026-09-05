// Real native data-transport wiring (Plan 20, Phase 11).
//
// Single choke point that bundles the app's real WebRTC / Nearby / BLE backend
// factories and derives their REAL availability through the engine's
// isRealBackend() gate. A build with only the engine's Simulated backend (or an
// absent native module) reports every native rung "Not available on this build"
// and it is never offered or dialed (NC-11 / L8). Feed dataTransportFactories to
// a @mylife/sync TransportManager to inject the real byte-movers; feed
// buildNativeTransportRungs() to the Settings Connection options panel so the UI
// reflects the exact same availability.

import {
  isRealBackend,
  transportPolicyAllows,
  NEARBY_LAYER_ID,
  WEBRTC_LAYER_ID,
  TRANSPORT_UNAVAILABLE_MESSAGE,
  type DataTransportBackendFactories,
  type CommunityTransportPolicy,
} from '@mylife/sync';
import { loadWebRTCBackend } from './webrtc-backend';
import { loadNearbyBackend } from './nearby-backend';
import { loadBleBackend } from './ble-backend';

/**
 * AM5/15b Plan 27 (NC-3): may a native data layer be dialed this round, resolved
 * CONSERVATIVELY across every community this device belongs to? The auto-connect
 * round is PEER-scoped (a peer is not one community), and forbiddenLayerIds is
 * computed from a per-LAYER predicate with no community arg, so the only safe
 * answer is: allow the native layer ONLY if EVERY joined community permits its
 * transport. Deny if ANY forbids it, so a single local_only community can never
 * be under-restricted into a WebRTC dial. Non-native layers are not gated here.
 */
export function nativeLayerAllowedAcrossCommunities(
  policies: readonly CommunityTransportPolicy[],
  layerId: number,
): boolean {
  const transport = layerId === NEARBY_LAYER_ID
    ? 'nearby' as const
    : layerId === WEBRTC_LAYER_ID
      ? 'wan_webrtc' as const
      : null;
  if (!transport) return true;
  return policies.every((policy) => transportPolicyAllows(policy, transport));
}

/**
 * The real native backend factories, ready to inject into a TransportManager
 * ({ loadWebRTCBackend, loadNearbyBackend, loadBleBackend }). Each lazy-requires
 * its native module and returns null when absent, leaving that rung unavailable.
 */
export const dataTransportFactories: DataTransportBackendFactories = {
  loadWebRTCBackend: () => loadWebRTCBackend(),
  loadNearbyBackend: () => loadNearbyBackend(),
  loadBleBackend: () => loadBleBackend(),
};

/** Real availability of each native transport rung on this build. */
export interface DataTransportAvailability {
  webrtc: boolean;
  nearby: boolean;
  /** BLE is a wake-only rung; availability gates wake scanning, never data. */
  ble: boolean;
}

/**
 * Resolve real availability by loading each backend and running it through the
 * engine's isRealBackend() gate. A null (native module absent) or any Simulated
 * backend returns false, so nothing here can fabricate a live rung.
 */
export function getDataTransportAvailability(options: { externalWebRTCSignaling?: boolean } = {}): DataTransportAvailability {
  const webRTCBackend = loadWebRTCBackend();
  return {
    webrtc: isRealBackend(webRTCBackend)
      && (webRTCBackend?.signalingMode !== 'external' || options.externalWebRTCSignaling === true),
    nearby: isRealBackend(loadNearbyBackend()),
    ble: isRealBackend(loadBleBackend()),
  };
}

/** One native transport rung row for the Settings Connection options panel. */
export interface NativeTransportRung {
  id: 'webrtc' | 'nearby' | 'ble';
  name: string;
  detail: string;
  available: boolean;
}

/**
 * Build the native transport rung rows from real availability. An available rung
 * states only that its real native backend is PRESENT on this build (not that a
 * session is live); an unavailable one shows the honest "Not available on this
 * build" and MUST NOT be presented as live.
 */
export function buildNativeTransportRungs(
  availability: DataTransportAvailability,
): NativeTransportRung[] {
  return [
    {
      id: 'webrtc',
      name: 'Direct peer-to-peer (WebRTC)',
      available: availability.webrtc,
      detail: availability.webrtc ? 'Native transport present (dev build)' : TRANSPORT_UNAVAILABLE_MESSAGE,
    },
    {
      id: 'nearby',
      name: 'Nearby (Wi-Fi Direct / Multipeer)',
      available: availability.nearby,
      detail: availability.nearby ? 'Native transport present (dev build)' : TRANSPORT_UNAVAILABLE_MESSAGE,
    },
    {
      id: 'ble',
      name: 'Bluetooth wake',
      available: availability.ble,
      detail: availability.ble ? 'Native transport present (dev build, wake only)' : TRANSPORT_UNAVAILABLE_MESSAGE,
    },
  ];
}
