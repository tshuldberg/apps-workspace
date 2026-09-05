// Public persona core (Plan 39 P3, Track A). The joiner-side half of the public-tier
// account: it reads the deployed persona-registry config, generates + stores the public
// persona LOCALLY (a fresh Ed25519 key, never the device key -- NC-P2), and drives the REAL
// register / availability / session / GDPR endpoints on @mylife/meerkat-relay's persona
// service. Twin of apps/meerkat-web/src/lib/persona-core.ts.
//
// HONESTY (binding, transport rule): nothing here fabricates a registered/available/verified
// state. No persona service configured => 'not_configured' and the whole public-account flow
// stays off with an honest "needs a connection server" message. An alias shows Available only
// after the REAL /persona/resolve says so; an account exists only after the REAL /persona/
// register returns ok; the humanity token is spent SERVER-side at registration.

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  canonicalizeAlias,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  parseHumanityToken,
  personaRequestBytes,
  personaSessionChallengeBytes,
  sha512Hex,
  signMessage,
  PERSONA_ALIAS_MAX,
  PERSONA_ALIAS_MIN,
  PERSONA_GDPR_DELETE_DOMAIN,
  PERSONA_GDPR_EXPORT_DOMAIN,
} from '@mylife/sync';
import { deleteSetting, getSetting, setSetting } from './db';
import { popStoredHumanityToken, unshiftStoredHumanityToken } from './humanity-core';

/** Device-local slot for the current public persona (mk_settings; never replicates). */
export const PUBLIC_PERSONA_SETTING_KEY = 'public_persona';

const encoder = new TextEncoder();

// --- config -----------------------------------------------------------------

export interface PersonaServiceConfig {
  /** Deployed persona-registry service base URL (https), or '' when unconfigured. */
  url: string;
}

/** Read the persona service config from app config `extra`. Empty => unconfigured. */
export function personaServiceConfig(): PersonaServiceConfig {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
    personaServiceUrl?: unknown;
  };
  const url = typeof extra.personaServiceUrl === 'string' ? extra.personaServiceUrl.trim() : '';
  return { url };
}

export function isPersonaServiceConfigured(config: PersonaServiceConfig): boolean {
  return config.url.startsWith('http');
}

// --- local persona store ----------------------------------------------------

export interface StoredPersona {
  personaPubkey: string;
  privateKeyRef: string;
  alias: string;
  displayName: string;
  createdAt: string;
}

export function getStoredPersona(db: DatabaseAdapter): StoredPersona | null {
  const raw = getSetting(db, PUBLIC_PERSONA_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPersona>;
    if (
      parsed && typeof parsed.personaPubkey === 'string'
      && typeof parsed.privateKeyRef === 'string'
      && typeof parsed.alias === 'string'
    ) {
      return {
        personaPubkey: parsed.personaPubkey,
        privateKeyRef: parsed.privateKeyRef,
        alias: parsed.alias,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export function setStoredPersona(db: DatabaseAdapter, persona: StoredPersona): void {
  setSetting(db, PUBLIC_PERSONA_SETTING_KEY, JSON.stringify(persona));
}

/**
 * Clear the local persona row AND (when a secret deleter is provided) delete the persona seed
 * from secure storage, so a deleted persona strands no private key material. The global
 * "Delete my data" wipe covers this too (collectSecretRefs reads public_persona), but the
 * GDPR delete path removes the seed immediately.
 */
export async function clearStoredPersona(
  db: DatabaseAdapter,
  deleteSecret?: (ref: string) => void | Promise<void>,
): Promise<void> {
  if (deleteSecret) {
    const persona = getStoredPersona(db);
    if (persona?.privateKeyRef) {
      await deleteSecret(persona.privateKeyRef);
    }
  }
  deleteSetting(db, PUBLIC_PERSONA_SETTING_KEY);
  deleteSetting(db, PUBLIC_SESSION_SETTING_KEY); // a persona's cached session dies with it
}

/** Update the local display name only (the alias itself is permanent while the account exists). */
export function setStoredDisplayName(db: DatabaseAdapter, displayName: string): void {
  const persona = getStoredPersona(db);
  if (!persona) return;
  setStoredPersona(db, { ...persona, displayName: displayName.trim().slice(0, 48) });
}

// --- honest gate state ------------------------------------------------------

export type PersonaState = 'not_configured' | 'needs_verification' | 'needs_alias' | 'active';

/**
 * The honest public-account state for the current build + wallet.
 *  - not_configured: no persona service is connected in this build (public accounts are off).
 *  - needs_verification: configured, but the user has not passed human verification yet.
 *  - needs_alias: verified, but no public persona/alias has been created.
 *  - active: a public persona exists on this device.
 */
export function personaState(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  hasHumanityToken: boolean,
): PersonaState {
  if (!isPersonaServiceConfigured(config)) return 'not_configured';
  if (getStoredPersona(db)) return 'active';
  if (!hasHumanityToken) return 'needs_verification';
  return 'needs_alias';
}

// --- client-side alias validation (instant feedback) ------------------------

export type AliasValidity = 'ok' | 'too_short' | 'too_long' | 'bad_chars';

/** Validate an alias for instant UI feedback (the registry is still the final authority). */
export function validateAlias(raw: string): AliasValidity {
  const folded = raw.normalize('NFKC').trim().toLowerCase();
  if (folded.length < PERSONA_ALIAS_MIN) return 'too_short';
  if (folded.length > PERSONA_ALIAS_MAX) return 'too_long';
  return canonicalizeAlias(raw) ? 'ok' : 'bad_chars';
}

// --- availability (real endpoint) -------------------------------------------

export type AliasAvailability =
  | 'available'
  | 'taken'
  | 'invalid'
  | 'not_configured'
  | 'unreachable';

/**
 * Check whether an alias is free, by asking the REAL registry (/persona/resolve). Never
 * fabricates a verdict: a network/parse failure is 'unreachable', not 'available'. The
 * registry is authoritative at register time (reserved words + cooldown surface there).
 */
export async function checkAliasAvailability(
  config: PersonaServiceConfig,
  alias: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AliasAvailability> {
  const canonical = canonicalizeAlias(alias);
  if (!canonical) return 'invalid';
  if (!isPersonaServiceConfigured(config)) return 'not_configured';
  const base = config.url.replace(/\/$/, '');
  try {
    const res = await fetchImpl(`${base}/persona/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: canonical }),
    });
    if (res.status === 404) return 'available';
    if (res.status === 200) return 'taken';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}

// --- reverse resolve (pubkey -> alias, batch) --------------------------------

/**
 * Batch-resolve persona pubkeys to their REGISTERED aliases via the real registry
 * (/persona/resolve-keys). Returns a lowercased-key -> alias map; an unregistered,
 * deleted, or unreachable key is simply ABSENT, so the caller shows the honest
 * short-persona-id fallback and never a fabricated name. Never throws; a network
 * or parse failure yields an empty map (fallback to short-ids everywhere).
 */
export async function resolvePersonaKeys(
  config: PersonaServiceConfig,
  personaPubkeys: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, string>> {
  if (!isPersonaServiceConfigured(config)) return {};
  const keys = Array.from(new Set(personaPubkeys.map((k) => k.toLowerCase()).filter((k) => /^[0-9a-f]{64}$/.test(k))));
  if (keys.length === 0) return {};
  const base = config.url.replace(/\/$/, '');
  try {
    const res = await fetchImpl(`${base}/persona/resolve-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaPubkeys: keys }),
    });
    const json = (await res.json()) as { ok?: boolean; aliases?: Record<string, unknown> };
    if (!json?.ok || typeof json.aliases !== 'object' || json.aliases === null) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json.aliases)) {
      if (typeof v === 'string' && v.length > 0) out[k.toLowerCase()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** The display handle for a persona: "@alias" when resolved, else the honest short id. */
export function personaHandle(aliases: Record<string, string>, personaPubkey: string, shortId: string): string {
  const alias = aliases[personaPubkey.toLowerCase()];
  return alias ? `@${alias}` : `persona ${shortId}`;
}

// --- registration (real; spends one humanity token server-side) -------------

export type CreatePersonaResult =
  | { ok: true; alias: string; personaPubkey: string }
  | { ok: false; reason: string };

/**
 * Create a fresh public persona locally and register its alias against the REAL registry,
 * presenting the humanity token (spent server-side). On success the persona is stored device-
 * local. The device key is NEVER sent: only the persona-signed claim + the anonymous humanity
 * token cross the wire (NC-P2).
 */
export async function createAndRegisterPersona(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  humanityToken: string,
  alias: string,
  displayName: string,
  fetchImpl: typeof fetch = fetch,
  // Plan 51 P3: the anonymous verification-account credential header, computed by
  // the SCREEN via account-core.presentCredentialHeader and passed in. Absent (the
  // default) leaves this call byte-identical to before. It carries NO account
  // identifier (AC-2); persona-core never imports account-core so this module (and
  // its web twin) stay free of the account layer.
  credentialHeaders: Record<string, string> = {},
): Promise<CreatePersonaResult> {
  if (!isPersonaServiceConfigured(config)) return { ok: false, reason: 'not_configured' };
  const canonical = canonicalizeAlias(alias);
  if (!canonical) return { ok: false, reason: 'bad_alias' };
  const parsed = parseHumanityToken(humanityToken);
  if (!parsed) return { ok: false, reason: 'needs_verification' };

  const persona = generatePublicPersona(canonical);
  const humanityBinding = sha512Hex(encoder.encode(parsed.tokenId));
  const claim = createPersonaClaim({ persona, humanityBinding });
  const base = config.url.replace(/\/$/, '');

  let json: { ok?: boolean; alias?: string; personaPubkey?: string; reason?: string };
  try {
    const res = await fetchImpl(`${base}/persona/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mk-humanity': humanityToken, ...credentialHeaders },
      body: JSON.stringify({ claim }),
    });
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!json?.ok) return { ok: false, reason: typeof json?.reason === 'string' ? json.reason : 'failed' };

  setStoredPersona(db, {
    personaPubkey: persona.personaPubkey,
    privateKeyRef: persona.privateKeyRef,
    alias: canonical,
    displayName: displayName.trim().slice(0, 48),
    createdAt: persona.createdAt,
  });
  return { ok: true, alias: canonical, personaPubkey: persona.personaPubkey };
}

// --- session issuance (proof of persona-key possession) ----------------------

export type PersonaSessionResult =
  | { ok: true; token: string; expiresAtMs: number }
  | { ok: false; reason: string };

/**
 * Acquire a short-lived session bearer for the stored persona by signing the registry's
 * challenge with the persona key (proof of possession). The bearer authorizes the first-party
 * public read/write routes (Track B/C). Fail-closed at every step.
 */
export async function acquirePersonaSession(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PersonaSessionResult> {
  const persona = getStoredPersona(db);
  if (!persona) return { ok: false, reason: 'no_persona' };
  if (!isPersonaServiceConfigured(config)) return { ok: false, reason: 'not_configured' };
  // Session issuance spends one single-use humanity token from the wallet BATCH
  // (Plan 39 P7). An empty wallet is an honest "verify again" state, never a
  // fabricated session. The token is popped up front and pushed back on a
  // failure that never actually reached the server-side redeem.
  const humanityToken = popStoredHumanityToken(db);
  if (!humanityToken) return { ok: false, reason: 'needs_verification' };
  const base = config.url.replace(/\/$/, '');

  let challenge: { ok?: boolean; challengeId?: string; nonce?: string };
  try {
    const res = await fetchImpl(`${base}/persona/session/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaPubkey: persona.personaPubkey }),
    });
    challenge = (await res.json()) as typeof challenge;
  } catch {
    unshiftStoredHumanityToken(db, humanityToken); // never reached the server-side redeem
    return { ok: false, reason: 'unreachable' };
  }
  if (!challenge?.ok || !challenge.challengeId || !challenge.nonce) {
    unshiftStoredHumanityToken(db, humanityToken);
    return { ok: false, reason: 'challenge_failed' };
  }

  let signature: string;
  try {
    const privateKeyHex = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    signature = bytesToHex(
      signMessage(privateKeyHex, personaSessionChallengeBytes(challenge.nonce, persona.personaPubkey)),
    );
  } catch {
    unshiftStoredHumanityToken(db, humanityToken);
    return { ok: false, reason: 'key_unavailable' };
  }

  let issued: { ok?: boolean; token?: string; expiresAtMs?: number; reason?: string };
  try {
    const res = await fetchImpl(`${base}/persona/session/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mk-humanity': humanityToken },
      body: JSON.stringify({ challengeId: challenge.challengeId, personaPubkey: persona.personaPubkey, signature }),
    });
    issued = (await res.json()) as typeof issued;
  } catch {
    unshiftStoredHumanityToken(db, humanityToken); // never reached the server-side redeem
    return { ok: false, reason: 'unreachable' };
  }
  if (issued?.ok && issued.token && typeof issued.expiresAtMs === 'number') {
    // The humanity token was spent server-side on a successful issue; it was already
    // popped out of the wallet, so nothing to drop here.
    return { ok: true, token: issued.token, expiresAtMs: issued.expiresAtMs };
  }
  const reason = typeof issued?.reason === 'string' ? issued.reason : 'issue_failed';
  // Outcomes where the humanity token was NOT spent (the request failed BEFORE the guard
  // redeemed it): push the popped token back so the user is not forced to re-verify.
  if (reason === 'humanity_not_configured') { unshiftStoredHumanityToken(db, humanityToken); return { ok: false, reason: 'humanity_not_configured' }; }
  if (reason === 'rate_limited') { unshiftStoredHumanityToken(db, humanityToken); return { ok: false, reason: 'rate_limited' }; }
  if (reason === 'bad_request' || reason === 'humanity_missing' || reason === 'humanity_service_unreachable') {
    unshiftStoredHumanityToken(db, humanityToken);
    return { ok: false, reason: 'unreachable' };
  }
  // Otherwise the token was consumed (the guard spent it, even if issuance then failed) or it is
  // spent/invalid: leave it popped and send the user back to verify.
  return { ok: false, reason: reason.startsWith('humanity_') ? 'needs_verification' : reason };
}

// --- session-bearer wallet (verify-to-view, Plan 39 P9) ----------------------

/** Device-local cache for the short-lived persona session bearer (never replicates). */
export const PUBLIC_SESSION_SETTING_KEY = 'persona_session';

interface StoredSession { token: string; expiresAtMs: number }

export function getStoredSession(db: DatabaseAdapter): StoredSession | null {
  const raw = getSetting(db, PUBLIC_SESSION_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token === 'string' && typeof parsed.expiresAtMs === 'number') {
      return { token: parsed.token, expiresAtMs: parsed.expiresAtMs };
    }
  } catch {
    // fall through
  }
  return null;
}

export function setStoredSession(db: DatabaseAdapter, token: string, expiresAtMs: number): void {
  setSetting(db, PUBLIC_SESSION_SETTING_KEY, JSON.stringify({ token, expiresAtMs }));
}

export function clearStoredSession(db: DatabaseAdapter): void {
  deleteSetting(db, PUBLIC_SESSION_SETTING_KEY);
}

/** A cached session is usable while it has more than a 30s safety margin left. */
export function hasValidStoredSession(db: DatabaseAdapter, nowMs: number = Date.now()): boolean {
  const s = getStoredSession(db);
  return s !== null && s.expiresAtMs > nowMs + 30_000;
}

/**
 * Return a valid session bearer, reusing the cached one when it is still fresh and only
 * acquiring (which spends a humanity token) when it is missing or expiring. This keeps
 * verify-to-view reads from burning a humanity token on every page fetch.
 */
export async function ensurePersonaSession(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PersonaSessionResult> {
  const cached = getStoredSession(db);
  if (cached && cached.expiresAtMs > Date.now() + 30_000) {
    return { ok: true, token: cached.token, expiresAtMs: cached.expiresAtMs };
  }
  const fresh = await acquirePersonaSession(db, config, fetchImpl);
  if (fresh.ok) setStoredSession(db, fresh.token, fresh.expiresAtMs);
  return fresh;
}

/**
 * The `x-mk-session` header for a first-party gated READ (verify-to-view), or an empty object
 * when there is no valid cached session. Never fabricates a session; a caller that gets no
 * header should show the honest locked state.
 */
export function readSessionHeaders(db: DatabaseAdapter, nowMs: number = Date.now()): Record<string, string> {
  // Use the SAME 30s safety margin as hasValidStoredSession/ensurePersonaSession, so a token
  // this helper attaches cannot land at the relay after expiry (clock skew / latency) and be
  // rejected while the cache still thought it valid.
  return hasValidStoredSession(db, nowMs) ? { 'x-mk-session': getStoredSession(db)!.token } : {};
}

// --- GDPR delete + export (real; persona-signed) ----------------------------

/** Sign a persona request, or null when the persona key is unavailable in secure storage. */
function signPersonaRequest(persona: StoredPersona, domain: string, issuedAtMs: number): string | null {
  try {
    const privateKeyHex = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    return bytesToHex(signMessage(privateKeyHex, personaRequestBytes(domain, persona.personaPubkey, issuedAtMs)));
  } catch {
    return null;
  }
}

export type DeletePersonaResult = { ok: true } | { ok: false; reason: string };

/**
 * Send the persona-signed remote GDPR request without clearing the local key.
 * The full-device wipe uses this so later local steps can fail and be retried.
 */
export async function requestPersonaDeletion(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<DeletePersonaResult> {
  const persona = getStoredPersona(db);
  if (!persona) return { ok: false, reason: 'no_persona' };
  if (!isPersonaServiceConfigured(config)) return { ok: false, reason: 'not_configured' };
  const base = config.url.replace(/\/$/, '');
  const issuedAt = Date.now();
  const signature = signPersonaRequest(persona, PERSONA_GDPR_DELETE_DOMAIN, issuedAt);
  if (!signature) return { ok: false, reason: 'key_unavailable' };
  let json: { ok?: boolean; reason?: string };
  try {
    const res = await fetchImpl(`${base}/persona/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaPubkey: persona.personaPubkey, issuedAt, signature }),
    });
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!json?.ok) return { ok: false, reason: typeof json?.reason === 'string' ? json.reason : 'failed' };
  return { ok: true };
}

export async function deletePersona(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  fetchImpl: typeof fetch = fetch,
  deleteSecret?: (ref: string) => void | Promise<void>,
): Promise<DeletePersonaResult> {
  const result = await requestPersonaDeletion(db, config, fetchImpl);
  if (result.ok) {
    try {
      await clearStoredPersona(db, deleteSecret);
    } catch {
      return { ok: false, reason: 'local_secret_delete_failed' };
    }
  }
  return result;
}

export type ExportPersonaResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: string };

/** GDPR export: a persona-signed request returning every server-held row for this persona. */
export async function exportPersona(
  db: DatabaseAdapter,
  config: PersonaServiceConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportPersonaResult> {
  const persona = getStoredPersona(db);
  if (!persona) return { ok: false, reason: 'no_persona' };
  if (!isPersonaServiceConfigured(config)) return { ok: false, reason: 'not_configured' };
  const base = config.url.replace(/\/$/, '');
  const issuedAt = Date.now();
  const signature = signPersonaRequest(persona, PERSONA_GDPR_EXPORT_DOMAIN, issuedAt);
  if (!signature) return { ok: false, reason: 'key_unavailable' };
  let json: { ok?: boolean; record?: unknown; revoked?: boolean; publicPosts?: unknown; reason?: string };
  try {
    const res = await fetchImpl(`${base}/persona/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaPubkey: persona.personaPubkey, issuedAt, signature }),
    });
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!json?.ok) return { ok: false, reason: typeof json?.reason === 'string' ? json.reason : 'failed' };
  return {
    ok: true,
    data: {
      record: json.record ?? null,
      revoked: json.revoked ?? false,
      publicPosts: Array.isArray(json.publicPosts) ? json.publicPosts : [],
    },
  };
}
