import { describe, it, expect } from 'vitest';
import { isExpired, getExpiredEvents } from '../src/retention';
import type { AuditEvent } from '../src/types';

function makeEvent(createdAt: string): AuditEvent {
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
    createdAt,
  };
}

describe('isExpired', () => {
  it('returns true for old events', () => {
    const oldEvent = makeEvent('2015-01-01T00:00:00Z');
    expect(isExpired(oldEvent, 30)).toBe(true);
  });

  it('returns false for recent events', () => {
    const recentEvent = makeEvent(new Date().toISOString());
    expect(isExpired(recentEvent, 30)).toBe(false);
  });
});

describe('getExpiredEvents', () => {
  it('filters correctly', () => {
    const events = [
      makeEvent('2015-01-01T00:00:00Z'),
      makeEvent(new Date().toISOString()),
      makeEvent('2010-06-15T00:00:00Z'),
    ];
    const expired = getExpiredEvents(events, 30);
    expect(expired).toHaveLength(2);
  });
});
