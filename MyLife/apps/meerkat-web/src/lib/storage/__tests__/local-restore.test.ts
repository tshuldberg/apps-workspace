import { beforeEach, describe, expect, it } from 'vitest';
import {
  blobContentHash,
  createDeviceIdentitySecretRef,
  createRestorePlan,
  encodeBackup,
  encodeRecoveryKey,
  getDeviceIdentitySecrets,
  insertBlob,
  openRecovery,
  openBackupManifest,
  parseRecoveryKey,
  type EncodedBackup,
  type RestoreChunkRequirement,
  type RestorePlan,
} from '@mylife/sync';
import {
  VECTOR_BACKUP_INPUT,
  VECTOR_RECOVERY_KEY,
} from '@mylife/sync/src/storage/test-vectors';
import { createBrowserDatabaseAdapter, type BrowserDatabaseAdapter } from '../browser-database-adapter';
import { STORE_SQLITE, idbGet, idbPut } from '../idb';
import { STORE_BLOB_BYTES } from '../idb';
import { ensureSyncSchema } from '../../schema';
import {
  IndexedDbWebRestorePersistence,
  releaseWebRestoreRollback,
  runWebLocalRestore,
} from '../local-restore';
import type { RestoreEncryptedSource } from '../restore-orchestrator-core';
import { nodeLocateFile, resetDurableLayer } from './helpers';

const locateFile = nodeLocateFile();
const ACTIVE_KEY = 'db';

interface WebBackupFixture {
  encoded: EncodedBackup;
  plan: RestorePlan;
}

async function sqliteBytes(mode: 'valid' | 'migration_conflict'): Promise<Uint8Array> {
  const database = await createBrowserDatabaseAdapter({ locateFile, persistDebounceMs: 0, bytesStore: { async read() { return null; }, async write() {} } });
  if (mode === 'migration_conflict') {
    database.execute('CREATE TABLE mk_pinned (bad TEXT)');
  } else {
    database.execute('CREATE TABLE snapshot_marker (value TEXT NOT NULL)');
    database.execute('INSERT INTO snapshot_marker (value) VALUES (?)', ['restored']);
  }
  const bytes = await database.export();
  await database.close();
  return bytes;
}

async function backupFixture(
  mode: 'valid' | 'invalid_integrity' | 'migration_conflict' = 'valid',
): Promise<WebBackupFixture> {
  const bytes = mode === 'invalid_integrity'
    ? new TextEncoder().encode('not a SQLite database')
    : await sqliteBytes(mode);
  const split = Math.max(1, Math.floor(bytes.length / 2));
  const encoded = encodeBackup({
    ...VECTOR_BACKUP_INPUT,
    backupId: `web-${mode}-backup`,
    databaseChunks: [bytes.slice(0, split), bytes.slice(split)],
    objects: [],
  });
  bytes.fill(0);
  const opened = openBackupManifest(
    encoded.locatorJson,
    encoded.manifest.envelope,
    VECTOR_RECOVERY_KEY,
  );
  if (!opened.ok) throw opened.error;
  const plan = createRestorePlan(opened.manifest, { mode: 'database_only' });
  opened.backupRootKey.fill(0);
  return { encoded, plan };
}

function sourceFor(
  encoded: EncodedBackup,
  transform: (bytes: Uint8Array, requirement: RestoreChunkRequirement) => Uint8Array = (bytes) => bytes,
): RestoreEncryptedSource {
  return {
    async readChunk(requirement) {
      const target = requirement.target;
      const chunk = target.kind === 'database'
        ? encoded.databaseChunks[target.index]
        : encoded.objectChunks.find((candidate) => candidate.objectId === target.objectId
          && candidate.index === target.index);
      return chunk ? transform(chunk.envelope.slice(), requirement) : null;
    },
    async readIdentityChunk() {
      return encoded.identityChunk?.envelope.slice() ?? null;
    },
  };
}

async function runFixture(options: {
  mode?: 'valid' | 'invalid_integrity' | 'migration_conflict';
  recoveryKey?: string;
  sourceTransform?: (bytes: Uint8Array, requirement: RestoreChunkRequirement) => Uint8Array;
  priorData?: Uint8Array | null;
  afterRollbackWritten?: () => void;
  activeDatabase?: BrowserDatabaseAdapter | null;
} = {}) {
  const backup = await backupFixture(options.mode);
  const persistence = new IndexedDbWebRestorePersistence();
  const priorData = options.priorData === undefined ? new Uint8Array([8, 6, 7, 5]) : options.priorData;
  if (priorData) await idbPut(STORE_SQLITE, ACTIVE_KEY, priorData);
  const result = await runWebLocalRestore({
    plan: backup.plan,
    destinationId: 'browser-local',
    locatorJson: backup.encoded.locatorJson,
    manifestEnvelope: backup.encoded.manifest.envelope,
    recoveryKey: options.recoveryKey ?? VECTOR_RECOVERY_KEY,
    source: sourceFor(backup.encoded, options.sourceTransform),
    persistence,
    afterRollbackWritten: options.afterRollbackWritten,
    activeDatabase: options.activeDatabase,
    locateFile,
  });
  return { backup, persistence, priorData, result };
}

async function activeBytes(): Promise<Uint8Array | null> {
  const stored = await idbGet<unknown>(STORE_SQLITE, ACTIVE_KEY);
  if (stored instanceof Uint8Array) return new Uint8Array(stored);
  if (stored instanceof ArrayBuffer) return new Uint8Array(stored);
  return null;
}

describe('web restore staging failure matrix', () => {
  beforeEach(resetDurableLayer);

  it('rejects corrupt encrypted bytes before changing active IndexedDB state', async () => {
    const fixture = await runFixture({
      sourceTransform: (bytes, requirement) => {
        if (requirement.target.kind === 'database' && requirement.target.index === 0) {
          bytes[Math.floor(bytes.length / 2)] = (bytes[Math.floor(bytes.length / 2)] ?? 0) ^ 0xff;
        }
        return bytes;
      },
    });
    expect(fixture.result.state.failure?.code).toBe('corrupt_chunk');
    expect(await activeBytes()).toEqual(fixture.priorData);
  });

  it('rejects a wrong key before writing a staging chunk', async () => {
    const fixture = await runFixture({
      recoveryKey: encodeRecoveryKey(new Uint8Array(32).fill(0xc3)),
    });
    expect(fixture.result.state.failure?.code).toBe('wrong_key');
    expect(await activeBytes()).toEqual(fixture.priorData);
    const staged = await idbGet<unknown>(
      STORE_SQLITE,
      `restore-staging:${fixture.backup.plan.backupId}:chunk:database/000000.mkchunk`,
    );
    expect(staged).toBeUndefined();
  });

  it('rejects invalid SQLite bytes after verified staging', async () => {
    const fixture = await runFixture({ mode: 'invalid_integrity' });
    expect(fixture.result.state.failure?.code).toBe('integrity_check_failed');
    expect(await activeBytes()).toEqual(fixture.priorData);
  });

  it('rejects a staged database whose app migration rehearsal fails', async () => {
    const fixture = await runFixture({ mode: 'migration_conflict' });
    expect(fixture.result.state.failure?.code).toBe('migration_rehearsal_failed');
    expect(await activeBytes()).toEqual(fixture.priorData);
  });
});

describe('web restore atomic activation', () => {
  beforeEach(resetDurableLayer);

  it('aborts the whole IndexedDB transaction when activation crashes after rollback staging', async () => {
    let closed = false;
    const fixture = await runFixture({
      afterRollbackWritten: () => { throw new Error('injected browser activation crash'); },
      activeDatabase: {
        flush: async () => undefined,
        close: () => { closed = true; },
      } as BrowserDatabaseAdapter,
    });
    expect(fixture.result.state.stage).toBe('rolled_back');
    expect(fixture.result.activation).toMatchObject({
      activated: false,
      rollbackSucceeded: true,
      hadPriorData: true,
    });
    expect(await activeBytes()).toEqual(fixture.priorData);
    expect(closed).toBe(true);
    expect(fixture.result.activeDatabaseClosed).toBe(true);
    expect(await idbGet<unknown>(
      STORE_SQLITE,
      `restore-rollback:${fixture.backup.plan.backupId}:database`,
    )).toBeUndefined();
  });

  it('retains the prior database until explicit release', async () => {
    const fixture = await runFixture();
    const rollbackKey = `restore-rollback:${fixture.backup.plan.backupId}:database`;
    expect(fixture.result.state.stage).toBe('activated');
    expect(fixture.result.activation).toMatchObject({
      activated: true,
      rollbackRetained: true,
      hadPriorData: true,
    });
    expect(await idbGet<unknown>(STORE_SQLITE, rollbackKey)).toEqual(fixture.priorData);
    expect(await idbGet<unknown>(
      STORE_SQLITE,
      `restore-staging:${fixture.backup.plan.backupId}:chunk:database/000000.mkchunk`,
    )).toBeInstanceOf(Uint8Array);

    await releaseWebRestoreRollback(fixture.backup.plan.backupId, fixture.persistence);
    expect(await idbGet<unknown>(STORE_SQLITE, rollbackKey)).toBeUndefined();
  });

  it('activates a fresh install with an honestly empty rollback', async () => {
    const fixture = await runFixture({ priorData: null });
    expect(fixture.result.state.stage).toBe('activated');
    expect(fixture.result.activation).toMatchObject({
      activated: true,
      rollbackRetained: false,
      hadPriorData: false,
    });
    expect(await activeBytes()).toBeInstanceOf(Uint8Array);
    expect(await idbGet<unknown>(
      STORE_SQLITE,
      `restore-rollback:${fixture.backup.plan.backupId}:database`,
    )).toBeUndefined();
  });

  it('atomically activates selected blob bytes and installs the verified recovery identity', async () => {
    const objectBytes = new TextEncoder().encode('restored browser attachment');
    const objectId = blobContentHash(objectBytes);
    const database = await createBrowserDatabaseAdapter({ locateFile, persistDebounceMs: 0 });
    ensureSyncSchema(database);
    insertBlob(database, {
      hash: objectId,
      size: objectBytes.length,
      mimeType: 'application/octet-stream',
      moduleId: 'community',
      refCount: 1,
      storedAt: '2026-07-15T12:00:00.000Z',
    });
    const databaseBytes = await database.export();
    await database.close();
    const encoded = encodeBackup({
      ...VECTOR_BACKUP_INPUT,
      backupId: 'web-complete-activation',
      databaseChunks: [databaseBytes],
      objects: [{ objectId, dataClass: 'attachment', chunks: [objectBytes] }],
    });
    databaseBytes.fill(0);
    const opened = openBackupManifest(encoded.locatorJson, encoded.manifest.envelope, VECTOR_RECOVERY_KEY);
    if (!opened.ok) throw opened.error;
    const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
    opened.backupRootKey.fill(0);

    const result = await runWebLocalRestore({
      plan,
      destinationId: 'browser-local',
      locatorJson: encoded.locatorJson,
      manifestEnvelope: encoded.manifest.envelope,
      recoveryKey: VECTOR_RECOVERY_KEY,
      source: sourceFor(encoded),
      persistence: new IndexedDbWebRestorePersistence(),
      locateFile,
    });

    expect(result.state.stage).toBe('activated');
    const stored = await idbGet<Blob | Uint8Array>(STORE_BLOB_BYTES, objectId);
    const restoredBytes = stored instanceof Blob
      ? new Uint8Array(await stored.arrayBuffer())
      : stored;
    expect(restoredBytes).toEqual(objectBytes);
    const recoveryBytes = parseRecoveryKey(VECTOR_RECOVERY_KEY)!;
    const recovered = openRecovery(VECTOR_BACKUP_INPUT.sealedRecoveryBundle!, recoveryBytes)!;
    recoveryBytes.fill(0);
    expect(getDeviceIdentitySecrets(createDeviceIdentitySecretRef(recovered.publicKey))).not.toBeNull();
  });
});
