import { describe, it, expect } from 'vitest';
import { canTransition, getAvailableTransitions, isTerminal } from '../lib/reservations/status-machine';
import { generateTimeSlots, getAvailableSlots, calculatePacing } from '../lib/reservations/availability';

describe('status machine', () => {
  it('allows pending -> confirmed', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
  });

  it('allows confirmed -> seated', () => {
    expect(canTransition('confirmed', 'seated')).toBe(true);
  });

  it('allows confirmed -> no_show', () => {
    expect(canTransition('confirmed', 'no_show')).toBe(true);
  });

  it('disallows seated -> pending', () => {
    expect(canTransition('seated', 'pending')).toBe(false);
  });

  it('disallows completed -> anything', () => {
    expect(getAvailableTransitions('completed')).toEqual([]);
  });

  it('identifies terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('no_show')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('confirmed')).toBe(false);
    expect(isTerminal('seated')).toBe(false);
  });
});

describe('availability', () => {
  it('generates 15-min time slots', () => {
    const slots = generateTimeSlots('17:00', '19:00');
    expect(slots).toEqual(['17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45']);
  });

  it('returns available tables for empty restaurant', () => {
    const tables = [
      { id: 't1', capacityMin: 2, capacityMax: 4, areaId: 'a1' },
      { id: 't2', capacityMin: 4, capacityMax: 6, areaId: 'a1' },
    ];
    const slots = getAvailableSlots('2026-05-01', 3, 90, tables, [], '17:00', '22:00');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].availableTables).toContain('t1');
    expect(slots[0].availableTables).toContain('t2');
  });

  it('excludes tables with conflicting reservations', () => {
    const tables = [
      { id: 't1', capacityMin: 2, capacityMax: 4, areaId: 'a1' },
    ];
    const existing = [
      { tableId: 't1', scheduledAt: '2026-05-01T18:00:00.000Z', durationMinutes: 90, status: 'confirmed' },
    ];
    const slots = getAvailableSlots('2026-05-01', 2, 90, tables, existing, '17:00', '22:00');
    const slot18 = slots.find((s) => s.time.includes('18:00'));
    expect(slot18).toBeUndefined();
  });

  it('ignores cancelled reservations', () => {
    const tables = [{ id: 't1', capacityMin: 2, capacityMax: 4, areaId: 'a1' }];
    const existing = [
      { tableId: 't1', scheduledAt: '2026-05-01T18:00:00.000Z', durationMinutes: 90, status: 'cancelled' },
    ];
    const slots = getAvailableSlots('2026-05-01', 2, 90, tables, existing, '17:00', '22:00');
    const slot18 = slots.find((s) => s.time.includes('18:00'));
    expect(slot18).toBeDefined();
  });
});

describe('pacing', () => {
  it('calculates covers per 15-min bucket', () => {
    const reservations = [
      { tableId: 't1', scheduledAt: '2026-05-01T18:00:00.000Z', durationMinutes: 90, status: 'confirmed' },
      { tableId: 't2', scheduledAt: '2026-05-01T18:10:00.000Z', durationMinutes: 90, status: 'confirmed' },
      { tableId: 't3', scheduledAt: '2026-05-01T19:00:00.000Z', durationMinutes: 90, status: 'confirmed' },
    ];
    const pacing = calculatePacing(reservations);
    expect(pacing.get('18:00')).toBe(2);
    expect(pacing.get('19:00')).toBe(1);
  });

  it('skips cancelled reservations', () => {
    const reservations = [
      { tableId: 't1', scheduledAt: '2026-05-01T18:00:00.000Z', durationMinutes: 90, status: 'cancelled' },
    ];
    const pacing = calculatePacing(reservations);
    expect(pacing.size).toBe(0);
  });
});
