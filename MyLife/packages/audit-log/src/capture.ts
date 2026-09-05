import type { AuditEvent, AuditEventInput } from './types';

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    id: crypto.randomUUID(),
    restaurantId: input.restaurantId,
    actorUserId: input.actorUserId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function diffValues(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  for (const key of allKeys) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      oldValue[key] = oldObj[key];
      newValue[key] = newObj[key];
    }
  }
  return { oldValue, newValue };
}

export function formatAction(entity: string, verb: string): string {
  return `${entity}.${verb}`;
}
