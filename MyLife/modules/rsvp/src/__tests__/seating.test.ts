import { describe, expect, it } from 'vitest';
import { validateAssignment, calculateRemainingCapacity, autoAssign, getUnassignedGuests, generateSeatingText } from '../engines/seating';
import type { SeatAssignment } from '../types';

const noAssignments: SeatAssignment[] = [];

describe('seating engine', () => {
  describe('validateAssignment', () => {
    it('accepts assignment when table has capacity', () => {
      expect(validateAssignment(8, 3, 'Alice', noAssignments)).toBeNull();
    });

    it('rejects when table is full', () => {
      expect(validateAssignment(8, 8, 'Alice', noAssignments)).toBe('Table is full');
    });

    it('rejects duplicate guest at another table', () => {
      const existing: SeatAssignment[] = [
        { id: '1', tableId: 't1', eventId: 'e1', rsvpId: null, guestName: 'Alice', seatNumber: null, notes: null, createdAt: '' },
      ];
      const result = validateAssignment(8, 0, 'Alice', existing);
      expect(result).toContain('already assigned');
    });
  });

  describe('calculateRemainingCapacity', () => {
    it('returns capacity minus assigned', () => {
      expect(calculateRemainingCapacity(8, 3)).toBe(5);
    });

    it('returns 0 when full', () => {
      expect(calculateRemainingCapacity(8, 8)).toBe(0);
    });

    it('returns 0 when over capacity', () => {
      expect(calculateRemainingCapacity(8, 10)).toBe(0);
    });
  });

  describe('autoAssign', () => {
    const tables = [
      { id: 't1', capacity: 4, sortOrder: 0 },
      { id: 't2', capacity: 4, sortOrder: 1 },
    ];

    it('assigns all guests when enough seats', () => {
      const counts = new Map<string, number>();
      const result = autoAssign(tables, counts, ['Alice', 'Bob', 'Carol']);
      expect(result.assigned).toHaveLength(3);
      expect(result.unassigned).toHaveLength(0);
    });

    it('assigns as many as possible, returns overflow', () => {
      const counts = new Map<string, number>();
      const guests = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const result = autoAssign(tables, counts, guests);
      expect(result.assigned).toHaveLength(8);
      expect(result.unassigned).toHaveLength(2);
    });

    it('does not overwrite existing (respects assigned counts)', () => {
      const counts = new Map([['t1', 3]]); // 3 already at t1
      const result = autoAssign(tables, counts, ['Alice', 'Bob', 'Carol']);
      // t1 has 1 remaining, t2 has 4 remaining = 5 total
      expect(result.assigned).toHaveLength(3);
      const t1Assigned = result.assigned.filter((a) => a.tableId === 't1');
      expect(t1Assigned).toHaveLength(1); // only 1 fits at t1
    });

    it('fills tables in sort order', () => {
      const counts = new Map<string, number>();
      const result = autoAssign(tables, counts, ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
      const t1 = result.assigned.filter((a) => a.tableId === 't1');
      const t2 = result.assigned.filter((a) => a.tableId === 't2');
      expect(t1).toHaveLength(4); // fills t1 first
      expect(t2).toHaveLength(1);
    });
  });

  describe('getUnassignedGuests', () => {
    it('returns going guests not in any assignment', () => {
      const going = ['Alice', 'Bob', 'Carol'];
      const assigned = new Set(['Alice']);
      expect(getUnassignedGuests(going, assigned)).toEqual(['Bob', 'Carol']);
    });

    it('returns all guests when none assigned', () => {
      expect(getUnassignedGuests(['Alice', 'Bob'], new Set())).toEqual(['Alice', 'Bob']);
    });
  });

  describe('generateSeatingText', () => {
    it('formats tables with guest names', () => {
      const text = generateSeatingText([
        { label: 'Table 1', guests: ['Alice', 'Bob'] },
        { label: 'Table 2', guests: ['Carol'] },
      ]);
      expect(text).toBe('Table 1: Alice, Bob\nTable 2: Carol');
    });

    it('handles empty tables', () => {
      const text = generateSeatingText([
        { label: 'Table 1', guests: [] },
      ]);
      expect(text).toBe('Table 1: (empty)');
    });
  });
});
