// FF2 warm-tail paging (section 5.6), web twin: the device-local cursor + the
// incremental reader-import. Proves the cursor advances to the newest verified event
// and a re-page with no newer content returns nothing + does not advance (no dupes).

import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  generateDeviceIdentity,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import { getPublicFeedCursor, pagePublicReader } from '../public-directory-client';

const COMMUNITY = 'cm_unit';
const CHANNEL = 'general';
const PUB = 'pub_ff2';
const HOST = 'https://host.example';

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

describe('FF2 pagePublicReader (warm-tail cursor, web twin)', () => {
  it('advances the cursor to the newest verified event and never re-pages duplicates', async () => {
    const { adapter } = createInMemoryTestDatabase();
    ensureSyncSchema(adapter);
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
    expect(getPublicFeedCursor(adapter, PUB, CHANNEL)).toEqual({ wall: '2026-06-28T00:00:02.000Z', counter: 0 });

    const second = await pagePublicReader(adapter, {
      baseUrl: HOST, publicationId: PUB, channelId: CHANNEL, expectedCommunityId: COMMUNITY,
      fetchFn: pageStub(events),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events).toEqual([]);
    expect(second.cursorAdvanced).toBe(false);

    const c = createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'c', hlc: { wall: '2026-06-28T00:00:03.000Z', counter: 0 } });
    const third = await pagePublicReader(adapter, {
      baseUrl: HOST, publicationId: PUB, channelId: CHANNEL, expectedCommunityId: COMMUNITY,
      fetchFn: pageStub([...events, c]),
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.events.map((e) => e.body)).toEqual(['c']);
  });
});
