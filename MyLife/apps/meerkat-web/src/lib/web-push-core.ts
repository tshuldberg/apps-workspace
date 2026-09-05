// Web Push core (Plan 42 P6 / WP-42D), PURE + capability-gated. The browser analog
// of the native APNs/FCM wake path (apps/meerkat push-wake-core.ts): a paired peer
// can send an OPAQUE wake through the push gateway, and this browser's service
// worker turns that into a notification and a drain-on-open.
//
// Everything here is IO-free and unit-testable. The lifecycle wiring (real
// PushManager.subscribe, gateway registration, rotation) lives in
// web-push-registration.ts; this file holds only the pure decisions those steps
// need: the capability gate, the VAPID key decode, the subscription -> provider
// token mapping the gateway's 'webpush' adapter expects, and the honest status
// model.
//
// HONESTY (Plan 42 execution contract, AC-42.10, NC-42.3/42.4/42.5):
//   - No config (no gateway URL or no VAPID public key) => push is OFF and the UI
//     says so. Nothing is ever presented as active when it is not (NC-42.5).
//   - A browser without service workers, PushManager, or Notification support
//     degrades gracefully to 'unsupported'; the UI entry is honest, never a faked
//     always-on toggle.
//   - The registration carries ONLY the random Web Push subscription (endpoint +
//     public keys). No device pubkey, community id, message id, caller identity,
//     or plaintext ever enters the gateway registration (NC-42.3).
//   - A wake to a fully closed page can only show a notification and queue a
//     drain-on-open. It CANNOT mutate the SQLite database from the service worker
//     (the DB lives in the page). See web-push-sw shared constants below.

/** The 'webpush' provider token the gateway adapter parses: PushSubscription.toJSON(). */
export interface WebPushProviderToken {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** The globals the capability gate reads, injectable so it is unit-testable. */
export interface WebPushScope {
  navigator?: { serviceWorker?: unknown } | undefined;
  PushManager?: unknown;
  Notification?: unknown;
}

/** Build-time config for web push, read from import.meta.env by the caller. */
export interface WebPushConfig {
  /** The push gateway base URL (VITE_MEERKAT_PUSH_GATEWAY_URL). Empty => off. */
  gatewayUrl: string;
  /** The VAPID PUBLIC key, base64url (VITE_MEERKAT_PUSH_VAPID_PUBLIC_KEY). Empty => off. */
  vapidPublicKey: string;
}

/**
 * The honest, user-facing state of web push on this browser. Mirrors the mobile
 * capability model: never claims 'active' unless a real subscription is
 * registered with a configured gateway.
 */
export type WebPushStatus =
  | 'unsupported' // no service worker / PushManager / Notification API
  | 'not_configured' // no gateway URL or no VAPID public key in this build
  | 'default' // supported + configured, permission not yet requested
  | 'denied' // the user denied notification permission (only they can undo it)
  | 'granted_inactive' // permission granted but no live subscription registered yet
  | 'active'; // a subscription is registered with the gateway right now

/** The Notification.permission values we honor. */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * True ONLY when this browser can actually host Web Push: a service worker (to
 * receive the push), the PushManager (to subscribe), and the Notification API (to
 * show the wake). When false the whole flow is a no-op and the UI says unsupported.
 */
export function isWebPushSupported(scope: WebPushScope = globalThis as WebPushScope): boolean {
  const nav = scope.navigator as { serviceWorker?: unknown } | undefined;
  return Boolean(
    nav &&
      'serviceWorker' in nav &&
      typeof scope.PushManager !== 'undefined' &&
      typeof scope.Notification !== 'undefined',
  );
}

/** True when this build has BOTH a push gateway URL and a VAPID public key. */
export function isWebPushConfigured(config: WebPushConfig): boolean {
  return config.gatewayUrl.trim().length > 0 && config.vapidPublicKey.trim().length > 0;
}

/**
 * Compute the honest push status from the real inputs. Never overclaims: without
 * support it is 'unsupported'; without config it is 'not_configured'; a denied
 * permission stays 'denied'; 'active' requires an actually-registered subscription.
 */
export function computeWebPushStatus(input: {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission;
  hasRegisteredSubscription: boolean;
}): WebPushStatus {
  if (!input.supported) return 'unsupported';
  if (!input.configured) return 'not_configured';
  if (input.permission === 'denied') return 'denied';
  if (input.permission === 'granted') {
    return input.hasRegisteredSubscription ? 'active' : 'granted_inactive';
  }
  return 'default';
}

/**
 * Decode a base64url VAPID public key into the Uint8Array `applicationServerKey`
 * PushManager.subscribe requires. Returns null for a malformed key so the caller
 * fails honestly instead of subscribing with garbage. A valid uncompressed P-256
 * public key is 65 bytes (0x04 || X || Y); we accept that exact length only.
 */
export function decodeVapidPublicKey(base64UrlKey: string): Uint8Array | null {
  const bytes = base64UrlToBytes(base64UrlKey.trim());
  if (!bytes || bytes.length !== 65 || bytes[0] !== 0x04) return null;
  return bytes;
}

/**
 * Map a browser PushSubscription (its .toJSON() shape) to the exact 'webpush'
 * provider token the gateway adapter parses ({ endpoint, keys: { p256dh, auth } }).
 * Returns null when the subscription is missing the endpoint or the two keys, so
 * the caller never registers an unusable token. The serialized string this feeds
 * (see serializeProviderToken) is the ONLY thing sent to the gateway: it carries
 * no identity (NC-42.3), only the random push endpoint the browser minted.
 */
export function subscriptionToProviderToken(json: unknown): WebPushProviderToken | null {
  if (typeof json !== 'object' || json === null) return null;
  const candidate = json as { endpoint?: unknown; keys?: unknown };
  if (typeof candidate.endpoint !== 'string' || candidate.endpoint.length === 0) return null;
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(candidate.endpoint);
  } catch {
    return null;
  }
  if (endpointUrl.protocol !== 'https:' && endpointUrl.protocol !== 'http:') return null;
  const keys = candidate.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  if (keys.p256dh.length === 0 || keys.auth.length === 0) return null;
  return { endpoint: candidate.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Serialize a provider token to the JSON string the gateway 'webpush' adapter parses. */
export function serializeProviderToken(token: WebPushProviderToken): string {
  return JSON.stringify(token);
}

/**
 * Two provider tokens are equal when their endpoint AND both keys match. Used by
 * the rotation handler to decide whether a `pushsubscriptionchange` actually moved
 * the endpoint (re-register) or is a spurious event (no-op), so rotation never
 * churns the gateway needlessly.
 */
export function providerTokensEqual(
  a: WebPushProviderToken | null,
  b: WebPushProviderToken | null,
): boolean {
  if (!a || !b) return a === b;
  return a.endpoint === b.endpoint && a.keys.p256dh === b.keys.p256dh && a.keys.auth === b.keys.auth;
}

// ---------------------------------------------------------------------------
// base64url decode (RN/browser-safe, no Buffer). Mirrors the sync client's
// alphabet so a VAPID key or subscription key decodes identically everywhere.
// ---------------------------------------------------------------------------

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlToBytes(value: string): Uint8Array | null {
  // Accept standard base64 too (VAPID keys are sometimes emitted with +/ and =).
  const normalized = value.replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
  if (!/^[A-Za-z0-9_-]*$/u.test(normalized)) return null;
  const lookup = new Map<string, number>();
  for (let i = 0; i < BASE64URL_ALPHABET.length; i += 1) lookup.set(BASE64URL_ALPHABET[i]!, i);
  const output: number[] = [];
  for (let i = 0; i < normalized.length; i += 4) {
    const c0 = lookup.get(normalized[i]!);
    const c1 = lookup.get(normalized[i + 1]!);
    if (c0 === undefined || c1 === undefined) return null;
    output.push((c0 << 2) | (c1 >> 4));
    if (normalized[i + 2] !== undefined) {
      const c2 = lookup.get(normalized[i + 2]!);
      if (c2 === undefined) return null;
      output.push(((c1 & 15) << 4) | (c2 >> 2));
      if (normalized[i + 3] !== undefined) {
        const c3 = lookup.get(normalized[i + 3]!);
        if (c3 === undefined) return null;
        output.push(((c2 & 3) << 6) | c3);
      }
    }
  }
  return Uint8Array.from(output);
}
