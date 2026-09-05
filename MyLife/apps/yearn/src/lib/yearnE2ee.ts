import nacl from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';
import { z } from 'zod';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  YEARN_USER_MESSAGE_KIND,
  normalizeYearnIntroMessageCiphertext,
  normalizeYearnMessageCiphertext,
  normalizeYearnUserMessageCiphertext,
  type YearnIntroMessageCiphertext,
  type YearnIntroMessageEncryptionInput,
  type YearnIntroMessageEncryptor,
  type YearnMessageCiphertext,
  type YearnUserMessageCiphertext,
} from './yearnIntroMessage';
import { assertTrustedYearnRecipientKey } from './yearnKeyDirectory';

export const YEARN_E2EE_KEY_ALGORITHM = 'curve25519-xsalsa20poly1305';

export interface YearnE2eeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export interface YearnE2eeDeviceKeyRepository {
  publishE2eeDeviceKey(key: YearnE2eeDevicePublicKey): Promise<void>;
  fetchIntroRecipientDeviceKey(profileId: string): Promise<YearnE2eeDevicePublicKey | null>;
}

export const yearnE2eeDevicePublicKeySchema = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().trim().min(1).max(160),
  publicKey: z.string().trim().min(1).max(256),
  keyAlgorithm: z.literal(YEARN_E2EE_KEY_ALGORITHM),
  createdAt: z.string().optional(),
  lastSeenAt: z.string().optional(),
}).strict();

const yearnE2eeDeviceIdentitySchema = yearnE2eeDevicePublicKeySchema.extend({
  secretKey: z.string().trim().min(1).max(256),
});

// The encrypted inner payload reuses the `intro` field name for both intro
// and user-message kinds; it is the message content either way.
const yearnEncryptedMessagePlaintextSchema = z.object({
  version: z.literal(YEARN_INTRO_MESSAGE_ENVELOPE_VERSION),
  kind: z.enum([YEARN_INTRO_MESSAGE_KIND, YEARN_USER_MESSAGE_KIND]),
  senderUserId: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  intro: z.string().min(1),
  createdAt: z.string(),
}).strict();

export type YearnE2eeDevicePublicKey = z.infer<typeof yearnE2eeDevicePublicKeySchema>;

export interface YearnE2eeDeviceIdentity extends YearnE2eeDevicePublicKey {
  secretKey: string;
}

export interface YearnIntroMessageEncryptorOptions {
  userId: string;
  storage: YearnE2eeStorage;
  repository: YearnE2eeDeviceKeyRepository;
}

export interface DecryptedYearnIntroMessage {
  senderUserId: string;
  recipientUserId: string;
  intro: string;
  createdAt: string;
}

export interface DecryptedYearnMessage {
  kind: typeof YEARN_INTRO_MESSAGE_KIND | typeof YEARN_USER_MESSAGE_KIND;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  createdAt: string;
}

function getYearnE2eeDeviceIdentityStorageKey(userId: string): string {
  return `yearn:e2ee:v1:${userId}`;
}

function toPublicDeviceKey(identity: YearnE2eeDeviceIdentity): YearnE2eeDevicePublicKey {
  return {
    userId: identity.userId,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    keyAlgorithm: identity.keyAlgorithm,
    createdAt: identity.createdAt,
    lastSeenAt: identity.lastSeenAt,
  };
}

function decodeYearnE2eeKey(value: string, expectedBytes: number, label: string): Uint8Array {
  try {
    const decoded = decodeBase64(value);
    if (decoded.length !== expectedBytes) {
      throw new Error(`${label} must be ${expectedBytes} bytes.`);
    }
    return decoded;
  } catch (err) {
    if (err instanceof Error && err.message.endsWith('bytes.')) throw err;
    throw new Error(`${label} is not valid base64 key material.`);
  }
}

function parseStoredYearnE2eeIdentity(
  stored: string | null,
): YearnE2eeDeviceIdentity | null {
  if (!stored) return null;
  return yearnE2eeDeviceIdentitySchema.parse(JSON.parse(stored));
}

export async function getOrCreateYearnE2eeDeviceIdentity(
  userId: string,
  storage: YearnE2eeStorage,
): Promise<YearnE2eeDeviceIdentity> {
  const normalizedUserId = z.string().uuid().parse(userId);
  const storageKey = getYearnE2eeDeviceIdentityStorageKey(normalizedUserId);
  const storedIdentity = parseStoredYearnE2eeIdentity(await storage.getItem(storageKey));
  if (storedIdentity) return storedIdentity;

  const keyPair = nacl.box.keyPair();
  const publicKey = encodeBase64(keyPair.publicKey);
  const identity: YearnE2eeDeviceIdentity = {
    userId: normalizedUserId,
    deviceId: publicKey,
    publicKey,
    secretKey: encodeBase64(keyPair.secretKey),
    keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
    createdAt: new Date().toISOString(),
  };

  await storage.setItem(storageKey, JSON.stringify(identity));
  return identity;
}

export async function ensureAndPublishYearnE2eeDeviceKey({
  userId,
  storage,
  repository,
}: YearnIntroMessageEncryptorOptions): Promise<YearnE2eeDevicePublicKey> {
  const identity = await getOrCreateYearnE2eeDeviceIdentity(userId, storage);
  const publicKey = toPublicDeviceKey(identity);
  await repository.publishE2eeDeviceKey(publicKey);
  return publicKey;
}

function buildYearnEncryptedEnvelope({
  kind,
  content,
  createdAt,
  senderIdentity,
  recipientKey,
}: {
  kind: typeof YEARN_INTRO_MESSAGE_KIND | typeof YEARN_USER_MESSAGE_KIND;
  content: string;
  createdAt: string;
  senderIdentity: YearnE2eeDeviceIdentity;
  recipientKey: YearnE2eeDevicePublicKey;
}) {
  if (recipientKey.userId === senderIdentity.userId) {
    throw new Error('Encrypted messages require a recipient profile different from the sender.');
  }

  const recipientPublicKey = decodeYearnE2eeKey(recipientKey.publicKey, nacl.box.publicKeyLength, 'Recipient public key');
  const senderSecretKey = decodeYearnE2eeKey(senderIdentity.secretKey, nacl.box.secretKeyLength, 'Sender secret key');
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const plaintext = {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind,
    senderUserId: senderIdentity.userId,
    recipientUserId: recipientKey.userId,
    intro: content,
    createdAt,
  };
  const ciphertext = nacl.box(
    decodeUTF8(JSON.stringify(plaintext)),
    nonce,
    recipientPublicKey,
    senderSecretKey,
  );

  return {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind,
    algorithm: YEARN_E2EE_KEY_ALGORITHM,
    senderDeviceId: senderIdentity.deviceId,
    recipientDeviceId: recipientKey.deviceId,
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    header: {
      createdAt,
      senderUserId: senderIdentity.userId,
      recipientUserId: recipientKey.userId,
      senderPublicKey: senderIdentity.publicKey,
      recipientPublicKey: recipientKey.publicKey,
      keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
    },
  };
}

export function encryptYearnIntroForRecipient({
  input,
  senderIdentity,
  recipientKey,
}: {
  input: YearnIntroMessageEncryptionInput;
  senderIdentity: YearnE2eeDeviceIdentity;
  recipientKey: YearnE2eeDevicePublicKey;
}): YearnIntroMessageCiphertext {
  return normalizeYearnIntroMessageCiphertext(
    buildYearnEncryptedEnvelope({
      kind: YEARN_INTRO_MESSAGE_KIND,
      content: input.intro,
      createdAt: input.createdAt,
      senderIdentity,
      recipientKey,
    }) as YearnIntroMessageCiphertext,
  ) as YearnIntroMessageCiphertext;
}

export function encryptYearnUserMessageForRecipient({
  content,
  createdAt,
  senderIdentity,
  recipientKey,
}: {
  content: string;
  createdAt: string;
  senderIdentity: YearnE2eeDeviceIdentity;
  recipientKey: YearnE2eeDevicePublicKey;
}): YearnUserMessageCiphertext {
  return normalizeYearnUserMessageCiphertext(
    buildYearnEncryptedEnvelope({
      kind: YEARN_USER_MESSAGE_KIND,
      content,
      createdAt,
      senderIdentity,
      recipientKey,
    }) as YearnUserMessageCiphertext,
  );
}

export interface YearnIntroSenderBinding {
  /**
   * The RLS-enforced sender identity from the database row carrying this
   * envelope (likes.sender_id / messages_ciphertext.sender_id). Header and
   * payload sender fields are attacker-authorable and are only accepted when
   * they agree with this value.
   */
  senderUserId: string;
  /** Registered or TOFU-pinned sender device public key, when known. */
  senderPublicKey?: string | null;
}

export function decryptYearnMessageForDevice({
  envelope,
  recipientIdentity,
  expectedSender,
}: {
  envelope: YearnMessageCiphertext;
  recipientIdentity: YearnE2eeDeviceIdentity;
  expectedSender: YearnIntroSenderBinding;
}): DecryptedYearnMessage | null {
  const normalizedEnvelope = normalizeYearnMessageCiphertext(envelope);
  if (!normalizedEnvelope) return null;
  if (normalizedEnvelope.recipientDeviceId !== recipientIdentity.deviceId) return null;

  const expectedSenderUserId = z.string().uuid().safeParse(expectedSender.senderUserId);
  if (!expectedSenderUserId.success) return null;
  if (expectedSenderUserId.data === recipientIdentity.userId) return null;

  const header = normalizedEnvelope.header ?? {};
  const senderPublicKey = typeof header.senderPublicKey === 'string'
    ? header.senderPublicKey
    : null;
  if (!senderPublicKey) return null;

  if (
    expectedSender.senderPublicKey != null
    && senderPublicKey !== expectedSender.senderPublicKey
  ) {
    return null;
  }

  if ('senderUserId' in header && header.senderUserId !== expectedSenderUserId.data) {
    return null;
  }
  if ('recipientUserId' in header && header.recipientUserId !== recipientIdentity.userId) {
    return null;
  }

  // A malformed envelope or ciphertext must never throw into a render path.
  // Any decode/open/parse failure resolves to "undecryptable" (null).
  try {
    const plaintextBytes = nacl.box.open(
      decodeBase64(normalizedEnvelope.ciphertext),
      decodeBase64(normalizedEnvelope.nonce),
      decodeYearnE2eeKey(senderPublicKey, nacl.box.publicKeyLength, 'Sender public key'),
      decodeYearnE2eeKey(recipientIdentity.secretKey, nacl.box.secretKeyLength, 'Recipient secret key'),
    );
    if (!plaintextBytes) return null;

    const parsed = yearnEncryptedMessagePlaintextSchema.safeParse(
      JSON.parse(encodeUTF8(plaintextBytes)),
    );
    if (!parsed.success) return null;
    const plaintext = parsed.data;
    if (plaintext.senderUserId !== expectedSenderUserId.data) return null;
    if (plaintext.recipientUserId !== recipientIdentity.userId) return null;
    if (plaintext.kind !== normalizedEnvelope.kind) return null;

    return {
      kind: plaintext.kind,
      senderUserId: plaintext.senderUserId,
      recipientUserId: plaintext.recipientUserId,
      body: plaintext.intro,
      createdAt: plaintext.createdAt,
    };
  } catch {
    return null;
  }
}

export function decryptYearnIntroForDevice({
  envelope,
  recipientIdentity,
  expectedSender,
}: {
  envelope: YearnIntroMessageCiphertext;
  recipientIdentity: YearnE2eeDeviceIdentity;
  expectedSender: YearnIntroSenderBinding;
}): DecryptedYearnIntroMessage | null {
  const decrypted = decryptYearnMessageForDevice({
    envelope,
    recipientIdentity,
    expectedSender,
  });
  if (!decrypted || decrypted.kind !== YEARN_INTRO_MESSAGE_KIND) return null;

  return {
    senderUserId: decrypted.senderUserId,
    recipientUserId: decrypted.recipientUserId,
    intro: decrypted.body,
    createdAt: decrypted.createdAt,
  };
}

export function createYearnIntroMessageEncryptor({
  userId,
  storage,
  repository,
}: YearnIntroMessageEncryptorOptions): YearnIntroMessageEncryptor {
  let identityPromise: Promise<YearnE2eeDeviceIdentity> | null = null;

  const getIdentity = async () => {
    if (!identityPromise) {
      identityPromise = getOrCreateYearnE2eeDeviceIdentity(userId, storage);
    }
    return identityPromise;
  };

  return {
    async encryptIntroMessage(input) {
      const senderIdentity = await getIdentity();
      await repository.publishE2eeDeviceKey(toPublicDeviceKey(senderIdentity));
      const recipientKey = await repository.fetchIntroRecipientDeviceKey(input.profileId);
      if (!recipientKey) {
        throw new Error('This profile has not published an encrypted intro key yet.');
      }

      await assertTrustedYearnRecipientKey({
        storage,
        ownerUserId: senderIdentity.userId,
        fetchedKey: recipientKey,
        acceptChangedKey: input.acceptChangedRecipientKey === true,
      });

      return encryptYearnIntroForRecipient({
        input,
        senderIdentity,
        recipientKey,
      });
    },
  };
}
