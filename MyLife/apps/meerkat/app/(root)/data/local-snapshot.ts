import { getPrivateStorageRoot } from './private-storage';
import { decodeBase64 } from 'tweetnacl-util';
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  BackupEncoderInput,
  EncryptedBackupChunk,
} from '@mylife/sync/src/storage/backup-format';
import {
  assertSafeSnapshotBackupId,
  encodeSnapshotSource,
  SnapshotSourceError,
  type EncodedSnapshotSource,
  type SnapshotByteSource,
} from './snapshot-encoder-core';

const SNAPSHOT_FILE_NAME = 'meerkat.snapshot.db';

export class LocalSnapshotError extends Error {
  readonly code:
    | 'snapshot_unavailable'
    | 'snapshot_coordination_failed'
    | 'snapshot_integrity_failed'
    | 'snapshot_io_failed';
  readonly report?: string;

  constructor(code: LocalSnapshotError['code'], message: string, report?: string) {
    super(message);
    this.name = 'LocalSnapshotError';
    this.code = code;
    this.report = report;
  }
}

export interface MobileSnapshotFileSystem {
  /** Internal storage root; never the Files-visible Documents directory on iOS. */
  readonly documentDirectory: string | null;
  ensureDirectory(uri: string): Promise<void>;
  delete(uri: string): Promise<void>;
  size(uri: string): Promise<number>;
  readRange(uri: string, offset: number, length: number): Promise<Uint8Array>;
}

export interface ConsistentMobileSnapshot {
  uri: string;
  integrityReport: string;
  cleanup(): Promise<void>;
}

export interface MobileSnapshotDatabaseSource {
  createConsistentSnapshot(backupId: string): Promise<ConsistentMobileSnapshot>;
}

interface ExpoLegacyFileSystemModule {
  documentDirectory: string | null;
  EncodingType: { Base64: string };
  getInfoAsync(uri: string): Promise<{ exists: boolean; size?: number }>;
  makeDirectoryAsync(uri: string, options: { intermediates: boolean }): Promise<void>;
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
  readAsStringAsync(
    uri: string,
    options: { encoding: string; position: number; length: number },
  ): Promise<string>;
}

interface ExpoSqliteModule {
  openDatabaseAsync(
    name: string,
    options: { useNewConnection: boolean },
    directory: string,
  ): Promise<SQLiteDatabase>;
  backupDatabaseAsync(options: {
    sourceDatabase: SQLiteDatabase;
    destDatabase: SQLiteDatabase;
  }): Promise<void>;
}

function loadFileSystemModule(): ExpoLegacyFileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system/legacy') as ExpoLegacyFileSystemModule;
  } catch {
    return null;
  }
}

function loadSqliteModule(): ExpoSqliteModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sqlite') as ExpoSqliteModule;
  } catch {
    return null;
  }
}

export function createExpoSnapshotFileSystem(): MobileSnapshotFileSystem | null {
  const fileSystem = loadFileSystemModule();
  if (!fileSystem) return null;
  return {
    documentDirectory: getPrivateStorageRoot(),
    async ensureDirectory(uri): Promise<void> {
      const info = await fileSystem.getInfoAsync(uri);
      if (!info.exists) await fileSystem.makeDirectoryAsync(uri, { intermediates: true });
    },
    async delete(uri): Promise<void> {
      await fileSystem.deleteAsync(uri, { idempotent: true });
    },
    async size(uri): Promise<number> {
      const info = await fileSystem.getInfoAsync(uri);
      if (!info.exists || !Number.isSafeInteger(info.size) || (info.size ?? 0) <= 0) {
        throw new LocalSnapshotError('snapshot_io_failed', 'The SQLite snapshot file is missing or empty.');
      }
      return info.size!;
    },
    async readRange(uri, offset, length): Promise<Uint8Array> {
      const base64 = await fileSystem.readAsStringAsync(uri, {
        encoding: fileSystem.EncodingType.Base64,
        position: offset,
        length,
      });
      return decodeBase64(base64);
    },
  };
}

export function sqliteIntegrityReport(rows: readonly Record<string, unknown>[]): {
  passed: boolean;
  report: string;
} {
  const reports = rows.flatMap((row) => Object.values(row))
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  const report = reports.join('\n') || 'integrity_check returned no result';
  return { passed: reports.length === 1 && reports[0]?.toLowerCase() === 'ok', report };
}

export class ExpoMobileSnapshotDatabaseSource implements MobileSnapshotDatabaseSource {
  constructor(
    private readonly fileSystem: MobileSnapshotFileSystem,
    private readonly sqlite: ExpoSqliteModule,
  ) {}

  async createConsistentSnapshot(backupId: string): Promise<ConsistentMobileSnapshot> {
    try {
      assertSafeSnapshotBackupId(backupId);
    } catch (error) {
      throw new LocalSnapshotError(
        'snapshot_io_failed',
        error instanceof Error ? error.message : 'The snapshot backup id is invalid.',
      );
    }
    const documentDirectory = this.fileSystem.documentDirectory;
    if (!documentDirectory) {
      throw new LocalSnapshotError('snapshot_unavailable', 'The app document directory is unavailable.');
    }
    const directory = `${documentDirectory}meerkat/snapshots/${backupId}/`;
    const uri = `${directory}${SNAPSHOT_FILE_NAME}`;
    const cleanup = async (): Promise<void> => {
      await Promise.all([
        this.fileSystem.delete(uri),
        this.fileSystem.delete(`${uri}-wal`),
        this.fileSystem.delete(`${uri}-shm`),
      ]);
    };
    await this.fileSystem.ensureDirectory(directory);
    await cleanup();

    try {
      const databaseModule = await import('./meerkat-db');
      const report = await databaseModule.withMeerkatDatabaseMaintenance(async (handle) => {
        const destination = await this.sqlite.openDatabaseAsync(
          SNAPSHOT_FILE_NAME,
          { useNewConnection: true },
          directory,
        );
        try {
          await this.sqlite.backupDatabaseAsync({
            sourceDatabase: handle.nativeDatabase,
            destDatabase: destination,
          });
          const rows = await destination.getAllAsync<Record<string, unknown>>('PRAGMA integrity_check;');
          return sqliteIntegrityReport(rows);
        } finally {
          await destination.closeAsync();
        }
      });
      if (!report.passed) {
        await cleanup();
        throw new LocalSnapshotError(
          'snapshot_integrity_failed',
          'The SQLite snapshot failed integrity_check.',
          report.report,
        );
      }
      await this.fileSystem.size(uri);
      return {
        uri,
        integrityReport: report.report,
        cleanup,
      };
    } catch (error) {
      await cleanup();
      if (error instanceof LocalSnapshotError) throw error;
      throw new LocalSnapshotError(
        'snapshot_coordination_failed',
        error instanceof Error ? error.message : 'The database snapshot could not be coordinated.',
      );
    }
  }
}

export interface CreateMobileLocalSnapshotInput {
  encoderInput: BackupEncoderInput;
  writeEncryptedChunk(chunk: EncryptedBackupChunk): Promise<void>;
  chunkBytes?: number;
  fileSystem?: MobileSnapshotFileSystem;
  databaseSource?: MobileSnapshotDatabaseSource;
}

export interface MobileLocalSnapshotResult extends EncodedSnapshotSource {
  integrityReport: string;
}

export async function createMobileLocalSnapshot(
  input: CreateMobileLocalSnapshotInput,
): Promise<MobileLocalSnapshotResult> {
  try {
    assertSafeSnapshotBackupId(input.encoderInput.backupId);
  } catch (error) {
    throw new LocalSnapshotError(
      'snapshot_io_failed',
      error instanceof Error ? error.message : 'The snapshot backup id is invalid.',
    );
  }
  const fileSystem = input.fileSystem ?? createExpoSnapshotFileSystem();
  if (!fileSystem?.documentDirectory) {
    throw new LocalSnapshotError('snapshot_unavailable', 'The app document directory is unavailable.');
  }
  const sqlite = loadSqliteModule();
  const databaseSource = input.databaseSource
    ?? (sqlite ? new ExpoMobileSnapshotDatabaseSource(fileSystem, sqlite) : null);
  if (!databaseSource) {
    throw new LocalSnapshotError('snapshot_unavailable', 'expo-sqlite backup APIs are unavailable.');
  }

  const snapshot = await databaseSource.createConsistentSnapshot(input.encoderInput.backupId);
  const source: SnapshotByteSource = {
    size: () => fileSystem.size(snapshot.uri),
    read: (offset, length) => fileSystem.readRange(snapshot.uri, offset, length),
  };
  try {
    const encoded = await encodeSnapshotSource({
      source,
      encoderInput: input.encoderInput,
      writeEncryptedChunk: input.writeEncryptedChunk,
      chunkBytes: input.chunkBytes,
    });
    return { ...encoded, integrityReport: snapshot.integrityReport };
  } catch (error) {
    if (error instanceof LocalSnapshotError) throw error;
    if (error instanceof SnapshotSourceError) {
      throw new LocalSnapshotError('snapshot_io_failed', error.message);
    }
    throw new LocalSnapshotError(
      'snapshot_io_failed',
      error instanceof Error ? error.message : 'The SQLite snapshot could not be encoded.',
    );
  } finally {
    await snapshot.cleanup();
  }
}
