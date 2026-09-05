import { describe, it, expect } from 'vitest';
import { dedupe, dedupKey } from '../dedup';
import type { NormalizedEvent } from '../../sources/types';

function ev(over: Partial<NormalizedEvent>): NormalizedEvent {
  return { sourceId: 's', title: 'Title', ...over };
}

describe('dedup engine', () => {
  it('collapses same title/venue/day to one event', () => {
    const events = [
      ev({ title: 'Blue Note Jazz', venueName: 'Blue Note', startAt: '2026-07-01T20:00:00' }),
      ev({ title: 'blue NOTE jazz!', venueName: 'Blue Note', startAt: '2026-07-01T22:00:00' }),
    ];
    const result = dedupe(events);
    expect(result).toHaveLength(1);
    expect(result[0]?.startAt).toBe('2026-07-01T20:00:00');
  });

  it('keeps events on different days', () => {
    const events = [
      ev({ title: 'Blue Note Jazz', venueName: 'Blue Note', startAt: '2026-07-01T20:00:00' }),
      ev({ title: 'Blue Note Jazz', venueName: 'Blue Note', startAt: '2026-07-02T20:00:00' }),
    ];
    expect(dedupe(events)).toHaveLength(2);
  });

  it('keeps events at different venues', () => {
    const events = [
      ev({ title: 'Jazz Night', venueName: 'Blue Note', startAt: '2026-07-01T20:00:00' }),
      ev({ title: 'Jazz Night', venueName: 'Village Vanguard', startAt: '2026-07-01T20:00:00' }),
    ];
    expect(dedupe(events)).toHaveLength(2);
  });

  it('normalizes punctuation and case in the key', () => {
    expect(dedupKey({ title: 'Blue-Note Jazz!', venueName: 'Blue Note', startAt: '2026-07-01T20:00:00' }))
      .toBe(dedupKey({ title: 'blue note JAZZ', venueName: 'bluenote', startAt: '2026-07-01T09:00:00' }));
  });

  it('handles missing venue and startAt', () => {
    const events = [ev({ title: 'Mystery Show' }), ev({ title: 'Mystery Show' })];
    expect(dedupe(events)).toHaveLength(1);
  });
});
