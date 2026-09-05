import type {
  StorageBackupRow,
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
  StorageObjectRow,
  StoragePolicyRow,
} from './schema';
import { remoteBackupPrefix } from './remote-backups';

export const MIN_STORAGE_SCHEDULE_HOURS = 1;
export const MAX_STORAGE_SCHEDULE_HOURS = 24 * 30;

export type StorageScheduleReason =
  | 'due'
  | 'not_due'
  | 'disabled'
  | 'invalid_policy'
  | 'destination_missing'
  | 'destination_unavailable'
  | 'health_missing'
  | 'health_unavailable'
  | 'revoked'
  | 'quota_full'
  | 'job_active'
  | 'paused_job';

export interface StorageScheduleDecision {
  dataClass: string;
  destinationId: string;
  enabled: boolean;
  due: boolean;
  reason: StorageScheduleReason;
  intervalHours: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface DecideStorageScheduleInput {
  policies: readonly StoragePolicyRow[];
  destinations: readonly StorageDestinationRow[];
  health: readonly StorageHealthRow[];
  jobs: readonly StorageJobRow[];
  lastRuns?: readonly StorageScheduleLastRunRow[];
  now: string;
}

export interface StorageScheduleLastRunRow {
  dataClass: string;
  destinationId: string;
  completedAt: string;
}

export interface StorageScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  recoveryKeyRef: string | null;
}

export function decideStorageSchedule(
  input: DecideStorageScheduleInput,
): StorageScheduleDecision[] {
  const now = Date.parse(input.now);
  const destinations = new Map(input.destinations.map((destination) => [destination.id, destination]));
  const health = new Map(input.health.map((row) => [row.destination_id, row]));
  const lastRuns = new Map<string, string>();
  const legacyLastRuns = new Map<string, string>();
  const activeReasons = new Map<string, 'paused_job' | 'job_active'>();
  for (const row of input.lastRuns ?? []) {
    if (!Number.isFinite(Date.parse(row.completedAt))) continue;
    const key = scheduleRunKey(row.dataClass, row.destinationId);
    const latest = lastRuns.get(key);
    if (latest === undefined || Date.parse(row.completedAt) > Date.parse(latest)) {
      lastRuns.set(key, row.completedAt);
    }
  }
  for (const job of input.jobs) {
    if (job.kind !== 'backup') continue;
    if (input.lastRuns === undefined && job.state === 'succeeded') {
      if (!Number.isFinite(Date.parse(job.updated_at))) continue;
      const latest = legacyLastRuns.get(job.destination_id);
      if (latest === undefined || Date.parse(job.updated_at) > Date.parse(latest)) {
        legacyLastRuns.set(job.destination_id, job.updated_at);
      }
    }
    if (job.state === 'paused') activeReasons.set(job.destination_id, 'paused_job');
    else if ((job.state === 'queued' || job.state === 'running')
      && activeReasons.get(job.destination_id) !== 'paused_job') {
      activeReasons.set(job.destination_id, 'job_active');
    }
  }
  if (input.lastRuns === undefined) {
    for (const policy of input.policies) {
      const completedAt = legacyLastRuns.get(policy.primary_destination_id);
      if (completedAt !== undefined) {
        lastRuns.set(scheduleRunKey(policy.data_class, policy.primary_destination_id), completedAt);
      }
    }
  }
  const context = { input, now, destinations, health, lastRuns, activeReasons };
  return [...input.policies]
    .sort((left, right) => left.data_class.localeCompare(right.data_class))
    .map((policy) => decidePolicy(policy, context));
}

interface SchedulerContext {
  input: DecideStorageScheduleInput;
  now: number;
  destinations: ReadonlyMap<string, StorageDestinationRow>;
  health: ReadonlyMap<string, StorageHealthRow>;
  lastRuns: ReadonlyMap<string, string>;
  activeReasons: ReadonlyMap<string, 'paused_job' | 'job_active'>;
}

function decidePolicy(
  policy: StoragePolicyRow,
  context: SchedulerContext,
): StorageScheduleDecision {
  const schedule = parseStorageScheduleConfig(policy.retention_json);
  const base = {
    dataClass: policy.data_class,
    destinationId: policy.primary_destination_id,
    lastRunAt: context.lastRuns.get(scheduleRunKey(
      policy.data_class,
      policy.primary_destination_id,
    )) ?? null,
  };
  if (schedule === null || !Number.isFinite(context.now)) {
    return decision(base, false, false, 'invalid_policy', null, null);
  }
  if (!schedule.enabled) {
    return decision(base, false, false, 'disabled', schedule.intervalHours, null);
  }
  const destination = context.destinations.get(policy.primary_destination_id);
  if (destination === undefined) {
    return decision(base, true, false, 'destination_missing', schedule.intervalHours, null);
  }
  if (destination.state === 'revoked') {
    return decision(base, true, false, 'revoked', schedule.intervalHours, null);
  }
  if (destination.state !== 'ready' && destination.state !== 'degraded') {
    return decision(base, true, false, 'destination_unavailable', schedule.intervalHours, null);
  }
  const activeReason = context.activeReasons.get(destination.id);
  if (activeReason !== undefined) {
    return decision(base, true, false, activeReason, schedule.intervalHours, null);
  }
  const health = context.health.get(destination.id);
  if (health === undefined) {
    return decision(base, true, false, 'health_missing', schedule.intervalHours, null);
  }
  if (health.state === 'revoked') {
    return decision(base, true, false, 'revoked', schedule.intervalHours, null);
  }
  if (health.state !== 'ok' && health.state !== 'degraded') {
    return decision(base, true, false, 'health_unavailable', schedule.intervalHours, null);
  }
  if (health.cap_bytes !== null && health.used_bytes !== null && health.used_bytes >= health.cap_bytes) {
    return decision(base, true, false, 'quota_full', schedule.intervalHours, null);
  }
  const intervalMs = schedule.intervalHours * 60 * 60 * 1_000;
  const lastRun = base.lastRunAt === null ? null : Date.parse(base.lastRunAt);
  const nextRun = lastRun === null || !Number.isFinite(lastRun) ? null : lastRun + intervalMs;
  if (nextRun !== null && context.now < nextRun) {
    return decision(base, true, false, 'not_due', schedule.intervalHours, new Date(nextRun).toISOString());
  }
  return decision(base, true, true, 'due', schedule.intervalHours, context.input.now);
}

export function deriveStorageScheduleLastRuns(
  backups: readonly StorageBackupRow[],
  objects: readonly StorageObjectRow[],
): StorageScheduleLastRunRow[] {
  const completeByPrefix = new Map<string, StorageBackupRow>();
  for (const backup of backups) {
    if (backup.state !== 'complete' || backup.completed_at === null
      || !Number.isFinite(Date.parse(backup.completed_at))) continue;
    try {
      completeByPrefix.set(
        scheduleRunKey(remoteBackupPrefix(backup.backup_id), backup.destination_id),
        backup,
      );
    } catch {
      // A malformed tracked id cannot become scheduling evidence.
    }
  }
  const latest = new Map<string, StorageScheduleLastRunRow>();
  for (const object of objects) {
    if (object.state !== 'verified') continue;
    const prefix = remoteObjectPrefix(object.object_id);
    if (prefix === null) continue;
    const backup = completeByPrefix.get(scheduleRunKey(prefix, object.destination_id));
    if (backup === undefined || backup.completed_at === null) continue;
    const key = scheduleRunKey(object.data_class, object.destination_id);
    const current = latest.get(key);
    if (current === undefined || Date.parse(backup.completed_at) > Date.parse(current.completedAt)) {
      latest.set(key, {
        dataClass: object.data_class,
        destinationId: object.destination_id,
        completedAt: backup.completed_at,
      });
    }
  }
  return [...latest.values()].sort((left, right) => left.dataClass.localeCompare(right.dataClass)
    || left.destinationId.localeCompare(right.destinationId));
}

function remoteObjectPrefix(objectId: string): string | null {
  return /^(mkb1\.[a-f0-9]{64}\.)/u.exec(objectId)?.[1] ?? null;
}

function scheduleRunKey(dataClass: string, destinationId: string): string {
  return JSON.stringify([dataClass, destinationId]);
}

function decision(
  base: { dataClass: string; destinationId: string; lastRunAt: string | null },
  enabled: boolean,
  due: boolean,
  reason: StorageScheduleReason,
  intervalHours: number | null,
  nextRunAt: string | null,
): StorageScheduleDecision {
  return { ...base, enabled, due, reason, intervalHours, nextRunAt };
}

export function parseStorageScheduleConfig(retentionJson: string): StorageScheduleConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(retentionJson) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const schedule = (parsed as Record<string, unknown>).schedule;
  if (schedule === undefined) return { enabled: false, intervalHours: 24, recoveryKeyRef: null };
  if (typeof schedule !== 'object' || schedule === null || Array.isArray(schedule)) return null;
  const record = schedule as Record<string, unknown>;
  if (typeof record.enabled !== 'boolean') return null;
  const interval = record.intervalHours ?? record.interval_hours;
  if (!Number.isSafeInteger(interval)) return null;
  const recoveryKeyRef = record.recoveryKeyRef ?? record.recovery_key_ref ?? null;
  if (recoveryKeyRef !== null && (typeof recoveryKeyRef !== 'string'
    || recoveryKeyRef.length === 0 || recoveryKeyRef.length > 500 || /[\0\r\n]/u.test(recoveryKeyRef))) {
    return null;
  }
  return {
    enabled: record.enabled,
    intervalHours: Math.max(
      MIN_STORAGE_SCHEDULE_HOURS,
      Math.min(MAX_STORAGE_SCHEDULE_HOURS, interval as number),
    ),
    recoveryKeyRef,
  };
}

export function updateStorageScheduleConfig(
  retentionJson: string,
  schedule: StorageScheduleConfig,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(retentionJson) as unknown;
  } catch {
    throw new Error('retention policy is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('retention policy must be an object');
  }
  if (!Number.isSafeInteger(schedule.intervalHours)) throw new Error('schedule interval is invalid');
  const intervalHours = Math.max(
    MIN_STORAGE_SCHEDULE_HOURS,
    Math.min(MAX_STORAGE_SCHEDULE_HOURS, schedule.intervalHours),
  );
  if (schedule.recoveryKeyRef !== null
    && (schedule.recoveryKeyRef.length === 0 || schedule.recoveryKeyRef.length > 500
      || /[\0\r\n]/u.test(schedule.recoveryKeyRef))) {
    throw new Error('schedule recovery key reference is invalid');
  }
  return JSON.stringify({
    ...(parsed as Record<string, unknown>),
    schedule: {
      enabled: schedule.enabled,
      intervalHours,
      recoveryKeyRef: schedule.recoveryKeyRef,
    },
  });
}
