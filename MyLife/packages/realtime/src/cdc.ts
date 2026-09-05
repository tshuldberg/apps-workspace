import type { CdcEvent } from './types';

export function parseCdcPayload(payload: Record<string, unknown>): CdcEvent | null {
  const { table, eventType, new: newRecord, old: oldRecord, commit_timestamp } = payload as {
    table?: string;
    eventType?: string;
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
    commit_timestamp?: string;
  };

  if (!table || !eventType) return null;

  return {
    table,
    eventType: eventType as CdcEvent['eventType'],
    new: newRecord ?? null,
    old: oldRecord ?? null,
    timestamp: commit_timestamp ?? new Date().toISOString(),
  };
}

export function isCdcEventForTable(event: CdcEvent, tableName: string): boolean {
  return event.table === tableName;
}

export function getCdcChangedFields(event: CdcEvent): string[] {
  if (!event.old || !event.new) return [];
  return Object.keys(event.new).filter(
    (key) => JSON.stringify(event.new![key]) !== JSON.stringify(event.old![key]),
  );
}
