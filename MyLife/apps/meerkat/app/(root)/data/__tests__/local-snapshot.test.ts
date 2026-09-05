import { describe, expect, it, vi } from 'vitest';
import type { BackupEncoderInput, EncryptedBackupChunk } from '@mylife/sync';
import { VECTOR_BACKUP_INPUT } from '@mylife/sync/src/storage/test-vectors';
import {
  ExpoMobileSnapshotDatabaseSource,
  LocalSnapshotError,
  createMobileLocalSnapshot,
  sqliteIntegrityReport,
  type MobileSnapshotDatabaseSource,
  type MobileSnapshotFileSystem,
} from '../local-snapshot';

const maintenance = vi.hoisted(() => ({ nativeDatabase: { name: 'active-meerkat' } }));

vi.mock('../meerkat-db', () => ({
  withMeerkatDatabaseMaintenance: async (
    operation: (handle: { nativeDatabase: unknown }) => Promise<unknown>,
  ) => operation({ nativeDatabase: maintenance.nativeDatabase }),
}));

const FOUR_MIB = 4 * 1024 * 1024;

function encoderInput(backupId: string): BackupEncoderInput {
  return {
    recoveryKey: VECTOR_BACKUP_INPUT.recoveryKey,
    backupId,
    createdAt: VECTOR_BACKUP_INPUT.createdAt,
    schemaVersion: VECTOR_BACKUP_INPUT.schemaVersion,
    migrationVersion: VECTOR_BACKUP_INPUT.migrationVersion,
    appVersion: VECTOR_BACKUP_INPUT.appVersion,
    dataClassVersions: VECTOR_BACKUP_INPUT.dataClassVersions,
    sealedRecoveryBundle: VECTOR_BACKUP_INPUT.sealedRecoveryBundle,
    signingIdentity: VECTOR_BACKUP_INPUT.signingIdentity,
    nonceSource: VECTOR_BACKUP_INPUT.nonceSource,
  };
}

class BoundedSnapshotFileSystem implements MobileSnapshotFileSystem {
  readonly documentDirectory = 'file:///documents/';
  readonly requestedReads: number[] = [];
  cleaned = false;

  constructor(readonly totalBytes: number, private readonly shortRead = false) {}

  async ensureDirectory(): Promise<void> {}

  async delete(_uri: string): Promise<void> {
    this.cleaned = true;
  }

  async size(): Promise<number> {
    return this.totalBytes;
  }

  async readRange(_uri: string, offset: number, length: number): Promise<Uint8Array> {
    this.requestedReads.push(length);
    const actual = this.shortRead && offset > 0 ? Math.max(0, length - 1) : length;
    const bytes = new Uint8Array(actual);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = (offset + index) % 251;
    return bytes;
  }
}

function successfulSource(fileSystem: BoundedSnapshotFileSystem): MobileSnapshotDatabaseSource {
  return {
    async createConsistentSnapshot() {
      return {
        uri: 'file:///documents/meerkat/snapshots/test/meerkat.snapshot.db',
        integrityReport: 'ok',
        cleanup: () => fileSystem.delete('snapshot'),
      };
    },
  };
}

describe('mobile SQLite snapshot streaming', () => {
  it('uses expo-sqlite backupDatabaseAsync under the maintenance coordinator', async () => {
    const fileSystem = new BoundedSnapshotFileSystem(2_048);
    const destination = {
      getAllAsync: async () => [{ integrity_check: 'ok' }],
      closeAsync: async () => {},
    };
    const calls: string[] = [];
    const sqlite = {
      openDatabaseAsync: async () => {
        calls.push('open-snapshot');
        return destination;
      },
      backupDatabaseAsync: async (input: { sourceDatabase: unknown; destDatabase: unknown }) => {
        expect(input.sourceDatabase).toBe(maintenance.nativeDatabase);
        expect(input.destDatabase).toBe(destination);
        calls.push('backup');
      },
    } as unknown as ConstructorParameters<typeof ExpoMobileSnapshotDatabaseSource>[1];
    const source = new ExpoMobileSnapshotDatabaseSource(fileSystem, sqlite);

    const snapshot = await source.createConsistentSnapshot('expo-backup-api');
    expect(snapshot.integrityReport).toBe('ok');
    expect(calls).toEqual(['open-snapshot', 'backup']);
    await snapshot.cleanup();
    expect(fileSystem.cleaned).toBe(true);
  });

  it('uses the 4 MiB default bound and never requests the whole snapshot', async () => {
    const totalBytes = FOUR_MIB * 2 + 97;
    const fileSystem = new BoundedSnapshotFileSystem(totalBytes);
    const chunks: EncryptedBackupChunk[] = [];
    const result = await createMobileLocalSnapshot({
      encoderInput: encoderInput('mobile-bounded-snapshot'),
      fileSystem,
      databaseSource: successfulSource(fileSystem),
      writeEncryptedChunk: async (chunk) => { chunks.push(chunk); },
    });

    expect(result.databaseChunkCount).toBe(3);
    expect(result.maximumPlaintextChunkBytes).toBe(FOUR_MIB);
    expect(Math.max(...fileSystem.requestedReads)).toBe(FOUR_MIB);
    expect(fileSystem.requestedReads).not.toContain(totalBytes);
    expect(chunks).toHaveLength(3);
    expect(fileSystem.cleaned).toBe(true);
  });

  it('fails closed before encoding when snapshot integrity fails', async () => {
    const fileSystem = new BoundedSnapshotFileSystem(512);
    let writes = 0;
    const databaseSource: MobileSnapshotDatabaseSource = {
      async createConsistentSnapshot() {
        throw new LocalSnapshotError(
          'snapshot_integrity_failed',
          'The SQLite snapshot failed integrity_check.',
          'row 9 malformed',
        );
      },
    };

    await expect(createMobileLocalSnapshot({
      encoderInput: encoderInput('mobile-integrity-failure'),
      fileSystem,
      databaseSource,
      writeEncryptedChunk: async () => { writes += 1; },
    })).rejects.toMatchObject({
      name: 'LocalSnapshotError',
      code: 'snapshot_integrity_failed',
      report: 'row 9 malformed',
    });
    expect(writes).toBe(0);
  });

  it('fails closed on a short ranged read and cleans the snapshot', async () => {
    const fileSystem = new BoundedSnapshotFileSystem(257, true);
    await expect(createMobileLocalSnapshot({
      encoderInput: encoderInput('mobile-short-read'),
      fileSystem,
      databaseSource: successfulSource(fileSystem),
      chunkBytes: 128,
      writeEncryptedChunk: async () => {},
    })).rejects.toMatchObject({ name: 'LocalSnapshotError', code: 'snapshot_io_failed' });
    expect(fileSystem.cleaned).toBe(true);
  });

  it('accepts only the single ok row from PRAGMA integrity_check', () => {
    expect(sqliteIntegrityReport([{ integrity_check: 'ok' }])).toEqual({ passed: true, report: 'ok' });
    expect(sqliteIntegrityReport([
      { integrity_check: 'row 1 malformed' },
      { integrity_check: 'row 3 malformed' },
    ])).toEqual({ passed: false, report: 'row 1 malformed\nrow 3 malformed' });
  });

  it('rejects a path-escaping backup id before touching the snapshot source', async () => {
    const fileSystem = new BoundedSnapshotFileSystem(128);
    let sourceCalled = false;
    await expect(createMobileLocalSnapshot({
      encoderInput: encoderInput('../escape'),
      fileSystem,
      databaseSource: {
        async createConsistentSnapshot() {
          sourceCalled = true;
          return successfulSource(fileSystem).createConsistentSnapshot('unused');
        },
      },
      writeEncryptedChunk: async () => {},
    })).rejects.toMatchObject({ name: 'LocalSnapshotError', code: 'snapshot_io_failed' });
    expect(sourceCalled).toBe(false);
  });
});
