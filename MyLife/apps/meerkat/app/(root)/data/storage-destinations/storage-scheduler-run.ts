import type { DatabaseAdapter } from '@mylife/db';
import {
  createStorageRouter,
  buildRetentionBackupCopies,
  decideStorageSchedule,
  deriveStorageScheduleLastRuns,
  ensureStorageTables,
  exportRecoverableIdentity,
  hexToBytes,
  listStorageBackups,
  listStorageDestinations,
  listStorageHealth,
  listStorageJobs,
  listStorageObjects,
  listStoragePolicies,
  parseStorageScheduleConfig,
  parseRecoveryKey,
  sealRecovery,
  planRepairJob as planMissingObjectRepair,
  planRetentionJob,
  runRepairJob,
  runRetentionJob,
  type DeviceIdentity,
  type StorageScheduleDecision,
  type StorageAuthorizationInput,
  type StorageDestinationRow,
} from '@mylife/sync';
import type { BackupSigningIdentity } from '@mylife/sync/src/storage/backup-format';
import { getIdentityRow } from '../db';
import type { ExpoBlobStore } from '../expo-blob-store';
import type { ConfiguredMobileStorageRegistry } from './configured-registry';
import type { ExpoStorageJobPayloadStore } from './storage-job-payload-store';
import type { runLocalDatabaseBackup } from './local-backup-run';

export interface ScheduledBackupOutcome {
  dataClass: string;
  destinationId: string;
  status: 'succeeded' | 'partial' | 'skipped' | 'failed';
  backupId: string | null;
  reason: string | null;
}

export interface StorageScheduleRunReport {
  ran: boolean;
  decisions: StorageScheduleDecision[];
  backups: ScheduledBackupOutcome[];
  retentionDeleted: number;
  repairedObjects: number;
  reason: string | null;
}

type MobileRegistry = ConfiguredMobileStorageRegistry;

export interface MobileStorageScheduleRuntime {
  db: DatabaseAdapter;
  nowIso(): string;
  randomUUID(): string;
  readSecret(ref: string): Promise<string | null>;
  createRegistry(input: { db: DatabaseAdapter; identity: DeviceIdentity | null }): MobileRegistry;
  createPayloadStore(): ExpoStorageJobPayloadStore;
  createBlobStore(db: DatabaseAdapter): ExpoBlobStore;
  createRouter: typeof createStorageRouter;
  runBackup: typeof runLocalDatabaseBackup;
  runRetention: typeof runRetentionJob;
  runRepair: typeof runRepairJob;
}

let activeRun: Promise<StorageScheduleRunReport> | null = null;

export function readStorageScheduleDecisions(
  db: DatabaseAdapter,
  now = new Date().toISOString(),
): StorageScheduleDecision[] {
  ensureStorageTables(db);
  const backups = listStorageBackups(db);
  const objects = listStorageObjects(db);
  return decideStorageSchedule({
    policies: listStoragePolicies(db),
    destinations: listStorageDestinations(db),
    health: listStorageHealth(db),
    jobs: listStorageJobs(db),
    lastRuns: deriveStorageScheduleLastRuns(backups, objects),
    now,
  });
}

export function runBackgroundStorageOnce(
  injectedRuntime?: MobileStorageScheduleRuntime,
): Promise<StorageScheduleRunReport> {
  if (activeRun !== null) return activeRun;
  activeRun = resolveRuntime(injectedRuntime)
    .then((runtime) => executeBackgroundStorage(runtime))
    .finally(() => { activeRun = null; });
  return activeRun;
}

async function resolveRuntime(
  injectedRuntime?: MobileStorageScheduleRuntime,
): Promise<MobileStorageScheduleRuntime> {
  if (injectedRuntime) return injectedRuntime;
  const [
    { getMeerkatDatabase },
    crypto,
    { readMobileStorageSecret },
    { runLocalDatabaseBackup },
    { ExpoStorageJobPayloadStore },
    { ExpoBlobStore },
    { createConfiguredMobileStorageRegistry },
  ] = await Promise.all([
    import('../meerkat-db'),
    import('expo-crypto'),
    import('./credential-store'),
    import('./local-backup-run'),
    import('./storage-job-payload-store'),
    import('../expo-blob-store'),
    import('./configured-registry'),
  ]);
  return {
    db: getMeerkatDatabase(),
    nowIso: () => new Date().toISOString(),
    randomUUID: () => crypto.randomUUID(),
    readSecret: (ref) => readMobileStorageSecret(ref),
    createRegistry: (input) => createConfiguredMobileStorageRegistry(input),
    createPayloadStore: () => new ExpoStorageJobPayloadStore(),
    createBlobStore: (db) => new ExpoBlobStore(db),
    createRouter: (options) => createStorageRouter(options),
    runBackup: (input) => runLocalDatabaseBackup(input),
    runRetention: (input) => runRetentionJob(input),
    runRepair: (input) => runRepairJob(input),
  };
}

async function executeBackgroundStorage(
  runtime: MobileStorageScheduleRuntime,
): Promise<StorageScheduleRunReport> {
  const db = runtime.db;
  ensureStorageTables(db);
  const identityRow = getIdentityRow(db);
  const identity = identityRow === null ? null : {
    publicKey: identityRow.public_key,
    privateKeyRef: identityRow.private_key_ref,
    dhPublicKey: identityRow.dh_public_key,
    displayName: identityRow.display_name,
    createdAt: identityRow.created_at,
  };
  const { registry } = runtime.createRegistry({ db, identity });
  const payloadStore = runtime.createPayloadStore();
  const blobStore = runtime.createBlobStore(db);
  const router = runtime.createRouter({
    db,
    adapterResolver: registry.resolveRouterDestination,
    now: runtime.nowIso,
    random: runtime.randomUUID,
    payloadStore,
  });
  const destinations = listStorageDestinations(db);
  for (const destination of destinations) {
    try {
      const adapter = registry.resolveRouterDestination(destination);
      const authorizationInput = backgroundAuthorization(destination);
      if (adapter !== null && authorizationInput !== null) {
        const authorization = await adapter.authorize(authorizationInput);
        if (authorization.kind !== 'authorized') continue;
      }
    } catch {
      // The relevant maintenance operation reports the unavailable adapter.
    }
  }
  for (const policy of listStoragePolicies(db)) {
    try {
      await router.checkHealth(policy.primary_destination_id, { refresh: true });
    } catch {
      // The scheduler decision reports the persisted health reason below.
    }
  }
  const decisions = readStorageScheduleDecisions(db, runtime.nowIso());
  const due = decisions.filter((decision) => decision.due);
  const outcomes: ScheduledBackupOutcome[] = [];
  for (const decision of due) {
    if (identity === null) {
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: 'skipped',
        backupId: null,
        reason: 'No device identity is available.',
      });
      continue;
    }
    const policy = listStoragePolicies(db).find((item) => item.data_class === decision.dataClass);
    const schedule = policy ? parseStorageScheduleConfig(policy.retention_json) : null;
    if (decision.dataClass !== 'sqlite_snapshot' || schedule?.recoveryKeyRef === null
      || schedule?.recoveryKeyRef === undefined) {
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: 'skipped',
        backupId: null,
        reason: decision.dataClass === 'sqlite_snapshot'
          ? 'Scheduled backup needs a recovery key stored in secure storage.'
          : 'This data class has no scheduled backup encoder.',
      });
      continue;
    }
    const recoveryKey = await runtime.readSecret(schedule.recoveryKeyRef);
    if (recoveryKey === null) {
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: 'skipped',
        backupId: null,
        reason: 'The scheduled recovery key is unavailable.',
      });
      continue;
    }
    let signing: BackupSigningIdentity | null = null;
    const recoveryBytes = parseRecoveryKey(recoveryKey);
    if (recoveryBytes === null) {
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: 'skipped',
        backupId: null,
        reason: 'The scheduled recovery key is invalid.',
      });
      continue;
    }
    const backupId = `backup-${runtime.randomUUID()}`;
    try {
      const recoverable = exportRecoverableIdentity(identity);
      signing = {
        deviceId: identity.publicKey,
        publicKey: hexToBytes(recoverable.publicKey),
        secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
      };
      const result = await runtime.runBackup({
        db,
        router,
        destinationId: decision.destinationId,
        backupId,
        schemaVersion: 1,
        payloadStore,
        blobStore,
        encoderInput: {
          recoveryKey,
          backupId,
          createdAt: runtime.nowIso(),
          schemaVersion: 1,
          migrationVersion: 1,
          appVersion: '1.0.0',
          dataClassVersions: {},
          sealedRecoveryBundle: sealRecovery(recoverable, recoveryBytes),
          signingIdentity: signing,
        },
      });
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: !result.complete ? 'failed' : result.mirror?.error ? 'partial' : 'succeeded',
        backupId,
        reason: !result.complete
          ? result.job.last_error_code ?? result.job.state
          : result.mirror?.error ?? null,
      });
    } catch (error) {
      outcomes.push({
        dataClass: decision.dataClass,
        destinationId: decision.destinationId,
        status: 'failed',
        backupId,
        reason: error instanceof Error ? error.message : 'scheduled_backup_failed',
      });
    } finally {
      signing?.secretKey.fill(0);
      recoveryBytes.fill(0);
    }
  }

  let retentionDeleted = 0;
  const retentionBackups = listStorageBackups(db);
  const retentionObjects = listStorageObjects(db);
  for (const policy of listStoragePolicies(db)) {
    const copies = buildRetentionBackupCopies({
      dataClass: policy.data_class,
      mirrorDestinationId: policy.mirror_destination_id,
      backups: retentionBackups,
      objects: retentionObjects,
    });
    const plan = planRetentionJob({
      dataClass: policy.data_class,
      retentionJson: policy.retention_json,
      backups: copies,
      now: runtime.nowIso(),
    });
    const report = await runtime.runRetention({ db, router, plan });
    retentionDeleted += report.deleted;
  }
  const repairPlan = planMissingObjectRepair({
    objects: listStorageObjects(db),
    destinations: listStorageDestinations(db),
  });
  const repair = await runtime.runRepair({
    db,
    plan: repairPlan,
    resolveAdapter: (destinationId) => {
      const destination = router.getDestination(destinationId);
      return destination ? registry.resolveRouterDestination(destination) : null;
    },
    now: runtime.nowIso,
    random: runtime.randomUUID,
  });
  const ran = outcomes.some((outcome) => outcome.backupId !== null)
    || retentionDeleted > 0 || repair.repaired > 0;
  return {
    ran,
    decisions,
    backups: outcomes,
    retentionDeleted,
    repairedObjects: repair.repaired,
    reason: ran
      ? null
      : due.length === 0 ? 'No storage backup policy is due.' : 'Every due backup was skipped.',
  };
}

function backgroundAuthorization(
  destination: StorageDestinationRow,
): StorageAuthorizationInput | null {
  const credentialRef = destination.credential_ref;
  if (credentialRef === null) return null;
  return {
    kind: credentialRef.startsWith('broker://oauth/') ? 'broker_vault' : 'stored_credential',
    credentialRef,
    ...(destination.account_hint === null ? {} : { accountHint: destination.account_hint }),
  };
}
