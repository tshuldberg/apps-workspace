import { describe, it, expect } from 'vitest';
import { estimateWait, recalculatePositions } from '../lib/waitlist/quote';
import { shouldAutoRelease, getWalkAwayReasons, isValidTransition } from '../lib/waitlist/lifecycle';
import type { WaitlistEntry } from '../lib/waitlist/types';

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: crypto.randomUUID(),
    restaurantId: 'r1',
    dinerName: 'Test Guest',
    phone: null,
    partySize: 2,
    dietaryNotes: null,
    joinedAt: new Date().toISOString(),
    estimatedWaitMin: null,
    position: null,
    status: 'waiting',
    readyPingedAt: null,
    walkedAwayReason: null,
    smsConsent: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('waitlist quote', () => {
  describe('estimateWait', () => {
    it('returns min as base wait and max with 20% buffer', () => {
      const result = estimateWait(3, 10);
      expect(result.min).toBe(30);
      expect(result.max).toBe(36); // 30 * 1.2 = 36
    });

    it('returns 0 for position 0', () => {
      const result = estimateWait(0, 10);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
    });

    it('rounds up the max', () => {
      const result = estimateWait(1, 7);
      expect(result.min).toBe(7);
      expect(result.max).toBe(9); // ceil(7 * 1.2) = ceil(8.4) = 9
    });

    it('handles large parties correctly', () => {
      const result = estimateWait(5, 15);
      expect(result.min).toBe(75);
      expect(result.max).toBe(90); // ceil(75 * 1.2) = 90
    });
  });

  describe('recalculatePositions', () => {
    it('assigns sequential positions to waiting entries', () => {
      const entries = [
        makeEntry({ id: '1', status: 'waiting' }),
        makeEntry({ id: '2', status: 'waiting' }),
        makeEntry({ id: '3', status: 'waiting' }),
      ];

      const result = recalculatePositions(entries);
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(2);
      expect(result[2].position).toBe(3);
    });

    it('skips non-waiting entries and sets their position to null', () => {
      const entries = [
        makeEntry({ id: '1', status: 'seated' }),
        makeEntry({ id: '2', status: 'waiting' }),
        makeEntry({ id: '3', status: 'walked_away' }),
        makeEntry({ id: '4', status: 'waiting' }),
      ];

      const result = recalculatePositions(entries);
      expect(result[0].position).toBeNull();
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBeNull();
      expect(result[3].position).toBe(2);
    });

    it('handles empty array', () => {
      const result = recalculatePositions([]);
      expect(result).toEqual([]);
    });

    it('recalculates after removal', () => {
      const entries = [
        makeEntry({ id: '1', status: 'waiting' }),
        makeEntry({ id: '2', status: 'waiting' }),
        makeEntry({ id: '3', status: 'waiting' }),
      ];

      // Simulate removing entry 2 (it was seated)
      const afterSeat = entries.map((e) =>
        e.id === '2' ? { ...e, status: 'seated' as const } : e
      );

      const result = recalculatePositions(afterSeat);
      expect(result[0].position).toBe(1); // entry 1 stays at 1
      expect(result[1].position).toBeNull(); // entry 2 is seated
      expect(result[2].position).toBe(2); // entry 3 moves up to 2
    });
  });
});

describe('waitlist lifecycle', () => {
  describe('shouldAutoRelease', () => {
    it('returns false if within timeout', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(shouldAutoRelease(fiveMinAgo, 10)).toBe(false);
    });

    it('returns true if past timeout', () => {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      expect(shouldAutoRelease(fifteenMinAgo, 10)).toBe(true);
    });

    it('returns true exactly at timeout boundary', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(shouldAutoRelease(tenMinAgo, 10)).toBe(true);
    });

    it('uses default 10 minute timeout', () => {
      const nineMinAgo = new Date(Date.now() - 9 * 60 * 1000);
      expect(shouldAutoRelease(nineMinAgo)).toBe(false);

      const elevenMinAgo = new Date(Date.now() - 11 * 60 * 1000);
      expect(shouldAutoRelease(elevenMinAgo)).toBe(true);
    });
  });

  describe('getWalkAwayReasons', () => {
    it('returns expected reasons', () => {
      const reasons = getWalkAwayReasons();
      expect(reasons).toContain('Left voluntarily');
      expect(reasons).toContain('No response');
      expect(reasons).toContain('Seated elsewhere');
      expect(reasons).toHaveLength(3);
    });
  });

  describe('isValidTransition', () => {
    it('allows waiting -> ready', () => {
      expect(isValidTransition('waiting', 'ready')).toBe(true);
    });

    it('allows waiting -> seated', () => {
      expect(isValidTransition('waiting', 'seated')).toBe(true);
    });

    it('allows waiting -> walked_away', () => {
      expect(isValidTransition('waiting', 'walked_away')).toBe(true);
    });

    it('allows ready -> seated', () => {
      expect(isValidTransition('ready', 'seated')).toBe(true);
    });

    it('allows ready -> walked_away', () => {
      expect(isValidTransition('ready', 'walked_away')).toBe(true);
    });

    it('allows ready -> waiting (re-queue)', () => {
      expect(isValidTransition('ready', 'waiting')).toBe(true);
    });

    it('disallows seated -> waiting', () => {
      expect(isValidTransition('seated', 'waiting')).toBe(false);
    });

    it('disallows walked_away -> ready', () => {
      expect(isValidTransition('walked_away', 'ready')).toBe(false);
    });
  });
});
