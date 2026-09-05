import { describe, it, expect } from 'vitest';
import { anonymizeActor, redactPii, anonymizeEvents } from '../src/gdpr';
import type { AuditEvent } from '../src/types';

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt-1',
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    action: 'reservation.created',
    entity: 'reservation',
    entityId: 'res-1',
    oldValue: { email: 'test@example.com', name: 'Alice', status: 'pending' },
    newValue: { email: 'new@example.com', name: 'Bob', status: 'confirmed' },
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('anonymizeActor', () => {
  it('removes PII from event', () => {
    const event = makeEvent();
    const anonymized = anonymizeActor(event);
    expect(anonymized.actorUserId).toBeNull();
    expect(anonymized.ip).toBeNull();
    expect(anonymized.userAgent).toBeNull();
    expect(anonymized.oldValue!['email']).toBe('[REDACTED]');
    expect(anonymized.newValue!['name']).toBe('[REDACTED]');
  });

  it('preserves non-PII fields in values', () => {
    const event = makeEvent();
    const anonymized = anonymizeActor(event);
    expect(anonymized.oldValue!['status']).toBe('pending');
    expect(anonymized.newValue!['status']).toBe('confirmed');
  });
});

describe('redactPii', () => {
  it('replaces known PII fields', () => {
    const obj = { email: 'a@b.com', phone: '555-1234', city: 'SF' };
    const result = redactPii(obj);
    expect(result.email).toBe('[REDACTED]');
    expect(result.phone).toBe('[REDACTED]');
    expect(result.city).toBe('SF');
  });
});

describe('anonymizeEvents', () => {
  it('only affects matching actor', () => {
    const events = [
      makeEvent({ actorUserId: 'user-1' }),
      makeEvent({ actorUserId: 'user-2' }),
    ];
    const result = anonymizeEvents(events, 'user-1');
    expect(result[0].actorUserId).toBeNull();
    expect(result[1].actorUserId).toBe('user-2');
  });
});
