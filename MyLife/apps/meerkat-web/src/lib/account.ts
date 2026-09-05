// Verification-account client (Plan 51 P3). WEB twin of the mobile account layer
// (apps/meerkat/app/(root)/data/account-core.ts). Shared request/response contract,
// honest reasons, store-age policy, and copy constants are mirrored verbatim; only
// the platform seams differ (browser secret store + redirect-based web OAuth vs
// expo-secure-store + native SSO modules).
//
// The OUTER layer of the two-identity model: a minimal Sign in with Apple / Google
// account that gates the entitlement (app unlock + hosted subscription) and mints an
// anonymous blind credential proving "some verified account backs me" WITHOUT
// revealing which one. SEPARATE from the inner Meerkat identity; the private mesh
// (communities, DMs, sync) never touches this module (AC-4) and no account
// identifier ever rides on a credential presentation (AC-2).
//
// HONESTY (binding): UNCONFIGURED (no VITE_MEERKAT_ACCOUNT_SERVICE_URL) => every
// operation returns { ok:false, reason:'not_configured' } and the UI shows honest
// copy (AC-6). SSO uses REDIRECT-based OpenID Connect (no third-party scripts, so
// the app CSP script-src stays intact); an unset provider is 'not_configured' and a
// bad/absent callback is 'invalid_token'. The blind credential is minted with the
// SHARED @mylife/sync primitives; the account service signs a blinded message and
// never sees the token or its serial.
//
// Storage: the session bearer, the minted credential, and the pending blind-request
// state live in the SAME IndexedDB-backed secret store MeerkatProvider uses
// (BrowserStorageSecretAccess), NOT plain localStorage. The store is injected so
// tests use a fake.

import {
  credentialEpochAt,
  credentialEpochWindow,
  encodeAgeGateRecord,
  finalizeBlindCredential,
  verifyBlindCredential,
  parseMeerkatCredential,
  isWithinRenewalWindow,
  parseRsaPublicKeySpki,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  storeAgeSignalSatisfiesGate,
  AGE_GATE_SETTING_KEY,
  type BlindCredentialRequestState,
  type MeerkatCredential,
  type StoreAgeSignal,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';
import { configuredMinimumAge, isAgeGateLocked, isAgeGatePassed, notifyAgeGateChangedFromStore } from './age-gate';
import { setSetting } from './meerkat-data';

// ---------------------------------------------------------------------------
// Config (from Vite build env). Unconfigured => the whole layer is OFF.
// ---------------------------------------------------------------------------

export interface AccountConfig {
  configured: true;
  accountServiceUrl: string;
  /** Sign in with Apple service id, or '' when not set (Apple sign-in unavailable). */
  appleServiceId: string;
  /** Google OAuth web client id, or '' when not set (Google sign-in unavailable). */
  googleClientId: string;
}

export type ResolvedAccountConfig = AccountConfig | { configured: false };

function envString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Pure resolver from an env bag (unit-tested without touching import.meta.env). */
export function resolveAccountConfigFromEnv(env: Record<string, unknown>): ResolvedAccountConfig {
  const url = envString(env.VITE_MEERKAT_ACCOUNT_SERVICE_URL);
  if (!url.startsWith('http')) return { configured: false };
  return {
    configured: true,
    accountServiceUrl: url.replace(/\/+$/u, ''),
    appleServiceId: envString(env.VITE_MEERKAT_APPLE_SERVICE_ID),
    googleClientId: envString(env.VITE_MEERKAT_GOOGLE_CLIENT_ID),
  };
}

/** Resolve the account config from the live Vite build env. Empty url => off. */
export function resolveAccountConfig(): ResolvedAccountConfig {
  return resolveAccountConfigFromEnv(import.meta.env as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Result + honest reason vocabulary (mirrors the mobile twin).
// ---------------------------------------------------------------------------

export type AccountReason =
  | 'not_configured'
  | 'unavailable_in_build'
  | 'invalid_token'
  | 'unreachable'
  | 'refused'
  | 'renewal_refused'
  | 'mint_recovery_required'
  | 'no_session'
  | 'no_credential'
  | 'not_found'
  | 'store_error';

export type AccountResult<T> = ({ ok: true } & T) | { ok: false; reason: AccountReason };

// ---------------------------------------------------------------------------
// Account shape (mirrors the service contract; nothing beyond these fields).
// ---------------------------------------------------------------------------

/**
 * Age status as this client models it. The wire `/account/status.ageStatus` sends
 * 'adult' | 'minor' (matching the /account/age-signal signal vocabulary), plus the
 * store_* aliases; an absent or unrecognized value maps to 'unknown'. We keep the
 * internal names as the store signal vocabulary the shared age-gate core already uses.
 */
export type AgeStatus = 'store_adult' | 'store_minor' | 'unknown';

export interface EntitlementState {
  product: string;
  /** The purchase rail the entitlement came in on (storekit/play/stripe). */
  rail: string;
  status: 'active' | 'inactive' | 'lapsed';
  /** ISO timestamp the entitlement is valid until, when the service provides one. */
  validUntil?: string;
}

export interface AccountSummary {
  accountId: string;
  provider: SsoProvider | null;
  ageStatus: AgeStatus;
  /** True when the account is flagged (renewal will be refused). */
  renewalFlagged: boolean;
  entitlements: EntitlementState[];
}

export type SsoProvider = 'apple' | 'google';

// ---------------------------------------------------------------------------
// Injectable seams (secret store + fetch + prng + SSO adapters), each with a
// live default. Kept injectable so the client is unit-tested with fakes.
// ---------------------------------------------------------------------------

/**
 * Secret-store seam. Matches BrowserStorageSecretAccess (get/set synchronous,
 * flush async) so MeerkatProvider hands its IndexedDB-backed store straight in.
 */
export interface AccountSecretStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  flush(): Promise<void>;
}

/**
 * An SSO provider adapter; returns an opaque idToken or an honest unavailability.
 * The web redirect adapter can also return 'redirecting' when it has navigated the
 * page to the provider (the promise is then never observed; the token arrives on the
 * callback round-trip). 'redirecting' is NOT an AccountReason -- the callers treat it
 * as a no-op, never surfacing it as a failure.
 */
export type SsoAdapterReason = AccountReason | 'redirecting';

export interface SsoAdapter {
  signIn(): Promise<{ ok: true; idToken: string } | { ok: false; reason: SsoAdapterReason }>;
}

export interface AccountDeps {
  config: ResolvedAccountConfig;
  fetchImpl: typeof fetch;
  secretStore: AccountSecretStore;
  randomBytes: (length: number) => Uint8Array;
  apple: SsoAdapter;
  google: SsoAdapter;
  now: () => number;
}

// Isolated secret refs (namespaced under the account layer; never replicate/sync).
export const SESSION_KEY = 'securestore://meerkat.account.session';
export const CREDENTIAL_KEY = 'securestore://meerkat.account.credential';
export const PENDING_MINT_KEY = 'securestore://meerkat.account.pending_mint';

function liveRandomBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('account.ts: no secure random source available.');
  return cryptoApi.getRandomValues(new Uint8Array(length));
}

/**
 * Build the live deps bundle from the app config + a MeerkatProvider secret store.
 * The screens pass the provider's BrowserStorageSecretAccess as `secretStore`.
 */
export function liveAccountDeps(secretStore: AccountSecretStore): AccountDeps {
  const config = resolveAccountConfig();
  return {
    config,
    fetchImpl: (globalThis.fetch?.bind(globalThis) as typeof fetch),
    secretStore,
    randomBytes: liveRandomBytes,
    apple: liveAppleAdapter(config),
    google: liveGoogleAdapter(config),
    now: () => Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Session + credential storage (isolated refs).
// ---------------------------------------------------------------------------

function readSessionBearer(deps: AccountDeps): string | null {
  return deps.secretStore.get(SESSION_KEY);
}

function readStoredCredentials(deps: AccountDeps): MeerkatCredential[] {
  const raw = deps.secretStore.get(CREDENTIAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values = parsed.version === 2 ? [parsed.latest, parsed.previous] : [parsed];
    return values.flatMap((value) => {
      const credential = value ? parseMeerkatCredential(JSON.stringify(value)) : null;
      return credential ? [credential] : [];
    }).sort((left, right) => right.epoch - left.epoch);
  } catch { return []; }
}

/** Latest issued pass, including a pre-issued next-period pass for renewal/deletion. */
export function getStoredCredential(deps: AccountDeps): MeerkatCredential | null {
  return (readStoredCredentials(deps))[0] ?? null;
}

function isInCredentialWindow(credential: MeerkatCredential, nowMs: number): boolean {
  const window = credentialEpochWindow(credential.epoch);
  return nowMs >= window.notBeforeMs && nowMs <= window.notAfterMs;
}

export type StoredCredentialState = 'active' | 'scheduled' | 'expired' | 'none';

export function getStoredCredentialState(deps: AccountDeps): StoredCredentialState {
  const credentials = readStoredCredentials(deps);
  const now = deps.now();
  if (credentials.some((credential) => isInCredentialWindow(credential, now))) return 'active';
  if (credentials.some((credential) => credentialEpochWindow(credential.epoch).notBeforeMs > now)) return 'scheduled';
  return credentials.length ? 'expired' : 'none';
}

async function storeCredential(deps: AccountDeps, credential: MeerkatCredential): Promise<void> {
  const previous = (readStoredCredentials(deps)).find((entry) => entry.epoch < credential.epoch);
  // One keychain write preserves both periods atomically; never serialize this wrapper on the wire.
  deps.secretStore.set(CREDENTIAL_KEY, JSON.stringify({ version: 2, latest: credential, previous }));
  await deps.secretStore.flush();
}

/** True when a session bearer is stored (the honest "signed in" state). */
export function isSignedIn(deps: AccountDeps): boolean {
  if (!deps.config.configured) return false;
  return readSessionBearer(deps) !== null;
}

/** True during the renewal window (final 7 days of the current epoch). UI convenience. */
export function isWithinRenewalWindowNow(nowMs: number = Date.now()): boolean {
  return isWithinRenewalWindow(nowMs);
}

// ---------------------------------------------------------------------------
// Service HTTP calls (the P1 account service contract; injectable fetch).
// ---------------------------------------------------------------------------

interface RawAccountShape {
  accountId?: unknown;
  provider?: unknown;
  ageStatus?: unknown;
  renewalFlagged?: unknown;
  entitlements?: unknown;
}

/** Normalize the wire ageStatus ('adult'|'minor', or the store_* aliases) to our type. */
function parseAgeStatus(raw: unknown): AgeStatus {
  if (raw === 'adult' || raw === 'store_adult') return 'store_adult';
  if (raw === 'minor' || raw === 'store_minor') return 'store_minor';
  return 'unknown';
}

export function parseAccountSummary(raw: RawAccountShape | undefined): AccountSummary {
  const provider: SsoProvider | null =
    raw?.provider === 'apple' || raw?.provider === 'google' ? raw.provider : null;
  const entitlements: EntitlementState[] = Array.isArray(raw?.entitlements)
    ? raw!.entitlements
        .map((e): EntitlementState | null => {
          if (!e || typeof e !== 'object') return null;
          const product = (e as { product?: unknown }).product;
          const rail = (e as { rail?: unknown }).rail;
          const status = (e as { status?: unknown }).status;
          const validUntil = (e as { validUntil?: unknown }).validUntil;
          if (typeof product !== 'string') return null;
          const s = status === 'active' || status === 'lapsed' ? status : 'inactive';
          return {
            product,
            rail: typeof rail === 'string' ? rail : '',
            status: s,
            ...(typeof validUntil === 'string' ? { validUntil } : {}),
          };
        })
        .filter((e): e is EntitlementState => e !== null)
    : [];
  return {
    accountId: typeof raw?.accountId === 'string' ? raw.accountId : '',
    provider,
    ageStatus: parseAgeStatus(raw?.ageStatus),
    renewalFlagged: raw?.renewalFlagged === true,
    entitlements,
  };
}

/** Whether any entitlement is active (gates the mint/renew affordance). */
export function isEntitled(account: AccountSummary, nowMs: number = Date.now()): boolean {
  return Number.isFinite(nowMs) && account.entitlements.some((e) => e.status === 'active'
    && (e.validUntil === undefined || Date.parse(e.validUntil) > nowMs));
}

export type SignInResult =
  | ({ ok: true } & { account: AccountSummary })
  | { ok: false; reason: SsoAdapterReason };

/**
 * Sign in with the chosen SSO provider. Drives the provider adapter (real idToken
 * or honest unavailability), POSTs it to the account service, and stores the
 * returned session bearer. Fail-closed everywhere; stores NOTHING on failure and
 * never fabricates a signed-in state (AC-6).
 */
export async function signIn(deps: AccountDeps, provider: SsoProvider): Promise<SignInResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const adapter = provider === 'apple' ? deps.apple : deps.google;
  const sso = await adapter.signIn();
  if (!sso.ok) return { ok: false, reason: sso.reason };
  let res: Response;
  try {
    res = await deps.fetchImpl(`${deps.config.accountServiceUrl}/account/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Wire contract: { provider, providerToken }.
      body: JSON.stringify({ provider, providerToken: sso.idToken }),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  // Wire contract: 401 invalid | 503 not_configured, else 200 { token, expiresAtMs, accountId }.
  if (res.status === 401) return { ok: false, reason: 'invalid_token' };
  if (res.status === 503) return { ok: false, reason: 'not_configured' };
  let body: { ok?: boolean; token?: unknown; expiresAtMs?: unknown; accountId?: unknown; reason?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!body?.ok || typeof body.token !== 'string' || body.token.length === 0) {
    return { ok: false, reason: body?.reason === 'invalid_token' ? 'invalid_token' : 'not_configured' };
  }
  try {
    deps.secretStore.set(SESSION_KEY, body.token);
    await deps.secretStore.flush();
  } catch {
    return { ok: false, reason: 'store_error' };
  }
  // The sign-in response carries only the bearer + accountId; the full account
  // summary (age status, entitlements, renewal flag) comes from /account/status.
  const status = await refreshStatus(deps);
  if (status.ok) return { ok: true, account: status.account };
  // Signed in but status unreadable right now: report a minimal honest summary
  // (never fabricated entitlements) built from what sign-in returned.
  return {
    ok: true,
    account: {
      accountId: typeof body.accountId === 'string' ? body.accountId : '',
      provider,
      ageStatus: 'unknown',
      renewalFlagged: false,
      entitlements: [],
    },
  };
}

export type AccountStatusResult = AccountResult<{ account: AccountSummary }>;

/** Refresh the account status against the stored session. Fail-closed on any defect. */
export async function refreshStatus(deps: AccountDeps): Promise<AccountStatusResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const session = readSessionBearer(deps);
  if (!session) return { ok: false, reason: 'no_session' };
  return fetchAccountStatus(deps, session);
}

async function fetchAccountStatus(deps: AccountDeps, session: string): Promise<AccountStatusResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  // Wire contract: GET /account/status returns the account fields FLAT (accountId,
  // provider, ageStatus, renewalFlagged, entitlements), not nested under `account`.
  let body: RawAccountShape & { ok?: boolean };
  try {
    const res = await deps.fetchImpl(`${deps.config.accountServiceUrl}/account/status`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) return { ok: false, reason: 'refused' };
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!body?.ok) return { ok: false, reason: 'refused' };
  return { ok: true, account: parseAccountSummary(body) };
}

// ---------------------------------------------------------------------------
// Blind credential mint + renewal (uses the shared @mylife/sync primitives).
// ---------------------------------------------------------------------------

interface IssueResponse {
  ok?: boolean;
  blindSignature?: unknown;
  epoch?: unknown;
  publicKey?: unknown;
  reason?: unknown;
}

/**
 * Blinding requires the epoch public key BEFORE the client can build the blinded
 * message, so the mint is two steps: fetch the epoch key, then POST the blinded
 * message. The issue/renew response ALSO echoes publicKey (per the wire contract)
 * and we cross-check it equals the fetched key, so a mid-epoch key rotation is
 * caught fail-closed. The account service publishes the epoch public key at the
 * UNAUTHENTICATED GET /account/credential/epoch-key?epoch=N (published for
 * verifiers too; carries no account data). N is optional and defaults to current.
 */
async function fetchEpochPublicKey(
  deps: AccountDeps,
  epoch: number,
): Promise<AccountResult<{ publicKey: string }>> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  let res: Response;
  try {
    res = await deps.fetchImpl(
      `${deps.config.accountServiceUrl}/account/credential/epoch-key?epoch=${epoch}`,
    );
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  // Wire contract: 400 invalid_epoch | 503 not_configured, else 200 { epoch, publicKey }.
  if (res.status === 503) return { ok: false, reason: 'not_configured' };
  if (res.status === 400) return { ok: false, reason: 'refused' };
  let body: IssueResponse;
  try {
    body = (await res.json()) as IssueResponse;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!body?.ok || typeof body.publicKey !== 'string') {
    return { ok: false, reason: body?.reason === 'refused' ? 'refused' : 'not_configured' };
  }
  // Sanity-check the fetched key: a malformed/non-RSA-2048 key parses to null.
  // Refuse honestly rather than proceed to blind under an unusable key.
  if (parseRsaPublicKeySpki(body.publicKey) === null) {
    return { ok: false, reason: 'store_error' };
  }
  return { ok: true, publicKey: body.publicKey };
}

interface PendingMint {
  version: 2 | 3;
  serviceHash?: string;
  accountHash?: string;
  scopeHash: string;
  path: string;
  publicKey: string;
  state: BlindCredentialRequestState;
  blindedMessageBase64: string;
  body: string;
}

function readPendingMint(raw: string, scopeHash: string, path: string, epoch: number, publicKey: string, serviceHash: string, accountHash: string): PendingMint | null {
  try {
    const pending = JSON.parse(raw) as Partial<PendingMint>;
    if (![2, 3].includes(pending.version ?? 0)
      || !['/account/credential/issue', '/account/credential/renew'].includes(pending.path ?? '')
      || typeof pending.scopeHash !== 'string'
      || pending.publicKey !== publicKey || pending.state?.epoch !== epoch
      || typeof pending.state.messageBase64 !== 'string' || typeof pending.state.blindBase64 !== 'string'
      || typeof pending.blindedMessageBase64 !== 'string' || typeof pending.body !== 'string') return null;
    const sameContext = pending.scopeHash === scopeHash && pending.path === path;
    if (pending.version === 3 ? pending.serviceHash !== serviceHash || pending.accountHash !== accountHash : !sameContext) return null;
    const body = JSON.parse(pending.body) as Record<string, unknown>;
    if (body.epoch !== epoch || body.blindedMessage !== pending.blindedMessageBase64
      || Object.keys(body).some((key) => !['epoch', 'blindedMessage', 'expiringCredential'].includes(key))
      || (body.expiringCredential !== undefined && typeof body.expiringCredential !== 'string')) return null;
    return pending as PendingMint;
  } catch { return null; }
}

// The authoritative browser tab owns one account-secret namespace.
let mintFlight: { scopeHash: string; epoch: number; path: string;
  operation: Promise<AccountResult<{ credential: MeerkatCredential }>> } | null = null;

async function clearCompletedMint(deps: AccountDeps, serviceHash: string, scopeHash: string, accountHash: string): Promise<MeerkatCredential | null> {
  const raw = await deps.secretStore.get(PENDING_MINT_KEY);
  if (!raw) return null;
  let pending: Partial<PendingMint>;
  try { pending = JSON.parse(raw) as Partial<PendingMint>; } catch { return null; }
  if (![2, 3].includes(pending?.version ?? 0) || typeof pending.publicKey !== 'string' || !pending.state) return null;
  if (pending.version === 3 ? pending.serviceHash !== serviceHash || pending.accountHash !== accountHash : pending.scopeHash !== scopeHash) return null;
  const completed = (await readStoredCredentials(deps)).find((credential) =>
    credential.epoch === pending.state?.epoch && credential.messageBase64 === pending.state.messageBase64);
  if (!completed || verifyBlindCredential(completed, pending.publicKey,
    credentialEpochWindow(completed.epoch).notBeforeMs) !== 'ok') return null;
  await deps.secretStore.flush();
  // A verified finished pass is already durable. Only its obsolete scratch may be removed.
  deps.secretStore.delete(PENDING_MINT_KEY);
  await deps.secretStore.flush();
  return completed;
}

async function runIssuance(
  deps: AccountDeps, session: string, epoch: number, path: string, extraBody: Record<string, unknown>,
): Promise<AccountResult<{ credential: MeerkatCredential }>> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const scopeHash = sha256Hex(new TextEncoder().encode(`${deps.config.accountServiceUrl}\0${session}`));
  const existing = mintFlight;
  if (existing) return existing.scopeHash === scopeHash && existing.epoch === epoch && existing.path === path
    ? existing.operation : { ok: false, reason: 'mint_recovery_required' };
  const operation = executeIssuance(deps, session, epoch, path, extraBody, scopeHash);
  mintFlight = { scopeHash, epoch, path, operation };
  try { return await operation; } finally { mintFlight = null; }
}

async function executeIssuance(
  deps: AccountDeps, session: string, epoch: number, path: string,
  extraBody: Record<string, unknown>, scopeHash: string,
): Promise<AccountResult<{ credential: MeerkatCredential }>> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const serviceHash = sha256Hex(new TextEncoder().encode(deps.config.accountServiceUrl));
  // Check the saved service before sending even the account session to a changed URL.
  try {
    const raw = deps.secretStore.get(PENDING_MINT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PendingMint>;
      if (saved?.version === 3 ? saved.serviceHash !== serviceHash
        : saved?.version !== 2 || saved.scopeHash !== scopeHash) {
        return { ok: false, reason: 'mint_recovery_required' };
      }
    }
  } catch { return { ok: false, reason: 'store_error' }; }
  const status = await fetchAccountStatus(deps, session);
  if (!status.ok) return status;
  if (!status.account.accountId) return { ok: false, reason: 'refused' };
  const accountHash = sha256Hex(new TextEncoder().encode(status.account.accountId));
  try {
    const completed = await clearCompletedMint(deps, serviceHash, scopeHash, accountHash);
    if (completed?.epoch === epoch) return { ok: true, credential: completed };
  }
  catch { return { ok: false, reason: 'store_error' }; }
  const keyResult = await fetchEpochPublicKey(deps, epoch);
  if (!keyResult.ok) return keyResult;
  const requestKey = keyResult.publicKey;
  let recoveryOnly = false;
  let pending: PendingMint;
  try {
    const stored = await deps.secretStore.get(PENDING_MINT_KEY);
    if (stored) {
      const recovered = readPendingMint(stored, scopeHash, path, epoch, requestKey, serviceHash, accountHash);
      // Never discard an unmatched/legacy request and silently consume a fresh slot.
      if (!recovered) return { ok: false, reason: 'mint_recovery_required' };
      pending = recovered;
      recoveryOnly = pending.scopeHash !== scopeHash || pending.path !== path;
    } else {
      const prepared = prepareBlindCredentialRequest(epoch, requestKey, deps.randomBytes);
      if (!prepared) return { ok: false, reason: 'store_error' };
      pending = { version: 3, serviceHash, accountHash, scopeHash, path, publicKey: requestKey, ...prepared,
        body: JSON.stringify({ epoch, blindedMessage: prepared.blindedMessageBase64, ...extraBody }) };
      await deps.secretStore.set(PENDING_MINT_KEY, JSON.stringify(pending));
    }
    await deps.secretStore.flush();
  } catch { return { ok: false, reason: 'store_error' }; }
  // After a context change, only the server's existing-record recovery endpoint is safe.
  // It receives neither the old bearer nor the client-only blinding state.
  const requestPath = recoveryOnly ? '/account/credential/recover' : path;
  const requestBody = recoveryOnly
    ? JSON.stringify({ epoch, blindedMessage: pending.blindedMessageBase64 }) : pending.body;
  let res: Response;
  try {
    res = await deps.fetchImpl(`${deps.config.accountServiceUrl}${requestPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: requestBody,
    });
  } catch { return { ok: false, reason: 'unreachable' }; }
  if (recoveryOnly && (res.status === 403 || res.status === 404)) {
    return { ok: false, reason: 'mint_recovery_required' };
  }
  if (res.status === 403) return { ok: false, reason: 'refused' };
  let signed: IssueResponse;
  try { signed = (await res.json()) as IssueResponse; }
  catch { return { ok: false, reason: 'unreachable' }; }
  if (!signed?.ok || typeof signed.blindSignature !== 'string') {
    return { ok: false, reason: signed?.reason === 'refused'
      ? (recoveryOnly ? 'mint_recovery_required' : 'refused') : 'unreachable' };
  }
  if (typeof signed.publicKey === 'string' && signed.publicKey !== requestKey) {
    return { ok: false, reason: 'store_error' };
  }
  const credential = finalizeBlindCredential(pending.state, requestKey, signed.blindSignature);
  if (!credential) return { ok: false, reason: 'store_error' };
  try { await storeCredential(deps, credential); }
  catch { return { ok: false, reason: 'store_error' }; }
  // The finished credential is durable before its only recoverable request is removed.
  try {
    deps.secretStore.delete(PENDING_MINT_KEY);
    await deps.secretStore.flush();
  } catch { /* Retry can clean this up. */ }
  return { ok: true, credential };
}

export type MintResult = AccountResult<{ credential: MeerkatCredential }>;

/**
 * Mint the anonymous credential for the current epoch. The account service signs a
 * BLINDED message and never sees the token or its serial (the wall). One active
 * credential per epoch (the service enforces the quota). Fail-closed everywhere;
 * a mint should be triggered at first entitlement, not at first public action, so
 * mint time never correlates with a later presentation.
 */
export async function mintCredential(deps: AccountDeps): Promise<MintResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const session = readSessionBearer(deps);
  if (!session) return { ok: false, reason: 'no_session' };
  const epoch = credentialEpochAt(deps.now());
  return runIssuance(deps, session, epoch, '/account/credential/issue', {});
}

export type RenewResult =
  | ({ ok: true } & { credential: MeerkatCredential })
  | { ok: false; reason: AccountReason };

/**
 * Renew during the renewal window (final 7 days of an epoch). Presents the EXPIRING
 * credential to the service, which checks its serial against the serial-only
 * revocation list: a flagged account is refused ('renewal_refused'); a clean serial
 * blind-issues the NEXT epoch. The presented serial is the ONLY place a serial ever
 * leaves this device, and it carries no account identifier.
 */
export async function renewIfInWindow(deps: AccountDeps): Promise<RenewResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const now = deps.now();
  if (!isWithinRenewalWindow(now)) return { ok: false, reason: 'refused' };
  const session = readSessionBearer(deps);
  if (!session) return { ok: false, reason: 'no_session' };
  const expiring = getStoredCredential(deps);
  if (!expiring) return { ok: false, reason: 'no_credential' };
  const nextEpoch = credentialEpochAt(now) + 1;
  if (expiring.epoch === nextEpoch) return { ok: true, credential: expiring };
  const result = await runIssuance(deps, session, nextEpoch, '/account/credential/renew', {
    expiringCredential: serializeMeerkatCredential(expiring),
  });
  // The service signals a flagged account via 'refused' on the renew path; surface
  // that as the more specific 'renewal_refused' so the UI can say the account may be
  // flagged, honestly.
  if (!result.ok && result.reason === 'refused') return { ok: false, reason: 'renewal_refused' };
  return result;
}

// ---------------------------------------------------------------------------
// Credential presentation (public-layer HTTP header).
// ---------------------------------------------------------------------------

/**
 * The `x-mk-credential` header for a public-layer action, or null when no valid
 * credential is stored. NEVER blocks a private mesh path (the caller attaches this
 * only on public-layer calls; absence leaves behavior byte-identical). No account
 * identifier appears in the header (AC-2): it is the anonymous blind token only.
 */
export function presentCredentialHeader(
  deps: AccountDeps,
  nowMs: number = deps.now(),
): Record<string, string> | null {
  if (!deps.config.configured) return null;
  const credential = readStoredCredentials(deps).find((entry) => isInCredentialWindow(entry, nowMs));
  if (!credential) return null;
  return { 'x-mk-credential': serializeMeerkatCredential(credential) };
}

// ---------------------------------------------------------------------------
// Sign out + account deletion.
// ---------------------------------------------------------------------------

/** Sign out: clears the session bearer only. The credential (anonymous) is kept. */
export async function signOut(deps: AccountDeps): Promise<void> {
  deps.secretStore.delete(SESSION_KEY);
  await deps.secretStore.flush();
}

export type DeleteAccountResult =
  | ({ ok: true } & {
      deletionScope: 'account_layer_only';
      /** True when the service revoked the submitted credential's serial immediately. */
      revokedSerial: boolean;
    })
  | { ok: false; reason: SsoAdapterReason };

/**
 * Re-authenticate and delete the account, then clear isolated local secrets.
 * A public pass is not proof of account ownership, so it is never submitted here.
 * Private messages, files and communities are outside this deletion scope.
 */
export async function deleteAccount(deps: AccountDeps, provider: SsoProvider): Promise<DeleteAccountResult> {
  if (!deps.config.configured) return { ok: false, reason: 'not_configured' };
  const adapter = provider === 'apple' ? deps.apple : deps.google;
  const sso = await adapter.signIn();
  if (!sso.ok) return { ok: false, reason: sso.reason };
  let res: Response;
  try {
    // Account deletion carries no public pass or private-mesh identity.
    res = await deps.fetchImpl(`${deps.config.accountServiceUrl}/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        providerToken: sso.idToken,
      }),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  // Wire contract: 401 invalid | 404 not_found, else 200 { deletionScope, revokedSerial }.
  if (res.status === 401) return { ok: false, reason: 'invalid_token' };
  if (res.status === 404) return { ok: false, reason: 'not_found' };
  let body: { ok?: boolean; deletionScope?: unknown; revokedSerial?: unknown; reason?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!body?.ok) return { ok: false, reason: body?.reason === 'invalid_token' ? 'invalid_token' : 'refused' };
  // Clear the isolated account secrets (session + credential + any pending mint).
  try {
    deps.secretStore.delete(SESSION_KEY);
    deps.secretStore.delete(CREDENTIAL_KEY);
    deps.secretStore.delete(PENDING_MINT_KEY);
    await deps.secretStore.flush();
  } catch {
    return { ok: false, reason: 'store_error' };
  }
  return { ok: true, deletionScope: 'account_layer_only', revokedSerial: body.revokedSerial === true };
}

// ---------------------------------------------------------------------------
// Store age signal -> the neutral age gate (Plan 51 policy).
// ---------------------------------------------------------------------------

/** Map the account ageStatus to the shared store age signal taxonomy. */
export function storeAgeSignalFromStatus(ageStatus: AgeStatus): StoreAgeSignal {
  if (ageStatus === 'store_adult') return 'adult';
  if (ageStatus === 'store_minor') return 'minor';
  return 'unknown';
}

/**
 * Consume a store age signal into the neutral age gate. Policy (encoded in the shared
 * storeAgeSignalSatisfiesGate): ONLY a store_adult signal passes the gate, with
 * source 'store'. A store_minor or unknown signal changes NOTHING (the neutral in-app
 * gate still runs, because "minor" does not mean "under the minimum age"). A gate
 * already passed or LOCKED is never overwritten. Returns true only when this call
 * actually wrote a passing record.
 */
export function applyStoreAgeSignal(
  db: DatabaseAdapter,
  account: AccountSummary,
  nowMs: number = Date.now(),
  minimumAge: number = configuredMinimumAge(),
): boolean {
  const signal = storeAgeSignalFromStatus(account.ageStatus);
  if (!storeAgeSignalSatisfiesGate(signal)) return false;
  if (isAgeGatePassed(db) || isAgeGateLocked(db)) return false;
  setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('passed', minimumAge, nowMs, 'store'));
  notifyAgeGateChangedFromStore();
  return true;
}

// ---------------------------------------------------------------------------
// Verbatim account-section copy (mirror of the mobile ACCOUNT_COPY /
// ACCOUNT_DELETE_COPY so the parity script can compare the exact strings).
// HONEST: never claims "signed in"/"verified"/"entitled" without a real response.
// ---------------------------------------------------------------------------

export const ACCOUNT_COPY = {
  sectionTitle: 'Verification account',
  sectionHint: 'Optional. Sign in only to carry your purchase across devices and prove your account backs your public posts. Private use never needs an account.',
  notConfigured: 'Verification accounts are not connected in this build. Private use, browsing, and the one-time unlock still work without one.',
  signedOutTitle: 'Not signed in',
  signedOutBody: 'Sign in with Apple or Google to create a minimal verification account. It stores only your sign-in, age status, and entitlement. It never sees your Meerkat identity, keys, messages, or content.',
  appleButton: 'Sign in with Apple',
  googleButton: 'Sign in with Google',
  providerUnavailable: 'That sign-in method is not available in this build.',
  needsServer: 'Signing in needs a connection server. None is configured in this build.',
  invalidToken: 'That sign-in could not be verified. Try again.',
  accountDeleted: 'This verification account was deleted. You can create it again after the current anonymous-pass period ends.',
  unreachable: 'Could not reach the account server. Check your connection and try again.',
  signedInTitle: 'Signed in',
  signOutButton: 'Sign out',
  entitledLabel: 'Entitlement active',
  notEntitledLabel: 'No active entitlement on this account',
  ageAdult: 'Age status: verified adult (from your app store)',
  ageMinor: 'Age status: minor (the in-app age screen still applies)',
  ageUnknown: 'Age status: not provided',
  mintButton: 'Create anonymous pass',
  renewButton: 'Renew anonymous pass',
  credentialActive: 'An anonymous pass is active for this period. It proves an account backs you without revealing which one.',
  credentialScheduled: 'A pass is saved for the next period. It cannot be used before that period starts.',
  credentialExpired: 'The stored pass has expired. Public posting as a backed account is paused; automatic expired-pass recovery is unavailable.',
  credentialNone: 'No anonymous pass yet. Create one to post to public surfaces as a backed account.',
  credentialRenewalRefused: 'Renewal was refused. The pass may be restricted or may not match this account’s latest issuance. Public posting as a backed account is paused.',
  credentialIssueRefused: 'A new pass was refused. If this account already received a pass, renew that pass during its renewal window. Lost or expired passes cannot currently be replaced automatically. Your private messages and communities remain available.',
  mintRecoveryRequired: 'An unfinished pass request was kept. Sign in to the original account on the same account server and retry while that pass period is valid. Recovery only retrieves an already issued pass; it never creates a replacement. Your private messages and communities remain available.',
  mintFailed: 'Could not create the pass right now. Try again.',
} as const;

export const ACCOUNT_DELETE_COPY = {
  cannotTouchInApp:
    'Deleting your verification account removes the account record, entitlement state, and detailed issuance bookkeeping. A protected deletion marker retains restrictions and the last issued period to prevent an issuance reset. It cannot touch your in-app data (messages, files, communities), because the account was never linked to it.',
  unsubmittedPassExpires:
    'Account deletion removes locally stored passes but cannot currently revoke anonymous passes. Any copies remain usable until their own period and grace interval end.',
  recreateAfterPeriod:
    'To prevent deletion from resetting anonymous-pass issuance, the same sign-in cannot create another verification account until the current pass period ends. Recreating the account does not reset its anonymous-pass history.',
} as const;

// ---------------------------------------------------------------------------
// Live browser SSO adapters: REDIRECT-based OpenID Connect (implicit id_token).
// No third-party scripts are loaded, so the app CSP (script-src 'self') stays
// intact -- navigation-based flows are permitted. Each adapter either CONSUMES a
// completed callback in the URL fragment (returns the id_token) or STARTS a
// redirect to the provider (the page unloads; the promise never resolves). Nonce +
// state are generated per attempt, stored in sessionStorage, and the nonce claim in
// the returned id_token is verified client-side before the token is accepted, so a
// replayed or cross-session token is rejected. NEVER produces a fake token; honest
// unavailability is 'not_configured' (unset provider) or 'invalid_token'
// (mismatched/absent callback). The browser env is injected for tests.
// ---------------------------------------------------------------------------

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const APPLE_AUTH_ENDPOINT = 'https://appleid.apple.com/auth/authorize';

/** A per-provider sessionStorage key holding the pending { nonce, state } attempt. */
function pendingKey(provider: SsoProvider): string {
  return `meerkat.account.oauth.${provider}`;
}

/** The injectable browser surface (window + sessionStorage), so tests drive it. */
export interface OAuthBrowserEnv {
  /** The current URL fragment WITHOUT the leading '#', e.g. "id_token=...&state=...". */
  getHash(): string;
  /** The redirect_uri the provider returns to (the app origin + path, no fragment). */
  redirectUri(): string;
  /** Navigate the whole page to the provider's authorize URL. */
  assign(url: string): void;
  /** Replace the current URL to strip the consumed OAuth fragment (history clean). */
  clearHash(): void;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** A cryptographically random URL-safe token for nonce + state. */
  randomToken(): string;
}

function liveOAuthBrowserEnv(): OAuthBrowserEnv | null {
  if (typeof window === 'undefined' || !window.sessionStorage || !window.location) return null;
  const store = window.sessionStorage;
  return {
    getHash: () => window.location.hash.replace(/^#/u, ''),
    redirectUri: () => `${window.location.origin}${window.location.pathname}`,
    assign: (url) => { window.location.assign(url); },
    clearHash: () => {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    },
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => { store.setItem(key, value); },
    removeItem: (key) => { store.removeItem(key); },
    randomToken: () => {
      const bytes = liveRandomBytes(16);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    },
  };
}

/** Parse a URL fragment query string into a flat map. */
function parseFragment(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    const key = idx >= 0 ? pair.slice(0, idx) : pair;
    const value = idx >= 0 ? pair.slice(idx + 1) : '';
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      // skip a malformed pair
    }
  }
  return out;
}

/** Base64url-decode a JWT segment to its JSON claims (no signature check: the account
 *  service verifies the token server-side; here we only read the nonce for replay
 *  protection). Returns null on any defect. */
function decodeJwtClaims(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1]!.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  try {
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
    const claims = JSON.parse(json) as unknown;
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The shared redirect adapter. On call it FIRST checks the URL fragment for a
 * completed callback whose state matches this provider's stored attempt; on a match
 * it verifies the id_token's nonce claim, clears the pending attempt + fragment, and
 * returns the token. Otherwise it starts a fresh redirect (page unloads) and returns
 * 'redirecting'. Fail-closed: unset provider id => 'not_configured'; a callback whose
 * state or nonce does not match => 'invalid_token' (never a fabricated token).
 */
export function redirectAdapter(
  provider: SsoProvider,
  clientId: string,
  authEndpoint: string,
  responseMode: 'fragment',
  env: OAuthBrowserEnv | null,
): SsoAdapter {
  return {
    async signIn(): Promise<{ ok: true; idToken: string } | { ok: false; reason: SsoAdapterReason }> {
      if (!clientId) return { ok: false, reason: 'not_configured' };
      if (!env) return { ok: false, reason: 'unavailable_in_build' };

      // 1) Consume a completed callback for THIS provider, if present.
      const fragment = parseFragment(env.getHash());
      const pendingRaw = env.getItem(pendingKey(provider));
      if (fragment.id_token || fragment.error || (fragment.state && pendingRaw)) {
        env.removeItem(pendingKey(provider));
        env.clearHash();
        let pending: { nonce?: string; state?: string } | null = null;
        try {
          pending = pendingRaw ? (JSON.parse(pendingRaw) as { nonce?: string; state?: string }) : null;
        } catch {
          pending = null;
        }
        if (fragment.error || !fragment.id_token || !pending?.state || fragment.state !== pending.state) {
          return { ok: false, reason: 'invalid_token' };
        }
        const claims = decodeJwtClaims(fragment.id_token);
        // Verify the nonce claim matches what we generated (replay / cross-session guard).
        if (!claims || typeof claims.nonce !== 'string' || claims.nonce !== pending.nonce) {
          return { ok: false, reason: 'invalid_token' };
        }
        return { ok: true, idToken: fragment.id_token };
      }

      // 2) No callback: start a fresh redirect. Persist nonce + state first.
      const nonce = env.randomToken();
      const state = env.randomToken();
      env.setItem(pendingKey(provider), JSON.stringify({ nonce, state }));
      const params = new URLSearchParams({
        response_type: 'id_token',
        response_mode: responseMode,
        client_id: clientId,
        redirect_uri: env.redirectUri(),
        scope: 'openid',
        nonce,
        state,
      });
      env.assign(`${authEndpoint}?${params.toString()}`);
      // The page is navigating away; this outcome is never actually observed.
      return { ok: false, reason: 'redirecting' };
    },
  };
}

function liveAppleAdapter(config: ResolvedAccountConfig, env: OAuthBrowserEnv | null = liveOAuthBrowserEnv()): SsoAdapter {
  return redirectAdapter('apple', config.configured ? config.appleServiceId : '', APPLE_AUTH_ENDPOINT, 'fragment', env);
}

function liveGoogleAdapter(config: ResolvedAccountConfig, env: OAuthBrowserEnv | null = liveOAuthBrowserEnv()): SsoAdapter {
  return redirectAdapter('google', config.configured ? config.googleClientId : '', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
}

/**
 * Whether the current URL fragment carries a pending SSO callback for a provider
 * with a stored attempt. The AccountSection calls this on mount to decide whether to
 * complete a redirect sign-in (consume the token) rather than starting a new one.
 */
export function pendingSsoCallbackProvider(env: OAuthBrowserEnv | null = liveOAuthBrowserEnv()): SsoProvider | null {
  if (!env) return null;
  const fragment = parseFragment(env.getHash());
  if (!fragment.id_token && !fragment.error && !fragment.state) return null;
  for (const provider of ['apple', 'google'] as const) {
    if (env.getItem(pendingKey(provider))) return provider;
  }
  return null;
}
