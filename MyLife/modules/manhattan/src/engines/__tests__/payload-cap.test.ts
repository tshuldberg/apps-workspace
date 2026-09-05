import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '../../sources/types';
import { capCachePayload, MAX_CACHE_EVENTS, MAX_CACHE_PAYLOAD_BYTES } from '../discovery-cache';

function event(i: number, padBytes = 0): NormalizedEvent {
  return {
    sourceId: 'nyc_open_data',
    externalId: `e${i}`,
    title: `Event ${i}`,
    description: padBytes > 0 ? 'x'.repeat(padBytes) : undefined,
  };
}

describe('capCachePayload', () => {
  it('passes small payloads through untouched', () => {
    const events = [event(1), event(2)];
    expect(capCachePayload(events)).toEqual(events);
  });

  it('caps the event count', () => {
    const events = Array.from({ length: MAX_CACHE_EVENTS + 50 }, (_, i) => event(i));
    expect(capCachePayload(events)).toHaveLength(MAX_CACHE_EVENTS);
  });

  it('shrinks the list until the serialized payload fits the byte budget', () => {
    const events = Array.from({ length: 40 }, (_, i) => event(i, 32 * 1024));
    const capped = capCachePayload(events);
    expect(capped.length).toBeLessThan(40);
    expect(capped.length).toBeGreaterThan(0);
    expect(JSON.stringify(capped).length).toBeLessThanOrEqual(MAX_CACHE_PAYLOAD_BYTES);
  });
});
