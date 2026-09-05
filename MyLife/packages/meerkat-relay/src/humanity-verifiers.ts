/**
 * Real humanity verifier adapters (Plan 24, P2). Each implements HumanityVerifier and is
 * DI'd into the service. NONE fabricates a verdict: a verifier returns { ok:true } ONLY
 * when the platform (Cloudflare / Google / Apple) actually attests the client, and returns
 * { ok:false } fail-closed on any error, timeout, or malformed response.
 *
 * NO HAND-ROLLED CRYPTO (NC-3):
 *  - TurnstileVerifier and PlayIntegrityVerifier delegate ALL cryptography to the vendor's
 *    own server-side verification API (Cloudflare siteverify / Google decodeIntegrityToken).
 *    We only POST the token + parse the JSON verdict, so there is no primitive to hand-roll.
 *  - AppAttestVerifier delegates the attestation's cryptographic verification (x5c chain to
 *    the Apple App Attest root, nonce binding, key-id derivation) to an INJECTED, vetted
 *    verifier. The default is fail-closed (isProductionSafe=false), so a deploy MUST wire a
 *    vetted implementation before productionMode will accept it. This keeps the crypto-heavy
 *    App Attest verification in a vetted library rather than hand-rolled here.
 *
 * Every verifier returns an `attestationKeyId` the service rate-limits on (AC-5). Its
 * strength differs by platform and is documented per-adapter; the per-IP window is the
 * shared backstop.
 */

import { createHash } from 'node:crypto';
import type {
  HumanityChallengeContext,
  HumanityVerifier,
  HumanityVerifierResult,
  HumanityVerifyInput,
} from './humanity-service';

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// Cloudflare Turnstile (web + Expo Go + attestation-unavailable devices; AC-4).
// ---------------------------------------------------------------------------

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifierOptions {
  /** The Turnstile SECRET key (server-side). Required; empty means the adapter is unusable. */
  secret: string;
  /** Injected fetch (defaults to global fetch). */
  fetchImpl?: FetchLike;
  /** The siteverify endpoint (override for tests). */
  endpoint?: string;
}

/**
 * Verifies a Cloudflare Turnstile response token via siteverify. Cloudflare enforces the
 * anti-bot scoring AND single-use of the token (a replay returns `timeout-or-duplicate`),
 * so this adapter trusts the vendor verdict and never re-scores. The attestation key is a
 * per-solve hash (Turnstile exposes no stable device id by design), so the per-key daily
 * cap degrades to per-solve; the per-IP window is the real farm backstop for this rung.
 *
 * attestation shape: { token: string; remoteIp?: string }.
 */
export class TurnstileVerifier implements HumanityVerifier {
  readonly kind = 'turnstile' as const;
  readonly isProductionSafe: boolean;
  private readonly secret: string;
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;

  constructor(options: TurnstileVerifierOptions) {
    this.secret = options.secret;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.endpoint = options.endpoint ?? TURNSTILE_SITEVERIFY_URL;
    // Usable only with a configured secret AND a fetch implementation.
    this.isProductionSafe = Boolean(this.secret) && typeof this.fetchImpl === 'function';
  }

  async verify(input: HumanityVerifyInput): Promise<HumanityVerifierResult> {
    const attestation = input.attestation;
    if (!isRecord(attestation) || typeof attestation.token !== 'string' || !attestation.token) {
      return { ok: false, reason: 'missing_token' };
    }
    if (!this.secret) return { ok: false, reason: 'not_configured' };

    const params = new URLSearchParams();
    params.set('secret', this.secret);
    params.set('response', attestation.token);
    if (typeof attestation.remoteIp === 'string' && attestation.remoteIp) {
      params.set('remoteip', attestation.remoteIp);
    }
    // Bind the solve to our one-time challenge via cdata so a token minted for another
    // site/flow cannot be replayed here (Cloudflare echoes cdata back for comparison).
    params.set('cdata', input.challenge.nonce);

    let body: unknown;
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      body = await res.json();
    } catch {
      return { ok: false, reason: 'siteverify_unreachable' };
    }
    if (!isRecord(body) || body.success !== true) {
      return { ok: false, reason: 'turnstile_rejected' };
    }
    // If Cloudflare echoes cdata, it MUST match our challenge nonce (defense in depth).
    if (typeof body.cdata === 'string' && body.cdata !== input.challenge.nonce) {
      return { ok: false, reason: 'nonce_mismatch' };
    }
    // Per-solve key: hash the response token so the raw token never reaches storage.
    return { ok: true, attestationKeyId: `turnstile:${sha256Hex(attestation.token)}` };
  }
}

// ---------------------------------------------------------------------------
// Google Play Integrity (Android).
// ---------------------------------------------------------------------------

export interface PlayIntegrityVerifierOptions {
  /** The Android package name whose integrity tokens this service accepts. */
  packageName: string;
  /**
   * Supplies a Google OAuth2 access token for the Play Integrity API (scope
   * https://www.googleapis.com/auth/playintegrity). Injected so the deploy owns the
   * service-account credential flow and tests can stub it.
   */
  accessToken: () => Promise<string>;
  /** Injected fetch (defaults to global fetch). */
  fetchImpl?: FetchLike;
  /** Override the decode endpoint base (tests). */
  endpointBase?: string;
}

const PLAY_INTEGRITY_BASE = 'https://playintegrity.googleapis.com/v1';

/**
 * Verifies an Android Play Integrity token by asking Google's decodeIntegrityToken API to
 * decrypt + verify it (the vendor does the crypto). We then check the decoded verdict:
 *  - requestDetails.nonce equals our one-time challenge nonce (anti-replay binding),
 *  - requestDetails.requestPackageName equals our package,
 *  - appIntegrity.appRecognitionVerdict is PLAY_RECOGNIZED,
 *  - deviceIntegrity.deviceRecognitionVerdict contains MEETS_DEVICE_INTEGRITY.
 * Play Integrity intentionally exposes no stable device id, so the per-key cap degrades to
 * per-token (tokens are single-use); the per-IP window is the farm backstop for this rung.
 *
 * attestation shape: { integrityToken: string }.
 */
export class PlayIntegrityVerifier implements HumanityVerifier {
  readonly kind = 'play-integrity' as const;
  readonly isProductionSafe: boolean;
  private readonly packageName: string;
  private readonly accessToken: () => Promise<string>;
  private readonly fetchImpl: FetchLike;
  private readonly endpointBase: string;

  constructor(options: PlayIntegrityVerifierOptions) {
    this.packageName = options.packageName;
    this.accessToken = options.accessToken;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.endpointBase = options.endpointBase ?? PLAY_INTEGRITY_BASE;
    this.isProductionSafe = Boolean(this.packageName)
      && typeof this.accessToken === 'function'
      && typeof this.fetchImpl === 'function';
  }

  async verify(input: HumanityVerifyInput): Promise<HumanityVerifierResult> {
    const attestation = input.attestation;
    if (!isRecord(attestation) || typeof attestation.integrityToken !== 'string' || !attestation.integrityToken) {
      return { ok: false, reason: 'missing_token' };
    }
    if (!this.packageName) return { ok: false, reason: 'not_configured' };

    let token: string;
    try {
      token = await this.accessToken();
    } catch {
      return { ok: false, reason: 'auth_unavailable' };
    }

    let body: unknown;
    try {
      const url = `${this.endpointBase}/${encodeURIComponent(this.packageName)}:decodeIntegrityToken`;
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrityToken: attestation.integrityToken }),
      });
      if (!res.ok) return { ok: false, reason: 'decode_failed' };
      body = await res.json();
    } catch {
      return { ok: false, reason: 'decode_unreachable' };
    }

    return this.evaluate(body, input.challenge);
  }

  private evaluate(body: unknown, challenge: HumanityChallengeContext): HumanityVerifierResult {
    if (!isRecord(body)) return { ok: false, reason: 'decode_failed' };
    const payload = isRecord(body.tokenPayloadExternal) ? body.tokenPayloadExternal : null;
    if (!payload) return { ok: false, reason: 'decode_failed' };

    const requestDetails = isRecord(payload.requestDetails) ? payload.requestDetails : null;
    if (!requestDetails) return { ok: false, reason: 'no_request_details' };
    // Anti-replay: the token MUST carry our exact one-time nonce.
    if (requestDetails.nonce !== challenge.nonce) return { ok: false, reason: 'nonce_mismatch' };
    if (requestDetails.requestPackageName !== this.packageName) return { ok: false, reason: 'wrong_package' };

    const appIntegrity = isRecord(payload.appIntegrity) ? payload.appIntegrity : null;
    if (!appIntegrity || appIntegrity.appRecognitionVerdict !== 'PLAY_RECOGNIZED') {
      return { ok: false, reason: 'app_not_recognized' };
    }
    const deviceIntegrity = isRecord(payload.deviceIntegrity) ? payload.deviceIntegrity : null;
    const verdicts = deviceIntegrity && Array.isArray(deviceIntegrity.deviceRecognitionVerdict)
      ? deviceIntegrity.deviceRecognitionVerdict
      : [];
    if (!verdicts.includes('MEETS_DEVICE_INTEGRITY')) {
      return { ok: false, reason: 'device_integrity_failed' };
    }
    // Per-token key: hash the decoded request hash / nonce so nothing device-linking is stored.
    return { ok: true, attestationKeyId: `play:${sha256Hex(challenge.nonce)}` };
  }
}

// ---------------------------------------------------------------------------
// Apple App Attest (iOS). Crypto delegated to an injected vetted verifier (NC-3).
// ---------------------------------------------------------------------------

export interface AppAttestInput {
  /** The App Attest key id (base64), used as the stable per-device rate-limit anchor. */
  keyId: string;
  /** The base64 CBOR attestation object from `DCAppAttestService.attestKey`. */
  attestationObject: string;
  /** The one-time challenge nonce this attestation must be bound to. */
  expectedNonce: string;
  /** The relying-party app id (TEAMID.bundleId) the authenticator data must match. */
  appId: string;
}

/**
 * The vetted, crypto-heavy step: verify the x5c chain to the Apple App Attest root, the
 * nonce binding, the rpId hash, and the key-id derivation. A deploy injects a vetted
 * implementation (e.g. a maintained App Attest library). Returns ok ONLY on a fully-valid
 * Apple-signed attestation; fail-closed otherwise. It NEVER returns identity, only a pass.
 */
export type AppAttestAttestationVerifier = (input: AppAttestInput) => Promise<{ ok: boolean }>;

/**
 * The default App Attest crypto verifier: fail-closed. It ALWAYS returns not-verified and
 * marks the adapter non-production-safe, so a deploy that forgets to wire a vetted verifier
 * cannot accept App Attest in productionMode (the service constructor throws). This mirrors
 * how a Simulated* transport backend is excluded from live rungs.
 */
export const failClosedAppAttestVerifier: AppAttestAttestationVerifier = async () => ({ ok: false });

export interface AppAttestVerifierOptions {
  /** The relying-party app id (TEAMID.bundleId). */
  appId: string;
  /**
   * The vetted crypto verifier. Omit ONLY in dev/test: the default is fail-closed and the
   * adapter reports isProductionSafe=false so productionMode refuses it.
   */
  attestationVerifier?: AppAttestAttestationVerifier;
}

/**
 * Apple App Attest adapter. It orchestrates the challenge/nonce binding contract and
 * extracts the App Attest keyId as the STABLE per-device rate-limit anchor (this is the
 * rung where the per-key daily cap is strongest, AC-5), then delegates the cryptographic
 * attestation verification to the injected vetted verifier. Fail-closed everywhere.
 *
 * attestation shape: { keyId: string; attestationObject: string }.
 */
export class AppAttestVerifier implements HumanityVerifier {
  readonly kind = 'app-attest' as const;
  readonly isProductionSafe: boolean;
  private readonly appId: string;
  private readonly attestationVerifier: AppAttestAttestationVerifier;

  constructor(options: AppAttestVerifierOptions) {
    this.appId = options.appId;
    this.attestationVerifier = options.attestationVerifier ?? failClosedAppAttestVerifier;
    // Production-safe ONLY when a real (non-fail-closed) verifier is injected AND an appId
    // is configured. The default fail-closed verifier keeps this false on purpose.
    this.isProductionSafe = Boolean(this.appId)
      && this.attestationVerifier !== failClosedAppAttestVerifier;
  }

  async verify(input: HumanityVerifyInput): Promise<HumanityVerifierResult> {
    const attestation = input.attestation;
    if (
      !isRecord(attestation)
      || typeof attestation.keyId !== 'string'
      || !attestation.keyId
      || typeof attestation.attestationObject !== 'string'
      || !attestation.attestationObject
    ) {
      return { ok: false, reason: 'missing_attestation' };
    }
    if (!this.appId) return { ok: false, reason: 'not_configured' };

    let result: { ok: boolean };
    try {
      result = await this.attestationVerifier({
        keyId: attestation.keyId,
        attestationObject: attestation.attestationObject,
        expectedNonce: input.challenge.nonce,
        appId: this.appId,
      });
    } catch {
      return { ok: false, reason: 'attestation_error' };
    }
    if (!result.ok) return { ok: false, reason: 'attestation_rejected' };
    // The App Attest keyId is a stable per-device anchor; hash-prefix it for the cap.
    return { ok: true, attestationKeyId: `appattest:${sha256Hex(attestation.keyId)}` };
  }
}

// ---------------------------------------------------------------------------
// Stub verifier (dev/test only; NEVER production-safe).
// ---------------------------------------------------------------------------

/**
 * A dev/test verifier that passes any attestation carrying a matching stub secret. It is
 * EXPLICITLY not production-safe: a HumanityService constructed in productionMode throws
 * if this is registered, mirroring how Simulated* transport backends are barred from live
 * rungs. Use it only for local smoke tests and unit tests, never in a deployed service.
 */
export class StubHumanityVerifier implements HumanityVerifier {
  readonly isProductionSafe = false as const;
  constructor(
    readonly kind: HumanityVerifier['kind'],
    private readonly acceptSecret: string = 'stub-ok',
  ) {}

  async verify(input: HumanityVerifyInput): Promise<HumanityVerifierResult> {
    const attestation = input.attestation;
    if (isRecord(attestation) && attestation.stubSecret === this.acceptSecret) {
      const anchor = typeof attestation.stubKeyId === 'string' ? attestation.stubKeyId : input.challenge.nonce;
      return { ok: true, attestationKeyId: `stub:${anchor}` };
    }
    return { ok: false, reason: 'stub_rejected' };
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
