import type { DatabaseAdapter } from '@mylife/db';
import {
  buildRetentionBackupCopies,
  createStorageRouter,
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
  planRepairJob,
  planRetentionJob,
  runRepairJob,
  runRetentionJob,
  type DeviceIdentity,
  type StorageAuthorizationInput,
  type StorageDestinationRow,
  type StorageScheduleDecision,
} from '@mylife/sync';
import type { BackupSigningIdentity } from '@mylife/sync/src/storage/backup-format';
import type { BrowserStorageSecretAccess } from './credential-store';
import { createConfiguredWebStorageRegistry } from './configured-registry';
import type { WebSnapshotDatabase } from './local-snapshot';
import { runWebDatabaseBackup } from './web-backup-run';
import { BrowserStorageJobPayloadStore } from './storage-job-payload-store';
import { BrowserBlobStore } from './browser-blob-store';

export interface WebStorageScheduleRunInput {
  db: DatabaseAdapter & WebSnapshotDatabase;
  identity: DeviceIdentity;
  secrets: BrowserStorageSecretAccess;
  flush?: () => Promise<void>;
  /** Injectable production seams for deterministic orchestration tests. */
  runtime?: WebStorageScheduleRuntime;
}

export interface WebStorageScheduleRunReport {
  ran: boolean;
  decisions: StorageScheduleDecision[];
  succeeded: number;
  partial: number;
  failed: number;
  skipped: number;
  retentionDeleted: number;
  repairedObjects: number;
}

type WebRegistry = ReturnType<typeof createConfiguredWebStorageRegistry>;

export interface WebStorageScheduleRuntime {
  nowIso(): string;
  randomUUID(): string;
  createRegistry(input: WebStorageScheduleRunInput): WebRegistry;
  createPayloadStore(): BrowserStorageJobPayloadStore;
  createBlobStore(db: DatabaseAdapter): BrowserBlobStore;
  createRouter: typeof createStorageRouter;
  runBackup: typeof runWebDatabaseBackup;
  runRetention: typeof runRetentionJob;
  runRepair: typeof runRepairJob;
}

const DEFAULT_RUNTIME: WebStorageScheduleRuntime = {
  nowIso: () => new Date().toISOString(),
  randomUUID: () => globalThis.crypto.randomUUID(),
  createRegistry: (input) => createConfiguredWebStorageRegistry(input),
  createPayloadStore: () => new BrowserStorageJobPayloadStore(),
  createBlobStore: (db) => new BrowserBlobStore(db),
  createRouter: (options) => createStorageRouter(options),
  runBackup: (input) => runWebDatabaseBackup(input),
  runRetention: (input) => runRetentionJob(input),
  runRepair: (input) => runRepairJob(input),
};

const activeRuns = new WeakMap<object, Promise<WebStorageScheduleRunReport>>();

export function runWebStorageScheduleOnce(
  input: WebStorageScheduleRunInput,
): Promise<WebStorageScheduleRunReport> {
  const existing = activeRuns.get(input.db);
  if (existing !== undefined) return existing;
  const active = executeWebStorageSchedule(input, input.runtime ?? DEFAULT_RUNTIME)
    .finally(() => { activeRuns.delete(input.db); });
  activeRuns.set(input.db, active);
  return active;
}

async function executeWebStorageSchedule(
  input: WebStorageScheduleRunInput,
  runtime: WebStorageScheduleRuntime,
): Promise<WebStorageScheduleRunReport> {
  ensureStorageTables(input.db);
  const registry = runtime.createRegistry(input);
  const payloadStore = runtime.createPayloadStore();
  const blobStore = runtime.createBlobStore(input.db);
  const router = runtime.createRouter({
    db: input.db,
    adapterResolver: registry.resolveRouterDestination,
    now: runtime.nowIso,
    random: runtime.randomUUID,
    payloadStore,
  });
  const destinations = listStorageDestinations(input.db);
  for (const destination of destinations) {
    const adapter = registry.resolveRouterDestination(destination);
    const authorizationInput = backgroundAuthorization(destination);
    try {
      if (adapter !== null && authorizationInput !== null) {
        const authorization = await adapter.authorize(authorizationInput);
        if (authorization.kind !== 'authorized') continue;
      }
    } catch {
      // The relevant maintenance operation reports the unavailable adapter.
    }
  }
  for (const policy of listStoragePolicies(input.db)) {
    try {
      await router.checkHealth(policy.primary_destination_id, { refresh: true });
    } catch {
      // Persisted health and the pure decision below remain the honest result.
    }
  }
  const decisions = decideStorageSchedule({
    policies: listStoragePolicies(input.db),
    destinations: listStorageDestinations(input.db),
    health: listStorageHealth(input.db),
    jobs: listStorageJobs(input.db),
    lastRuns: deriveStorageScheduleLastRuns(
      listStorageBackups(input.db),
      listStorageObjects(input.db),
    ),
    now: runtime.nowIso(),
  });
  let succeeded = 0;
  let partial = 0;
  let failed = 0;
  let skipped = 0;
  for (const decision of decisions.filter((item) => item.due)) {
    const policy = listStoragePolicies(input.db).find((item) => item.data_class === decision.dataClass);
    const schedule = policy ? parseStorageScheduleConfig(policy.retention_json) : null;
    const recoveryKey = schedule?.recoveryKeyRef ? input.secrets.get(schedule.recoveryKeyRef) : null;
    if (decision.dataClass !== 'sqlite_snapshot' || !recoveryKey) {
      skipped += 1;
      continue;
    }
    let signing: BackupSigningIdentity | null = null;
    const recoveryBytes = parseRecoveryKey(recoveryKey);
    if (recoveryBytes === null) {
      skipped += 1;
      continue;
    }
    try {
      const recoverable = exportRecoverableIdentity(input.identity);
      signing = {
        deviceId: input.identity.publicKey,
        publicKey: hexToBytes(recoverable.publicKey),
        secretKey: hexToBytes(recoverable.signingPrivateKeyHex),
      };
      const backupId = `backup-${runtime.randomUUID()}`;
      const outcome = await runtime.runBackup({
        db: input.db,
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
      if (!outcome.complete) failed += 1;
      else if (outcome.mirror?.error) partial += 1;
      else succeeded += 1;
    } catch {
      failed += 1;
    } finally {
      signing?.secretKey.fill(0);
      recoveryBytes.fill(0);
    }
  }

  let retentionDeleted = 0;
  const retentionBackups = listStorageBackups(input.db);
  const retentionObjects = listStorageObjects(input.db);
  for (const policy of listStoragePolicies(input.db)) {
    const plan = planRetentionJob({
      dataClass: policy.data_class,
      retentionJson: policy.retention_json,
      backups: buildRetentionBackupCopies({
        dataClass: policy.data_class,
        mirrorDestinationId: policy.mirror_destination_id,
        backups: retentionBackups,
        objects: retentionObjects,
      }),
      now: runtime.nowIso(),
    });
    retentionDeleted += (await runtime.runRetention({ db: input.db, router, plan })).deleted;
  }
  const repair = await runtime.runRepair({
    db: input.db,
    plan: planRepairJob({
      objects: listStorageObjects(input.db),
      destinations: listStorageDestinations(input.db),
    }),
    resolveAdapter: (destinationId) => {
      const destination = router.getDestination(destinationId);
      return destination ? registry.resolveRouterDestination(destination) : null;
    },
    now: runtime.nowIso,
    random: runtime.randomUUID,
  });
  await input.flush?.();
  return {
    ran: succeeded + partial + failed > 0 || retentionDeleted > 0 || repair.repaired > 0,
    decisions,
    succeeded,
    partial,
    failed,
    skipped,
    retentionDeleted,
    repairedObjects: repair.repaired,
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
