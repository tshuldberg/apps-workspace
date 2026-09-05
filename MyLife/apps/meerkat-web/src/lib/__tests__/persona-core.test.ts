import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  parseHumanityToken,
  serializeHumanityToken,
  sha512Hex,
} from '@mylife/sync';
import {
  acquirePersonaSession,
  checkAliasAvailability,
  createAndRegisterPersona,
  deletePersona,
  ensurePersonaSession,
  exportPersona,
  getStoredPersona,
  getStoredSession,
  hasValidStoredSession,
  isPersonaServiceConfigured,
  personaState,
  readSessionHeaders,
  requestPersonaDeletion,
  setStoredPersona,
  setStoredSession,
  validateAlias,
  resolvePersonaKeys,
  personaHandle,
  type PersonaServiceConfig,
} from '../persona-core';
import { verifyToViewState } from '../verify-to-view';
import { collectSecretRefs } from '../delete-account-core';
import { getStoredHumanityToken, setStoredHumanityToken } from '../humanity-core';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
      else if (sql.includes('DELETE FROM mk_settings')) store.delete(String(params[0]));
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        let key = params.length ? String(params[0]) : '';
        if (!key) { const m = sql.match(/key = '([^']+)'/); if (m) key = m[1]; }
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void { fn(); },
  };
}

const UNCONFIGURED: PersonaServiceConfig = { url: '' };
const CONFIGURED: PersonaServiceConfig = { url: 'https://accounts.example.test' };
const encoder = new TextEncoder();
const humanityKp = humanityServiceKeypairFromSeed('ba'.repeat(32));

function mintHumanityToken(): string {
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKp.privateKeyHex,
    count: 1,
    randomBytes: (n) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
      return out;
    },
  });
  return serializeHumanityToken(token);
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('web persona config + validation', () => {
  it('is unconfigured until an http url is set', () => {
    expect(isPersonaServiceConfigured(UNCONFIGURED)).toBe(false);
    expect(isPersonaServiceConfigured(CONFIGURED)).toBe(true);
  });

  it('validates aliases + walks the honest gate state', () => {
    const db = fakeSettingsDb();
    expect(validateAlias('ab')).toBe('too_short');
    expect(validateAlias('DuskRunner')).toBe('ok');
    expect(personaState(db, UNCONFIGURED, true)).toBe('not_configured');
    expect(personaState(db, CONFIGURED, false)).toBe('needs_verification');
    expect(personaState(db, CONFIGURED, true)).toBe('needs_alias');
  });
});

describe('web availability (real endpoint, no fabrication)', () => {
  it('maps resolve status to an honest verdict, never fabricating available', async () => {
    const status = (code: number): typeof fetch => (async () => ({ status: code, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await checkAliasAvailability(CONFIGURED, 'duskrunner', status(404))).toBe('available');
    expect(await checkAliasAvailability(CONFIGURED, 'duskrunner', status(200))).toBe('taken');
    const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await checkAliasAvailability(CONFIGURED, 'duskrunner', failing)).toBe('unreachable');
  });
});

describe('web registration (device key never sent -- NC-P2)', () => {
  it('registers, stores the persona, and never puts the device key on the wire', async () => {
    const db = fakeSettingsDb();
    const device = generateDeviceIdentity('My Device');
    const token = mintHumanityToken();
    let body = '';
    const fake = (async (_url: string, init: { headers: Record<string, string>; body: string }) => {
      body = init.body;
      expect(init.headers['x-mk-humanity']).toBe(token);
      return { status: 200, json: async () => ({ ok: true, alias: 'duskrunner', personaPubkey: 'x' }) };
    }) as unknown as typeof fetch;

    const result = await createAndRegisterPersona(db, CONFIGURED, token, 'DuskRunner', '', fake);
    expect(result.ok).toBe(true);
    const stored = getStoredPersona(db);
    expect(stored?.alias).toBe('duskrunner');
    expect(stored?.personaPubkey).not.toBe(device.publicKey);
    expect(body.includes(device.publicKey)).toBe(false);
    const sent = JSON.parse(body) as { claim: { personaPubkey: string; humanityBinding: string } };
    expect(sent.claim.personaPubkey).toBe(stored?.personaPubkey);
    expect(sent.claim.humanityBinding).toBe(sha512Hex(encoder.encode(parseHumanityToken(token)!.tokenId)));
  });

  it('fails closed with no service configured', async () => {
    const db = fakeSettingsDb();
    const result = await createAndRegisterPersona(db, UNCONFIGURED, mintHumanityToken(), 'duskrunner', '');
    expect(result.ok).toBe(false);
    expect(getStoredPersona(db)).toBeNull();
  });
});

describe('web session issuance spends a humanity token (Plan 39 P7)', () => {
  async function seededPersona(db: DatabaseAdapter): Promise<void> {
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
  }

  it('attaches x-mk-humanity and clears the spent token on success', async () => {
    const db = fakeSettingsDb();
    await seededPersona(db);
    setStoredHumanityToken(db, 'wallet-token-abc');
    let issueHeader: string | undefined;
    const fake = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      if (url.endsWith('/persona/session/challenge')) {
        return { status: 200, json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) };
      }
      issueHeader = init.headers['x-mk-humanity'];
      return { status: 200, json: async () => ({ ok: true, token: 'sess.1.2.mac', expiresAtMs: Date.now() + 3600_000 }) };
    }) as unknown as typeof fetch;
    const result = await acquirePersonaSession(db, CONFIGURED, fake);
    expect(result.ok).toBe(true);
    expect(issueHeader).toBe('wallet-token-abc');
    expect(getStoredHumanityToken(db)).toBeNull();
  });

  it('keeps the wallet token on a pre-guard failure (rate_limited never spent it)', async () => {
    const db = fakeSettingsDb();
    await seededPersona(db);
    setStoredHumanityToken(db, 'unspent-token');
    const fake = (async (url: string) => {
      if (url.endsWith('/persona/session/challenge')) {
        return { status: 200, json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) };
      }
      return { status: 429, json: async () => ({ ok: false, reason: 'rate_limited' }) };
    }) as unknown as typeof fetch;
    const result = await acquirePersonaSession(db, CONFIGURED, fake);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('rate_limited');
    expect(getStoredHumanityToken(db)).toBe('unspent-token');
  });

  it('an empty wallet is an honest needs_verification state', async () => {
    const db = fakeSettingsDb();
    await seededPersona(db);
    const result = await acquirePersonaSession(db, CONFIGURED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('needs_verification');
  });
});

describe('web verify-to-view session wallet (Plan 39 P9)', () => {
  it('caches the session bearer: a fresh cached session is reused without re-acquiring', async () => {
    const db = fakeSettingsDb();
    setStoredSession(db, 'cached.1.2.mac', Date.now() + 3600_000);
    expect(hasValidStoredSession(db)).toBe(true);
    let called = false;
    const fake = (async () => { called = true; return { status: 200, json: async () => ({}) }; }) as unknown as typeof fetch;
    const result = await ensurePersonaSession(db, CONFIGURED, fake);
    expect(result.ok).toBe(true);
    expect(called).toBe(false);
  });

  it('readSessionHeaders returns x-mk-session when valid, empty when none', () => {
    const db = fakeSettingsDb();
    expect(readSessionHeaders(db)).toEqual({});
    setStoredSession(db, 'tok', Date.now() + 3600_000);
    expect(readSessionHeaders(db)).toEqual({ 'x-mk-session': 'tok' });
  });

  it('the honest verify-to-view state: not_configured / locked / needs_session / verified', () => {
    const db = fakeSettingsDb();
    expect(verifyToViewState(db, UNCONFIGURED)).toBe('not_configured');
    expect(verifyToViewState(db, CONFIGURED)).toBe('locked');
    setStoredPersona(db, { personaPubkey: 'p'.repeat(64), privateKeyRef: 'r', alias: 'a', displayName: '', createdAt: '' });
    expect(verifyToViewState(db, CONFIGURED)).toBe('needs_session');
    setStoredSession(db, 'tok', Date.now() + 3600_000);
    expect(verifyToViewState(db, CONFIGURED)).toBe('verified');
  });

  it('deleting a persona also clears the cached session', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    setStoredSession(db, 'live', Date.now() + 3600_000);
    const del = (async () => ({ status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    await deletePersona(db, CONFIGURED, del);
    expect(getStoredSession(db)).toBeNull();
  });
});

describe('web persona seed cleanup (privacy wipe)', () => {
  it('the account-wipe ref collector includes the persona seed', () => {
    const db = fakeSettingsDb();
    setStoredPersona(db, {
      personaPubkey: 'p'.repeat(64),
      privateKeyRef: 'local:shared:deadbeefcafe',
      alias: 'duskrunner',
      displayName: '',
      createdAt: '2026-07-06T00:00:00.000Z',
    });
    expect(collectSecretRefs(db)).toContain('local:shared:deadbeefcafe');
  });

  it('deleting a persona also deletes its seed', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    const ref = getStoredPersona(db)!.privateKeyRef;
    const deleted: string[] = [];
    const del = (async () => ({ status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    await deletePersona(db, CONFIGURED, del, (r) => { deleted.push(r); });
    expect(deleted).toContain(ref);
    expect(getStoredPersona(db)).toBeNull();
  });

  it('retains the local persona reference when vault seed deletion fails', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    const del = (async () => ({ status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    await expect(deletePersona(db, CONFIGURED, del, async () => {
      throw new Error('vault unavailable');
    })).resolves.toEqual({ ok: false, reason: 'local_secret_delete_failed' });
    expect(getStoredPersona(db)).not.toBeNull();
  });
});

describe('web GDPR delete + export', () => {
  it('signs a delete request and clears the local persona on success', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    let body: { signature?: string } = {};
    const fake = (async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body);
      return { status: 200, json: async () => ({ ok: true, releasedAlias: 'duskrunner' }) };
    }) as unknown as typeof fetch;
    expect((await deletePersona(db, CONFIGURED, fake)).ok).toBe(true);
    expect(typeof body.signature).toBe('string');
    expect(getStoredPersona(db)).toBeNull();
  });

  it('can complete the remote delete while retaining the local key until the full wipe succeeds', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    const before = getStoredPersona(db);
    const fake = (async () => ({ status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    expect(await requestPersonaDeletion(db, CONFIGURED, fake)).toEqual({ ok: true });
    expect(getStoredPersona(db)).toEqual(before);
  });

  it('exports the persona rows', async () => {
    const db = fakeSettingsDb();
    const ok = (async () => ({ status: 200, json: async () => ({ ok: true, personaPubkey: 'x' }) })) as unknown as typeof fetch;
    await createAndRegisterPersona(db, CONFIGURED, mintHumanityToken(), 'duskrunner', '', ok);
    const fake = (async () => ({ status: 200, json: async () => ({ ok: true, record: { alias: 'duskrunner' }, revoked: false }) })) as unknown as typeof fetch;
    expect((await exportPersona(db, CONFIGURED, fake)).ok).toBe(true);
  });
});

describe('reverse resolve (pubkey -> alias) client (web)', () => {
  const KEY_A = 'aa'.repeat(32);
  const KEY_B = 'bb'.repeat(32);

  it('returns the registered alias map; unconfigured / malformed / network fail => {}', async () => {
    const okFetch = (async () => ({ status: 200, json: async () => ({ ok: true, aliases: { [KEY_A]: 'duskrunner' } }) })) as unknown as typeof fetch;
    expect(await resolvePersonaKeys(CONFIGURED, [KEY_A, KEY_B], okFetch)).toEqual({ [KEY_A]: 'duskrunner' });
    expect(await resolvePersonaKeys(UNCONFIGURED, [KEY_A], okFetch)).toEqual({});
    expect(await resolvePersonaKeys(CONFIGURED, ['nope'], okFetch)).toEqual({});
    const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await resolvePersonaKeys(CONFIGURED, [KEY_A], failing)).toEqual({});
  });

  it('personaHandle prefers @alias, falls back to the short persona id', () => {
    expect(personaHandle({ [KEY_A]: 'duskrunner' }, KEY_A, 'aaaa…aaaa')).toBe('@duskrunner');
    expect(personaHandle({}, KEY_B, 'bbbb…bbbb')).toBe('persona bbbb…bbbb');
  });
});
