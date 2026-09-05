import { z } from 'zod';
import {
  normalizeYearnIntroNote,
  type YearnLikeSendPayload,
} from './yearnIntro';

export const YEARN_INTRO_MESSAGE_ENVELOPE_VERSION = 1;
export const YEARN_INTRO_MESSAGE_KIND = 'intro_message';
export const YEARN_USER_MESSAGE_KIND = 'user_message';

const forbiddenPlaintextKeys = new Set([
  'body',
  'cleartext',
  'intro',
  'message',
  'note',
  'plain_text',
  'plaintext',
  'text',
]);

const messageCiphertextKeys = new Set([
  'version',
  'kind',
  'algorithm',
  'senderDeviceId',
  'recipientDeviceId',
  'ciphertext',
  'nonce',
  'header',
]);
const introMessageKinds = new Set([YEARN_INTRO_MESSAGE_KIND]);
const userMessageKinds = new Set([YEARN_USER_MESSAGE_KIND]);
const anyMessageKinds = new Set([YEARN_INTRO_MESSAGE_KIND, YEARN_USER_MESSAGE_KIND]);

function findPlaintextKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push(current[index]);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (forbiddenPlaintextKeys.has(key.trim().toLowerCase())) {
        return key;
      }
      stack.push(record[key]);
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStringField(
  value: unknown,
  fieldName: string,
  maxLength?: number,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Yearn message ciphertext ${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Yearn message ciphertext ${fieldName} is required.`);
  }
  if (maxLength !== undefined && normalized.length > maxLength) {
    throw new Error(`Yearn message ciphertext ${fieldName} is too long.`);
  }

  return normalized;
}

function normalizeHeader(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error('Yearn message ciphertext header must be an object.');
  }

  const plaintextKey = findPlaintextKey(value);
  if (plaintextKey) {
    throw new Error(`Message ciphertext header must not include plaintext field "${plaintextKey}".`);
  }

  return value;
}

function normalizeMessageCiphertext(
  value: unknown,
  allowedKinds: ReadonlySet<string>,
): YearnMessageCiphertext {
  if (!isRecord(value)) {
    throw new Error('Yearn message ciphertext must be an object.');
  }

  for (const key of Object.keys(value)) {
    if (!messageCiphertextKeys.has(key)) {
      throw new Error(`Yearn message ciphertext contains unsupported field "${key}".`);
    }
  }

  if (value.version !== YEARN_INTRO_MESSAGE_ENVELOPE_VERSION) {
    throw new Error(`Yearn message ciphertext version must be ${YEARN_INTRO_MESSAGE_ENVELOPE_VERSION}.`);
  }
  if (typeof value.kind !== 'string' || !allowedKinds.has(value.kind)) {
    throw new Error('Yearn message ciphertext kind is invalid.');
  }

  const header = normalizeHeader(value.header);
  const normalized: YearnMessageCiphertext = {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: value.kind as YearnMessageCiphertext['kind'],
    algorithm: normalizeStringField(value.algorithm, 'algorithm', 80),
    senderDeviceId: normalizeStringField(value.senderDeviceId, 'senderDeviceId', 160),
    recipientDeviceId: normalizeStringField(value.recipientDeviceId, 'recipientDeviceId', 160),
    ciphertext: normalizeStringField(value.ciphertext, 'ciphertext'),
    nonce: normalizeStringField(value.nonce, 'nonce'),
  };

  if (header !== undefined) {
    normalized.header = header;
  }

  return normalized;
}

function buildYearnMessageCiphertextSchema<TKind extends z.ZodTypeAny>(kindSchema: TKind) {
  return z.object({
    version: z.literal(YEARN_INTRO_MESSAGE_ENVELOPE_VERSION),
    kind: kindSchema,
    algorithm: z.string().trim().min(1).max(80),
    senderDeviceId: z.string().trim().min(1).max(160),
    recipientDeviceId: z.string().trim().min(1).max(160),
    ciphertext: z.string().trim().min(1),
    nonce: z.string().trim().min(1),
    header: z.record(z.unknown()).optional(),
  }).strict().superRefine((value, context) => {
    const plaintextKey = findPlaintextKey(value.header);
    if (!plaintextKey) return;

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Message ciphertext header must not include plaintext field "${plaintextKey}".`,
      path: ['header', plaintextKey],
    });
  });
}

export const yearnMessageCiphertextSchema = buildYearnMessageCiphertextSchema(
  z.enum([YEARN_INTRO_MESSAGE_KIND, YEARN_USER_MESSAGE_KIND]),
);

export const yearnIntroMessageCiphertextSchema = buildYearnMessageCiphertextSchema(
  z.literal(YEARN_INTRO_MESSAGE_KIND),
);

export const yearnUserMessageCiphertextSchema = buildYearnMessageCiphertextSchema(
  z.literal(YEARN_USER_MESSAGE_KIND),
);

export type YearnMessageCiphertext = z.infer<typeof yearnMessageCiphertextSchema>;
export type YearnIntroMessageCiphertext = z.infer<typeof yearnIntroMessageCiphertextSchema>;
export type YearnUserMessageCiphertext = z.infer<typeof yearnUserMessageCiphertextSchema>;

export interface YearnIntroMessageEncryptionInput {
  profileId: string;
  intro: string;
  createdAt: string;
  version: typeof YEARN_INTRO_MESSAGE_ENVELOPE_VERSION;
  kind: typeof YEARN_INTRO_MESSAGE_KIND;
  /**
   * Explicit user acknowledgment that the recipient's published device key
   * changed since it was pinned. Without this, a changed key rejects the send.
   */
  acceptChangedRecipientKey?: boolean;
}

export type YearnIntroMessageEncryptionResult = Omit<
  YearnIntroMessageCiphertext,
  'version' | 'kind'
> | YearnIntroMessageCiphertext;

export interface YearnIntroMessageEncryptor {
  encryptIntroMessage(
    input: YearnIntroMessageEncryptionInput,
  ): Promise<YearnIntroMessageEncryptionResult>;
}

export function normalizeYearnIntroMessageCiphertext(
  value: YearnIntroMessageCiphertext | null | undefined,
): YearnIntroMessageCiphertext | null {
  if (!value) return null;
  return normalizeMessageCiphertext(value, introMessageKinds) as YearnIntroMessageCiphertext;
}

export function normalizeYearnMessageCiphertext(
  value: YearnMessageCiphertext | null | undefined,
): YearnMessageCiphertext | null {
  if (!value) return null;
  return normalizeMessageCiphertext(value, anyMessageKinds);
}

export function normalizeYearnUserMessageCiphertext(
  value: YearnUserMessageCiphertext,
): YearnUserMessageCiphertext {
  return normalizeMessageCiphertext(value, userMessageKinds) as YearnUserMessageCiphertext;
}

export async function createEncryptedYearnLikeSendPayload({
  profileId,
  introDraft,
  encryptor,
  createdAt = new Date().toISOString(),
  acceptChangedRecipientKey = false,
}: {
  profileId: string;
  introDraft: string;
  encryptor: YearnIntroMessageEncryptor;
  createdAt?: string;
  acceptChangedRecipientKey?: boolean;
}): Promise<YearnLikeSendPayload> {
  const intro = normalizeYearnIntroNote(introDraft);
  if (!intro) {
    return {
      profileId,
      intro: null,
      introCiphertext: null,
    };
  }

  const encrypted = await encryptor.encryptIntroMessage({
    profileId,
    intro,
    createdAt,
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: YEARN_INTRO_MESSAGE_KIND,
    acceptChangedRecipientKey,
  });
  const introCiphertext = normalizeYearnIntroMessageCiphertext({
    ...encrypted,
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: YEARN_INTRO_MESSAGE_KIND,
  });

  return {
    profileId,
    intro: null,
    introCiphertext,
  };
}
