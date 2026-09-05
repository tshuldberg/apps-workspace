import {
  getAllPreferences,
  getPreference,
  setPreference,
  type DatabaseAdapter,
} from '@mylife/db';

const ACCESS_JOB_PREFIX = 'access_job:';
const ACCESS_ALERT_PREFIX = 'access_alert:';

export type AccessJobStatus = 'pending' | 'completed' | 'alert';

export interface AccessJob {
  eventId: string;
  status: AccessJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
  payload: {
    sku: string;
    appId: string;
    customerEmail?: string;
    githubUsername?: string;
  };
  lastError?: string;
}

export interface AccessAlert {
  eventId: string;
  message: string;
  createdAt: string;
  job: AccessJob;
}

function keyForEvent(eventId: string): string {
  return `${ACCESS_JOB_PREFIX}${eventId}`;
}

function keyForAlert(eventId: string): string {
  return `${ACCESS_ALERT_PREFIX}${eventId}`;
}

function parseJob(value: string): AccessJob | null {
  try {
    const parsed = JSON.parse(value) as AccessJob;
    if (
      typeof parsed.eventId !== 'string'
      || typeof parsed.status !== 'string'
      || typeof parsed.attempts !== 'number'
      || typeof parsed.maxAttempts !== 'number'
      || typeof parsed.nextRetryAt !== 'string'
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.updatedAt !== 'string'
      || typeof parsed.payload !== 'object'
      || parsed.payload === null
      || typeof parsed.payload.sku !== 'string'
      || typeof parsed.payload.appId !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistJob(db: DatabaseAdapter, job: AccessJob): void {
  setPreference(db, keyForEvent(job.eventId), JSON.stringify(job));
}

export function getAccessJob(db: DatabaseAdapter, eventId: string): AccessJob | null {
  const stored = getPreference(db, keyForEvent(eventId));
  if (!stored) return null;
  return parseJob(stored);
}

export function upsertAccessJob(db: DatabaseAdapter, job: AccessJob): void {
  persistJob(db, job);
}

export function listDueAccessJobs(
  db: DatabaseAdapter,
  nowIso = new Date().toISOString(),
  limit = 20,
): AccessJob[] {
  const all = getAllPreferences(db);
  const nowMs = Date.parse(nowIso);

  return Object.entries(all)
    .filter(([key]) => key.startsWith(ACCESS_JOB_PREFIX))
    .map(([, value]) => parseJob(value))
    .filter((job): job is AccessJob => Boolean(job))
    .filter((job) => job.status === 'pending')
    .filter((job) => Date.parse(job.nextRetryAt) <= nowMs)
    .sort((a, b) => Date.parse(a.nextRetryAt) - Date.parse(b.nextRetryAt))
    .slice(0, limit);
}

export function recordAccessAlert(db: DatabaseAdapter, alert: AccessAlert): void {
  setPreference(db, keyForAlert(alert.eventId), JSON.stringify(alert));
}

export function markAccessJobCompleted(
  db: DatabaseAdapter,
  eventId: string,
): AccessJob | null {
  const existing = getAccessJob(db, eventId);
  if (!existing) return null;

  const updated: AccessJob = {
    ...existing,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  };

  persistJob(db, updated);
  return updated;
}

export function scheduleAccessJobRetry(
  db: DatabaseAdapter,
  eventId: string,
  errorMessage: string,
  fallbackPayload: AccessJob['payload'],
): AccessJob {
  const now = new Date();
  const nowIso = now.toISOString();

  const existing = getAccessJob(db, eventId);
  const nextAttempts = (existing?.attempts ?? 0) + 1;
  const maxAttempts = existing?.maxAttempts ?? 5;
  const backoffMinutes = Math.min(120, Math.max(5, 5 * 2 ** Math.max(nextAttempts - 1, 0)));
  const nextRetryAt = new Date(now.getTime() + backoffMinutes * 60_000).toISOString();

  const updated: AccessJob = {
    eventId,
    status: nextAttempts >= maxAttempts ? 'alert' : 'pending',
    attempts: nextAttempts,
    maxAttempts,
    nextRetryAt,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    payload: existing?.payload ?? fallbackPayload,
    lastError: errorMessage,
  };

  persistJob(db, updated);

  if (updated.status === 'alert') {
    recordAccessAlert(db, {
      eventId,
      message: `GitHub access automation reached max retries (${updated.maxAttempts}).`,
      createdAt: nowIso,
      job: updated,
    });
  }

  return updated;
}
