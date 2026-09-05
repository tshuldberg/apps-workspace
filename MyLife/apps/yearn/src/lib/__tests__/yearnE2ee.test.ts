import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-util';
import { describe, expect, it, vi } from 'vitest';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  type YearnIntroMessageCiphertext,
} from '../yearnIntroMessage';
import {
  YEARN_E2EE_KEY_ALGORITHM,
  createYearnIntroMessageEncryptor,
  decryptYearnIntroForDevice,
  decryptYearnMessageForDevice,
  encryptYearnIntroForRecipient,
  encryptYearnUserMessageForRecipient,
  ensureAndPublishYearnE2eeDeviceKey,
  getOrCreateYearnE2eeDeviceIdentity,
  type YearnE2eeDevicePublicKey,
  type YearnE2eeStorage,
} from '../yearnE2ee';

const senderUserId = '55555555-5555-5555-5555-555555555555';
const recipientUserId = '11111111-1111-1111-1111-111111111111';
const createdAt = '2026-05-31T12:00:00.000Z';

function createMemoryStorage(): YearnE2eeStorage & { writes: string[] } {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
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

function publicDeviceKey(key: YearnE2eeDevicePublicKey): YearnE2eeDevicePublicKey {
  return {
    userId: key.userId,
    deviceId: key.deviceId,
    publicKey: key.publicKey,
    keyAlgorithm: key.keyAlgorithm,
    createdAt: key.createdAt,
    lastSeenAt: key.lastSeenAt,
  };
}

describe('yearnE2ee', () => {
  it('creates and reuses a per-user device identity from secure storage', async () => {
    const storage = createMemoryStorage();

    const first = await getOrCreateYearnE2eeDeviceIdentity(senderUserId, storage);
    const second = await getOrCreateYearnE2eeDeviceIdentity(senderUserId, storage);

    expect(first).toEqual(second);
    expect(first.userId).toBe(senderUserId);
    expect(first.deviceId).toBe(first.publicKey);
    expect(first.keyAlgorithm).toBe(YEARN_E2EE_KEY_ALGORITHM);
    expect(first.secretKey).not.toBe(first.publicKey);
    expect(storage.writes).toHaveLength(1);
  });

  it('publishes the public device key without exposing the secret key', async () => {
    const storage = createMemoryStorage();
    const publishE2eeDeviceKey = vi.fn().mockResolvedValue(undefined);
    const fetchIntroRecipientDeviceKey = vi.fn();

    const publicKey = await ensureAndPublishYearnE2eeDeviceKey({
      userId: senderUserId,
      storage,
      repository: {
        publishE2eeDeviceKey,
        fetchIntroRecipientDeviceKey,
      },
    });

    expect(publicKey).not.toHaveProperty('secretKey');
    expect(publishE2eeDeviceKey).toHaveBeenCalledWith(publicKey);
  });

  it('encrypts and decrypts intro notes without plaintext header fields', async () => {
    const sender = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );

    const envelope = encryptYearnIntroForRecipient({
      input: {
        profileId: recipientUserId,
        intro: 'Loved your bookstore prompt.',
        createdAt,
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
      },
      senderIdentity: sender,
      recipientKey: publicDeviceKey(recipient),
    });

    expect(envelope.header).not.toHaveProperty('intro');
    expect(envelope.header).not.toHaveProperty('text');
    expect(envelope.header).not.toHaveProperty('plaintext');
    expect(envelope.ciphertext).not.toContain('Loved your bookstore prompt.');
    expect(decryptYearnIntroForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId, senderPublicKey: sender.publicKey },
    })).toEqual({
      senderUserId,
      recipientUserId,
      intro: 'Loved your bookstore prompt.',
      createdAt,
    });
  });

  it('uses repository recipient keys from the intro message encryptor', async () => {
    const storage = createMemoryStorage();
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const publishE2eeDeviceKey = vi.fn().mockResolvedValue(undefined);
    const fetchIntroRecipientDeviceKey = vi.fn().mockResolvedValue(publicDeviceKey(recipient));
    const encryptor = createYearnIntroMessageEncryptor({
      userId: senderUserId,
      storage,
      repository: {
        publishE2eeDeviceKey,
        fetchIntroRecipientDeviceKey,
      },
    });

    const envelope = await encryptor.encryptIntroMessage({
      profileId: recipientUserId,
      intro: 'Loved your bookstore prompt.',
      createdAt,
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
    });

    expect(publishE2eeDeviceKey).toHaveBeenCalledTimes(1);
    expect(fetchIntroRecipientDeviceKey).toHaveBeenCalledWith(recipientUserId);
    expect(envelope.recipientDeviceId).toBe(recipient.deviceId);
    expect(decryptYearnIntroForDevice({
      envelope: {
        ...envelope,
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
      },
      recipientIdentity: recipient,
      expectedSender: { senderUserId },
    })?.intro).toBe('Loved your bookstore prompt.');
  });

  it('rejects decryption when the database sender does not match the envelope', async () => {
    const sender = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const envelope = encryptYearnIntroForRecipient({
      input: {
        profileId: recipientUserId,
        intro: 'Loved your bookstore prompt.',
        createdAt,
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
      },
      senderIdentity: sender,
      recipientKey: publicDeviceKey(recipient),
    });

    expect(decryptYearnIntroForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId: '99999999-9999-9999-9999-999999999999' },
    })).toBeNull();
  });

  it('rejects decryption when a pinned sender key does not match the envelope key', async () => {
    const sender = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const envelope = encryptYearnIntroForRecipient({
      input: {
        profileId: recipientUserId,
        intro: 'Loved your bookstore prompt.',
        createdAt,
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
      },
      senderIdentity: sender,
      recipientKey: publicDeviceKey(recipient),
    });

    expect(decryptYearnIntroForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId, senderPublicKey: recipient.publicKey },
    })).toBeNull();
  });

  it('returns null (never throws) on a malformed ciphertext so a render cannot crash', async () => {
    const sender = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const envelope = encryptYearnUserMessageForRecipient({
      content: 'Hello there.',
      createdAt,
      senderIdentity: sender,
      recipientKey: publicDeviceKey(recipient),
    });

    // Corrupt the ciphertext to non-base64 garbage. The old code threw here,
    // crashing the Matches render (audit B1). It must now resolve to null.
    const corrupted = { ...envelope, ciphertext: '!!! not base64 !!!' };

    let result: ReturnType<typeof decryptYearnMessageForDevice> | undefined;
    expect(() => {
      result = decryptYearnMessageForDevice({
        envelope: corrupted,
        recipientIdentity: recipient,
        expectedSender: { senderUserId, senderPublicKey: sender.publicKey },
      });
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('rejects crafted envelopes whose payload claims a different sender than the database row', async () => {
    const attacker = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const spoofedSenderId = '99999999-9999-9999-9999-999999999999';
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box(
      decodeUTF8(JSON.stringify({
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
        senderUserId: spoofedSenderId,
        recipientUserId,
        intro: 'I am definitely someone else.',
        createdAt,
      })),
      nonce,
      decodeBase64(recipient.publicKey),
      decodeBase64(attacker.secretKey),
    );
    const envelope: YearnIntroMessageCiphertext = {
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
      algorithm: YEARN_E2EE_KEY_ALGORITHM,
      senderDeviceId: attacker.deviceId,
      recipientDeviceId: recipient.deviceId,
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce),
      header: {
        createdAt,
        senderUserId: spoofedSenderId,
        recipientUserId,
        senderPublicKey: attacker.publicKey,
        recipientPublicKey: recipient.publicKey,
        keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
      },
    };

    expect(decryptYearnIntroForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId },
    })).toBeNull();
  });

  it('pins the recipient key on first use and rejects a silently swapped key', async () => {
    const storage = createMemoryStorage();
    const recipientA = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const recipientB = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const fetchIntroRecipientDeviceKey = vi.fn()
      .mockResolvedValueOnce(publicDeviceKey(recipientA))
      .mockResolvedValue(publicDeviceKey(recipientB));
    const encryptor = createYearnIntroMessageEncryptor({
      userId: senderUserId,
      storage,
      repository: {
        publishE2eeDeviceKey: vi.fn().mockResolvedValue(undefined),
        fetchIntroRecipientDeviceKey,
      },
    });
    const input = {
      profileId: recipientUserId,
      intro: 'Loved your bookstore prompt.',
      createdAt,
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
    } as const;

    const first = await encryptor.encryptIntroMessage(input);
    expect(first.recipientDeviceId).toBe(recipientA.deviceId);

    await expect(encryptor.encryptIntroMessage(input)).rejects.toMatchObject({
      name: 'YearnRecipientKeyChangedError',
      recipientUserId,
    });

    const accepted = await encryptor.encryptIntroMessage({
      ...input,
      acceptChangedRecipientKey: true,
    });
    expect(accepted.recipientDeviceId).toBe(recipientB.deviceId);
  });

  it('rejects intro encryption when the recipient has no published device key', async () => {
    const encryptor = createYearnIntroMessageEncryptor({
      userId: senderUserId,
      storage: createMemoryStorage(),
      repository: {
        publishE2eeDeviceKey: vi.fn().mockResolvedValue(undefined),
        fetchIntroRecipientDeviceKey: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(encryptor.encryptIntroMessage({
      profileId: recipientUserId,
      intro: 'Loved your bookstore prompt.',
      createdAt,
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
    })).rejects.toThrow('This profile has not published an encrypted intro key yet.');
  });

  it('encrypts and decrypts ongoing user messages with sender binding', async () => {
    const sender = await getOrCreateYearnE2eeDeviceIdentity(
      senderUserId,
      createMemoryStorage(),
    );
    const recipient = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );

    const envelope = encryptYearnUserMessageForRecipient({
      content: 'Coffee on Thursday still works for me.',
      createdAt,
      senderIdentity: sender,
      recipientKey: publicDeviceKey(recipient),
    });

    expect(envelope.kind).toBe('user_message');
    expect(envelope.ciphertext).not.toContain('Coffee on Thursday');
    expect(decryptYearnMessageForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId },
    })).toEqual({
      kind: 'user_message',
      senderUserId,
      recipientUserId,
      body: 'Coffee on Thursday still works for me.',
      createdAt,
    });

    expect(decryptYearnMessageForDevice({
      envelope,
      recipientIdentity: recipient,
      expectedSender: { senderUserId: '99999999-9999-9999-9999-999999999999' },
    })).toBeNull();
  });
});
