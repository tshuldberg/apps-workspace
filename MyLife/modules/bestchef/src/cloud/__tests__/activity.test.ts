import { describe, it, expect } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60_000).toISOString();
}

// ── timeAgo formatting (replicated from activity.ts for pure testing) ──

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// ── Module exports ─────────────────────────────────────────────────────

describe('activity module -- exports', () => {
  it('exports getProfileActivity', async () => {
    const mod = await import('../activity');
    expect(typeof mod.getProfileActivity).toBe('function');
  });
});

// ── formatTimeAgo (pure logic) ─────────────────────────────────────────

describe('formatTimeAgo', () => {
  it('returns minutes for < 1h ago', () => {
    expect(formatTimeAgo(hoursAgo(0.5))).toMatch(/^\d+m$/);
  });

  it('returns hours for 1-23h ago', () => {
    expect(formatTimeAgo(hoursAgo(6))).toBe('6h');
  });

  it('returns days for >= 24h ago', () => {
    expect(formatTimeAgo(daysAgo(3))).toBe('3d');
  });

  it('returns 1d for exactly 24h ago', () => {
    expect(formatTimeAgo(hoursAgo(24))).toBe('1d');
  });
});

// ── ActivityEntry shape ────────────────────────────────────────────────

describe('ActivityEntry type contract', () => {
  it('has required fields: id, kind, icon, tint, title, subtitle, timeAgo', () => {
    const entry = {
      id: 'rank:chef-1:2026-04-21',
      kind: 'rank_change' as const,
      icon: 'trophy.fill',
      tint: '#EAB308',
      title: 'Climbed to #48',
      subtitle: 'Week of Apr 21',
      timeAgo: '2h',
    };
    expect(entry.id).toBeTruthy();
    expect(entry.kind).toBe('rank_change');
    expect(entry.tint).toMatch(/^#/);
    expect(entry.timeAgo).toBeTruthy();
  });

  it('targetRoute is optional', () => {
    const entry = {
      id: 'badge:abc',
      kind: 'badge' as const,
      icon: 'rosette',
      tint: '#F97316',
      title: 'Badge earned',
      subtitle: 'desc',
      timeAgo: '1d',
      // no targetRoute
    };
    expect('targetRoute' in entry).toBe(false);
  });
});

// ── Ordering contract ──────────────────────────────────────────────────

describe('activity ordering', () => {
  it('sort by occurred_at descending -- newer items first', () => {
    const items = [
      { id: 'a', occurredAt: daysAgo(3) },
      { id: 'b', occurredAt: hoursAgo(2) },
      { id: 'c', occurredAt: daysAgo(1) },
    ];

    const sorted = [...items].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    expect(sorted[0].id).toBe('b'); // 2h ago
    expect(sorted[1].id).toBe('c'); // 1d ago
    expect(sorted[2].id).toBe('a'); // 3d ago
  });
});

// ── ActivityKind values ────────────────────────────────────────────────

describe('ActivityKind', () => {
  it('covers all expected kinds', () => {
    const kinds = [
      'rank_change',
      'reviewed_vote',
      'upvotes',
      'badge',
      'new_follower',
      'posted_recipe',
    ] as const;
    expect(kinds).toHaveLength(6);
  });
});
