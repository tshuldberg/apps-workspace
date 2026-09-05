import { describe, expect, it } from 'vitest';
import type { RemoteBackupCandidate } from '@mylife/sync';
import { consumeRemoteBackupDiscovery } from '../restore-orchestrator-core';

describe('web restore wizard remote discovery', () => {
  it('consumes a fresh-install locator without a local backup row', () => {
    const candidate: RemoteBackupCandidate = {
      backupId: 'remote-backup',
      createdAt: '2026-07-14T12:00:00.000Z',
      locator: {
        formatVersion: 1,
        backupId: 'remote-backup',
        encryptedManifestHash: 'a'.repeat(128),
        createdAt: '2026-07-14T12:00:00.000Z',
      },
      locatorJson: '{"formatVersion":1}',
      locatorObjectId: 'locator',
      manifestReferenceObjectId: 'manifest-ref',
      manifestObjectId: 'manifest',
      manifestRemoteRef: 'memory://manifest',
      manifestCiphertextHash: 'a'.repeat(128),
      manifestEncryptedBytes: 42,
    };

    expect(consumeRemoteBackupDiscovery('destination-1', [candidate])).toEqual([{
      destinationId: 'destination-1',
      backupId: 'remote-backup',
      createdAt: candidate.createdAt,
      locatorJson: candidate.locatorJson,
      manifestObjectId: candidate.manifestObjectId,
      manifestEncryptedBytes: 42,
    }]);
  });
});
