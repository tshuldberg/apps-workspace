import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { parseHumanityToken, serializeHumanityToken } from '@mylife/sync';
import {
  acquireHumanityToken,
  buildHumanityRedeemClient,
  describeHumanityGate,
  getStoredHumanityToken,
  humanityGateState,
  isHumanityServiceConfigured,
  setStoredHumanityToken,
  clearStoredHumanityToken,
  type HumanityServiceConfig,
} from '../humanity-core';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
      else if (sql.includes('DELETE FROM mk_settings')) store.delete(String(params[0]));
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        const key = String(params[0]);
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void { fn(); },
  };
}

const UNCONFIGURED: HumanityServiceConfig = { url: '', servicePublicKeyHex: '', turnstileSiteKey: '' };
const CONFIGURED: HumanityServiceConfig = {
  url: 'https://humanity.example.test',
  servicePublicKeyHex: 'a'.repeat(64),
  turnstileSiteKey: 'ts-site-key',
};

describe('web humanity config + wallet', () => {
  it('is unconfigured unless both url and a 64-hex key are set', () => {
    expect(isHumanityServiceConfigured(UNCONFIGURED)).toBe(false);
    expect(isHumanityServiceConfigured(CONFIGURED)).toBe(true);
  });

  it('round-trips + clears the wallet token', () => {
    const db = fakeSettingsDb();
    expect(getStoredHumanityToken(db)).toBeNull();
    setStoredHumanityToken(db, 'tok');
    expect(getStoredHumanityToken(db)).toBe('tok');
    clearStoredHumanityToken(db);
    expect(getStoredHumanityToken(db)).toBeNull();
  });

  it('gate state is not_configured with no service', () => {
    const db = fakeSettingsDb();
    expect(humanityGateState(db, UNCONFIGURED)).toBe('not_configured');
    setStoredHumanityToken(db, 'not-a-real-token');
    expect(humanityGateState(db, CONFIGURED)).toBe('needs_verification');
  });

  it('describeHumanityGate never overclaims', () => {
    expect(describeHumanityGate('not_configured')).toContain('not available in this build');
    expect(describeHumanityGate('verified')).toContain('verified');
  });
});

describe('web acquireHumanityToken', () => {
  it('fails closed when unconfigured', async () => {
    expect(await acquireHumanityToken(UNCONFIGURED, 'turnstile', async () => 'x'))
      .toEqual({ ok: false, reason: 'not_configured' });
  });

  it('reports attestation_unavailable when Turnstile solver returns null', async () => {
    const fetchImpl = vi.fn(async () =>
      ({ json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) }) as unknown as Response);
    expect(await acquireHumanityToken(CONFIGURED, 'turnstile', async () => null, fetchImpl))
      .toEqual({ ok: false, reason: 'attestation_unavailable' });
  });

  it('returns the first issued token on success', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      (String(url).endsWith('/humanity/challenge')
        ? { json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) }
        : { json: async () => ({ ok: true, tokens: ['t1'] }) }) as unknown as Response);
    expect(await acquireHumanityToken(CONFIGURED, 'turnstile', async () => 'att', fetchImpl as unknown as typeof fetch))
      .toEqual({ ok: true, token: 't1' });
  });

  it('serializes a HumanityToken OBJECT from the service into the wire string (issue #6)', async () => {
    const tokenObj = {
      version: 1 as const,
      tokenId: 'a'.repeat(64),
      issuedAt: '2026-07-06T00:00:00.000Z',
      expiresAt: '2026-07-13T00:00:00.000Z',
      signature: 'b'.repeat(128),
    };
    const fetchImpl = vi.fn(async (url: string) =>
      (String(url).endsWith('/humanity/challenge')
        ? { json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) }
        : { json: async () => ({ ok: true, tokens: [tokenObj] }) }) as unknown as Response);
    const result = await acquireHumanityToken(CONFIGURED, 'turnstile', async () => 'att', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.token).toBe('string');
      expect(result.token).not.toContain('[object Object]');
      expect(serializeHumanityToken(tokenObj)).toBe(result.token);
      expect(parseHumanityToken(result.token)?.tokenId).toBe(tokenObj.tokenId);
    }
  });
});

describe('web buildHumanityRedeemClient (owner single-use gate)', () => {
  it('is null when no service URL is configured', () => {
    expect(buildHumanityRedeemClient({ url: '', servicePublicKeyHex: 'a'.repeat(64), turnstileSiteKey: '' })).toBeNull();
  });

  it('maps ok / already_spent / network error', async () => {
    const ok = buildHumanityRedeemClient(CONFIGURED, (async () => ({ json: async () => ({ ok: true }) })) as unknown as typeof fetch)!;
    expect(await ok('w')).toEqual({ ok: true });
    const spent = buildHumanityRedeemClient(CONFIGURED, (async () => ({ json: async () => ({ ok: false, reason: 'already_spent' }) })) as unknown as typeof fetch)!;
    expect(await spent('w')).toEqual({ ok: false, reason: 'already_spent' });
    const down = buildHumanityRedeemClient(CONFIGURED, (async () => { throw new Error('x'); }) as unknown as typeof fetch)!;
    expect(await down('w')).toEqual({ ok: false, reason: 'service_unreachable' });
  });
});
