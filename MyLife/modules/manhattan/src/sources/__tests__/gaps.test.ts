import { describe, it, expect } from 'vitest';
import { gapAdapters } from '../gaps';
import { SourceGapError, type GapReason } from '../types';

const EXPECTED: Record<string, GapReason> = {
  ticketmaster: 'tos_excluded',
  resident_advisor: 'no_public_api',
  dice: 'no_public_api',
  posh: 'no_public_api',
  partiful: 'no_public_api',
  equinox: 'auth_required',
  mylife_tickets: 'planned_first_party',
};

describe('gap adapters', () => {
  it('defines the seven gap sources, all tier gap', () => {
    expect(gapAdapters).toHaveLength(7);
    for (const a of gapAdapters) {
      expect(a.tier).toBe('gap');
      expect(a.gapFlag).toBeDefined();
    }
    expect(gapAdapters.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const adapter of gapAdapters) {
    it(`${adapter.id} is unavailable and rejects with SourceGapError`, async () => {
      expect(adapter.isAvailable()).toBe(false);
      const reason = EXPECTED[adapter.id];
      expect(adapter.gapFlag?.reason).toBe(reason);
      await expect(adapter.fetchEvents({}, async () => {
        throw new Error('fetch should not be called');
      })).rejects.toBeInstanceOf(SourceGapError);
      let caught: unknown;
      try {
        await adapter.fetchEvents({}, async () => {
          throw new Error('fetch should not be called');
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SourceGapError);
      const err = caught as SourceGapError;
      expect(err.sourceId).toBe(adapter.id);
      expect(err.reason).toBe(reason);
    });
  }
});
