import { describe, expect, it } from 'vitest';
import type { YearnE2eeDevicePublicKey, YearnE2eeStorage } from '../yearnE2ee';
import { YEARN_E2EE_KEY_ALGORITHM } from '../yearnE2ee';
import {
  YearnPinUnreadableError,
  YearnRecipientKeyChangedError,
  assertTrustedYearnRecipientKey,
  evaluateYearnRecipientKeyTrust,
  getYearnRecipientKeyPinStorageKey,
  loadPinnedYearnRecipientKey,
  pinYearnRecipientKey,
  resolveTrustedYearnSenderKey,
} from '../yearnKeyDirectory';

const ownerUserId = '55555555-5555-5555-5555-555555555555';
const recipientUserId = '11111111-1111-1111-1111-111111111111';

function deviceKey(publicKey: string): YearnE2eeDevicePublicKey {
  return {
    userId: recipientUserId,
    deviceId: publicKey,
    publicKey,
    keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
  };
}

function createMemoryStorage(): YearnE2eeStorage & { writes: string[]; values: Map<string, string> } {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    values,
    writes,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      writes.push(key);
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

describe('yearnKeyDirectory', () => {
  it('pins the recipient key on first use', async () => {
    const storage = createMemoryStorage();

    const trust = await assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-a'),
    });

    expect(trust).toBe('first-use');
    const pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, recipientUserId);
    expect(pinned?.publicKey).toBe('key-a');
    expect(storage.writes).toEqual([
      getYearnRecipientKeyPinStorageKey(ownerUserId, recipientUserId),
    ]);
  });

  it('accepts a matching pinned key without rewriting the pin', async () => {
    const storage = createMemoryStorage();
    await pinYearnRecipientKey(storage, ownerUserId, deviceKey('key-a'), '2026-06-01T00:00:00.000Z');

    const trust = await assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-a'),
    });

    expect(trust).toBe('pinned-match');
    expect(storage.writes).toHaveLength(1);
  });

  it('rejects a changed key without explicit acceptance', async () => {
    const storage = createMemoryStorage();
    await pinYearnRecipientKey(storage, ownerUserId, deviceKey('key-a'));

    await expect(assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-b'),
    })).rejects.toMatchObject({
      name: 'YearnRecipientKeyChangedError',
      recipientUserId,
      pinnedPublicKey: 'key-a',
      fetchedPublicKey: 'key-b',
    });

    const pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, recipientUserId);
    expect(pinned?.publicKey).toBe('key-a');
  });

  it('re-pins a changed key once the user explicitly accepts it', async () => {
    const storage = createMemoryStorage();
    await pinYearnRecipientKey(storage, ownerUserId, deviceKey('key-a'));

    const trust = await assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-b'),
      acceptChangedKey: true,
    });

    expect(trust).toBe('changed-accepted');
    const pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, recipientUserId);
    expect(pinned?.publicKey).toBe('key-b');
  });

  it('fails closed on an unreadable stored pin instead of silently re-trusting', async () => {
    const storage = createMemoryStorage();
    storage.values.set(
      getYearnRecipientKeyPinStorageKey(ownerUserId, recipientUserId),
      'not-json',
    );

    // A corrupt pin must NOT be treated as first-use: that would let an attacker
    // who corrupts one SecureStore entry downgrade a "key changed" alert into
    // silent trust (audit Y6). loadPinnedYearnRecipientKey surfaces the
    // corruption, and the send guard rejects without explicit acceptance.
    await expect(
      loadPinnedYearnRecipientKey(storage, ownerUserId, recipientUserId),
    ).rejects.toBeInstanceOf(YearnPinUnreadableError);

    await expect(assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-a'),
    })).rejects.toBeInstanceOf(YearnRecipientKeyChangedError);
  });

  it('re-pins an unreadable pin only when the user explicitly accepts', async () => {
    const storage = createMemoryStorage();
    storage.values.set(
      getYearnRecipientKeyPinStorageKey(ownerUserId, recipientUserId),
      'not-json',
    );

    const trust = await assertTrustedYearnRecipientKey({
      storage,
      ownerUserId,
      fetchedKey: deviceKey('key-a'),
      acceptChangedKey: true,
    });

    expect(trust).toBe('changed-accepted');
    const pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, recipientUserId);
    expect(pinned?.publicKey).toBe('key-a');
  });

  it('resolves receive-path sender trust: first-use pins, match returns key, change refuses', async () => {
    const storage = createMemoryStorage();

    // First peer message: pin the sender key and allow decryption with it.
    const firstUse = await resolveTrustedYearnSenderKey({
      storage,
      ownerUserId,
      senderUserId: recipientUserId,
      incomingKey: deviceKey('sender-key-a'),
    });
    expect(firstUse.trust).toBe('first-use');
    expect(firstUse.trustedPublicKey).toBe('sender-key-a');

    // Same key later: trusted match.
    const match = await resolveTrustedYearnSenderKey({
      storage,
      ownerUserId,
      senderUserId: recipientUserId,
      incomingKey: deviceKey('sender-key-a'),
    });
    expect(match.trust).toBe('pinned-match');
    expect(match.trustedPublicKey).toBe('sender-key-a');

    // A swapped sender key (impersonation attempt) must refuse decryption.
    const changed = await resolveTrustedYearnSenderKey({
      storage,
      ownerUserId,
      senderUserId: recipientUserId,
      incomingKey: deviceKey('sender-key-b'),
    });
    expect(changed.trust).toBe('changed');
    expect(changed.trustedPublicKey).toBeNull();
  });

  it('evaluates trust transitions as pure data', () => {
    expect(evaluateYearnRecipientKeyTrust(null, deviceKey('key-a'))).toBe('first-use');
    expect(evaluateYearnRecipientKeyTrust({
      userId: recipientUserId,
      deviceId: 'key-a',
      publicKey: 'key-a',
      keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
      pinnedAt: '2026-06-01T00:00:00.000Z',
    }, deviceKey('key-a'))).toBe('pinned-match');
    expect(evaluateYearnRecipientKeyTrust({
      userId: recipientUserId,
      deviceId: 'key-a',
      publicKey: 'key-a',
      keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
      pinnedAt: '2026-06-01T00:00:00.000Z',
    }, deviceKey('key-b'))).toBe('changed');
    expect(new YearnRecipientKeyChangedError({
      recipientUserId,
      pinnedPublicKey: 'key-a',
      fetchedPublicKey: 'key-b',
    }).message).toContain('encryption key changed');
  });
});
