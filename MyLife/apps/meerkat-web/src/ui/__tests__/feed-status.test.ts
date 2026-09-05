// Community feed P5: unit tests for the pure feed-status module + a data-layer
// proof that refreshCommunityFeed honestly surfaces the 'removed' state when the
// community node rejects this device with reason 'not_member'.
//
// The pure module + the data-layer test are the proof for P5; the full browser
// flow (instant cache load, Refresh button, background poll, removed banner) is
// the P6 manual checklist. There is no React DOM harness in this app, so we do
// not add one here.

import { afterEach, describe, expect, it } from 'vitest';
import { createCommunity, getCurrentEpochKey } from '@mylife/sync';
import {
  deriveFeedState,
  formatUpdatedAgo,
  noHostWithCacheNotice,
  sourceLabel,
} from '../feed-status';
import type { RefreshFeedSource } from '../../lib/meerkat-data';
import { refreshCommunityFeed, storeOwnedCommunity } from '../../lib/meerkat-data';
import {
  buildWebNode,
  destroyNode,
  type WebNode,
} from '../../lib/__tests__/support/web-node-harness';

const NOW = Date.parse('2026-06-16T12:00:00.000Z');

describe('feed-status: formatUpdatedAgo', () => {
  it('reads "Never updated" when there is no last pull', () => {
    expect(formatUpdatedAgo(null, NOW)).toBe('Never updated');
  });

  it('reads "Never updated" for an unparseable timestamp (honest, no fake age)', () => {
    expect(formatUpdatedAgo('not-a-date', NOW)).toBe('Never updated');
  });

  it('reads "Updated just now" under a minute', () => {
    const t = new Date(NOW - 30_000).toISOString();
    expect(formatUpdatedAgo(t, NOW)).toBe('Updated just now');
  });

  it('clamps a future timestamp (clock skew) to "Updated just now"', () => {
    const t = new Date(NOW + 30_000).toISOString();
    expect(formatUpdatedAgo(t, NOW)).toBe('Updated just now');
  });

  it('reads whole minutes', () => {
    const t = new Date(NOW - 3 * 60_000).toISOString();
    expect(formatUpdatedAgo(t, NOW)).toBe('Updated 3m ago');
  });

  it('reads whole hours', () => {
    const t = new Date(NOW - 2 * 60 * 60_000).toISOString();
    expect(formatUpdatedAgo(t, NOW)).toBe('Updated 2h ago');
  });

  it('reads whole days past 24h', () => {
    const t = new Date(NOW - 50 * 60 * 60_000).toISOString();
    expect(formatUpdatedAgo(t, NOW)).toBe('Updated 2d ago');
  });
});

describe('feed-status: sourceLabel', () => {
  it('labels all four sources honestly (no fake live/online/delivered)', () => {
    expect(sourceLabel('community node')).toBe('Hosted for this community');
    expect(sourceLabel('peer')).toBe('Requested from a peer (applies when they answer)');
    expect(sourceLabel('no host reachable')).toBe('No host reachable');
    expect(sourceLabel('removed')).toBe('You were removed from this community');
  });

  it('every label is em-dash free', () => {
    const sources: RefreshFeedSource[] = ['community node', 'peer', 'no host reachable', 'removed'];
    for (const s of sources) expect(sourceLabel(s)).not.toContain('—');
  });
});

describe('feed-status: deriveFeedState', () => {
  it('removed wins over everything (a real not_member signal)', () => {
    const state = deriveFeedState({
      hasRelay: true,
      nodeUrlConfigured: true,
      messageCount: 5,
      lastSource: 'community node',
      removed: true,
    });
    expect(state.kind).toBe('removed');
    expect(state.notice).toBe('You were removed from this community.');
  });

  it('no_relay when neither a relay nor a node url is configured', () => {
    const state = deriveFeedState({
      hasRelay: false,
      nodeUrlConfigured: false,
      messageCount: 0,
      lastSource: null,
      removed: false,
    });
    expect(state.kind).toBe('no_relay');
    expect(state.notice).toBe('Set a connection server to look for hosted community history.');
  });

  it('empty when never refreshed and nothing cached but a relay exists', () => {
    const state = deriveFeedState({
      hasRelay: true,
      nodeUrlConfigured: false,
      messageCount: 0,
      lastSource: null,
      removed: false,
    });
    expect(state.kind).toBe('empty');
    expect(state.notice).toBe('No messages yet.');
  });

  it('no_host when a refresh reached no host and nothing is cached', () => {
    const state = deriveFeedState({
      hasRelay: true,
      nodeUrlConfigured: true,
      messageCount: 0,
      lastSource: 'no host reachable',
      removed: false,
    });
    expect(state.kind).toBe('no_host');
    expect(state.notice).toBe('No hosted community history reachable. No messages yet.');
  });

  it('ready when there is cached content (the instant-load path)', () => {
    const state = deriveFeedState({
      hasRelay: true,
      nodeUrlConfigured: true,
      messageCount: 3,
      lastSource: 'no host reachable',
      removed: false,
    });
    expect(state.kind).toBe('ready');
    expect(state.notice).toBeNull();
  });

  it('ready when a real node source answered (even with 0 new applied)', () => {
    const state = deriveFeedState({
      hasRelay: true,
      nodeUrlConfigured: true,
      messageCount: 0,
      lastSource: 'community node',
      removed: false,
    });
    expect(state.kind).toBe('ready');
    expect(state.notice).toBeNull();
  });

  it('noHostWithCacheNotice carries the real "Updated Xm ago" stamp, em-dash free', () => {
    const notice = noHostWithCacheNotice('Updated 3m ago');
    expect(notice).toBe('No hosted community history reachable. Showing your last synced copy from Updated 3m ago.');
    expect(notice).not.toContain('—');
  });
});

// ---------------------------------------------------------------------------
// Data-layer proof: a removed member sees source 'removed'.
//
// We found a community with a real epoch key + an http host, then drive
// pullCommunityFeed (via refreshCommunityFeed) against a stub fetch that answers
// the challenge route normally but returns 401 {reason:'not_member'} on the
// manifest route (the node holds the latest roster and rejected this device).
// refreshCommunityFeed must surface { source: 'removed' } and NOT advance the
// last-pull time.
// ---------------------------------------------------------------------------

let node: WebNode | null = null;

afterEach(async () => {
  await destroyNode(node);
  node = null;
});

function notMemberFetch(): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/challenge')) {
      return new Response(JSON.stringify({ nonce: 'a'.repeat(64) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/manifest')) {
      return new Response(JSON.stringify({ reason: 'not_member' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('refreshCommunityFeed: removed state', () => {
  it("returns source 'removed' when the node rejects this device as not_member", async () => {
    node = await buildWebNode('Removed Member');
    const db = node.db;
    const identity = node.identity;

    // Found a community WITH an http host so refreshCommunityFeed takes the node
    // path. The owner mints epoch 1 wrapped for itself (storeOwnedCommunity), so
    // getCurrentEpochKey is non-null and the pull proceeds to the manifest route.
    const signed = createCommunity(identity, {
      name: 'Removed Club',
      hosts: ['https://node.example'],
      channels: [{ id: 'general', name: 'general' }],
      now: '2026-06-16T00:00:00.000Z',
    });
    storeOwnedCommunity(db, identity, signed, undefined, (table, op, rowId, data) =>
      node!.engine.recordChange(table, op, rowId, data),
    );
    const communityId = signed.descriptor.communityId;
    expect(getCurrentEpochKey(db, communityId, identity)).not.toBeNull();

    const result = await refreshCommunityFeed(db, identity, communityId, {
      fetchFn: notMemberFetch(),
    });

    expect(result.source).toBe('removed');
    expect(result.applied).toBe(0);
    expect(result.lastPulledAt).toBeNull();

    // Honest: a removal does NOT advance the last-pull time.
    const lastPulledRows = db.query<{ value: string | null }>(
      `SELECT value FROM mk_settings WHERE key = ?`,
      [`last_pulled:${communityId}`],
    );
    expect(lastPulledRows).toHaveLength(0);
  });
});
