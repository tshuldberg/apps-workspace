/**
 * Per-entity content keys + crypto-shredding (plan 14, MK-024; design D10.5).
 *
 * Some rows must be erasable AFTER they have replicated: disappearing messages
 * past their TTL, sensitive entities the user deletes. You cannot reach into a
 * peer's database -- but you can make the data unreadable everywhere at once by
 * never replicating plaintext in the first place. Where policy demands it
 * (disappearing tables, isSensitive modules), the entity's payload is encrypted
 * under its OWN random key before it syncs; the key stays local to each member
 * (distributed once like any wrap, never alongside the ciphertext). Destroying
 * the key IS the erasure: every replica of the ciphertext, on every device and
 * every relay mailbox, becomes unreadable simultaneously.
 *
 * Honest boundaries (see docs/designs/meerkat-erasure-runbook.md):
 *  - Destruction is local-first: the destroy must itself gossip (a signed
 *    "shred" record, same seam as MK-019 revocations) for peers to drop their
 *    key copies. Until a peer applies it, that peer can still decrypt.
 *  - SQLite does not guarantee dead pages are zeroed. We overwrite the key row
 *    before deleting it, which removes it from the live database; full
 *    page-level erasure relies on the platform store (SQLCipher /
 *    secure_delete) and is documented in the runbook.
 */

import nacl from 'tweetnacl';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { encrypt, decrypt } from '../encryption/encrypt';
import { isDisappearingMessageTable } from '../expiry/disappearing-messages';

const KEY_BYTES = 32;

export interface EntityKeyRef {
  moduleId: string;
  tableName: string;
  rowId: string;
}

/** Whether policy demands a per-entity content key for this table (MK-024). */
export function entityRequiresContentKey(
  policy: ModuleSyncPolicy | undefined,
  tableName: string,
): boolean {
  if (!policy) return false;
  if (policy.isSensitive) return true;
  return isDisappearingMessageTable(tableName);
}

/** The entity's key, minting one on first use. */
export function getOrCreateEntityKey(db: DatabaseAdapter, ref: EntityKeyRef): Uint8Array {
  const existing = getEntityKey(db, ref);
  if (existing) return existing;
  const key = nacl.randomBytes(KEY_BYTES);
  db.execute(
    `INSERT OR IGNORE INTO sync_entity_keys (module_id, table_name, row_id, key_hex, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [ref.moduleId, ref.tableName, ref.rowId, bytesToHex(key), new Date().toISOString()],
  );
  // INSERT OR IGNORE: under a race the first writer wins; read back the truth.
  return getEntityKey(db, ref) ?? key;
}

/** The entity's key, or null if never minted or already shredded. */
export function getEntityKey(db: DatabaseAdapter, ref: EntityKeyRef): Uint8Array | null {
  const rows = db.query<{ key_hex: string }>(
    'SELECT key_hex FROM sync_entity_keys WHERE module_id = ? AND table_name = ? AND row_id = ?',
    [ref.moduleId, ref.tableName, ref.rowId],
  );
  if (!rows[0]) return null;
  try {
    const key = hexToBytes(rows[0].key_hex);
    return key.length === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

/**
 * Crypto-shred: overwrite the key in place, then delete the row. After this,
 * ciphertext sealed under the key is unreadable here forever. Returns true if
 * a key existed. Gossiping the shred to peers is the MK-019-style seam.
 */
export function destroyEntityKey(db: DatabaseAdapter, ref: EntityKeyRef): boolean {
  const existing = getEntityKey(db, ref);
  if (!existing) return false;
  db.transaction(() => {
    db.execute(
      'UPDATE sync_entity_keys SET key_hex = ? WHERE module_id = ? AND table_name = ? AND row_id = ?',
      ['0'.repeat(KEY_BYTES * 2), ref.moduleId, ref.tableName, ref.rowId],
    );
    db.execute(
      'DELETE FROM sync_entity_keys WHERE module_id = ? AND table_name = ? AND row_id = ?',
      [ref.moduleId, ref.tableName, ref.rowId],
    );
  });
  return true;
}

/** Wire form of a per-entity-sealed payload (replicates instead of plaintext). */
export interface SealedEntityPayload {
  shredded: false;
  version: 1;
  algorithm: 'xsalsa20-poly1305';
  nonceHex: string;
  ciphertextHex: string;
}

/** Seal an entity payload under its content key. */
export function sealEntityPayload(key: Uint8Array, payload: unknown): SealedEntityPayload {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = encrypt(plaintext, key);
  return {
    shredded: false,
    version: 1,
    algorithm: 'xsalsa20-poly1305',
    nonceHex: bytesToHex(sealed.nonce),
    ciphertextHex: bytesToHex(sealed.ciphertext),
  };
}

/** Open a sealed entity payload. Null if the key is wrong, shredded, or absent. */
export function openEntityPayload<T>(key: Uint8Array | null, sealed: SealedEntityPayload): T | null {
  if (!key) return null;
  try {
    const plaintext = decrypt(hexToBytes(sealed.ciphertextHex), hexToBytes(sealed.nonceHex), key);
    if (!plaintext) return null;
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
