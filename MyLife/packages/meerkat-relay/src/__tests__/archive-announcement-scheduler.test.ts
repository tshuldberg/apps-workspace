/**
 * WP-43B announcement refresh scheduler tests (pure core).
 *
 * Proves the plan's announcement rules: only active+serveable+current-descriptor pins are
 * announced; refresh fires before TTL expiry; the batch is bounded; jitter de-synchronizes a fleet
 * deterministically.
 */

import { describe, expect, it } from 'vitest';
import {
  announcementIsDue,
  planAnnouncements,
  type AnnouncementCandidate,
} from '../archive-announcement-scheduler';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');

function candidate(over: Partial<AnnouncementCandidate> = {}): AnnouncementCandidate {
  return {
    publicationId: 'pub-1',
    contentId: 'content-1',
    hostId: 'host-1',
    pinState: 'active',
    jobStatus: 'pinned',
    lastAnnouncedAt: null,
    descriptorCurrent: true,
    ...over,
  };
}

describe('announcementIsDue', () => {
  const window = { ttlMs: 60_000, refreshLeadMs: 10_000, nowMs: NOW };

  it('is due for a never-announced active serveable pin with a current descriptor', () => {
    expect(announcementIsDue(candidate({ lastAnnouncedAt: null }), window)).toBe(true);
  });

  it('is NOT due for a non-active pin', () => {
    expect(announcementIsDue(candidate({ pinState: 'removing' }), window)).toBe(false);
    expect(announcementIsDue(candidate({ pinState: 'removed' }), window)).toBe(false);
  });

  it('is NOT due for a non-serveable job status', () => {
    expect(announcementIsDue(candidate({ jobStatus: 'approved' }), window)).toBe(false);
  });

  it('is NOT due when the descriptor is not current', () => {
    expect(announcementIsDue(candidate({ descriptorCurrent: false }), window)).toBe(false);
  });

  it('is due only once now crosses ttl minus the refresh lead', () => {
    const announcedAt = new Date(NOW - 45_000).toISOString(); // 45s ago, ttl 60s, lead 10s => due at 50s
    expect(announcementIsDue(candidate({ lastAnnouncedAt: announcedAt }), window)).toBe(false);
    const later = { ...window, nowMs: NOW + 6_000 }; // now 51s after announce => due
    expect(announcementIsDue(candidate({ lastAnnouncedAt: announcedAt }), later)).toBe(true);
  });
});

describe('planAnnouncements', () => {
  const base = {
    ttlMs: 60_000, refreshLeadMs: 10_000, maxPerTick: 100,
    jitterWindowMs: 0, jitterSeed: 'host-1', nowMs: NOW,
  };

  it('announces only announceable-and-due pins and skips the rest', () => {
    const plan = planAnnouncements({
      ...base,
      candidates: [
        candidate({ publicationId: 'a' }),
        candidate({ publicationId: 'b', pinState: 'removing' }),
        candidate({ publicationId: 'c', descriptorCurrent: false }),
        candidate({ publicationId: 'd', jobStatus: 'announced' }), // still active+serveable => due
      ],
    });
    expect(plan.actions.map((a) => a.publicationId).sort()).toEqual(['a', 'd']);
    expect(plan.skippedNotAnnounceable).toBe(2);
  });

  it('bounds the batch to maxPerTick and defers the rest', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      candidate({ publicationId: `pub-${i}` }));
    const plan = planAnnouncements({ ...base, maxPerTick: 2, candidates });
    expect(plan.actions).toHaveLength(2);
    expect(plan.deferred).toBe(3);
  });

  it('applies deterministic per-pin jitter within the window', () => {
    const candidates = [candidate({ publicationId: 'jittered' })];
    const withJitter = planAnnouncements({ ...base, jitterWindowMs: 30_000, candidates });
    const again = planAnnouncements({ ...base, jitterWindowMs: 30_000, candidates });
    const fire = withJitter.actions[0]!.fireAtMs;
    // Deterministic: same seed + key => same fire time on replay.
    expect(again.actions[0]!.fireAtMs).toBe(fire);
    // Within the jitter window.
    expect(fire).toBeGreaterThanOrEqual(NOW);
    expect(fire).toBeLessThan(NOW + 30_000);
  });

  it('orders most-urgent (oldest lastAnnouncedAt) first', () => {
    const plan = planAnnouncements({
      ...base,
      maxPerTick: 2,
      candidates: [
        candidate({ publicationId: 'recent', lastAnnouncedAt: new Date(NOW - 51_000).toISOString() }),
        candidate({ publicationId: 'never', lastAnnouncedAt: null }),
        candidate({ publicationId: 'oldest', lastAnnouncedAt: new Date(NOW - 59_000).toISOString() }),
      ],
    });
    // never-announced first, then oldest announced; the more-recent one is deferred.
    expect(plan.actions.map((a) => a.publicationId)).toEqual(['never', 'oldest']);
    expect(plan.deferred).toBe(1);
  });
});
