// Security: resolveChannelMessages must AUTHOR-BIND and INTENT-BIND every
// supersede. A signed tombstone only proves who authored the tombstone, not that
// they may censor the target. Without the bind, member B could delete/edit member
// A's message, post, or reaction community-wide, and a react tombstone could
// censor a message. These are the resolve-seam regression tests.

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createChannelMessage,
  createChannelMessageV2,
  resolveChannelMessages,
} from '../protocol/channel-message';

const alice = generateDeviceIdentity('Alice');
const bob = generateDeviceIdentity('Bob');
const wall = '2026-07-03T00:00:00.000Z';
const at = (counter: number) => ({ wall, counter });

describe('resolveChannelMessages author-binding (message edit/delete)', () => {
  const rootA = createChannelMessage(alice, {
    communityId: 'c1', channelId: 'general', body: 'hi', hlc: at(0),
  });

  it('applies the author own edit', () => {
    const editA = createChannelMessage(alice, {
      communityId: 'c1', channelId: 'general', body: 'edited', hlc: at(1),
      supersedes: { id: rootA.id, deleted: false },
    });
    const out = resolveChannelMessages([rootA, editA]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('edited');
  });

  it('ignores a cross-author forged DELETE (target stays active)', () => {
    const forgedDelete = createChannelMessage(bob, {
      communityId: 'c1', channelId: 'general', body: '', hlc: at(2),
      supersedes: { id: rootA.id, deleted: true },
    });
    const out = resolveChannelMessages([rootA, forgedDelete]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('hi');
  });

  it('ignores a cross-author forged EDIT (target unchanged)', () => {
    const forgedEdit = createChannelMessage(bob, {
      communityId: 'c1', channelId: 'general', body: 'hacked', hlc: at(3),
      supersedes: { id: rootA.id, deleted: false },
    });
    const out = resolveChannelMessages([rootA, forgedEdit]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('hi');
  });

  it('applies the author own edit even when a forged tombstone is also present', () => {
    const editA = createChannelMessage(alice, {
      communityId: 'c1', channelId: 'general', body: 'edited', hlc: at(1),
      supersedes: { id: rootA.id, deleted: false },
    });
    const forgedDelete = createChannelMessage(bob, {
      communityId: 'c1', channelId: 'general', body: '', hlc: at(4),
      supersedes: { id: rootA.id, deleted: true },
    });
    const out = resolveChannelMessages([rootA, editA, forgedDelete]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('edited');
  });
});

describe('resolveChannelMessages author-binding (v2 post edit)', () => {
  it('applies a same-author same-intent v2 edit', () => {
    const rootV2 = createChannelMessageV2(alice, {
      communityId: 'c1', channelId: 'general', body: 'post', hlc: at(0),
      postId: 'p1', parentId: 'p1', branchId: 'p1', authorKind: 'human', intent: 'message',
    });
    const editV2 = createChannelMessageV2(alice, {
      communityId: 'c1', channelId: 'general', body: 'post edited', hlc: at(1),
      postId: 'p1', parentId: 'p1', branchId: 'p1', authorKind: 'human', intent: 'message',
      supersedes: { id: rootV2.id, deleted: false },
    });
    const out = resolveChannelMessages([rootV2, editV2]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('post edited');
  });
});

describe('resolveChannelMessages author + intent binding (reactions)', () => {
  const reactA = createChannelMessageV2(alice, {
    communityId: 'c1', channelId: 'general', body: '❤️', hlc: at(0),
    parentId: 'target-1', authorKind: 'human', intent: 'react',
  });

  it('applies the author own un-react', () => {
    const unreactA = createChannelMessageV2(alice, {
      communityId: 'c1', channelId: 'general', body: '', hlc: at(1),
      parentId: 'target-1', authorKind: 'human', intent: 'react',
      supersedes: { id: reactA.id, deleted: true },
    });
    expect(resolveChannelMessages([reactA, unreactA])).toHaveLength(0);
  });

  it('ignores a cross-author forged un-react (the reaction survives)', () => {
    const forgedUnreact = createChannelMessageV2(bob, {
      communityId: 'c1', channelId: 'general', body: '', hlc: at(2),
      parentId: 'target-1', authorKind: 'human', intent: 'react',
      supersedes: { id: reactA.id, deleted: true },
    });
    const out = resolveChannelMessages([reactA, forgedUnreact]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(reactA.id);
  });

  it('ignores a cross-intent tombstone (a react tombstone cannot delete a message)', () => {
    const rootMsg = createChannelMessage(alice, {
      communityId: 'c1', channelId: 'general', body: 'a message', hlc: at(0),
    });
    const reactTombstone = createChannelMessageV2(alice, {
      communityId: 'c1', channelId: 'general', body: '', hlc: at(1),
      parentId: rootMsg.id, authorKind: 'human', intent: 'react',
      supersedes: { id: rootMsg.id, deleted: true },
    });
    const out = resolveChannelMessages([rootMsg, reactTombstone]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toBe('a message');
  });
});
