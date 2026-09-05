import type { DatabaseAdapter } from '@mylife/db';
import {
  clearStorageRows,
  ensureStorageTables,
  getStorageDestination,
  listStorageDestinations,
  listStorageBackups,
  listStorageJobs,
  listStorageObjects,
  listStoragePolicies,
  updateStorageDestinationCredential,
  updateStorageDestinationState,
  upsertStorageHealth,
  type StorageDestinationRow,
  type StorageRowCounts,
} from './schema';
import { sha512Hex } from '../node/hkdf';
import { remoteBackupManifestObjectId, remoteBackupPrefix } from './remote-backups';
import { parseStorageScheduleConfig } from './storage-scheduler';
import type { RouterEncryptedStorageObject, StorageDestinationRouter } from './router';
import type { StorageJob } from './job-reducer';
import type {
  StorageAuthorizationInput,
  StorageDestinationAdapter,
  StorageResumeToken,
} from './types';

export interface RotateStorageCredentialInput {
  db: DatabaseAdapter;
  destinationId: string;
  newCredentialRef: string;
  newAccountHint?: string | null;
  authorizationKind: Extract<StorageAuthorizationInput['kind'], 'stored_credential' | 'broker_vault'>;
  invalidateAdapter(destinationId: string): void;
  resolveAdapter(destination: StorageDestinationRow): StorageDestinationAdapter | null;
  resumeJob(jobId: string): void | Promise<void>;
  deleteCredential?(credentialRef: string): Promise<void>;
  now(): string;
  probeNonce?: string;
}

export interface StorageCredentialRotationReport {
  destinationId: string;
  complete: boolean;
  credentialSwapped: boolean;
  healthState: 'ok' | 'degraded' | 'unreachable' | 'auth_required' | 'revoked' | null;
  resumedJobIds: string[];
  jobsStillPaused: string[];
  oldCredentialDeleted: boolean;
  errorCode: string | null;
}

export async function rotateStorageCredential(
  input: RotateStorageCredentialInput,
): Promise<StorageCredentialRotationReport> {
  const original = getStorageDestination(input.db, input.destinationId);
  if (original === null) throw new Error('storage destination was not found');
  const now = input.now();
  input.db.transaction(() => {
    updateStorageDestinationCredential(
      input.db,
      original.id,
      input.newCredentialRef,
      input.newAccountHint ?? original.account_hint,
      'authorizing',
      now,
    );
  });
  input.invalidateAdapter(original.id);
  const swapped = getStorageDestination(input.db, original.id);
  if (swapped === null) throw new Error('storage destination disappeared during credential rotation');

  let healthState: StorageCredentialRotationReport['healthState'] = null;
  try {
    const adapter = input.resolveAdapter(swapped);
    if (adapter === null) throw new Error('destination adapter is unavailable');
    const authorization = await adapter.authorize({
      kind: input.authorizationKind,
      credentialRef: input.newCredentialRef,
      ...(input.newAccountHint === undefined || input.newAccountHint === null
        ? {} : { accountHint: input.newAccountHint }),
    });
    if (authorization.kind !== 'authorized') throw new Error(authorization.kind);
    await verifyStorageReadWrite(adapter, input.probeNonce ?? `${Date.now()}`);
    const health = await adapter.health();
    healthState = health.state;
    if (health.state !== 'ok' && health.state !== 'degraded') throw new Error(health.state);
    const quota = await adapter.quota();
    upsertStorageHealth(input.db, {
      destination_id: original.id,
      state: health.state,
      used_bytes: quota.usedBytes,
      cap_bytes: quota.capBytes,
      verified_read_write: health.verifiedReadWrite ? 1 : 0,
      checked_at: health.checkedAt,
      error_code: health.errorCode ?? null,
    });
    updateStorageDestinationCredential(
      input.db,
      original.id,
      input.newCredentialRef,
      authorization.accountHint ?? input.newAccountHint ?? original.account_hint,
      health.state === 'ok' ? 'ready' : 'degraded',
      input.now(),
    );
  } catch (error) {
    input.db.transaction(() => {
      updateStorageDestinationCredential(
        input.db,
        original.id,
        original.credential_ref,
        original.account_hint,
        original.state,
        input.now(),
      );
    });
    input.invalidateAdapter(original.id);
    return {
      destinationId: original.id,
      complete: false,
      credentialSwapped: false,
      healthState,
      resumedJobIds: [],
      jobsStillPaused: listPausedJobIds(input.db, original.id),
      oldCredentialDeleted: false,
      errorCode: error instanceof Error ? error.message : 'credential_rotation_failed',
    };
  }

  const resumedJobIds: string[] = [];
  const jobsStillPaused: string[] = [];
  for (const jobId of listPausedJobIds(input.db, original.id)) {
    try {
      await input.resumeJob(jobId);
      resumedJobIds.push(jobId);
    } catch {
      jobsStillPaused.push(jobId);
    }
  }
  let oldCredentialDeleted = original.credential_ref === null
    || original.credential_ref === input.newCredentialRef;
  if (!oldCredentialDeleted && input.deleteCredential !== undefined && original.credential_ref !== null) {
    try {
      await input.deleteCredential(original.credential_ref);
      oldCredentialDeleted = true;
    } catch {
      oldCredentialDeleted = false;
    }
  }
  return {
    destinationId: original.id,
    complete: jobsStillPaused.length === 0 && oldCredentialDeleted,
    credentialSwapped: true,
    healthState,
    resumedJobIds,
    jobsStillPaused,
    oldCredentialDeleted,
    errorCode: jobsStillPaused.length > 0
      ? 'jobs_still_paused'
      : oldCredentialDeleted ? null : 'old_credential_delete_failed',
  };
}

export async function verifyStorageReadWrite(
  adapter: StorageDestinationAdapter,
  nonce: string,
): Promise<void> {
  const safeNonce = nonce.replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 80);
  if (safeNonce.length === 0) throw new Error('storage probe nonce is invalid');
  const objectId = `mylife-storage-probe-${safeNonce}`;
  const bytes = new TextEncoder().encode(`meerkat-storage-probe:${safeNonce}`);
  const ciphertextHash = sha512Hex(bytes);
  let remoteRef: string | undefined;
  try {
    let resume: StorageResumeToken | undefined;
    for (let step = 0; step < 1_000; step += 1) {
      const result = await adapter.putObject({
        objectId,
        dataClass: 'backup_metadata',
        ciphertext: bytes,
        ciphertextHash,
        encryptedBytes: bytes.length,
      }, resume);
      remoteRef = result.remoteRef;
      if (result.complete) break;
      resume = result.resumeToken;
      if (step === 999) throw new Error('storage probe upload exceeded its bound');
    }
    const readBack = await adapter.getObject({ objectId, ...(remoteRef ? { remoteRef } : {}) });
    if (readBack === null || sha512Hex(readBack) !== ciphertextHash) {
      throw new Error('storage destination failed its read-back probe');
    }
    await adapter.deleteObject({ objectId, ...(remoteRef ? { remoteRef } : {}) });
    if (await adapter.headObject({ objectId, ...(remoteRef ? { remoteRef } : {}) }) !== null) {
      throw new Error('storage destination failed to delete its probe object');
    }
  } finally {
    bytes.fill(0);
  }
}

export function brokerVaultCredentialRef(vaultId: string): string {
  if (!/^[A-Za-z0-9._:-]{1,200}$/u.test(vaultId)) throw new Error('broker vault id is invalid');
  return `broker://oauth/${vaultId}`;
}

export function parseBrokerVaultCredentialRef(credentialRef: string | null): string | null {
  if (credentialRef === null) return null;
  const match = /^broker:\/\/oauth\/([A-Za-z0-9._:-]{1,200})$/u.exec(credentialRef);
  return match?.[1] ?? null;
}

export interface DeleteStorageAccountDataInput {
  db: DatabaseAdapter;
  deleteRemoteData: boolean;
  resolveAdapter(destination: StorageDestinationRow): StorageDestinationAdapter | null;
  deleteBrokerVault?(vaultId: string): Promise<void>;
  deleteHostedAccount?(): Promise<void>;
  deleteCredential?(credentialRef: string): Promise<void>;
  now(): string;
}

export interface StorageAccountDeletionFailure {
  destinationId: string | null;
  step: 'adapter_revoke' | 'broker_vault_delete' | 'hosted_account_delete' | 'credential_delete';
}

export interface StorageAccountDeletionReport {
  complete: boolean;
  deleteRemoteData: boolean;
  destinationsFound: number;
  destinationsRevoked: number;
  brokerVaultsDeleted: number;
  hostedAccountsDeleted: number;
  credentialsDeleted: number;
  clearedRows: StorageRowCounts;
  failures: StorageAccountDeletionFailure[];
}

export async function deleteStorageAccountData(
  input: DeleteStorageAccountDataInput,
): Promise<StorageAccountDeletionReport> {
  ensureStorageTables(input.db);
  const destinations = listStorageDestinations(input.db);
  const failures: StorageAccountDeletionFailure[] = [];
  let destinationsRevoked = 0;
  let brokerVaultsDeleted = 0;
  let hostedAccountsDeleted = 0;
  let credentialsDeleted = 0;
  const deletedCredentialRefs = new Set<string>();

  for (const destination of destinations) {
    const wasAlreadyRevoked = destination.state === 'revoked';
    if (destination.kind !== 'hosted_storage') {
      if (!wasAlreadyRevoked) {
        const adapter = input.resolveAdapter(destination);
        if (adapter === null) {
          failures.push({ destinationId: destination.id, step: 'adapter_revoke' });
          continue;
        }
        try {
          if (input.deleteRemoteData) {
            const authorization = await adapter.authorize(destinationAuthorization(destination));
            if (authorization.kind !== 'authorized') throw new Error(authorization.kind);
          }
          await adapter.revoke({ deleteRemoteData: input.deleteRemoteData });
          updateStorageDestinationState(input.db, destination.id, 'revoked', input.now());
        } catch {
          failures.push({ destinationId: destination.id, step: 'adapter_revoke' });
          continue;
        }
      }
      destinationsRevoked += 1;
    }

    const vaultId = parseBrokerVaultCredentialRef(destination.credential_ref);
    if (vaultId !== null) {
      if (!wasAlreadyRevoked) {
        // Broker-backed adapters revoke their vault through AccessTokenProvider.revoke.
        brokerVaultsDeleted += 1;
      } else if (input.deleteBrokerVault === undefined) {
        failures.push({ destinationId: destination.id, step: 'broker_vault_delete' });
      } else {
        try {
          await input.deleteBrokerVault(vaultId);
          brokerVaultsDeleted += 1;
        } catch {
          failures.push({ destinationId: destination.id, step: 'broker_vault_delete' });
        }
      }
    } else if (destination.credential_ref?.startsWith('securestore://') === true
      || destination.credential_ref?.startsWith('broker://storage/') === true) {
      if (deletedCredentialRefs.has(destination.credential_ref)) {
        // Shared credential custody was already removed by an earlier destination.
      } else if (input.deleteCredential === undefined) {
        failures.push({ destinationId: destination.id, step: 'credential_delete' });
      } else {
        try {
          await input.deleteCredential(destination.credential_ref);
          credentialsDeleted += 1;
          deletedCredentialRefs.add(destination.credential_ref);
        } catch {
          failures.push({ destinationId: destination.id, step: 'credential_delete' });
        }
      }
    }
  }

  for (const policy of listStoragePolicies(input.db)) {
    const schedule = parseStorageScheduleConfig(policy.retention_json);
    if (schedule === null) {
      failures.push({ destinationId: null, step: 'credential_delete' });
      continue;
    }
    const ref = schedule.recoveryKeyRef;
    if (ref === null || deletedCredentialRefs.has(ref)) continue;
    if (!ref.startsWith('securestore://') || input.deleteCredential === undefined) {
      failures.push({ destinationId: null, step: 'credential_delete' });
      continue;
    }
    try {
      await input.deleteCredential(ref);
      deletedCredentialRefs.add(ref);
      credentialsDeleted += 1;
    } catch {
      failures.push({ destinationId: null, step: 'credential_delete' });
    }
  }

  if (destinations.some((destination) => destination.kind === 'hosted_storage')) {
    if (input.deleteHostedAccount === undefined) {
      failures.push({ destinationId: null, step: 'hosted_account_delete' });
    } else {
      try {
        await input.deleteHostedAccount();
        hostedAccountsDeleted = 1;
        for (const destination of destinations.filter((item) => item.kind === 'hosted_storage')) {
          updateStorageDestinationState(input.db, destination.id, 'revoked', input.now());
          destinationsRevoked += 1;
        }
      } catch {
        failures.push({ destinationId: null, step: 'hosted_account_delete' });
      }
    }
  }

  const clearedRows = failures.length === 0 ? clearStorageRows(input.db) : zeroCounts();
  return {
    complete: failures.length === 0,
    deleteRemoteData: input.deleteRemoteData,
    destinationsFound: destinations.length,
    destinationsRevoked,
    brokerVaultsDeleted,
    hostedAccountsDeleted,
    credentialsDeleted,
    clearedRows,
    failures,
  };
}

function destinationAuthorization(destination: StorageDestinationRow): StorageAuthorizationInput {
  const credentialRef = destination.credential_ref ?? undefined;
  if (credentialRef === undefined) return { kind: 'interactive' };
  if (parseBrokerVaultCredentialRef(destination.credential_ref) !== null) {
    return { kind: 'broker_vault', credentialRef };
  }
  return { kind: 'stored_credential', credentialRef };
}

function listPausedJobIds(db: DatabaseAdapter, destinationId: string): string[] {
  return listStorageJobs(db, destinationId)
    .filter((job) => job.state === 'paused')
    .map((job) => job.id);
}

function zeroCounts(): StorageRowCounts {
  return {
    destinations: 0,
    policies: 0,
    objects: 0,
    jobs: 0,
    health: 0,
    backups: 0,
    total: 0,
  };
}

export interface MoveExistingBackupOutcome {
  backupId: string;
  status: 'moved' | 'failed' | 'skipped';
  job: StorageJob | null;
  reason: string | null;
}

export interface MoveExistingBackupsReport {
  sourceDestinationId: string;
  targetDestinationId: string;
  moved: number;
  failed: number;
  skipped: number;
  complete: boolean;
  outcomes: MoveExistingBackupOutcome[];
}

export interface MoveExistingBackupsInput {
  db: DatabaseAdapter;
  router: StorageDestinationRouter;
  sourceDestinationId: string;
  targetDestinationId: string;
  resolveAdapter(destination: StorageDestinationRow): StorageDestinationAdapter | null;
  onProgress?(progress: MoveExistingBackupsProgress): void;
}

export interface MoveExistingBackupsProgress {
  completed: number;
  total: number;
  moved: number;
  failed: number;
  skipped: number;
  currentBackupId: string;
}

/** Uses the router's verify-target-then-delete-source move state machine. */
export async function moveExistingBackups(
  input: MoveExistingBackupsInput,
): Promise<MoveExistingBackupsReport> {
  const source = getStorageDestination(input.db, input.sourceDestinationId);
  if (source === null) throw new Error('move source destination was not found');
  const adapter = input.resolveAdapter(source);
  if (adapter === null) throw new Error('move source adapter is unavailable');
  const target = getStorageDestination(input.db, input.targetDestinationId);
  if (target === null) throw new Error('move target destination was not found');
  const targetAdapter = input.resolveAdapter(target);
  if (targetAdapter === null) throw new Error('move target adapter is unavailable');
  const [sourceAuthorization, targetAuthorization] = await Promise.all([
    adapter.authorize(destinationAuthorization(source)),
    targetAdapter.authorize(destinationAuthorization(target)),
  ]);
  if (sourceAuthorization.kind !== 'authorized') throw new Error('move source needs authorization');
  if (targetAuthorization.kind !== 'authorized') throw new Error('move target needs authorization');
  const outcomes: MoveExistingBackupOutcome[] = [];
  const backups = listStorageBackups(input.db, source.id).filter((backup) => backup.state === 'complete');
  const sourceRows = listStorageObjects(input.db, source.id);

  for (const backup of backups) {
    const prefix = remoteBackupPrefix(backup.backup_id);
    const rows = sourceRows.filter((row) => row.object_id.startsWith(prefix) && row.state === 'verified');
    const manifestId = remoteBackupManifestObjectId(backup.backup_id);
    const manifestRow = rows.find((row) => row.object_id === manifestId);
    if (manifestRow === undefined || rows.length !== backup.object_count + 1) {
      outcomes.push({
        backupId: backup.backup_id,
        status: 'skipped',
        job: null,
        reason: 'verified_object_mapping_incomplete',
      });
      emitMoveProgress(input, outcomes, backup.backup_id, backups.length);
      continue;
    }
    const loaded: RouterEncryptedStorageObject[] = [];
    try {
      for (const row of rows) {
        const bytes = await adapter.getObject({
          objectId: row.object_id,
          ...(row.remote_ref === null ? {} : { remoteRef: row.remote_ref }),
        });
        if (bytes === null || bytes.length !== row.encrypted_bytes
          || sha512Hex(bytes) !== row.ciphertext_hash) {
          throw new Error(`source_object_unverified:${row.object_id}`);
        }
        loaded.push({
          objectId: row.object_id,
          dataClass: row.data_class,
          ciphertext: bytes,
          ciphertextHash: row.ciphertext_hash,
          encryptedBytes: row.encrypted_bytes,
        });
      }
      const manifest = loaded.find((object) => object.objectId === manifestId);
      if (manifest === undefined) throw new Error('source_manifest_unavailable');
      const planned = input.router.planMoveJob({
        sourceDestinationId: source.id,
        destinationId: input.targetDestinationId,
        backupId: backup.backup_id,
        schemaVersion: backup.schema_version,
        objects: loaded.filter((object) => object.objectId !== manifestId),
        manifest,
      });
      const job = await input.router.runJob(planned.id);
      outcomes.push({
        backupId: backup.backup_id,
        status: job.state === 'succeeded' ? 'moved' : 'failed',
        job,
        reason: job.state === 'succeeded' ? null : job.last_error_code ?? job.state,
      });
      emitMoveProgress(input, outcomes, backup.backup_id, backups.length);
    } catch (error) {
      outcomes.push({
        backupId: backup.backup_id,
        status: 'failed',
        job: null,
        reason: error instanceof Error ? error.message : 'move_failed',
      });
      emitMoveProgress(input, outcomes, backup.backup_id, backups.length);
    } finally {
      for (const object of loaded) object.ciphertext.fill(0);
    }
  }
  const moved = outcomes.filter((outcome) => outcome.status === 'moved').length;
  const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
  const skipped = outcomes.filter((outcome) => outcome.status === 'skipped').length;
  return {
    sourceDestinationId: source.id,
    targetDestinationId: input.targetDestinationId,
    moved,
    failed,
    skipped,
    complete: failed === 0 && skipped === 0,
    outcomes,
  };
}

function emitMoveProgress(
  input: MoveExistingBackupsInput,
  outcomes: readonly MoveExistingBackupOutcome[],
  currentBackupId: string,
  total: number,
): void {
  input.onProgress?.({
    completed: outcomes.length,
    total,
    moved: outcomes.filter((outcome) => outcome.status === 'moved').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
    skipped: outcomes.filter((outcome) => outcome.status === 'skipped').length,
    currentBackupId,
  });
}

export interface ChangePrimaryDestinationInput extends MoveExistingBackupsInput {
  moveExisting: boolean;
}

export interface ChangePrimaryDestinationReport {
  policiesUpdated: number;
  move: MoveExistingBackupsReport | null;
}

export async function changePrimaryDestination(
  input: ChangePrimaryDestinationInput,
): Promise<ChangePrimaryDestinationReport> {
  const target = getStorageDestination(input.db, input.targetDestinationId);
  if (target === null || (target.state !== 'ready' && target.state !== 'degraded')) {
    throw new Error('new primary destination is not ready');
  }
  const current = listStoragePolicies(input.db)
    .filter((policy) => policy.primary_destination_id === input.sourceDestinationId);
  if (current.length === 0) {
    input.router.setPolicy({
      dataClass: 'sqlite_snapshot',
      primaryDestinationId: target.id,
      localCacheBytes: 0,
      retention: { keepLast: 7, maxAgeDays: 30, schedule: { enabled: false, intervalHours: 24 } },
    });
  } else {
    for (const policy of current) {
      input.router.setPolicy({ ...policy, primary_destination_id: target.id });
    }
  }
  return {
    policiesUpdated: Math.max(1, current.length),
    move: input.moveExisting ? await moveExistingBackups(input) : null,
  };
}
