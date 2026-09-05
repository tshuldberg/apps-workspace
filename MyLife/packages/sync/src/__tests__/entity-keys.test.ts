/**
 * MK-024 -- per-entity content keys + crypto-shredding (D10.5). The acceptance:
 * destroying the key renders REPLICATED ciphertext unreadable. The replica is
 * simulated exactly as it exists in the wild: the sealed payload bytes live on
 * another device / a relay mailbox, out of reach -- only the key can die.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { createSyncTables } from '../db/schema';
import {
  destroyEntityKey,
  entityRequiresContentKey,
  getEntityKey,
  getOrCreateEntityKey,
  openEntityPayload,
  sealEntityPayload,
} from '../protocol/entity-keys';

const REF = { moduleId: 'mood', tableName: 'mo_entries', rowId: 'e1' };

let db: InMemoryTestDatabase;
beforeEach(() => { db = createInMemoryTestDatabase(); createSyncTables(db.adapter); });
afterEach(() => { db.close(); });

describe('entity content keys (MK-024)', () => {
  it('mints once and is stable across reads', () => {
    const k1 = getOrCreateEntityKey(db.adapter, REF);
    const k2 = getOrCreateEntityKey(db.adapter, REF);
    expect(k1).toHaveLength(32);
    expect(k2).toEqual(k1);
    expect(getEntityKey(db.adapter, REF)).toEqual(k1);
  });

  it('seal/open round-trips under the entity key', () => {
    const key = getOrCreateEntityKey(db.adapter, REF);
    const sealed = sealEntityPayload(key, { mood: 'good', note: 'private' });
    expect(openEntityPayload(getEntityKey(db.adapter, REF), sealed)).toEqual({ mood: 'good', note: 'private' });
  });

  it('CRYPTO-SHREDDING: destroying the key renders the replicated ciphertext unreadable', () => {
    const key = getOrCreateEntityKey(db.adapter, REF);
    // The sealed payload has replicated: a peer's DB and a relay mailbox hold
    // these exact bytes. We cannot touch them -- only our key.
    const replicatedCiphertext = sealEntityPayload(key, { note: 'to be erased everywhere' });
    expect(openEntityPayload(getEntityKey(db.adapter, REF), replicatedCiphertext)).not.toBeNull();

    expect(destroyEntityKey(db.adapter, REF)).toBe(true);

    // The key is gone from the live database...
    expect(getEntityKey(db.adapter, REF)).toBeNull();
    expect(
      db.adapter.query('SELECT * FROM sync_entity_keys WHERE row_id = ?', [REF.rowId]),
    ).toHaveLength(0);
    // ...and the replica that still exists elsewhere can never be opened here.
    expect(openEntityPayload(getEntityKey(db.adapter, REF), replicatedCiphertext)).toBeNull();
  });

  it('destroy is idempotent and false when no key was ever minted', () => {
    expect(destroyEntityKey(db.adapter, REF)).toBe(false);
    getOrCreateEntityKey(db.adapter, REF);
    expect(destroyEntityKey(db.adapter, REF)).toBe(true);
    expect(destroyEntityKey(db.adapter, REF)).toBe(false);
  });

  it('a re-created row gets a FRESH key that cannot open the old ciphertext', () => {
    const oldKey = getOrCreateEntityKey(db.adapter, REF);
    const oldSealed = sealEntityPayload(oldKey, { note: 'old life' });
    destroyEntityKey(db.adapter, REF);

    const newKey = getOrCreateEntityKey(db.adapter, REF);
    expect(newKey).not.toEqual(oldKey);
    expect(openEntityPayload(newKey, oldSealed)).toBeNull();
  });

  it('entityRequiresContentKey: sensitive modules and disappearing tables demand a key', () => {
    const sensitive: ModuleSyncPolicy = { defaultScope: 'personal_replica', shareable: true, isSensitive: true, entityRules: [] };
    const plain: ModuleSyncPolicy = { defaultScope: 'personal_replica', shareable: true, entityRules: [] };
    expect(entityRequiresContentKey(sensitive, 'hl_vitals')).toBe(true);
    expect(entityRequiresContentKey(plain, 'nt_notes')).toBe(false);
    expect(entityRequiresContentKey(undefined, 'nt_notes')).toBe(false);
    // Disappearing-message tables require a key even in a non-sensitive module.
    expect(entityRequiresContentKey(plain, 'mk_messages')).toBe(true);
  });
});
