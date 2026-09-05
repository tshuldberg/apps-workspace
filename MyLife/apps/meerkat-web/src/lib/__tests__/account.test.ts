/**
 * Plan 51 P3 (web): the verification-account client (twin of the mobile
 * account-core). Fail-closed everywhere, a REAL blind-credential mint roundtrip
 * (node:crypto RSA-2048 raw signing so finalizeBlindCredential genuinely verifies),
 * the store-age-signal matrix, the x-mk-credential presentation behavior, deletion,
 * and an AC-4 import-scan proving the private-mesh modules never import this file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, createPublicKey, generateKeyPairSync, privateDecrypt, randomBytes as nodeRandomBytes, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  CREDENTIAL_MODULUS_BYTES,
  credentialEpochAt,
  credentialEpochWindow,
  credentialSerial,
  parseMeerkatCredential,
  serializeMeerkatCredential,
  verifyBlindCredential,
} from '@mylife/sync';
import {
  CREDENTIAL_KEY,
  PENDING_MINT_KEY,
  APPLE_AUTH_ENDPOINT,
  GOOGLE_AUTH_ENDPOINT,
  SESSION_KEY,
  applyStoreAgeSignal,
  deleteAccount,
  getStoredCredential,
  isEntitled,
  isSignedIn,
  mintCredential,
  parseAccountSummary,
  pendingSsoCallbackProvider,
  presentCredentialHeader,
  redirectAdapter,
  refreshStatus,
  resolveAccountConfigFromEnv,
  signIn,
  signOut,
  storeAgeSignalFromStatus,
  type AccountDeps,
  type AccountSecretStore,
  type AccountSummary,
  type OAuthBrowserEnv,
  type ResolvedAccountConfig,
  type SsoAdapter,
} from '../account';
import { isAgeGateLocked, isAgeGatePassed, readAgeGateRecord } from '../age-gate';

// ---------------------------------------------------------------------------
// A REAL epoch keypair + raw blind signer (mirrors the P2 server + harness). The
// blinded message is signed with RSA_NO_PADDING so the client's unblind + verify
// path exercises real crypto end to end.
// ---------------------------------------------------------------------------

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const EPOCH_PUBLIC_KEY = keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

/** The key material the fake service signs with (defaults to the module keypair). */
interface ServiceIssuer {
  privateKey: KeyObject;
  publicKeySpki: string;
}

function rawBlindSign(blindedMessageBase64: string, privateKey: KeyObject = keyPair.privateKey): string {
  const blinded = Buffer.from(blindedMessageBase64, 'base64');
  const signed = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, blinded);
  const padded = Buffer.alloc(CREDENTIAL_MODULUS_BYTES);
  signed.copy(padded, CREDENTIAL_MODULUS_BYTES - signed.length);
  return padded.toString('base64');
}

const liveRandom = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

function spkiModulus(publicKeySpkiDerBase64: string): bigint {
  const jwk = createPublicKey({
    key: Buffer.from(publicKeySpkiDerBase64, 'base64'),
    format: 'der',
    type: 'spki',
  }).export({ format: 'jwk' }) as { n: string };
  return BigInt('0x' + Buffer.from(jwk.n, 'base64url').toString('hex'));
}

/**
 * A served-key/issuer-key pair whose moduli are ORDERED BY CONSTRUCTION: the
 * discovery route serves the SMALLER modulus and the issuer signs under the
 * LARGER one. The client blinds mod the served modulus, so the blinded value is
 * always below the issuer's modulus and the raw RSA signing op can never throw
 * "data too large for modulus". Without this ordering the op throws whenever
 * the blinded value lands above the issuer's modulus (~12% of runs), which was
 * the root cause of this file's intermittent failure. (Rejection-sampling a
 * smaller key against the fixed module-level issuer was tried first and is
 * itself probabilistic: when the issuer modulus lands near the bottom of the
 * RSA-2048 range, no bounded number of attempts is guaranteed to find a
 * smaller one.)
 */
function orderedMismatchedKeys(): { servedKey: string; issuer: ServiceIssuer } {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  const pairSpki = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  if (spkiModulus(pairSpki) < spkiModulus(EPOCH_PUBLIC_KEY)) {
    return { servedKey: pairSpki, issuer: { privateKey: keyPair.privateKey, publicKeySpki: EPOCH_PUBLIC_KEY } };
  }
  return { servedKey: EPOCH_PUBLIC_KEY, issuer: { privateKey: pair.privateKey, publicKeySpki: pairSpki } };
}

const NOW = credentialEpochWindow(0).notBeforeMs + 60_000;
const EPOCH = credentialEpochAt(NOW);

// ---------------------------------------------------------------------------
// Fakes: secret store, SSO adapters, and a route-based account service.
// ---------------------------------------------------------------------------

function makeStore(): AccountSecretStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (key) => map.get(key) ?? null,
    set: (key, value) => { map.set(key, value); },
    delete: (key) => { map.delete(key); },
    flush: async () => {},
  };
}

const CONFIG: ResolvedAccountConfig = {
  configured: true,
  accountServiceUrl: 'https://account.example',
  appleServiceId: 'com.example.svc',
  googleClientId: 'google-client.apps.googleusercontent.com',
};

function okAdapter(idToken: string): SsoAdapter {
  return { signIn: async () => ({ ok: true, idToken }) };
}
function unavailableAdapter(): SsoAdapter {
  return { signIn: async () => ({ ok: false, reason: 'unavailable_in_build' }) };
}

interface ServiceState {
  session: string;
  accountId: string;
  /** The FLAT /account/status body (ageStatus, renewalFlagged, entitlements). */
  account: { ageStatus: string; renewalFlagged: boolean; entitlements: unknown[] };
  epochKeyConfigured: boolean;
  /** Force the epoch-key route to serve a different key than the issuer signs with. */
  epochKeyOverride: string | null;
  issueRefused: boolean;
  /** Reject the issue POST at the network layer (fetch throws). */
  issueUnreachable: boolean;
  /** Omit the publicKey echo from the issue response (client falls back to finalize-verify). */
  omitIssueKeyEcho: boolean;
  /** Sign (and echo) with this key material instead of the module keypair. */
  issuer: ServiceIssuer;
  seen: { path: string; body: unknown; auth: string | null }[];
}

function makeService(overrides: Partial<ServiceState> = {}): { fetchImpl: typeof fetch; state: ServiceState } {
  const state: ServiceState = {
    session: 'session-bearer',
    accountId: '11111111-1111-1111-1111-111111111111',
    account: {
      ageStatus: 'adult',
      renewalFlagged: false,
      entitlements: [{ product: 'app_unlock', rail: 'apple', status: 'active' }],
    },
    epochKeyConfigured: true,
    epochKeyOverride: null,
    issueRefused: false,
    issueUnreachable: false,
    omitIssueKeyEcho: false,
    issuer: { privateKey: keyPair.privateKey, publicKeySpki: EPOCH_PUBLIC_KEY },
    seen: [],
    ...overrides,
  };
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const auth = headers.Authorization ?? headers.authorization ?? null;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    state.seen.push({ path, body, auth });
    const json = (status: number, payload: unknown): Response =>
      new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

    // Wire contract mirrors packages/meerkat-relay/src/account-service-http.ts.
    if (path === '/account/sign-in') {
      return json(200, { ok: true, token: state.session, expiresAtMs: NOW + 3_600_000, accountId: state.accountId });
    }
    if (path === '/account/status') {
      if (auth !== `Bearer ${state.session}`) return json(401, { ok: false, reason: 'unauthenticated' });
      // Account fields ride FLAT, not nested under `account`.
      return json(200, { ok: true, accountId: state.accountId, provider: 'apple', ...state.account });
    }
    if (path === '/account/credential/epoch-key') {
      // Unauthenticated route: serves a published epoch public key + carries no account data.
      if (!state.epochKeyConfigured) return json(503, { ok: false, reason: 'not_configured' });
      return json(200, { ok: true, epoch: Number(parsed.searchParams.get('epoch')), publicKey: state.epochKeyOverride ?? EPOCH_PUBLIC_KEY });
    }
    if (path === '/account/credential/issue' || path === '/account/credential/renew') {
      if (state.issueUnreachable) throw new TypeError('fetch failed');
      if (auth !== `Bearer ${state.session}`) return json(401, { ok: false, reason: 'unauthenticated' });
      if (state.issueRefused) return json(403, { ok: false, reason: 'refused' });
      const blinded = (body as { blindedMessage?: string }).blindedMessage;
      if (typeof blinded !== 'string') return json(400, { ok: false, reason: 'bad_request' });
      // Mirror the real service's range check: a blinded value >= the signer's
      // modulus is bad_request (never a raw-RSA throw masquerading as a network
      // failure). Unreachable when tests order the served key smaller.
      if (BigInt('0x' + Buffer.from(blinded, 'base64').toString('hex')) >= spkiModulus(state.issuer.publicKeySpki)) {
        return json(400, { ok: false, reason: 'bad_request' });
      }
      const payload: Record<string, unknown> = { ok: true, blindSignature: rawBlindSign(blinded, state.issuer.privateKey), epoch: (body as { epoch: number }).epoch };
      if (!state.omitIssueKeyEcho) payload.publicKey = state.issuer.publicKeySpki;
      return json(200, payload);
    }
    if (path === '/account/delete') return json(200, { ok: true, deletionScope: 'account_layer_only', revokedSerial: Boolean((body as { credential?: string }).credential) });
    return json(404, { ok: false, reason: 'not_found' });
  }) as unknown as typeof fetch;
  return { fetchImpl, state };
}

function deps(
  store: AccountSecretStore,
  fetchImpl: typeof fetch,
  opts: { config?: ResolvedAccountConfig; apple?: SsoAdapter; google?: SsoAdapter } = {},
): AccountDeps {
  return {
    config: opts.config ?? CONFIG,
    fetchImpl,
    secretStore: store,
    randomBytes: liveRandom,
    apple: opts.apple ?? okAdapter('apple-id-token'),
    google: opts.google ?? okAdapter('google-id-token'),
    now: () => NOW,
  };
}

function makeDb(): DatabaseAdapter {
  const values = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []) {
      if (String(sql).includes('INSERT OR REPLACE INTO mk_settings')) values.set(String(params[0]), String(params[1]));
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      const value = values.get(String(params[0]));
      return String(sql).includes('SELECT value FROM mk_settings') && value !== undefined ? ([{ value }] as T[]) : [];
    },
    transaction(fn: () => void) { fn(); },
  } as unknown as DatabaseAdapter;
}

const OFF: ResolvedAccountConfig = { configured: false };

// ---------------------------------------------------------------------------
// Config resolution + AC-6 fail-closed.
// ---------------------------------------------------------------------------

describe('config resolution', () => {
  it('is off with no service url, on with one', () => {
    expect(resolveAccountConfigFromEnv({})).toEqual({ configured: false });
    expect(resolveAccountConfigFromEnv({ VITE_MEERKAT_ACCOUNT_SERVICE_URL: 'not-a-url' })).toEqual({ configured: false });
    expect(resolveAccountConfigFromEnv({
      VITE_MEERKAT_ACCOUNT_SERVICE_URL: 'https://account.example/',
      VITE_MEERKAT_APPLE_SERVICE_ID: 'com.example.svc',
    })).toEqual({ configured: true, accountServiceUrl: 'https://account.example', appleServiceId: 'com.example.svc', googleClientId: '' });
  });
});

describe('AC-6 fail-closed when unconfigured', () => {
  it('every operation returns not_configured and fabricates nothing', async () => {
    const store = makeStore();
    const neverFetch = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
    const d = deps(store, neverFetch, { config: OFF });
    expect(isSignedIn(d)).toBe(false);
    expect(await signIn(d, 'apple')).toEqual({ ok: false, reason: 'not_configured' });
    expect(await refreshStatus(d)).toEqual({ ok: false, reason: 'not_configured' });
    expect(await mintCredential(d)).toEqual({ ok: false, reason: 'not_configured' });
    expect(await deleteAccount(d, 'google')).toEqual({ ok: false, reason: 'not_configured' });
    expect(presentCredentialHeader(d)).toBeNull();
  });

  it('an unavailable SSO adapter fails closed with unavailable_in_build', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService();
    const d = deps(store, fetchImpl, { apple: unavailableAdapter() });
    expect(await signIn(d, 'apple')).toEqual({ ok: false, reason: 'unavailable_in_build' });
    expect(isSignedIn(d)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sign-in / status / sign-out.
// ---------------------------------------------------------------------------

describe('sign-in + status', () => {
  it('sign-in stores the session and returns the account summary', async () => {
    const store = makeStore();
    const { fetchImpl, state } = makeService();
    const result = await signIn(deps(store, fetchImpl), 'apple');
    expect(result.ok).toBe(true);
    expect(store.get(SESSION_KEY)).toBe(state.session);
    expect(isSignedIn(deps(store, fetchImpl))).toBe(true);
    if (result.ok) expect(isEntitled(result.account)).toBe(true);
    // sign-in wire body carries provider + idToken (never a device key/persona).
    const seen = state.seen.find((r) => r.path === '/account/sign-in')!;
    expect(seen.body).toEqual({ provider: 'apple', providerToken: 'apple-id-token' });
  });

  it('refreshStatus needs a session and returns the summary', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService();
    expect(await refreshStatus(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'no_session' });
    await signIn(deps(store, fetchImpl), 'apple');
    const status = await refreshStatus(deps(store, fetchImpl));
    expect(status.ok).toBe(true);
  });

  it('sign-out clears the session but keeps the credential', async () => {
    const store = makeStore();
    store.set(SESSION_KEY, 'x');
    store.set(CREDENTIAL_KEY, 'kept');
    await signOut(deps(store, makeService().fetchImpl));
    expect(store.get(SESSION_KEY)).toBeNull();
    expect(store.get(CREDENTIAL_KEY)).toBe('kept');
  });

  it('parseAccountSummary normalizes the flat wire shape (ages, provider, entitlements)', () => {
    expect(parseAccountSummary({ accountId: 'x', provider: 'bad', ageStatus: 'nonsense', entitlements: 'bad' })).toEqual({
      accountId: 'x', provider: null, ageStatus: 'unknown', renewalFlagged: false, entitlements: [],
    });
    expect(parseAccountSummary({
      accountId: 'y', provider: 'google', ageStatus: 'minor', renewalFlagged: true,
      entitlements: [{ product: 'app_unlock', rail: 'play', status: 'weird' }],
    })).toEqual({
      accountId: 'y', provider: 'google', ageStatus: 'store_minor', renewalFlagged: true,
      entitlements: [{ product: 'app_unlock', rail: 'play', status: 'inactive' }],
    });
  });
});

// ---------------------------------------------------------------------------
// AC-1: real blind mint roundtrip.
// ---------------------------------------------------------------------------

describe('AC-1 blind credential mint roundtrip', () => {
  it('mints a verifiable anonymous credential and stores it, clearing pending state', async () => {
    const store = makeStore();
    const { fetchImpl, state } = makeService();
    await signIn(deps(store, fetchImpl), 'apple');
    const result = await mintCredential(deps(store, fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = getStoredCredential(deps(store, fetchImpl));
    expect(stored).not.toBeNull();
    expect(serializeMeerkatCredential(result.credential)).toBe(serializeMeerkatCredential(stored!));
    expect(credentialSerial(result.credential.messageBase64)).toMatch(/^[0-9a-f]{64}$/);
    // Pending mint state was cleared after finalize.
    expect(store.get(PENDING_MINT_KEY)).toBeNull();

    // The epoch-key GET preceded the blinded POST; issue body carries no serial/account.
    const paths = state.seen.map((r) => r.path);
    expect(paths).toContain('/account/credential/epoch-key');
    const issue = state.seen.find((r) => r.path === '/account/credential/issue')!;
    expect(Object.keys(issue.body as object).sort()).toEqual(['blindedMessage', 'epoch']);
  });

  it('mint fails closed (no credential stored) when epoch-key discovery is not configured', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService({ epochKeyConfigured: false });
    await signIn(deps(store, fetchImpl), 'apple');
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'not_configured' });
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
  });

  it('mint is refused when the service refuses, retaining only the protected request', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService({ issueRefused: true });
    await signIn(deps(store, fetchImpl), 'apple');
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'refused' });
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
    expect(store.get(PENDING_MINT_KEY)).not.toBeNull();
  });

  it('mint requires a session', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService();
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'no_session' });
  });

  it('mint fails closed when the epoch-key route serves a different key than the issuer signs under', async () => {
    // The route serves a foreign key; the issuer signs under a different key
    // and echoes it, so the echo cross-check must refuse and store nothing. The
    // served modulus is ordered smaller so rawBlindSign is deterministic.
    const { servedKey, issuer } = orderedMismatchedKeys();
    const store = makeStore();
    const { fetchImpl } = makeService({ epochKeyOverride: servedKey, issuer });
    await signIn(deps(store, fetchImpl), 'apple');
    const result = await mintCredential(deps(store, fetchImpl));
    expect(result.ok).toBe(false);
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
    expect(store.get(PENDING_MINT_KEY)).not.toBeNull();
  });

  it('mint fails closed via finalize-verify when the wrong-key issue response omits the publicKey echo', async () => {
    // No echo to cross-check: the client falls back to the key it blinded under
    // (the served one), unblinds the issuer's signature against it, and the
    // credential must fail verification and store nothing.
    const { servedKey, issuer } = orderedMismatchedKeys();
    const store = makeStore();
    const { fetchImpl } = makeService({ epochKeyOverride: servedKey, issuer, omitIssueKeyEcho: true });
    await signIn(deps(store, fetchImpl), 'apple');
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'store_error' });
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
    expect(store.get(PENDING_MINT_KEY)).not.toBeNull();
  });

  it('a network failure on the issue POST is honest unreachable and retains pending-mint state', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService({ issueUnreachable: true });
    await signIn(deps(store, fetchImpl), 'apple');
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'unreachable' });
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
    expect(store.get(PENDING_MINT_KEY)).not.toBeNull();
  });

  it('mint refuses honestly when the epoch-key route returns a malformed key', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService({ epochKeyOverride: 'not-a-real-spki-key' });
    await signIn(deps(store, fetchImpl), 'apple');
    // parseRsaPublicKeySpki returns null for a malformed key -> honest store_error refusal.
    expect(await mintCredential(deps(store, fetchImpl))).toEqual({ ok: false, reason: 'store_error' });
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Store age signal matrix.
// ---------------------------------------------------------------------------

describe('store age signal -> age gate', () => {
  function summary(ageStatus: AccountSummary['ageStatus']): AccountSummary {
    return { accountId: 'a', provider: 'apple', ageStatus, renewalFlagged: false, entitlements: [] };
  }

  it('adult passes with source store; minor/unknown are no-ops', () => {
    expect(storeAgeSignalFromStatus('store_adult')).toBe('adult');

    const adult = makeDb();
    expect(applyStoreAgeSignal(adult, summary('store_adult'), NOW)).toBe(true);
    const record = readAgeGateRecord(adult);
    expect(record?.status).toBe('passed');
    expect(record?.source).toBe('store');

    const minor = makeDb();
    expect(applyStoreAgeSignal(minor, summary('store_minor'), NOW)).toBe(false);
    expect(isAgeGatePassed(minor)).toBe(false);
    expect(isAgeGateLocked(minor)).toBe(false);

    const unknown = makeDb();
    expect(applyStoreAgeSignal(unknown, summary('unknown'), NOW)).toBe(false);
    expect(isAgeGatePassed(unknown)).toBe(false);
  });

  it('never overwrites a locked record (a store signal cannot unlock)', () => {
    const db = makeDb();
    db.execute('INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)', [
      'meerkat_age_gate_v1',
      JSON.stringify({ version: 1, status: 'locked', at: new Date(NOW).toISOString(), minimumAge: 13, source: 'device' }),
    ]);
    expect(isAgeGateLocked(db)).toBe(true);
    expect(applyStoreAgeSignal(db, summary('store_adult'), NOW)).toBe(false);
    expect(isAgeGateLocked(db)).toBe(true);
  });

  it('a second store pass is a no-op once already passed', () => {
    const db = makeDb();
    expect(applyStoreAgeSignal(db, summary('store_adult'), NOW)).toBe(true);
    expect(applyStoreAgeSignal(db, summary('store_adult'), NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Presentation header attach/absent.
// ---------------------------------------------------------------------------

describe('credential presentation header', () => {
  it('attaches x-mk-credential only when a credential is stored, with no account data', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService();
    expect(presentCredentialHeader(deps(store, fetchImpl))).toBeNull();

    await signIn(deps(store, fetchImpl), 'apple');
    await mintCredential(deps(store, fetchImpl));
    const header = presentCredentialHeader(deps(store, fetchImpl));
    expect(header).not.toBeNull();
    expect(Object.keys(header!)).toEqual(['x-mk-credential']);
    expect(header!['x-mk-credential']).not.toContain('session-bearer');
    expect(parseMeerkatCredential(header!['x-mk-credential']!)).not.toBeNull();
  });

  it('drops a credential whose epoch window has fully passed (never sends a stale header)', async () => {
    const store = makeStore();
    const { fetchImpl } = makeService();
    await signIn(deps(store, fetchImpl), 'apple');
    await mintCredential(deps(store, fetchImpl));
    const wayLater = credentialEpochWindow(EPOCH).notAfterMs + 1;
    expect(presentCredentialHeader(deps(store, fetchImpl), wayLater)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Deletion.
// ---------------------------------------------------------------------------

describe('account deletion', () => {
  it('re-auths via SSO and clears local secrets without submitting a public pass', async () => {
    const store = makeStore();
    const { fetchImpl, state } = makeService();
    await signIn(deps(store, fetchImpl), 'apple');
    await mintCredential(deps(store, fetchImpl));
    expect(store.get(CREDENTIAL_KEY)).not.toBeNull();

    const result = await deleteAccount(deps(store, fetchImpl), 'apple');
    // A public credential must never accompany account deletion.
    expect(result).toEqual({ ok: true, deletionScope: 'account_layer_only', revokedSerial: false });
    expect(store.get(SESSION_KEY)).toBeNull();
    expect(store.get(CREDENTIAL_KEY)).toBeNull();
    expect(store.get(PENDING_MINT_KEY)).toBeNull();
    // The delete request re-authed with the provider token (NOT the session bearer)
    // and does not carry a public pass.
    const del = state.seen.find((r) => r.path === '/account/delete')!;
    expect(del.auth).toBeNull();
    expect((del.body as Record<string, unknown>).providerToken).toBe('apple-id-token');
    expect(Object.keys(del.body as Record<string, unknown>).sort()).toEqual(['provider', 'providerToken']);
  });
});

// ---------------------------------------------------------------------------
// Redirect-based OAuth adapter (CSP-safe: no third-party scripts). Drives the
// real redirectAdapter through a fake OAuthBrowserEnv end to end.
// ---------------------------------------------------------------------------

function makeOAuthEnv(): OAuthBrowserEnv & { hash: string; assigned: string | null; seq: number } {
  const storage = new Map<string, string>();
  const env = {
    hash: '',
    assigned: null as string | null,
    seq: 0,
    getHash: () => env.hash,
    redirectUri: () => 'https://app.example/',
    assign: (url: string) => { env.assigned = url; },
    clearHash: () => { env.hash = ''; },
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v); },
    removeItem: (k: string) => { storage.delete(k); },
    // Deterministic distinct tokens (nonce then state per attempt).
    randomToken: () => `tok${env.seq++}`,
  };
  return env;
}

/** Build an unsigned JWT carrying the given claims (the account service verifies the
 *  signature server-side; the client only reads the nonce for replay protection). */
function fakeJwt(claims: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'none' })}.${b64url(claims)}.sig`;
}

describe('redirect-based OAuth adapter', () => {
  it('starts a redirect to the provider authorize endpoint with response_type=id_token + nonce + state', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('google', 'client-123', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
    const result = await adapter.signIn();
    expect(result).toEqual({ ok: false, reason: 'redirecting' });
    expect(env.assigned).not.toBeNull();
    const url = new URL(env.assigned!);
    expect(url.origin + url.pathname).toBe(GOOGLE_AUTH_ENDPOINT);
    expect(url.searchParams.get('response_type')).toBe('id_token');
    expect(url.searchParams.get('response_mode')).toBe('fragment');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/');
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    // The pending attempt is persisted for the callback round-trip.
    expect(env.getItem('meerkat.account.oauth.google')).toContain(url.searchParams.get('state')!);
  });

  it('consumes a valid callback (state + nonce match) and returns the id_token', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('apple', 'svc-abc', APPLE_AUTH_ENDPOINT, 'fragment', env);
    await adapter.signIn();
    const url = new URL(env.assigned!);
    const nonce = url.searchParams.get('nonce')!;
    const state = url.searchParams.get('state')!;
    const idToken = fakeJwt({ nonce, sub: 'apple-sub' });
    env.hash = `id_token=${idToken}&state=${state}`;
    const result = await adapter.signIn();
    expect(result).toEqual({ ok: true, idToken });
    // The fragment + pending attempt are cleared after consumption.
    expect(env.hash).toBe('');
    expect(env.getItem('meerkat.account.oauth.apple')).toBeNull();
  });

  it('rejects a callback with a mismatched state', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('google', 'client-123', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
    await adapter.signIn();
    const nonce = new URL(env.assigned!).searchParams.get('nonce')!;
    env.hash = `id_token=${fakeJwt({ nonce })}&state=WRONG`;
    expect(await adapter.signIn()).toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('rejects a callback whose id_token nonce does not match the stored attempt (replay guard)', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('google', 'client-123', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
    await adapter.signIn();
    const state = new URL(env.assigned!).searchParams.get('state')!;
    env.hash = `id_token=${fakeJwt({ nonce: 'attacker-nonce' })}&state=${state}`;
    expect(await adapter.signIn()).toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('surfaces a provider error callback honestly and never a fabricated token', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('apple', 'svc-abc', APPLE_AUTH_ENDPOINT, 'fragment', env);
    await adapter.signIn();
    const state = new URL(env.assigned!).searchParams.get('state')!;
    env.hash = `error=access_denied&state=${state}`;
    expect(await adapter.signIn()).toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('an unconfigured provider is not_configured and never redirects', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('google', '', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
    expect(await adapter.signIn()).toEqual({ ok: false, reason: 'not_configured' });
    expect(env.assigned).toBeNull();
  });

  it('pendingSsoCallbackProvider detects a stored attempt with a callback fragment', async () => {
    const env = makeOAuthEnv();
    const adapter = redirectAdapter('google', 'client-123', GOOGLE_AUTH_ENDPOINT, 'fragment', env);
    expect(pendingSsoCallbackProvider(env)).toBeNull();
    await adapter.signIn();
    const state = new URL(env.assigned!).searchParams.get('state')!;
    env.hash = `id_token=${fakeJwt({ nonce: 'x' })}&state=${state}`;
    expect(pendingSsoCallbackProvider(env)).toBe('google');
  });
});

// ---------------------------------------------------------------------------
// AC-4: private-mesh modules never import account.ts.
// ---------------------------------------------------------------------------

describe('AC-4 private mesh never imports the account layer', () => {
  it('no private-mesh module imports ./account', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const libDir = resolvePath(here, '..');
    const privateMeshModules = [
      'MeerkatProvider.tsx',
      'dm-core.ts',
      'dm-provider-core.ts',
      'community-list-core.ts',
      'community-safety.ts',
      'auto-connect-core.ts',
      'browser-sync-init.ts',
      'add-friend-core.ts',
      'personal-workspace.ts',
    ];
    for (const file of privateMeshModules) {
      let source: string;
      try {
        source = readFileSync(join(libDir, file), 'utf8');
      } catch {
        continue; // a module that does not exist here is vacuously fine
      }
      expect(source, `${file} must not import ./account`).not.toMatch(/from ['"]\.\/account['"]/);
      expect(source, `${file} must not import ../account`).not.toMatch(/from ['"]\.\.\/account['"]/);
    }
  });
});

function makeRecoveryDeps(overrides: Partial<AccountDeps> = {}) {
  const store = makeStore();
  const { fetchImpl, state } = makeService();
  return {
    deps: { ...deps(store, fetchImpl), ...overrides },
    secretMap: store.map,
    service: {
      get sentBodies() { return state.seen.filter((row) => row.body !== undefined).map((row) => JSON.stringify(row.body)); },
      set session(value: string) { state.session = value; },
      get issueUnreachable() { return state.issueUnreachable; },
      set issueUnreachable(value: boolean) { state.issueUnreachable = value; },
    },
  };
}

describe('recoverable mint request', () => {
  it('does not submit even a recovered request until its vault flush succeeds', async () => {
    const { deps: d, service, secretMap } = makeRecoveryDeps();
    await signIn(d, 'apple');
    let fail = true;
    d.secretStore.flush = async () => { if (fail) throw new Error('Quota exceeded'); };
    expect(await mintCredential(d)).toEqual({ ok: false, reason: 'store_error' });
    const pending = secretMap.get(PENDING_MINT_KEY);
    expect(pending).toBeTruthy();
    expect(await mintCredential(d)).toEqual({ ok: false, reason: 'store_error' });
    expect(secretMap.get(PENDING_MINT_KEY)).toBe(pending);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(0);
    fail = false;
    expect((await mintCredential(d)).ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('does not report a durable pass or delete its request before the credential flush succeeds', async () => {
    const { deps: d, service, secretMap } = makeRecoveryDeps();
    await signIn(d, 'apple');
    let fail = true;
    const durable = new Map<string, string>();
    d.secretStore.flush = async () => {
      if (secretMap.has(CREDENTIAL_KEY) && fail) throw new Error('Quota exceeded');
      durable.clear();
      for (const [key, value] of secretMap) durable.set(key, value);
    };
    expect(await mintCredential(d)).toEqual({ ok: false, reason: 'store_error' });
    expect(durable.has(CREDENTIAL_KEY)).toBe(false);
    expect(durable.has(PENDING_MINT_KEY)).toBe(true);
    expect(await mintCredential(d)).toEqual({ ok: false, reason: 'store_error' });
    expect(secretMap.has(PENDING_MINT_KEY)).toBe(true);
    fail = false;
    expect((await mintCredential(d)).ok).toBe(true);
    expect(durable.has(CREDENTIAL_KEY)).toBe(true);
    expect(durable.has(PENDING_MINT_KEY)).toBe(false);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('recovers completed scratch after cleanup failure without consuming another mint', async () => {
    const { deps, service, secretMap } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let failCleanup = true;
    deps.secretStore = { ...store, delete(key) {
      if (key === 'securestore://meerkat.account.pending_mint' && failCleanup) throw new Error('Cleanup failed');
      store.delete(key);
    } };
    const first = await mintCredential(deps);
    expect(first.ok).toBe(true);
    expect(secretMap.has('securestore://meerkat.account.pending_mint')).toBe(true);
    failCleanup = false;
    service.session = 'new-session';
    secretMap.set('securestore://meerkat.account.session', 'new-session');
    expect(await mintCredential(deps)).toEqual(first);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
    expect(secretMap.has('securestore://meerkat.account.pending_mint')).toBe(false);
  });

  it('can renew after completed mint cleanup failed, retaining scratch while deletion still fails', async () => {
    const epoch = credentialEpochAt(Date.now());
    const { deps, service, secretMap } = makeRecoveryDeps({
      now: () => credentialEpochWindow(epoch + 1).notBeforeMs - 60_000,
    });
    const { renewIfInWindow } = await import('../account');
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let failCleanup = true;
    deps.secretStore = { ...store, delete(key) {
      if (key === 'securestore://meerkat.account.pending_mint' && failCleanup) throw new Error('Cleanup failed');
      store.delete(key);
    } };
    expect((await mintCredential(deps)).ok).toBe(true);
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    expect(await renewIfInWindow(deps)).toEqual({ ok: false, reason: 'store_error' });
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
    failCleanup = false;
    expect((await renewIfInWindow(deps)).ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(2);
  });

  it('does not overwrite an in-flight request after the session changes', async () => {
    const { deps, service, secretMap } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const fetch = deps.fetchImpl;
    let keyRequests = 0;
    deps.fetchImpl = async (url, init) => {
      if (String(url).includes('/epoch-key') && ++keyRequests === 1) { entered(); await blocked; }
      return fetch(url, init);
    };
    const first = mintCredential(deps);
    await started;
    secretMap.set('securestore://meerkat.account.session', 'new-session');
    try {
      expect(await mintCredential({ ...deps })).toEqual({ ok: false, reason: 'mint_recovery_required' });
    } finally { release(); }
    expect((await first).ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('replays exactly the same protected request after a lost response', async () => {
    const { deps, service, secretMap } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    const fetch = deps.fetchImpl;
    let loseResponse = true;
    deps.fetchImpl = async (url, init) => {
      const response = await fetch(url, init);
      if (String(url).endsWith('/account/credential/issue') && loseResponse) {
        loseResponse = false;
        throw new TypeError('Response lost after signing');
      }
      return response;
    };
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'unreachable' });
    expect(await getStoredCredential(deps)).toBeNull();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    expect(pending).toBeTruthy();
    const retry = await mintCredential({ ...deps });
    expect(retry.ok).toBe(true);
    const posts = service.sentBodies.filter((body) => body.includes('blindedMessage'));
    expect(posts).toHaveLength(2);
    expect(posts[0]).toBe(posts[1]);
    expect(secretMap.has('securestore://meerkat.account.pending_mint')).toBe(false);
  });

  it('keeps the only mint state until the credential write succeeds', async () => {
    const { deps, service, secretMap } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let fail = true;
    deps.secretStore = { ...store, set(key, value) {
      if (key === 'securestore://meerkat.account.credential' && fail) throw new Error('Keychain write failed');
      store.set(key, value);
    } };
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'store_error' });
    expect(await getStoredCredential(deps)).toBeNull();
    expect(secretMap.has('securestore://meerkat.account.pending_mint')).toBe(true);
    fail = false;
    expect((await mintCredential(deps)).ok).toBe(true);
    const posts = service.sentBodies.filter((body) => body.includes('blindedMessage'));
    expect(posts[0]).toBe(posts[1]);
  });

  it('coalesces overlapping mint calls into one request', async () => {
    const { deps, service } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    const results = await Promise.all([mintCredential(deps), mintCredential({ ...deps })]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('uses only recovery for an unaccepted request after a session change', async () => {
    const { deps, service, secretMap } = makeRecoveryDeps();
    await signIn(deps, 'apple');
    service.issueUnreachable = true;
    await mintCredential(deps);
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    const count = service.sentBodies.length;
    service.session = 'different-session';
    secretMap.set('securestore://meerkat.account.session', 'different-session');
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(service.sentBodies).toHaveLength(count + 1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
  });
});


describe('credential period transition', () => {
  it('keeps the current pass until the new pass is valid, switches at the boundary and expires honestly', async () => {
    const epoch = credentialEpochAt(Date.now());
    const boundary = credentialEpochWindow(epoch + 1).notBeforeMs;
    let now = boundary - 3 * 24 * 60 * 60 * 1000;
    const { deps, service } = makeRecoveryDeps({ now: () => now });
    const { renewIfInWindow, getStoredCredentialState } = await import('../account');
    await signIn(deps, 'apple');
    const first = await mintCredential(deps);
    if (!first.ok) throw new Error('mint failed');
    const next = await renewIfInWindow(deps);
    if (!next.ok) throw new Error('renewal failed');
    const count = service.sentBodies.length;
    expect(await renewIfInWindow(deps)).toEqual(next);
    expect(service.sentBodies).toHaveLength(count);
    const current = parseMeerkatCredential((await presentCredentialHeader(deps))!['x-mk-credential'])!;
    expect(current).toEqual(first.credential);
    expect(verifyBlindCredential(current, EPOCH_PUBLIC_KEY, now)).toBe('ok');
    expect(await getStoredCredentialState(deps)).toBe('active');
    now = boundary;
    const switched = parseMeerkatCredential((await presentCredentialHeader(deps))!['x-mk-credential'])!;
    expect(switched).toEqual(next.credential);
    expect(verifyBlindCredential(switched, EPOCH_PUBLIC_KEY, now)).toBe('ok');
    const wire = JSON.parse(Buffer.from((await presentCredentialHeader(deps))!['x-mk-credential'], 'base64url').toString('utf8'));
    expect(Object.keys(wire).sort()).toEqual(['epoch', 'messageBase64', 'signatureBase64', 'version']);
    now = credentialEpochWindow(epoch + 1).notAfterMs + 1;
    expect(await presentCredentialHeader(deps)).toBeNull();
    expect(await getStoredCredentialState(deps)).toBe('expired');
  });

  it('does not present a legacy future-only pass before its validity window', async () => {
    const epoch = credentialEpochAt(Date.now());
    const boundary = credentialEpochWindow(epoch + 1).notBeforeMs;
    const { deps, secretMap } = makeRecoveryDeps({ now: () => boundary - 60_000 });
    const { renewIfInWindow, getStoredCredentialState } = await import('../account');
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const next = await renewIfInWindow(deps);
    if (!next.ok) throw new Error('renewal failed');
    secretMap.set('securestore://meerkat.account.credential', JSON.stringify(next.credential));
    expect(await getStoredCredentialState(deps)).toBe('scheduled');
    expect(await presentCredentialHeader(deps)).toBeNull();
  });
});


describe('account copy parity', () => {
  it('keeps pass validity, recovery and deletion boundaries aligned with mobile', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const web = readFileSync(resolvePath(here, '../account.ts'), 'utf8');
    const mobile = readFileSync(resolvePath(here, '../../../../meerkat/app/(root)/data/account-core.ts'), 'utf8');
    for (const name of ['ACCOUNT_COPY', 'ACCOUNT_DELETE_COPY']) {
      const block = (source: string) => source.slice(source.indexOf(`export const ${name} = {`)).split('} as const;')[0];
      expect(block(web)).toBe(block(mobile));
    }
  });
});


describe('session-rotation recovery', () => {
  async function interrupted() {
    const fixture = makeRecoveryDeps();
    const { deps, secretMap } = fixture;
    await signIn(deps, 'apple');
    const originalFetch = deps.fetchImpl;
    const posts: Array<{ path: string; body: Record<string, unknown>; authorization: string | null }> = [];
    let signed: unknown;
    let loseResponse = true;
    deps.fetchImpl = async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (init?.method === 'POST') posts.push({ path, body: JSON.parse(String(init.body)) as Record<string, unknown>,
        authorization: new Headers(init.headers).get('authorization') });
      if (path === '/account/credential/recover') return new Response(JSON.stringify(signed), { status: 200 });
      const result = await originalFetch(url, init);
      if (path === '/account/credential/issue' && loseResponse) {
        signed = await result.json();
        loseResponse = false;
        throw new TypeError('lost response');
      }
      return result;
    };
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'unreachable' });
    fixture.service.session = 'replacement-session';
    secretMap.set('securestore://meerkat.account.session', 'replacement-session');
    return { ...fixture, posts };
  }

  it('recovers a lost response after sign-in without sending secrets or making another issue request', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = JSON.parse(secretMap.get('securestore://meerkat.account.pending_mint')!) as {
      state: { blindBase64: string; messageBase64: string }; blindedMessageBase64: string;
    };
    const result = await mintCredential(deps);
    expect(result.ok).toBe(true);
    expect(posts.map((post) => post.path)).toEqual(['/account/credential/issue', '/account/credential/recover']);
    expect(posts[1]!.authorization).toBe('Bearer replacement-session');
    expect(Object.keys(posts[1]!.body).sort()).toEqual(['blindedMessage', 'epoch']);
    expect(posts[1]!.body.blindedMessage).toBe(pending.blindedMessageBase64);
    expect(JSON.stringify(posts)).not.toContain(pending.state.blindBase64);
    expect(JSON.stringify(posts)).not.toContain(pending.state.messageBase64);
    expect(secretMap.has('securestore://meerkat.account.pending_mint')).toBe(false);
  });

  it('never sends the pending request under a different account', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    deps.fetchImpl = async (url, init) => String(url).endsWith('/account/status')
      ? new Response(JSON.stringify({ ok: true, accountId: 'different-account' }), { status: 200 }) : fetch(url, init);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
  });

  it('fails closed when recovery cannot verify the current account', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    for (const response of [
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
      new Response(JSON.stringify({ ok: true, accountId: 'ignored' }), { status: 401 }),
    ]) {
      deps.fetchImpl = async (url, init) => String(url).endsWith('/account/status') ? response : fetch(url, init);
      expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'refused' });
    }
    expect(posts).toHaveLength(1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
  });

  it('retains the request when the original account record cannot be recovered', async () => {
    const { deps, secretMap } = await interrupted();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    deps.fetchImpl = async (url, init) => String(url).endsWith('/account/credential/recover')
      ? new Response(JSON.stringify({ ok: false, reason: 'refused' }), { status: 403 }) : fetch(url, init);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
    expect(await getStoredCredential(deps)).toBeNull();
  });

  it('does not replay a pending request to a changed service even if its public key matches', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    const changed = { ...deps, config: { ...deps.config, accountServiceUrl: 'https://other.example.test' } };
    expect(await mintCredential(changed)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
  });

  it('flushes the browser vault before submitting session-rotation recovery', async () => {
    const { deps, posts, secretMap } = await interrupted();
    const pending = secretMap.get('securestore://meerkat.account.pending_mint');
    deps.secretStore.flush = async () => { throw new Error('vault unavailable'); };
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'store_error' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
  });

  it('retains legacy pending requests whose original service cannot be established after sign-in', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = JSON.parse(secretMap.get('securestore://meerkat.account.pending_mint')!) as Record<string, unknown>;
    pending.version = 2;
    delete pending.serviceHash;
    const legacy = JSON.stringify(pending);
    secretMap.set('securestore://meerkat.account.pending_mint', legacy);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(legacy);
  });
});


it('recovers a lost renewal through the replay-only route after the period changes', async () => {
  const { renewIfInWindow } = await import('../account');
  const { deps, secretMap, service } = makeRecoveryDeps();
  const epoch = credentialEpochAt(deps.now());
  await signIn(deps, 'apple');
  expect((await mintCredential(deps)).ok).toBe(true);
  deps.now = () => credentialEpochWindow(epoch + 1).notBeforeMs - 60_000;
  const fetch = deps.fetchImpl;
  let signed: unknown;
  let recoveryBody: Record<string, unknown> | null = null;
  deps.fetchImpl = async (url, init) => {
    if (String(url).endsWith('/account/credential/recover')) {
      recoveryBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(signed), { status: 200 });
    }
    const result = await fetch(url, init);
    if (String(url).endsWith('/account/credential/renew')) {
      signed = await result.json();
      throw new TypeError('renewal response lost');
    }
    return result;
  };
  expect(await renewIfInWindow(deps)).toEqual({ ok: false, reason: 'unreachable' });
  deps.now = () => credentialEpochWindow(epoch + 1).notBeforeMs + 1000;
  service.session = 'replacement-session';
  secretMap.set('securestore://meerkat.account.session', 'replacement-session');
  const recovered = await mintCredential(deps);
  expect(recovered.ok).toBe(true);
  if (!recovered.ok) throw new Error('recovery failed');
  expect(recovered.credential.epoch).toBe(epoch + 1);
  expect(Object.keys(recoveryBody!).sort()).toEqual(['blindedMessage', 'epoch']);
});

it('does not clean up a finished request under a changed account server', async () => {
  const { deps, secretMap } = makeRecoveryDeps();
  await signIn(deps, 'apple');
  const store = deps.secretStore;
  deps.secretStore = { ...store, delete(key) {
    if (key === 'securestore://meerkat.account.pending_mint') throw new Error('cleanup failed');
    return store.delete(key);
  } };
  expect((await mintCredential(deps)).ok).toBe(true);
  const pending = secretMap.get('securestore://meerkat.account.pending_mint');
  const changed = { ...deps, config: { ...deps.config, accountServiceUrl: 'https://other.example.test' } };
  expect(await mintCredential(changed)).toEqual({ ok: false, reason: 'mint_recovery_required' });
  expect(secretMap.get('securestore://meerkat.account.pending_mint')).toBe(pending);
});


it('does not offer pass minting for an expired or malformed entitlement', () => {
  const account: AccountSummary = { accountId: 'fixture', provider: 'apple', ageStatus: 'unknown', renewalFlagged: false,
    entitlements: [{ product: 'app_unlock', rail: 'apple', status: 'active' }] };
  const now = Date.UTC(2026, 8, 5);
  expect(isEntitled(account, now)).toBe(true);
  for (const validUntil of ['', 'invalid', new Date(now - 1).toISOString(), new Date(now).toISOString()]) {
    expect(isEntitled({ ...account, entitlements: [{ ...account.entitlements[0]!, validUntil }] }, now)).toBe(false);
  }
  expect(isEntitled({ ...account, entitlements: [{ ...account.entitlements[0]!, validUntil: new Date(now + 1).toISOString() }] }, now)).toBe(true);
  expect(isEntitled(account, NaN)).toBe(false);
});
