import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  blobContentHash,
  createDeviceIdentitySecretRef,
  createRestorePlan,
  encodeBackup,
  encodeRecoveryKey,
  getDeviceIdentitySecrets,
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
import {
  recoverInterruptedMobileRestore,
  releaseMobileRestoreRollback,
  runMobileLocalRestore,
  type MobileDatabaseActivationHandle,
  type MobileRestoreDatabaseRuntime,
  type MobileRestoreFileSystem,
} from '../local-restore';
import {
  recoverInterruptedMobileRestoreBeforeOpen,
  type SynchronousRestoreDirectory,
  type SynchronousRestoreFile,
  type SynchronousRestoreFileSystem,
} from '../local-restore-boot';
import type { RestoreEncryptedSource, RestoreCheckResult } from '../storage-destinations/restore-orchestrator-core';
import { sha256Hex } from '@mylife/sync/src/encryption/sha256';

const DOCUMENTS = 'file:///documents/';
const ACTIVE = `${DOCUMENTS}SQLite/meerkat.db`;

function journalEnvelope(journal: Record<string, unknown>): Uint8Array {
  const journalBytes = new TextEncoder().encode(JSON.stringify(journal));
  return new TextEncoder().encode(JSON.stringify({
    version: 1,
    checksumSha256: sha256Hex(journalBytes),
    journal,
  }));
}

class MemoryRestoreFileSystem implements MobileRestoreFileSystem {
  readonly documentDirectory = DOCUMENTS;
  readonly files = new Map<string, Uint8Array>();
  readonly directories = new Set<string>();
  readonly calls: string[] = [];

  async ensureDirectory(uri: string): Promise<void> {
    this.calls.push(`mkdir:${uri}`);
    this.directories.add(uri);
  }

  async exists(uri: string): Promise<boolean> {
    return this.files.has(uri) || this.directories.has(uri);
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    this.calls.push(`read:${uri}`);
    const bytes = this.files.get(uri);
    if (!bytes) throw new Error(`Missing file: ${uri}`);
    return new Uint8Array(bytes);
  }

  async writeBytes(uri: string, bytes: Uint8Array): Promise<void> {
    this.calls.push(`write:${uri}`);
    this.files.set(uri, new Uint8Array(bytes));
  }

  async delete(uri: string): Promise<void> {
    this.calls.push(`delete:${uri}`);
    this.files.delete(uri);
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(uri)) this.files.delete(key);
    }
    for (const key of [...this.directories]) {
      if (key === uri || key.startsWith(uri)) this.directories.delete(key);
    }
  }

  async move(from: string, to: string): Promise<void> {
    this.calls.push(`move:${from}->${to}`);
    const bytes = this.files.get(from);
    if (!bytes) throw new Error(`Cannot move missing file: ${from}`);
    this.files.set(to, bytes);
    this.files.delete(from);
  }

  async concatenate(output: string, inputs: readonly string[]): Promise<void> {
    this.calls.push(`concat:${output}`);
    const parts = inputs.map((input) => {
      const bytes = this.files.get(input);
      if (!bytes) throw new Error(`Cannot concatenate missing file: ${input}`);
      return bytes;
    });
    const length = parts.reduce((total, bytes) => total + bytes.length, 0);
    const joined = new Uint8Array(length);
    let offset = 0;
    for (const bytes of parts) {
      joined.set(bytes, offset);
      offset += bytes.length;
    }
    this.files.set(output, joined);
  }
}

class FakeRestoreRuntime implements MobileRestoreDatabaseRuntime {
  integrity: RestoreCheckResult = { passed: true, report: 'ok' };
  rehearsal: RestoreCheckResult = { passed: true, report: 'migrations pass' };
  boot: RestoreCheckResult = { passed: true, report: 'boot pass' };
  readonly calls: string[] = [];
  readonly blobs = new Map<string, { size: number }>();

  async withMaintenance<T>(
    operation: (handle: MobileDatabaseActivationHandle) => Promise<T>,
  ): Promise<T> {
    this.calls.push('maintenance:start');
    const adapter: DatabaseAdapter = {
      execute(): void {},
      query: <Row>(sql: string, params?: unknown[]) => {
        if (sql.includes('FROM sync_blobs WHERE hash')) {
          const hash = String(params?.[0] ?? '');
          const blob = this.blobs.get(hash);
          return (blob ? [{
            hash,
            size: blob.size,
            mime_type: 'application/octet-stream',
            module_id: 'community',
            ref_count: 1,
            stored_at: '2026-07-15T12:00:00.000Z',
          }] : []) as Row[];
        }
        return [] as Row[];
      },
      transaction(operation): void { operation(); },
    };
    const result = await operation({
      closeActiveDatabase: () => { this.calls.push('database:close'); },
      reopenActiveDatabase: () => {
        this.calls.push('database:reopen');
        return adapter;
      },
    });
    this.calls.push('maintenance:end');
    return result;
  }

  async checkIntegrity(databaseUri: string): Promise<RestoreCheckResult> {
    this.calls.push(`integrity:${databaseUri}`);
    return this.integrity;
  }

  async rehearseMigrations(databaseUri: string): Promise<RestoreCheckResult> {
    this.calls.push(`rehearsal:${databaseUri}`);
    return this.rehearsal;
  }

  async bootVerify(databaseUri: string): Promise<RestoreCheckResult> {
    this.calls.push(`boot:${databaseUri}`);
    return this.boot;
  }
}

interface BackupFixture {
  encoded: EncodedBackup;
  plan: RestorePlan;
}

function backupFixture(): BackupFixture {
  const encoded = encodeBackup(VECTOR_BACKUP_INPUT);
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
  recoveryKey?: string;
  source?: RestoreEncryptedSource;
  integrity?: RestoreCheckResult;
  rehearsal?: RestoreCheckResult;
  boot?: RestoreCheckResult;
  priorData?: Uint8Array | null;
  afterActiveMoved?: () => void | Promise<void>;
} = {}) {
  const backup = backupFixture();
  const fileSystem = new MemoryRestoreFileSystem();
  const priorData = options.priorData === undefined ? new Uint8Array([9, 9, 9]) : options.priorData;
  if (priorData) fileSystem.files.set(ACTIVE, new Uint8Array(priorData));
  const runtime = new FakeRestoreRuntime();
  if (options.integrity) runtime.integrity = options.integrity;
  if (options.rehearsal) runtime.rehearsal = options.rehearsal;
  if (options.boot) runtime.boot = options.boot;
  const result = await runMobileLocalRestore({
    plan: backup.plan,
    destinationId: 'local-device',
    locatorJson: backup.encoded.locatorJson,
    manifestEnvelope: backup.encoded.manifest.envelope,
    recoveryKey: options.recoveryKey ?? VECTOR_RECOVERY_KEY,
    source: options.source ?? sourceFor(backup.encoded),
    fileSystem,
    runtime,
    afterActiveMoved: options.afterActiveMoved,
  });
  return { backup, fileSystem, runtime, result, priorData };
}

function expectActiveUntouched(
  fileSystem: MemoryRestoreFileSystem,
  priorData: Uint8Array | null,
): void {
  expect(fileSystem.files.get(ACTIVE)).toEqual(priorData ?? undefined);
  expect(fileSystem.calls.some((call) => call.startsWith(`move:${ACTIVE}->`))).toBe(false);
}

function synchronousFileSystem(
  files: Map<string, Uint8Array>,
): SynchronousRestoreFileSystem {
  class FakeFile implements SynchronousRestoreFile {
    constructor(readonly uri: string) {}
    get exists(): boolean { return files.has(this.uri); }
    textSync(): string {
      const bytes = files.get(this.uri);
      if (!bytes) throw new Error('missing');
      return new TextDecoder().decode(bytes);
    }
    delete(): void { files.delete(this.uri); }
    move(destination: SynchronousRestoreFile): void {
      const bytes = files.get(this.uri);
      if (!bytes) throw new Error('missing');
      files.set(destination.uri, bytes);
      files.delete(this.uri);
    }
  }
  class FakeDirectory implements SynchronousRestoreDirectory {
    constructor(readonly uri: string) {}
    get exists(): boolean { return [...files.keys()].some((key) => key.startsWith(this.uri)); }
    delete(): void {
      for (const key of [...files.keys()]) if (key.startsWith(this.uri)) files.delete(key);
    }
  }
  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { document: new FakeDirectory(DOCUMENTS) },
  };
}

describe('mobile restore staging failure matrix', () => {
  it('rejects a corrupt encrypted chunk before the active database changes', async () => {
    const backup = backupFixture();
    const source = sourceFor(backup.encoded, (bytes, requirement) => {
      if (requirement.target.kind === 'database' && requirement.target.index === 0) {
        bytes[Math.floor(bytes.length / 2)] = (bytes[Math.floor(bytes.length / 2)] ?? 0) ^ 0xff;
      }
      return bytes;
    });
    const fixture = await runFixture({ source });
    expect(fixture.result.state.failure?.code).toBe('corrupt_chunk');
    expect(fixture.result.activation).toBeNull();
    expectActiveUntouched(fixture.fileSystem, fixture.priorData);
  });

  it('rejects a wrong recovery key before staging chunks', async () => {
    const fixture = await runFixture({
      recoveryKey: encodeRecoveryKey(new Uint8Array(32).fill(0xa5)),
    });
    expect(fixture.result.state.failure?.code).toBe('wrong_key');
    expect(fixture.fileSystem.calls.some((call) => call.includes('.plain'))).toBe(false);
    expectActiveUntouched(fixture.fileSystem, fixture.priorData);
  });

  it('leaves active state untouched when integrity_check fails', async () => {
    const fixture = await runFixture({
      integrity: { passed: false, report: 'page 7 malformed' },
    });
    expect(fixture.result.state.failure).toMatchObject({
      code: 'integrity_check_failed',
      report: 'page 7 malformed',
    });
    expectActiveUntouched(fixture.fileSystem, fixture.priorData);
  });

  it('leaves active state untouched when migration rehearsal fails', async () => {
    const fixture = await runFixture({
      rehearsal: { passed: false, report: 'migration 12 rejected' },
    });
    expect(fixture.result.state.failure).toMatchObject({
      code: 'migration_rehearsal_failed',
      report: 'migration 12 rejected',
    });
    expectActiveUntouched(fixture.fileSystem, fixture.priorData);
  });
});

describe('mobile restore atomic activation', () => {
  it('rolls the prior database back after a crash between the two moves', async () => {
    const fixture = await runFixture({
      afterActiveMoved: () => { throw new Error('injected activation crash'); },
    });
    expect(fixture.result.state.stage).toBe('rolled_back');
    expect(fixture.result.activation).toMatchObject({
      activated: false,
      rollbackSucceeded: true,
      hadPriorData: true,
    });
    expect(fixture.fileSystem.files.get(ACTIVE)).toEqual(fixture.priorData);
    const activeMove = fixture.fileSystem.calls.findIndex((call) => call.startsWith(`move:${ACTIVE}->`));
    const rollbackMove = fixture.fileSystem.calls.findIndex((call) => call.endsWith(`->${ACTIVE}`));
    expect(activeMove).toBeGreaterThanOrEqual(0);
    expect(rollbackMove).toBeGreaterThan(activeMove);
  });

  it('recovers a durable active_moved journal on the next boot', async () => {
    const backupId = VECTOR_BACKUP_INPUT.backupId;
    const fileSystem = new MemoryRestoreFileSystem();
    const runtime = new FakeRestoreRuntime();
    const staged = `${DOCUMENTS}meerkat/restore-staging/${backupId}/restored.db`;
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${backupId}/`;
    const rollback = `${rollbackDirectory}meerkat.db`;
    const journal = `${DOCUMENTS}meerkat/restore-activation.json`;
    fileSystem.files.set(rollback, new Uint8Array([4, 2, 4, 2]));
    fileSystem.files.set(staged, new Uint8Array([1, 1, 1]));
    fileSystem.files.set(journal, new TextEncoder().encode(JSON.stringify({
      version: 1,
      backupId,
      phase: 'active_moved',
      hadPriorData: true,
      includesDatabase: true,
      objectHadPriorData: {},
      stagingDatabase: staged,
      activeDatabase: ACTIVE,
      rollbackDirectory,
    })));

    await expect(recoverInterruptedMobileRestore(fileSystem, runtime)).resolves.toBe(true);
    expect(fileSystem.files.get(ACTIVE)).toEqual(new Uint8Array([4, 2, 4, 2]));
    expect(fileSystem.files.has(journal)).toBe(false);
    expect(runtime.calls).toContain('database:close');
    expect(runtime.calls).toContain('database:reopen');
  });

  it('falls back to the last checksummed journal when the newest rotating slot is torn', async () => {
    const backupId = VECTOR_BACKUP_INPUT.backupId;
    const fileSystem = new MemoryRestoreFileSystem();
    const runtime = new FakeRestoreRuntime();
    const staged = `${DOCUMENTS}meerkat/restore-staging/${backupId}/restored.db`;
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${backupId}/`;
    fileSystem.files.set(`${rollbackDirectory}meerkat.db`, new Uint8Array([6, 2, 6]));
    fileSystem.files.set(`${DOCUMENTS}meerkat/restore-activation.json.0`, journalEnvelope({
      version: 2,
      generation: 2,
      backupId,
      phase: 'active_moved',
      hadPriorData: true,
      includesDatabase: true,
      objectHadPriorData: {},
      stagingDatabase: staged,
      activeDatabase: ACTIVE,
      rollbackDirectory,
    }));
    fileSystem.files.set(
      `${DOCUMENTS}meerkat/restore-activation.json.1`,
      new TextEncoder().encode('{"torn":'),
    );

    await expect(recoverInterruptedMobileRestore(fileSystem, runtime)).resolves.toBe(true);
    expect(fileSystem.files.get(ACTIVE)).toEqual(new Uint8Array([6, 2, 6]));
    expect(fileSystem.files.has(`${DOCUMENTS}meerkat/restore-activation.json.0`)).toBe(false);
    expect(fileSystem.files.has(`${DOCUMENTS}meerkat/restore-activation.json.1`)).toBe(false);
  });

  it('is idempotent when recovery previously moved the main rollback file but not its WAL', async () => {
    const backupId = VECTOR_BACKUP_INPUT.backupId;
    const fileSystem = new MemoryRestoreFileSystem();
    const runtime = new FakeRestoreRuntime();
    const staged = `${DOCUMENTS}meerkat/restore-staging/${backupId}/restored.db`;
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${backupId}/`;
    const journal = `${DOCUMENTS}meerkat/restore-activation.json`;
    const alreadyRestoredMain = new Uint8Array([9, 4, 9]);
    fileSystem.files.set(ACTIVE, alreadyRestoredMain);
    fileSystem.files.set(`${rollbackDirectory}meerkat.db-wal`, new Uint8Array([8, 8]));
    fileSystem.files.set(journal, new TextEncoder().encode(JSON.stringify({
      version: 1,
      backupId,
      phase: 'active_moved',
      hadPriorData: true,
      stagingDatabase: staged,
      activeDatabase: ACTIVE,
      rollbackDirectory,
    })));

    await expect(recoverInterruptedMobileRestore(fileSystem, runtime)).resolves.toBe(true);
    expect(fileSystem.files.get(ACTIVE)).toEqual(alreadyRestoredMain);
    expect(fileSystem.files.get(`${ACTIVE}-wal`)).toEqual(new Uint8Array([8, 8]));
  });

  it('pre-open recovery preserves WAL sidecars that had not moved yet', () => {
    const backupId = VECTOR_BACKUP_INPUT.backupId;
    const files = new Map<string, Uint8Array>();
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${backupId}/`;
    const staged = `${DOCUMENTS}meerkat/restore-staging/${backupId}/restored.db`;
    const journal = `${DOCUMENTS}meerkat/restore-activation.json`;
    files.set(`${rollbackDirectory}meerkat.db`, new Uint8Array([4, 1]));
    files.set(`${ACTIVE}-wal`, new Uint8Array([7, 7]));
    files.set(journal, new TextEncoder().encode(JSON.stringify({
      version: 1,
      backupId,
      phase: 'prepared',
      hadPriorData: true,
      stagingDatabase: staged,
      activeDatabase: ACTIVE,
      rollbackDirectory,
    })));

    expect(recoverInterruptedMobileRestoreBeforeOpen(synchronousFileSystem(files))).toBe(true);
    expect(files.get(ACTIVE)).toEqual(new Uint8Array([4, 1]));
    expect(files.get(`${ACTIVE}-wal`)).toEqual(new Uint8Array([7, 7]));
    expect(files.has(journal)).toBe(false);
  });

  it('pre-open recovery preserves an already restored main file while finishing sidecars', () => {
    const backupId = VECTOR_BACKUP_INPUT.backupId;
    const files = new Map<string, Uint8Array>();
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${backupId}/`;
    const staged = `${DOCUMENTS}meerkat/restore-staging/${backupId}/restored.db`;
    const journal = `${DOCUMENTS}meerkat/restore-activation.json`;
    files.set(ACTIVE, new Uint8Array([5, 5, 5]));
    files.set(`${rollbackDirectory}meerkat.db-wal`, new Uint8Array([2, 1]));
    files.set(journal, new TextEncoder().encode(JSON.stringify({
      version: 1,
      backupId,
      phase: 'active_moved',
      hadPriorData: true,
      stagingDatabase: staged,
      activeDatabase: ACTIVE,
      rollbackDirectory,
    })));

    expect(recoverInterruptedMobileRestoreBeforeOpen(synchronousFileSystem(files))).toBe(true);
    expect(files.get(ACTIVE)).toEqual(new Uint8Array([5, 5, 5]));
    expect(files.get(`${ACTIVE}-wal`)).toEqual(new Uint8Array([2, 1]));
  });

  it('retains a real rollback until the explicit release event', async () => {
    const fixture = await runFixture();
    const rollbackDirectory = `${DOCUMENTS}meerkat/restore-rollback/${fixture.backup.plan.backupId}/`;
    expect(fixture.result.state.stage).toBe('activated');
    expect(fixture.result.activation).toMatchObject({
      activated: true,
      rollbackRetained: true,
      hadPriorData: true,
    });
    expect(fixture.fileSystem.files.get(`${rollbackDirectory}meerkat.db`)).toEqual(fixture.priorData);
    expect(fixture.fileSystem.files.has(`${rollbackDirectory}retention.json`)).toBe(true);

    await releaseMobileRestoreRollback(fixture.fileSystem, fixture.backup.plan.backupId);
    expect([...fixture.fileSystem.files.keys()].some((key) => key.startsWith(rollbackDirectory))).toBe(false);
  });

  it('activates on a fresh install and reports an honestly empty rollback', async () => {
    const fixture = await runFixture({ priorData: null });
    expect(fixture.result.state.stage).toBe('activated');
    expect(fixture.result.activation).toMatchObject({
      activated: true,
      rollbackRetained: false,
      hadPriorData: false,
    });
    expect(fixture.fileSystem.files.has(ACTIVE)).toBe(true);
  });

  it('activates verified object bytes and installs the selected recovery identity', async () => {
    const objectBytes = new TextEncoder().encode('restored mobile attachment');
    const objectId = blobContentHash(objectBytes);
    const encoded = encodeBackup({
      ...VECTOR_BACKUP_INPUT,
      backupId: 'mobile-complete-activation',
      objects: [{ objectId, dataClass: 'attachment', chunks: [objectBytes] }],
    });
    const opened = openBackupManifest(encoded.locatorJson, encoded.manifest.envelope, VECTOR_RECOVERY_KEY);
    if (!opened.ok) throw opened.error;
    const plan = createRestorePlan(opened.manifest, { mode: 'complete' });
    opened.backupRootKey.fill(0);
    const fileSystem = new MemoryRestoreFileSystem();
    fileSystem.files.set(ACTIVE, new Uint8Array([7, 7]));
    const runtime = new FakeRestoreRuntime();
    runtime.blobs.set(objectId, { size: objectBytes.length });

    const result = await runMobileLocalRestore({
      plan,
      destinationId: 'local-device',
      locatorJson: encoded.locatorJson,
      manifestEnvelope: encoded.manifest.envelope,
      recoveryKey: VECTOR_RECOVERY_KEY,
      source: sourceFor(encoded),
      fileSystem,
      runtime,
    });

    expect(result.state.stage).toBe('activated');
    expect(fileSystem.files.get(`${DOCUMENTS}meerkat/blobs/${objectId}`)).toEqual(objectBytes);
    const recoveryBytes = parseRecoveryKey(VECTOR_RECOVERY_KEY)!;
    const recovered = openRecovery(VECTOR_BACKUP_INPUT.sealedRecoveryBundle!, recoveryBytes)!;
    recoveryBytes.fill(0);
    expect(getDeviceIdentitySecrets(createDeviceIdentitySecretRef(recovered.publicKey))).not.toBeNull();
  });
});
