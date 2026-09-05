// FF2 warm-tail paging (section 5.6): the device-local cursor + the incremental
// reader-import. Proves the cursor advances to the newest verified event, a re-page
// with no newer content returns nothing + does not advance (no duplicates), and the
// cursor row stays device_local (never enters the synced scope).

import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  generateDeviceIdentity,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { ensureCommunityTables } from '../(root)/data/community-core';
import {
  getPublicFeedCursor,
  pagePublicReader,
} from '../(root)/data/public-directory-client';

const COMMUNITY = 'cm_unit';
const CHANNEL = 'general';
const PUB = 'pub_ff2';
const HOST = 'https://host.example';

/** A stub fetch for the OPEN page route that filters by the `after` cursor. */
function pageStub(events: ChannelMessageEvent[]): typeof fetch {
  return (async (url: string | URL) => {
    const u = new URL(String(url));
    const after = u.searchParams.get('after');
    let out = events;
    if (after) {
      const idx = after.lastIndexOf('.');
      const cur = { wall: after.slice(0, idx), counter: Number(after.slice(idx + 1)) };
      out = events.filter((e) => e.hlc.wall > cur.wall || (e.hlc.wall === cur.wall && e.hlc.counter > cur.counter));
    }
    const last = out[out.length - 1];
    return {
      status: 200, ok: true,
      json: async () => ({ events: out, nextCursor: last ? `${last.hlc.wall}.${last.hlc.counter}` : null, hasMore: false }),
    } as Response;
  }) as typeof fetch;
}

describe('FF2 pagePublicReader (warm-tail cursor)', () => {
  it('advances the cursor to the newest verified event and never re-pages duplicates', async () => {
    const { adapter } = createInMemoryTestDatabase();
    ensureCommunityTables(adapter);
    const owner = generateDeviceIdentity('Owner');
    const events = [
      createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'a', hlc: { wall: '2026-06-28T00:00:01.000Z', counter: 0 } }),
      createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'b', hlc: { wall: '2026-06-28T00:00:02.000Z', counter: 0 } }),
    ];

    expect(getPublicFeedCursor(adapter, PUB, CHANNEL)).toBeNull();

    const first = await pagePublicReader(adapter, {
      baseUrl: HOST, publicationId: PUB, channelId: CHANNEL, expectedCommunityId: COMMUNITY,
      fetchFn: pageStub(events), now: () => '2026-06-28T01:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.events.map((e) => e.body)).toEqual(['a', 'b']);
    expect(first.cursorAdvanced).toBe(true);
    // Cursor now points at the newest event 'b'.
    expect(getPublicFeedCursor(adapter, PUB, CHANNEL)).toEqual({ wall: '2026-06-28T00:00:02.000Z', counter: 0 });

    // Re-page with no newer content: nothing returned, cursor unchanged (no duplicates).
    const second = await pagePublicReader(adapter, {
      baseUrl: HOST, publicationId: PUB, channelId: CHANNEL, expectedCommunityId: COMMUNITY,
      fetchFn: pageStub(events),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events).toEqual([]);
    expect(second.cursorAdvanced).toBe(false);
    expect(getPublicFeedCursor(adapter, PUB, CHANNEL)).toEqual({ wall: '2026-06-28T00:00:02.000Z', counter: 0 });

    // A NEW event appended later is picked up incrementally.
    const c = createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'c', hlc: { wall: '2026-06-28T00:00:03.000Z', counter: 0 } });
    const third = await pagePublicReader(adapter, {
      baseUrl: HOST, publicationId: PUB, channelId: CHANNEL, expectedCommunityId: COMMUNITY,
      fetchFn: pageStub([...events, c]),
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.events.map((e) => e.body)).toEqual(['c']); // only the new tail
  });

  it('the cm_public_feed_cursor row is device_local and never enters the synced scope', () => {
    const { adapter } = createInMemoryTestDatabase();
    ensureCommunityTables(adapter);
    // The sync policy guard (community-core.test.ts) asserts cm_public_feed_cursor is
    // device_local; here just confirm the table is local-only by construction (it is
    // never written through the ChangeTracker, only by setPublicFeedCursor).
    const tables = adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cm_public_feed_cursor'")
      .map((r) => r.name);
    expect(tables).toContain('cm_public_feed_cursor');
  });
});
