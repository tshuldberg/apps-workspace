import { assertSafeRestoreBackupId } from './storage-destinations/restore-orchestrator-core';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';

const JOURNAL_FILE_NAME = 'restore-activation.json';
const ACTIVE_DATABASE_FILE_NAME = 'meerkat.db';

export interface SynchronousRestoreFile {
  readonly exists: boolean;
  readonly uri: string;
  textSync(): string;
  delete(): void;
  move(destination: SynchronousRestoreFile): void;
}

export interface SynchronousRestoreDirectory {
  readonly exists: boolean;
  readonly uri: string;
  delete(): void;
}

export interface SynchronousRestoreFileSystem {
  File: new (uri: string) => SynchronousRestoreFile;
  Directory: new (uri: string) => SynchronousRestoreDirectory;
  Paths: { document: SynchronousRestoreDirectory };
}

interface ActivationJournal {
  version: 1 | 2;
  generation: number;
  backupId: string;
  phase: 'prepared' | 'active_moved' | 'staged_moved';
  hadPriorData: boolean;
  includesDatabase: boolean;
  objectHadPriorData: Readonly<Record<string, boolean>>;
  stagingDatabase: string;
  activeDatabase: string;
  rollbackDirectory: string;
}

function loadSynchronousFileSystem(): SynchronousRestoreFileSystem | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as SynchronousRestoreFileSystem;
  } catch {
    return null;
  }
}

function parseJournalValue(parsed: unknown): ActivationJournal {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid object');
  const row = parsed as Record<string, unknown>;
  if (
    ![1, 2].includes(Number(row.version))
    || typeof row.backupId !== 'string'
    || !['prepared', 'active_moved', 'staged_moved'].includes(String(row.phase))
    || typeof row.hadPriorData !== 'boolean'
    || typeof row.stagingDatabase !== 'string'
    || typeof row.activeDatabase !== 'string'
    || typeof row.rollbackDirectory !== 'string'
  ) throw new Error('invalid fields');
  const generation = row.version === 2 && Number.isSafeInteger(row.generation) && Number(row.generation) > 0
    ? Number(row.generation)
    : 0;
  if (row.version === 2 && generation === 0) throw new Error('invalid generation');
  assertSafeRestoreBackupId(row.backupId);
  return {
    version: row.version as 1 | 2,
    generation,
    backupId: row.backupId,
    phase: row.phase as ActivationJournal['phase'],
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

function safeObjectId(objectId: string): string {
  if (!/^[a-f0-9]{128}$/iu.test(objectId)) throw new Error('invalid restore object id');
  return objectId.toLowerCase();
}

function parseJournal(file: SynchronousRestoreFile): ActivationJournal {
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const envelope = parsed as Record<string, unknown>;
      if (envelope.version === 1 && typeof envelope.checksumSha256 === 'string' && envelope.journal) {
        const bytes = new TextEncoder().encode(JSON.stringify(envelope.journal));
        if (sha256Hex(bytes) !== envelope.checksumSha256) throw new Error('checksum mismatch');
        return parseJournalValue(envelope.journal);
      }
    }
    return parseJournalValue(parsed);
  } catch (error) {
    throw new Error('The pending restore journal cannot be recovered safely.', { cause: error });
  }
}

function sidecars(databaseUri: string): readonly string[] {
  return [databaseUri, `${databaseUri}-wal`, `${databaseUri}-shm`];
}

function moveReplacing(fileSystem: SynchronousRestoreFileSystem, from: string, to: string): void {
  const source = new fileSystem.File(from);
  if (!source.exists) return;
  const destination = new fileSystem.File(to);
  if (destination.exists) destination.delete();
  source.move(destination);
}

/** Restore the old SQLite image before its first open after an interrupted activation. */
export function recoverInterruptedMobileRestoreBeforeOpen(
  injectedFileSystem?: SynchronousRestoreFileSystem,
  storageRoot?: string,
): boolean {
  const fileSystem = injectedFileSystem ?? loadSynchronousFileSystem();
  if (!fileSystem) return false;
  const root = storageRoot ?? fileSystem.Paths.document.uri;
  const documents = root.endsWith('/') ? root : `${root}/`;
  const journalUri = `${documents}meerkat/${JOURNAL_FILE_NAME}`;
  const journalFiles = [journalUri, `${journalUri}.0`, `${journalUri}.1`]
    .map((uri) => new fileSystem.File(uri));
  const existingJournals = journalFiles.filter((file) => file.exists);
  if (existingJournals.length === 0) return false;
  const parsedJournals = existingJournals.flatMap((file) => {
    try { return [parseJournal(file)]; } catch { return []; }
  });
  if (parsedJournals.length === 0) {
    throw new Error('The pending restore journal cannot be recovered safely.');
  }
  const journal = parsedJournals.sort((left, right) => right.generation - left.generation)[0]!;
  const expectedStaging = `${documents}meerkat/restore-staging/${journal.backupId}/restored.db`;
  const expectedActive = `${documents}SQLite/${ACTIVE_DATABASE_FILE_NAME}`;
  const expectedRollback = `${documents}meerkat/restore-rollback/${journal.backupId}/`;
  if (
    journal.stagingDatabase !== expectedStaging
    || journal.activeDatabase !== expectedActive
    || journal.rollbackDirectory !== expectedRollback
  ) throw new Error('The pending restore journal contains unexpected paths.');

  if (!journal.includesDatabase) {
    // The active SQLite image was intentionally not selected.
  } else if (journal.phase === 'prepared') {
    if (journal.hadPriorData) {
      for (const activePath of sidecars(expectedActive)) {
        const suffix = activePath.slice(expectedActive.length);
        moveReplacing(fileSystem, `${expectedRollback}${ACTIVE_DATABASE_FILE_NAME}${suffix}`, activePath);
      }
      if (!(new fileSystem.File(expectedActive)).exists) {
        throw new Error('The prior database is missing during partial restore recovery.');
      }
    } else if ((new fileSystem.File(expectedActive)).exists) {
      throw new Error('An unexpected active database appeared during fresh-install recovery.');
    }
  } else {
    if (journal.hadPriorData) {
      for (const activePath of sidecars(expectedActive)) {
        const suffix = activePath.slice(expectedActive.length);
        moveReplacing(fileSystem, `${expectedRollback}${ACTIVE_DATABASE_FILE_NAME}${suffix}`, activePath);
      }
      if (!(new fileSystem.File(expectedActive)).exists) {
        throw new Error('The rollback database is missing during restore recovery.');
      }
    } else for (const activePath of sidecars(expectedActive)) {
      const active = new fileSystem.File(activePath);
      if (active.exists) active.delete();
    }
  }

  for (const [objectId, hadPriorData] of Object.entries(journal.objectHadPriorData)) {
    const active = `${documents}meerkat/blobs/${safeObjectId(objectId)}`;
    const rollback = `${expectedRollback}objects/${safeObjectId(objectId)}`;
    const rollbackFile = new fileSystem.File(rollback);
    if (rollbackFile.exists) {
      moveReplacing(fileSystem, rollback, active);
    } else if (!hadPriorData) {
      const activeFile = new fileSystem.File(active);
      if (activeFile.exists) activeFile.delete();
    } else if (!(new fileSystem.File(active)).exists) {
      throw new Error('A prior restore object is missing during recovery.');
    }
  }

  const rollbackDirectory = new fileSystem.Directory(expectedRollback);
  if (rollbackDirectory.exists) rollbackDirectory.delete();
  for (const journalFile of journalFiles) if (journalFile.exists) journalFile.delete();
  return true;
}
