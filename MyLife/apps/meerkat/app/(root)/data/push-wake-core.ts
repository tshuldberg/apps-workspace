// Push-wake registration (Plan 42 P5, AC-42.9 codeable surface).
//
// registerPushWake() obtains this device's NATIVE push token (APNs / FCM) and
// registers it with the push gateway through @mylife/sync's PushRelayClient, so
// a paired peer can send an opaque wake that lands even when the app is
// backgrounded or terminated. It also:
//   - installs a notification-received listener so a foreground data push
//     ENQUEUES a coalesced drain (a wake hint, never a delivery claim);
//   - installs a token-change listener that RE-REGISTERS on rotation (AC-42.9),
//     rotating the server token before the old generation is dropped.
// unregisterPushWake() (sign-out / delete) revokes the server registration and
// discards the local token.
//
// HONESTY (Plan 42 execution contract):
//   - The native push token API (expo-notifications getDevicePushTokenAsync) is
//     lazy-loaded. Absent (Expo Go / Node / no dev build) => registration
//     reports { ok:false, reason:'unavailable' } and NOTHING is faked. There is
//     no simulated registration path.
//   - PushRelayClient is lazy-imported from @mylife/sync. If the running barrel
//     does not export it yet (the client is being replaced in parallel), this
//     reports 'client_unavailable' rather than pretending to register.
//   - The push gateway URL comes from app config `extra.pushGatewayUrl`; unset
//     => 'not_configured' and the UI must say push wake is off, never on.
//   - No identity, community id, message id, or plaintext ever passes to the
//     gateway. The registration is addressed by the client's random capability.
//
// This module is pure-ish wiring with injectable dependencies so it unit-tests
// without expo: the boot/sign-out callers pass the real loaders.

import type { BackgroundSyncResult } from './background-sync';

/** The native device push token surface we consume from expo-notifications. */
export interface DevicePushToken {
  /** 'apns' | 'fcm' | 'web' etc. */
  type: string;
  /** The raw provider token string (or structured web subscription). */
  data: unknown;
}

/** A removable listener subscription. */
export interface PushSubscription {
  remove(): void;
}

/**
 * The subset of expo-notifications registerPushWake needs. Injectable so tests
 * pass a fake and the real caller passes the lazy-loaded module.
 */
export interface PushNotificationsModule {
  getDevicePushTokenAsync(): Promise<DevicePushToken>;
  addNotificationReceivedListener(listener: (notification: unknown) => void): PushSubscription;
  addPushTokenListener(listener: (token: DevicePushToken) => void): PushSubscription;
}

/**
 * The subset of @mylife/sync's PushRelayClient we consume. Kept minimal and
 * matched to the CURRENTLY exported surface (register / unregister / isRegistered
 * / getServerUrl). wp42a is replacing the client implementation in parallel;
 * this type is the contract this code binds to. See the report for the exact
 * methods consumed and anything additionally needed.
 */
export interface PushRelayClientLike {
  register(): Promise<void>;
  unregister(): Promise<void>;
  isRegistered(): boolean;
}

/** Constructor shape: the exported PushRelayClient class. */
export interface PushRelayClientCtor {
  new (options: { serverUrl: string; deviceToken: string; deviceId: string }): PushRelayClientLike;
}

export type RegisterPushWakeResult =
  | { ok: true; platform: string }
  | {
      ok: false;
      reason:
        | 'unavailable' // no native push token API (Expo Go / Node / no dev build)
        | 'no_token' // API present but returned no usable token
        | 'not_configured' // no push gateway URL in app config
        | 'client_unavailable' // @mylife/sync did not export PushRelayClient
        | 'register_failed'; // the gateway rejected registration
      detail?: string;
    };

export interface RegisterPushWakeDeps {
  /** Load expo-notifications (or null when absent). */
  loadNotifications: () => PushNotificationsModule | null;
  /** Load the PushRelayClient constructor from @mylife/sync (or null when absent). */
  loadPushRelayClient: () => PushRelayClientCtor | null;
  /** The push gateway base URL from app config (empty => not configured). */
  gatewayUrl: string;
  /**
   * An OPAQUE per-install lookup id for the client (NOT a Meerkat identity or
   * device pubkey). The caller supplies a random capability handle; the gateway
   * never receives a real identity (NC-42.3).
   */
  registrationHandle: string;
  /** Enqueue a coalesced drain (shared with the scheduled + foreground paths). */
  runDrain: () => Promise<BackgroundSyncResult>;
}

/**
 * A live push-wake registration: the created client plus the listeners to remove
 * on sign-out. `remove()` tears down listeners only; call unregisterPushWake to
 * also revoke the server registration.
 */
export interface PushWakeRegistration {
  readonly platform: string;
  readonly client: PushRelayClientLike;
  readonly notificationSubscription: PushSubscription;
  readonly tokenChangeSubscription: PushSubscription;
}

/**
 * Register this device for push wake. Returns a live registration on success, or
 * an honest failure reason. Never fakes a registration: an absent native token
 * API or an absent client yields ok:false and the rung stays unavailable.
 */
export async function registerPushWake(
  deps: RegisterPushWakeDeps,
): Promise<{ result: RegisterPushWakeResult; registration: PushWakeRegistration | null }> {
  const notifications = deps.loadNotifications();
  if (!notifications) {
    return { result: { ok: false, reason: 'unavailable' }, registration: null };
  }
  if (!deps.gatewayUrl) {
    return { result: { ok: false, reason: 'not_configured' }, registration: null };
  }
  const ClientCtor = deps.loadPushRelayClient();
  if (!ClientCtor) {
    return { result: { ok: false, reason: 'client_unavailable' }, registration: null };
  }

  let token: DevicePushToken;
  try {
    token = await notifications.getDevicePushTokenAsync();
  } catch (error) {
    return {
      result: { ok: false, reason: 'no_token', detail: error instanceof Error ? error.message : undefined },
      registration: null,
    };
  }
  const tokenString = typeof token?.data === 'string' ? token.data : JSON.stringify(token?.data ?? '');
  if (!tokenString || tokenString === '""') {
    return { result: { ok: false, reason: 'no_token' }, registration: null };
  }

  const client = new ClientCtor({
    serverUrl: deps.gatewayUrl,
    deviceToken: tokenString,
    // The random capability handle, NOT a Meerkat identity (NC-42.3).
    deviceId: deps.registrationHandle,
  });
  try {
    await client.register();
  } catch (error) {
    return {
      result: { ok: false, reason: 'register_failed', detail: error instanceof Error ? error.message : undefined },
      registration: null,
    };
  }

  // A foreground data push ENQUEUES a coalesced drain. The notification itself is
  // a wake hint; the drain decides (applied > 0) whether a user-visible
  // notification fires.
  const notificationSubscription = notifications.addNotificationReceivedListener(() => {
    void deps.runDrain();
  });

  // AC-42.9 rotation: when the OS rotates the push token, re-register with the
  // gateway (rotating the server token before the old generation is dropped) so
  // wakes keep landing. Best-effort; a failed re-register leaves the prior
  // registration in place rather than claiming a fake one.
  const tokenChangeSubscription = notifications.addPushTokenListener((next) => {
    void (async () => {
      const nextString = typeof next?.data === 'string' ? next.data : JSON.stringify(next?.data ?? '');
      if (!nextString || nextString === '""') return;
      const rotated = new ClientCtor({
        serverUrl: deps.gatewayUrl,
        deviceToken: nextString,
        deviceId: deps.registrationHandle,
      });
      try {
        await rotated.register();
      } catch {
        // keep the prior registration; never claim a rotation that failed
      }
    })();
  });

  return {
    result: { ok: true, platform: token.type },
    registration: {
      platform: token.type,
      client,
      notificationSubscription,
      tokenChangeSubscription,
    },
  };
}

/**
 * Revoke a push-wake registration and remove its listeners (sign-out / delete).
 * Discards the local token by dropping the client reference. Best-effort: a
 * failed server revoke still removes the local listeners so no drain fires after
 * sign-out.
 */
export async function unregisterPushWake(registration: PushWakeRegistration | null): Promise<void> {
  if (!registration) return;
  registration.notificationSubscription.remove();
  registration.tokenChangeSubscription.remove();
  try {
    await registration.client.unregister();
  } catch {
    // best-effort revoke; listeners are already removed
  }
}
