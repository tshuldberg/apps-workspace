import { describe, it, expect } from 'vitest';
import { filterEvents } from '../src/query';
import type { AuditEvent } from '../src/types';

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    action: 'reservation.created',
    entity: 'reservation',
    entityId: 'res-1',
    oldValue: null,
    newValue: null,
    ip: null,
    userAgent: null,
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('filterEvents', () => {
  const events: AuditEvent[] = [
    makeEvent({ entity: 'reservation', createdAt: '2026-01-15T10:00:00Z' }),
    makeEvent({ entity: 'table', createdAt: '2026-01-16T10:00:00Z' }),
    makeEvent({ entity: 'reservation', createdAt: '2026-01-17T10:00:00Z' }),
    makeEvent({ entity: 'reservation', restaurantId: 'rest-2', createdAt: '2026-01-18T10:00:00Z' }),
  ];

  it('filters by entity', () => {
    const result = filterEvents(events, { restaurantId: 'rest-1', entity: 'reservation' });
    expect(result).toHaveLength(2);
    result.forEach((e) => expect(e.entity).toBe('reservation'));
  });

  it('filters by date range', () => {
    const result = filterEvents(events, {
      restaurantId: 'rest-1',
      startDate: '2026-01-16T00:00:00Z',
      endDate: '2026-01-17T23:59:59Z',
    });
    expect(result).toHaveLength(2);
  });

  it('applies limit and offset', () => {
    const result = filterEvents(events, { restaurantId: 'rest-1', limit: 1, offset: 1 });
    expect(result).toHaveLength(1);
  });
});
