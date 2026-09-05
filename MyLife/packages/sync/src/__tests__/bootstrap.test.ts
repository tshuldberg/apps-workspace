import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables } from '../db/schema';
import { ensureSyncBootstrap, repairPairedDeviceSharedSecrets } from '../db/bootstrap';
import {
  getPairedDevice,
  insertPairedDevice,
  upsertDeviceIdentity,
} from '../db/queries';
import { extractDhPrivateKeyHex, generateDeviceIdentity } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  createSyncTables(testDb.adapter);
});

afterEach(() => {
  testDb.close();
});

describe('sync bootstrap', () => {
  it('repairs legacy placeholder paired-device shared-secret refs', () => {
    const localIdentity = generateDeviceIdentity('Local');
    const remoteIdentity = generateDeviceIdentity('Remote');
    const localDhPrivateKeyHex = extractDhPrivateKeyHex(localIdentity.privateKeyRef);
    expect(localDhPrivateKeyHex).not.toBeNull();

    upsertDeviceIdentity(testDb.adapter, localIdentity);
    insertPairedDevice(testDb.adapter, {
      deviceId: remoteIdentity.publicKey,
      displayName: remoteIdentity.displayName,
      dhPublicKey: remoteIdentity.dhPublicKey,
      sharedSecretRef: `local:shared:${remoteIdentity.publicKey}`,
      lastSeenAt: null,
      lastSyncAt: null,
      lastSyncModule: null,
      bytesSent: 0,
      bytesReceived: 0,
      isActive: true,
      pairedAt: '2026-01-01T00:00:00.000Z',
    });

    const repaired = repairPairedDeviceSharedSecrets(testDb.adapter, localIdentity);
    const expectedSharedSecret = derivePairingSharedSecret(
      localDhPrivateKeyHex!,
      remoteIdentity.dhPublicKey,
    );

    expect(repaired).toBe(1);
    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .toMatch(/^secure\.sync\.shared\./);
    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .not.toBe(`local:shared:${expectedSharedSecret}`);
  });

  it('migrates already derived raw paired-device shared-secret refs', () => {
    const localIdentity = generateDeviceIdentity('Local');
    const remoteIdentity = generateDeviceIdentity('Remote');
    const localDhPrivateKeyHex = extractDhPrivateKeyHex(localIdentity.privateKeyRef);
    const sharedSecret = derivePairingSharedSecret(localDhPrivateKeyHex!, remoteIdentity.dhPublicKey);

    insertPairedDevice(testDb.adapter, {
      deviceId: remoteIdentity.publicKey,
      displayName: remoteIdentity.displayName,
      dhPublicKey: remoteIdentity.dhPublicKey,
      sharedSecretRef: `local:shared:${sharedSecret}`,
      lastSeenAt: null,
      lastSyncAt: null,
      lastSyncModule: null,
      bytesSent: 0,
      bytesReceived: 0,
      isActive: true,
      pairedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(repairPairedDeviceSharedSecrets(testDb.adapter, localIdentity)).toBe(1);
    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .toMatch(/^secure\.sync\.shared\./);
    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .not.toBe(`local:shared:${sharedSecret}`);
  });

  it('runs paired-device shared-secret repair during app bootstrap', () => {
    const localIdentity = generateDeviceIdentity('Local');
    const remoteIdentity = generateDeviceIdentity('Remote');

    upsertDeviceIdentity(testDb.adapter, localIdentity);
    insertPairedDevice(testDb.adapter, {
      deviceId: remoteIdentity.publicKey,
      displayName: remoteIdentity.displayName,
      dhPublicKey: remoteIdentity.dhPublicKey,
      sharedSecretRef: `local:shared:${remoteIdentity.publicKey}`,
      lastSeenAt: null,
      lastSyncAt: null,
      lastSyncModule: null,
      bytesSent: 0,
      bytesReceived: 0,
      isActive: true,
      pairedAt: '2026-01-01T00:00:00.000Z',
    });

    ensureSyncBootstrap(testDb.adapter, {
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      idFactory: () => 'ws_personal_test',
    });

    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .toMatch(/^secure\.sync\.shared\./);
    expect(getPairedDevice(testDb.adapter, remoteIdentity.publicKey)?.sharedSecretRef)
      .not.toBe(`local:shared:${remoteIdentity.publicKey}`);
  });
});
