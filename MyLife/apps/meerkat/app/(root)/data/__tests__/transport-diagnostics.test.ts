// Transport + push diagnostics honesty tests (Plan 42 P7 / WP-42E).
//
// Every rung must report 'unavailable' with a machine reason when its underlying
// seam is absent, and 'available' ONLY when the real seam is present. No input can
// produce a fabricated "on". Relay is the one always-code-present rung; the four
// native rungs and the push channels all fail closed.

import { describe, it, expect } from 'vitest';
import {
  computeTransportDiagnostics,
  anyDataTransportAvailable,
  type TransportDiagnosticsInput,
} from '../transport-diagnostics';

/** A baseline where nothing is available: Expo Go / Node with no config. */
function absentInput(overrides: Partial<TransportDiagnosticsInput> = {}): TransportDiagnosticsInput {
  return {
    nativeAvailability: { webrtc: false, nearby: false, ble: false },
    lanNativePresent: false,
    platform: 'ios',
    pushGatewayUrl: '',
    hasNativePushToken: false,
    webPushSupported: false,
    ...overrides,
  };
}

function rung(d: ReturnType<typeof computeTransportDiagnostics>, id: string) {
  const r = d.transports.find((t) => t.id === id);
  if (!r) throw new Error(`missing rung ${id}`);
  return r;
}

function channel(d: ReturnType<typeof computeTransportDiagnostics>, id: string) {
  const c = d.push.find((p) => p.id === id);
  if (!c) throw new Error(`missing channel ${id}`);
  return c;
}

describe('computeTransportDiagnostics — native rungs fail closed', () => {
  it('reports every native data rung unavailable with native_module_absent when the module is gone', () => {
    const d = computeTransportDiagnostics(absentInput());
    for (const id of ['lan', 'webrtc', 'nearby'] as const) {
      expect(rung(d, id).state).toBe('unavailable');
      expect(rung(d, id).reason).toBe('native_module_absent');
    }
  });

  it('reports BLE unavailable and marks it wake-only (never carries data)', () => {
    const d = computeTransportDiagnostics(absentInput());
    expect(rung(d, 'ble').state).toBe('unavailable');
    expect(rung(d, 'ble').reason).toBe('native_module_absent');
    expect(rung(d, 'ble').carriesData).toBe(false);
  });

  it('flips a native rung to available ONLY when its real seam is present', () => {
    const d = computeTransportDiagnostics(
      absentInput({ nativeAvailability: { webrtc: true, nearby: true, ble: true }, lanNativePresent: true }),
    );
    for (const id of ['lan', 'webrtc', 'nearby', 'ble'] as const) {
      expect(rung(d, id).state).toBe('available');
      expect(rung(d, id).reason).toBe('ok');
    }
    // BLE stays wake-only even when available.
    expect(rung(d, 'ble').carriesData).toBe(false);
  });

  it('relay is always code-present (built-in WebSocket client), never fabricated live', () => {
    const d = computeTransportDiagnostics(absentInput());
    expect(rung(d, 'relay').state).toBe('available');
    // The detail never claims a live peer or an out-of-box server.
    expect(rung(d, 'relay').detail).not.toMatch(/connected to|online|live session/i);
  });
});

describe('computeTransportDiagnostics — push channels fail closed', () => {
  it('marks APNs not_applicable on Android and FCM not_applicable on iOS', () => {
    const ios = computeTransportDiagnostics(absentInput({ platform: 'ios' }));
    expect(channel(ios, 'fcm').reason).toBe('not_applicable_platform');
    const android = computeTransportDiagnostics(absentInput({ platform: 'android' }));
    expect(channel(android, 'apns').reason).toBe('not_applicable_platform');
  });

  it('marks the applicable native channel not_configured when there is no gateway', () => {
    const d = computeTransportDiagnostics(absentInput({ platform: 'ios', pushGatewayUrl: '' }));
    expect(channel(d, 'apns').state).toBe('unavailable');
    expect(channel(d, 'apns').reason).toBe('not_configured');
  });

  it('marks the applicable native channel no_native_token when configured but tokenless', () => {
    const d = computeTransportDiagnostics(
      absentInput({ platform: 'android', pushGatewayUrl: 'https://push.example', hasNativePushToken: false }),
    );
    expect(channel(d, 'fcm').state).toBe('unavailable');
    expect(channel(d, 'fcm').reason).toBe('no_native_token');
  });

  it('marks the applicable native channel available ONLY with gateway + real token', () => {
    const d = computeTransportDiagnostics(
      absentInput({ platform: 'ios', pushGatewayUrl: 'https://push.example', hasNativePushToken: true }),
    );
    expect(channel(d, 'apns').state).toBe('available');
    expect(channel(d, 'apns').reason).toBe('ok');
    // Never claims delivery.
    expect(channel(d, 'apns').detail).not.toMatch(/delivered/i);
  });

  it('web push: unsupported browser and unconfigured both fail closed', () => {
    const unsupported = computeTransportDiagnostics(
      absentInput({ platform: 'web', webPushSupported: false, pushGatewayUrl: 'https://push.example' }),
    );
    expect(channel(unsupported, 'webpush').reason).toBe('unsupported_browser');

    const unconfigured = computeTransportDiagnostics(
      absentInput({ platform: 'web', webPushSupported: true, pushGatewayUrl: '' }),
    );
    expect(channel(unconfigured, 'webpush').reason).toBe('not_configured');
  });

  it('web push available ONLY when supported + configured', () => {
    const d = computeTransportDiagnostics(
      absentInput({ platform: 'web', webPushSupported: true, pushGatewayUrl: 'https://push.example' }),
    );
    expect(channel(d, 'webpush').state).toBe('available');
    expect(channel(d, 'webpush').reason).toBe('ok');
  });
});

describe('anyDataTransportAvailable', () => {
  it('is true on a bare build because relay is always code-present', () => {
    // Relay is the built-in rung; even with no native modules a data transport
    // (relay) is code-available. BLE never counts (wake-only).
    expect(anyDataTransportAvailable(computeTransportDiagnostics(absentInput()))).toBe(true);
  });

  it('never counts BLE as a data transport', () => {
    const d = computeTransportDiagnostics(
      absentInput({ nativeAvailability: { webrtc: false, nearby: false, ble: true } }),
    );
    const bleOnly = d.transports.filter((t) => t.state === 'available' && t.id === 'ble');
    expect(bleOnly.every((t) => t.carriesData === false)).toBe(true);
  });
});
