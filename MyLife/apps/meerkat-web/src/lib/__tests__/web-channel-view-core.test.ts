// Plan 30 Phase 4: the web channel-view-core mapping tests. Pure functions that
// feed the chat kit -- the new-messages divider anchor (m3 author tiebreak), the
// read-cursor gate, the event->kit mapping (edited/reply), and mention display.

import { describe, expect, it } from 'vitest';
import type { ChannelMessageEvent } from '@mylife/sync';
import type { ReadBoundary } from '../meerkat-data';
import {
  buildReplyContext,
  firstUnreadEventId,
  mapEventToKit,
  mentionDisplayNames,
  newestVisibleEventId,
  replySnippet,
} from '../channel-view-core';

function ev(partial: Partial<ChannelMessageEvent> & { id: string; authorDeviceId: string; wall: string; counter?: number }): ChannelMessageEvent {
  return {
    version: 2,
    id: partial.id,
    communityId: 'c1',
    channelId: 'general',
    authorDeviceId: partial.authorDeviceId,
    body: partial.body ?? 'hi',
    attachments: partial.attachments,
    hlc: { wall: partial.wall, counter: partial.counter ?? 0 },
    supersedes: partial.supersedes,
    signature: 'sig',
    parentId: partial.parentId,
    postId: partial.postId,
    mentions: partial.mentions,
    intent: partial.intent ?? 'message',
  } as ChannelMessageEvent;
}

const self = 'self-device';
const other = 'other-device';

describe('firstUnreadEventId (m3 author tiebreak)', () => {
  it('returns null without a boundary (first visit shows no divider)', () => {
    expect(firstUnreadEventId([ev({ id: 'a', authorDeviceId: other, wall: 'w1' })], null, self)).toBeNull();
  });

  it('skips own messages and anchors on the first remote event after the boundary', () => {
    const boundary: ReadBoundary = { wall: 'w1', counter: 0, author: self };
    const events = [
      ev({ id: 'mine', authorDeviceId: self, wall: 'w2' }),
      ev({ id: 'theirs', authorDeviceId: other, wall: 'w2' }),
    ];
    expect(firstUnreadEventId(events, boundary, self)).toBe('theirs');
  });

  it('a distinct remote event at the exact boundary wall+counter still anchors when its author sorts after (m3)', () => {
    // author 'zzz' > boundary author 'aaa' at the same (wall, counter).
    const boundary: ReadBoundary = { wall: 'w1', counter: 5, author: 'aaa' };
    const events = [ev({ id: 'tie', authorDeviceId: 'zzz', wall: 'w1', counter: 5 })];
    expect(firstUnreadEventId(events, boundary, self)).toBe('tie');
  });
});

describe('newestVisibleEventId', () => {
  it('returns the last non-hidden event id (ascending stream)', () => {
    const events = [ev({ id: 'a', authorDeviceId: other, wall: 'w1' }), ev({ id: 'b', authorDeviceId: other, wall: 'w2' })];
    expect(newestVisibleEventId(events, () => false)).toBe('b');
    expect(newestVisibleEventId(events, (e) => e.id === 'b')).toBe('a');
    expect(newestVisibleEventId([], () => false)).toBeNull();
  });
});

describe('mapEventToKit', () => {
  const deps = {
    selfDeviceId: self,
    eventsById: new Map<string, ChannelMessageEvent>(),
    resolveReplyName: (d: string) => (d === self ? 'You' : 'Them'),
  };

  it('marks own vs other and edited vs not', () => {
    const mine = mapEventToKit(ev({ id: 'm', authorDeviceId: self, wall: 'w1' }), deps);
    expect(mine.isMine).toBe(true);
    expect(mine.status).toBe('sent');
    const edited = mapEventToKit(ev({ id: 'e', authorDeviceId: other, wall: 'w2', supersedes: { id: 'x', deleted: false } }), deps);
    expect(edited.edited).toBe(true);
  });

  it('resolves reply context from the visible events', () => {
    const parent = ev({ id: 'p', authorDeviceId: other, wall: 'w1', body: 'the original message' });
    const byId = new Map([[parent.id, parent]]);
    const context = buildReplyContext('p', byId, (d) => (d === other ? 'Them' : 'You'));
    expect(context).toEqual({ targetId: 'p', authorName: 'Them', snippet: 'the original message' });
    expect(replySnippet(ev({ id: 'z', authorDeviceId: other, wall: 'w1', body: '' }))).toBe('Message');
  });
});

describe('mentionDisplayNames', () => {
  it('maps signed mention deviceIds to distinct display names', () => {
    const event = ev({ id: 'x', authorDeviceId: self, wall: 'w1', mentions: ['d1', 'd2', 'd1'] });
    const names = mentionDisplayNames(event, (d) => (d === 'd1' ? 'Ann' : 'Bo'));
    expect(names).toEqual(['Ann', 'Bo']);
  });
});
