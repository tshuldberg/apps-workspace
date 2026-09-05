import { describe, it, expect } from 'vitest';
import { isWithinSendWindow, getNextSendWindow } from '../src/tcpa';

describe('TCPA send window', () => {
  describe('isWithinSendWindow', () => {
    it('returns true at 12pm Eastern', () => {
      // 12:00 PM Eastern = 4:00 PM UTC (during EDT)
      const noon = new Date('2026-04-20T16:00:00.000Z');
      expect(isWithinSendWindow('America/New_York', undefined, noon)).toBe(true);
    });

    it('returns true at 8am exactly', () => {
      // 8:00 AM Eastern = 12:00 PM UTC (during EDT)
      const eightAm = new Date('2026-04-20T12:00:00.000Z');
      expect(isWithinSendWindow('America/New_York', undefined, eightAm)).toBe(true);
    });

    it('returns false at 7:59am', () => {
      // 7:59 AM Eastern = 11:59 AM UTC (during EDT)
      const beforeWindow = new Date('2026-04-20T11:59:00.000Z');
      expect(isWithinSendWindow('America/New_York', undefined, beforeWindow)).toBe(false);
    });

    it('returns false at 9pm exactly', () => {
      // 9:00 PM Eastern = 1:00 AM UTC next day (during EDT)
      const ninePm = new Date('2026-04-21T01:00:00.000Z');
      expect(isWithinSendWindow('America/New_York', undefined, ninePm)).toBe(false);
    });

    it('returns true at 8:59pm for non-FL states', () => {
      // 8:59 PM Eastern = 12:59 AM UTC next day (during EDT)
      const eightFiftyNine = new Date('2026-04-21T00:59:00.000Z');
      expect(isWithinSendWindow('America/New_York', 'NY', eightFiftyNine)).toBe(true);
    });

    // Florida exception: window closes at 8pm
    it('returns false at 8pm in Florida', () => {
      // 8:00 PM Eastern = 12:00 AM UTC next day (during EDT)
      const eightPm = new Date('2026-04-21T00:00:00.000Z');
      expect(isWithinSendWindow('America/New_York', 'FL', eightPm)).toBe(false);
    });

    it('returns true at 7:59pm in Florida', () => {
      // 7:59 PM Eastern = 11:59 PM UTC (during EDT)
      const sevenFiftyNine = new Date('2026-04-20T23:59:00.000Z');
      expect(isWithinSendWindow('America/New_York', 'FL', sevenFiftyNine)).toBe(true);
    });

    it('handles Florida with full state name', () => {
      const eightPm = new Date('2026-04-21T00:00:00.000Z');
      expect(isWithinSendWindow('America/New_York', 'Florida', eightPm)).toBe(false);
    });

    // Pacific timezone
    it('works with Pacific timezone', () => {
      // 10:00 AM Pacific = 5:00 PM UTC (during PDT)
      const tenAmPacific = new Date('2026-04-20T17:00:00.000Z');
      expect(isWithinSendWindow('America/Los_Angeles', undefined, tenAmPacific)).toBe(true);
    });

    it('returns false at 5am Pacific', () => {
      // 5:00 AM Pacific = 12:00 PM UTC (during PDT)
      const fiveAmPacific = new Date('2026-04-20T12:00:00.000Z');
      expect(isWithinSendWindow('America/Los_Angeles', undefined, fiveAmPacific)).toBe(false);
    });

    // Central timezone
    it('works with Central timezone at boundary', () => {
      // 8:00 PM Central = 1:00 AM UTC next day (during CDT)
      const eightPmCentral = new Date('2026-04-21T01:00:00.000Z');
      expect(isWithinSendWindow('America/Chicago', undefined, eightPmCentral)).toBe(true);
    });
  });

  describe('getNextSendWindow', () => {
    it('returns current time if window is open', () => {
      const noon = new Date('2026-04-20T16:00:00.000Z');
      const result = getNextSendWindow('America/New_York', undefined, noon);
      expect(result.getTime()).toBe(noon.getTime());
    });

    it('returns next morning if past window', () => {
      // 10:00 PM Eastern = 2:00 AM UTC next day (during EDT)
      const tenPm = new Date('2026-04-21T02:00:00.000Z');
      const result = getNextSendWindow('America/New_York', undefined, tenPm);
      // Should be some time after the provided date (next morning)
      expect(result.getTime()).toBeGreaterThan(tenPm.getTime());
      // Verify the result is within the send window
      expect(isWithinSendWindow('America/New_York', undefined, result)).toBe(true);
    });

    it('returns later today if before window', () => {
      // 6:00 AM Eastern = 10:00 AM UTC (during EDT)
      const sixAm = new Date('2026-04-20T10:00:00.000Z');
      const result = getNextSendWindow('America/New_York', undefined, sixAm);
      expect(result.getTime()).toBeGreaterThan(sixAm.getTime());
      expect(isWithinSendWindow('America/New_York', undefined, result)).toBe(true);
    });

    it('respects Florida exception', () => {
      // 8:30 PM Eastern = 12:30 AM UTC next day (during EDT)
      const eightThirtyPm = new Date('2026-04-21T00:30:00.000Z');
      const result = getNextSendWindow('America/New_York', 'FL', eightThirtyPm);
      expect(result.getTime()).toBeGreaterThan(eightThirtyPm.getTime());
      expect(isWithinSendWindow('America/New_York', 'FL', result)).toBe(true);
    });
  });
});
