// Web Push subscription lifecycle (Plan 42 P6 / WP-42D). The IO half of web push:
// it drives PushManager.subscribe with the VAPID applicationServerKey, registers
// the resulting subscription with the push gateway as a 'webpush' provider token
// through @mylife/sync's PushGatewayClient, rotates on pushsubscriptionchange, and
// unsubscribes + revokes on sign-out. The pure decisions (capability gate, VAPID
// decode, subscription -> token mapping, status) live in web-push-core.ts.
//
// HONESTY (Plan 42, AC-42.10, NC-42.3/42.4/42.5):
//   - Permission is requested at an HONEST moment (an explicit user action in the
//     Notifications settings section), never on load. A denied permission stays
//     denied; only the user can undo it.
//   - The registration carries ONLY the random Web Push subscription (endpoint +
//     public keys) and a random registration binding. No device pubkey, community
//     id, message id, caller identity, or plaintext reaches the gateway (NC-42.3).
//   - Nothing is marked active unless a real subscription is registered with a
//     configured gateway (NC-42.5). A closed-page wake shows a notification and
//     drains on open; this module never claims a background cadence.
//   - The registration binding (a random id + secret, NOT identity material) is
//     held in the device-local mk_settings store, which never replicates. It lets
//     rotation reuse the SAME registration and sign-out revoke it.

import type { DatabaseAdapter } from '@mylife/db';
import { PushGatewayClient } from '@mylife/sync';
import type { PushRegistrationBinding } from '@mylife/sync';
import { getSetting, setSetting } from './meerkat-data';
import {
  decodeVapidPublicKey,
  isWebPushConfigured,
  isWebPushSupported,
  serializeProviderToken,
  subscriptionToProviderToken,
  type WebPushConfig,
} from './web-push-core';

/** Device-local settings keys for the push registration binding (never replicated). */
const PUSH_REGISTRATION_ID_KEY = 'push_registration_id';
const PUSH_REGISTRATION_SECRET_KEY = 'push_registration_secret';

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const REGISTRATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SERVICE_WORKER_URL = '/sw.js';

/** Build-time config, read from import.meta.env by getWebPushConfig(). */
export function getWebPushConfig(): WebPushConfig {
  return {
    gatewayUrl: (import.meta.env.VITE_MEERKAT_PUSH_GATEWAY_URL ?? '').trim(),
    vapidPublicKey: (import.meta.env.VITE_MEERKAT_PUSH_VAPID_PUBLIC_KEY ?? '').trim(),
  };
}

export type EnablePushResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unsupported' // no service worker / PushManager / Notification API
        | 'not_configured' // no gateway URL or VAPID public key in this build
        | 'bad_vapid_key' // the configured VAPID public key is malformed
        | 'permission_denied' // the user denied notification permission
        | 'subscribe_failed' // PushManager.subscribe threw
        | 'bad_subscription' // the subscription lacked the endpoint/keys we need
        | 'register_failed'; // the gateway rejected the registration
    };

/** Read the persisted registration binding, if this device already has one. */
export function getStoredBinding(db: DatabaseAdapter): PushRegistrationBinding | null {
  const registrationId = getSetting(db, PUSH_REGISTRATION_ID_KEY)?.trim() ?? '';
  const registrationSecret = getSetting(db, PUSH_REGISTRATION_SECRET_KEY)?.trim() ?? '';
  if (!registrationId || !registrationSecret) return null;
  return { registrationId, registrationSecret };
}

function storeBinding(db: DatabaseAdapter, binding: PushRegistrationBinding): void {
  setSetting(db, PUSH_REGISTRATION_ID_KEY, binding.registrationId);
  setSetting(db, PUSH_REGISTRATION_SECRET_KEY, binding.registrationSecret);
}

function clearBinding(db: DatabaseAdapter): void {
  setSetting(db, PUSH_REGISTRATION_ID_KEY, '');
  setSetting(db, PUSH_REGISTRATION_SECRET_KEY, '');
}

/**
 * True once this device holds a persisted registration binding. This is the
 * honest "has a registration" signal computeWebPushStatus consumes -- it is not a
 * live-connection claim, just "we have registered a subscription before".
 */
export function hasStoredRegistration(db: DatabaseAdapter): boolean {
  return getStoredBinding(db) !== null;
}

/** Read the current Notification.permission, defaulting to 'default' when absent. */
export function readNotificationPermission(
  scope: { Notification?: { permission?: string } } = globalThis as {
    Notification?: { permission?: string };
  },
): 'default' | 'granted' | 'denied' {
  const perm = scope.Notification?.permission;
  return perm === 'granted' || perm === 'denied' ? perm : 'default';
}

/**
 * Enable web push: request permission (honest moment -- the caller invokes this
 * from an explicit user action), subscribe with the VAPID key, and register the
 * subscription with the gateway. Returns an honest result; never fakes success.
 * Reuses a stored binding so rotation/re-enable keeps the SAME registration.
 */
export async function enableWebPush(
  db: DatabaseAdapter,
  configOverride?: WebPushConfig,
): Promise<EnablePushResult> {
  if (!isWebPushSupported()) return { ok: false, reason: 'unsupported' };
  const config = configOverride ?? getWebPushConfig();
  if (!isWebPushConfigured(config)) return { ok: false, reason: 'not_configured' };

  const applicationServerKey = decodeVapidPublicKey(config.vapidPublicKey);
  if (!applicationServerKey) return { ok: false, reason: 'bad_vapid_key' };

  const permission = await requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  await navigator.serviceWorker.ready;

  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    // Copy into a plain ArrayBuffer-backed view so the DOM BufferSource type is
    // satisfied (decodeVapidPublicKey may return an ArrayBufferLike-backed array).
    const keyBuffer = new Uint8Array(applicationServerKey.length);
    keyBuffer.set(applicationServerKey);
    subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      }));
  } catch {
    return { ok: false, reason: 'subscribe_failed' };
  }

  return registerSubscription(db, config, subscription);
}

/**
 * Register (or rotate onto) a subscription with the gateway. Shared by
 * enableWebPush and the rotation handler. Reuses the stored binding when present
 * (a rotate keeps the same registration id); mints a fresh binding otherwise.
 */
async function registerSubscription(
  db: DatabaseAdapter,
  config: WebPushConfig,
  subscription: PushSubscription,
): Promise<EnablePushResult> {
  const token = subscriptionToProviderToken(subscription.toJSON());
  if (!token) return { ok: false, reason: 'bad_subscription' };
  const providerToken = serializeProviderToken(token);

  const client = new PushGatewayClient({ serverUrl: config.gatewayUrl });
  const stored = getStoredBinding(db);

  if (stored) {
    const rotated = await client.rotateToken({
      binding: stored,
      providerToken,
      tokenTtlMs: TOKEN_TTL_MS,
      idempotencyKey: client.generateCapability(),
    });
    if (rotated.ok) return { ok: true };
    // The stored registration may have expired server-side; fall through to a
    // fresh registration rather than leaving the device unable to re-enable.
  }

  const binding = client.createBinding();
  const result = await client.register({
    binding,
    provider: 'webpush',
    providerToken,
    tokenTtlMs: TOKEN_TTL_MS,
    registrationTtlMs: REGISTRATION_TTL_MS,
    idempotencyKey: client.generateCapability(),
  });
  if (!result.ok) return { ok: false, reason: 'register_failed' };
  storeBinding(db, binding);
  return { ok: true };
}

/**
 * Rotation handler for pushsubscriptionchange: re-read the (possibly new)
 * subscription and re-register it under the SAME binding so wakes keep landing.
 * Best-effort: a failure leaves the prior registration in place rather than
 * claiming a rotation that did not happen (AC-42.9 web analog).
 */
export async function rotateWebPushSubscription(
  db: DatabaseAdapter,
  configOverride?: WebPushConfig,
): Promise<EnablePushResult> {
  if (!isWebPushSupported()) return { ok: false, reason: 'unsupported' };
  const config = configOverride ?? getWebPushConfig();
  if (!isWebPushConfigured(config)) return { ok: false, reason: 'not_configured' };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: false, reason: 'bad_subscription' };
  return registerSubscription(db, config, subscription);
}

/**
 * Disable web push on sign-out / account delete: unsubscribe the browser and
 * revoke the gateway registration, then clear the local binding. Best-effort on
 * each step so a partial failure still stops future wakes and never leaves a
 * stale "active" claim.
 */
export async function disableWebPush(
  db: DatabaseAdapter,
  configOverride?: WebPushConfig,
): Promise<void> {
  const config = configOverride ?? getWebPushConfig();
  const stored = getStoredBinding(db);
  try {
    if (isWebPushSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
  } catch {
    // best-effort browser unsubscribe
  }
  if (stored && isWebPushConfigured(config)) {
    try {
      const client = new PushGatewayClient({ serverUrl: config.gatewayUrl });
      await client.unregister(stored, client.generateCapability());
    } catch {
      // best-effort server revoke; the local binding is cleared regardless
    }
  }
  clearBinding(db);
}

/** Request notification permission. Wraps both the promise and legacy callback APIs. */
async function requestPermission(): Promise<'default' | 'granted' | 'denied'> {
  const Notification = (globalThis as { Notification?: unknown }).Notification as
    | {
        permission?: string;
        requestPermission?: (cb?: (p: string) => void) => Promise<string> | void;
      }
    | undefined;
  if (!Notification?.requestPermission) return 'default';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const result = await new Promise<string>((resolve) => {
      const maybePromise = Notification.requestPermission!((p) => resolve(p));
      if (maybePromise && typeof (maybePromise as Promise<string>).then === 'function') {
        void (maybePromise as Promise<string>).then(resolve);
      }
    });
    return result === 'granted' || result === 'denied' ? result : 'default';
  } catch {
    return 'default';
  }
}
