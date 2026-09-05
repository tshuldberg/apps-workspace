/**
 * Library objects (Plan 38 Phase 0 -- the D.3 sealing decision, binding).
 *
 * A library blob is a SEALED SHARE (sealed-share.ts mechanics: chunked at-rest
 * encryption, plaintext-Merkle contentId, author-signed manifest, opaque
 * blocks in a NodeStore) whose random per-object key -- the DEK, identical in
 * shape to a share linkKey -- is NOT a bearer link. It travels wrapped under a
 * key derived from the WORKSPACE EPOCH SECRET, inside the signed
 * cm_library_items row (`key_epoch` + `wrapped_key` columns). Membership is
 * therefore the read capability:
 *
 * - A receiver unwraps via its epoch-wrap history (unwrapEpochSecret), so
 *   historyScope governs late joiners exactly as it does messages: `full`
 *   back-wraps let a newcomer read old items; `join_point` leaves pre-join
 *   items honestly locked.
 * - A removed member keeps what it already held (same boundary as messages);
 *   items authored under the post-removal epoch are unreadable to it.
 * - The DEK never appears in plaintext at rest outside the wrap; blob bytes
 *   are encrypted at rest (unlike Model-A channel attachments).
 *
 * Domain separation: the wrap key derives under 'meerkat-library-wrap-v1',
 * distinct from the epoch content key ('meerkat-epoch-content-v1') and the
 * epoch wrap ('meerkat-epoch-wrap-v1'), so library wraps can never be
 * confused with session payload keys.
 */

import nacl from 'tweetnacl';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hkdf } from '../node/hkdf';
import { unwrapEpochSecret } from './group-keys';
import {
  createSealedShare,
  openSealedShare,
  type CreateSealedShareOptions,
  type OpenResult,
  type SealedShare,
} from '../node/sealed-share';

const NONCE_BYTES = nacl.secretbox.nonceLength;
const DEK_BYTES = nacl.secretbox.keyLength;

const libraryWrapInfo = (workspaceId: string, epoch: number) =>
  `meerkat-library-wrap-v1:${workspaceId}:${epoch}`;

/** The symmetric key library DEK wraps are sealed under for one epoch. */
export function deriveEpochLibraryWrapKey(
  epochSecret: Uint8Array,
  workspaceId: string,
  epoch: number,
): Uint8Array {
  return hkdf(epochSecret, libraryWrapInfo(workspaceId, epoch));
}

/**
 * Wrap a per-object DEK under the workspace epoch: hex(nonce || secretbox).
 * The result rides the SIGNED library item row -- tamper breaks the row
 * signature before this wrap is ever opened.
 */
export function wrapLibraryObjectKey(
  dek: Uint8Array,
  epochSecret: Uint8Array,
  workspaceId: string,
  epoch: number,
): string {
  if (dek.length !== DEK_BYTES) {
    throw new Error('A library object key must be a 32-byte secretbox key.');
  }
  const wrapKey = deriveEpochLibraryWrapKey(epochSecret, workspaceId, epoch);
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(dek, nonce, wrapKey);
  const blob = new Uint8Array(NONCE_BYTES + box.length);
  blob.set(nonce, 0);
  blob.set(box, NONCE_BYTES);
  return bytesToHex(blob);
}

/** Open a wrapped DEK. Null on any failure (wrong epoch/workspace/tamper). */
export function unwrapLibraryObjectKey(
  wrappedHex: string,
  epochSecret: Uint8Array,
  workspaceId: string,
  epoch: number,
): Uint8Array | null {
  let blob: Uint8Array;
  try {
    blob = hexToBytes(wrappedHex);
  } catch {
    return null;
  }
  if (blob.length <= NONCE_BYTES) return null;
  const wrapKey = deriveEpochLibraryWrapKey(epochSecret, workspaceId, epoch);
  const nonce = blob.slice(0, NONCE_BYTES);
  const box = blob.slice(NONCE_BYTES);
  const opened = nacl.secretbox.open(box, nonce, wrapKey);
  if (!opened || opened.length !== DEK_BYTES) return null;
  return opened;
}

/**
 * Unwrap a library object key AS THIS DEVICE: resolves the epoch secret from
 * the device's wrap history (so historyScope + removal semantics apply), then
 * opens the DEK wrap. Null when this device holds no wrap for `keyEpoch` --
 * the caller renders the honest locked state, never a fake error.
 */
export function unwrapLibraryObjectKeyForDevice(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  workspaceId: string,
  keyEpoch: number,
  wrappedHex: string,
): Uint8Array | null {
  const epochSecret = unwrapEpochSecret(db, workspaceId, keyEpoch, identity);
  if (!epochSecret) return null;
  return unwrapLibraryObjectKey(wrappedHex, epochSecret, workspaceId, keyEpoch);
}

export interface SealLibraryObjectOptions {
  workspaceId: string;
  /** The epoch the DEK wraps under (normally the CURRENT epoch). */
  epoch: number;
  epochSecret: Uint8Array;
  name: string;
  identity: DeviceIdentity;
  chunkSize?: number;
  createdAt?: string;
}

export interface SealedLibraryObject {
  share: SealedShare;
  /** Plaintext-derived content id (the Merkle root) -- the row's content_cid. */
  contentId: string;
  /** hex(nonce || secretbox(DEK)) -- the row's wrapped_key. */
  wrappedKey: string;
  /** The epoch the wrap opens under -- the row's key_epoch. */
  keyEpoch: number;
}

/**
 * Seal bytes as a library object: sealed share at shared_workspace scope, DEK
 * wrapped under the workspace epoch. The raw DEK is intentionally NOT
 * returned -- the wrap is the only durable form.
 */
export function sealLibraryObject(
  content: Uint8Array,
  options: SealLibraryObjectOptions,
): SealedLibraryObject {
  const shareOptions: CreateSealedShareOptions = {
    name: options.name,
    identity: options.identity,
    scope: 'shared_workspace',
    ...(options.chunkSize !== undefined ? { chunkSize: options.chunkSize } : {}),
    ...(options.createdAt !== undefined ? { createdAt: options.createdAt } : {}),
  };
  const { share, linkKey } = createSealedShare(content, shareOptions);
  const wrappedKey = wrapLibraryObjectKey(linkKey, options.epochSecret, options.workspaceId, options.epoch);
  linkKey.fill(0);
  return {
    share,
    contentId: share.manifest.contentId,
    wrappedKey,
    keyEpoch: options.epoch,
  };
}

/**
 * Open a library object with a wrapped key: unwrap under the epoch, then run
 * the full verify-then-open sealed-share path (manifest signature, content id,
 * per-chunk hash, authenticated decrypt -- all fail-closed).
 */
export function openLibraryObject(
  share: SealedShare,
  wrappedKey: string,
  epochSecret: Uint8Array,
  workspaceId: string,
  keyEpoch: number,
  options?: { expectedAuthor?: string },
): OpenResult {
  const dek = unwrapLibraryObjectKey(wrappedKey, epochSecret, workspaceId, keyEpoch);
  if (!dek) return { ok: false, reason: 'chunk-decrypt-failed' };
  try {
    return openSealedShare(share, dek, options);
  } finally {
    dek.fill(0);
  }
}
