// Plan 30 Phase 4: the web chat-compose twin. Proves v1/v2 selection (a plain send
// stays v1; any mention/reply opt forces v2), the reaction event shape (intent
// 'react', one-emoji body, single-grapheme guard), and the un-react tombstone.

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity, nextHlc, verifyChannelMessage } from '@mylife/sync';
import {
  REACTION_INVALID_EMOJI_ERROR,
  buildDeletedChannelMessage,
  buildEditedChannelMessage,
  buildOutgoingChannelMessage,
  buildReactionEvent,
  buildUnreactionEvent,
  sendOptsNeedV2,
} from '../chat-compose';

const identity = generateDeviceIdentity('Composer');
const hlc = (): ReturnType<typeof nextHlc> => nextHlc(null, new Date().toISOString());
const base = { communityId: 'c1', channelId: 'general', attachments: [] as never[] };

describe('sendOptsNeedV2', () => {
  it('is false for undefined/empty and true for any v2 field', () => {
    expect(sendOptsNeedV2(undefined)).toBe(false);
    expect(sendOptsNeedV2({})).toBe(false);
    expect(sendOptsNeedV2({ mentions: [] })).toBe(false);
    expect(sendOptsNeedV2({ mentions: ['d1'] })).toBe(true);
    expect(sendOptsNeedV2({ parentId: 'p' })).toBe(true);
    expect(sendOptsNeedV2({ postId: 'po' })).toBe(true);
  });
});

describe('buildOutgoingChannelMessage v1/v2 selection', () => {
  it('a plain send is v1 with no v2 fields', () => {
    const event = buildOutgoingChannelMessage(identity, { ...base, body: 'hi', hlc: hlc() });
    expect(event.version).toBe(1);
    expect(event.mentions).toBeUndefined();
    expect(verifyChannelMessage(event)).toBe(true);
  });

  it('a reply/mention send is v2 carrying the signed fields', () => {
    const event = buildOutgoingChannelMessage(identity, {
      ...base,
      body: 'hey @Al',
      hlc: hlc(),
      opts: { mentions: ['d-al'], parentId: 'target-id' },
    });
    expect(event.version).toBe(2);
    expect(event.parentId).toBe('target-id');
    expect(event.mentions).toEqual(['d-al']);
    expect(event.intent).toBe('message');
    expect(verifyChannelMessage(event)).toBe(true);
  });
});

describe('buildEditedChannelMessage / buildDeletedChannelMessage preserve v2 fields', () => {
  it('editing a v2 chat REPLY keeps parentId + mentions + branchId (no v1 strip)', () => {
    // A v2 reply has parentId but NO postId, so an isChannelPostEvent-gated builder
    // would drop it to v1 and delete the v2 fields. The version gate preserves them.
    const reply = buildOutgoingChannelMessage(identity, {
      ...base,
      body: 'original @Al',
      hlc: hlc(),
      opts: { parentId: 'root-msg', mentions: ['d-al'], branchId: 'branch-1' },
    });
    expect(reply.version).toBe(2);
    const edited = buildEditedChannelMessage(identity, { event: reply, body: 'edited @Al', hlc: hlc() });
    expect(edited.version).toBe(2);
    expect(edited.parentId).toBe('root-msg');
    expect(edited.mentions).toEqual(['d-al']);
    expect(edited.branchId).toBe('branch-1');
    expect(edited.intent).toBe('message');
    expect(edited.supersedes).toEqual({ id: reply.id, deleted: false });
    expect(verifyChannelMessage(edited)).toBe(true);
  });

  it('a plain v1 message edits as v1 (unchanged path)', () => {
    const v1 = buildOutgoingChannelMessage(identity, { ...base, body: 'plain', hlc: hlc() });
    expect(v1.version).toBe(1);
    const edited = buildEditedChannelMessage(identity, { event: v1, body: 'plain edited', hlc: hlc() });
    expect(edited.version).toBe(1);
    expect(verifyChannelMessage(edited)).toBe(true);
  });

  it('deleting a v2 reply tombstones as v2 keeping its threading (verifies)', () => {
    const reply = buildOutgoingChannelMessage(identity, {
      ...base,
      body: 'to delete',
      hlc: hlc(),
      opts: { parentId: 'root-msg', mentions: ['d-al'] },
    });
    const tombstone = buildDeletedChannelMessage(identity, { event: reply, hlc: hlc() });
    expect(tombstone.version).toBe(2);
    expect(tombstone.parentId).toBe('root-msg');
    expect(tombstone.supersedes).toEqual({ id: reply.id, deleted: true });
    expect(verifyChannelMessage(tombstone)).toBe(true);
  });
});

describe('buildReactionEvent / buildUnreactionEvent', () => {
  it('a valid single-emoji react verifies with intent react', () => {
    const react = buildReactionEvent(identity, { ...base, targetEventId: 'msg1', emoji: '❤️', hlc: hlc() });
    expect(react.intent).toBe('react');
    expect(react.body).toBe('❤️');
    expect(react.parentId).toBe('msg1');
    expect(verifyChannelMessage(react)).toBe(true);
  });

  it('a non-emoji body is rejected before signing', () => {
    expect(() => buildReactionEvent(identity, { ...base, targetEventId: 'm', emoji: 'x', hlc: hlc() }))
      .toThrow(REACTION_INVALID_EMOJI_ERROR);
  });

  it('an un-react tombstone supersedes the prior reaction and verifies', () => {
    const react = buildReactionEvent(identity, { ...base, targetEventId: 'm', emoji: '👍', hlc: hlc() });
    const tombstone = buildUnreactionEvent(identity, {
      ...base,
      parentId: 'm',
      reactionEventId: react.id,
      hlc: hlc(),
    });
    expect(tombstone.supersedes).toEqual({ id: react.id, deleted: true });
    expect(tombstone.intent).toBe('react');
    expect(verifyChannelMessage(tombstone)).toBe(true);
  });
});
