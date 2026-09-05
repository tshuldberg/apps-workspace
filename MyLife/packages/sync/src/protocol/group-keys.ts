/**
 * Workspace epoch group keys (plan 14, M3: MK-021/022/023).
 *
 * v1 "rotation" bumped an integer (current_key_version) and invalidated wrap
 * rows, but nothing ever generated a real workspace secret, wrapped it for
 * members, or used it to encrypt anything. This module is the real thing, in
 * the MLS shape without the MLS library:
 *
 *  - A COMMIT mints a fresh 32-byte epoch secret and advances the epoch.
 *  - The committer WRAPS the secret once per current member: an ephemeral
 *    X25519 key against the member's static DH key (from their signed identity
 *    bundle), HKDF to a wrap key, authenticated secretbox. Wrap rows live in
 *    the existing sync_workspace_keys table (blob = ephPub || nonce || box).
 *  - A removed member simply gets no wrap for the new epoch: post-removal
 *    traffic under epoch N+1 is unreadable with any secret it holds.
 *  - Workspace session traffic encrypts under HKDF(epochSecret, info), not the
 *    pairwise pair key (MK-022); pairwise remains only as the migration
 *    fallback when the two sides do not share a current epoch.
 *
 * Honest scope (per the MK-021 spike report): this is pairwise fan-out, O(n)
 * wraps per commit -- fine at workspace scale (relay caps peers at 8). It is
 * NOT TreeKEM: no log-scaling, no per-message ratchet, no formal MLS
 * guarantees. OpenMLS (Rust, via uniffi) is the adoption path when groups grow;
 * the schema and call sites here are shaped so that swap is local to this file.
 * Commit DISTRIBUTION (sending wrap rows to members) rides the same future
 * gossip transport as MK-018 introductions and MK-019 revocations.
 */

import nacl from 'tweetnacl';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, HistoryScope, SyncWorkspaceKeyWrap } from '../types';
import { extractDhPrivateKeyHex } from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hkdf } from '../node/hkdf';
import { getKeyWraps, insertKeyWrap, invalidateKeyVersion, replaceKeyWrap } from '../db/queries';

const EPH_PUB_BYTES = 32;
const NONCE_BYTES = nacl.secretbox.nonceLength; // 24
const SECRET_BYTES = 32;

/** The physical table key wraps live in (and replicate as, in community mode). */
export const SYNC_WORKSPACE_KEYS_TABLE = 'sync_workspace_keys';

/**
 * Record a key-wrap row for replication over the sync engine. The same shape as
 * the engine's recordChange so a caller can pass `engine.recordChange` directly.
 * The blob is carried as HEX (see keyWrapToSyncedRow) so it survives the plain-
 * JSON change log + LWW document layer; the inbound apply re-hydrates it through
 * storeReceivedKeyWrap.
 */
export type RecordKeyWrapChange = (
  table: string,
  operation: 'INSERT',
  rowId: string,
  data: Record<string, unknown>,
) => void;

/** Stable per-wrap row id: one wrap per (workspace, epoch, recipient device). */
export function keyWrapSyncRowId(wrap: SyncWorkspaceKeyWrap): string {
  return `${wrap.workspaceId}:${wrap.keyVersion}:${wrap.wrappedForDeviceId}`;
}

const toWrapBytes = (blob: Uint8Array | ArrayBufferLike): Uint8Array =>
  blob instanceof Uint8Array ? blob : new Uint8Array(blob);

/**
 * Wrap row as a plain-JSON, replication-safe record: the binary blob becomes a
 * hex string so it crosses the TEXT change log + JSON document intact. Each wrap
 * is already sealed to ONE member's DH key, so replicating it leaks nothing.
 */
export function keyWrapToSyncedRow(wrap: SyncWorkspaceKeyWrap): Record<string, unknown> {
  return {
    workspace_id: wrap.workspaceId,
    key_version: wrap.keyVersion,
    wrapped_for_device_id: wrap.wrappedForDeviceId,
    wrapped_key_blob: bytesToHex(toWrapBytes(wrap.wrappedKeyBlob)),
    valid_from: wrap.validFrom,
    valid_until: wrap.validUntil,
  };
}

/** Reverse of keyWrapToSyncedRow: a received row back to a wrap, or null if malformed. */
export function keyWrapFromSyncedRow(data: Record<string, unknown>): SyncWorkspaceKeyWrap | null {
  const workspaceId = data.workspace_id;
  const keyVersion = data.key_version;
  const wrappedForDeviceId = data.wrapped_for_device_id;
  const blobHex = data.wrapped_key_blob;
  const validFrom = data.valid_from;
  if (
    typeof workspaceId !== 'string'
    || typeof keyVersion !== 'number'
    || typeof wrappedForDeviceId !== 'string'
    || typeof blobHex !== 'string'
    || typeof validFrom !== 'string'
  ) {
    return null;
  }
  let wrappedKeyBlob: Uint8Array;
  try {
    wrappedKeyBlob = hexToBytes(blobHex);
  } catch {
    return null;
  }
  if (wrappedKeyBlob.length <= EPH_PUB_BYTES + NONCE_BYTES) return null;
  const validUntil = typeof data.valid_until === 'string' ? data.valid_until : null;
  return { workspaceId, keyVersion, wrappedForDeviceId, wrappedKeyBlob, validFrom, validUntil };
}

const wrapInfo = (workspaceId: string, epoch: number) =>
  `meerkat-epoch-wrap-v1:${workspaceId}:${epoch}`;
const contentInfo = (workspaceId: string, epoch: number) =>
  `meerkat-epoch-content-v1:${workspaceId}:${epoch}`;

/** A workspace member the committer can wrap for. */
export interface GroupMemberKey {
  deviceId: string;
  /** X25519 public key hex (from the member's signed identity bundle). */
  dhPublicKey: string;
}

export interface GroupCommitInput {
  workspaceId: string;
  committer: DeviceIdentity;
  /**
   * The members of the NEW epoch (committer included). A removed device is
   * excluded here -- exclusion IS the revocation of access.
   */
  members: GroupMemberKey[];
  /**
   * Optional replication seam: when present, every wrap row written is also
   * recorded through the sync engine so it replicates to members as a
   * shared_workspace change. Pass `engine.recordChange`. Omit for local-only
   * commits (e.g. a personal workspace) where nothing needs to leave the device.
   */
  recordChange?: RecordKeyWrapChange;
  now?: string;
}

export interface GroupCommitResult {
  epoch: number;
  /** The new epoch secret (the committer already holds it; also wrapped to self). */
  secret: Uint8Array;
  wrappedFor: string[];
}

/** Wrap an epoch secret for one member: ephPub || nonce || secretbox. */
function wrapSecret(secret: Uint8Array, memberDhPublicKeyHex: string, info: string): Uint8Array {
  const eph = nacl.box.keyPair();
  const shared = nacl.box.before(hexToBytes(memberDhPublicKeyHex), eph.secretKey);
  const key = hkdf(shared, info);
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(secret, nonce, key);
  const blob = new Uint8Array(EPH_PUB_BYTES + NONCE_BYTES + box.length);
  blob.set(eph.publicKey, 0);
  blob.set(nonce, EPH_PUB_BYTES);
  blob.set(box, EPH_PUB_BYTES + NONCE_BYTES);
  return blob;
}

/** Open a wrap blob with this device's DH private key. Null on any failure. */
function unwrapSecret(blob: Uint8Array, dhPrivateKeyHex: string, info: string): Uint8Array | null {
  if (blob.length <= EPH_PUB_BYTES + NONCE_BYTES) return null;
  try {
    const ephPub = blob.slice(0, EPH_PUB_BYTES);
    const nonce = blob.slice(EPH_PUB_BYTES, EPH_PUB_BYTES + NONCE_BYTES);
    const box = blob.slice(EPH_PUB_BYTES + NONCE_BYTES);
    const shared = nacl.box.before(ephPub, hexToBytes(dhPrivateKeyHex));
    const key = hkdf(shared, info);
    const opened = nacl.secretbox.open(box, nonce, key);
    return opened ?? null;
  } catch {
    return null;
  }
}

/** The workspace's current epoch number, from sync_workspaces. */
export function getWorkspaceEpoch(db: DatabaseAdapter, workspaceId: string): number {
  const rows = db.query<{ current_key_version: number }>(
    'SELECT current_key_version FROM sync_workspaces WHERE id = ?',
    [workspaceId],
  );
  return rows[0]?.current_key_version ?? 0;
}

/**
 * Mint a new epoch: fresh secret, epoch = current + 1, one wrap row per member
 * of the new epoch, old wraps invalidated. The caller chooses the member list;
 * leaving a device out (removal) is what revokes its access to new traffic.
 */
export function createGroupCommit(db: DatabaseAdapter, input: GroupCommitInput): GroupCommitResult {
  if (input.members.length === 0) {
    throw new Error('A group commit needs at least one member (the committer).');
  }
  const secret = nacl.randomBytes(SECRET_BYTES);
  const previous = getWorkspaceEpoch(db, input.workspaceId);
  const epoch = previous + 1;
  const now = input.now ?? new Date().toISOString();

  db.transaction(() => {
    if (previous >= 1) invalidateKeyVersion(db, input.workspaceId, previous);
    for (const member of input.members) {
      writeKeyWrap(db, {
        workspaceId: input.workspaceId,
        keyVersion: epoch,
        wrappedForDeviceId: member.deviceId,
        wrappedKeyBlob: wrapSecret(secret, member.dhPublicKey, wrapInfo(input.workspaceId, epoch)),
        validFrom: now,
        validUntil: null,
      }, input.recordChange);
    }
    db.execute(
      'UPDATE sync_workspaces SET current_key_version = ?, rotated_at = ? WHERE id = ?',
      [epoch, now, input.workspaceId],
    );
  });

  return { epoch, secret, wrappedFor: input.members.map((m) => m.deviceId) };
}

/** Insert a wrap locally and, if a recorder is provided, queue it for replication. */
function writeKeyWrap(
  db: DatabaseAdapter,
  wrap: SyncWorkspaceKeyWrap,
  recordChange?: RecordKeyWrapChange,
): void {
  insertKeyWrap(db, wrap);
  recordChange?.(SYNC_WORKSPACE_KEYS_TABLE, 'INSERT', keyWrapSyncRowId(wrap), keyWrapToSyncedRow(wrap));
}

/** Read + unwrap this device's epoch secret. Null if no wrap or wrong key. */
export function unwrapEpochSecret(
  db: DatabaseAdapter,
  workspaceId: string,
  epoch: number,
  identity: DeviceIdentity,
): Uint8Array | null {
  const dhPrivateKeyHex = extractDhPrivateKeyHex(identity.privateKeyRef);
  if (!dhPrivateKeyHex) return null;
  const wrap = getKeyWraps(db, workspaceId, epoch)
    .find((w) => w.wrappedForDeviceId === identity.publicKey);
  if (!wrap) return null;
  const blob = wrap.wrappedKeyBlob instanceof Uint8Array
    ? wrap.wrappedKeyBlob
    : new Uint8Array(wrap.wrappedKeyBlob as ArrayBufferLike);
  return unwrapSecret(blob, dhPrivateKeyHex, wrapInfo(workspaceId, epoch));
}

/** This device's view of the current epoch: number + unwrapped secret. */
export function getCurrentEpochKey(
  db: DatabaseAdapter,
  workspaceId: string,
  identity: DeviceIdentity,
): { epoch: number; secret: Uint8Array } | null {
  const epoch = getWorkspaceEpoch(db, workspaceId);
  if (epoch < 1) return null;
  const secret = unwrapEpochSecret(db, workspaceId, epoch, identity);
  return secret ? { epoch, secret } : null;
}

/** The symmetric content key workspace session payloads encrypt under (MK-022). */
export function deriveEpochContentKey(
  secret: Uint8Array,
  workspaceId: string,
  epoch: number,
): Uint8Array {
  return hkdf(secret, contentInfo(workspaceId, epoch));
}

/**
 * Does this wrap blob open with `identity`'s DH key for its workspace + epoch?
 * PURE (no write): a caller can pre-validate that an inbound handoff carries a
 * usable self-wrap BEFORE committing any state (dm-group-handoff-core AM4).
 */
export function keyWrapOpensForDevice(wrap: SyncWorkspaceKeyWrap, identity: DeviceIdentity): boolean {
  const dhPrivateKeyHex = extractDhPrivateKeyHex(identity.privateKeyRef);
  if (!dhPrivateKeyHex) return false;
  return unwrapSecret(
    toWrapBytes(wrap.wrappedKeyBlob),
    dhPrivateKeyHex,
    wrapInfo(wrap.workspaceId, wrap.keyVersion),
  ) !== null;
}

function advanceWorkspaceEpoch(db: DatabaseAdapter, wrap: SyncWorkspaceKeyWrap): void {
  db.execute(
    'UPDATE sync_workspaces SET current_key_version = ?, rotated_at = ? WHERE id = ? AND current_key_version < ?',
    [wrap.keyVersion, wrap.validFrom, wrap.workspaceId, wrap.keyVersion],
  );
}

/**
 * Store a wrap row received over the wire (the distribution seam).
 *
 * When `recipient` is supplied (the replication path), the epoch pointer only
 * ever moves to a version this device can actually READ, and a verified
 * self-wrap supersedes any earlier unopenable row in the same slot. This denies
 * a malicious but authorized member two griefs that are otherwise possible
 * because any member can author key-wrap rows:
 *   - fast-forwarding current_key_version to a bogus/foreign epoch, stranding
 *     this device with no readable key for the real current epoch, and
 *   - first-wins poisoning of this device's own wrap slot.
 * A wrap addressed to ANOTHER device is still stored (idempotently) so it can
 * gossip onward to its real recipient, but it never moves this device's pointer.
 * With no recipient (local callers / direct unit use) the legacy advance-on-
 * higher-version behavior is preserved.
 */
export function storeReceivedKeyWrap(
  db: DatabaseAdapter,
  wrap: SyncWorkspaceKeyWrap,
  recipient?: DeviceIdentity,
): void {
  if (recipient && wrap.wrappedForDeviceId === recipient.publicKey) {
    if (!keyWrapOpensForDevice(wrap, recipient)) {
      // Unopenable self-wrap: store without clobbering a good row, never advance.
      insertKeyWrap(db, wrap);
      return;
    }
    // Openable self-wrap wins the slot (supersedes any poison) and advances.
    replaceKeyWrap(db, wrap);
    advanceWorkspaceEpoch(db, wrap);
    return;
  }
  insertKeyWrap(db, wrap);
  // A foreign wrap (recipient set, but addressed elsewhere) is gossip-only: it
  // never advances this device's epoch. Without a recipient, keep legacy behavior.
  if (!recipient) advanceWorkspaceEpoch(db, wrap);
}

// ---------------------------------------------------------------------------
// Membership ops as commits (MK-023) -- replaces the integer-bump rotation
// ---------------------------------------------------------------------------

export interface MembershipCommitInput {
  workspaceId: string;
  committer: DeviceIdentity;
  /** The CURRENT epoch's members with their DH keys (committer included). */
  members: GroupMemberKey[];
  /** Replication seam (see GroupCommitInput.recordChange). */
  recordChange?: RecordKeyWrapChange;
  now?: string;
}

/**
 * Add a member: record membership, then commit a new epoch wrapped for the old
 * members PLUS the newcomer. Under `historyScope: 'join_point'` the newcomer can
 * read traffic from this epoch on only (earlier epochs were never wrapped for
 * it). Under `historyScope: 'full'` (default) the committer ALSO back-wraps every
 * prior epoch secret it can still read to the newcomer, so they can decrypt all
 * historical snapshots -- the deliberate, owner-approved "true feed" relaxation.
 * Because wrapSecret is module-private, the back-wrap loop MUST live here.
 */
export function commitMemberAdd(
  db: DatabaseAdapter,
  input: MembershipCommitInput & {
    added: GroupMemberKey;
    invitedByDeviceId?: string;
    role?: string;
    historyScope?: HistoryScope;
  },
): GroupCommitResult {
  const now = input.now ?? new Date().toISOString();
  db.execute(
    `INSERT OR REPLACE INTO sync_workspace_members (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [input.workspaceId, input.added.deviceId, input.role ?? 'member',
      input.invitedByDeviceId ?? input.committer.publicKey, now],
  );
  const result = createGroupCommit(db, {
    workspaceId: input.workspaceId,
    committer: input.committer,
    members: [...input.members, input.added],
    recordChange: input.recordChange,
    now,
  });

  // Full history: back-wrap every prior epoch the committer can still open to the
  // newcomer. join_point skips this (forward secrecy by exclusion preserved).
  if ((input.historyScope ?? 'full') === 'full' && result.epoch > 1) {
    db.transaction(() => {
      for (let epoch = 1; epoch < result.epoch; epoch += 1) {
        const secret = unwrapEpochSecret(db, input.workspaceId, epoch, input.committer);
        if (!secret) continue; // committer never held this epoch -> cannot back-wrap it
        writeKeyWrap(db, {
          workspaceId: input.workspaceId,
          keyVersion: epoch,
          wrappedForDeviceId: input.added.deviceId,
          wrappedKeyBlob: wrapSecret(secret, input.added.dhPublicKey, wrapInfo(input.workspaceId, epoch)),
          validFrom: now,
          validUntil: null,
        }, input.recordChange);
      }
    });
  }

  return result;
}

/**
 * Remove a member: mark the membership removed, then commit a new epoch
 * wrapped for everyone EXCEPT the removed device. This replaces the v1
 * integer-bump rotateWorkspaceKey: the rotation is real because the removed
 * device holds no wrap for the new secret -- post-removal traffic is
 * unreadable to it (MK-023 acceptance).
 */
export function commitMemberRemoval(
  db: DatabaseAdapter,
  input: MembershipCommitInput & { removedDeviceId: string },
): GroupCommitResult {
  const now = input.now ?? new Date().toISOString();
  db.execute(
    'UPDATE sync_workspace_members SET removed_at = ? WHERE workspace_id = ? AND device_id = ? AND removed_at IS NULL',
    [now, input.workspaceId, input.removedDeviceId],
  );
  return createGroupCommit(db, {
    workspaceId: input.workspaceId,
    committer: input.committer,
    members: input.members.filter((m) => m.deviceId !== input.removedDeviceId),
    recordChange: input.recordChange,
    now,
  });
}
