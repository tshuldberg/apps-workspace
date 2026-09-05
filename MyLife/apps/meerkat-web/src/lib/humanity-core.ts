// Humanity (anti-sybil) verification core (Plan 24 P4/P5, item 14). WEB twin of
// apps/meerkat/app/(root)/data/humanity-core.ts. Reads the deployed service
// config, holds an issued token in a device-local wallet (mk_settings), reports
// the honest gate state, and (when a service + a Turnstile solver exist) runs the
// real challenge -> issue flow against @mylife/meerkat-relay's HTTP service.
//
// HONESTY (binding): nothing here fakes a verified state. No service configured
// => 'not_configured' and every gated shared-network action stays BLOCKED. A
// token counts only after a real issue AND a local verify against the pinned key.

import type { DatabaseAdapter } from '@mylife/db';
import {
  parseHumanityToken,
  serializeHumanityToken,
  verifyHumanityToken,
  type HumanityRedeemClient,
  type HumanityRedeemOutcome,
  type HumanityToken,
} from '@mylife/sync';
import { getSetting, setSetting } from './meerkat-data';

export const HUMANITY_TOKEN_SETTING_KEY = 'humanity_token';

/** The web verifier kind: Cloudflare Turnstile. */
export type HumanityChallengeKind = 'turnstile';

export interface HumanityServiceConfig {
  url: string;
  servicePublicKeyHex: string;
  /** Cloudflare Turnstile site key, or '' when unconfigured (web attestation). */
  turnstileSiteKey: string;
}

/** Read the humanity service config from Vite build env. Empty => unconfigured. */
export function humanityServiceConfig(): HumanityServiceConfig {
  const url = (import.meta.env.VITE_MEERKAT_HUMANITY_SERVICE_URL ?? '').trim();
  const servicePublicKeyHex = (import.meta.env.VITE_MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY ?? '').trim();
  const turnstileSiteKey = (import.meta.env.VITE_MEERKAT_TURNSTILE_SITE_KEY ?? '').trim();
  return { url, servicePublicKeyHex, turnstileSiteKey };
}

/** True only when BOTH the service URL and its pinned key are configured. */
export function isHumanityServiceConfigured(config: HumanityServiceConfig): boolean {
  return config.url.startsWith('http') && /^[0-9a-f]{64}$/i.test(config.servicePublicKeyHex);
}

// --- wallet -----------------------------------------------------------------

/**
 * Read the wallet as an ORDERED list of unspent wire tokens. The verification
 * service issues a BATCH of single-use tokens per real check (each gated action
 * spends exactly one), so the wallet holds the whole batch. Back-compat: a legacy
 * single bare wire token (base64url, or '{'-prefixed JSON) reads as a one-element
 * list; a batch persists as a JSON array (always '['-prefixed), so the two forms
 * never collide.
 */
export function getStoredHumanityTokens(db: DatabaseAdapter): string[] {
  const raw = getSetting(db, HUMANITY_TOKEN_SETTING_KEY);
  if (!raw || raw.length === 0) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string' && t.length > 0);
    } catch {
      return [];
    }
    return [];
  }
  return [raw];
}

/** Persist the wallet batch. An empty batch clears the slot (fail-closed). */
export function setStoredHumanityTokens(db: DatabaseAdapter, tokens: string[]): void {
  const clean = tokens.filter((t) => typeof t === 'string' && t.length > 0);
  // Web meerkat-data has no delete; an empty value reads as no token (length 0).
  setSetting(db, HUMANITY_TOKEN_SETTING_KEY, clean.length === 0 ? '' : JSON.stringify(clean));
}

export function getStoredHumanityToken(db: DatabaseAdapter): string | null {
  return getStoredHumanityTokens(db)[0] ?? null;
}

/** Store a single token (back-compat wrapper; replaces the whole wallet). */
export function setStoredHumanityToken(db: DatabaseAdapter, token: string): void {
  setStoredHumanityTokens(db, [token]);
}

/** Drop the ENTIRE wallet (e.g. a full reset, or when the batch is invalid). */
export function clearStoredHumanityToken(db: DatabaseAdapter): void {
  setSetting(db, HUMANITY_TOKEN_SETTING_KEY, '');
}

/** Count the wallet tokens that are still LOCALLY valid against the pinned key. */
export function getStoredHumanityTokenCount(
  db: DatabaseAdapter,
  config: HumanityServiceConfig,
  nowMs: number = Date.now(),
): number {
  if (!isHumanityServiceConfigured(config)) return 0;
  return getStoredHumanityTokens(db).filter((raw) => {
    const token = parseHumanityToken(raw);
    return token !== null && verifyHumanityToken(token, config.servicePublicKeyHex, nowMs) === 'ok';
  }).length;
}

/**
 * Remove and return the first LOCALLY VALID token from the wallet, pruning any
 * malformed/expired tokens it skips. Returns null when none remain; the SERVER
 * still runs the authoritative single-spend at redeem. A pre-spend failure can
 * push the token back with `unshiftStoredHumanityToken`.
 */
export function popStoredHumanityToken(
  db: DatabaseAdapter,
  config?: HumanityServiceConfig,
  nowMs: number = Date.now(),
): string | null {
  const tokens = getStoredHumanityTokens(db);
  if (tokens.length === 0) return null;
  // With no pinned service key (or no config passed) we cannot pre-validate; pop the
  // first token and let the SERVER run the authoritative single-spend at redeem.
  if (!config || !isHumanityServiceConfigured(config)) {
    setStoredHumanityTokens(db, tokens.slice(1));
    return tokens[0]!;
  }
  let picked: string | null = null;
  const remaining: string[] = [];
  for (const raw of tokens) {
    if (picked !== null) {
      remaining.push(raw);
      continue;
    }
    const token = parseHumanityToken(raw);
    const locallyValid = token !== null && verifyHumanityToken(token, config.servicePublicKeyHex, nowMs) === 'ok';
    if (locallyValid) picked = raw; // invalid tokens skipped before it are pruned
  }
  setStoredHumanityTokens(db, remaining);
  return picked;
}

/** Return a token to the FRONT of the wallet (a pre-spend failure recovery). */
export function unshiftStoredHumanityToken(db: DatabaseAdapter, token: string): void {
  if (typeof token !== 'string' || token.length === 0) return;
  setStoredHumanityTokens(db, [token, ...getStoredHumanityTokens(db)]);
}

/**
 * Whether the wallet holds a token that is locally valid against the pinned
 * service key right now. A malformed/forged/expired token returns false; the
 * SERVER still does the real single-spend check at redeem time.
 */
export function hasValidStoredToken(
  db: DatabaseAdapter,
  config: HumanityServiceConfig,
  nowMs: number = Date.now(),
): boolean {
  if (!isHumanityServiceConfigured(config)) return false;
  const raw = getStoredHumanityToken(db);
  if (!raw) return false;
  const token = parseHumanityToken(raw);
  if (!token) return false;
  return verifyHumanityToken(token, config.servicePublicKeyHex, nowMs) === 'ok';
}

export type HumanityGateState = 'not_configured' | 'needs_verification' | 'verified';

export function humanityGateState(
  db: DatabaseAdapter,
  config: HumanityServiceConfig = humanityServiceConfig(),
  nowMs: number = Date.now(),
): HumanityGateState {
  if (!isHumanityServiceConfigured(config)) return 'not_configured';
  return hasValidStoredToken(db, config, nowMs) ? 'verified' : 'needs_verification';
}

export function describeHumanityGate(state: HumanityGateState): string {
  switch (state) {
    case 'not_configured':
      return 'Human verification is not available in this build. Actions that reach other people stay off until a verification service is connected.';
    case 'needs_verification':
      return 'Verify you are human once to send this to other people. It is anonymous: the check proves you are a person, never who you are.';
    case 'verified':
      return 'You are verified. This one-time proof lets this action reach other people.';
  }
}

// --- issuer client (real challenge -> issue against the deployed service) -----

export type AcquireHumanityFailure =
  | { ok: false; reason: 'not_configured' | 'attestation_unavailable' | 'challenge_failed' | 'issue_failed' | 'service_unreachable' };

export type AcquireHumanityTokenResult =
  | { ok: true; token: string }
  | AcquireHumanityFailure;

export type AcquireHumanityBatchResult =
  | { ok: true; tokens: string[] }
  | AcquireHumanityFailure;

/** Solve the Turnstile challenge (widget response) bound to the service nonce. */
export type HumanityAttestationSolver = (
  input: { kind: HumanityChallengeKind; nonce: string },
) => Promise<unknown | null>;

interface ChallengeResponse { ok: boolean; challengeId?: string; kind?: string; nonce?: string; reason?: string }
// The deployed service (@mylife/meerkat-relay humanity-service-http) returns
// HumanityToken OBJECTS over the wire, not pre-serialized bearer strings, so the
// client must serialize before storing. Accept both forms defensively.
interface IssueResponse { ok: boolean; tokens?: (string | HumanityToken)[]; reason?: string }

/** Normalize an issued token (object or already-serialized string) to the wire string. */
function toHumanityWireToken(value: string | HumanityToken | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') return serializeHumanityToken(value);
  return undefined;
}

export async function acquireHumanityTokenBatch(
  config: HumanityServiceConfig,
  kind: HumanityChallengeKind,
  solve: HumanityAttestationSolver,
  fetchImpl: typeof fetch = fetch,
): Promise<AcquireHumanityBatchResult> {
  if (!isHumanityServiceConfigured(config)) return { ok: false, reason: 'not_configured' };
  const base = config.url.replace(/\/$/, '');

  let challenge: ChallengeResponse;
  try {
    const res = await fetchImpl(`${base}/humanity/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    challenge = (await res.json()) as ChallengeResponse;
  } catch {
    return { ok: false, reason: 'service_unreachable' };
  }
  if (!challenge.ok || !challenge.challengeId || !challenge.nonce) {
    return { ok: false, reason: 'challenge_failed' };
  }

  const attestation = await solve({ kind, nonce: challenge.nonce });
  if (attestation === null || attestation === undefined) {
    return { ok: false, reason: 'attestation_unavailable' };
  }

  let issued: IssueResponse;
  try {
    const res = await fetchImpl(`${base}/humanity/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: challenge.challengeId, attestation }),
    });
    issued = (await res.json()) as IssueResponse;
  } catch {
    return { ok: false, reason: 'service_unreachable' };
  }
  const tokens = issued.ok && Array.isArray(issued.tokens)
    ? issued.tokens.map(toHumanityWireToken).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];
  if (tokens.length === 0) return { ok: false, reason: 'issue_failed' };
  return { ok: true, tokens };
}

/** Back-compat single-token acquire: the first token of the issued batch. */
export async function acquireHumanityToken(
  config: HumanityServiceConfig,
  kind: HumanityChallengeKind,
  solve: HumanityAttestationSolver,
  fetchImpl: typeof fetch = fetch,
): Promise<AcquireHumanityTokenResult> {
  const batch = await acquireHumanityTokenBatch(config, kind, solve, fetchImpl);
  if (!batch.ok) return batch;
  return { ok: true, token: batch.tokens[0]! };
}

// --- redeem client (owner-side single-use / double-spend enforcement) --------

/**
 * Build the OWNER's redeem client: POST {url}/humanity/redeem { token }. The
 * verification SERVICE runs the atomic single-spend, so a replayed token comes
 * back `already_spent`. Returns null when no service URL is configured, which the
 * owner-record path treats as fail-closed (drop). Twin of the mobile client.
 */
export function buildHumanityRedeemClient(
  config: HumanityServiceConfig,
  fetchImpl: typeof fetch = fetch,
): HumanityRedeemClient | null {
  if (!config.url.startsWith('http')) return null;
  const base = config.url.replace(/\/$/, '');
  return async (wireToken: string): Promise<HumanityRedeemOutcome> => {
    try {
      const res = await fetchImpl(`${base}/humanity/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: wireToken }),
      });
      const json = (await res.json()) as { ok?: boolean; reason?: string };
      if (json.ok) return { ok: true };
      if (json.reason === 'already_spent' || json.reason === 'invalid' || json.reason === 'expired') {
        return { ok: false, reason: json.reason };
      }
      return { ok: false, reason: 'service_unreachable' };
    } catch {
      return { ok: false, reason: 'service_unreachable' };
    }
  };
}
