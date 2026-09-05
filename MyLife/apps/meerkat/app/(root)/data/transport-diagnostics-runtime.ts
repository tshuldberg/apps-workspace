// Transport diagnostics runtime binder (Plan 42 P7 / WP-42E).
//
// Assembles the REAL availability inputs for computeTransportDiagnostics from the
// seams the app already ships, then returns the honest per-rung / per-channel
// diagnostics. This is the ONLY place that touches the live seams; the decision
// logic stays pure in transport-diagnostics.ts (unit-tested without expo).
//
// HONESTY: every input is read from a real seam, never a static "on":
//   - native data rungs: getDataTransportAvailability() (engine isRealBackend gate)
//   - LAN: whether the tcp-socket + zeroconf adapter loads (lan-backend.ts)
//   - platform: Platform.OS
//   - push gateway URL: app config extra.pushGatewayUrl (via pushGatewayUrl())
//   - native push token: probed only when the gateway is configured and the
//     native token API is present; an absent API / no token => hasNativePushToken
//     stays false and the channel reports unavailable with a machine reason.

import { Platform } from 'react-native';
import { getDataTransportAvailability } from './transport-backends';
import { loadLanSocketBackend, loadDiscoveryBackend } from './lan-backend';
import { pushGatewayUrl } from './background-task-registration';
import {
  computeTransportDiagnostics,
  type TransportDiagnostics,
  type TransportDiagnosticsInput,
} from './transport-diagnostics';

/**
 * True when BOTH LAN native adapters load: the tcp-socket transport and the
 * zeroconf discovery. LAN needs both to advertise/browse and carry bytes, so
 * either being absent leaves the rung honestly unavailable.
 */
function isLanNativePresent(): boolean {
  try {
    return loadLanSocketBackend() !== null && loadDiscoveryBackend() !== null;
  } catch {
    return false;
  }
}

/**
 * Probe whether a real native push token can be obtained for the applicable
 * channel. Returns false when the token API is absent (Expo Go / Node), when the
 * gateway is unconfigured (we do not probe then), or when the API returns no
 * usable token. Never throws; an absent token is an honest false.
 */
async function probeNativePushToken(gatewayConfigured: boolean): Promise<boolean> {
  if (!gatewayConfigured) return false;
  let notifications: { getDevicePushTokenAsync?: () => Promise<{ data?: unknown }> } | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifications = require('expo-notifications');
  } catch {
    return false;
  }
  if (typeof notifications?.getDevicePushTokenAsync !== 'function') return false;
  try {
    const token = await notifications.getDevicePushTokenAsync();
    const value = typeof token?.data === 'string' ? token.data : JSON.stringify(token?.data ?? '');
    return Boolean(value) && value !== '""';
  } catch {
    return false;
  }
}

/** Whether this browser supports web push. Always false on native. */
function isWebPushSupportedHere(): boolean {
  if (Platform.OS !== 'web') return false;
  const scope = globalThis as {
    navigator?: { serviceWorker?: unknown };
    PushManager?: unknown;
    Notification?: unknown;
  };
  return Boolean(
    scope.navigator &&
      'serviceWorker' in scope.navigator &&
      typeof scope.PushManager !== 'undefined' &&
      typeof scope.Notification !== 'undefined',
  );
}

/**
 * Collect the live diagnostics inputs from the real seams. Exported so a debug
 * view (or a future ops surface) can render them; the pure computeTransportDiagnostics
 * turns them into honest verdicts.
 */
export async function collectTransportDiagnosticsInput(): Promise<TransportDiagnosticsInput> {
  const gatewayUrl = pushGatewayUrl();
  const gatewayConfigured = gatewayUrl.length > 0;
  const platform: TransportDiagnosticsInput['platform'] =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  return {
    nativeAvailability: getDataTransportAvailability(),
    lanNativePresent: isLanNativePresent(),
    platform,
    pushGatewayUrl: gatewayUrl,
    hasNativePushToken: await probeNativePushToken(gatewayConfigured),
    webPushSupported: isWebPushSupportedHere(),
  };
}

/** Resolve the honest transport + push diagnostics from the live seams. */
export async function getTransportDiagnostics(): Promise<TransportDiagnostics> {
  return computeTransportDiagnostics(await collectTransportDiagnosticsInput());
}
