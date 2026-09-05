/**
 * Push gateway client (Plan 42 P3).
 *
 * The real client for the Meerkat push gateway's /v1/push/* surface. It registers this
 * install's provider token, rotates and unregisters it, mints wake capabilities to
 * share with a peer through an encrypted paired flow, and sends an opaque wake to a
 * peer by their capability hash.
 *
 * RN-SAFE AT IMPORT TIME. This module imports nothing from `node:` and uses only
 * `fetch`, `AbortController`, `TextEncoder`, and base64 helpers, so it loads on device
 * (Metro), in the browser, and in Node identically. All provider-protocol cryptography
 * (APNs JWT, FCM OAuth, VAPID, RFC 8291) is SERVER-side in @mylife/meerkat-relay and
 * never enters this graph.
 *
 * Privacy: the gateway is addressed by RANDOM capabilities, never a device key. This
 * client sends a registration secret to prove a mutation and a raw capability to prove
 * a wake; it never sends a Meerkat identity, community id, message id, or plaintext.
 * The wake payload is opaque bytes the caller already encrypted end-to-end.
 *
 * Errors never leak: every method returns a typed result and never throws a raw fetch
 * error. Requests are bounded by an AbortController timeout.
 */

/** The addressing material for one install, held only in the caller's secure storage. */
export interface PushRegistrationBinding {
  /** Random 256-bit base64url server lookup id. */
  registrationId: string;
  /** Random 256-bit base64url update/delete secret. NEVER leaves secure storage plaintext. */
  registrationSecret: string;
}

export type PushProviderKind = 'apns' | 'fcm' | 'webpush';
export type PushWakeScope = 'sync_wake' | 'call_wake';
export type PushWakePriority = 'high' | 'normal';

export interface PushGatewayClientOptions {
  /** Base URL of the push gateway, e.g. https://push.example. */
  serverUrl: string;
  /** Injected fetch (defaults to the global). Lets callers supply a bounded/instrumented fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms (bounded 1s..30s). */
  timeoutMs?: number;
  /** Random 256-bit base64url token generator (defaults to a Web Crypto source). */
  generateToken?: () => string;
}

export interface RegisterInput {
  binding: PushRegistrationBinding;
  provider: PushProviderKind;
  /** The provider token (APNs hex, FCM token, or a Web Push subscription JSON string). */
  providerToken: string;
  tokenTtlMs: number;
  registrationTtlMs: number;
  idempotencyKey: string;
}

export interface RotateTokenInput {
  binding: PushRegistrationBinding;
  providerToken: string;
  tokenTtlMs: number;
  idempotencyKey: string;
}

export interface MintCapabilityInput {
  binding: PushRegistrationBinding;
  /** The raw capability to share with the peer. Generate via `generateCapability()`. */
  capability: string;
  scope: PushWakeScope;
  ttlMs: number;
  idempotencyKey: string;
}

export interface SendWakeInput {
  /** The peer's raw wake capability, learned through an encrypted paired flow. */
  capability: string;
  scope: PushWakeScope;
  /** Opaque, already-encrypted wake bytes (max 2 KiB). */
  payload: Uint8Array;
  priority: PushWakePriority;
  idempotencyKey: string;
}

export type PushClientResult<Value = void> =
  | { ok: true; value: Value }
  | { ok: false; error: PushClientError };

export type PushClientError =
  | 'network_error'
  | 'timeout'
  | 'unauthorized'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  | 'invalid_request'
  | 'unavailable'
  | 'server_error';

export interface WakeAcceptance {
  attemptId: string;
}

export type PublicWakeStatus = 'provider_accepted' | 'provider_rejected' | 'unknown';

export interface WakeStatusResult {
  attemptId: string;
  providerStatus: PublicWakeStatus;
  terminal: boolean;
}

const MAX_WAKE_PAYLOAD_BYTES = 2 * 1024;

/** The real push gateway client. */
export class PushGatewayClient {
  private readonly serverUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly generateTokenImpl: () => string;

  constructor(options: PushGatewayClientOptions) {
    const trimmed = options.serverUrl.replace(/\/+$/u, '');
    if (!/^https?:\/\//u.test(trimmed)) throw new Error('push gateway serverUrl must be http(s)');
    this.serverUrl = trimmed;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = Math.min(30_000, Math.max(1_000, Math.floor(options.timeoutMs ?? 10_000)));
    this.generateTokenImpl = options.generateToken ?? defaultGenerateToken;
  }

  /** Mint a fresh 256-bit random registration binding (id + secret). */
  createBinding(): PushRegistrationBinding {
    return { registrationId: this.generateTokenImpl(), registrationSecret: this.generateTokenImpl() };
  }

  /** Mint a fresh 256-bit random wake capability to share with one peer. */
  generateCapability(): string {
    return this.generateTokenImpl();
  }

  /** Register (bind) this install's provider token under a registration secret. */
  async register(input: RegisterInput): Promise<PushClientResult> {
    return this.mutate('/v1/push/registrations', input.binding.registrationSecret, {
      registrationId: input.binding.registrationId,
      provider: input.provider,
      providerToken: input.providerToken,
      tokenTtlMs: input.tokenTtlMs,
      registrationTtlMs: input.registrationTtlMs,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Rotate the provider token for an existing registration (old generation overlaps). */
  async rotateToken(input: RotateTokenInput): Promise<PushClientResult> {
    return this.mutate('/v1/push/registrations', input.binding.registrationSecret, {
      registrationId: input.binding.registrationId,
      rotate: true,
      providerToken: input.providerToken,
      tokenTtlMs: input.tokenTtlMs,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Revoke this install and every capability it minted. */
  async unregister(binding: PushRegistrationBinding, idempotencyKey: string): Promise<PushClientResult> {
    const path = `/v1/push/registrations/${encodeURIComponent(binding.registrationId)}`;
    return this.mutate(path, binding.registrationSecret, { idempotencyKey }, 'DELETE');
  }

  /** Mint a recipient-specific wake capability to share with a peer over an encrypted flow. */
  async mintCapability(input: MintCapabilityInput): Promise<PushClientResult> {
    return this.mutate('/v1/push/capabilities', input.binding.registrationSecret, {
      registrationId: input.binding.registrationId,
      capability: input.capability,
      scope: input.scope,
      ttlMs: input.ttlMs,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Revoke a peer's wake permission. */
  async revokeCapability(
    binding: PushRegistrationBinding,
    capability: string,
    idempotencyKey: string,
  ): Promise<PushClientResult> {
    const path = `/v1/push/capabilities/${encodeURIComponent(capability)}`;
    return this.mutate(path, binding.registrationSecret, {
      registrationId: binding.registrationId,
      idempotencyKey,
    }, 'DELETE');
  }

  /** Send an opaque wake to a peer addressed by their capability. */
  async sendWake(input: SendWakeInput): Promise<PushClientResult<WakeAcceptance>> {
    if (!(input.payload instanceof Uint8Array) || input.payload.byteLength === 0) {
      return { ok: false, error: 'invalid_request' };
    }
    if (input.payload.byteLength > MAX_WAKE_PAYLOAD_BYTES) {
      return { ok: false, error: 'invalid_request' };
    }
    const response = await this.request('POST', '/v1/push/wakes', input.capability, {
      scope: input.scope,
      payload: bytesToBase64Url(input.payload),
      urgency: input.priority,
      idempotencyKey: input.idempotencyKey,
    });
    if (!response.ok) return { ok: false, error: response.error };
    const attemptId = typeof response.body?.attemptId === 'string' ? response.body.attemptId : '';
    if (!attemptId) return { ok: false, error: 'server_error' };
    return { ok: true, value: { attemptId } };
  }

  /** Read a wake's provider acceptance. Never reports "delivered" (NC-42.4). */
  async getWakeStatus(capability: string, attemptId: string): Promise<PushClientResult<WakeStatusResult>> {
    const path = `/v1/push/status/${encodeURIComponent(attemptId)}`;
    const response = await this.request('GET', path, capability);
    if (!response.ok) return { ok: false, error: response.error };
    const body = response.body ?? {};
    const providerStatus = body.providerStatus;
    if (providerStatus !== 'provider_accepted' && providerStatus !== 'provider_rejected' && providerStatus !== 'unknown') {
      return { ok: false, error: 'server_error' };
    }
    return {
      ok: true,
      value: {
        attemptId: typeof body.attemptId === 'string' ? body.attemptId : attemptId,
        providerStatus,
        terminal: body.terminal === true,
      },
    };
  }

  // ---- internals --------------------------------------------------------

  private async mutate(
    path: string,
    bearer: string,
    body: Record<string, unknown>,
    method: 'POST' | 'DELETE' = 'POST',
  ): Promise<PushClientResult> {
    const response = await this.request(method, path, bearer, body);
    return response.ok ? { ok: true, value: undefined } : { ok: false, error: response.error };
  }

  private async request(
    method: string,
    path: string,
    bearer: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: true; body: Record<string, unknown> | null } | { ok: false; error: PushClientError }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.serverUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${bearer}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (response.status >= 200 && response.status < 300) {
        return { ok: true, body: await parseJsonSafe(response) };
      }
      return { ok: false, error: mapStatus(response.status) };
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return { ok: false, error: 'timeout' };
      return { ok: false, error: 'network_error' };
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapStatus(status: number): PushClientError {
  switch (status) {
    case 400:
      return 'invalid_request';
    case 401:
    case 403:
      return 'unauthorized';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    case 503:
      return 'unavailable';
    default:
      return status >= 500 ? 'server_error' : 'invalid_request';
  }
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text();
    if (text.length === 0) return {};
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const remaining = bytes.length - i;
    output += BASE64URL_ALPHABET[(chunk >> 18) & 63];
    output += BASE64URL_ALPHABET[(chunk >> 12) & 63];
    if (remaining > 1) output += BASE64URL_ALPHABET[(chunk >> 6) & 63];
    if (remaining > 2) output += BASE64URL_ALPHABET[chunk & 63];
  }
  return output;
}

/**
 * 256-bit base64url token from a Web Crypto source. Works on device (React Native's
 * global crypto), in the browser, and in modern Node. There is deliberately NO
 * `node:crypto` fallback: this module must stay RN-safe at import time.
 */
interface WebCryptoRandomSource {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

function defaultGenerateToken(): string {
  const bytes = new Uint8Array(32);
  const cryptoSource = (globalThis as { crypto?: WebCryptoRandomSource }).crypto;
  if (!cryptoSource?.getRandomValues) {
    throw new Error('A Web Crypto getRandomValues source is required to mint push tokens');
  }
  cryptoSource.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

// ---------------------------------------------------------------------------
// Backwards-compatible superset: the legacy PushRelayClient surface.
//
// wp42b's background lifecycle code (registerPushWake) and the existing sync tests
// call register / unregister / sendWakeNotification / isRegistered / getServerUrl.
// This wrapper keeps those names working on top of the real gateway client so the
// mobile surface is a documented SUPERSET, not a breaking rename.
// ---------------------------------------------------------------------------

export interface PushRelayOptions {
  /** URL of the push gateway server. */
  serverUrl: string;
  /** This device's push token (APNs hex, FCM token, or Web Push subscription JSON). */
  deviceToken: string;
  /** The provider this device's token targets. Defaults to apns for legacy callers. */
  provider?: PushProviderKind;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  generateToken?: () => string;
}

export interface PushNotification {
  /** Target peer's raw wake capability. */
  targetToken: string;
  /** Encrypted opaque payload (base64url string or raw bytes). */
  encryptedPayload: string | Uint8Array;
  /** Priority: high for immediate sync, normal for background. */
  priority: PushWakePriority;
  /** Wake scope. Defaults to sync_wake. */
  scope?: PushWakeScope;
}

const DEFAULT_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_REGISTRATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Legacy-compatible facade over {@link PushGatewayClient}. Prefer the gateway client
 * directly for new code (capability minting, status, typed results); this exists so the
 * long-standing register/unregister/sendWakeNotification/isRegistered names keep working.
 */
export class PushRelayClient {
  private readonly client: PushGatewayClient;
  private readonly deviceToken: string;
  private readonly provider: PushProviderKind;
  private readonly serverUrl: string;
  private binding: PushRegistrationBinding | null = null;

  constructor(options: PushRelayOptions) {
    this.serverUrl = options.serverUrl;
    this.client = new PushGatewayClient({
      serverUrl: options.serverUrl,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.generateToken ? { generateToken: options.generateToken } : {}),
    });
    this.deviceToken = options.deviceToken;
    this.provider = options.provider ?? 'apns';
  }

  /** Register this device's provider token with the gateway. */
  async register(): Promise<PushClientResult<PushRegistrationBinding>> {
    const binding = this.client.createBinding();
    const result = await this.client.register({
      binding,
      provider: this.provider,
      providerToken: this.deviceToken,
      tokenTtlMs: DEFAULT_TOKEN_TTL_MS,
      registrationTtlMs: DEFAULT_REGISTRATION_TTL_MS,
      idempotencyKey: this.client.generateCapability(),
    });
    if (!result.ok) return result;
    this.binding = binding;
    return { ok: true, value: binding };
  }

  /** Send a wake to a peer device by their capability. */
  async sendWakeNotification(notification: PushNotification): Promise<PushClientResult<WakeAcceptance>> {
    const payload = typeof notification.encryptedPayload === 'string'
      ? base64UrlToBytes(notification.encryptedPayload)
      : notification.encryptedPayload;
    if (!payload) return { ok: false, error: 'invalid_request' };
    return this.client.sendWake({
      capability: notification.targetToken,
      scope: notification.scope ?? 'sync_wake',
      payload,
      priority: notification.priority,
      idempotencyKey: this.client.generateCapability(),
    });
  }

  /** Unregister this device from the gateway. */
  async unregister(): Promise<PushClientResult> {
    if (!this.binding) return { ok: true, value: undefined };
    const result = await this.client.unregister(this.binding, this.client.generateCapability());
    if (result.ok) this.binding = null;
    return result;
  }

  /** True once a registration binding has been established. */
  isRegistered(): boolean {
    return this.binding !== null;
  }

  /** The gateway base URL. */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /** The underlying typed gateway client for capability minting, rotation, and status. */
  gateway(): PushGatewayClient {
    return this.client;
  }

  /** The current registration binding, if registered. */
  currentBinding(): PushRegistrationBinding | null {
    return this.binding;
  }
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) return null;
  const lookup = new Map<string, number>();
  for (let i = 0; i < BASE64URL_ALPHABET.length; i += 1) lookup.set(BASE64URL_ALPHABET[i]!, i);
  const output: number[] = [];
  for (let i = 0; i < value.length; i += 4) {
    const c0 = lookup.get(value[i]!);
    const c1 = lookup.get(value[i + 1]!);
    if (c0 === undefined || c1 === undefined) return null;
    output.push((c0 << 2) | (c1 >> 4));
    if (value[i + 2] !== undefined) {
      const c2 = lookup.get(value[i + 2]!);
      if (c2 === undefined) return null;
      output.push(((c1 & 15) << 4) | (c2 >> 2));
      if (value[i + 3] !== undefined) {
        const c3 = lookup.get(value[i + 3]!);
        if (c3 === undefined) return null;
        output.push(((c2 & 3) << 6) | c3);
      }
    }
  }
  return Uint8Array.from(output);
}
