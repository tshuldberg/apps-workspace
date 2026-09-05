import { describe, it, expect } from 'vitest';
import { createAuditEvent, diffValues, formatAction } from '../src/capture';

describe('createAuditEvent', () => {
  it('sets id and createdAt', () => {
    const event = createAuditEvent({
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      action: 'reservation.created',
      entity: 'reservation',
      entityId: 'res-1',
    });
    expect(event.id).toBeDefined();
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.createdAt).toBeDefined();
    expect(new Date(event.createdAt).getTime()).not.toBeNaN();
  });

  it('defaults optional fields to null', () => {
    const event = createAuditEvent({
      restaurantId: 'rest-1',
      actorUserId: null,
      action: 'reservation.created',
      entity: 'reservation',
      entityId: 'res-1',
    });
    expect(event.oldValue).toBeNull();
    expect(event.newValue).toBeNull();
    expect(event.ip).toBeNull();
    expect(event.userAgent).toBeNull();
  });
});

describe('diffValues', () => {
  it('captures only changed fields', () => {
    const old = { name: 'Alice', email: 'a@b.com', age: 30 };
    const updated = { name: 'Alice', email: 'new@b.com', age: 31 };
    const { oldValue, newValue } = diffValues(old, updated);
    expect(oldValue).toEqual({ email: 'a@b.com', age: 30 });
    expect(newValue).toEqual({ email: 'new@b.com', age: 31 });
  });

  it('with no changes returns empty objects', () => {
    const obj = { name: 'Alice', age: 30 };
    const { oldValue, newValue } = diffValues(obj, obj);
    expect(oldValue).toEqual({});
    expect(newValue).toEqual({});
  });
});

describe('formatAction', () => {
  it('joins entity and verb with dot', () => {
    expect(formatAction('reservation', 'created')).toBe('reservation.created');
  });
});
