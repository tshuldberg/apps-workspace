import { describe, expect, it, vi } from 'vitest';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  YEARN_USER_MESSAGE_KIND,
  createEncryptedYearnLikeSendPayload,
  normalizeYearnIntroMessageCiphertext,
  normalizeYearnMessageCiphertext,
  normalizeYearnUserMessageCiphertext,
} from '../yearnIntroMessage';

const encryptedIntro = {
  version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  kind: YEARN_INTRO_MESSAGE_KIND,
  algorithm: 'xchacha20poly1305-double-ratchet',
  senderDeviceId: 'sender-device-1',
  recipientDeviceId: 'recipient-device-1',
  ciphertext: 'base64-ciphertext',
  nonce: 'base64-nonce',
  header: {
    messageNumber: 1,
    previousChainLength: 0,
  },
} as const;

const encryptedMessage = {
  ...encryptedIntro,
  kind: YEARN_USER_MESSAGE_KIND,
  ciphertext: 'base64-message-ciphertext',
  nonce: 'base64-message-nonce',
} as const;

describe('yearnIntroMessage', () => {
  it('normalizes a ciphertext-only intro message envelope', () => {
    expect(normalizeYearnIntroMessageCiphertext(encryptedIntro)).toEqual(encryptedIntro);
  });

  it('normalizes shared chat ciphertext envelopes for intro and user messages', () => {
    expect(normalizeYearnMessageCiphertext(encryptedIntro)).toEqual(encryptedIntro);
    expect(normalizeYearnMessageCiphertext(encryptedMessage)).toEqual(encryptedMessage);
    expect(normalizeYearnUserMessageCiphertext(encryptedMessage)).toEqual(encryptedMessage);
    expect(() => normalizeYearnUserMessageCiphertext(encryptedIntro as never)).toThrow();
  });

  it('treats missing envelopes as no encrypted intro', () => {
    expect(normalizeYearnIntroMessageCiphertext(null)).toBeNull();
    expect(normalizeYearnIntroMessageCiphertext(undefined)).toBeNull();
  });

  it('rejects envelopes with plaintext fields in the header', () => {
    expect(() => normalizeYearnIntroMessageCiphertext({
      ...encryptedIntro,
      header: {
        ...encryptedIntro.header,
        plaintext: 'This should never leave the device.',
      },
    })).toThrow(/plaintext field.*plaintext/);
  });

  it('rejects empty ciphertext material', () => {
    expect(() => normalizeYearnIntroMessageCiphertext({
      ...encryptedIntro,
      ciphertext: '   ',
    })).toThrow();
  });

  it('builds an encrypted like payload through the injected E2EE adapter', async () => {
    const encryptIntroMessage = vi.fn().mockResolvedValue({
      algorithm: encryptedIntro.algorithm,
      senderDeviceId: encryptedIntro.senderDeviceId,
      recipientDeviceId: encryptedIntro.recipientDeviceId,
      ciphertext: encryptedIntro.ciphertext,
      nonce: encryptedIntro.nonce,
      header: encryptedIntro.header,
    });

    await expect(createEncryptedYearnLikeSendPayload({
      profileId: '11111111-1111-1111-1111-111111111111',
      introDraft: '  Loved your bookstore prompt.  ',
      encryptor: { encryptIntroMessage },
      createdAt: '2026-05-31T12:00:00.000Z',
    })).resolves.toEqual({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: null,
      introCiphertext: encryptedIntro,
    });
    expect(encryptIntroMessage).toHaveBeenCalledWith({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: 'Loved your bookstore prompt.',
      createdAt: '2026-05-31T12:00:00.000Z',
      version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
      kind: YEARN_INTRO_MESSAGE_KIND,
      acceptChangedRecipientKey: false,
    });
  });

  it('skips encryption for empty intro drafts', async () => {
    const encryptIntroMessage = vi.fn();

    await expect(createEncryptedYearnLikeSendPayload({
      profileId: '11111111-1111-1111-1111-111111111111',
      introDraft: '   ',
      encryptor: { encryptIntroMessage },
    })).resolves.toEqual({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: null,
      introCiphertext: null,
    });
    expect(encryptIntroMessage).not.toHaveBeenCalled();
  });

  it('rejects encrypted adapter results that carry plaintext metadata', async () => {
    const encryptIntroMessage = vi.fn().mockResolvedValue({
      algorithm: encryptedIntro.algorithm,
      senderDeviceId: encryptedIntro.senderDeviceId,
      recipientDeviceId: encryptedIntro.recipientDeviceId,
      ciphertext: encryptedIntro.ciphertext,
      nonce: encryptedIntro.nonce,
      header: { text: 'Loved your bookstore prompt.' },
    });

    await expect(createEncryptedYearnLikeSendPayload({
      profileId: '11111111-1111-1111-1111-111111111111',
      introDraft: 'Loved your bookstore prompt.',
      encryptor: { encryptIntroMessage },
    })).rejects.toThrow(/plaintext field.*text/);
  });
});
