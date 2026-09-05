import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  channelMessageId,
  compareChannelMessages,
  createChannelMessage,
  createChannelMessageV2,
  nextHlc,
  resolveChannelMessages,
  verifyChannelMessage,
  type ChannelMessageEvent,
} from '../protocol/channel-message';

const author = generateDeviceIdentity('Author');

describe('channel message event (MK-050)', () => {
  it('signs, verifies, and derives a stable content id', () => {
    const message = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'hello',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    expect(message.authorDeviceId).toBe(author.publicKey);
    expect(message.id).toBe(channelMessageId(message));
    expect(verifyChannelMessage(message)).toBe(true);
  });

  it('rejects a tampered body because the signature no longer covers it', () => {
    const message = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'hello',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    const tampered: ChannelMessageEvent = { ...message, body: 'evil' };

    expect(verifyChannelMessage(tampered)).toBe(false);
  });

  it('covers attachment metadata in the signature and content id', () => {
    const message = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'photo',
      attachments: [{
        id: 'att-1',
        blobHash: 'a'.repeat(128),
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 42,
      }],
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    const tampered: ChannelMessageEvent = {
      ...message,
      attachments: message.attachments?.map((attachment) => (
        attachment.id === 'att-1'
          ? { ...attachment, blobHash: 'b'.repeat(128) }
          : attachment
      )),
    };

    expect(verifyChannelMessage(message)).toBe(true);
    expect(message.id).toBe(channelMessageId(message));
    expect(verifyChannelMessage(tampered)).toBe(false);
  });

  it('rejects a forged author', () => {
    const evil = generateDeviceIdentity('Evil');
    const message = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'hi',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    const forged: ChannelMessageEvent = { ...message, authorDeviceId: evil.publicKey };

    expect(verifyChannelMessage(forged)).toBe(false);
  });

  it('orders deterministically by wall, counter, author, then id', () => {
    const authorB = generateDeviceIdentity('Author B');
    const later = createChannelMessage(author, {
      communityId: 'c',
      channelId: 'g',
      body: 'later wall',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const firstTie = createChannelMessage(author, {
      communityId: 'c',
      channelId: 'g',
      body: 'same clock a',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 5 },
    });
    const secondTie = createChannelMessage(authorB, {
      communityId: 'c',
      channelId: 'g',
      body: 'same clock b',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 5 },
    });

    const sorted = [later, secondTie, firstTie].sort(compareChannelMessages);

    expect(sorted[2]).toBe(later);
    expect(sorted.map((message) => message.id)).toEqual(
      [...sorted].sort(compareChannelMessages).map((message) => message.id),
    );
  });

  it('nextHlc advances the counter within the same wall and resets on a newer wall', () => {
    expect(nextHlc(null, 'T1')).toEqual({ wall: 'T1', counter: 0 });
    expect(nextHlc({ wall: 'T1', counter: 0 }, 'T1')).toEqual({ wall: 'T1', counter: 1 });
    expect(nextHlc({ wall: 'T1', counter: 3 }, 'T2')).toEqual({ wall: 'T2', counter: 0 });
  });

  it('resolves edit and delete supersede events without mutating the append log', () => {
    const original = createChannelMessage(author, {
      communityId: 'c',
      channelId: 'g',
      body: 'draft',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const edited = createChannelMessage(author, {
      communityId: 'c',
      channelId: 'g',
      body: 'final',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
      supersedes: { id: original.id, deleted: false },
    });
    const deleted = createChannelMessage(author, {
      communityId: 'c',
      channelId: 'g',
      body: '',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
      supersedes: { id: edited.id, deleted: true },
    });

    expect(resolveChannelMessages([edited, original]).map((message) => message.body)).toEqual(['final']);
    expect(resolveChannelMessages([deleted, original, edited])).toEqual([]);
  });
});

describe('channel message v2 contract (MK-P01)', () => {
  const hlc = { wall: '2026-06-18T00:00:00.000Z', counter: 0 };

  it('signs, verifies, and derives a stable id for a v2 post event', () => {
    const message = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first post',
      hlc,
      postId: 'post-1',
      parentId: 'post-1',
      branchId: 'post-1',
      authorKind: 'human',
      mentions: ['device-abc'],
      intent: 'message',
    });

    expect(message.version).toBe(2);
    expect(message.postId).toBe('post-1');
    expect(message.id).toBe(channelMessageId(message));
    expect(verifyChannelMessage(message)).toBe(true);
  });

  it('covers each v2 field in the signature and content id', () => {
    const message = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'reply',
      hlc,
      postId: 'post-1',
      parentId: 'comment-9',
      branchId: 'comment-9',
      authorKind: 'agent',
      mentions: ['device-abc', 'device-def'],
      intent: 'agent_result',
    });

    const tamperPostId: ChannelMessageEvent = { ...message, postId: 'post-OTHER' };
    const tamperParent: ChannelMessageEvent = { ...message, parentId: 'comment-OTHER' };
    const tamperBranchId: ChannelMessageEvent = { ...message, branchId: 'branch-OTHER' };
    const tamperAuthorKind: ChannelMessageEvent = { ...message, authorKind: 'human' };
    const tamperMentions: ChannelMessageEvent = { ...message, mentions: ['device-evil'] };
    const tamperIntent: ChannelMessageEvent = { ...message, intent: 'message' };

    expect(verifyChannelMessage(message)).toBe(true);
    expect(verifyChannelMessage(tamperPostId)).toBe(false);
    expect(verifyChannelMessage(tamperParent)).toBe(false);
    expect(verifyChannelMessage(tamperBranchId)).toBe(false);
    expect(verifyChannelMessage(tamperAuthorKind)).toBe(false);
    expect(verifyChannelMessage(tamperMentions)).toBe(false);
    expect(verifyChannelMessage(tamperIntent)).toBe(false);
  });

  it('keeps v1 events byte-compatible (no v2 fields, still verifies)', () => {
    const v1 = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc,
    });

    expect(v1.version).toBe(1);
    expect(v1.postId).toBeUndefined();
    expect(v1.parentId).toBeUndefined();
    expect(verifyChannelMessage(v1)).toBe(true);
    expect(v1.id).toBe(channelMessageId(v1));
  });

  it('rejects a v1 event that smuggles a v2 field', () => {
    const v1 = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc,
    });
    const smuggled = { ...v1, postId: 'post-x' } as ChannelMessageEvent;
    expect(verifyChannelMessage(smuggled)).toBe(false);
  });

  it('rejects an unknown version', () => {
    const v2 = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'x',
      hlc,
      postId: 'post-1',
    });
    const bad = { ...v2, version: 3 } as unknown as ChannelMessageEvent;
    expect(verifyChannelMessage(bad)).toBe(false);
  });
});
