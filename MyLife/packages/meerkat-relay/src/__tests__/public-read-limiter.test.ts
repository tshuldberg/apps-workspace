/**
 * PublicReadLimiter unit tests (Plan 19 P3a FIX 1): prove the open-read limiter
 * bounds memory (periodic sweep + hard key cap) and enforces the per-IP request
 * rate, per-IP byte rate, and per-publication byte ceiling under an injected clock.
 */

import { describe, expect, it } from 'vitest';
import { PublicReadLimiter } from '../public-read-limiter';

describe('PublicReadLimiter: sweep + cap bound memory', () => {
  it('sweeps fully-stale entries so distinct-key spraying cannot grow the Map unbounded', () => {
    let clock = 0;
    const limiter = new PublicReadLimiter({ requestsPerWindow: 5, windowMs: 1000 }, () => clock);
    for (let i = 0; i < 100; i += 1) limiter.admitRequest(`ip-${i}`);
    expect(limiter.trackedClientCount()).toBe(100);

    clock += 1001; // every recorded hit is now older than the window
    limiter.sweep();
    expect(limiter.trackedClientCount()).toBe(0);
  });

  it('caps the tracked-key count at maxTrackedClients (sweep-then-evict-oldest)', () => {
    let clock = 0;
    const limiter = new PublicReadLimiter(
      { requestsPerWindow: 1000, windowMs: 60_000, maxTrackedClients: 10 },
      () => clock,
    );
    for (let i = 0; i < 50; i += 1) { clock += 1; limiter.admitRequest(`ip-${i}`); }
    expect(limiter.trackedClientCount()).toBeLessThanOrEqual(10);
  });

  it('keeps each key budget independent (no cross-key leakage)', () => {
    const limiter = new PublicReadLimiter({ requestsPerWindow: 2, windowMs: 1000 }, () => 0);
    expect(limiter.admitRequest('a')).toBe(true);
    expect(limiter.admitRequest('a')).toBe(true);
    expect(limiter.admitRequest('a')).toBe(false); // 'a' over budget
    expect(limiter.admitRequest('b')).toBe(true);  // 'b' has its own budget
  });

  it('enforces per-IP + per-publication byte ceilings and recovers when the window rolls', () => {
    let clock = 0;
    const limiter = new PublicReadLimiter(
      { bytesPerWindow: 100, perPublicationBytesPerWindow: 150, windowMs: 1000 },
      () => clock,
    );
    expect(limiter.admitBytes('a', 'pub', 100)).toBe(true);  // exactly at the per-IP budget
    expect(limiter.admitBytes('a', 'pub', 1)).toBe(false);   // per-IP exceeded (nothing added)

    // A different IP on the SAME publication: the per-publication ceiling now binds.
    expect(limiter.admitBytes('b', 'pub', 60)).toBe(false);  // 100 + 60 > 150
    expect(limiter.admitBytes('b', 'pub', 50)).toBe(true);   // 100 + 50 == 150, allowed

    clock += 1001; // roll the tumbling window
    expect(limiter.admitBytes('a', 'pub', 100)).toBe(true);  // recovered
  });
});
