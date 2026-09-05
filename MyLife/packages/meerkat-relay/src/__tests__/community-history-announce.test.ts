/**
 * WP-43G private community-history-host announce loop -- pure planner + seal
 * builder tests.
 *
 * Proves: only a hosted community with a CURRENT descriptor and a serveable
 * snapshot is due; refresh fires before TTL expiry; the batch is bounded;
 * jitter de-synchronizes a fleet deterministically (mirrors
 * archive-announcement-scheduler.test.ts). Also proves the seal builder refuses
 * (returns null) on a missing descriptor, a non-serveable snapshot, and a
 * non-https base url, and that a built announcement opens back to the exact
 * record it describes and carries only the opaque {rid, sealedRecord} shape.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSealedHistoryAnnouncement,
  historyAnnounceIsDue,
  planHistoryAnnouncements,
  type HistoryAnnounceCandidate,
} from '../community-history-announce';
import { openCommunityHistoryHost } from '@mylife/sync';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');
const SECRET = 'ab'.repeat(16);

function candidate(over: Partial<HistoryAnnounceCandidate> = {}): HistoryAnnounceCandidate {
  return {
    communityId: 'community-1',
    communitySecret: SECRET,
    descriptorRevision: 3,
    descriptorCurrent: true,
    snapshotServeable: true,
    lastAnnouncedAt: null,
    ...over,
  };
}

describe('historyAnnounceIsDue', () => {
  const window = { ttlMs: 60_000, refreshLeadMs: 10_000, nowMs: NOW };

  it('is due for a never-announced community with a current descriptor + serveable snapshot', () => {
    expect(historyAnnounceIsDue(candidate({ lastAnnouncedAt: null }), window)).toBe(true);
  });

  it('is NOT due when the descriptor is not current', () => {
    expect(historyAnnounceIsDue(candidate({ descriptorCurrent: false }), window)).toBe(false);
  });

  it('is NOT due when no snapshot is serveable', () => {
    expect(historyAnnounceIsDue(candidate({ snapshotServeable: false }), window)).toBe(false);
  });

  it('is due only once now crosses ttl minus the refresh lead', () => {
    const announcedAt = new Date(NOW - 45_000).toISOString(); // 45s ago, ttl 60s, lead 10s => due at 50s
    expect(historyAnnounceIsDue(candidate({ lastAnnouncedAt: announcedAt }), window)).toBe(false);
    const later = { ...window, nowMs: NOW + 6_000 };
    expect(historyAnnounceIsDue(candidate({ lastAnnouncedAt: announcedAt }), later)).toBe(true);
  });
});

describe('planHistoryAnnouncements', () => {
  const base = {
    ttlMs: 60_000, refreshLeadMs: 10_000, maxPerTick: 100,
    jitterWindowMs: 0, jitterSeed: 'node-1', nowMs: NOW,
  };

  it('announces only announceable-and-due communities and skips the rest', () => {
    const plan = planHistoryAnnouncements({
      ...base,
      candidates: [
        candidate({ communityId: 'a' }),
        candidate({ communityId: 'b', descriptorCurrent: false }),
        candidate({ communityId: 'c', snapshotServeable: false }),
      ],
    });
    expect(plan.actions.map((a) => a.communityId)).toEqual(['a']);
    expect(plan.skippedNotAnnounceable).toBe(2);
  });

  it('bounds the batch to maxPerTick and defers the rest', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => candidate({ communityId: `c-${i}` }));
    const plan = planHistoryAnnouncements({ ...base, maxPerTick: 2, candidates });
    expect(plan.actions).toHaveLength(2);
    expect(plan.deferred).toBe(3);
  });

  it('applies deterministic per-community jitter within the window, bounded per tick', () => {
    const candidates = Array.from({ length: 50 }, (_, i) => candidate({ communityId: `c-${i}` }));
    const withJitter = planHistoryAnnouncements({ ...base, jitterWindowMs: 30_000, maxPerTick: 50, candidates });
    const again = planHistoryAnnouncements({ ...base, jitterWindowMs: 30_000, maxPerTick: 50, candidates });
    expect(withJitter.actions).toHaveLength(50);
    for (let i = 0; i < withJitter.actions.length; i += 1) {
      expect(again.actions[i]!.fireAtMs).toBe(withJitter.actions[i]!.fireAtMs);
      expect(withJitter.actions[i]!.fireAtMs).toBeGreaterThanOrEqual(NOW);
      expect(withJitter.actions[i]!.fireAtMs).toBeLessThan(NOW + 30_000);
    }
  });

  it('orders most-urgent (oldest lastAnnouncedAt) first', () => {
    const plan = planHistoryAnnouncements({
      ...base,
      maxPerTick: 2,
      candidates: [
        candidate({ communityId: 'recent', lastAnnouncedAt: new Date(NOW - 51_000).toISOString() }),
        candidate({ communityId: 'never', lastAnnouncedAt: null }),
        candidate({ communityId: 'oldest', lastAnnouncedAt: new Date(NOW - 59_000).toISOString() }),
      ],
    });
    expect(plan.actions.map((a) => a.communityId)).toEqual(['never', 'oldest']);
    expect(plan.deferred).toBe(1);
  });
});

describe('buildSealedHistoryAnnouncement', () => {
  const base = {
    communityId: 'community-1',
    communitySecret: SECRET,
    descriptorCurrent: true,
    descriptorRevision: 3,
    snapshotServeable: true,
    publicBaseUrl: 'https://node.example',
    maxObjectBytes: 8 * 1024 * 1024,
    ttlMs: 60_000,
    nowMs: NOW,
  };

  it('refuses when the descriptor is not current', () => {
    expect(buildSealedHistoryAnnouncement({ ...base, descriptorCurrent: false })).toBeNull();
  });

  it('refuses when no snapshot is serveable', () => {
    expect(buildSealedHistoryAnnouncement({ ...base, snapshotServeable: false })).toBeNull();
  });

  it('refuses a non-https base url (plaintext http and non-url both)', () => {
    expect(buildSealedHistoryAnnouncement({ ...base, publicBaseUrl: 'http://node.example' })).toBeNull();
    expect(buildSealedHistoryAnnouncement({ ...base, publicBaseUrl: 'not-a-url' })).toBeNull();
  });

  it('builds a rid + sealed record that opens back to the exact record', () => {
    const sealed = buildSealedHistoryAnnouncement(base);
    expect(sealed).not.toBeNull();
    expect(sealed!.rid).toMatch(/^[0-9a-f]{64}$/);
    const opened = openCommunityHistoryHost(SECRET, sealed!.sealedRecord);
    expect(opened).toEqual({
      communityId: 'community-1',
      hostUrl: 'https://node.example',
      descriptorRevision: 3,
      snapshotVersion: 1,
      maxObjectBytes: 8 * 1024 * 1024,
      expiresAt: new Date(NOW + 60_000).toISOString(),
    });
  });

  it('the sealed shape carries ONLY {rid, sealedRecord}: no field named like community/descriptor/member/device', () => {
    const sealed = buildSealedHistoryAnnouncement(base)!;
    const keys = Object.keys(sealed);
    expect(keys.sort()).toEqual(['rid', 'sealedRecord']);
    for (const key of keys) {
      expect(key.toLowerCase()).not.toMatch(/community|descriptor|member|device/);
    }
    // Neither wire value contains the plaintext community id or secret.
    expect(sealed.rid).not.toContain('community-1');
    expect(sealed.sealedRecord).not.toContain('community-1');
    expect(sealed.sealedRecord).not.toContain(SECRET);
  });

  it('opens null for a wrong secret (fail-closed)', () => {
    const sealed = buildSealedHistoryAnnouncement(base)!;
    expect(openCommunityHistoryHost('cd'.repeat(16), sealed.sealedRecord)).toBeNull();
  });
});
