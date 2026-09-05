import type {
  StorageBackupRow,
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
  StorageObjectRow,
  StorageObjectState,
  StoragePolicyRow,
} from './schema';

export interface StorageDiagnosticsRows {
  destinations: readonly StorageDestinationRow[];
  policies: readonly StoragePolicyRow[];
  objects: readonly StorageObjectRow[];
  jobs: readonly StorageJobRow[];
  health: readonly StorageHealthRow[];
  backups: readonly StorageBackupRow[];
}

export interface StorageJobProgressDiagnostic {
  id: string;
  kind: StorageJobRow['kind'];
  destinationId: string;
  state: StorageJobRow['state'];
  completedObjects: number;
  totalObjects: number;
  completedBytes: number;
  totalBytes: number;
  attempts: number;
  errorCode: string | null;
  updatedAt: string;
}

export interface StorageBackupDiagnostic {
  backupId: string;
  destinationId: string;
  state: StorageBackupRow['state'];
  complete: boolean;
  objectCount: number;
  encryptedBytes: number;
  schemaVersion: number;
  completedAt: string | null;
}

export type StorageObjectStateCounts = Record<StorageObjectState, number> & { total: number };

export interface StorageDestinationDiagnostic {
  id: string;
  kind: StorageDestinationRow['kind'];
  label: string;
  state: StorageDestinationRow['state'];
  healthState: StorageHealthRow['state'] | null;
  usedBytes: number | null;
  capBytes: number | null;
  verifiedReadWrite: boolean;
  healthCheckedAt: string | null;
  healthErrorCode: string | null;
  lastVerificationAt: string | null;
  objectCounts: StorageObjectStateCounts;
  activeJobs: readonly StorageJobProgressDiagnostic[];
  runningJobs: readonly StorageJobProgressDiagnostic[];
  backups: readonly StorageBackupDiagnostic[];
}

export interface StoragePolicyDestinationSummary {
  id: string;
  label: string | null;
  state: StorageDestinationRow['state'] | 'missing';
  availableForNewWrites: boolean;
}

export interface StoragePolicyDiagnostic {
  dataClass: string;
  primary: StoragePolicyDestinationSummary;
  mirror: StoragePolicyDestinationSummary | null;
  localCacheBytes: number;
  retentionJson: string;
  updatedAt: string;
}

export type StorageDiagnosticIssueKind =
  | 'auth_required'
  | 'quota'
  | 'degraded'
  | 'unverified-backup';

export interface StorageDiagnosticIssue {
  kind: StorageDiagnosticIssueKind;
  count: number;
  destinationIds: readonly string[];
  backupIds: readonly string[];
}

export interface StorageDiagnostics {
  destinations: readonly StorageDestinationDiagnostic[];
  policies: readonly StoragePolicyDiagnostic[];
  activeJobs: readonly StorageJobProgressDiagnostic[];
  runningJobs: readonly StorageJobProgressDiagnostic[];
  backups: readonly StorageBackupDiagnostic[];
  issues: readonly StorageDiagnosticIssue[];
}

const ACTIVE_JOB_STATES = new Set<StorageJobRow['state']>(['queued', 'running', 'paused']);

function jobDiagnostic(row: StorageJobRow): StorageJobProgressDiagnostic {
  return {
    id: row.id,
    kind: row.kind,
    destinationId: row.destination_id,
    state: row.state,
    completedObjects: row.completed_objects,
    totalObjects: row.total_objects,
    completedBytes: row.completed_bytes,
    totalBytes: row.total_bytes,
    attempts: row.attempts,
    errorCode: row.last_error_code,
    updatedAt: row.updated_at,
  };
}

function backupDiagnostic(row: StorageBackupRow): StorageBackupDiagnostic {
  return {
    backupId: row.backup_id,
    destinationId: row.destination_id,
    state: row.state,
    complete: row.state === 'complete',
    objectCount: row.object_count,
    encryptedBytes: row.encrypted_bytes,
    schemaVersion: row.schema_version,
    completedAt: row.completed_at,
  };
}

function emptyObjectCounts(): StorageObjectStateCounts {
  return {
    total: 0,
    queued: 0,
    writing: 0,
    verifying: 0,
    verified: 0,
    missing: 0,
    deleting: 0,
    deleted: 0,
    error: 0,
  };
}

function latestVerification(rows: readonly StorageObjectRow[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (
      row.last_verified_at !== null
      && (latest === null || row.last_verified_at.localeCompare(latest) > 0)
    ) {
      latest = row.last_verified_at;
    }
  }
  return latest;
}

function destinationSummary(
  destinationId: string,
  destinations: ReadonlyMap<string, StorageDestinationRow>,
): StoragePolicyDestinationSummary {
  const destination = destinations.get(destinationId);
  if (destination === undefined) {
    return {
      id: destinationId,
      label: null,
      state: 'missing',
      availableForNewWrites: false,
    };
  }
  return {
    id: destination.id,
    label: destination.label,
    state: destination.state,
    availableForNewWrites: destination.state === 'ready' || destination.state === 'degraded',
  };
}

function activeIssue(
  kind: StorageDiagnosticIssueKind,
  destinationIds: readonly string[],
  backupIds: readonly string[] = [],
): StorageDiagnosticIssue | null {
  const count = destinationIds.length + backupIds.length;
  return count === 0 ? null : { kind, count, destinationIds, backupIds };
}

/** Fold persisted rows only. It never upgrades incomplete state optimistically. */
export function buildStorageDiagnostics(rows: StorageDiagnosticsRows): StorageDiagnostics {
  const destinationsById = new Map(
    rows.destinations.map((destination) => [destination.id, destination]),
  );
  const healthByDestination = new Map(
    rows.health.map((health) => [health.destination_id, health]),
  );
  const activeJobs = rows.jobs
    .filter((job) => ACTIVE_JOB_STATES.has(job.state))
    .map(jobDiagnostic)
    .sort((left, right) => left.id.localeCompare(right.id));
  const runningJobs = activeJobs.filter((job) => job.state === 'running');
  const backups = rows.backups
    .map(backupDiagnostic)
    .sort((left, right) => (
      left.destinationId.localeCompare(right.destinationId)
      || left.backupId.localeCompare(right.backupId)
    ));

  const destinations = [...rows.destinations]
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
    .map((destination): StorageDestinationDiagnostic => {
      const health = healthByDestination.get(destination.id) ?? null;
      const destinationObjects = rows.objects.filter(
        (object) => object.destination_id === destination.id,
      );
      const objectCounts = emptyObjectCounts();
      for (const object of destinationObjects) {
        objectCounts.total += 1;
        objectCounts[object.state] += 1;
      }
      const destinationActiveJobs = activeJobs.filter(
        (job) => job.destinationId === destination.id,
      );
      return {
        id: destination.id,
        kind: destination.kind,
        label: destination.label,
        state: destination.state,
        healthState: health?.state ?? null,
        usedBytes: health?.used_bytes ?? null,
        capBytes: health?.cap_bytes ?? null,
        verifiedReadWrite: health?.verified_read_write === 1,
        healthCheckedAt: health?.checked_at ?? null,
        healthErrorCode: health?.error_code ?? null,
        lastVerificationAt: latestVerification(destinationObjects),
        objectCounts,
        activeJobs: destinationActiveJobs,
        runningJobs: destinationActiveJobs.filter((job) => job.state === 'running'),
        backups: backups.filter((backup) => backup.destinationId === destination.id),
      };
    });

  const policies = [...rows.policies]
    .sort((left, right) => left.data_class.localeCompare(right.data_class))
    .map((policy): StoragePolicyDiagnostic => ({
      dataClass: policy.data_class,
      primary: destinationSummary(policy.primary_destination_id, destinationsById),
      mirror: policy.mirror_destination_id === null
        ? null
        : destinationSummary(policy.mirror_destination_id, destinationsById),
      localCacheBytes: policy.local_cache_bytes,
      retentionJson: policy.retention_json,
      updatedAt: policy.updated_at,
    }));

  const authDestinationIds = [...new Set([
    ...rows.destinations
    .filter((destination) => {
      const health = healthByDestination.get(destination.id);
      return destination.state === 'revoked'
        || health?.state === 'auth_required'
        || health?.state === 'revoked';
    })
      .map((destination) => destination.id),
    ...activeJobs
      .filter((job) => job.errorCode === 'auth_required' || job.errorCode === 'revoked')
      .map((job) => job.destinationId),
  ])].sort();
  const authDestinationSet = new Set(authDestinationIds);
  const quotaDestinationIds = [...new Set([
    ...rows.destinations
    .filter((destination) => {
      const health = healthByDestination.get(destination.id);
      return health?.error_code === 'quota_exceeded'
        || (
          health?.used_bytes !== null
          && health?.used_bytes !== undefined
          && health.cap_bytes !== null
          && health.cap_bytes !== undefined
          && health.used_bytes >= health.cap_bytes
        );
    })
      .map((destination) => destination.id),
    ...activeJobs
      .filter((job) => job.errorCode === 'quota_exceeded')
      .map((job) => job.destinationId),
  ])].sort();
  const degradedDestinationIds = rows.destinations
    .filter((destination) => {
      if (authDestinationSet.has(destination.id)) return false;
      const health = healthByDestination.get(destination.id);
      return destination.state === 'degraded'
        || destination.state === 'error'
        || health?.state === 'degraded'
        || health?.state === 'unreachable';
    })
    .map((destination) => destination.id)
    .sort();
  const unverifiedBackupIds = rows.backups
    .filter((backup) => backup.state !== 'complete' && backup.state !== 'deleted')
    .map((backup) => `${backup.destination_id}:${backup.backup_id}`)
    .sort();

  const issues = [
    activeIssue('auth_required', authDestinationIds),
    activeIssue('quota', quotaDestinationIds),
    activeIssue('degraded', degradedDestinationIds),
    activeIssue('unverified-backup', [], unverifiedBackupIds),
  ].filter((issue): issue is StorageDiagnosticIssue => issue !== null);

  return { destinations, policies, activeJobs, runningJobs, backups, issues };
}
