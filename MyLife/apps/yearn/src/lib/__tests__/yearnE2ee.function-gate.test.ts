import { describe, expect, it, vi } from 'vitest';
import {
  randomInt,
  runDeterministicFuzz,
} from '../../../../../test/vitest/function-quality';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
} from '../yearnIntroMessage';
import {
  createYearnIntroMessageEncryptor,
  decryptYearnIntroForDevice,
  getOrCreateYearnE2eeDeviceIdentity,
  type YearnE2eeStorage,
} from '../yearnE2ee';

const senderUserId = '55555555-5555-5555-5555-555555555555';
const recipientUserId = '11111111-1111-1111-1111-111111111111';

function createMemoryStorage(): YearnE2eeStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('yearnE2ee function quality gate', () => {
  it('matches contract behavior for reusable device identities and encrypted intros', async () => {
    const senderStorage = createMemoryStorage();
    const recipientIdentity = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );
    const publishE2eeDeviceKey = vi.fn().mockResolvedValue(undefined);
    const fetchIntroRecipientDeviceKey = vi.fn().mockResolvedValue({
      userId: recipientIdentity.userId,
      deviceId: recipientIdentity.deviceId,
      publicKey: recipientIdentity.publicKey,
      keyAlgorithm: recipientIdentity.keyAlgorithm,
      createdAt: recipientIdentity.createdAt,
    });
    const encryptor = createYearnIntroMessageEncryptor({
      userId: senderUserId,
      storage: senderStorage,
      repository: {
        publishE2eeDeviceKey,
        fetchIntroRecipientDeviceKey,
      },
    });

    const envelope = await encryptor.encryptIntroMessage({
      profileId: recipientUserId,
      intro: 'Loved your bookstore prompt.',
      createdAt: '2026-05-31T12:00:00.000Z',
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
    });

    expect(publishE2eeDeviceKey).toHaveBeenCalledTimes(1);
    expect(fetchIntroRecipientDeviceKey).toHaveBeenCalledWith(recipientUserId);
    expect(envelope.ciphertext).not.toContain('Loved your bookstore prompt.');
    expect(decryptYearnIntroForDevice({
      envelope: {
        ...envelope,
        version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
        kind: YEARN_INTRO_MESSAGE_KIND,
      },
      recipientIdentity,
      expectedSender: { senderUserId },
    })?.intro).toBe('Loved your bookstore prompt.');
  });

  it('passes deterministic fuzz invariants for intro encryption payloads', async () => {
    const recipientIdentity = await getOrCreateYearnE2eeDeviceIdentity(
      recipientUserId,
      createMemoryStorage(),
    );

    await runDeterministicFuzz({
      label: 'yearnE2ee intro encryption fuzz',
      iterations: 25,
      seed: 81,
      makeCase: (rng) => {
        const length = randomInt(rng, 1, 120);
        return {
          intro: `A${'b'.repeat(length)}`,
          minute: randomInt(rng, 0, 59),
        };
      },
      assertCase: async ({ intro, minute }) => {
        const encryptor = createYearnIntroMessageEncryptor({
          userId: senderUserId,
          storage: createMemoryStorage(),
          repository: {
            publishE2eeDeviceKey: vi.fn().mockResolvedValue(undefined),
            fetchIntroRecipientDeviceKey: vi.fn().mockResolvedValue({
              userId: recipientIdentity.userId,
              deviceId: recipientIdentity.deviceId,
              publicKey: recipientIdentity.publicKey,
              keyAlgorithm: recipientIdentity.keyAlgorithm,
              createdAt: recipientIdentity.createdAt,
            }),
          },
        });
        const createdAt = `2026-05-31T12:${String(minute).padStart(2, '0')}:00.000Z`;
        const envelope = await encryptor.encryptIntroMessage({
          profileId: recipientUserId,
          intro,
          createdAt,
          version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
          kind: YEARN_INTRO_MESSAGE_KIND,
        });
        const decrypted = decryptYearnIntroForDevice({
          envelope: {
            ...envelope,
            version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
            kind: YEARN_INTRO_MESSAGE_KIND,
          },
          recipientIdentity,
          expectedSender: { senderUserId },
        });

        expect(envelope.header).not.toHaveProperty('intro');
        expect(decrypted).toMatchObject({
          intro,
          createdAt,
          recipientUserId,
          senderUserId,
        });
      },
    });
  });
});
