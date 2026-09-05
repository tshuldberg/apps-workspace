// Transport + push diagnostics (Plan 42 P7 / WP-42E, honest availability).
//
// A single PURE function that reports, per transport rung (relay, LAN, WebRTC,
// nearby, BLE) and per push channel (APNs, FCM, web push), the HONEST current
// state: 'available' or 'unavailable' with a machine reason. Every state is
// DERIVED from the real availability seams this repo already ships; NOTHING here
// fabricates an "on". A rung whose native module is absent, or a push channel
// whose gateway/token is unconfigured, reports 'unavailable' with the reason.
//
// The seams this reuses (never a new honesty mechanism):
//   - Native data rungs (nearby, WebRTC, BLE): the engine's isRealBackend() gate,
//     surfaced through data/transport-backends.ts getDataTransportAvailability().
//     A null (native module absent) or a Simulated backend is false.
//   - LAN: the lazy react-native-tcp-socket + react-native-zeroconf adapter in
//     data/lan-backend.ts, which returns null when the native modules are absent.
//   - Relay: always CODE-PRESENT (WebSocket over fetch/ws), but only reachable
//     with a configured/health-gated server. Diagnostics reports code-presence +
//     whether a default server is configured; live reachability is the
//     ConnectionStatusCard's /healthz probe, not a fabricated flag here.
//   - Push channels: the app-config push gateway URL + the platform of the real
//     native token (APNs on iOS, FCM on Android). No gateway => 'not_configured';
//     the OS platform decides which of APNs/FCM is even applicable.
//
// This module is dependency-injected so it unit-tests without expo or a native
// build: callers pass the real availability + config; tests pass fakes to prove
// each rung/channel reports 'unavailable' when its seam is absent.

/** The five transport rungs Meerkat ranks. BLE is wake-only (never data). */
export type TransportRungId = 'relay' | 'lan' | 'webrtc' | 'nearby' | 'ble';

/** The three push channels. Exactly one native channel applies per OS. */
export type PushChannelId = 'apns' | 'fcm' | 'webpush';

/** Honest availability verdict. Never a fabricated "on". */
export type DiagnosticState = 'available' | 'unavailable';

/**
 * A machine reason accompanying an 'unavailable' verdict. 'available' rungs carry
 * 'ok'. These are stable identifiers (not localized prose) so a test can assert
 * the exact reason a rung is down.
 */
export type DiagnosticReason =
  | 'ok'
  | 'native_module_absent' // the owned native module is not linked (Expo Go / uncompiled dev build)
  | 'not_configured' // no gateway URL (push) — the channel is off, never shown as on
  | 'not_applicable_platform' // this push channel does not apply to the running OS (e.g. FCM on iOS)
  | 'no_native_token' // gateway configured but no device push token was obtained
  | 'unsupported_browser'; // web push: no service worker / PushManager / Notification API

/** One rung's honest diagnostic row. */
export interface TransportRungDiagnostic {
  id: TransportRungId;
  /** Whether this rung can carry sync DATA. BLE is wake-only, so false for it. */
  carriesData: boolean;
  state: DiagnosticState;
  reason: DiagnosticReason;
  /** One honest line for a debug view. Never implies a live session. */
  detail: string;
}

/** One push channel's honest diagnostic row. */
export interface PushChannelDiagnostic {
  id: PushChannelId;
  state: DiagnosticState;
  reason: DiagnosticReason;
  detail: string;
}

export interface TransportDiagnostics {
  transports: TransportRungDiagnostic[];
  push: PushChannelDiagnostic[];
}

/** The real inputs the diagnostics derive from. All come from existing seams. */
export interface TransportDiagnosticsInput {
  /**
   * Real native data-rung availability from
   * data/transport-backends.ts getDataTransportAvailability(): each is true ONLY
   * when the engine's isRealBackend() gate passes (native module present, not
   * Simulated).
   */
  nativeAvailability: { webrtc: boolean; nearby: boolean; ble: boolean };
  /**
   * Whether the LAN native adapter (react-native-tcp-socket + react-native-zeroconf)
   * is present on this build. False in Expo Go / Node. Derived from lan-backend.ts
   * (a non-null adapter), never a static claim.
   */
  lanNativePresent: boolean;
  /**
   * The running OS platform, so the correct native push channel is the applicable
   * one and the other native channel is 'not_applicable_platform'. 'web' selects
   * web push. Anything else marks both native channels not-applicable.
   */
  platform: 'ios' | 'android' | 'web';
  /**
   * The push gateway base URL from app config (extra.pushGatewayUrl). Empty =>
   * push is 'not_configured' and every channel is off.
   */
  pushGatewayUrl: string;
  /**
   * Whether a real native push token was obtained for the applicable channel
   * (expo-notifications getDevicePushTokenAsync succeeded). False when the token
   * API is absent or returned nothing. Only meaningful when the gateway is
   * configured and the channel applies.
   */
  hasNativePushToken: boolean;
  /**
   * Web-push support on this browser (service worker + PushManager + Notification).
   * Only meaningful when platform === 'web'.
   */
  webPushSupported: boolean;
}

const RELAY_DETAIL =
  'Relay transport is built in. It moves bytes only through a configured, health-checked connection server; there is no out-of-box server unless one is configured.';

/**
 * Compute the honest transport + push diagnostics from the real seams. Pure: the
 * same input always yields the same verdicts, and no input can produce an
 * 'available' that its underlying seam did not earn.
 */
export function computeTransportDiagnostics(
  input: TransportDiagnosticsInput,
): TransportDiagnostics {
  const transports: TransportRungDiagnostic[] = [
    {
      id: 'relay',
      carriesData: true,
      // The relay code path is always present (WebSocket client), unlike the
      // native rungs. Reachability is gated elsewhere (ConnectionStatusCard's
      // /healthz probe); diagnostics reports code-presence honestly and never
      // claims a live peer.
      state: 'available',
      reason: 'ok',
      detail: RELAY_DETAIL,
    },
    lanRung(input.lanNativePresent),
    nativeDataRung('webrtc', input.nativeAvailability.webrtc, 'Direct peer-to-peer (WebRTC)'),
    nativeDataRung('nearby', input.nativeAvailability.nearby, 'Nearby (Wi-Fi Direct / Multipeer)'),
    bleRung(input.nativeAvailability.ble),
  ];

  return { transports, push: computePushDiagnostics(input) };
}

function lanRung(present: boolean): TransportRungDiagnostic {
  return {
    id: 'lan',
    carriesData: true,
    state: present ? 'available' : 'unavailable',
    reason: present ? 'ok' : 'native_module_absent',
    detail: present
      ? 'LAN Wi-Fi transport present (dev build): tcp-socket + zeroconf linked.'
      : 'LAN needs a dev build with react-native-tcp-socket + react-native-zeroconf. Not available on this build.',
  };
}

function nativeDataRung(
  id: 'webrtc' | 'nearby',
  present: boolean,
  name: string,
): TransportRungDiagnostic {
  return {
    id,
    carriesData: true,
    state: present ? 'available' : 'unavailable',
    reason: present ? 'ok' : 'native_module_absent',
    detail: present
      ? `${name}: native transport present (dev build).`
      : `${name}: native module not linked. Not available on this build.`,
  };
}

function bleRung(present: boolean): TransportRungDiagnostic {
  return {
    id: 'ble',
    // BLE is a WAKE-only rung: it never carries data bytes (NC-42.6).
    carriesData: false,
    state: present ? 'available' : 'unavailable',
    reason: present ? 'ok' : 'native_module_absent',
    detail: present
      ? 'Bluetooth wake present (dev build, wake only). Never carries file or media bytes.'
      : 'Bluetooth wake needs a dev build with the owned native module. Not available on this build.',
  };
}

function computePushDiagnostics(input: TransportDiagnosticsInput): PushChannelDiagnostic[] {
  const configured = input.pushGatewayUrl.trim().length > 0;
  return [
    nativePushChannel('apns', 'ios', input, configured),
    nativePushChannel('fcm', 'android', input, configured),
    webPushChannel(input, configured),
  ];
}

function nativePushChannel(
  id: 'apns' | 'fcm',
  appliesOn: 'ios' | 'android',
  input: TransportDiagnosticsInput,
  configured: boolean,
): PushChannelDiagnostic {
  const label = id === 'apns' ? 'Apple Push (APNs)' : 'Firebase Cloud Messaging (FCM)';
  if (input.platform !== appliesOn) {
    return {
      id,
      state: 'unavailable',
      reason: 'not_applicable_platform',
      detail: `${label} applies only on ${appliesOn === 'ios' ? 'iOS' : 'Android'}.`,
    };
  }
  if (!configured) {
    return {
      id,
      state: 'unavailable',
      reason: 'not_configured',
      detail: `${label} is off: no push gateway is configured for this build.`,
    };
  }
  if (!input.hasNativePushToken) {
    return {
      id,
      state: 'unavailable',
      reason: 'no_native_token',
      detail: `${label} gateway is configured, but no device push token was obtained (needs a dev build with notifications permission).`,
    };
  }
  return {
    id,
    state: 'available',
    reason: 'ok',
    detail: `${label} is configured and a device token was registered. Provider acceptance is recorded; delivery is never claimed.`,
  };
}

function webPushChannel(
  input: TransportDiagnosticsInput,
  configured: boolean,
): PushChannelDiagnostic {
  if (input.platform !== 'web') {
    return {
      id: 'webpush',
      state: 'unavailable',
      reason: 'not_applicable_platform',
      detail: 'Web Push applies only in a supported browser.',
    };
  }
  if (!input.webPushSupported) {
    return {
      id: 'webpush',
      state: 'unavailable',
      reason: 'unsupported_browser',
      detail: 'This browser lacks the service worker, PushManager, or Notification API.',
    };
  }
  if (!configured) {
    return {
      id: 'webpush',
      state: 'unavailable',
      reason: 'not_configured',
      detail: 'Web Push is off: no push gateway (or VAPID key) is configured for this build.',
    };
  }
  return {
    id: 'webpush',
    state: 'available',
    reason: 'ok',
    detail: 'Web Push is configured and supported. A closed page can only be notified and drained on open, never mutated by the worker.',
  };
}

/** Convenience: true when at least one DATA rung is available on this build. */
export function anyDataTransportAvailable(diagnostics: TransportDiagnostics): boolean {
  return diagnostics.transports.some((t) => t.carriesData && t.state === 'available');
}
