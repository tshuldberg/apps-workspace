import type { AuditEvent } from './types';
import { DEFAULT_RETENTION_DAYS } from './types';

export function getRetentionCutoff(retentionDays: number = DEFAULT_RETENTION_DAYS): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

export function isExpired(event: AuditEvent, retentionDays: number = DEFAULT_RETENTION_DAYS): boolean {
  const cutoff = getRetentionCutoff(retentionDays);
  return new Date(event.createdAt) < cutoff;
}

export function getExpiredEvents(events: AuditEvent[], retentionDays: number = DEFAULT_RETENTION_DAYS): AuditEvent[] {
  return events.filter((e) => isExpired(e, retentionDays));
}
