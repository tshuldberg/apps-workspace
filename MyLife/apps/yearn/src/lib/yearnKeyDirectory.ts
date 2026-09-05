import { z } from 'zod';
import type { YearnE2eeDevicePublicKey, YearnE2eeStorage } from './yearnE2ee';

export type YearnRecipientKeyTrust = 'first-use' | 'pinned-match' | 'changed-accepted';

const yearnPinnedRecipientKeySchema = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().trim().min(1).max(160),
  publicKey: z.string().trim().min(1).max(256),
  keyAlgorithm: z.string().trim().min(1).max(80),
  pinnedAt: z.string(),
}).strict();

export type YearnPinnedRecipientKey = z.infer<typeof yearnPinnedRecipientKeySchema>;

export class YearnPinUnreadableError extends Error {
  readonly recipientUserId: string;

  constructor(recipientUserId: string) {
    super('A stored encryption pin could not be read. Verify identity before trusting a new key.');
    this.name = 'YearnPinUnreadableError';
    this.recipientUserId = recipientUserId;
  }
}

export class YearnRecipientKeyChangedError extends Error {
  readonly recipientUserId: string;

  readonly pinnedPublicKey: string;

  readonly fetchedPublicKey: string;

  constructor(input: {
    recipientUserId: string;
    pinnedPublicKey: string;
    fetchedPublicKey: string;
  }) {
    super('Their encryption key changed since you last sent an intro. Verify with them before trusting the new key.');
    this.name = 'YearnRecipientKeyChangedError';
    this.recipientUserId = input.recipientUserId;
    this.pinnedPublicKey = input.pinnedPublicKey;
    this.fetchedPublicKey = input.fetchedPublicKey;
  }
}

export function getYearnRecipientKeyPinStorageKey(
  ownerUserId: string,
  recipientUserId: string,
): string {
  return `yearn:e2ee:pin:v1:${ownerUserId}:${recipientUserId}`;
}

export async function loadPinnedYearnRecipientKey(
  storage: YearnE2eeStorage,
  ownerUserId: string,
  recipientUserId: string,
): Promise<YearnPinnedRecipientKey | null> {
  const stored = await storage.getItem(
    getYearnRecipientKeyPinStorageKey(ownerUserId, recipientUserId),
  );
  if (!stored) return null;

  try {
    return yearnPinnedRecipientKeySchema.parse(JSON.parse(stored));
  } catch {
    // A pin that exists but cannot be parsed is NOT the same as no pin. Silently
    // treating it as first-use would let an attacker who corrupts one SecureStore
    // entry downgrade a "key changed, verify!" alert into silent trust. Fail
    // closed by signalling the corruption to the caller.
    throw new YearnPinUnreadableError(recipientUserId);
  }
}

export async function pinYearnRecipientKey(
  storage: YearnE2eeStorage,
  ownerUserId: string,
  fetchedKey: YearnE2eeDevicePublicKey,
  pinnedAt: string = new Date().toISOString(),
): Promise<YearnPinnedRecipientKey> {
  const pinned: YearnPinnedRecipientKey = {
    userId: fetchedKey.userId,
    deviceId: fetchedKey.deviceId,
    publicKey: fetchedKey.publicKey,
    keyAlgorithm: fetchedKey.keyAlgorithm,
    pinnedAt,
  };
  await storage.setItem(
    getYearnRecipientKeyPinStorageKey(ownerUserId, fetchedKey.userId),
    JSON.stringify(pinned),
  );
  return pinned;
}

export function evaluateYearnRecipientKeyTrust(
  pinned: YearnPinnedRecipientKey | null,
  fetchedKey: YearnE2eeDevicePublicKey,
): 'first-use' | 'pinned-match' | 'changed' {
  if (!pinned) return 'first-use';
  return pinned.publicKey === fetchedKey.publicKey ? 'pinned-match' : 'changed';
}

/**
 * Trust-on-first-use guard for the server-published recipient key directory.
 * First use pins the key locally; a later mismatch throws
 * YearnRecipientKeyChangedError unless the caller explicitly accepts the new
 * key after surfacing the change to the user.
 */
export async function assertTrustedYearnRecipientKey({
  storage,
  ownerUserId,
  fetchedKey,
  acceptChangedKey = false,
}: {
  storage: YearnE2eeStorage;
  ownerUserId: string;
  fetchedKey: YearnE2eeDevicePublicKey;
  acceptChangedKey?: boolean;
}): Promise<YearnRecipientKeyTrust> {
  let pinned: YearnPinnedRecipientKey | null;
  try {
    pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, fetchedKey.userId);
  } catch (err) {
    if (err instanceof YearnPinUnreadableError) {
      // Corrupt pin: require the same explicit acceptance a key change demands
      // before overwriting it. Never silently re-pin.
      if (!acceptChangedKey) {
        throw new YearnRecipientKeyChangedError({
          recipientUserId: fetchedKey.userId,
          pinnedPublicKey: '',
          fetchedPublicKey: fetchedKey.publicKey,
        });
      }
      await pinYearnRecipientKey(storage, ownerUserId, fetchedKey);
      return 'changed-accepted';
    }
    throw err;
  }
  const trust = evaluateYearnRecipientKeyTrust(pinned, fetchedKey);

  if (trust === 'first-use') {
    await pinYearnRecipientKey(storage, ownerUserId, fetchedKey);
    return 'first-use';
  }

  if (trust === 'pinned-match') {
    return 'pinned-match';
  }

  if (!acceptChangedKey) {
    throw new YearnRecipientKeyChangedError({
      recipientUserId: fetchedKey.userId,
      pinnedPublicKey: pinned?.publicKey ?? '',
      fetchedPublicKey: fetchedKey.publicKey,
    });
  }

  await pinYearnRecipientKey(storage, ownerUserId, fetchedKey);
  return 'changed-accepted';
}

export type YearnSenderKeyTrust = 'first-use' | 'pinned-match' | 'changed' | 'unreadable';

export interface YearnSenderKeyDecision {
  trust: YearnSenderKeyTrust;
  /**
   * The public key the caller should require for decryption: the pinned key on
   * a match, or the freshly-pinned key on first use. Null when the pin is
   * unreadable or the incoming key differs from the pinned one (decryption must
   * be refused and the change surfaced to the user).
   */
  trustedPublicKey: string | null;
}

/**
 * Receive-path trust-on-first-use for an incoming message's sender key. Pins the
 * sender's device key on first sight and, on any later mismatch or an unreadable
 * pin, returns a non-'match' trust with a null trustedPublicKey so the caller
 * refuses to render the message as authentic. This is the receive-side mirror of
 * assertTrustedYearnRecipientKey and closes the sender-impersonation gap where a
 * match partner (or a rogue device) sends under a fresh, never-pinned key.
 *
 * Non-throwing: safe to drive UI state from.
 */
export async function resolveTrustedYearnSenderKey({
  storage,
  ownerUserId,
  senderUserId,
  incomingKey,
}: {
  storage: YearnE2eeStorage;
  ownerUserId: string;
  senderUserId: string;
  incomingKey: YearnE2eeDevicePublicKey;
}): Promise<YearnSenderKeyDecision> {
  let pinned: YearnPinnedRecipientKey | null;
  try {
    pinned = await loadPinnedYearnRecipientKey(storage, ownerUserId, senderUserId);
  } catch (err) {
    if (err instanceof YearnPinUnreadableError) {
      return { trust: 'unreadable', trustedPublicKey: null };
    }
    throw err;
  }

  const trust = evaluateYearnRecipientKeyTrust(pinned, incomingKey);
  if (trust === 'first-use') {
    await pinYearnRecipientKey(storage, ownerUserId, incomingKey);
    return { trust: 'first-use', trustedPublicKey: incomingKey.publicKey };
  }
  if (trust === 'pinned-match') {
    return { trust: 'pinned-match', trustedPublicKey: pinned?.publicKey ?? incomingKey.publicKey };
  }
  return { trust: 'changed', trustedPublicKey: null };
}
