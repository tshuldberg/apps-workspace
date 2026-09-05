import { describe, expect, it } from 'vitest';
import { sha512Hex } from '../../node/hkdf';
import { InMemoryStorageDestinationAdapter } from '../fakes';
import {
  createRemoteBackupDiscoveryObjects,
  listRemoteBackups,
  remoteBackupManifestObjectId,
  remoteBackupObjectId,
} from '../remote-backups';

const encoder = new TextEncoder();

describe('remote backup locator discovery', () => {
  it('lists a backup on a fresh install using only destination access', async () => {
    const adapter = new InMemoryStorageDestinationAdapter({ pageSize: 1 });
    await adapter.authorize({ kind: 'interactive' });
    const backupId = 'backup-fresh-install';
    const manifest = encoder.encode('encrypted manifest');
    const manifestHash = sha512Hex(manifest);
    const locatorJson = `{"formatVersion":1,"backupId":"${backupId}","encryptedManifestHash":"${manifestHash}","createdAt":"2026-07-14T12:00:00.000Z"}`;
    const manifestObjectId = remoteBackupManifestObjectId(backupId);
    const discovery = createRemoteBackupDiscoveryObjects({
      backupId,
      locatorJson,
      manifestCiphertextHash: manifestHash,
    });
    for (const object of [...discovery, {
      objectId: manifestObjectId,
      dataClass: 'backup_manifest',
      ciphertext: manifest,
      ciphertextHash: manifestHash,
      encryptedBytes: manifest.length,
    }]) await adapter.putObject(object);

    const result = await listRemoteBackups(adapter);

    expect(result.complete).toBe(true);
    expect(result.backups).toEqual([expect.objectContaining({
      backupId,
      locatorJson,
      manifestObjectId,
    })]);
    expect(result.pagesScanned).toBeGreaterThan(1);
  });

  it('uses collision-free deterministic ids for the same chunk path in different backups', () => {
    expect(remoteBackupObjectId('backup-a', 'database/00000000.mkchunk'))
      .not.toBe(remoteBackupObjectId('backup-b', 'database/00000000.mkchunk'));
    expect(remoteBackupObjectId('backup-a', 'database/00000000.mkchunk'))
      .toMatch(/^[A-Za-z0-9._-]+$/u);
  });

  it('reports a missing manifest reference instead of inventing a backup', async () => {
    const adapter = new InMemoryStorageDestinationAdapter();
    await adapter.authorize({ kind: 'interactive' });
    const backupId = 'missing-ref';
    const manifestHash = 'a'.repeat(128);
    const [locator] = createRemoteBackupDiscoveryObjects({
      backupId,
      locatorJson: `{"formatVersion":1,"backupId":"${backupId}","encryptedManifestHash":"${manifestHash}","createdAt":"2026-07-14T12:00:00.000Z"}`,
      manifestCiphertextHash: manifestHash,
    });
    if (!locator) throw new Error('locator object missing');
    await adapter.putObject(locator);

    const result = await listRemoteBackups(adapter);

    expect(result.complete).toBe(false);
    expect(result.backups).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      backupId,
      code: 'manifest_ref_missing',
    }));
  });

  it('stops at the configured object bound even when a provider returns a larger page', async () => {
    const adapter = new InMemoryStorageDestinationAdapter({ pageSize: 10 });
    await adapter.authorize({ kind: 'interactive' });
    for (let index = 0; index < 3; index += 1) {
      const bytes = encoder.encode(`dummy-${index}`);
      await adapter.putObject({
        objectId: `dummy-${index}`,
        dataClass: 'backup_metadata',
        ciphertext: bytes,
        ciphertextHash: sha512Hex(bytes),
        encryptedBytes: bytes.length,
      });
    }

    const result = await listRemoteBackups(adapter, { maximumObjects: 1 });

    expect(result.objectsScanned).toBe(1);
    expect(result.complete).toBe(false);
    expect(result.issues).toContainEqual({
      backupId: null,
      objectId: null,
      code: 'listing_limit',
    });
  });
});
