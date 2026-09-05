import { describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../test/vitest/function-quality';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  YEARN_USER_MESSAGE_KIND,
  createEncryptedYearnLikeSendPayload,
  normalizeYearnIntroMessageCiphertext,
  normalizeYearnMessageCiphertext,
  normalizeYearnUserMessageCiphertext,
  type YearnIntroMessageEncryptor,
  type YearnIntroMessageCiphertext,
  type YearnUserMessageCiphertext,
} from '../yearnIntroMessage';

function makeEnvelope(header: Record<string, unknown> = {}): YearnIntroMessageCiphertext {
  return {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: YEARN_INTRO_MESSAGE_KIND,
    algorithm: 'xchacha20poly1305-double-ratchet',
    senderDeviceId: 'sender-device-1',
    recipientDeviceId: 'recipient-device-1',
    ciphertext: 'base64-ciphertext',
    nonce: 'base64-nonce',
    header,
  };
}

function makeUserEnvelope(header: Record<string, unknown> = {}): YearnUserMessageCiphertext {
  return {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: YEARN_USER_MESSAGE_KIND,
    algorithm: 'xchacha20poly1305-double-ratchet',
    senderDeviceId: 'sender-device-1',
    recipientDeviceId: 'recipient-device-1',
    ciphertext: 'base64-message-ciphertext',
    nonce: 'base64-message-nonce',
    header,
  };
}

function makeEncryptor(
  header: Record<string, unknown> = {},
): YearnIntroMessageEncryptor {
  return {
    encryptIntroMessage: vi.fn().mockResolvedValue({
      algorithm: 'xchacha20poly1305-double-ratchet',
      senderDeviceId: 'sender-device-1',
      recipientDeviceId: 'recipient-device-1',
      ciphertext: 'base64-ciphertext',
      nonce: 'base64-nonce',
      header,
    }),
  };
}

describe('normalizeYearnIntroMessageCiphertext function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const envelope = makeEnvelope({ chainIndex: 1 });
    const userEnvelope = makeUserEnvelope({ chainIndex: 2 });

    expect(normalizeYearnIntroMessageCiphertext(null)).toBeNull();
    expect(normalizeYearnIntroMessageCiphertext(envelope)).toEqual(envelope);
    expect(normalizeYearnMessageCiphertext(envelope)).toEqual(envelope);
    expect(normalizeYearnMessageCiphertext(userEnvelope)).toEqual(userEnvelope);
    expect(normalizeYearnUserMessageCiphertext(userEnvelope)).toEqual(userEnvelope);
    expect(() => normalizeYearnUserMessageCiphertext(envelope as never)).toThrow();
    expect(() => normalizeYearnIntroMessageCiphertext({
      ...envelope,
      header: { plaintext: 'local-only intro' },
    })).toThrow(/plaintext field.*plaintext/);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'normalizeYearnIntroMessageCiphertext fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => {
        if (index % 5 === 0) return null;
        const headerSize = randomInt(rng, 0, 12);
        const header = Object.fromEntries(
          Array.from({ length: headerSize }, (_, headerIndex) => [
            `chain${headerIndex}`,
            randomInt(rng, 0, 1000),
          ]),
        );
        if (index % 7 === 0) {
          return makeEnvelope({ ...header, note: 'plaintext leak' });
        }
        return makeEnvelope(header);
      },
      assertCase: async (input) => {
        const shouldReject = Boolean(input && 'header' in input && input.header?.note);
        if (shouldReject) {
          expect(() => normalizeYearnIntroMessageCiphertext(input)).toThrow(/plaintext field.*note/);
          return;
        }

        const result = normalizeYearnIntroMessageCiphertext(input);
        if (input === null) {
          expect(result).toBeNull();
        } else {
          expect(result?.ciphertext).toBe(input.ciphertext);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'normalizeYearnIntroMessageCiphertext',
      sizes: [250, 500, 1000],
      expected: 'linear',
      maxRatios: [3.4, 3.4],
      setup: (size) => makeEnvelope({
        ratchetHeader: Array.from({ length: size }, (_, index) => ({
          index,
          value: `header-${index}`,
        })),
      }),
      run: async (input) => {
        normalizeYearnIntroMessageCiphertext(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'normalizeYearnIntroMessageCiphertext',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeEnvelope({
        ratchetHeader: Array.from({ length: 1000 }, (_, index) => ({
          index,
          value: `header-${index}`,
        })),
      }),
      run: async (input) => {
        normalizeYearnIntroMessageCiphertext(input);
      },
    });
  });
});

describe('createEncryptedYearnLikeSendPayload function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    const encryptor = makeEncryptor({ chainIndex: 1 });

    await expect(createEncryptedYearnLikeSendPayload({
      profileId: '11111111-1111-1111-1111-111111111111',
      introDraft: '  Loved your bookstore prompt.  ',
      encryptor,
      createdAt: '2026-05-31T12:00:00.000Z',
    })).resolves.toEqual({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: null,
      introCiphertext: makeEnvelope({ chainIndex: 1 }),
    });

    expect(encryptor.encryptIntroMessage).toHaveBeenCalledWith({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: 'Loved your bookstore prompt.',
      createdAt: '2026-05-31T12:00:00.000Z',
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
      acceptChangedRecipientKey: false,
    });

    const blankEncryptor = makeEncryptor();
    await expect(createEncryptedYearnLikeSendPayload({
      profileId: '11111111-1111-1111-1111-111111111111',
      introDraft: '   ',
      encryptor: blankEncryptor,
    })).resolves.toEqual({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: null,
      introCiphertext: null,
    });
    expect(blankEncryptor.encryptIntroMessage).not.toHaveBeenCalled();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createEncryptedYearnLikeSendPayload fuzz',
      iterations: 120,
      seed: 52,
      makeCase: (rng, index) => {
        const introLength = randomInt(rng, 0, 300);
        const introDraft = index % 4 === 0
          ? '   '
          : `  ${'a'.repeat(introLength || 1)}  `;
        const header = index % 9 === 0
          ? { text: 'plaintext leak' }
          : { chainIndex: randomInt(rng, 0, 1000) };
        return { introDraft, header };
      },
      assertCase: async ({ introDraft, header }) => {
        const encryptor = makeEncryptor(header);
        const isBlank = introDraft.trim().length === 0;
        const shouldReject = !isBlank && 'text' in header;

        if (shouldReject) {
          await expect(createEncryptedYearnLikeSendPayload({
            profileId: '11111111-1111-1111-1111-111111111111',
            introDraft,
            encryptor,
          })).rejects.toThrow(/plaintext field.*text/);
          return;
        }

        const result = await createEncryptedYearnLikeSendPayload({
          profileId: '11111111-1111-1111-1111-111111111111',
          introDraft,
          encryptor,
        });
        expect(result.intro).toBeNull();
        expect(Boolean(result.introCiphertext)).toBe(!isBlank);
      },
    });
  });
});
