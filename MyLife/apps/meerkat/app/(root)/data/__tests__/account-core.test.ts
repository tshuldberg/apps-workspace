import { describe, expect, it } from 'vitest';
import { constants, generateKeyPairSync, privateDecrypt, randomBytes as nodeRandomBytes } from 'node:crypto';
import type { DatabaseAdapter } from '@mylife/db';
import {
  AGE_GATE_SETTING_KEY,
  CREDENTIAL_MODULUS_BYTES,
  credentialEpochAt,
  credentialEpochWindow,
  credentialSerial,
  encodeAgeGateRecord,
  parseMeerkatCredential,
  verifyBlindCredential,
  type MeerkatCredential,
} from '@mylife/sync';
import { getSetting, setSetting } from '../db';
import { readAgeGateRecord } from '../age-gate';
import {
  applyStoreAgeSignal,
  deleteAccount,
  getStoredCredential,
  isEntitled,
  isSignedIn,
  mintCredential,
  presentCredentialHeader,
  refreshStatus,
  resolveAccountConfigFromExtra,
  signIn,
  signOut,
  type AccountConfig,
  type AccountDeps,
  type AccountSummary,
  type SsoAdapter,
} from '../account-core';

// ---------------------------------------------------------------------------
// Real RSA-backed fake account service (so finalize truly verifies), fake secure
// store, fake SSO adapters, and a URL-routing fetch. Mirrors the packages/sync
// blind-credential.test.ts raw-sign pattern.
// ---------------------------------------------------------------------------

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const publicKeySpkiDerBase64 = keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

function rawBlindSign(blindedMessageBase64: string): string {
  const blinded = Buffer.from(blindedMessageBase64, 'base64');
  const signed = privateDecrypt({ key: keyPair.privateKey, padding: constants.RSA_NO_PADDING }, blinded);
  const padded = Buffer.alloc(CREDENTIAL_MODULUS_BYTES);
  signed.copy(padded, CREDENTIAL_MODULUS_BYTES - signed.length);
  return padded.toString('base64');
}

const liveRandom = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

const SERVICE_URL = 'https://accounts.example.test';
const CONFIGURED: AccountConfig = {
  configured: true,
  accountServiceUrl: SERVICE_URL,
  appleServiceId: 'com.mylife.meerkat.svc',
  googleClientId: 'google-client-id',
};

const SAMPLE_ACCOUNT: AccountSummary = {
  accountId: 'acct-123',
  provider: 'apple',
  ageStatus: 'store_adult',
  renewalFlagged: false,
  entitlements: [{ product: 'meerkat_app_unlock', rail: 'storekit', status: 'active' }],
};

function fakeSecretStore(): { store: AccountDeps['secretStore']; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    store: {
      async get(key) {
        return map.has(key) ? map.get(key)! : null;
      },
      async set(key, value) {
        map.set(key, value);
      },
      async delete(key) {
        map.delete(key);
      },
    },
  };
}

function fakeSso(idToken: string): SsoAdapter {
  return { async signIn() { return { ok: true, idToken }; } };
}

function unavailableSso(): SsoAdapter {
  return { async signIn() { return { ok: false, reason: 'unavailable_in_build' }; } };
}

interface ServiceState {
  session: string;
  account: AccountSummary;
  /** Every request body the client sent (to assert what crosses the wire). */
  sentBodies: string[];
  /** Force renew to answer with a flagged/refused verdict. */
  refuseRenewal?: boolean;
  /** Serve a malformed epoch key from the discovery route (sanity-check path). */
  malformedEpochKey?: boolean;
  /** Echo a DIFFERENT key on the issue response than the discovery route served. */
  mismatchedIssueKey?: string;
  /** Reject the issue POST at the network layer (fetch throws). */
  issueUnreachable?: boolean;
  /** Report that this SSO subject was deleted during the current pass period. */
  signInDeleted?: boolean;
}

function fakeService(state: ServiceState): typeof fetch {
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    if (bodyText) state.sentBodies.push(bodyText);
    const json = (obj: unknown, status = 200): Response =>
      ({ ok: status === 200, status, json: async () => obj } as unknown as Response);

    if (url.endsWith('/account/sign-in')) {
      if (state.signInDeleted) return json({ ok: false, reason: 'account_deleted' }, 403);
      // Wire contract: flat { token, expiresAtMs, accountId }.
      return json({ ok: true, token: state.session, expiresAtMs: Date.now() + 3_600_000, accountId: state.account.accountId });
    }
    if (url.endsWith('/account/status')) {
      // Wire contract: flat account fields (not nested under `account`).
      return json({ ok: true, ...state.account });
    }
    if (url.includes('/account/credential/epoch-key')) {
      if (state.malformedEpochKey) return json({ ok: true, publicKey: 'not-a-valid-spki-key', epoch: 0 });
      return json({ ok: true, publicKey: publicKeySpkiDerBase64, epoch: 0 });
    }
    if (url.endsWith('/account/credential/issue')) {
      if (state.issueUnreachable) throw new TypeError('Network request failed');
      const parsed = JSON.parse(bodyText) as { blindedMessage: string };
      return json({
        ok: true,
        blindSignature: rawBlindSign(parsed.blindedMessage),
        publicKey: state.mismatchedIssueKey ?? publicKeySpkiDerBase64,
        epoch: 0,
      });
    }
    if (url.endsWith('/account/credential/renew')) {
      // Wire contract: a flagged account is refused with HTTP 403.
      if (state.refuseRenewal) return json({ ok: false, reason: 'refused' }, 403);
      const parsed = JSON.parse(bodyText) as { blindedMessage: string };
      return json({ ok: true, blindSignature: rawBlindSign(parsed.blindedMessage), publicKey: publicKeySpkiDerBase64, epoch: 0 });
    }
    if (url.endsWith('/account/delete')) {
      return json({ ok: true, deletionScope: 'account_layer_only', revokedSerial: bodyText.includes('credential') });
    }
    return json({ ok: false, reason: 'not_found' }, 404);
  };
  return impl as unknown as typeof fetch;
}

function makeDeps(overrides: Partial<AccountDeps> = {}, serviceState?: ServiceState): {
  deps: AccountDeps;
  secretMap: Map<string, string>;
  service: ServiceState;
} {
  const { store, map } = fakeSecretStore();
  const service: ServiceState = serviceState ?? {
    session: 'session-bearer-abc',
    account: SAMPLE_ACCOUNT,
    sentBodies: [],
  };
  const epochNowMs = credentialEpochWindow(credentialEpochAt(Date.now())).notBeforeMs + 1000;
  const deps: AccountDeps = {
    config: CONFIGURED,
    fetchImpl: fakeService(service),
    secretStore: store,
    randomBytes: liveRandom,
    apple: fakeSso('apple-id-token'),
    google: fakeSso('google-id-token'),
    now: () => epochNowMs,
    ...overrides,
  };
  return { deps, secretMap: map, service };
}

const UNCONFIGURED_DEPS = (): AccountDeps => ({
  config: { configured: false },
  fetchImpl: (async () => { throw new Error('no network when unconfigured'); }) as unknown as typeof fetch,
  secretStore: fakeSecretStore().store,
  randomBytes: liveRandom,
  apple: unavailableSso(),
  google: unavailableSso(),
  now: () => Date.now(),
});

function makeSettingsDb(): DatabaseAdapter {
  const values = new Map<string, string>();
  return {
    execute(sql, params = []) {
      if (String(sql).includes('INSERT OR REPLACE INTO mk_settings')) values.set(String(params[0]), String(params[1]));
      else if (String(sql).includes('DELETE FROM mk_settings')) values.delete(String(params[0]));
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      const value = values.get(String(params[0]));
      return String(sql).includes('SELECT value FROM mk_settings') && value !== undefined
        ? ([{ value }] as T[])
        : [];
    },
    transaction(fn) { fn(); },
  };
}

// ---------------------------------------------------------------------------

describe('account-core config resolution', () => {
  it('is unconfigured when no account service url is set', () => {
    expect(resolveAccountConfigFromExtra({})).toEqual({ configured: false });
    expect(resolveAccountConfigFromExtra({ accountServiceUrl: '' })).toEqual({ configured: false });
    expect(resolveAccountConfigFromExtra({ accountServiceUrl: 'not-a-url' })).toEqual({ configured: false });
  });

  it('resolves + trims a configured url and provider ids', () => {
    const resolved = resolveAccountConfigFromExtra({
      accountServiceUrl: 'https://accounts.test/',
      appleServiceId: ' svc ',
      googleClientId: 'gid',
    });
    expect(resolved).toEqual({
      configured: true,
      accountServiceUrl: 'https://accounts.test',
      appleServiceId: 'svc',
      googleClientId: 'gid',
    });
  });
});

describe('account-core fail-closed when unconfigured (AC-6)', () => {
  it('every operation returns not_configured and stores nothing', async () => {
    const deps = UNCONFIGURED_DEPS();
    expect(await isSignedIn(deps)).toBe(false);
    expect(await signIn(deps, 'apple')).toEqual({ ok: false, reason: 'not_configured' });
    expect(await refreshStatus(deps)).toEqual({ ok: false, reason: 'not_configured' });
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'not_configured' });
    expect(await deleteAccount(deps, 'apple')).toEqual({ ok: false, reason: 'not_configured' });
    expect(await presentCredentialHeader(deps)).toBeNull();
    expect(await getStoredCredential(deps)).toBeNull();
  });
});

describe('account-core sign-in', () => {
  it('stores the session bearer and returns the account summary', async () => {
    const { deps, secretMap } = makeDeps();
    const result = await signIn(deps, 'apple');
    expect(result.ok).toBe(true);
    if (result.ok) expect(isEntitled(result.account)).toBe(true);
    expect(secretMap.get('meerkat.account.session')).toBe('session-bearer-abc');
    expect(await isSignedIn(deps)).toBe(true);
  });

  it('surfaces an unavailable provider honestly and stores nothing', async () => {
    const { deps, secretMap } = makeDeps({ apple: unavailableSso() });
    expect(await signIn(deps, 'apple')).toEqual({ ok: false, reason: 'unavailable_in_build' });
    expect(secretMap.size).toBe(0);
  });

  it('surfaces an epoch-bounded deleted-account refusal honestly', async () => {
    const service: ServiceState = {
      session: 's',
      account: SAMPLE_ACCOUNT,
      sentBodies: [],
      signInDeleted: true,
    };
    const { deps, secretMap } = makeDeps({}, service);

    expect(await signIn(deps, 'apple')).toEqual({ ok: false, reason: 'account_deleted' });
    expect(secretMap.size).toBe(0);
  });

  it('sign-out clears only the session, keeping the anonymous credential', async () => {
    const { deps, secretMap } = makeDeps();
    await signIn(deps, 'google');
    await mintCredential(deps);
    expect(secretMap.has('meerkat.account.credential')).toBe(true);
    await signOut(deps);
    expect(secretMap.has('meerkat.account.session')).toBe(false);
    expect(secretMap.has('meerkat.account.credential')).toBe(true);
  });
});

describe('account-core blind credential mint (AC-1)', () => {
  it('mints a credential that verifies under the epoch key', async () => {
    const { deps } = makeDeps();
    await signIn(deps, 'apple');
    const result = await mintCredential(deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const now = deps.now();
    expect(verifyBlindCredential(result.credential, publicKeySpkiDerBase64, now)).toBe('ok');
    const stored = await getStoredCredential(deps);
    expect(stored).not.toBeNull();
    expect(verifyBlindCredential(stored as MeerkatCredential, publicKeySpkiDerBase64, now)).toBe('ok');
  });

  it('never sends the token message or serial to the service on issuance (the wall)', async () => {
    const { deps, service } = makeDeps();
    await signIn(deps, 'apple');
    const result = await mintCredential(deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = (await getStoredCredential(deps)) as MeerkatCredential;
    const serial = credentialSerial(stored.messageBase64);
    expect(serial).not.toBeNull();
    for (const body of service.sentBodies) {
      expect(body).not.toContain(stored.messageBase64);
      expect(body).not.toContain(stored.signatureBase64);
      expect(body).not.toContain(serial as string);
    }
  });

  it('clears the pending-mint scratch after a successful mint', async () => {
    const { deps, secretMap } = makeDeps();
    await signIn(deps, 'apple');
    await mintCredential(deps);
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(false);
  });

  it('refuses honestly when the discovery route serves a malformed epoch key', async () => {
    const service: ServiceState = { session: 's', account: SAMPLE_ACCOUNT, sentBodies: [], malformedEpochKey: true };
    const { deps } = makeDeps({}, service);
    await signIn(deps, 'apple');
    const result = await mintCredential(deps);
    expect(result.ok).toBe(false);
    expect(await getStoredCredential(deps)).toBeNull();
  });

  it('refuses honestly when the issue response echoes a different key than discovery', async () => {
    const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
    const otherKey = otherPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const service: ServiceState = { session: 's', account: SAMPLE_ACCOUNT, sentBodies: [], mismatchedIssueKey: otherKey };
    const { deps, secretMap } = makeDeps({}, service);
    await signIn(deps, 'apple');
    const result = await mintCredential(deps);
    expect(result.ok).toBe(false);
    expect(await getStoredCredential(deps)).toBeNull();
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(true);
  });

  it('a network failure on the issue POST is honest unreachable and retains pending-mint state', async () => {
    const service: ServiceState = { session: 's', account: SAMPLE_ACCOUNT, sentBodies: [], issueUnreachable: true };
    const { deps, secretMap } = makeDeps({}, service);
    await signIn(deps, 'apple');
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'unreachable' });
    expect(await getStoredCredential(deps)).toBeNull();
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(true);
  });
});

describe('account-core renewal', () => {
  it('refuses renewal outside the window', async () => {
    const { deps } = makeDeps({ now: () => credentialEpochWindow(credentialEpochAt(Date.now())).notBeforeMs + 1000 });
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const { renewIfInWindow } = await import('../account-core');
    // Just after epoch start is NOT within the final-7-day window.
    expect(await renewIfInWindow(deps)).toEqual({ ok: false, reason: 'refused' });
  });

  it('surfaces a flagged account as renewal_refused inside the window', async () => {
    const epoch = credentialEpochAt(Date.now());
    const endMs = credentialEpochWindow(epoch).notBeforeMs + 30 * 24 * 60 * 60 * 1000;
    const inWindowMs = endMs - 3 * 24 * 60 * 60 * 1000; // 3 days before epoch end
    const service: ServiceState = { session: 's', account: SAMPLE_ACCOUNT, sentBodies: [], refuseRenewal: true };
    const { deps } = makeDeps({ now: () => inWindowMs }, service);
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const { renewIfInWindow } = await import('../account-core');
    expect(await renewIfInWindow(deps)).toEqual({ ok: false, reason: 'renewal_refused' });
  });

  it('presents the expiring credential (serial) on renewal only', async () => {
    const epoch = credentialEpochAt(Date.now());
    const endMs = credentialEpochWindow(epoch).notBeforeMs + 30 * 24 * 60 * 60 * 1000;
    const inWindowMs = endMs - 3 * 24 * 60 * 60 * 1000;
    const { deps, service } = makeDeps({ now: () => inWindowMs });
    await signIn(deps, 'apple');
    const minted = await mintCredential(deps);
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    const bodiesBeforeRenew = service.sentBodies.length;
    const { renewIfInWindow } = await import('../account-core');
    const renewed = await renewIfInWindow(deps);
    expect(renewed.ok).toBe(true);
    const renewBodies = service.sentBodies.slice(bodiesBeforeRenew);
    const expiringSerialized = renewBodies.find((b) => b.includes('expiringCredential'));
    expect(expiringSerialized).toBeDefined();
    // The presented credential parses back to the minted one (the renewal presentation
    // is the ONE place a serial-bearing token leaves the device).
    const parsedBody = JSON.parse(expiringSerialized as string) as { expiringCredential: string };
    expect(parseMeerkatCredential(parsedBody.expiringCredential)).not.toBeNull();
  });
});

describe('account-core presentation header', () => {
  it('attaches x-mk-credential when a credential is present', async () => {
    const { deps } = makeDeps();
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const header = await presentCredentialHeader(deps);
    expect(header).not.toBeNull();
    expect(header!['x-mk-credential']).toBeTruthy();
    expect(parseMeerkatCredential(header!['x-mk-credential']!)).not.toBeNull();
  });

  it('returns null when no credential is stored', async () => {
    const { deps } = makeDeps();
    await signIn(deps, 'apple');
    expect(await presentCredentialHeader(deps)).toBeNull();
  });
});

describe('account-core deletion (AC-5)', () => {
  it('clears the keychain without submitting a public credential', async () => {
    const { deps, secretMap, service } = makeDeps();
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const bodiesBefore = service.sentBodies.length;
    const result = await deleteAccount(deps, 'apple');
    // A public credential must never accompany account deletion.
    expect(result).toEqual({ ok: true, deletionScope: 'account_layer_only', revokedSerial: false });
    expect(secretMap.has('meerkat.account.session')).toBe(false);
    expect(secretMap.has('meerkat.account.credential')).toBe(false);
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(false);
    const deleteBody = service.sentBodies.slice(bodiesBefore).find((b) => b.includes('providerToken'));
    expect(Object.keys(JSON.parse(deleteBody!)).sort()).toEqual(['provider', 'providerToken']);
  });

  it('exposes honest deletion copy fields', async () => {
    const { ACCOUNT_DELETE_COPY } = await import('../account-core');
    expect(ACCOUNT_DELETE_COPY.cannotTouchInApp).toContain('cannot touch your in-app data');
    expect(ACCOUNT_DELETE_COPY.unsubmittedPassExpires).toContain('period and grace interval');
    expect(ACCOUNT_DELETE_COPY.recreateAfterPeriod).toContain('current pass period');
  });
});

describe('account-core store age signal', () => {
  it('store_adult passes the gate with source store', () => {
    const db = makeSettingsDb();
    const wrote = applyStoreAgeSignal(db, { ...SAMPLE_ACCOUNT, ageStatus: 'store_adult' }, Date.UTC(2026, 6, 20), 13);
    expect(wrote).toBe(true);
    const record = readAgeGateRecord(db);
    expect(record?.status).toBe('passed');
    expect(record?.source).toBe('store');
  });

  it('store_minor and unknown change nothing', () => {
    const dbMinor = makeSettingsDb();
    expect(applyStoreAgeSignal(dbMinor, { ...SAMPLE_ACCOUNT, ageStatus: 'store_minor' }, Date.now(), 13)).toBe(false);
    expect(getSetting(dbMinor, AGE_GATE_SETTING_KEY)).toBeNull();
    const dbUnknown = makeSettingsDb();
    expect(applyStoreAgeSignal(dbUnknown, { ...SAMPLE_ACCOUNT, ageStatus: 'unknown' }, Date.now(), 13)).toBe(false);
    expect(getSetting(dbUnknown, AGE_GATE_SETTING_KEY)).toBeNull();
  });

  it('never overwrites a locked record', () => {
    const db = makeSettingsDb();
    setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('locked', 13, Date.UTC(2026, 0, 1), 'device'));
    const wrote = applyStoreAgeSignal(db, { ...SAMPLE_ACCOUNT, ageStatus: 'store_adult' }, Date.now(), 13);
    expect(wrote).toBe(false);
    expect(readAgeGateRecord(db)?.status).toBe('locked');
  });

  it('does not rewrite an already-passed record', () => {
    const db = makeSettingsDb();
    setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('passed', 13, Date.UTC(2026, 0, 1), 'device'));
    const wrote = applyStoreAgeSignal(db, { ...SAMPLE_ACCOUNT, ageStatus: 'store_adult' }, Date.now(), 13);
    expect(wrote).toBe(false);
    expect(readAgeGateRecord(db)?.source).toBe('device');
  });
});

describe('account-core AC-4: private mesh modules import nothing from account-core', () => {
  it('dm-core and communities data paths have zero account-core imports', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const root = resolve(__dirname, '..');
    const privateModules = ['dm-core.ts', 'dm-provider-core.ts', 'community-core.ts', 'sync-core.ts'];
    for (const file of privateModules) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toContain('account-core');
    }
  });
});


describe('recoverable mint request', () => {
  it('recovers completed scratch after cleanup failure without consuming another mint', async () => {
    const { deps, service, secretMap } = makeDeps();
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let failCleanup = true;
    deps.secretStore = { ...store, async delete(key) {
      if (key === 'meerkat.account.pending_mint' && failCleanup) throw new Error('Cleanup failed');
      await store.delete(key);
    } };
    const first = await mintCredential(deps);
    expect(first.ok).toBe(true);
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(true);
    failCleanup = false;
    secretMap.set('meerkat.account.session', 'new-session');
    expect(await mintCredential(deps)).toEqual(first);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(false);
  });

  it('can renew after completed mint cleanup failed, retaining scratch while deletion still fails', async () => {
    const epoch = credentialEpochAt(Date.now());
    const { deps, service, secretMap } = makeDeps({
      now: () => credentialEpochWindow(epoch + 1).notBeforeMs - 60_000,
    });
    const { renewIfInWindow } = await import('../account-core');
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let failCleanup = true;
    deps.secretStore = { ...store, async delete(key) {
      if (key === 'meerkat.account.pending_mint' && failCleanup) throw new Error('Cleanup failed');
      await store.delete(key);
    } };
    expect((await mintCredential(deps)).ok).toBe(true);
    const pending = secretMap.get('meerkat.account.pending_mint');
    expect(await renewIfInWindow(deps)).toEqual({ ok: false, reason: 'store_error' });
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
    failCleanup = false;
    expect((await renewIfInWindow(deps)).ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(2);
  });

  it('does not overwrite an in-flight request after the session changes', async () => {
    const { deps, service, secretMap } = makeDeps();
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
    secretMap.set('meerkat.account.session', 'new-session');
    try {
      expect(await mintCredential({ ...deps })).toEqual({ ok: false, reason: 'mint_recovery_required' });
    } finally { release(); }
    expect((await first).ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('replays exactly the same protected request after a lost response', async () => {
    const { deps, service, secretMap } = makeDeps();
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
    const pending = secretMap.get('meerkat.account.pending_mint');
    expect(pending).toBeTruthy();
    const retry = await mintCredential({ ...deps });
    expect(retry.ok).toBe(true);
    const posts = service.sentBodies.filter((body) => body.includes('blindedMessage'));
    expect(posts).toHaveLength(2);
    expect(posts[0]).toBe(posts[1]);
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(false);
  });

  it('keeps the only mint state until the credential write succeeds', async () => {
    const { deps, service, secretMap } = makeDeps();
    await signIn(deps, 'apple');
    const store = deps.secretStore;
    let fail = true;
    deps.secretStore = { ...store, async set(key, value) {
      if (key === 'meerkat.account.credential' && fail) throw new Error('Keychain write failed');
      await store.set(key, value);
    } };
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'store_error' });
    expect(await getStoredCredential(deps)).toBeNull();
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(true);
    fail = false;
    expect((await mintCredential(deps)).ok).toBe(true);
    const posts = service.sentBodies.filter((body) => body.includes('blindedMessage'));
    expect(posts[0]).toBe(posts[1]);
  });

  it('coalesces overlapping mint calls into one request', async () => {
    const { deps, service } = makeDeps();
    await signIn(deps, 'apple');
    const results = await Promise.all([mintCredential(deps), mintCredential({ ...deps })]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].ok).toBe(true);
    expect(service.sentBodies.filter((body) => body.includes('blindedMessage'))).toHaveLength(1);
  });

  it('uses only recovery for an unaccepted request after a session change', async () => {
    const { deps, service, secretMap } = makeDeps();
    await signIn(deps, 'apple');
    service.issueUnreachable = true;
    await mintCredential(deps);
    const pending = secretMap.get('meerkat.account.pending_mint');
    const count = service.sentBodies.length;
    secretMap.set('meerkat.account.session', 'different-session');
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(service.sentBodies).toHaveLength(count + 1);
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
  });
});


describe('credential period transition', () => {
  it('keeps the current pass until the new pass is valid, switches at the boundary and expires honestly', async () => {
    const epoch = credentialEpochAt(Date.now());
    const boundary = credentialEpochWindow(epoch + 1).notBeforeMs;
    let now = boundary - 3 * 24 * 60 * 60 * 1000;
    const { deps, service } = makeDeps({ now: () => now });
    const { renewIfInWindow, getStoredCredentialState } = await import('../account-core');
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
    expect(verifyBlindCredential(current, publicKeySpkiDerBase64, now)).toBe('ok');
    expect(await getStoredCredentialState(deps)).toBe('active');
    now = boundary;
    const switched = parseMeerkatCredential((await presentCredentialHeader(deps))!['x-mk-credential'])!;
    expect(switched).toEqual(next.credential);
    expect(verifyBlindCredential(switched, publicKeySpkiDerBase64, now)).toBe('ok');
    const wire = JSON.parse(Buffer.from((await presentCredentialHeader(deps))!['x-mk-credential'], 'base64url').toString('utf8'));
    expect(Object.keys(wire).sort()).toEqual(['epoch', 'messageBase64', 'signatureBase64', 'version']);
    now = credentialEpochWindow(epoch + 1).notAfterMs + 1;
    expect(await presentCredentialHeader(deps)).toBeNull();
    expect(await getStoredCredentialState(deps)).toBe('expired');
  });

  it('does not present a legacy future-only pass before its validity window', async () => {
    const epoch = credentialEpochAt(Date.now());
    const boundary = credentialEpochWindow(epoch + 1).notBeforeMs;
    const { deps, secretMap } = makeDeps({ now: () => boundary - 60_000 });
    const { renewIfInWindow, getStoredCredentialState } = await import('../account-core');
    await signIn(deps, 'apple');
    await mintCredential(deps);
    const next = await renewIfInWindow(deps);
    if (!next.ok) throw new Error('renewal failed');
    secretMap.set('meerkat.account.credential', JSON.stringify(next.credential));
    expect(await getStoredCredentialState(deps)).toBe('scheduled');
    expect(await presentCredentialHeader(deps)).toBeNull();
  });
});


describe('session-rotation recovery', () => {
  async function interrupted() {
    const fixture = makeDeps();
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
    secretMap.set('meerkat.account.session', 'replacement-session');
    return { ...fixture, posts };
  }

  it('recovers a lost response after sign-in without sending secrets or making another issue request', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = JSON.parse(secretMap.get('meerkat.account.pending_mint')!) as {
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
    expect(secretMap.has('meerkat.account.pending_mint')).toBe(false);
  });

  it('never sends the pending request under a different account', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    deps.fetchImpl = async (url, init) => String(url).endsWith('/account/status')
      ? new Response(JSON.stringify({ ok: true, accountId: 'different-account' }), { status: 200 }) : fetch(url, init);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
  });

  it('fails closed when recovery cannot verify the current account', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    for (const response of [
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
      new Response(JSON.stringify({ ok: true, accountId: 'ignored' }), { status: 401 }),
    ]) {
      deps.fetchImpl = async (url, init) => String(url).endsWith('/account/status') ? response : fetch(url, init);
      expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'refused' });
    }
    expect(posts).toHaveLength(1);
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
  });

  it('retains the request when the original account record cannot be recovered', async () => {
    const { deps, secretMap } = await interrupted();
    const pending = secretMap.get('meerkat.account.pending_mint');
    const fetch = deps.fetchImpl;
    deps.fetchImpl = async (url, init) => String(url).endsWith('/account/credential/recover')
      ? new Response(JSON.stringify({ ok: false, reason: 'refused' }), { status: 403 }) : fetch(url, init);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
    expect(await getStoredCredential(deps)).toBeNull();
  });

  it('does not replay a pending request to a changed service even if its public key matches', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = secretMap.get('meerkat.account.pending_mint');
    const changed = { ...deps, config: { ...deps.config, accountServiceUrl: 'https://other.example.test' } };
    expect(await mintCredential(changed)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
  });

  it('retains legacy pending requests whose original service cannot be established after sign-in', async () => {
    const { deps, secretMap, posts } = await interrupted();
    const pending = JSON.parse(secretMap.get('meerkat.account.pending_mint')!) as Record<string, unknown>;
    pending.version = 2;
    delete pending.serviceHash;
    const legacy = JSON.stringify(pending);
    secretMap.set('meerkat.account.pending_mint', legacy);
    expect(await mintCredential(deps)).toEqual({ ok: false, reason: 'mint_recovery_required' });
    expect(posts).toHaveLength(1);
    expect(secretMap.get('meerkat.account.pending_mint')).toBe(legacy);
  });
});


it('recovers a lost renewal through the replay-only route after the period changes', async () => {
  const { renewIfInWindow } = await import('../account-core');
  const { deps, secretMap } = makeDeps();
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
  secretMap.set('meerkat.account.session', 'replacement-session');
  const recovered = await mintCredential(deps);
  expect(recovered.ok).toBe(true);
  if (!recovered.ok) throw new Error('recovery failed');
  expect(recovered.credential.epoch).toBe(epoch + 1);
  expect(Object.keys(recoveryBody!).sort()).toEqual(['blindedMessage', 'epoch']);
});

it('does not clean up a finished request under a changed account server', async () => {
  const { deps, secretMap } = makeDeps();
  await signIn(deps, 'apple');
  const store = deps.secretStore;
  deps.secretStore = { ...store, delete(key) {
    if (key === 'meerkat.account.pending_mint') throw new Error('cleanup failed');
    return store.delete(key);
  } };
  expect((await mintCredential(deps)).ok).toBe(true);
  const pending = secretMap.get('meerkat.account.pending_mint');
  const changed = { ...deps, config: { ...deps.config, accountServiceUrl: 'https://other.example.test' } };
  expect(await mintCredential(changed)).toEqual({ ok: false, reason: 'mint_recovery_required' });
  expect(secretMap.get('meerkat.account.pending_mint')).toBe(pending);
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
