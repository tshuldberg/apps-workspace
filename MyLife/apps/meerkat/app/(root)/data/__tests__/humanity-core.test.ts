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

const UNCONFIGURED: HumanityServiceConfig = { url: '', servicePublicKeyHex: '' };
const CONFIGURED: HumanityServiceConfig = {
  url: 'https://humanity.example.test',
  servicePublicKeyHex: 'a'.repeat(64),
};

describe('humanity config + wallet', () => {
  it('is unconfigured unless both url and a 64-hex key are set', () => {
    expect(isHumanityServiceConfigured(UNCONFIGURED)).toBe(false);
    expect(isHumanityServiceConfigured({ url: 'https://x', servicePublicKeyHex: 'short' })).toBe(false);
    expect(isHumanityServiceConfigured(CONFIGURED)).toBe(true);
  });

  it('round-trips the wallet token', () => {
    const db = fakeSettingsDb();
    expect(getStoredHumanityToken(db)).toBeNull();
    setStoredHumanityToken(db, 'tok');
    expect(getStoredHumanityToken(db)).toBe('tok');
    clearStoredHumanityToken(db);
    expect(getStoredHumanityToken(db)).toBeNull();
  });

  it('gate state is not_configured with no service; needs_verification when configured but no valid token', () => {
    const db = fakeSettingsDb();
    expect(humanityGateState(db, UNCONFIGURED)).toBe('not_configured');
    // A garbage stored token cannot verify against the pinned key => still needs verification.
    setStoredHumanityToken(db, 'not-a-real-token');
    expect(humanityGateState(db, CONFIGURED)).toBe('needs_verification');
  });
});

describe('describeHumanityGate copy', () => {
  it('never claims verified when it is not', () => {
    expect(describeHumanityGate('not_configured')).toContain('not available in this build');
    expect(describeHumanityGate('needs_verification')).toContain('anonymous');
    expect(describeHumanityGate('verified')).toContain('verified');
  });
});

describe('acquireHumanityToken (real challenge -> issue flow)', () => {
  it('fails closed when the service is not configured', async () => {
    const result = await acquireHumanityToken(UNCONFIGURED, 'app-attest', async () => 'att');
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('reports attestation_unavailable when the solver returns null', async () => {
    const fetchImpl = vi.fn(async () =>
      ({ json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) }) as unknown as Response);
    const result = await acquireHumanityToken(CONFIGURED, 'app-attest', async () => null, fetchImpl);
    expect(result).toEqual({ ok: false, reason: 'attestation_unavailable' });
    // Only the challenge was fetched; no issue call after an unavailable attestation.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the first issued token on a full success', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/humanity/challenge')) {
        return { json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) } as unknown as Response;
      }
      return { json: async () => ({ ok: true, tokens: ['issued-token-1', 'issued-token-2'] }) } as unknown as Response;
    });
    const result = await acquireHumanityToken(CONFIGURED, 'app-attest', async () => 'attestation', fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: true, token: 'issued-token-1' });
  });

  it('fails closed when the service is unreachable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network'); });
    const result = await acquireHumanityToken(CONFIGURED, 'app-attest', async () => 'att', fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'service_unreachable' });
  });

  it('serializes a HumanityToken OBJECT from the service into the wire string (issue #6)', async () => {
    // The deployed humanity service returns token OBJECTS, not bearer strings.
    const tokenObj = {
      version: 1 as const,
      tokenId: 'a'.repeat(64),
      issuedAt: '2026-07-06T00:00:00.000Z',
      expiresAt: '2026-07-13T00:00:00.000Z',
      signature: 'b'.repeat(128),
    };
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/humanity/challenge')) {
        return { json: async () => ({ ok: true, challengeId: 'c1', nonce: 'n1' }) } as unknown as Response;
      }
      return { json: async () => ({ ok: true, tokens: [tokenObj] }) } as unknown as Response;
    });
    const result = await acquireHumanityToken(CONFIGURED, 'app-attest', async () => 'attestation', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The stored token is a wire STRING, not an object; it round-trips through parse.
      expect(typeof result.token).toBe('string');
      expect(result.token).not.toContain('[object Object]');
      expect(serializeHumanityToken(tokenObj)).toBe(result.token);
      const parsed = parseHumanityToken(result.token);
      expect(parsed?.tokenId).toBe(tokenObj.tokenId);
    }
  });
});

describe('buildHumanityRedeemClient (owner single-use gate)', () => {
  it('is null when no service URL is configured (owner fails closed)', () => {
    expect(buildHumanityRedeemClient({ url: '', servicePublicKeyHex: 'a'.repeat(64) })).toBeNull();
  });

  it('maps a successful redeem to ok', async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ ok: true }) }) as unknown as Response);
    const redeem = buildHumanityRedeemClient(CONFIGURED, fetchImpl as unknown as typeof fetch)!;
    expect(await redeem('wire')).toEqual({ ok: true });
  });

  it('maps a replayed token to already_spent (single-use enforced by the service)', async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ ok: false, reason: 'already_spent' }) }) as unknown as Response);
    const redeem = buildHumanityRedeemClient(CONFIGURED, fetchImpl as unknown as typeof fetch)!;
    expect(await redeem('wire')).toEqual({ ok: false, reason: 'already_spent' });
  });

  it('fails closed (service_unreachable) on a network error', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    const redeem = buildHumanityRedeemClient(CONFIGURED, fetchImpl as unknown as typeof fetch)!;
    expect(await redeem('wire')).toEqual({ ok: false, reason: 'service_unreachable' });
  });
});
