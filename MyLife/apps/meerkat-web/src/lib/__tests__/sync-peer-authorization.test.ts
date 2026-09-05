import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { configureSyncSecretStore, createInMemorySyncSecretStore, createSyncTables, generateDeviceIdentity, insertPairedDevice, recordSasVerification } from '@mylife/sync';
import { isMeerkatOwnSyncDevice as web } from '../sync-peer-authorization';
import { isMeerkatOwnSyncDevice as mobile } from '../../../../meerkat/app/(root)/data/sync-peer-authorization';
let database: InMemoryTestDatabase;
beforeEach(() => { database = createInMemoryTestDatabase(); configureSyncSecretStore(createInMemorySyncSecretStore()); });
afterEach(() => database.close());
describe.each([web, mobile])('personal sync ownership', (authorized) => {
  it('requires an explicit own link, verified pairing, matching identity and current DH key', () => {
    const db = database.adapter;
    createSyncTables(db);
    db.execute('CREATE TABLE dm_own_devices (device_id TEXT PRIMARY KEY, identity_anchor TEXT, dh_public_key TEXT)');
    db.execute('CREATE TABLE pi_person_group (id TEXT PRIMARY KEY, doc_json TEXT)');
    const self = generateDeviceIdentity('self'), peer = generateDeviceIdentity('peer');
    const now = new Date().toISOString();
    insertPairedDevice(db, { deviceId: peer.publicKey, displayName: 'peer', dhPublicKey: peer.dhPublicKey,
      sharedSecretRef: 'local:shared:' + 'ab'.repeat(32), isActive: true, pairedAt: now,
      lastSeenAt: now, lastSyncAt: null, lastSyncModule: null, bytesSent: 0, bytesReceived: 0 });
    expect(authorized(db, self.publicKey, peer.publicKey)).toBe(false);
    recordSasVerification(db, { peerDeviceId: peer.publicKey, sasIndices: '1,2,3,4,5' });
    expect(authorized(db, self.publicKey, peer.publicKey)).toBe(false);
    db.execute('INSERT INTO dm_own_devices VALUES (?, ?, ?)', [peer.publicKey, self.publicKey, peer.dhPublicKey]);
    expect(authorized(db, self.publicKey, peer.publicKey)).toBe(true);
    db.execute('UPDATE dm_own_devices SET dh_public_key = ?', ['stale-key']);
    expect(authorized(db, self.publicKey, peer.publicKey)).toBe(false);
    db.execute('UPDATE dm_own_devices SET dh_public_key = ?', [peer.dhPublicKey]);
    db.execute('INSERT INTO pi_person_group VALUES (?, ?)', ['self', '{malformed']);
    expect(authorized(db, self.publicKey, peer.publicKey)).toBe(false);
  });
  it('fails closed on legacy databases lacking ownership records', () => {
    expect(authorized(database.adapter, 'self', 'friend')).toBe(false);
  });
});
