import { describe, expect, it } from 'vitest';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { InMemoryCloudAdapter, type ProfileView } from '@mylife/mynews';
import { HANDLE_RULE, submitRegistration } from '../(root)/lib/registration';

const device = generateDeviceIdentity('mynews-registration-test');
const IDENTITY = {
  pubkeyHex: device.publicKey,
  privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
};

function okAuth(userId = 'user-1') {
  return {
    ensureSession: async () => ({ ok: true as const, userId }),
  };
}

describe('HANDLE_RULE', () => {
  it('accepts 3-30 chars of a-z, 0-9, _', () => {
    expect(HANDLE_RULE.test('jane_doe')).toBe(true);
    expect(HANDLE_RULE.test('ab')).toBe(false);
    expect(HANDLE_RULE.test('a'.repeat(31))).toBe(false);
    expect(HANDLE_RULE.test('Jane')).toBe(false);
    expect(HANDLE_RULE.test('jane doe')).toBe(false);
  });
});

describe('submitRegistration', () => {
  it('rejects an invalid handle before any port or session call', async () => {
    const port = new InMemoryCloudAdapter();
    let sessions = 0;
    const auth = {
      ensureSession: async () => {
        sessions += 1;
        return { ok: true as const, userId: 'user-1' };
      },
    };
    const result = await submitRegistration({
      auth,
      port,
      identity: IDENTITY,
      handle: 'No Caps!',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('handle');
      expect(result.message).toContain('3-30 characters');
    }
    expect(sessions).toBe(0);
    expect(port.profiles).toHaveLength(0);
  });

  it('requires a display name', async () => {
    const port = new InMemoryCloudAdapter();
    const result = await submitRegistration({
      auth: okAuth(),
      port,
      identity: IDENTITY,
      handle: 'jane',
      displayName: '   ',
    });
    expect(result).toEqual({ ok: false, field: 'form', message: 'Add a display name.' });
  });

  it('binds the device pubkey into the created profile', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: ' Jane_Doe ',
      displayName: ' Jane Doe ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.pubkeyEd25519).toBe(IDENTITY.pubkeyHex);
      expect(result.profile.handle).toBe('jane_doe');
      expect(result.profile.displayName).toBe('Jane Doe');
      expect(result.profile.userId).toBe('user-1');
      expect(result.profile.kind).toBe('reader');
    }
    expect(port.profiles).toHaveLength(1);
  });

  it('surfaces a key-bind conflict honestly without faking success', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    // Another profile already holds this device key (squatting scenario).
    port.profiles.push({
      id: 'squatter',
      userId: 'someone-else',
      handle: 'squatter',
      displayName: 'Squatter',
      pubkeyEd25519: IDENTITY.pubkeyHex,
      kind: 'reader',
    });
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('already registered to another profile');
    // The profile row was still created; the key just could not be bound.
    expect(port.profiles.find((p) => p.userId === 'user-1')?.pubkeyEd25519).toBe('');
  });

  it('finishes key binding for an already-registered profile with no key', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    const existing: ProfileView = {
      id: 'p1',
      userId: 'user-1',
      handle: 'jane_doe',
      displayName: 'Jane',
      pubkeyEd25519: '',
      kind: 'reader',
    };
    port.profiles.push(existing);
    port.registerProfile = async () => ({ ok: false, error: 'already-registered' });
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe2',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.pubkeyEd25519).toBe(IDENTITY.pubkeyHex);
  });

  it('maps handle-taken to an inline handle error', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    port.profiles.push({
      id: 'p0',
      userId: 'someone-else',
      handle: 'jane_doe',
      displayName: 'Other Jane',
      pubkeyEd25519: 'b'.repeat(64),
      kind: 'reader',
    });
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result).toEqual({
      ok: false,
      field: 'handle',
      message: 'That handle is taken. Try another.',
    });
  });

  it('treats already-registered as success by loading the existing profile', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    const existing: ProfileView = {
      id: 'p1',
      userId: 'user-1',
      handle: 'jane_doe',
      displayName: 'Jane',
      pubkeyEd25519: IDENTITY.pubkeyHex,
      kind: 'reader',
    };
    port.profiles.push(existing);
    port.registerProfile = async () => ({ ok: false, error: 'already-registered' });
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe2',
      displayName: 'Jane',
    });
    expect(result).toEqual({ ok: true, profile: existing });
  });

  it('is honest when already-registered has no loadable profile', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'user-1';
    port.registerProfile = async () => ({ ok: false, error: 'already-registered' });
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('could not be loaded');
  });

  it('maps not-signed-in to honest retry copy', async () => {
    const port = new InMemoryCloudAdapter();
    // sessionUserId stays null: the adapter refuses like a signed-out fetch.
    const result = await submitRegistration({
      auth: okAuth('user-1'),
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('form');
      expect(result.message).toContain('Try again');
    }
  });

  it('surfaces ensureSession failures without calling the port', async () => {
    const port = new InMemoryCloudAdapter();
    let registered = 0;
    port.registerProfile = async () => {
      registered += 1;
      return { ok: false, error: 'should-not-happen' };
    };
    const result = await submitRegistration({
      auth: { ensureSession: async () => ({ ok: false as const, error: 'anon disabled' }) },
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('anon disabled');
    expect(registered).toBe(0);
  });

  it('maps a thrown port failure to honest network copy', async () => {
    const port = new InMemoryCloudAdapter();
    port.registerProfile = async () => {
      throw new Error('offline');
    };
    const result = await submitRegistration({
      auth: okAuth(),
      port,
      identity: IDENTITY,
      handle: 'jane_doe',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('offline');
  });
});
