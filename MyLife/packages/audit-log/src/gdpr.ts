import type { AuditEvent } from './types';

export function anonymizeActor(event: AuditEvent): AuditEvent {
  return {
    ...event,
    actorUserId: null,
    ip: null,
    userAgent: null,
    oldValue: event.oldValue ? redactPii(event.oldValue) : null,
    newValue: event.newValue ? redactPii(event.newValue) : null,
  };
}

const PII_FIELDS = ['email', 'phone', 'name', 'display_name', 'first_name', 'last_name', 'ip_address'];

export function redactPii(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    if (PII_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

export function anonymizeEvents(events: AuditEvent[], actorUserId: string): AuditEvent[] {
  return events.map((e) => e.actorUserId === actorUserId ? anonymizeActor(e) : e);
}
