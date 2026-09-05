// Web Push core honesty (Plan 42 P6 / WP-42D). The pure decisions the lifecycle
// and the service worker depend on: capability gate, config gate, honest status,
// VAPID decode, and subscription -> provider-token mapping.

import { describe, expect, it } from 'vitest';
import {
  base64UrlToBytes,
  computeWebPushStatus,
  decodeVapidPublicKey,
  isWebPushConfigured,
  isWebPushSupported,
  providerTokensEqual,
  serializeProviderToken,
  subscriptionToProviderToken,
  type WebPushProviderToken,
} from '../web-push-core';

describe('isWebPushSupported', () => {
  it('is true only when serviceWorker, PushManager, and Notification all exist', () => {
    expect(
      isWebPushSupported({ navigator: { serviceWorker: {} }, PushManager: class {}, Notification: {} }),
    ).toBe(true);
  });

  it('is false when any capability is missing', () => {
    expect(isWebPushSupported({ navigator: {}, PushManager: class {}, Notification: {} })).toBe(false);
    expect(isWebPushSupported({ navigator: { serviceWorker: {} }, Notification: {} })).toBe(false);
    expect(isWebPushSupported({ navigator: { serviceWorker: {} }, PushManager: class {} })).toBe(false);
    expect(isWebPushSupported({})).toBe(false);
  });
});

describe('isWebPushConfigured', () => {
  it('requires BOTH a gateway URL and a VAPID public key', () => {
    expect(isWebPushConfigured({ gatewayUrl: 'https://push.example', vapidPublicKey: 'BKxxx' })).toBe(true);
    expect(isWebPushConfigured({ gatewayUrl: '', vapidPublicKey: 'BKxxx' })).toBe(false);
    expect(isWebPushConfigured({ gatewayUrl: 'https://push.example', vapidPublicKey: '' })).toBe(false);
    expect(isWebPushConfigured({ gatewayUrl: '   ', vapidPublicKey: '   ' })).toBe(false);
  });
});

describe('computeWebPushStatus honesty', () => {
  const base = { supported: true, configured: true, permission: 'default' as const, hasRegisteredSubscription: false };

  it('unsupported wins over everything', () => {
    expect(computeWebPushStatus({ ...base, supported: false })).toBe('unsupported');
  });

  it('not_configured when supported but no config', () => {
    expect(computeWebPushStatus({ ...base, configured: false })).toBe('not_configured');
  });

  it('denied stays denied', () => {
    expect(computeWebPushStatus({ ...base, permission: 'denied' })).toBe('denied');
  });

  it('granted without a registered subscription is granted_inactive, never active', () => {
    const status = computeWebPushStatus({ ...base, permission: 'granted', hasRegisteredSubscription: false });
    expect(status).toBe('granted_inactive');
    expect(status).not.toBe('active');
  });

  it('active ONLY when granted AND a subscription is registered', () => {
    expect(
      computeWebPushStatus({ ...base, permission: 'granted', hasRegisteredSubscription: true }),
    ).toBe('active');
  });

  it('default before any permission request', () => {
    expect(computeWebPushStatus(base)).toBe('default');
  });
});

describe('decodeVapidPublicKey', () => {
  it('decodes a valid 65-byte uncompressed P-256 key (0x04 prefix)', () => {
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    for (let i = 1; i < 65; i += 1) raw[i] = i;
    const b64url = bytesToBase64Url(raw);
    const decoded = decodeVapidPublicKey(b64url);
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(65);
    expect(decoded![0]).toBe(0x04);
  });

  it('rejects a malformed / wrong-length key', () => {
    expect(decodeVapidPublicKey('')).toBeNull();
    expect(decodeVapidPublicKey('notbase64!!!')).toBeNull();
    expect(decodeVapidPublicKey(bytesToBase64Url(new Uint8Array(32)))).toBeNull();
    const wrongPrefix = new Uint8Array(65);
    wrongPrefix[0] = 0x02;
    expect(decodeVapidPublicKey(bytesToBase64Url(wrongPrefix))).toBeNull();
  });
});

describe('subscriptionToProviderToken', () => {
  const good = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    expirationTime: null,
    keys: { p256dh: 'BExxx', auth: 'authKey' },
  };

  it('maps a browser PushSubscription.toJSON() to the gateway webpush token shape', () => {
    const token = subscriptionToProviderToken(good);
    expect(token).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'BExxx', auth: 'authKey' },
    });
  });

  it('carries only endpoint + keys (no identity fields leak through)', () => {
    const token = subscriptionToProviderToken({ ...good, deviceId: 'secret', community: 'x' } as unknown);
    expect(Object.keys(token!)).toEqual(['endpoint', 'keys']);
    expect(JSON.stringify(token)).not.toContain('secret');
  });

  it('returns null for a missing endpoint or missing keys', () => {
    expect(subscriptionToProviderToken(null)).toBeNull();
    expect(subscriptionToProviderToken({ keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
    expect(subscriptionToProviderToken({ endpoint: 'https://x', keys: { p256dh: 'a' } })).toBeNull();
    expect(subscriptionToProviderToken({ endpoint: 'https://x', keys: {} })).toBeNull();
    expect(subscriptionToProviderToken({ endpoint: 'not a url', keys: { p256dh: 'a', auth: 'b' } })).toBeNull();
  });

  it('serializes to the exact JSON string the server parses', () => {
    const token = subscriptionToProviderToken(good) as WebPushProviderToken;
    const parsed = JSON.parse(serializeProviderToken(token));
    expect(parsed).toEqual({ endpoint: good.endpoint, keys: good.keys });
  });
});

describe('providerTokensEqual', () => {
  const a: WebPushProviderToken = { endpoint: 'https://x/1', keys: { p256dh: 'p', auth: 'a' } };
  it('is true for identical tokens and false when any field differs', () => {
    expect(providerTokensEqual(a, { ...a, keys: { ...a.keys } })).toBe(true);
    expect(providerTokensEqual(a, { ...a, endpoint: 'https://x/2' })).toBe(false);
    expect(providerTokensEqual(a, { ...a, keys: { p256dh: 'q', auth: 'a' } })).toBe(false);
    expect(providerTokensEqual(a, null)).toBe(false);
    expect(providerTokensEqual(null, null)).toBe(true);
  });
});

describe('base64UrlToBytes', () => {
  it('round-trips and tolerates standard base64 (+/ and =)', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes))!)).toEqual(Array.from(bytes));
    // standard-base64 form still decodes
    expect(base64UrlToBytes('++//==')).not.toBeNull();
  });
});

// Test helper: encode bytes to base64url (the decode side is under test).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function bytesToBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const remaining = bytes.length - i;
    output += ALPHABET[(chunk >> 18) & 63];
    output += ALPHABET[(chunk >> 12) & 63];
    if (remaining > 1) output += ALPHABET[(chunk >> 6) & 63];
    if (remaining > 2) output += ALPHABET[chunk & 63];
  }
  return output;
}
