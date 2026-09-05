import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHubTestDatabase,
  type DatabaseAdapter,
} from '@mylife/db';
import {
  clearStoredEntitlement,
  getModeConfig,
  getStoredEntitlement,
  refreshEntitlementFromServer,
  saveEntitlement,
  saveModeConfig,
} from '../entitlements';

describe('mobile entitlement storage and refresh', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('persists and reads runtime mode config', () => {
    expect(getModeConfig(db)).toEqual({ mode: 'local_only', serverUrl: null });

    saveModeConfig(db, 'self_host', 'https://home.example.com');

    expect(getModeConfig(db)).toEqual({
      mode: 'self_host',
      serverUrl: 'https://home.example.com',
    });
  });

  it('validates entitlement payloads before persisting', () => {
    expect(saveEntitlement(db, 'token-1', { bad: true })).toEqual({
      ok: false,
      reason: 'invalid_shape',
    });
    expect(getStoredEntitlement(db)).toBeNull();

    const payload = {
      appId: 'mylife',
      mode: 'self_host',
      hostedActive: false,
      selfHostLicense: true,
      updatePackYear: 2026,
      features: ['sync', 'sharing'],
      issuedAt: '2026-02-25T00:00:00.000Z',
      expiresAt: '2027-02-25T00:00:00.000Z',
      signature: 'signed-signature-123',
    };

    expect(saveEntitlement(db, 'token-2', payload)).toEqual({ ok: true });
    expect(getStoredEntitlement(db)).toEqual(payload);
  });

  it('clears cached entitlement payloads', () => {
    saveEntitlement(db, 'token', {
      appId: 'mylife',
      mode: 'hosted',
      hostedActive: true,
      selfHostLicense: false,
      updatePackYear: undefined,
      features: [],
      issuedAt: '2026-02-25T00:00:00.000Z',
      expiresAt: undefined,
      signature: 'signed-signature-123',
    });
    expect(getStoredEntitlement(db)).not.toBeNull();

    clearStoredEntitlement(db);
    expect(getStoredEntitlement(db)).toBeNull();
  });

  it('returns local-only when no server endpoint can be resolved', async () => {
    const result = await refreshEntitlementFromServer(db);
    expect(result).toEqual({ ok: false, reason: 'local_only_mode' });
  });

  it('maps refresh failures to explicit reasons', async () => {
    saveModeConfig(db, 'self_host', 'not-a-url');
    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({
      ok: false,
      reason: 'invalid_server_url',
    });

    saveModeConfig(db, 'self_host', 'https://home.example.com');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({
      ok: false,
      reason: 'network_error',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad-json', { status: 200 })));
    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({
      ok: false,
      reason: 'invalid_response',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: 123, entitlements: null }), { status: 200 }),
      ),
    );
    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({
      ok: false,
      reason: 'invalid_response',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: 'token', entitlements: { bad: true } }), { status: 200 }),
      ),
    );
    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({
      ok: false,
      reason: 'invalid_shape',
    });
  });

  it('refreshes from server and persists valid entitlements', async () => {
    saveModeConfig(db, 'self_host', 'https://home.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            token: 'raw-token',
            entitlements: {
              appId: 'mylife',
              mode: 'self_host',
              hostedActive: false,
              selfHostLicense: true,
              updatePackYear: 2026,
              features: ['sync'],
              issuedAt: '2026-02-25T00:00:00.000Z',
              expiresAt: '2027-02-25T00:00:00.000Z',
              signature: 'signed-signature-123',
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(refreshEntitlementFromServer(db)).resolves.toEqual({ ok: true });
    expect(getStoredEntitlement(db)).toEqual({
      appId: 'mylife',
      mode: 'self_host',
      hostedActive: false,
      selfHostLicense: true,
      updatePackYear: 2026,
      features: ['sync'],
      issuedAt: '2026-02-25T00:00:00.000Z',
      expiresAt: '2027-02-25T00:00:00.000Z',
      signature: 'signed-signature-123',
    });
  });
});
