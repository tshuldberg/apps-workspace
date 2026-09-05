import { describe, it, expect } from 'vitest';
import { classify, priceBucket, timeBucket, type Facet } from '../taxonomy';
import type { NormalizedEvent } from '../../sources/types';

function ev(over: Partial<NormalizedEvent>): NormalizedEvent {
  return { sourceId: 's', title: 'Title', ...over };
}

function valueOf(facets: Facet[], axis: string): string | undefined {
  return facets.find((f) => f.axis === axis)?.value;
}

describe('taxonomy classify', () => {
  it('classifies a jazz jam session as Music + Jam Session', () => {
    const facets = classify(ev({ title: 'Jazz jam session at Blue Note', venueName: 'Blue Note' }));
    expect(valueOf(facets, 'category')).toBe('Music');
    expect(valueOf(facets, 'format')).toBe('Jam Session');
  });

  it('marks a free event as price Free', () => {
    const facets = classify(ev({ title: 'Free Yoga in the Park', isFree: true }));
    expect(valueOf(facets, 'price')).toBe('Free');
  });

  it('marks a same-day event as time Tonight', () => {
    const facets = classify(ev({ title: 'Comedy Cellar', startAt: '2026-07-01T20:00:00' }), '2026-07-01T09:00:00');
    expect(valueOf(facets, 'time')).toBe('Tonight');
  });

  it('marks a future event as Upcoming', () => {
    const facets = classify(ev({ title: 'Comedy Cellar', startAt: '2026-07-05T20:00:00' }), '2026-07-01T09:00:00');
    expect(valueOf(facets, 'time')).toBe('Upcoming');
  });

  it('prefers an explicit category over keyword inference', () => {
    const facets = classify(ev({ title: 'Mystery happening', category: 'Theater' }));
    expect(valueOf(facets, 'category')).toBe('Theater');
  });

  it('passes through pre-supplied facets', () => {
    const facets = classify(ev({ title: 'Show', facets: [{ axis: 'vibe', value: 'Cozy' }] }));
    expect(valueOf(facets, 'vibe')).toBe('Cozy');
  });
});

describe('priceBucket', () => {
  it('buckets prices', () => {
    expect(priceBucket(ev({ isFree: true }))).toBe('Free');
    expect(priceBucket(ev({ priceMin: 0 }))).toBe('Free');
    expect(priceBucket(ev({}))).toBe('Unknown');
    expect(priceBucket(ev({ priceMin: 15 }))).toBe('Under $20');
    expect(priceBucket(ev({ priceMin: 30 }))).toBe('$20-50');
    expect(priceBucket(ev({ priceMin: 75 }))).toBe('$50-100');
    expect(priceBucket(ev({ priceMin: 150 }))).toBe('$100+');
  });
});

describe('timeBucket', () => {
  it('returns Pick a Date when no startAt', () => {
    expect(timeBucket(undefined)).toBe('Pick a Date');
  });
});
