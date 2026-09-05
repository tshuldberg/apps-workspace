// Plan 30 Phase 2: the pure channel-view mapping + the mention segmentation kit
// helper. Node-only, no React harness.

import { describe, it, expect } from 'vitest';
import type { ChannelMessageEvent } from '@mylife/sync';
import type { ChannelChatItem } from '../(root)/providers/ChatProvider';
import {
  buildReplyContext,
  firstUnreadEventId,
  mapChatItemToKit,
  mentionDisplayNames,
  newestVisibleEventId,
  replySnippet,
} from '../(root)/data/channel-view-core';
import { segmentBodyMentions } from '../(root)/components/chat/chat-kit-core';

function evt(overrides: Partial<ChannelMessageEvent>): ChannelMessageEvent {
  return {
    version: 2,
    id: 'evt_1',
    communityId: 'c1',
    channelId: 'ch1',
    authorDeviceId: 'devA',
    body: 'hello',
    hlc: { wall: '2026-07-03T12:00:00.000Z', counter: 0 },
    signature: 'sig',
    ...overrides,
  } as ChannelMessageEvent;
}

const NAME = (deviceId: string): string => (deviceId === 'devA' ? 'Alice' : deviceId === 'devB' ? 'Bob' : deviceId);

describe('mapChatItemToKit', () => {
  const deps = {
    selfDeviceId: 'devSelf',
    eventsById: new Map<string, ChannelMessageEvent>(),
    resolveReplyName: NAME,
  };

  it('maps a sent event from another author', () => {
    const item: ChannelChatItem = { kind: 'event', status: 'sent', event: evt({ id: 'e1', authorDeviceId: 'devA' }) };
    const kit = mapChatItemToKit(item, deps);
    expect(kit).toMatchObject({
      id: 'e1',
      authorId: 'devA',
      wall: '2026-07-03T12:00:00.000Z',
      isMine: false,
      body: 'hello',
      status: 'sent',
      edited: false,
      errorText: null,
      replyTo: null,
    });
  });

  it('marks my own sent event as mine', () => {
    const item: ChannelChatItem = { kind: 'event', status: 'sent', event: evt({ authorDeviceId: 'devSelf' }) };
    expect(mapChatItemToKit(item, deps).isMine).toBe(true);
  });

  it('marks an edit (non-deleting supersede) as edited', () => {
    const item: ChannelChatItem = {
      kind: 'event',
      status: 'sent',
      event: evt({ supersedes: { id: 'prev', deleted: false } }),
    };
    expect(mapChatItemToKit(item, deps).edited).toBe(true);
  });

  it('does not mark a deletion tombstone as edited', () => {
    const item: ChannelChatItem = {
      kind: 'event',
      status: 'sent',
      event: evt({ supersedes: { id: 'prev', deleted: true } }),
    };
    expect(mapChatItemToKit(item, deps).edited).toBe(false);
  });

  it('maps a local pending send as mine and sending', () => {
    const item: ChannelChatItem = {
      kind: 'local',
      status: 'sending',
      message: { clientId: 'cm_1', communityId: 'c1', channelId: 'ch1', body: 'draft', createdAt: '2026-07-03T12:01:00.000Z' },
    };
    const kit = mapChatItemToKit(item, deps);
    expect(kit).toMatchObject({ id: 'cm_1', isMine: true, status: 'sending', body: 'draft', errorText: null });
  });

  it('carries the honest failure copy for a failed send', () => {
    const item: ChannelChatItem = {
      kind: 'local',
      status: 'failed',
      message: { clientId: 'cm_2', communityId: 'c1', channelId: 'ch1', body: 'draft', createdAt: '2026-07-03T12:02:00.000Z', error: 'No relay' },
    };
    const kit = mapChatItemToKit(item, deps);
    expect(kit.status).toBe('failed');
    expect(kit.errorText).toBe('No relay');
  });

  it('resolves reply context from the visible events', () => {
    const target = evt({ id: 'root', authorDeviceId: 'devB', body: 'the original' });
    const deps2 = { selfDeviceId: 'devSelf', eventsById: new Map([['root', target]]), resolveReplyName: NAME };
    const item: ChannelChatItem = { kind: 'event', status: 'sent', event: evt({ id: 'r1', parentId: 'root', body: 'a reply' }) };
    expect(mapChatItemToKit(item, deps2).replyTo).toEqual({ targetId: 'root', authorName: 'Bob', snippet: 'the original' });
  });

  it('keeps the reply quote and marks edited=true for an edited reply', () => {
    const target = evt({ id: 'root', authorDeviceId: 'devB', body: 'the original' });
    const deps2 = { selfDeviceId: 'devSelf', eventsById: new Map([['root', target]]), resolveReplyName: NAME };
    const item: ChannelChatItem = {
      kind: 'event',
      status: 'sent',
      event: evt({ id: 'r2', parentId: 'root', body: 'edited reply', supersedes: { id: 'r1', deleted: false } }),
    };
    const kit = mapChatItemToKit(item, deps2);
    expect(kit.edited).toBe(true);
    expect(kit.replyTo).toEqual({ targetId: 'root', authorName: 'Bob', snippet: 'the original' });
  });
});

describe('buildReplyContext', () => {
  const target = evt({ id: 'root', authorDeviceId: 'devA', body: '  multi\n  line  body ' });

  it('returns null without a parentId', () => {
    expect(buildReplyContext(undefined, new Map(), NAME)).toBeNull();
  });

  it('returns null when the target is not locally present', () => {
    expect(buildReplyContext('missing', new Map(), NAME)).toBeNull();
  });

  it('collapses whitespace in the snippet', () => {
    const ctx = buildReplyContext('root', new Map([['root', target]]), NAME);
    expect(ctx).toEqual({ targetId: 'root', authorName: 'Alice', snippet: 'multi line body' });
  });
});

describe('replySnippet', () => {
  it('truncates a long body with an ellipsis', () => {
    const long = 'x'.repeat(200);
    const snippet = replySnippet(evt({ body: long }));
    expect(snippet.length).toBe(120);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('labels an attachment-only target', () => {
    expect(replySnippet(evt({ body: '   ', attachments: [{ id: 'a', blobHash: 'h', name: 'f', mimeType: 'x', size: 1 }] }))).toBe('Attachment');
  });

  it('labels an empty target as Message', () => {
    expect(replySnippet(evt({ body: '' }))).toBe('Message');
  });
});

describe('mentionDisplayNames', () => {
  it('is empty without mentions', () => {
    expect(mentionDisplayNames(evt({}), NAME)).toEqual([]);
  });

  it('resolves and dedupes mention names in order', () => {
    expect(mentionDisplayNames(evt({ mentions: ['devB', 'devA', 'devB'] }), NAME)).toEqual(['Bob', 'Alice']);
  });
});

describe('firstUnreadEventId', () => {
  const boundary = (wall: string, counter = 0, author: string | null = null) => ({ wall, counter, author });
  const events = [
    evt({ id: 'm1', authorDeviceId: 'devA', hlc: { wall: '2026-07-03T12:00:00.000Z', counter: 0 } }),
    evt({ id: 'me1', authorDeviceId: 'devSelf', hlc: { wall: '2026-07-03T12:01:00.000Z', counter: 0 } }),
    evt({ id: 'm2', authorDeviceId: 'devB', hlc: { wall: '2026-07-03T12:02:00.000Z', counter: 0 } }),
    evt({ id: 'm3', authorDeviceId: 'devA', hlc: { wall: '2026-07-03T12:03:00.000Z', counter: 0 } }),
  ];

  it('returns null when there is no read boundary yet (first visit)', () => {
    expect(firstUnreadEventId(events, null, 'devSelf')).toBeNull();
  });

  it('anchors at the first message newer than the boundary from another author', () => {
    // Boundary at m1's time: m2 is the first newer non-self message (me1 is skipped).
    expect(firstUnreadEventId(events, boundary('2026-07-03T12:01:00.000Z'), 'devSelf')).toBe('m2');
  });

  it('skips the reader own messages when the boundary is at the very start', () => {
    expect(firstUnreadEventId(events, boundary('2026-07-03T11:59:00.000Z'), 'devSelf')).toBe('m1');
  });

  it('returns null when everything is already read', () => {
    expect(firstUnreadEventId(events, boundary('2026-07-03T12:03:00.000Z'), 'devSelf')).toBeNull();
  });

  it('anchors a distinct remote event sharing the boundary (wall,counter) via the device tiebreak (m3)', () => {
    // A remote event at the EXACT boundary (wall, counter) whose device sorts
    // AFTER the boundary author is unread (not silently dropped).
    const wall = '2026-07-03T12:05:00.000Z';
    const tied = [evt({ id: 'tied', authorDeviceId: 'devZ', hlc: { wall, counter: 0 } })];
    expect(firstUnreadEventId(tied, boundary(wall, 0, 'devA'), 'devSelf')).toBe('tied');
    // Same tie but the event's device sorts BEFORE the boundary author -> read.
    expect(firstUnreadEventId(tied, boundary(wall, 0, 'devZZ'), 'devSelf')).toBeNull();
    // Legacy boundary with no author falls back to (wall,counter) => tie is read.
    expect(firstUnreadEventId(tied, boundary(wall, 0, null), 'devSelf')).toBeNull();
  });
});

describe('newestVisibleEventId (M1: posts-only channels advance the cursor)', () => {
  const noneHidden = () => false;
  const postEvent = evt({ id: 'p1', authorDeviceId: 'devA', postId: 'p1', parentId: 'p1', body: 'announcement' });

  it('returns the newest post id for a posts-only channel (not null)', () => {
    const items: ChannelChatItem[] = [{ kind: 'event', status: 'sent', event: postEvent }];
    expect(newestVisibleEventId(items, noneHidden)).toBe('p1');
  });

  it('returns null for an empty channel', () => {
    expect(newestVisibleEventId([], noneHidden)).toBeNull();
  });

  it('ignores local pending sends and returns the newest signed event', () => {
    const items: ChannelChatItem[] = [
      { kind: 'event', status: 'sent', event: evt({ id: 'm1', authorDeviceId: 'devA' }) },
      { kind: 'local', status: 'sending', message: { clientId: 'cm_1', communityId: 'c1', channelId: 'ch1', body: 'x', createdAt: '2026-07-03T13:00:00.000Z' } },
    ];
    expect(newestVisibleEventId(items, noneHidden)).toBe('m1');
  });

  it('skips a safety-hidden newest event and falls back to the prior visible one', () => {
    const items: ChannelChatItem[] = [
      { kind: 'event', status: 'sent', event: evt({ id: 'm1', authorDeviceId: 'devA' }) },
      { kind: 'event', status: 'sent', event: evt({ id: 'bad', authorDeviceId: 'devBad' }) },
    ];
    expect(newestVisibleEventId(items, (e) => e.id === 'bad')).toBe('m1');
  });
});

describe('segmentBodyMentions', () => {
  it('returns a single plain segment with no names', () => {
    expect(segmentBodyMentions('hi @Alice', [])).toEqual([{ text: 'hi @Alice', mention: false }]);
  });

  it('highlights a bounded mention token', () => {
    expect(segmentBodyMentions('hi @Alice there', ['Alice'])).toEqual([
      { text: 'hi ', mention: false },
      { text: '@Alice', mention: true },
      { text: ' there', mention: false },
    ]);
  });

  it('does not highlight an unbounded partial (email-like)', () => {
    expect(segmentBodyMentions('mail a@Alice.com', ['Alice'])).toEqual([{ text: 'mail a@Alice.com', mention: false }]);
  });

  it('prefers the longest name so a prefix name does not shadow', () => {
    expect(segmentBodyMentions('yo @Alice', ['Al', 'Alice'])).toEqual([
      { text: 'yo ', mention: false },
      { text: '@Alice', mention: true },
    ]);
  });

  it('highlights multiple mentions', () => {
    expect(segmentBodyMentions('@Alice and @Bob', ['Alice', 'Bob'])).toEqual([
      { text: '@Alice', mention: true },
      { text: ' and ', mention: false },
      { text: '@Bob', mention: true },
    ]);
  });

  it('requires the exact name boundary (no interior match)', () => {
    expect(segmentBodyMentions('@Alicia', ['Alice'])).toEqual([{ text: '@Alicia', mention: false }]);
  });
});
