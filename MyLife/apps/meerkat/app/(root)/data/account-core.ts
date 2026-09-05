// Verification-account client core (Plan 51 P3, Meerkat two-identity model).
//
// The OUTER layer of the two-identity model: a minimal Sign in with Apple/Google
// account that gates the entitlement (app unlock + hosted subscription) and mints
// an anonymous blind credential proving "some verified account backs me" WITHOUT
// revealing which one. It is SEPARATE from the inner Meerkat identity (device keys,
// E2EE, zero-knowledge relays); the private mesh (communities, DMs, sync) never
// touches this module (AC-4) and no account identifier ever rides on a credential
// presentation (AC-2).
//
// HONESTY CONTRACT (binding, transport-honesty rule):
//   - UNCONFIGURED (no accountServiceUrl in the build) => every operation returns
//     { ok:false, reason:'not_configured' } and the UI shows honest copy. Nothing
//     fabricates a signed-in, verified, or entitled state (AC-6).
//   - SSO providers are lazy-required; when the native module is absent (it is NOT
//     installed and we add NO dependency) the adapter returns
//     { ok:false, reason:'unavailable_in_build' }. No fake token is ever produced.
//   - The blind credential is minted with the SHARED @mylife/sync primitives; the
//     account service signs a blinded message and never sees the token or its serial.
//
// RN-safety: expo-secure-store + expo-crypto are lazy-required at the seam so this
// module can be unit-tested under Node/Vitest with injected fakes. The pure logic
// (config resolution, request shaping, honest reasons, store-age policy) never
// touches a native module.

import type { DatabaseAdapter } from '@mylife/db';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';
import {
  credentialEpochAt,
  parseMeerkatCredential,
  finalizeBlindCredential,
  verifyBlindCredential,
  isWithinRenewalWindow,
  parseRsaPublicKeySpki,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  credentialEpochWindow,
  encodeAgeGateRecord,
  storeAgeSignalSatisfiesGate,
  AGE_GATE_SETTING_KEY,
  type MeerkatCredential,
  type BlindCredentialRequestState,
  type StoreAgeSignal,
} from '@mylife/sync';
import {
  configuredMinimumAge,
  isAgeGateLocked,
  isAgeGatePassed,
  notifyAgeGateChangedFromStore,
} from './age-gate';
import { setSetting } from './db';

// ---------------------------------------------------------------------------
// Config (from expo extra). Unconfigured => the whole layer is OFF.
// ---------------------------------------------------------------------------

export interface AccountConfig {
  configured: true;
  accountServiceUrl: string;
  /** Sign in with Apple service id, or '' when not set (Apple sign-in unavailable). */
  appleServiceId: string;
  /** Google OAuth client id, or '' when not set (Google sign-in unavailable). */
  googleClientId: string;
}

export type ResolvedAccountConfig = AccountConfig | { configured: false };

/** Pure resolver from an expo extra bag (unit-tested without native modules). */
export function resolveAccountConfigFromExtra(extra: Record<string, unknown>): ResolvedAccountConfig {
  const url = typeof extra.accountServiceUrl === 'string' ? extra.accountServiceUrl.trim() : '';
  if (!url.startsWith('http')) return { configured: false };
  return {
    configured: true,
    accountServiceUrl: url.replace(/\/+$/u, ''),
    appleServiceId: typeof extra.appleServiceId === 'string' ? extra.appleServiceId.trim() : '',
    googleClientId: typeof extra.googleClientId === 'string' ? extra.googleClientId.trim() : '',
  };
}

/** Resolve the account config from the live app config `extra`. Empty url => off. */
export function resolveAccountConfig(): ResolvedAccountConfig {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return resolveAccountConfigFromExtra(extra);
}

// ---------------------------------------------------------------------------
// Result + honest reason vocabulary
// ---------------------------------------------------------------------------

/** Every honest failure reason the account layer can surface. */
export type AccountReason =
  | 'not_configured'
  | 'unavailable_in_build'
  | 'invalid_token'
  | 'account_deleted'
  | 'unreachable'
  | 'refused'
  | 'renewal_refused'
  | 'no_session'
  | 'no_credential'
  | 'not_found'
  | 'store_error'
  | 'mint_recovery_required';

export type AccountResult<T> = ({ ok: true } & T) | { ok: false; reason: AccountReason };

// ---------------------------------------------------------------------------
// Account shape (mirrors the service contract; nothing beyond these fields)
// ---------------------------------------------------------------------------

/**
 * Age status as this client models it. The wire `/account/status.ageStatus` sends
 * 'adult' | 'minor' (matching the /account/age-signal signal vocabulary); an absent
 * or unrecognized value maps to 'unknown'. We keep the internal names as the store
 * signal vocabulary the shared age-gate core already uses.
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
// Injectable seams (native modules + fetch + prng), each with a live default.
// ---------------------------------------------------------------------------

/** A minimal secure-store seam; the live default wraps expo-secure-store. */
export interface AccountSecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** An SSO provider adapter; returns an opaque idToken or an honest unavailability. */
export interface SsoAdapter {
  signIn(): Promise<{ ok: true; idToken: string } | { ok: false; reason: AccountReason }>;
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

// --- live secure-store (isolated keychain service, own from storage/oauth) ---

const ACCOUNT_KEYCHAIN_SERVICE = 'com.mylife.meerkat.account';
const SESSION_KEY = 'meerkat.account.session';
const CREDENTIAL_KEY = 'meerkat.account.credential';
const PENDING_MINT_KEY = 'meerkat.account.pending_mint';

function liveSecretStore(): AccountSecretStore {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  const options: import('expo-secure-store').SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: ACCOUNT_KEYCHAIN_SERVICE,
  };
  return {
    async get(key) {
      return SecureStore.getItemAsync(key, options);
    },
    async set(key, value) {
      await SecureStore.setItemAsync(key, value, options);
      const written = await SecureStore.getItemAsync(key, options);
      if (written !== value) throw new Error('SecureStore did not persist the account secret.');
    },
    async delete(key) {
      await SecureStore.deleteItemAsync(key, options);
    },
  };
}

function liveRandomBytes(length: number): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  return Crypto.getRandomBytes(length);
}

// --- live SSO adapters (lazy-required; absent module => unavailable_in_build) --

// The SSO native modules are NOT installed (no dependency added). requireOptional
// returns null when the module is absent so the adapter fails with the honest
// 'unavailable_in_build' reason instead of throwing at import time.
function requireOptional(moduleId: string): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return (0, eval)('require')(moduleId);
  } catch {
    return null;
  }
}

interface AppleAuthModule {
  isAvailableAsync(): Promise<boolean>;
  signInAsync(options: { requestedScopes: unknown[] }): Promise<{ identityToken?: string | null }>;
  AppleAuthenticationScope: { EMAIL: unknown };
}

function liveAppleAdapter(config: ResolvedAccountConfig): SsoAdapter {
  return {
    async signIn() {
      if (!config.configured || !config.appleServiceId) return { ok: false, reason: 'unavailable_in_build' };
      const AppleAuth = requireOptional('expo-apple-authentication') as AppleAuthModule | null;
      if (!AppleAuth) return { ok: false, reason: 'unavailable_in_build' };
      try {
        const available = await AppleAuth.isAvailableAsync();
        if (!available) return { ok: false, reason: 'unavailable_in_build' };
        const credential = await AppleAuth.signInAsync({
          requestedScopes: [AppleAuth.AppleAuthenticationScope.EMAIL],
        });
        if (typeof credential.identityToken !== 'string' || credential.identityToken.length === 0) {
          return { ok: false, reason: 'invalid_token' };
        }
        return { ok: true, idToken: credential.identityToken };
      } catch {
        return { ok: false, reason: 'unavailable_in_build' };
      }
    },
  };
}

interface GoogleSigninModule {
  GoogleSignin: {
    configure: (o: unknown) => void;
    hasPlayServices: () => Promise<boolean>;
    signIn: () => Promise<{ idToken?: string | null; data?: { idToken?: string | null } }>;
  };
}

function liveGoogleAdapter(config: ResolvedAccountConfig): SsoAdapter {
  return {
    async signIn() {
      if (!config.configured || !config.googleClientId) return { ok: false, reason: 'unavailable_in_build' };
      const mod = requireOptional('@react-native-google-signin/google-signin') as GoogleSigninModule | null;
      if (!mod) return { ok: false, reason: 'unavailable_in_build' };
      try {
        mod.GoogleSignin.configure({ webClientId: config.googleClientId });
        await mod.GoogleSignin.hasPlayServices();
        const result = await mod.GoogleSignin.signIn();
        const idToken = result.idToken ?? result.data?.idToken ?? null;
        if (typeof idToken !== 'string' || idToken.length === 0) return { ok: false, reason: 'invalid_token' };
        return { ok: true, idToken };
      } catch {
        return { ok: false, reason: 'unavailable_in_build' };
      }
    },
  };
}

/** Build the live deps bundle (used by the screens). Every seam has a real default. */
export function liveAccountDeps(): AccountDeps {
  const config = resolveAccountConfig();
  return {
    config,
    fetchImpl: (globalThis.fetch?.bind(globalThis) as typeof fetch),
    secretStore: liveSecretStore(),
    randomBytes: liveRandomBytes,
    apple: liveAppleAdapter(config),
    google: liveGoogleAdapter(config),
    now: () => Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Session + credential storage (isolated keychain service)
// ---------------------------------------------------------------------------

async function readSessionBearer(deps: AccountDeps): Promise<string | null> {
  return deps.secretStore.get(SESSION_KEY);
}

async function readStoredCredentials(deps: AccountDeps): Promise<MeerkatCredential[]> {
  const raw = await deps.secretStore.get(CREDENTIAL_KEY);
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
export async function getStoredCredential(deps: AccountDeps): Promise<MeerkatCredential | null> {
  return (await readStoredCredentials(deps))[0] ?? null;
}

function isInCredentialWindow(credential: MeerkatCredential, nowMs: number): boolean {
  const window = credentialEpochWindow(credential.epoch);
  return nowMs >= window.notBeforeMs && nowMs <= window.notAfterMs;
}

export type StoredCredentialState = 'active' | 'scheduled' | 'expired' | 'none';

export async function getStoredCredentialState(deps: AccountDeps): Promise<StoredCredentialState> {
  const credentials = await readStoredCredentials(deps);
  const now = deps.now();
  if (credentials.some((credential) => isInCredentialWindow(credential, now))) return 'active';
  if (credentials.some((credential) => credentialEpochWindow(credential.epoch).notBeforeMs > now)) return 'scheduled';
  return credentials.length ? 'expired' : 'none';
}

async function storeCredential(deps: AccountDeps, credential: MeerkatCredential): Promise<void> {
  const previous = (await readStoredCredentials(deps)).find((entry) => entry.epoch < credential.epoch);
  // One keychain write preserves both periods atomically; never serialize this wrapper on the wire.
  await deps.secretStore.set(CREDENTIAL_KEY, JSON.stringify({ version: 2, latest: credential, previous }));
}

/** True when a session bearer is stored (the honest "signed in" state). */
export async function isSignedIn(deps: AccountDeps): Promise<boolean> {
  if (!deps.config.configured) return false;
  return (await readSessionBearer(deps)) !== null;
}

/** True during the renewal window (final 7 days of the current epoch). UI convenience. */
export function isWithinRenewalWindowNow(nowMs: number = Date.now()): boolean {
  return isWithinRenewalWindow(nowMs);
}

// ---------------------------------------------------------------------------
// Service HTTP calls (the P1 account service contract; injectable fetch)
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

function parseAccountSummary(raw: RawAccountShape | undefined): AccountSummary {
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

export type SignInResult = AccountResult<{ account: AccountSummary }>;

/**
 * Sign in with the chosen SSO provider. Drives the provider adapter (real idToken
 * or honest unavailability), POSTs it to the account service, and stores the
 * returned session bearer. Fail-closed: unconfigured, an unavailable provider, an
 * invalid token, or an unreachable service each return an honest reason and store
 * NOTHING. Nothing here fabricates a signed-in state (AC-6).
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
  let body: { ok?: boolean; token?: unknown; expiresAtMs?: unknown; accountId?: unknown; reason?: unknown };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  // Wire contract: 401 invalid | 403 account_deleted | 503 not_configured,
  // else 200 { token, expiresAtMs, accountId }.
  if (res.status === 401) return { ok: false, reason: 'invalid_token' };
  if (res.status === 403 && body.reason === 'account_deleted') {
    return { ok: false, reason: 'account_deleted' };
  }
  if (res.status === 503) return { ok: false, reason: 'not_configured' };
  if (!body?.ok || typeof body.token !== 'string' || body.token.length === 0) {
    if (body?.reason === 'invalid_token') return { ok: false, reason: 'invalid_token' };
    if (body?.reason === 'account_deleted') return { ok: false, reason: 'account_deleted' };
    return { ok: false, reason: 'not_configured' };
  }
  try {
    await deps.secretStore.set(SESSION_KEY, body.token);
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
  const session = await readSessionBearer(deps);
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
// Blind credential mint + renewal (uses the shared @mylife/sync primitives)
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

// Every live dependency bundle uses the same isolated keychain namespace.
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
  // A verified finished pass is already durable. Only its obsolete scratch may be removed.
  await deps.secretStore.delete(PENDING_MINT_KEY);
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
    const raw = await deps.secretStore.get(PENDING_MINT_KEY);
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
  try { await deps.secretStore.delete(PENDING_MINT_KEY); } catch { /* Retry can clean this up. */ }
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
  const session = await readSessionBearer(deps);
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
  const session = await readSessionBearer(deps);
  if (!session) return { ok: false, reason: 'no_session' };
  const expiring = await getStoredCredential(deps);
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
// Credential presentation (public-layer HTTP header)
// ---------------------------------------------------------------------------

/**
 * The `x-mk-credential` header for a public-layer action, or null when no valid
 * credential is stored. NEVER blocks a private mesh path (the caller attaches this
 * only on public-layer calls; absence leaves behavior byte-identical). No account
 * identifier appears in the header (AC-2): it is the anonymous blind token only.
 */
export async function presentCredentialHeader(
  deps: AccountDeps,
  nowMs: number = deps.now(),
): Promise<Record<string, string> | null> {
  if (!deps.config.configured) return null;
  const credential = (await readStoredCredentials(deps)).find((entry) => isInCredentialWindow(entry, nowMs));
  if (!credential) return null;
  return { 'x-mk-credential': serializeMeerkatCredential(credential) };
}

// ---------------------------------------------------------------------------
// Sign out + account deletion
// ---------------------------------------------------------------------------

/** Sign out: clears the session bearer only. The credential (anonymous) is kept. */
export async function signOut(deps: AccountDeps): Promise<void> {
  await deps.secretStore.delete(SESSION_KEY);
}

/**
 * Verbatim account-section copy (RN-free so the web twin mirrors it; the parity
 * script may compare these exact strings). HONEST: never claims "verified" or
 * "signed in" without a real server response; every not-configured line states the
 * account layer is off in this build.
 */
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

/** Honest copy fields for the deletion flow, aligned with privacy-policy Section 9. */
export const ACCOUNT_DELETE_COPY = {
  cannotTouchInApp:
    'Deleting your verification account removes the account record, entitlement state, and detailed issuance bookkeeping. A protected deletion marker retains restrictions and the last issued period to prevent an issuance reset. It cannot touch your in-app data (messages, files, communities), because the account was never linked to it.',
  unsubmittedPassExpires:
    'Account deletion removes locally stored passes but cannot currently revoke anonymous passes. Any copies remain usable until their own period and grace interval end.',
  recreateAfterPeriod:
    'To prevent deletion from resetting anonymous-pass issuance, the same sign-in cannot create another verification account until the current pass period ends. Recreating the account does not reset its anonymous-pass history.',
} as const;

export type DeleteAccountResult = AccountResult<{
  deletionScope: 'account_layer_only';
  /** True when the service revoked the submitted credential's serial immediately. */
  revokedSerial: boolean;
}>;

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
  // Clear the isolated keychain service (session + credential + any pending mint).
  try {
    await deps.secretStore.delete(SESSION_KEY);
    await deps.secretStore.delete(CREDENTIAL_KEY);
    await deps.secretStore.delete(PENDING_MINT_KEY);
  } catch {
    return { ok: false, reason: 'store_error' };
  }
  return { ok: true, deletionScope: 'account_layer_only', revokedSerial: body.revokedSerial === true };
}

// ---------------------------------------------------------------------------
// Store age signal -> the neutral age gate (Plan 51 policy)
// ---------------------------------------------------------------------------

/** Map the account ageStatus to the shared store age signal taxonomy. */
export function storeAgeSignalFromStatus(ageStatus: AgeStatus): StoreAgeSignal {
  if (ageStatus === 'store_adult') return 'adult';
  if (ageStatus === 'store_minor') return 'minor';
  return 'unknown';
}

/**
 * Consume a store age signal into the neutral age gate. Policy (encoded in the
 * shared storeAgeSignalSatisfiesGate): ONLY a store_adult signal passes the gate,
 * with source 'store'. A store_minor or unknown signal changes NOTHING (the neutral
 * in-app gate still runs, because "minor" does not mean "under the minimum age"). A
 * gate already passed or LOCKED is never overwritten. Returns true only when this
 * call actually wrote a passing record.
 */
export function applyStoreAgeSignal(
  db: DatabaseAdapter,
  account: AccountSummary,
  nowMs: number = Date.now(),
  minimumAge: number = configuredMinimumAge(),
): boolean {
  const signal = storeAgeSignalFromStatus(account.ageStatus);
  if (!storeAgeSignalSatisfiesGate(signal)) return false;
  // Never overwrite an existing decision (a locked record must stay locked; an
  // already-passed record needs no rewrite).
  if (isAgeGatePassed(db) || isAgeGateLocked(db)) return false;
  setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('passed', minimumAge, nowMs, 'store'));
  notifyAgeGateChangedFromStore();
  return true;
}
