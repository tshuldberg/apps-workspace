/**
 * Notifications module tests.
 *
 * All Supabase calls are mocked -- no live DB required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  getNotificationFeed,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  removeNotification,
  subscribeNotificationFeed,
  kindToCategory,
  buildTargetRoute,
  buildTimeAgo,
} from '../notifications';
import type { NotificationViewModel } from '../notifications';
import type { NotificationKind } from '../types';

// ── Mock getBestChefClient ────────────────────────────────────────────

vi.mock('../client', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockChannel = vi.fn();

  return {
    getBestChefClient: () => ({
      from: mockFrom,
      rpc: mockRpc,
      channel: mockChannel,
      removeChannel: vi.fn(),
    }),
    ok: <T>(data: T) => ({ ok: true as const, data }),
    err: (error: string) => ({ ok: false as const, error }),
  };
});

import { getBestChefClient } from '../client';

// ── Helper: build a raw notification row ─────────────────────────────

function makeRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    kind: 'upvote',
    category: 'votes',
    title: 'Alice upvoted your recipe',
    body: 'Pad Thai',
    actor_user_id: 'actor-1',
    actor_name: 'Alice',
    actor_color: '#22C55E',
    target_type: 'submission',
    target_id: 'sub-1',
    is_read: false,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    ...overrides,
  };
}

function buildFromChain(returnData: unknown[] = [], count: number | null = null) {
  // The chain needs to be thenable (awaitable) while also supporting fluent methods.
  const resolvedPromise = Promise.resolve({ data: returnData, error: null, count });

  // Create a proxy that returns itself for all property access (fluent builder)
  // but also forwards then/catch/finally to the underlying promise.
  const chain = new Proxy(resolvedPromise, {
    get(target, prop: string) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        const fn = (target as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>)[prop];
        return fn?.bind(target);
      }
      // All other calls (eq, order, limit, etc.) return self for chaining
      return () => chain;
    },
  });
  return chain;
}

// ── kindToCategory ────────────────────────────────────────────────────

describe('kindToCategory', () => {
  const cases: Array<[NotificationKind, string]> = [
    ['upvote', 'votes'],
    ['reviewed_vote', 'votes'],
    ['rank_up', 'ranks'],
    ['rank_milestone', 'ranks'],
    ['competition', 'ranks'],
    ['follow', 'social'],
    ['comment', 'social'],
    ['mention', 'social'],
    ['badge', 'system'],
    ['system', 'system'],
    ['moderation_decision', 'moderation'],
    ['appeal_resolved', 'moderation'],
  ];

  it.each(cases)('%s maps to %s', (kind, expected) => {
    expect(kindToCategory(kind)).toBe(expected);
  });
});

// ── buildTargetRoute ──────────────────────────────────────────────────

describe('buildTargetRoute', () => {
  it('returns null for null target type', () => {
    expect(buildTargetRoute(null, 'some-id')).toBeNull();
  });

  it('returns null for null target id', () => {
    expect(buildTargetRoute('submission', null)).toBeNull();
  });

  it('builds submission route', () => {
    expect(buildTargetRoute('submission', 'abc-123')).toBe('/recipe/abc-123');
  });

  it('builds chef route', () => {
    expect(buildTargetRoute('chef', 'chef-handle')).toBe('/chef/chef-handle');
  });

  it('builds dish route', () => {
    expect(buildTargetRoute('dish', 'dish-1')).toBe('/dish/dish-1');
  });

  it('builds badge route (ignores target id)', () => {
    expect(buildTargetRoute('badge', 'badge-1')).toBe('/(tabs)/profile');
  });

  it('builds challenge route', () => {
    expect(buildTargetRoute('challenge', 'ch-1')).toBe('/challenge/ch-1');
  });

  it('routes appeal outcomes to My Reports', () => {
    expect(buildTargetRoute('appeal', 'appeal-1')).toBe('/my-reports');
  });

  it('routes a bare comment moderation notice to My Reports', () => {
    expect(buildTargetRoute('comment', 'comment-1')).toBe('/my-reports');
  });
});

// ── buildTimeAgo ──────────────────────────────────────────────────────

describe('buildTimeAgo', () => {
  it('returns "now" for < 60s ago', () => {
    expect(buildTimeAgo(new Date(Date.now() - 30_000))).toBe('now');
  });

  it('returns minutes', () => {
    expect(buildTimeAgo(new Date(Date.now() - 5 * 60 * 1000))).toBe('5m');
  });

  it('returns hours', () => {
    expect(buildTimeAgo(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe('3h');
  });

  it('returns days', () => {
    expect(buildTimeAgo(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))).toBe('2d');
  });

  it('returns weeks', () => {
    expect(buildTimeAgo(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))).toBe('2w');
  });
});

// ── getNotificationFeed -- insert + read round trip ───────────────────

describe('getNotificationFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped view models with timeAgo and targetRoute', async () => {
    const row = makeRow();
    const chain = buildFromChain([row]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await getNotificationFeed(null, { userId: 'user-1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [vm] = result.data;
    expect(vm.id).toBe('notif-1');
    expect(vm.kind).toBe('upvote');
    expect(vm.category).toBe('votes');
    expect(vm.timeAgo).toBe('5m');
    expect(vm.targetRoute).toBe('/recipe/sub-1');
    expect(vm.isRead).toBe(false);
  });

  it('passes category filter -- resolves without error', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await getNotificationFeed(null, { userId: 'user-1', category: 'votes' });
    expect(result.ok).toBe(true);
  });

  it('passes cursor (before) filter -- resolves without error', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const cursor = new Date('2025-01-01');
    const result = await getNotificationFeed(null, { userId: 'user-1', before: cursor });
    expect(result.ok).toBe(true);
  });

  it('returns empty array when no rows', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await getNotificationFeed(null, { userId: 'user-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the unread count', async () => {
    const chain = buildFromChain([], 7);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await getUnreadCount(null, { userId: 'user-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(7);
  });
});

// ── markAllRead ───────────────────────────────────────────────────────

describe('markAllRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ok when marking all read', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await markAllRead(null, { userId: 'user-2' });
    expect(result.ok).toBe(true);
  });

  it('resolves ok when marking all read with category', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await markAllRead(null, { userId: 'user-2', category: 'social' });
    expect(result.ok).toBe(true);
  });
});

// ── markNotificationRead ──────────────────────────────────────────────

describe('markNotificationRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ok', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await markNotificationRead(null, { id: 'notif-42' });
    expect(result.ok).toBe(true);
  });
});

// ── removeNotification ────────────────────────────────────────────────

describe('removeNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ok', async () => {
    const chain = buildFromChain([]);
    (getBestChefClient().from as Mock).mockReturnValue(chain);

    const result = await removeNotification(null, { id: 'notif-5' });
    expect(result.ok).toBe(true);
  });
});

// ── Self-action guard (SQL-side, verified via contract) ───────────────
// The self-vote and self-follow guards live inside SECURITY DEFINER RPCs.
// Here we verify the shape contract: author === actor should produce 0 rows
// in a real DB. In unit tests we verify the kindToCategory grouping is
// correct (the guard is in SQL and tested via integration).

describe('self-action contract', () => {
  it('upvote kind stays in votes category (used by SQL guard check)', () => {
    expect(kindToCategory('upvote')).toBe('votes');
  });

  it('follow kind stays in social category', () => {
    expect(kindToCategory('follow')).toBe('social');
  });
});

// ── subscribeNotificationFeed -- realtime mock ────────────────────────

describe('subscribeNotificationFeed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an unsubscribe function', () => {
    const mockOn = vi.fn().mockReturnThis();
    const mockSubscribe = vi.fn().mockReturnThis();
    const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
    const mockRemoveChannel = vi.fn();

    const supabase = {
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    } as unknown as Parameters<typeof subscribeNotificationFeed>[0]['supabase'];

    const unsub = subscribeNotificationFeed({
      supabase,
      userId: 'user-1',
      onInsert: vi.fn(),
    });

    expect(typeof unsub).toBe('function');
    unsub();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('calls onInsert when a realtime INSERT event fires', () => {
    const onInsert = vi.fn();
    // Use a box to capture the handler across closure boundaries
    const box: { handler: ((payload: unknown) => void) | null } = { handler: null };

    const mockSubscribe = vi.fn().mockReturnThis();
    const onImpl = (_event: string, _filter: unknown, handler: (p: unknown) => void) => {
      box.handler = handler;
      return { on: onImpl, subscribe: mockSubscribe };
    };
    const mockOn = vi.fn().mockImplementation(onImpl);
    const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
    const mockRemoveChannel = vi.fn();

    const supabase = {
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    } as unknown as Parameters<typeof subscribeNotificationFeed>[0]['supabase'];

    subscribeNotificationFeed({ supabase, userId: 'user-1', onInsert });

    // Simulate a realtime INSERT payload
    expect(box.handler).not.toBeNull();
    if (box.handler) {
      box.handler({
        eventType: 'INSERT',
        new: makeRow(),
        old: null,
      });
    }

    expect(onInsert).toHaveBeenCalledOnce();
    const vm = onInsert.mock.calls[0][0] as NotificationViewModel;
    expect(vm.kind).toBe('upvote');
    expect(vm.targetRoute).toBe('/recipe/sub-1');
  });
});
