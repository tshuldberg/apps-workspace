// registerPushWake honesty tests (Plan 42 P5, AC-42.9, NC-42.3).
//
// The push-wake path must NEVER fake a registration:
//   - No native token API (Expo Go / Node / no dev build) => 'unavailable'.
//   - No configured gateway => 'not_configured'.
//   - No PushRelayClient exported yet (wp42a replacing it) => 'client_unavailable'.
//   - The API present but no usable token => 'no_token'.
//   - A real token + client + gateway => ok, a live registration is held, and the
//     registration is addressed by the OPAQUE handle, never a device identity.
//   - A token-change listener re-registers on rotation (AC-42.9).
//   - unregisterPushWake removes listeners and revokes the server registration.

import { describe, it, expect, vi } from 'vitest';
import {
  registerPushWake,
  unregisterPushWake,
  type PushNotificationsModule,
  type PushRelayClientCtor,
  type PushRelayClientLike,
  type RegisterPushWakeDeps,
  type DevicePushToken,
  type PushSubscription,
} from '../push-wake-core';
import type { BackgroundSyncResult } from '../background-sync';

const emptyResult: BackgroundSyncResult = {
  ran: false, applied: 0, fileRequests: 0, fileGrants: 0, publicJoinRequests: 0,
};

function fakeNotifications(overrides: Partial<PushNotificationsModule> = {}): {
  mod: PushNotificationsModule;
  emitNotification: () => void;
  emitTokenChange: (t: DevicePushToken) => void;
  removed: number;
} {
  let notifListener: ((n: unknown) => void) | null = null;
  let tokenListener: ((t: DevicePushToken) => void) | null = null;
  let removed = 0;
  const sub = (): PushSubscription => ({ remove: () => { removed += 1; } });
  const mod: PushNotificationsModule = {
    getDevicePushTokenAsync: async () => ({ type: 'apns', data: 'native-token-abc' }),
    addNotificationReceivedListener: (l) => { notifListener = l; return sub(); },
    addPushTokenListener: (l) => { tokenListener = l; return sub(); },
    ...overrides,
  };
  return {
    mod,
    emitNotification: () => notifListener?.({}),
    emitTokenChange: (t) => tokenListener?.(t),
    get removed() { return removed; },
  };
}

function fakeClientCtor(): { ctor: PushRelayClientCtor; instances: { opts: unknown; client: PushRelayClientLike }[] } {
  const instances: { opts: unknown; client: PushRelayClientLike }[] = [];
  const ctor = function (opts: { serverUrl: string; deviceToken: string; deviceId: string }): PushRelayClientLike {
    let registered = false;
    const client: PushRelayClientLike = {
      register: async () => { registered = true; },
      unregister: async () => { registered = false; },
      isRegistered: () => registered,
    };
    instances.push({ opts, client });
    return client;
  } as unknown as PushRelayClientCtor;
  return { ctor, instances };
}

function baseDeps(overrides: Partial<RegisterPushWakeDeps> = {}): RegisterPushWakeDeps {
  const { ctor } = fakeClientCtor();
  return {
    loadNotifications: () => fakeNotifications().mod,
    loadPushRelayClient: () => ctor,
    gatewayUrl: 'https://push.example',
    registrationHandle: 'opaque-random-handle-256bit',
    runDrain: async () => emptyResult,
    ...overrides,
  };
}

describe('registerPushWake honesty', () => {
  it("reports 'unavailable' when the native push token API is absent (Expo Go / Node)", async () => {
    const { result, registration } = await registerPushWake(baseDeps({ loadNotifications: () => null }));
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(registration).toBeNull();
  });

  it("reports 'not_configured' when no gateway URL is set", async () => {
    const { result, registration } = await registerPushWake(baseDeps({ gatewayUrl: '' }));
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(registration).toBeNull();
  });

  it("reports 'client_unavailable' when @mylife/sync does not export PushRelayClient yet", async () => {
    const { result, registration } = await registerPushWake(baseDeps({ loadPushRelayClient: () => null }));
    expect(result).toEqual({ ok: false, reason: 'client_unavailable' });
    expect(registration).toBeNull();
  });

  it("reports 'no_token' when the API returns an empty token", async () => {
    const n = fakeNotifications({ getDevicePushTokenAsync: async () => ({ type: 'apns', data: '' }) });
    const { result, registration } = await registerPushWake(baseDeps({ loadNotifications: () => n.mod }));
    expect(result).toEqual({ ok: false, reason: 'no_token' });
    expect(registration).toBeNull();
  });

  it("reports 'no_token' when getDevicePushTokenAsync throws (permission denied)", async () => {
    const n = fakeNotifications({ getDevicePushTokenAsync: async () => { throw new Error('denied'); } });
    const { result } = await registerPushWake(baseDeps({ loadNotifications: () => n.mod }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_token');
  });

  it('registers with the gateway addressed by the OPAQUE handle, never a device identity (NC-42.3)', async () => {
    const { ctor, instances } = fakeClientCtor();
    const { result, registration } = await registerPushWake(baseDeps({ loadPushRelayClient: () => ctor }));
    expect(result).toEqual({ ok: true, platform: 'apns' });
    expect(registration).not.toBeNull();
    expect(instances).toHaveLength(1);
    const opts = instances[0].opts as { serverUrl: string; deviceToken: string; deviceId: string };
    // deviceId carries the opaque handle, not any Meerkat identity/pubkey.
    expect(opts.deviceId).toBe('opaque-random-handle-256bit');
    expect(opts.serverUrl).toBe('https://push.example');
    expect(instances[0].client.isRegistered()).toBe(true);
  });

  it('reports register_failed when the gateway rejects registration (no fake success)', async () => {
    const ctor = function (): PushRelayClientLike {
      return {
        register: async () => { throw new Error('gateway 500'); },
        unregister: async () => {},
        isRegistered: () => false,
      };
    } as unknown as PushRelayClientCtor;
    const { result, registration } = await registerPushWake(baseDeps({ loadPushRelayClient: () => ctor }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('register_failed');
    expect(registration).toBeNull();
  });

  it('a foreground notification enqueues a drain (wake hint, not a delivery claim)', async () => {
    const n = fakeNotifications();
    const runDrain = vi.fn(async () => emptyResult);
    const { registration } = await registerPushWake(baseDeps({ loadNotifications: () => n.mod, runDrain }));
    expect(registration).not.toBeNull();
    n.emitNotification();
    await Promise.resolve();
    expect(runDrain).toHaveBeenCalledTimes(1);
  });

  it('re-registers on token rotation (AC-42.9)', async () => {
    const n = fakeNotifications();
    const { ctor, instances } = fakeClientCtor();
    await registerPushWake(baseDeps({ loadNotifications: () => n.mod, loadPushRelayClient: () => ctor }));
    expect(instances).toHaveLength(1);
    n.emitTokenChange({ type: 'apns', data: 'rotated-token-xyz' });
    await Promise.resolve();
    await Promise.resolve();
    // A second client was constructed + registered with the new token.
    expect(instances.length).toBe(2);
    const rotated = instances[1].opts as { deviceToken: string };
    expect(rotated.deviceToken).toBe('rotated-token-xyz');
  });

  it('unregisterPushWake removes listeners and revokes the server registration', async () => {
    const n = fakeNotifications();
    const { registration } = await registerPushWake(baseDeps({ loadNotifications: () => n.mod }));
    expect(registration).not.toBeNull();
    expect(registration!.client.isRegistered()).toBe(true);
    await unregisterPushWake(registration);
    expect(registration!.client.isRegistered()).toBe(false);
    // Both listeners (notification + token change) removed.
    expect(n.removed).toBe(2);
  });

  it('unregisterPushWake on a null registration is a safe no-op', async () => {
    await expect(unregisterPushWake(null)).resolves.toBeUndefined();
  });
});
