import type { DatabaseAdapter } from '@mylife/db';
import {
  getStorageBackup,
  listStorageObjects,
  type StorageBackupRow,
  type StorageBackupState,
  type StorageObjectRow,
} from './schema';
import { remoteBackupManifestObjectId, remoteBackupPrefix } from './remote-backups';
import type { StorageDestinationRouter } from './router';
import type { StorageJob } from './job-reducer';

export const MIN_RETENTION_KEEP_LAST = 1;
export const MAX_RETENTION_KEEP_LAST = 100;
export const MIN_RETENTION_MAX_AGE_DAYS = 1;
export const MAX_RETENTION_MAX_AGE_DAYS = 3_650;

export interface StorageRetentionPolicy {
  keepLast: number;
  maxAgeDays: number;
}

export type RetentionCopyRole = 'primary' | 'mirror';

export interface RetentionBackupCopy {
  backupId: string;
  destinationId: string;
  dataClass: string;
  role: RetentionCopyRole;
  state: StorageBackupState;
  completedAt: string;
}

export type RetentionProtectionReason =
  | 'within_keep_last'
  | 'within_max_age'
  | 'last_verified_complete'
  | 'primary_not_verified';

export interface RetentionProtectedCopy {
  backupId: string;
  destinationId: string;
  reason: RetentionProtectionReason;
}

export interface RetentionDeleteCopy {
  backupId: string;
  destinationId: string;
  role: RetentionCopyRole;
}

export interface PlanRetentionJobInput {
  dataClass: string;
  retentionJson: string;
  backups: readonly RetentionBackupCopy[];
  now: string;
}

export interface RetentionJobPlan {
  dataClass: string;
  policy: StorageRetentionPolicy | null;
  deleteCopies: RetentionDeleteCopy[];
  protectedCopies: RetentionProtectedCopy[];
  invalidPolicy: boolean;
}

export interface BuildRetentionBackupCopiesInput {
  dataClass: string;
  mirrorDestinationId: string | null;
  backups: readonly StorageBackupRow[];
  objects: readonly StorageObjectRow[];
}

export function buildRetentionBackupCopies(
  input: BuildRetentionBackupCopiesInput,
): RetentionBackupCopy[] {
  const backupsByPrefix = new Map<string, StorageBackupRow>();
  for (const backup of input.backups) {
    try {
      backupsByPrefix.set(
        retentionCopyKey(backup.destination_id, remoteBackupPrefix(backup.backup_id)),
        backup,
      );
    } catch {
      // A malformed tracked id cannot become a retention delete candidate.
    }
  }
  const matched = new Set<string>();
  for (const object of input.objects) {
    if (object.data_class !== input.dataClass || object.state === 'deleted') continue;
    const prefix = /^(mkb1\.[a-f0-9]{64}\.)/u.exec(object.object_id)?.[1];
    if (prefix === undefined) continue;
    const key = retentionCopyKey(object.destination_id, prefix);
    if (backupsByPrefix.has(key)) matched.add(key);
  }
  return [...matched].map((key) => {
    const backup = backupsByPrefix.get(key);
    if (backup === undefined) throw new Error('retention backup classification became inconsistent');
    return {
      backupId: backup.backup_id,
      destinationId: backup.destination_id,
      dataClass: input.dataClass,
      role: backup.destination_id === input.mirrorDestinationId ? 'mirror' : 'primary',
      state: backup.state,
      completedAt: backup.completed_at ?? '',
    };
  });
}

function retentionCopyKey(destinationId: string, prefix: string): string {
  return JSON.stringify([destinationId, prefix]);
}

export function parseRetentionPolicy(retentionJson: string): StorageRetentionPolicy | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(retentionJson) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const keepLast = record.keepLast ?? record.keep_last ?? 7;
  const maxAgeDays = record.maxAgeDays ?? record.max_age_days ?? 30;
  if (!Number.isSafeInteger(keepLast) || !Number.isSafeInteger(maxAgeDays)) return null;
  return {
    keepLast: clamp(keepLast as number, MIN_RETENTION_KEEP_LAST, MAX_RETENTION_KEEP_LAST),
    maxAgeDays: clamp(
      maxAgeDays as number,
      MIN_RETENTION_MAX_AGE_DAYS,
      MAX_RETENTION_MAX_AGE_DAYS,
    ),
  };
}

export function planRetentionJob(input: PlanRetentionJobInput): RetentionJobPlan {
  const policy = parseRetentionPolicy(input.retentionJson);
  if (policy === null || !validDate(input.now)) {
    return {
      dataClass: input.dataClass,
      policy,
      deleteCopies: [],
      protectedCopies: [],
      invalidPolicy: true,
    };
  }
  const complete = input.backups.filter((copy) => copy.dataClass === input.dataClass
    && copy.state === 'complete' && validDate(copy.completedAt));
  const logical = new Map<string, RetentionBackupCopy[]>();
  for (const copy of complete) {
    const group = logical.get(copy.backupId) ?? [];
    group.push(copy);
    logical.set(copy.backupId, group);
  }
  const ranked = [...logical.entries()].map(([backupId, copies]) => ({
    backupId,
    copies,
    completedAt: copies.reduce(
      (latest, copy) => copy.completedAt > latest ? copy.completedAt : latest,
      copies[0]?.completedAt ?? '',
    ),
  })).sort((left, right) => right.completedAt.localeCompare(left.completedAt)
    || left.backupId.localeCompare(right.backupId));
  const cutoff = Date.parse(input.now) - policy.maxAgeDays * 24 * 60 * 60 * 1_000;
  const deleteCopies: RetentionDeleteCopy[] = [];
  const protectedCopies: RetentionProtectedCopy[] = [];

  for (const [index, backup] of ranked.entries()) {
    const lastVerified = ranked.length === 1;
    const withinKeepLast = index < policy.keepLast;
    const withinMaxAge = Date.parse(backup.completedAt) >= cutoff;
    for (const copy of backup.copies) {
      if (lastVerified) {
        protectedCopies.push(protectedCopy(copy, 'last_verified_complete'));
      } else if (withinKeepLast) {
        protectedCopies.push(protectedCopy(copy, 'within_keep_last'));
      } else if (withinMaxAge) {
        protectedCopies.push(protectedCopy(copy, 'within_max_age'));
      } else if (copy.role === 'mirror' && !hasVerifiedPrimary(input.backups, copy.backupId)) {
        protectedCopies.push(protectedCopy(copy, 'primary_not_verified'));
      } else {
        deleteCopies.push({
          backupId: copy.backupId,
          destinationId: copy.destinationId,
          role: copy.role,
        });
      }
    }
  }
  return {
    dataClass: input.dataClass,
    policy,
    deleteCopies,
    protectedCopies,
    invalidPolicy: false,
  };
}

function hasVerifiedPrimary(backups: readonly RetentionBackupCopy[], backupId: string): boolean {
  return backups.some((copy) => copy.backupId === backupId
    && copy.role === 'primary' && copy.state === 'complete');
}

function protectedCopy(
  copy: RetentionBackupCopy,
  reason: RetentionProtectionReason,
): RetentionProtectedCopy {
  return { backupId: copy.backupId, destinationId: copy.destinationId, reason };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export interface RetentionDeleteOutcome {
  backupId: string;
  destinationId: string;
  status: 'deleted' | 'failed' | 'skipped';
  job: StorageJob | null;
  reason: string | null;
}

export interface RetentionExecutionReport {
  planned: number;
  deleted: number;
  failed: number;
  skipped: number;
  complete: boolean;
  outcomes: RetentionDeleteOutcome[];
}

export async function runRetentionJob(input: {
  db: DatabaseAdapter;
  router: StorageDestinationRouter;
  plan: RetentionJobPlan;
}): Promise<RetentionExecutionReport> {
  const outcomes: RetentionDeleteOutcome[] = [];
  for (const copy of input.plan.deleteCopies) {
    const backup = getStorageBackup(input.db, copy.backupId, copy.destinationId);
    const manifestObjectId = remoteBackupManifestObjectId(copy.backupId);
    const prefix = remoteBackupPrefix(copy.backupId);
    const rows = listStorageObjects(input.db, copy.destinationId)
      .filter((row) => row.object_id.startsWith(prefix) && row.state !== 'deleted');
    if (backup?.state !== 'complete' || !rows.some((row) => row.object_id === manifestObjectId)) {
      outcomes.push({
        backupId: copy.backupId,
        destinationId: copy.destinationId,
        status: 'skipped',
        job: null,
        reason: 'tracked_complete_copy_unavailable',
      });
      continue;
    }
    try {
      const planned = input.router.planDeleteJob({
        destinationId: copy.destinationId,
        backupId: copy.backupId,
        manifestObjectId,
        objectIds: rows.filter((row) => row.object_id !== manifestObjectId)
          .map((row) => row.object_id),
      });
      const job = await input.router.runJob(planned.id);
      outcomes.push({
        backupId: copy.backupId,
        destinationId: copy.destinationId,
        status: job.state === 'succeeded' ? 'deleted' : 'failed',
        job,
        reason: job.state === 'succeeded' ? null : job.last_error_code ?? job.state,
      });
    } catch (error) {
      outcomes.push({
        backupId: copy.backupId,
        destinationId: copy.destinationId,
        status: 'failed',
        job: null,
        reason: error instanceof Error ? error.message : 'retention_delete_failed',
      });
    }
  }
  const deleted = outcomes.filter((outcome) => outcome.status === 'deleted').length;
  const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
  const skipped = outcomes.filter((outcome) => outcome.status === 'skipped').length;
  return {
    planned: outcomes.length,
    deleted,
    failed,
    skipped,
    complete: failed === 0 && skipped === 0,
    outcomes,
  };
}
