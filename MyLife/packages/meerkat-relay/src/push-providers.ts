/**
 * Provider adapters for the Meerkat push gateway (Plan 42 P4).
 *
 * ONE contract (PushProviderAdapter) wraps the three production push transports so
 * the gateway attempt loop drives them uniformly. An adapter receives a decrypted
 * provider token plus an OPAQUE wake payload and returns a BOUNDED, machine-readable
 * outcome. It NEVER returns a provider response body, a token, a device identity, or
 * any free-form remote string: only `{ accepted, providerReference? }`,
 * `{ rejected, reasonClass }`, `{ retryable, reasonClass }`, or `{ unavailable }`.
 *
 * Dependency-free by construction (NC hardening): APNs speaks HTTP/2 over
 * node:http2 with an ES256 provider-token JWT; FCM v1 mints an RS256 service-account
 * OAuth token (node:crypto) and POSTs over fetch; Web Push encrypts the payload with
 * RFC 8291 aes128gcm (node:crypto ECDH + HKDF) and signs a VAPID ES256 JWT. Provider
 * credentials load from MOUNTED SECRET FILES (paths via env), never plain env values.
 *
 * The opaque wake payload is a caller-provided ciphertext blob (the peer already
 * encrypted it end-to-end); adapters transport it verbatim and cap its size. The
 * gateway records provider ACCEPTANCE, never "delivered" (NC-42.4), and no adapter
 * ever logs the payload, the token, or a provider identity (NC-42.3).
 */

import {
  createCipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign as signOneShot,
  type KeyObject,
} from 'node:crypto';
import * as http2 from 'node:http2';

/** Maximum opaque wake payload the gateway accepts and an adapter will transport. */
export const MAX_PUSH_WAKE_PAYLOAD_BYTES = 2 * 1024;

/** Urgency hint. `high` maps to immediate provider priority, `normal` to deferred. */
export type PushWakeUrgency = 'high' | 'normal';

/**
 * Bounded outcome reason classes. These are the ONLY strings an outcome may carry
 * besides an optional provider-issued opaque reference. Each is a fixed enum member,
 * never a remote message. The gateway maps them to attempt error codes and to the
 * provider-token invalidation decision.
 */
export type PushRejectionReasonClass =
  | 'invalid_token' // provider says the token is not a valid destination (410/BadDeviceToken)
  | 'token_unregistered' // provider says the app was uninstalled (410/Unregistered)
  | 'payload_rejected' // provider rejected the request shape or size
  | 'auth_rejected' // provider rejected our credential (403/InvalidProviderToken)
  | 'not_permitted'; // provider refused for a policy reason

export type PushRetryableReasonClass =
  | 'provider_unavailable' // 5xx / connection reset; retry later
  | 'rate_limited' // provider throttled us (429/TooManyRequests)
  | 'timeout' // the request did not complete within the bounded budget
  | 'transport_error'; // a network or protocol error before a verdict

export type PushProviderOutcome =
  | { kind: 'accepted'; providerReference?: string }
  | { kind: 'rejected'; reasonClass: PushRejectionReasonClass }
  | { kind: 'retryable'; reasonClass: PushRetryableReasonClass }
  | { kind: 'unavailable' };

/** The decrypted provider token plus the routing context an adapter needs. */
export interface PushProviderSendInput {
  /**
   * The decrypted provider destination. For APNs this is the hex device token; for
   * FCM the registration token; for Web Push a JSON subscription (endpoint + keys).
   * The gateway decrypts it from the store immediately before the send and never
   * persists or logs it.
   */
  token: string;
  /** Opaque, already-encrypted wake bytes. Transported verbatim, size-capped. */
  payload: Uint8Array;
  urgency: PushWakeUrgency;
  /** Bounded per-send wall-clock budget in milliseconds. */
  timeoutMs: number;
}

/** The single contract the gateway attempt loop drives for every provider. */
export interface PushProviderAdapter {
  readonly provider: 'apns' | 'fcm' | 'webpush';
  send(input: PushProviderSendInput): Promise<PushProviderOutcome>;
  /** Release any pooled sockets / sessions. Idempotent. */
  close(): Promise<void>;
}

function assertPayload(payload: Uint8Array): void {
  if (!(payload instanceof Uint8Array) || payload.byteLength === 0) {
    throw new TypeError('Push wake payload must be non-empty bytes');
  }
  if (payload.byteLength > MAX_PUSH_WAKE_PAYLOAD_BYTES) {
    throw new TypeError(`Push wake payload exceeds ${MAX_PUSH_WAKE_PAYLOAD_BYTES} bytes`);
  }
}

function clampTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) return 10_000;
  return Math.min(30_000, Math.max(250, Math.floor(timeoutMs)));
}

function base64Url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('base64url');
}

function jwtSegment(value: unknown): string {
  return base64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

// ---------------------------------------------------------------------------
// APNs adapter: HTTP/2 + ES256 provider-token JWT.
// ---------------------------------------------------------------------------

export interface ApnsAdapterConfig {
  /** Apple auth key id (kid). */
  keyId: string;
  /** Apple team id (iss). */
  teamId: string;
  /** App bundle id, used as the apns-topic. */
  topic: string;
  /** PEM contents of the .p8 signing key, read from a mounted secret file. */
  signingKeyPem: string;
  /** Base URL, e.g. https://api.push.apple.com or the sandbox host. */
  baseUrl: string;
  /** Injected HTTP/2 connect for hermetic tests. Defaults to node:http2.connect. */
  connect?: (authority: string) => http2.ClientHttp2Session;
  now?: () => number;
}

/** APNs provider-token JWT is reused until it nears its 1-hour cap (Apple's rule). */
const APNS_TOKEN_TTL_MS = 50 * 60 * 1000;

export class ApnsProviderAdapter implements PushProviderAdapter {
  readonly provider = 'apns' as const;
  private readonly config: ApnsAdapterConfig;
  private readonly signingKey: KeyObject;
  private readonly authority: string;
  private cachedJwt: { token: string; mintedAtMs: number } | null = null;
  private session: http2.ClientHttp2Session | null = null;

  constructor(config: ApnsAdapterConfig) {
    if (!/^[A-Za-z0-9]{4,64}$/u.test(config.keyId)) throw new TypeError('APNs keyId is invalid');
    if (!/^[A-Za-z0-9]{4,64}$/u.test(config.teamId)) throw new TypeError('APNs teamId is invalid');
    if (!/^[A-Za-z0-9.-]{1,255}$/u.test(config.topic)) throw new TypeError('APNs topic is invalid');
    let parsed: URL;
    try {
      parsed = new URL(config.baseUrl);
    } catch {
      throw new TypeError('APNs baseUrl is invalid');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new TypeError('APNs baseUrl must be http(s)');
    }
    this.signingKey = createPrivateKey(config.signingKeyPem);
    this.config = config;
    this.authority = parsed.origin;
  }

  private mintJwt(nowMs: number): string {
    if (this.cachedJwt && nowMs - this.cachedJwt.mintedAtMs < APNS_TOKEN_TTL_MS) {
      return this.cachedJwt.token;
    }
    const header = jwtSegment({ alg: 'ES256', kid: this.config.keyId });
    const claims = jwtSegment({ iss: this.config.teamId, iat: Math.floor(nowMs / 1000) });
    const signingInput = `${header}.${claims}`;
    const signature = signOneShot('sha256', Buffer.from(signingInput), {
      key: this.signingKey,
      dsaEncoding: 'ieee-p1363',
    });
    const token = `${signingInput}.${base64Url(signature)}`;
    this.cachedJwt = { token, mintedAtMs: nowMs };
    return token;
  }

  private ensureSession(): http2.ClientHttp2Session {
    if (this.session && !this.session.closed && !this.session.destroyed) return this.session;
    const connect = this.config.connect ?? ((authority: string) => http2.connect(authority));
    const session = connect(this.authority);
    session.on('error', () => {
      // Swallow: a broken session is discarded and rebuilt on the next send. The
      // error text could carry TLS/connection detail we never surface.
      if (this.session === session) this.session = null;
    });
    this.session = session;
    return session;
  }

  async send(input: PushProviderSendInput): Promise<PushProviderOutcome> {
    assertPayload(input.payload);
    if (!/^[a-fA-F0-9]{16,200}$/u.test(input.token)) {
      return { kind: 'rejected', reasonClass: 'invalid_token' };
    }
    const now = this.config.now ?? Date.now;
    const timeoutMs = clampTimeout(input.timeoutMs);
    let jwt: string;
    try {
      jwt = this.mintJwt(now());
    } catch {
      return { kind: 'rejected', reasonClass: 'auth_rejected' };
    }
    // The wake body is an opaque APNs content-available push. The bytes ride in a
    // bounded base64 field; APNs never sees plaintext (the peer already encrypted it).
    const body = Buffer.from(JSON.stringify({
      aps: { 'content-available': 1 },
      w: base64Url(input.payload),
    }), 'utf8');

    let session: http2.ClientHttp2Session;
    try {
      session = this.ensureSession();
    } catch {
      return { kind: 'retryable', reasonClass: 'transport_error' };
    }
    return await new Promise<PushProviderOutcome>((resolve) => {
      let settled = false;
      const settle = (outcome: PushProviderOutcome): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(outcome);
      };
      const timer = setTimeout(() => {
        try { request?.close(http2.constants.NGHTTP2_CANCEL); } catch { /* ignore */ }
        settle({ kind: 'retryable', reasonClass: 'timeout' });
      }, timeoutMs);
      timer.unref?.();

      let request: http2.ClientHttp2Stream | null = null;
      try {
        request = session.request({
          ':method': 'POST',
          ':path': `/3/device/${input.token}`,
          'apns-topic': this.config.topic,
          'apns-push-type': 'background',
          'apns-priority': input.urgency === 'high' ? '10' : '5',
          authorization: `bearer ${jwt}`,
          'content-type': 'application/json',
          'content-length': String(body.byteLength),
        });
      } catch {
        settle({ kind: 'retryable', reasonClass: 'transport_error' });
        return;
      }

      let status = 0;
      let apnsId: string | undefined;
      const chunks: Buffer[] = [];
      request.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
        // apns-id is APNs's opaque per-request reference; safe to record as the
        // provider reference (it is not a device or user identity).
        const raw = headers['apns-id'];
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value === 'string' && /^[A-Za-z0-9-]{1,128}$/u.test(value)) apnsId = value;
      });
      request.on('data', (chunk: Buffer) => {
        // The response body may carry an APNs `reason`; we read only its bounded
        // enum to class the outcome, never surfacing the raw text.
        if (chunks.length < 8) chunks.push(chunk);
      });
      request.on('error', () => {
        if (this.session === session) this.session = null;
        settle({ kind: 'retryable', reasonClass: 'transport_error' });
      });
      request.on('end', () => {
        const reason = parseApnsReason(Buffer.concat(chunks));
        settle(classifyApns(status, reason, apnsId));
      });
      request.end(body);
    });
  }

  async close(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (!session) return;
    await new Promise<void>((resolve) => {
      session.close(() => resolve());
    });
  }
}

function parseApnsReason(body: Buffer): string | null {
  if (body.byteLength === 0 || body.byteLength > 4096) return null;
  try {
    const parsed = JSON.parse(body.toString('utf8')) as { reason?: unknown };
    return typeof parsed.reason === 'string' && /^[A-Za-z]{1,64}$/u.test(parsed.reason)
      ? parsed.reason
      : null;
  } catch {
    return null;
  }
}

function classifyApns(
  status: number,
  reason: string | null,
  providerReference: string | undefined,
): PushProviderOutcome {
  if (status === 200) {
    return providerReference ? { kind: 'accepted', providerReference } : { kind: 'accepted' };
  }
  if (status === 410 || reason === 'Unregistered') {
    return { kind: 'rejected', reasonClass: 'token_unregistered' };
  }
  if (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') {
    return { kind: 'rejected', reasonClass: 'invalid_token' };
  }
  if (status === 403 || reason === 'InvalidProviderToken' || reason === 'ExpiredProviderToken') {
    return { kind: 'rejected', reasonClass: 'auth_rejected' };
  }
  if (status === 429 || reason === 'TooManyRequests') {
    return { kind: 'retryable', reasonClass: 'rate_limited' };
  }
  if (status === 400) {
    return { kind: 'rejected', reasonClass: 'payload_rejected' };
  }
  if (status >= 500) {
    return { kind: 'retryable', reasonClass: 'provider_unavailable' };
  }
  return { kind: 'unavailable' };
}

// ---------------------------------------------------------------------------
// FCM adapter: HTTP v1 + RS256 service-account OAuth token minting.
// ---------------------------------------------------------------------------

export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  /** PEM private key from the service-account JSON, read from a mounted secret file. */
  privateKeyPem: string;
  /** OAuth token endpoint. Defaults to Google's. */
  tokenUri?: string;
}

export interface FcmAdapterConfig {
  serviceAccount: FcmServiceAccount;
  /** FCM v1 send base, defaults to https://fcm.googleapis.com. */
  baseUrl?: string;
  /** Injected fetch for hermetic tests. Defaults to global fetch. */
  fetch?: typeof fetch;
  now?: () => number;
}

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_TOKEN_SKEW_MS = 60 * 1000;

export class FcmProviderAdapter implements PushProviderAdapter {
  readonly provider = 'fcm' as const;
  private readonly config: FcmAdapterConfig;
  private readonly signingKey: KeyObject;
  private readonly sendUrl: string;
  private readonly tokenUri: string;
  private readonly fetchImpl: typeof fetch;
  private cachedOAuth: { token: string; expiresAtMs: number } | null = null;
  private inFlightMint: Promise<string> | null = null;

  constructor(config: FcmAdapterConfig) {
    const account = config.serviceAccount;
    if (!/^[a-z0-9-]{4,64}$/u.test(account.projectId)) throw new TypeError('FCM projectId is invalid');
    if (!/^[^\s@]+@[^\s@]+$/u.test(account.clientEmail)) throw new TypeError('FCM clientEmail is invalid');
    this.signingKey = createPrivateKey(account.privateKeyPem);
    const base = config.baseUrl ?? 'https://fcm.googleapis.com';
    const parsedBase = new URL(base);
    if (parsedBase.protocol !== 'https:' && parsedBase.protocol !== 'http:') {
      throw new TypeError('FCM baseUrl must be http(s)');
    }
    this.sendUrl = `${parsedBase.origin}/v1/projects/${account.projectId}/messages:send`;
    this.tokenUri = account.tokenUri ?? GOOGLE_TOKEN_URI;
    this.fetchImpl = config.fetch ?? fetch;
    this.config = config;
  }

  private async oauthToken(nowMs: number): Promise<string> {
    if (this.cachedOAuth && this.cachedOAuth.expiresAtMs - FCM_TOKEN_SKEW_MS > nowMs) {
      return this.cachedOAuth.token;
    }
    if (this.inFlightMint) return this.inFlightMint;
    this.inFlightMint = this.mintOAuthToken(nowMs).finally(() => {
      this.inFlightMint = null;
    });
    return this.inFlightMint;
  }

  private async mintOAuthToken(nowMs: number): Promise<string> {
    const account = this.config.serviceAccount;
    const iat = Math.floor(nowMs / 1000);
    const assertion = [
      jwtSegment({ alg: 'RS256', typ: 'JWT' }),
      jwtSegment({
        iss: account.clientEmail,
        scope: FCM_SCOPE,
        aud: this.tokenUri,
        iat,
        exp: iat + 3600,
      }),
    ].join('.');
    const signer = createSign('RSA-SHA256');
    signer.update(assertion);
    const signature = signer.sign(this.signingKey);
    const jwt = `${assertion}.${base64Url(signature)}`;
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });
    const response = await this.fetchImpl(this.tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error('fcm_oauth_rejected');
    const json = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof json.access_token !== 'string' || json.access_token.length === 0) {
      throw new Error('fcm_oauth_malformed');
    }
    const expiresInSec = typeof json.expires_in === 'number' && json.expires_in > 0
      ? json.expires_in
      : 3600;
    this.cachedOAuth = { token: json.access_token, expiresAtMs: nowMs + expiresInSec * 1000 };
    return json.access_token;
  }

  async send(input: PushProviderSendInput): Promise<PushProviderOutcome> {
    assertPayload(input.payload);
    if (!/^[A-Za-z0-9_:.%-]{32,4096}$/u.test(input.token)) {
      return { kind: 'rejected', reasonClass: 'invalid_token' };
    }
    const now = this.config.now ?? Date.now;
    const timeoutMs = clampTimeout(input.timeoutMs);
    let oauth: string;
    try {
      oauth = await this.oauthToken(now());
    } catch {
      return { kind: 'rejected', reasonClass: 'auth_rejected' };
    }
    // Data-only message with the opaque wake bytes in a bounded base64 field so the
    // OS delivers it to the background handler without a user-visible notification.
    const message = {
      message: {
        token: input.token,
        data: { w: base64Url(input.payload) },
        android: { priority: input.urgency === 'high' ? 'high' : 'normal' },
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await this.fetchImpl(this.sendUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${oauth}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      const bodyText = await readBoundedText(response);
      return classifyFcm(response.status, bodyText);
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        return { kind: 'retryable', reasonClass: 'timeout' };
      }
      return { kind: 'retryable', reasonClass: 'transport_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    this.cachedOAuth = null;
  }
}

async function readBoundedText(response: { text(): Promise<string> }): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 8192 ? text.slice(0, 8192) : text;
  } catch {
    return '';
  }
}

function fcmErrorStatus(bodyText: string): string | null {
  if (!bodyText) return null;
  try {
    const parsed = JSON.parse(bodyText) as { error?: { status?: unknown; details?: unknown } };
    const status = parsed.error?.status;
    if (typeof status === 'string' && /^[A-Z_]{1,64}$/u.test(status)) return status;
    return null;
  } catch {
    return null;
  }
}

function classifyFcm(status: number, bodyText: string): PushProviderOutcome {
  if (status >= 200 && status < 300) {
    const reference = parseFcmName(bodyText);
    return reference ? { kind: 'accepted', providerReference: reference } : { kind: 'accepted' };
  }
  const errorStatus = fcmErrorStatus(bodyText);
  if (status === 404 || errorStatus === 'NOT_FOUND' || errorStatus === 'UNREGISTERED') {
    return { kind: 'rejected', reasonClass: 'token_unregistered' };
  }
  if (status === 400 || errorStatus === 'INVALID_ARGUMENT') {
    return { kind: 'rejected', reasonClass: 'payload_rejected' };
  }
  if (status === 401 || status === 403
    || errorStatus === 'UNAUTHENTICATED' || errorStatus === 'PERMISSION_DENIED') {
    return { kind: 'rejected', reasonClass: 'auth_rejected' };
  }
  if (status === 429 || errorStatus === 'RESOURCE_EXHAUSTED' || errorStatus === 'QUOTA_EXCEEDED') {
    return { kind: 'retryable', reasonClass: 'rate_limited' };
  }
  if (status >= 500 || errorStatus === 'UNAVAILABLE' || errorStatus === 'INTERNAL') {
    return { kind: 'retryable', reasonClass: 'provider_unavailable' };
  }
  return { kind: 'unavailable' };
}

function parseFcmName(bodyText: string): string | undefined {
  if (!bodyText) return undefined;
  try {
    const parsed = JSON.parse(bodyText) as { name?: unknown };
    if (typeof parsed.name === 'string' && /^[A-Za-z0-9/_:.-]{1,256}$/u.test(parsed.name)) {
      return parsed.name;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Web Push adapter: VAPID ES256 JWT + RFC 8291 aes128gcm payload encryption.
// ---------------------------------------------------------------------------

export interface WebPushAdapterConfig {
  /** VAPID subject: a mailto: or https: contact URI. */
  subject: string;
  /** VAPID public key (uncompressed P-256 point, 65 bytes, base64url). */
  publicKey: string;
  /** VAPID private key PEM, read from a mounted secret file. */
  privateKeyPem: string;
  fetch?: typeof fetch;
  now?: () => number;
  /** Random source for the ephemeral ECDH key and salt (tests inject determinism). */
  randomBytes?: (size: number) => Buffer;
}

const VAPID_JWT_TTL_SEC = 12 * 60 * 60;

interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export class WebPushProviderAdapter implements PushProviderAdapter {
  readonly provider = 'webpush' as const;
  private readonly config: WebPushAdapterConfig;
  private readonly vapidKey: KeyObject;
  private readonly fetchImpl: typeof fetch;
  private readonly random: (size: number) => Buffer;

  constructor(config: WebPushAdapterConfig) {
    if (!/^(mailto:|https:\/\/)/u.test(config.subject)) throw new TypeError('VAPID subject is invalid');
    if (base64UrlToBuffer(config.publicKey)?.length !== 65) throw new TypeError('VAPID public key is invalid');
    this.vapidKey = createPrivateKey(config.privateKeyPem);
    this.fetchImpl = config.fetch ?? fetch;
    this.random = config.randomBytes ?? ((size: number) => randomBytes(size));
    this.config = config;
  }

  async send(input: PushProviderSendInput): Promise<PushProviderOutcome> {
    assertPayload(input.payload);
    const subscription = parseSubscription(input.token);
    if (!subscription) return { kind: 'rejected', reasonClass: 'invalid_token' };
    const now = this.config.now ?? Date.now;
    const timeoutMs = clampTimeout(input.timeoutMs);

    let encrypted: Buffer;
    try {
      encrypted = encryptAes128Gcm(subscription, input.payload, this.random);
    } catch {
      return { kind: 'rejected', reasonClass: 'invalid_token' };
    }
    let audience: string;
    try {
      audience = new URL(subscription.endpoint).origin;
    } catch {
      return { kind: 'rejected', reasonClass: 'invalid_token' };
    }
    let vapidJwt: string;
    try {
      vapidJwt = this.mintVapidJwt(audience, now());
    } catch {
      return { kind: 'rejected', reasonClass: 'auth_rejected' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    // Copy the ciphertext into a fresh, plain ArrayBuffer for the request body: a
    // Uint8Array view is typed ArrayBufferLike (includes SharedArrayBuffer), which
    // the DOM lib's stricter BodyInit rejects under browser consumers of the relay
    // barrel (same fix as 0d85b12f).
    const bodyBuffer = new ArrayBuffer(encrypted.byteLength);
    new Uint8Array(bodyBuffer).set(encrypted);
    try {
      const response = await this.fetchImpl(subscription.endpoint, {
        method: 'POST',
        headers: {
          authorization: `vapid t=${vapidJwt}, k=${this.config.publicKey}`,
          'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream',
          ttl: '2419200',
          urgency: input.urgency === 'high' ? 'high' : 'normal',
        },
        body: bodyBuffer,
        signal: controller.signal,
      });
      return classifyWebPush(response.status);
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        return { kind: 'retryable', reasonClass: 'timeout' };
      }
      return { kind: 'retryable', reasonClass: 'transport_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  private mintVapidJwt(audience: string, nowMs: number): string {
    const header = jwtSegment({ typ: 'JWT', alg: 'ES256' });
    const claims = jwtSegment({
      aud: audience,
      exp: Math.floor(nowMs / 1000) + VAPID_JWT_TTL_SEC,
      sub: this.config.subject,
    });
    const signingInput = `${header}.${claims}`;
    const signature = signOneShot('sha256', Buffer.from(signingInput), {
      key: this.vapidKey,
      dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${base64Url(signature)}`;
  }

  async close(): Promise<void> {
    // No pooled resources; the injected fetch owns its own sockets.
  }
}

function base64UrlToBuffer(value: string): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

function parseSubscription(token: string): WebPushSubscription | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(token);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as { endpoint?: unknown; keys?: unknown };
  if (typeof candidate.endpoint !== 'string') return null;
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(candidate.endpoint);
  } catch {
    return null;
  }
  if (endpointUrl.protocol !== 'https:' && endpointUrl.protocol !== 'http:') return null;
  const keys = candidate.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  const p256dh = base64UrlToBuffer(keys.p256dh);
  const auth = base64UrlToBuffer(keys.auth);
  if (p256dh?.length !== 65 || auth?.length !== 16) return null;
  return { endpoint: candidate.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * RFC 8291 aes128gcm content encoding. Derives the content key and nonce from an
 * ephemeral ECDH shared secret and the subscription's auth secret via HKDF-SHA256,
 * then AES-128-GCM seals the padded plaintext. The returned buffer is the full
 * aes128gcm body: header (salt, record size, key id length, ephemeral public key)
 * followed by the single ciphertext record.
 */
function encryptAes128Gcm(
  subscription: WebPushSubscription,
  plaintext: Uint8Array,
  random: (size: number) => Buffer,
): Buffer {
  const clientPublic = Buffer.from(subscription.keys.p256dh, 'base64url');
  const authSecret = Buffer.from(subscription.keys.auth, 'base64url');
  const salt = random(16);
  if (salt.length !== 16) throw new Error('web push salt must be 16 bytes');

  // Ephemeral server ECDH key pair (P-256). Export the raw uncompressed public point.
  const ephemeral = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const serverPublicRaw = ecPublicKeyToRaw(ephemeral.publicKey);

  const clientKeyObject = createPublicKey({
    key: rawToSpkiP256(clientPublic),
    format: 'der',
    type: 'spki',
  });
  const sharedSecret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: clientKeyObject });

  // RFC 8291 key derivation: PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info" || ua_public || as_public, 32).
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublic,
    serverPublicRaw,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));

  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // A single record: plaintext followed by the 0x02 delimiter (last-record marker).
  const record = Buffer.concat([Buffer.from(plaintext), Buffer.from([0x02])]);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(ciphertext.byteLength + 16 + 21, 0); // padded record size hint
  const header = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicRaw.byteLength]),
    serverPublicRaw,
  ]);
  return Buffer.concat([header, ciphertext]);
}

/** Wrap a raw uncompressed P-256 point (65 bytes, 0x04 prefix) in a DER SubjectPublicKeyInfo. */
function rawToSpkiP256(raw: Buffer): Buffer {
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error('invalid P-256 public point');
  // Fixed DER prefix for an id-ecPublicKey / prime256v1 SubjectPublicKeyInfo.
  const prefix = Buffer.from(
    '3059301306072a8648ce3d020106082a8648ce3d030107034200',
    'hex',
  );
  return Buffer.concat([prefix, raw]);
}

function ecPublicKeyToRaw(publicKey: KeyObject): Buffer {
  const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  // The raw uncompressed point is the trailing 65 bytes of the P-256 SPKI.
  const raw = spki.subarray(spki.length - 65);
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error('unexpected EC public key encoding');
  return Buffer.from(raw);
}

function classifyWebPush(status: number): PushProviderOutcome {
  if (status >= 200 && status < 300) return { kind: 'accepted' };
  if (status === 404 || status === 410) return { kind: 'rejected', reasonClass: 'token_unregistered' };
  if (status === 400) return { kind: 'rejected', reasonClass: 'payload_rejected' };
  if (status === 401 || status === 403) return { kind: 'rejected', reasonClass: 'auth_rejected' };
  if (status === 413) return { kind: 'rejected', reasonClass: 'payload_rejected' };
  if (status === 429) return { kind: 'retryable', reasonClass: 'rate_limited' };
  if (status >= 500) return { kind: 'retryable', reasonClass: 'provider_unavailable' };
  return { kind: 'unavailable' };
}

// ---------------------------------------------------------------------------
// Fake adapter: scripted outcomes for hermetic gateway tests.
// ---------------------------------------------------------------------------

export interface FakeProviderCall {
  token: string;
  payload: Uint8Array;
  urgency: PushWakeUrgency;
}

/**
 * A scripted adapter for hermetic tests. Outcomes are dequeued in order; when the
 * script is exhausted it returns the `fallback` (default accepted). It records every
 * call so a test can assert the gateway decrypted the right token and forwarded the
 * opaque payload verbatim.
 */
export class FakeProviderAdapter implements PushProviderAdapter {
  readonly provider: 'apns' | 'fcm' | 'webpush';
  readonly calls: FakeProviderCall[] = [];
  private readonly scripted: PushProviderOutcome[];
  private readonly fallback: PushProviderOutcome;
  private closed = false;

  constructor(options: {
    provider?: 'apns' | 'fcm' | 'webpush';
    outcomes?: PushProviderOutcome[];
    fallback?: PushProviderOutcome;
  } = {}) {
    this.provider = options.provider ?? 'apns';
    this.scripted = [...(options.outcomes ?? [])];
    this.fallback = options.fallback ?? { kind: 'accepted' };
  }

  async send(input: PushProviderSendInput): Promise<PushProviderOutcome> {
    assertPayload(input.payload);
    this.calls.push({
      token: input.token,
      payload: Uint8Array.from(input.payload),
      urgency: input.urgency,
    });
    return this.scripted.shift() ?? this.fallback;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * Deterministic capability/registration hashing helper shared by the gateway and its
 * clients. The bearer material (registration id, registration secret, capability) is
 * only ever stored as its SHA-256 hex, so both sides derive the lookup key the same way.
 */
export function pushSha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(typeof value === 'string' ? Buffer.from(value, 'utf8') : value).digest('hex');
}

/** Constant-time HMAC used for opaque idempotency-key derivation on the server edge. */
export function pushHmacHex(key: string, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}
