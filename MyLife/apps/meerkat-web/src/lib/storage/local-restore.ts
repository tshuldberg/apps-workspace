import {
  blobContentHash,
  createDeviceIdentitySecretRef,
  deleteSyncSecret,
  ensureStorageTables,
  getBlob,
  getDeviceIdentity,
  getDeviceIdentitySecrets,
  isRecoverableIdentityConsistent,
  openRecovery,
  parseRecoveryKey,
  restoreIdentityFromRecovery,
  upsertDeviceIdentity,
} from '@mylife/sync';
import type { RestorePlan, RestoreChunkRequirement } from '@mylife/sync/src/storage/restore-controller';
import type { DeviceIdentity } from '@mylife/sync';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import { ensureDmTables } from '../dm-core';
import {
  createBrowserDatabaseAdapter,
  type BrowserDatabaseAdapter,
  type DbBytesStore,
} from './browser-database-adapter';
import type { LocateFile } from './load-sqljs';
import { STORE_BLOB_BYTES, STORE_SQLITE, openMeerkatIdb } from './idb';
import { acquireDatabaseWriter } from './database-ownership';
import {
  assertSafeRestoreBackupId,
  runStagedRestore,
  type RestoreActivationResult,
  type RestoreCheckResult,
  type RestoreEncryptedSource,
  type RestorePlatformDriver,
  type StagedRestoreExecutionResult,
} from './restore-orchestrator-core';

const ACTIVE_DATABASE_KEY = 'db';
const encoder = new TextEncoder();

export interface WebRestorePersistence {
  resetStaging(backupId: string): Promise<void>;
  writeVerifiedChunk(backupId: string, chunkId: string, bytes: Uint8Array): Promise<void>;
  readVerifiedChunk(backupId: string, chunkId: string): Promise<Uint8Array | null>;
  writeVerifiedIdentity(backupId: string, sealedRecoveryBundle: string): Promise<void>;
  readVerifiedIdentity(backupId: string): Promise<string | null>;
  writeStagedObject(backupId: string, objectId: string, bytes: Uint8Array): Promise<void>;
  readStagedObject(backupId: string, objectId: string): Promise<Uint8Array | null>;
  writeStagedDatabase(backupId: string, bytes: Uint8Array): Promise<void>;
  readStagedDatabase(backupId: string): Promise<Uint8Array | null>;
  readActiveDatabase(): Promise<Uint8Array | null>;
  activateSelection(
    backupId: string,
    stagedDatabase: Uint8Array | null,
    objects: readonly { objectId: string; bytes: Uint8Array }[],
    afterRollbackWritten?: () => void,
  ): Promise<{ hadPriorData: boolean; rollbackRetained: boolean }>;
  rollbackSelection(
    backupId: string,
    hadPriorData: boolean,
    objectIds: readonly string[],
  ): Promise<boolean>;
  releaseRollback(backupId: string): Promise<void>;
}

function stagingPrefix(backupId: string): string {
  return `restore-staging:${backupId}:`;
}

function stagingChunkKey(backupId: string, chunkId: string): string {
  return `${stagingPrefix(backupId)}chunk:${chunkId}`;
}

function stagedDatabaseKey(backupId: string): string {
  return `${stagingPrefix(backupId)}database`;
}

function safeObjectId(objectId: string): string {
  if (!/^[a-f0-9]{128}$/iu.test(objectId)) {
    throw new Error('Restore object id is not a SHA-512 content hash.');
  }
  return objectId.toLowerCase();
}

function stagedObjectKey(backupId: string, objectId: string): string {
  return `${stagingPrefix(backupId)}object:${safeObjectId(objectId)}`;
}

function rollbackObjectKey(backupId: string, objectId: string): string {
  return `restore-rollback:${backupId}:object:${safeObjectId(objectId)}`;
}

function rollbackDatabaseKey(backupId: string): string {
  return `restore-rollback:${backupId}:database`;
}

function rollbackRetentionKey(backupId: string): string {
  return `restore-rollback:${backupId}:retention`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function normalizeStoredBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export class IndexedDbWebRestorePersistence implements WebRestorePersistence {
  async resetStaging(backupId: string): Promise<void> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction(STORE_SQLITE, 'readwrite');
    const store = transaction.objectStore(STORE_SQLITE);
    const keys = await requestResult(store.getAllKeys());
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(stagingPrefix(backupId))) store.delete(key);
    }
    await transactionDone(transaction);
  }

  async writeVerifiedChunk(
    backupId: string,
    chunkId: string,
    bytes: Uint8Array,
  ): Promise<void> {
    await this.put(stagingChunkKey(backupId, chunkId), bytes);
  }

  async readVerifiedChunk(backupId: string, chunkId: string): Promise<Uint8Array | null> {
    return this.get(stagingChunkKey(backupId, chunkId));
  }

  async writeVerifiedIdentity(backupId: string, sealedRecoveryBundle: string): Promise<void> {
    await this.put(`${stagingPrefix(backupId)}identity`, encoder.encode(sealedRecoveryBundle));
  }

  async readVerifiedIdentity(backupId: string): Promise<string | null> {
    const bytes = await this.get(`${stagingPrefix(backupId)}identity`);
    if (!bytes) return null;
    try {
      return new TextDecoder().decode(bytes);
    } finally {
      bytes.fill(0);
    }
  }

  async writeStagedObject(backupId: string, objectId: string, bytes: Uint8Array): Promise<void> {
    await this.put(stagedObjectKey(backupId, objectId), bytes);
  }

  async readStagedObject(backupId: string, objectId: string): Promise<Uint8Array | null> {
    return this.get(stagedObjectKey(backupId, objectId));
  }

  async writeStagedDatabase(backupId: string, bytes: Uint8Array): Promise<void> {
    await this.put(stagedDatabaseKey(backupId), bytes);
  }

  async readStagedDatabase(backupId: string): Promise<Uint8Array | null> {
    return this.get(stagedDatabaseKey(backupId));
  }

  async readActiveDatabase(): Promise<Uint8Array | null> {
    return this.get(ACTIVE_DATABASE_KEY);
  }

  async activateSelection(
    backupId: string,
    stagedDatabase: Uint8Array | null,
    objects: readonly { objectId: string; bytes: Uint8Array }[],
    afterRollbackWritten?: () => void,
  ): Promise<{ hadPriorData: boolean; rollbackRetained: boolean }> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction([STORE_SQLITE, STORE_BLOB_BYTES], 'readwrite');
    const store = transaction.objectStore(STORE_SQLITE);
    const blobs = transaction.objectStore(STORE_BLOB_BYTES);
    let hadPriorData = false;
    let rollbackRetained = false;
    try {
      const activeValue = await requestResult(store.get(ACTIVE_DATABASE_KEY));
      const active = normalizeStoredBytes(activeValue);
      hadPriorData = active !== null;
      if (stagedDatabase !== null) {
        if (active) store.put(active, rollbackDatabaseKey(backupId));
        else store.delete(rollbackDatabaseKey(backupId));
        rollbackRetained ||= active !== null;
      }
      for (const object of objects) {
        const objectId = safeObjectId(object.objectId);
        const prior = await requestResult(blobs.get(objectId));
        if (prior === undefined) store.delete(rollbackObjectKey(backupId, objectId));
        else {
          store.put(prior, rollbackObjectKey(backupId, objectId));
          rollbackRetained = true;
        }
      }
      store.put(encoder.encode(JSON.stringify({
        version: 2,
        backupId,
        hadPriorData,
        databaseReplaced: stagedDatabase !== null,
        objectIds: objects.map((object) => safeObjectId(object.objectId)),
        retainedAt: new Date().toISOString(),
      })), rollbackRetentionKey(backupId));
      afterRollbackWritten?.();
      if (stagedDatabase !== null) store.put(new Uint8Array(stagedDatabase), ACTIVE_DATABASE_KEY);
      for (const object of objects) {
        const copy = new Uint8Array(object.bytes);
        blobs.put(new Blob([copy.buffer], { type: 'application/octet-stream' }), safeObjectId(object.objectId));
      }
      await transactionDone(transaction);
      return { hadPriorData, rollbackRetained };
    } catch (error) {
      try { transaction.abort(); } catch { /* transaction already settled */ }
      throw error;
    }
  }

  async rollbackSelection(
    backupId: string,
    hadPriorData: boolean,
    objectIds: readonly string[],
  ): Promise<boolean> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction([STORE_SQLITE, STORE_BLOB_BYTES], 'readwrite');
    const store = transaction.objectStore(STORE_SQLITE);
    const blobs = transaction.objectStore(STORE_BLOB_BYTES);
    try {
      const retentionValue = normalizeStoredBytes(await requestResult(
        store.get(rollbackRetentionKey(backupId)),
      ));
      const retention = retentionValue
        ? JSON.parse(new TextDecoder().decode(retentionValue)) as { databaseReplaced?: unknown }
        : null;
      if (retention?.databaseReplaced === true && hadPriorData) {
        const rollbackValue = await requestResult(store.get(rollbackDatabaseKey(backupId)));
        const rollback = normalizeStoredBytes(rollbackValue);
        if (!rollback) {
          transaction.abort();
          return false;
        }
        store.put(rollback, ACTIVE_DATABASE_KEY);
      } else if (retention?.databaseReplaced === true) {
        store.delete(ACTIVE_DATABASE_KEY);
      }
      for (const rawObjectId of objectIds) {
        const objectId = safeObjectId(rawObjectId);
        const prior = await requestResult(store.get(rollbackObjectKey(backupId, objectId)));
        if (prior === undefined) blobs.delete(objectId);
        else blobs.put(prior, objectId);
      }
      await transactionDone(transaction);
      return true;
    } catch {
      try { transaction.abort(); } catch { /* transaction already settled */ }
      return false;
    }
  }

  async releaseRollback(backupId: string): Promise<void> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction(STORE_SQLITE, 'readwrite');
    const store = transaction.objectStore(STORE_SQLITE);
    store.delete(rollbackDatabaseKey(backupId));
    store.delete(rollbackRetentionKey(backupId));
    const keys = await requestResult(store.getAllKeys());
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(`restore-rollback:${backupId}:object:`)) {
        store.delete(key);
      }
    }
    await transactionDone(transaction);
  }

  private async get(key: string): Promise<Uint8Array | null> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction(STORE_SQLITE, 'readonly');
    return normalizeStoredBytes(await requestResult(transaction.objectStore(STORE_SQLITE).get(key)));
  }

  private async put(key: string, bytes: Uint8Array): Promise<void> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction(STORE_SQLITE, 'readwrite');
    transaction.objectStore(STORE_SQLITE).put(new Uint8Array(bytes), key);
    await transactionDone(transaction);
  }
}

class MutableBytesStore implements DbBytesStore {
  private bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = new Uint8Array(bytes);
  }

  async read(): Promise<Uint8Array> {
    return new Uint8Array(this.bytes);
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.bytes = new Uint8Array(bytes);
  }

  snapshot(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  clear(): void {
    this.bytes.fill(0);
  }
}

async function withDatabaseBytes<T>(
  bytes: Uint8Array,
  operation: (database: BrowserDatabaseAdapter, store: MutableBytesStore) => Promise<T> | T,
  locateFile?: LocateFile,
): Promise<T> {
  const store = new MutableBytesStore(bytes);
  const database = await createBrowserDatabaseAdapter({
    bytesStore: store,
    persistDebounceMs: 0,
    ...(locateFile === undefined ? {} : { locateFile }),
  });
  try {
    return await operation(database, store);
  } finally {
    await database.close();
    store.clear();
  }
}

async function browserIntegrity(
  bytes: Uint8Array,
  locateFile?: LocateFile,
): Promise<RestoreCheckResult> {
  return withDatabaseBytes(bytes, (database) => {
    const rows = database.query<Record<string, unknown>>('PRAGMA integrity_check;');
    const reports = rows.flatMap((row) => Object.values(row))
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
    const report = reports.join('\n') || 'integrity_check returned no result';
    return { passed: reports.length === 1 && reports[0]?.toLowerCase() === 'ok', report };
  }, locateFile);
}

export interface WebLocalRestoreDriverOptions {
  backupId: string;
  recoveryKey: string;
  persistence: WebRestorePersistence;
  activeDatabase?: BrowserDatabaseAdapter | null;
  afterRollbackWritten?: () => void;
  locateFile?: LocateFile;
}

export class WebLocalRestoreDriver implements RestorePlatformDriver {
  private activeDatabaseClosed = false;

  constructor(private readonly options: WebLocalRestoreDriverOptions) {
    assertSafeRestoreBackupId(options.backupId);
  }

  get didCloseActiveDatabase(): boolean {
    return this.activeDatabaseClosed;
  }

  async resetStaging(_plan: RestorePlan): Promise<void> {
    await this.options.persistence.resetStaging(this.options.backupId);
  }

  async writeVerifiedChunk(
    requirement: RestoreChunkRequirement,
    plaintext: Uint8Array,
  ): Promise<void> {
    await this.options.persistence.writeVerifiedChunk(
      this.options.backupId,
      requirement.chunkId,
      plaintext,
    );
  }

  async writeVerifiedIdentity(sealedRecoveryBundle: string): Promise<void> {
    await this.options.persistence.writeVerifiedIdentity(
      this.options.backupId,
      sealedRecoveryBundle,
    );
  }

  async rebuildStagedDatabase(plan: RestorePlan): Promise<void> {
    if (plan.includesDatabase) {
      const requirements = plan.requiredChunks
        .filter((requirement) => requirement.target.kind === 'database')
        .sort((left, right) => left.target.index - right.target.index);
      const total = requirements.reduce((sum, requirement) => sum + requirement.plaintextBytes, 0);
      if (!Number.isSafeInteger(total) || total <= 0) throw new Error('The staged database size is invalid.');
      const databaseBytes = new Uint8Array(total);
      let offset = 0;
      for (const requirement of requirements) {
        const chunk = await this.options.persistence.readVerifiedChunk(
          this.options.backupId,
          requirement.chunkId,
        );
        if (!chunk || chunk.length !== requirement.plaintextBytes) {
          throw new Error(`Verified staging chunk is missing: ${requirement.chunkId}`);
        }
        databaseBytes.set(chunk, offset);
        offset += chunk.length;
        chunk.fill(0);
      }
      await this.options.persistence.writeStagedDatabase(this.options.backupId, databaseBytes);
      databaseBytes.fill(0);
    }
    for (const objectId of plan.selectedObjectIds) {
      const requirements = plan.requiredChunks
        .filter((requirement) => requirement.target.kind === 'object'
          && requirement.target.objectId === objectId)
        .sort((left, right) => left.target.index - right.target.index);
      const total = requirements.reduce((sum, requirement) => sum + requirement.plaintextBytes, 0);
      if (!Number.isSafeInteger(total) || total < 0 || requirements.length === 0) {
        throw new Error(`The staged object size is invalid: ${objectId}`);
      }
      const objectBytes = new Uint8Array(total);
      let offset = 0;
      for (const requirement of requirements) {
        const chunk = await this.options.persistence.readVerifiedChunk(
          this.options.backupId,
          requirement.chunkId,
        );
        if (!chunk || chunk.length !== requirement.plaintextBytes) {
          throw new Error(`Verified staging chunk is missing: ${requirement.chunkId}`);
        }
        objectBytes.set(chunk, offset);
        offset += chunk.length;
        chunk.fill(0);
      }
      if (blobContentHash(objectBytes) !== safeObjectId(objectId)) {
        objectBytes.fill(0);
        throw new Error(`Restore object content hash does not match: ${objectId.slice(0, 12)}`);
      }
      await this.options.persistence.writeStagedObject(this.options.backupId, objectId, objectBytes);
      objectBytes.fill(0);
    }
  }

  async checkStagedIntegrity(plan: RestorePlan): Promise<RestoreCheckResult> {
    if (!plan.includesDatabase) {
      return { passed: true, report: 'Database was not selected; active database remains unchanged.' };
    }
    const bytes = await this.requireStagedDatabase();
    try {
      return await browserIntegrity(bytes, this.options.locateFile);
    } finally {
      bytes.fill(0);
    }
  }

  async rehearseStagedMigrations(plan: RestorePlan): Promise<RestoreCheckResult> {
    if (!plan.includesDatabase) {
      return { passed: true, report: 'Database migrations were not required for an objects-only restore.' };
    }
    const bytes = await this.requireStagedDatabase();
    try {
      return await withDatabaseBytes(bytes, async (database) => {
        try {
          ensureMeerkatTables(database);
          ensureSyncSchema(database);
          ensureDmTables(database);
          ensureStorageTables(database);
          await database.flush();
          const migrated = await database.export();
          try {
            const integrity = await browserIntegrity(migrated, this.options.locateFile);
            if (!integrity.passed) return integrity;
            await this.options.persistence.writeStagedDatabase(this.options.backupId, migrated);
            return { passed: true, report: 'Web app migrations completed; integrity_check: ok' };
          } finally {
            migrated.fill(0);
          }
        } catch (error) {
          return {
            passed: false,
            report: error instanceof Error ? error.message : 'Web migration rehearsal failed.',
          };
        }
      }, this.options.locateFile);
    } finally {
      bytes.fill(0);
    }
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
    let databaseBytes: Uint8Array | null = null;
    let restoredIdentity: DeviceIdentity | null = null;
    let installedIdentityRef: string | null = null;
    let installedIdentityHadPriorSecret = false;
    const objects: { objectId: string; bytes: Uint8Array }[] = [];
    let activated: { hadPriorData: boolean; rollbackRetained: boolean } | null = null;
    try {
      if (plan.includesIdentity) {
        const sealed = await this.options.persistence.readVerifiedIdentity(this.options.backupId);
        const recoveryBytes = parseRecoveryKey(this.options.recoveryKey);
        if (!sealed || !recoveryBytes) throw new Error('The verified recovery identity is unavailable.');
        try {
          const recoverable = openRecovery(sealed, recoveryBytes);
          if (!recoverable || !isRecoverableIdentityConsistent(recoverable)) {
            throw new Error('The recovered identity is inconsistent during activation.');
          }
          restoredIdentity = {
            publicKey: recoverable.publicKey,
            privateKeyRef: createDeviceIdentitySecretRef(recoverable.publicKey),
            dhPublicKey: recoverable.dhPublicKey,
            displayName: recoverable.displayName,
            createdAt: new Date().toISOString(),
          };
        } finally {
          recoveryBytes.fill(0);
        }
      }

      databaseBytes = plan.includesDatabase
        ? await this.requireStagedDatabase()
        : restoredIdentity ? await this.options.persistence.readActiveDatabase() : null;
      if (restoredIdentity) {
        if (!databaseBytes) throw new Error('The active database is unavailable for identity activation.');
        const source = databaseBytes;
        databaseBytes = await withDatabaseBytes(source, async (database) => {
          ensureMeerkatTables(database);
          ensureSyncSchema(database);
          ensureDmTables(database);
          ensureStorageTables(database);
          upsertDeviceIdentity(database, restoredIdentity!);
          await database.flush();
          return database.export();
        }, this.options.locateFile);
        source.fill(0);
      }
      for (const objectId of plan.selectedObjectIds) {
        const bytes = await this.options.persistence.readStagedObject(this.options.backupId, objectId);
        if (!bytes || blobContentHash(bytes) !== safeObjectId(objectId)) {
          bytes?.fill(0);
          throw new Error(`The staged restore object is missing or corrupt: ${objectId.slice(0, 12)}`);
        }
        objects.push({ objectId: safeObjectId(objectId), bytes });
      }

      if (databaseBytes && this.options.activeDatabase) {
        await this.options.activeDatabase.flush();
        await this.options.activeDatabase.close({ retainOwnership: true });
        this.activeDatabaseClosed = true;
      }
      activated = await this.options.persistence.activateSelection(
        this.options.backupId,
        databaseBytes,
        objects,
        this.options.afterRollbackWritten,
      );
      const active = await this.options.persistence.readActiveDatabase();
      const boot = databaseBytes && active
        ? await browserIntegrity(active, this.options.locateFile)
        : databaseBytes ? { passed: false, report: 'Activated database is missing.' }
          : { passed: true, report: 'Active database was not replaced.' };
      if (!boot.passed) {
        active?.fill(0);
        throw new Error(boot.report);
      }
      if (active && (objects.length > 0 || restoredIdentity)) {
        await withDatabaseBytes(active, (database) => {
          for (const object of objects) {
            const metadata = getBlob(database, object.objectId);
            if (!metadata || metadata.size !== object.bytes.length) {
              throw new Error(`Restored object metadata is missing or inconsistent: ${object.objectId.slice(0, 12)}`);
            }
          }
          if (restoredIdentity) {
            const storedIdentity = getDeviceIdentity(database);
            if (storedIdentity?.publicKey !== restoredIdentity.publicKey
              || storedIdentity.dhPublicKey !== restoredIdentity.dhPublicKey
              || storedIdentity.privateKeyRef !== restoredIdentity.privateKeyRef) {
              throw new Error('The activated database identity does not match the recovery bundle.');
            }
          }
        }, this.options.locateFile);
      }
      active?.fill(0);
      if (restoredIdentity) {
        installedIdentityRef = restoredIdentity.privateKeyRef;
        installedIdentityHadPriorSecret = getDeviceIdentitySecrets(installedIdentityRef) !== null;
        const sealed = await this.options.persistence.readVerifiedIdentity(this.options.backupId);
        const recoveryBytes = parseRecoveryKey(this.options.recoveryKey);
        if (!sealed || !recoveryBytes) throw new Error('The verified recovery identity is unavailable.');
        try {
          const recoverable = openRecovery(sealed, recoveryBytes);
          if (!recoverable || !restoreIdentityFromRecovery(recoverable)) {
            throw new Error('The recovered identity could not be installed in secure storage.');
          }
        } finally {
          recoveryBytes.fill(0);
        }
      }
      return {
        activated: true,
        report: 'Selected database, objects, and recovery identity activated atomically and verified.',
        rollbackRetained: activated.rollbackRetained,
        hadPriorData: activated.hadPriorData,
      };
    } catch (error) {
      const active = await this.options.persistence.readActiveDatabase();
      const hadPriorData = activated?.hadPriorData ?? active !== null;
      active?.fill(0);
      const rollbackSucceeded = activated
        ? await this.options.persistence.rollbackSelection(
          this.options.backupId,
          hadPriorData,
          plan.selectedObjectIds,
        )
        : true;
      if (installedIdentityRef && !installedIdentityHadPriorSecret) deleteSyncSecret(installedIdentityRef);
      return {
        activated: false,
        report: error instanceof Error ? error.message : 'Browser restore activation failed.',
        rollbackSucceeded,
        hadPriorData,
      };
    } finally {
      databaseBytes?.fill(0);
      for (const object of objects) object.bytes.fill(0);
    }
  }

  private async requireStagedDatabase(): Promise<Uint8Array> {
    const bytes = await this.options.persistence.readStagedDatabase(this.options.backupId);
    if (!bytes) throw new Error('The staged database is missing.');
    return bytes;
  }
}

export interface RunWebLocalRestoreInput {
  plan: RestorePlan;
  destinationId: string;
  locatorJson: string;
  manifestEnvelope: Uint8Array;
  recoveryKey: string;
  source: RestoreEncryptedSource;
  listedBackupIds?: readonly string[];
  persistence?: WebRestorePersistence;
  activeDatabase?: BrowserDatabaseAdapter | null;
  afterRollbackWritten?: () => void;
  locateFile?: LocateFile;
}

export interface WebLocalRestoreResult extends StagedRestoreExecutionResult {
  /** A controlled page reload is required before any further database access. */
  activeDatabaseClosed: boolean;
}

export async function runWebLocalRestore(
  input: RunWebLocalRestoreInput,
): Promise<WebLocalRestoreResult> {
  const persistence = input.persistence ?? new IndexedDbWebRestorePersistence();
  const driver = new WebLocalRestoreDriver({
    backupId: input.plan.backupId,
    recoveryKey: input.recoveryKey,
    persistence,
    activeDatabase: input.activeDatabase,
    afterRollbackWritten: input.afterRollbackWritten,
    locateFile: input.locateFile,
  });
  const release = !input.activeDatabase && !input.persistence ? await acquireDatabaseWriter() : null;
  try {
    const result = await runStagedRestore({
      plan: input.plan,
      destinationId: input.destinationId,
      locatorJson: input.locatorJson,
      manifestEnvelope: input.manifestEnvelope,
      recoveryKey: input.recoveryKey,
      source: input.source,
      listedBackupIds: input.listedBackupIds,
      driver,
    });
    return { ...result, activeDatabaseClosed: driver.didCloseActiveDatabase };
  } finally { await release?.(); }
}

export async function releaseWebRestoreRollback(
  backupId: string,
  persistence: WebRestorePersistence = new IndexedDbWebRestorePersistence(),
): Promise<void> {
  assertSafeRestoreBackupId(backupId);
  await persistence.releaseRollback(backupId);
}

export { readExplicitBackupUpload } from './local-snapshot';
