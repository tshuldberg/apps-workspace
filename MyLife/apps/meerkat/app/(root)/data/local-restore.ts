import { getPrivateStorageRoot } from './private-storage';
import type { DatabaseAdapter } from '@mylife/db';
import {
  blobContentHash,
  createDeviceIdentitySecretRef,
  deleteSyncSecret,
  ensureStorageTables,
  getBlob,
  getDeviceIdentitySecrets,
  isRecoverableIdentityConsistent,
  openRecovery,
  parseRecoveryKey,
  restoreIdentityFromRecovery,
  upsertDeviceIdentity,
} from '@mylife/sync';
import type { RestorePlan, RestoreChunkRequirement } from '@mylife/sync/src/storage/restore-controller';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';
import type { SQLiteDatabase } from 'expo-sqlite';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { ensureMeerkatTables } from './db';
import { ensureDmTables } from './dm-core';
import { ensureSyncSchema } from './sync-core';
import { ensureThemeTables } from '../theme/theme-store';
import { sqliteIntegrityReport } from './local-snapshot';
import {
  assertSafeRestoreBackupId,
  runStagedRestore,
  type RestoreActivationResult,
  type RestoreCheckResult,
  type RestoreEncryptedSource,
  type RestorePlatformDriver,
  type StagedRestoreExecutionResult,
} from './storage-destinations/restore-orchestrator-core';

const JOURNAL_FILE_NAME = 'restore-activation.json';
const STAGED_DATABASE_FILE_NAME = 'restored.db';
const ACTIVE_DATABASE_FILE_NAME = 'meerkat.db';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface MobileRestoreFileSystem {
  /** Internal storage root; never the Files-visible Documents directory on iOS. */
  readonly documentDirectory: string | null;
  ensureDirectory(uri: string): Promise<void>;
  exists(uri: string): Promise<boolean>;
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  delete(uri: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  concatenate(output: string, inputs: readonly string[]): Promise<void>;
}

export interface MobileDatabaseActivationHandle {
  closeActiveDatabase(): void;
  reopenActiveDatabase(): DatabaseAdapter;
}

export interface MobileRestoreDatabaseRuntime {
  withMaintenance<T>(
    operation: (handle: MobileDatabaseActivationHandle) => Promise<T>,
  ): Promise<T>;
  checkIntegrity(databaseUri: string): Promise<RestoreCheckResult>;
  rehearseMigrations(databaseUri: string): Promise<RestoreCheckResult>;
  bootVerify(databaseUri: string): Promise<RestoreCheckResult>;
}

interface ExpoLegacyFileSystemModule {
  documentDirectory: string | null;
  EncodingType: { Base64: string };
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  makeDirectoryAsync(uri: string, options: { intermediates: boolean }): Promise<void>;
  readAsStringAsync(uri: string, options: { encoding: string }): Promise<string>;
  writeAsStringAsync(uri: string, value: string, options: { encoding: string }): Promise<void>;
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
  moveAsync(options: { from: string; to: string }): Promise<void>;
}

interface ExpoFileHandle {
  writeBytes(bytes: Uint8Array): void;
  close(): void;
}

interface ExpoFile {
  readonly exists: boolean;
  create(options: { intermediates: boolean; overwrite: boolean }): void;
  delete(): void;
  open(): ExpoFileHandle;
}

interface ExpoBinaryFileSystemModule {
  File: new (uri: string) => ExpoFile;
}

interface ExpoSqliteModule {
  openDatabaseAsync(
    name: string,
    options: { useNewConnection: boolean },
    directory: string,
  ): Promise<SQLiteDatabase>;
}

function loadLegacyFileSystem(): ExpoLegacyFileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system/legacy') as ExpoLegacyFileSystemModule;
  } catch {
    return null;
  }
}

function loadBinaryFileSystem(): ExpoBinaryFileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as ExpoBinaryFileSystemModule;
  } catch {
    return null;
  }
}

function loadSqlite(): ExpoSqliteModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sqlite') as ExpoSqliteModule;
  } catch {
    return null;
  }
}

function parentDirectory(uri: string): string {
  const index = uri.lastIndexOf('/');
  if (index <= 'file://'.length) throw new Error('Restore path has no parent directory.');
  return uri.slice(0, index + 1);
}

export function createExpoRestoreFileSystem(): MobileRestoreFileSystem | null {
  const legacy = loadLegacyFileSystem();
  const binary = loadBinaryFileSystem();
  if (!legacy || !binary) return null;
  const ensureDirectory = async (uri: string): Promise<void> => {
    const info = await legacy.getInfoAsync(uri);
    if (!info.exists) await legacy.makeDirectoryAsync(uri, { intermediates: true });
  };
  return {
    documentDirectory: getPrivateStorageRoot(),
    ensureDirectory,
    async exists(uri): Promise<boolean> {
      return (await legacy.getInfoAsync(uri)).exists;
    },
    async readBytes(uri): Promise<Uint8Array> {
      const base64 = await legacy.readAsStringAsync(uri, { encoding: legacy.EncodingType.Base64 });
      return decodeBase64(base64);
    },
    async writeBytes(uri, bytes): Promise<void> {
      await ensureDirectory(parentDirectory(uri));
      await legacy.writeAsStringAsync(uri, encodeBase64(bytes), {
        encoding: legacy.EncodingType.Base64,
      });
    },
    async delete(uri): Promise<void> {
      await legacy.deleteAsync(uri, { idempotent: true });
    },
    async move(from, to): Promise<void> {
      await ensureDirectory(parentDirectory(to));
      await legacy.moveAsync({ from, to });
    },
    async concatenate(output, inputs): Promise<void> {
      await ensureDirectory(parentDirectory(output));
      const outputFile = new binary.File(output);
      if (outputFile.exists) outputFile.delete();
      outputFile.create({ intermediates: true, overwrite: true });
      const handle = outputFile.open();
      try {
        for (const input of inputs) {
          const base64 = await legacy.readAsStringAsync(input, {
            encoding: legacy.EncodingType.Base64,
          });
          const bytes = decodeBase64(base64);
          try {
            handle.writeBytes(bytes);
          } finally {
            bytes.fill(0);
          }
        }
      } finally {
        handle.close();
      }
    },
  };
}

function splitDatabaseUri(uri: string): { directory: string; name: string } {
  const directory = parentDirectory(uri);
  return { directory, name: uri.slice(directory.length) };
}

async function openIsolatedDatabase(uri: string): Promise<SQLiteDatabase> {
  const sqlite = loadSqlite();
  if (!sqlite) throw new Error('expo-sqlite is unavailable.');
  const path = splitDatabaseUri(uri);
  return sqlite.openDatabaseAsync(path.name, { useNewConnection: true }, path.directory);
}

async function checkDatabaseIntegrity(database: SQLiteDatabase): Promise<RestoreCheckResult> {
  const rows = await database.getAllAsync<Record<string, unknown>>('PRAGMA integrity_check;');
  return sqliteIntegrityReport(rows);
}

export class ExpoMobileRestoreDatabaseRuntime implements MobileRestoreDatabaseRuntime {
  async withMaintenance<T>(
    operation: (handle: MobileDatabaseActivationHandle) => Promise<T>,
  ): Promise<T> {
    const databaseModule = await import('./meerkat-db');
    return databaseModule.withMeerkatDatabaseMaintenance((handle) => operation(handle));
  }

  async checkIntegrity(databaseUri: string): Promise<RestoreCheckResult> {
    const database = await openIsolatedDatabase(databaseUri);
    try {
      return await checkDatabaseIntegrity(database);
    } finally {
      await database.closeAsync();
    }
  }

  async rehearseMigrations(databaseUri: string): Promise<RestoreCheckResult> {
    const database = await openIsolatedDatabase(databaseUri);
    try {
      const databaseModule = await import('./meerkat-db');
      const adapter = databaseModule.createExpoAdapter(database);
      ensureMeerkatTables(adapter);
      ensureSyncSchema(adapter);
      ensureDmTables(adapter);
      ensureThemeTables(adapter);
      ensureStorageTables(adapter);
      const integrity = await checkDatabaseIntegrity(database);
      return integrity.passed
        ? { passed: true, report: 'App migrations completed; integrity_check: ok' }
        : integrity;
    } catch (error) {
      return {
        passed: false,
        report: error instanceof Error ? error.message : 'App migration rehearsal failed.',
      };
    } finally {
      await database.closeAsync();
    }
  }

  async bootVerify(databaseUri: string): Promise<RestoreCheckResult> {
    const rehearsal = await this.rehearseMigrations(databaseUri);
    if (!rehearsal.passed) return rehearsal;
    const integrity = await this.checkIntegrity(databaseUri);
    return integrity.passed
      ? { passed: true, report: 'Restored database boot verification passed.' }
      : integrity;
  }
}

type ActivationJournalPhase = 'prepared' | 'active_moved' | 'staged_moved';

interface ActivationJournal {
  version: 1 | 2;
  generation: number;
  backupId: string;
  phase: ActivationJournalPhase;
  hadPriorData: boolean;
  includesDatabase: boolean;
  objectHadPriorData: Readonly<Record<string, boolean>>;
  stagingDatabase: string;
  activeDatabase: string;
  rollbackDirectory: string;
}

interface ActivationJournalEnvelope {
  version: 1;
  checksumSha256: string;
  journal: ActivationJournal;
}

interface RestorePaths {
  stagingDirectory: string;
  verifiedDirectory: string;
  stagedDatabase: string;
  stagedObjectsDirectory: string;
  activeDirectory: string;
  activeDatabase: string;
  activeBlobDirectory: string;
  rollbackDirectory: string;
  journal: string;
}

function restorePaths(documentDirectory: string, backupId: string): RestorePaths {
  assertSafeRestoreBackupId(backupId);
  const stagingDirectory = `${documentDirectory}meerkat/restore-staging/${backupId}/`;
  return {
    stagingDirectory,
    verifiedDirectory: `${stagingDirectory}verified/`,
    stagedDatabase: `${stagingDirectory}${STAGED_DATABASE_FILE_NAME}`,
    stagedObjectsDirectory: `${stagingDirectory}objects/`,
    activeDirectory: `${documentDirectory}SQLite/`,
    activeDatabase: `${documentDirectory}SQLite/${ACTIVE_DATABASE_FILE_NAME}`,
    activeBlobDirectory: `${documentDirectory}meerkat/blobs/`,
    rollbackDirectory: `${documentDirectory}meerkat/restore-rollback/${backupId}/`,
    journal: `${documentDirectory}meerkat/${JOURNAL_FILE_NAME}`,
  };
}

function sidecarPaths(databaseUri: string): readonly string[] {
  return [databaseUri, `${databaseUri}-wal`, `${databaseUri}-shm`];
}

function rollbackPath(paths: RestorePaths, activePath: string): string {
  const suffix = activePath.slice(paths.activeDatabase.length);
  return `${paths.rollbackDirectory}${ACTIVE_DATABASE_FILE_NAME}${suffix}`;
}

function safeObjectId(objectId: string): string {
  if (!/^[a-f0-9]{128}$/iu.test(objectId)) {
    throw new Error('Restore object id is not a SHA-512 content hash.');
  }
  return objectId.toLowerCase();
}

function stagedObjectPath(paths: RestorePaths, objectId: string): string {
  return `${paths.stagedObjectsDirectory}${safeObjectId(objectId)}`;
}

function activeObjectPath(paths: RestorePaths, objectId: string): string {
  return `${paths.activeBlobDirectory}${safeObjectId(objectId)}`;
}

function rollbackObjectPath(paths: RestorePaths, objectId: string): string {
  return `${paths.rollbackDirectory}objects/${safeObjectId(objectId)}`;
}

async function writeJournal(
  fileSystem: MobileRestoreFileSystem,
  journalUri: string,
  journal: ActivationJournal,
): Promise<void> {
  const journalBytes = encoder.encode(JSON.stringify(journal));
  const envelope: ActivationJournalEnvelope = {
    version: 1,
    checksumSha256: sha256Hex(journalBytes),
    journal,
  };
  const bytes = encoder.encode(JSON.stringify(envelope));
  const slot = journal.generation % 2;
  if (journal.generation === 1) {
    // Establish two independently checksummed prepared copies before any active
    // file moves. Later writes rotate between them, so a torn newest write can
    // always fall back to the last durable activation phase.
    await fileSystem.writeBytes(`${journalUri}.0`, bytes);
    await fileSystem.writeBytes(`${journalUri}.1`, bytes);
    return;
  }
  await fileSystem.writeBytes(`${journalUri}.${slot}`, bytes);
}

function parseJournalValue(value: unknown): ActivationJournal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The restore activation journal is malformed.');
  }
  const row = value as Record<string, unknown>;
  if (
    ![1, 2].includes(Number(row.version))
    || typeof row.backupId !== 'string'
    || !['prepared', 'active_moved', 'staged_moved'].includes(String(row.phase))
    || typeof row.hadPriorData !== 'boolean'
    || typeof row.stagingDatabase !== 'string'
    || typeof row.activeDatabase !== 'string'
    || typeof row.rollbackDirectory !== 'string'
  ) throw new Error('The restore activation journal is malformed.');
  const generation = row.version === 2 && Number.isSafeInteger(row.generation) && Number(row.generation) > 0
    ? Number(row.generation)
    : 0;
  if (row.version === 2 && generation === 0) {
    throw new Error('The restore activation journal generation is malformed.');
  }
  return {
    version: row.version as 1 | 2,
    generation,
    backupId: row.backupId,
    phase: row.phase as ActivationJournalPhase,
    hadPriorData: row.hadPriorData,
    includesDatabase: row.version === 1 ? true : row.includesDatabase === true,
    objectHadPriorData: row.version === 2 && row.objectHadPriorData
      && typeof row.objectHadPriorData === 'object' && !Array.isArray(row.objectHadPriorData)
      ? Object.fromEntries(Object.entries(row.objectHadPriorData as Record<string, unknown>)
        .map(([objectId, existed]) => [safeObjectId(objectId), existed === true]))
      : {},
    stagingDatabase: row.stagingDatabase,
    activeDatabase: row.activeDatabase,
    rollbackDirectory: row.rollbackDirectory,
  };
}

function parseJournalBytes(bytes: Uint8Array): ActivationJournal {
  const value: unknown = JSON.parse(decoder.decode(bytes));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const envelope = value as Record<string, unknown>;
    if (envelope.version === 1 && typeof envelope.checksumSha256 === 'string' && envelope.journal) {
      const journalBytes = encoder.encode(JSON.stringify(envelope.journal));
      if (sha256Hex(journalBytes) !== envelope.checksumSha256) {
        throw new Error('The restore activation journal checksum does not match.');
      }
      return parseJournalValue(envelope.journal);
    }
  }
  return parseJournalValue(value);
}

async function readJournal(
  fileSystem: MobileRestoreFileSystem,
  journalUri: string,
): Promise<ActivationJournal | null> {
  const candidates: ActivationJournal[] = [];
  let sawJournal = false;
  for (const candidateUri of [journalUri, `${journalUri}.0`, `${journalUri}.1`]) {
    if (!(await fileSystem.exists(candidateUri))) continue;
    sawJournal = true;
    try {
      candidates.push(parseJournalBytes(await fileSystem.readBytes(candidateUri)));
    } catch {
      // A rotating slot may be torn. A separately checksummed older slot is
      // authoritative if present; fail closed only when every copy is invalid.
    }
  }
  if (!sawJournal) return null;
  if (candidates.length === 0) {
    throw new Error('The restore activation journal cannot be read safely.');
  }
  return candidates.sort((left, right) => right.generation - left.generation)[0]!;
}

async function deleteJournalCopies(
  fileSystem: MobileRestoreFileSystem,
  journalUri: string,
): Promise<void> {
  await fileSystem.delete(journalUri);
  await fileSystem.delete(`${journalUri}.0`);
  await fileSystem.delete(`${journalUri}.1`);
}

async function restoreRollbackFiles(
  fileSystem: MobileRestoreFileSystem,
  paths: RestorePaths,
  hadPriorData: boolean,
): Promise<void> {
  if (!hadPriorData) {
    for (const activePath of sidecarPaths(paths.activeDatabase)) {
      await fileSystem.delete(activePath);
    }
    return;
  }
  for (const activePath of sidecarPaths(paths.activeDatabase)) {
    const rollback = rollbackPath(paths, activePath);
    if (!(await fileSystem.exists(rollback))) continue;
    await fileSystem.delete(activePath);
    await fileSystem.move(rollback, activePath);
  }
  if (!(await fileSystem.exists(paths.activeDatabase))) {
    throw new Error('The rollback database is missing.');
  }
}

async function restorePreparedRollbackFiles(
  fileSystem: MobileRestoreFileSystem,
  paths: RestorePaths,
  hadPriorData: boolean,
): Promise<void> {
  if (!hadPriorData) return;
  for (const activePath of sidecarPaths(paths.activeDatabase)) {
    const rollback = rollbackPath(paths, activePath);
    if (!(await fileSystem.exists(rollback))) continue;
    await fileSystem.delete(activePath);
    await fileSystem.move(rollback, activePath);
  }
  if (!(await fileSystem.exists(paths.activeDatabase))) {
    throw new Error('The partially moved rollback database is missing.');
  }
}

async function restoreRollbackObjects(
  fileSystem: MobileRestoreFileSystem,
  paths: RestorePaths,
  objectHadPriorData: Readonly<Record<string, boolean>>,
): Promise<void> {
  for (const [objectId, hadPriorData] of Object.entries(objectHadPriorData)) {
    const active = activeObjectPath(paths, objectId);
    const rollback = rollbackObjectPath(paths, objectId);
    if (await fileSystem.exists(rollback)) {
      await fileSystem.delete(active);
      await fileSystem.move(rollback, active);
    } else if (!hadPriorData) {
      await fileSystem.delete(active);
    } else if (!(await fileSystem.exists(active))) {
      throw new Error(`The prior restore object is missing: ${objectId.slice(0, 12)}`);
    }
  }
}

export async function recoverInterruptedMobileRestore(
  fileSystem: MobileRestoreFileSystem,
  runtime: MobileRestoreDatabaseRuntime,
): Promise<boolean> {
  const documentDirectory = fileSystem.documentDirectory;
  if (!documentDirectory) return false;
  const journalUri = `${documentDirectory}meerkat/${JOURNAL_FILE_NAME}`;
  const journal = await readJournal(fileSystem, journalUri);
  if (!journal) return false;
  const paths = restorePaths(documentDirectory, journal.backupId);
  if (
    journal.activeDatabase !== paths.activeDatabase
    || journal.stagingDatabase !== paths.stagedDatabase
    || journal.rollbackDirectory !== paths.rollbackDirectory
  ) throw new Error('The restore activation journal contains unexpected paths.');

  return runtime.withMaintenance(async (handle) => {
    handle.closeActiveDatabase();
    if (journal.includesDatabase) {
      if (journal.phase === 'prepared') {
        await restorePreparedRollbackFiles(fileSystem, paths, journal.hadPriorData);
      } else {
        await restoreRollbackFiles(fileSystem, paths, journal.hadPriorData);
      }
    }
    await restoreRollbackObjects(fileSystem, paths, journal.objectHadPriorData);
    await fileSystem.delete(paths.rollbackDirectory);
    handle.reopenActiveDatabase();
    await deleteJournalCopies(fileSystem, paths.journal);
    return true;
  });
}

export async function releaseMobileRestoreRollback(
  fileSystem: MobileRestoreFileSystem,
  backupId: string,
): Promise<void> {
  const documentDirectory = fileSystem.documentDirectory;
  if (!documentDirectory) throw new Error('The app document directory is unavailable.');
  await fileSystem.delete(restorePaths(documentDirectory, backupId).rollbackDirectory);
}

export interface MobileRestoreDriverOptions {
  backupId: string;
  recoveryKey: string;
  fileSystem: MobileRestoreFileSystem;
  runtime: MobileRestoreDatabaseRuntime;
  afterActiveMoved?: () => void | Promise<void>;
}

export class MobileLocalRestoreDriver implements RestorePlatformDriver {
  private readonly paths: RestorePaths;

  constructor(private readonly options: MobileRestoreDriverOptions) {
    const documentDirectory = options.fileSystem.documentDirectory;
    if (!documentDirectory) throw new Error('The app document directory is unavailable.');
    this.paths = restorePaths(documentDirectory, options.backupId);
  }

  async resetStaging(_plan: RestorePlan): Promise<void> {
    await recoverInterruptedMobileRestore(this.options.fileSystem, this.options.runtime);
    await this.options.fileSystem.delete(this.paths.stagingDirectory);
    await this.options.fileSystem.ensureDirectory(this.paths.verifiedDirectory);
  }

  async writeVerifiedChunk(
    requirement: RestoreChunkRequirement,
    plaintext: Uint8Array,
  ): Promise<void> {
    await this.options.fileSystem.writeBytes(this.chunkPath(requirement.chunkId), plaintext);
  }

  async writeVerifiedIdentity(sealedRecoveryBundle: string): Promise<void> {
    await this.options.fileSystem.writeBytes(
      `${this.paths.verifiedDirectory}identity-recovery.txt`,
      encoder.encode(sealedRecoveryBundle),
    );
  }

  async rebuildStagedDatabase(plan: RestorePlan): Promise<void> {
    const databaseChunks = plan.requiredChunks
      .filter((requirement) => requirement.target.kind === 'database')
      .sort((left, right) => left.target.index - right.target.index)
      .map((requirement) => this.chunkPath(requirement.chunkId));
    if (plan.includesDatabase && databaseChunks.length === 0) {
      throw new Error('The restore plan has no verified database chunks.');
    }
    if (plan.includesDatabase) {
      await this.options.fileSystem.concatenate(this.paths.stagedDatabase, databaseChunks);
    }
    await this.options.fileSystem.ensureDirectory(this.paths.stagedObjectsDirectory);
    for (const objectId of plan.selectedObjectIds) {
      const objectChunks = plan.requiredChunks
        .filter((requirement) => requirement.target.kind === 'object'
          && requirement.target.objectId === objectId)
        .sort((left, right) => left.target.index - right.target.index)
        .map((requirement) => this.chunkPath(requirement.chunkId));
      if (objectChunks.length === 0) throw new Error(`Restore object has no verified chunks: ${objectId}`);
      const output = stagedObjectPath(this.paths, objectId);
      await this.options.fileSystem.concatenate(output, objectChunks);
      const bytes = await this.options.fileSystem.readBytes(output);
      try {
        if (blobContentHash(bytes) !== safeObjectId(objectId)) {
          throw new Error(`Restore object content hash does not match: ${objectId.slice(0, 12)}`);
        }
      } finally {
        bytes.fill(0);
      }
    }
  }

  async checkStagedIntegrity(plan: RestorePlan): Promise<RestoreCheckResult> {
    return plan.includesDatabase
      ? this.options.runtime.checkIntegrity(this.paths.stagedDatabase)
      : { passed: true, report: 'Database was not selected; active database remains unchanged.' };
  }

  async rehearseStagedMigrations(plan: RestorePlan): Promise<RestoreCheckResult> {
    return plan.includesDatabase
      ? this.options.runtime.rehearseMigrations(this.paths.stagedDatabase)
      : { passed: true, report: 'Database migrations were not required for an objects-only restore.' };
  }

  async checkIdentityConsistency(sealedRecoveryBundle: string): Promise<{
    consistent: boolean;
    report: string;
  }> {
    const recoveryBytes = parseRecoveryKey(this.options.recoveryKey);
    if (!recoveryBytes) return { consistent: false, report: 'The recovery key is invalid.' };
    try {
      const recovered = openRecovery(sealedRecoveryBundle, recoveryBytes);
      const consistent = recovered !== null && isRecoverableIdentityConsistent(recovered);
      return {
        consistent,
        report: consistent
          ? 'Recovered identity signing and key-agreement keys are consistent.'
          : 'Recovered identity keys are inconsistent.',
      };
    } finally {
      recoveryBytes.fill(0);
    }
  }

  async activate(plan: RestorePlan): Promise<RestoreActivationResult> {
    return this.options.runtime.withMaintenance(async (handle) => {
      handle.closeActiveDatabase();
      const hadPriorData = await this.options.fileSystem.exists(this.paths.activeDatabase);
      const objectHadPriorData = Object.fromEntries(await Promise.all(plan.selectedObjectIds.map(
        async (objectId) => [safeObjectId(objectId), await this.options.fileSystem.exists(
          activeObjectPath(this.paths, objectId),
        )] as const,
      )));
      let activationStarted = false;
      let databaseReopened = false;
      let installedIdentityRef: string | null = null;
      let installedIdentityHadPriorSecret = false;
      let journal: ActivationJournal = {
        version: 2,
        generation: 1,
        backupId: this.options.backupId,
        phase: 'prepared',
        hadPriorData,
        includesDatabase: plan.includesDatabase,
        objectHadPriorData,
        stagingDatabase: this.paths.stagedDatabase,
        activeDatabase: this.paths.activeDatabase,
        rollbackDirectory: this.paths.rollbackDirectory,
      };
      try {
        if (await this.options.fileSystem.exists(this.paths.rollbackDirectory)) {
          throw new Error('A retained rollback already exists for this backup. Release it before retrying.');
        }
        await this.options.fileSystem.ensureDirectory(this.paths.activeDirectory);
        await this.options.fileSystem.ensureDirectory(this.paths.activeBlobDirectory);
        await this.options.fileSystem.ensureDirectory(this.paths.rollbackDirectory);
        await writeJournal(this.options.fileSystem, this.paths.journal, journal);
        activationStarted = true;
        if (plan.includesDatabase && hadPriorData) {
          for (const activePath of sidecarPaths(this.paths.activeDatabase)) {
            if (await this.options.fileSystem.exists(activePath)) {
              await this.options.fileSystem.move(activePath, rollbackPath(this.paths, activePath));
            }
          }
        }
        journal = { ...journal, generation: journal.generation + 1, phase: 'active_moved' };
        await writeJournal(this.options.fileSystem, this.paths.journal, journal);
        await this.options.afterActiveMoved?.();
        if (plan.includesDatabase) {
          await this.options.fileSystem.move(this.paths.stagedDatabase, this.paths.activeDatabase);
        }
        for (const objectId of plan.selectedObjectIds) {
          const active = activeObjectPath(this.paths, objectId);
          if (objectHadPriorData[safeObjectId(objectId)]) {
            await this.options.fileSystem.move(active, rollbackObjectPath(this.paths, objectId));
          }
          await this.options.fileSystem.move(stagedObjectPath(this.paths, objectId), active);
        }
        journal = { ...journal, generation: journal.generation + 1, phase: 'staged_moved' };
        await writeJournal(this.options.fileSystem, this.paths.journal, journal);
        if (plan.includesDatabase) {
          const boot = await this.options.runtime.bootVerify(this.paths.activeDatabase);
          if (!boot.passed) throw new Error(boot.report);
        }
        const activeDatabase = handle.reopenActiveDatabase();
        databaseReopened = true;
        for (const objectId of plan.selectedObjectIds) {
          const metadata = getBlob(activeDatabase, objectId);
          const expectedSize = plan.requiredChunks
            .filter((requirement) => requirement.target.kind === 'object'
              && requirement.target.objectId === objectId)
            .reduce((total, requirement) => total + requirement.plaintextBytes, 0);
          if (!metadata || metadata.size !== expectedSize) {
            throw new Error(`Restored object metadata is missing or inconsistent: ${objectId.slice(0, 12)}`);
          }
        }
        if (plan.includesIdentity) {
          const sealed = decoder.decode(await this.options.fileSystem.readBytes(
            `${this.paths.verifiedDirectory}identity-recovery.txt`,
          ));
          const recoveryBytes = parseRecoveryKey(this.options.recoveryKey);
          if (!recoveryBytes) throw new Error('The recovery key is invalid during identity activation.');
          try {
            const recoverable = openRecovery(sealed, recoveryBytes);
            if (!recoverable) throw new Error('The verified recovery identity cannot be reopened.');
            installedIdentityRef = createDeviceIdentitySecretRef(recoverable.publicKey);
            installedIdentityHadPriorSecret = getDeviceIdentitySecrets(installedIdentityRef) !== null;
            const identity = restoreIdentityFromRecovery(recoverable);
            if (!identity) throw new Error('The recovered identity is inconsistent during activation.');
            upsertDeviceIdentity(activeDatabase, identity);
          } finally {
            recoveryBytes.fill(0);
          }
        }
        await this.options.fileSystem.writeBytes(
          `${this.paths.rollbackDirectory}retention.json`,
          encoder.encode(JSON.stringify({
            version: 1,
            backupId: this.options.backupId,
            hadPriorData,
            retainedAt: new Date().toISOString(),
          })),
        );
        await deleteJournalCopies(this.options.fileSystem, this.paths.journal);
        return {
          activated: true,
          report: 'Selected database, objects, and recovery identity activated and verified.',
          rollbackRetained: hadPriorData || Object.values(objectHadPriorData).some(Boolean),
          hadPriorData,
        };
      } catch (error) {
        let rollbackSucceeded = false;
        try {
          if (activationStarted) {
            if (databaseReopened) {
              handle.closeActiveDatabase();
              databaseReopened = false;
            }
            if (plan.includesDatabase) {
              if (journal.phase === 'prepared') {
                await restorePreparedRollbackFiles(this.options.fileSystem, this.paths, hadPriorData);
              } else {
                await restoreRollbackFiles(this.options.fileSystem, this.paths, hadPriorData);
              }
            }
            await restoreRollbackObjects(this.options.fileSystem, this.paths, objectHadPriorData);
            await this.options.fileSystem.delete(this.paths.rollbackDirectory);
            await deleteJournalCopies(this.options.fileSystem, this.paths.journal);
          }
          if (installedIdentityRef && !installedIdentityHadPriorSecret) deleteSyncSecret(installedIdentityRef);
          if (!databaseReopened) handle.reopenActiveDatabase();
          rollbackSucceeded = true;
        } catch {
          rollbackSucceeded = false;
        }
        return {
          activated: false,
          report: error instanceof Error ? error.message : 'Restore activation failed.',
          rollbackSucceeded,
          hadPriorData,
        };
      }
    });
  }

  private chunkPath(chunkId: string): string {
    const parts = chunkId.split('/');
    if (parts.some((part) => !/^[A-Za-z0-9._-]+$/u.test(part) || part === '.' || part === '..')) {
      throw new Error('Restore chunk id is not path safe.');
    }
    return `${this.paths.verifiedDirectory}${chunkId}.plain`;
  }
}

export interface RunMobileLocalRestoreInput {
  plan: RestorePlan;
  destinationId: string;
  locatorJson: string;
  manifestEnvelope: Uint8Array;
  recoveryKey: string;
  source: RestoreEncryptedSource;
  listedBackupIds?: readonly string[];
  fileSystem?: MobileRestoreFileSystem;
  runtime?: MobileRestoreDatabaseRuntime;
  afterActiveMoved?: () => void | Promise<void>;
}

export async function runMobileLocalRestore(
  input: RunMobileLocalRestoreInput,
): Promise<StagedRestoreExecutionResult> {
  const fileSystem = input.fileSystem ?? createExpoRestoreFileSystem();
  if (!fileSystem?.documentDirectory) throw new Error('The app document directory is unavailable.');
  const runtime = input.runtime ?? new ExpoMobileRestoreDatabaseRuntime();
  return runStagedRestore({
    plan: input.plan,
    destinationId: input.destinationId,
    locatorJson: input.locatorJson,
    manifestEnvelope: input.manifestEnvelope,
    recoveryKey: input.recoveryKey,
    source: input.source,
    listedBackupIds: input.listedBackupIds,
    driver: new MobileLocalRestoreDriver({
      backupId: input.plan.backupId,
      recoveryKey: input.recoveryKey,
      fileSystem,
      runtime,
      afterActiveMoved: input.afterActiveMoved,
    }),
  });
}
