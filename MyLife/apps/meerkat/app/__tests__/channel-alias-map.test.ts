// Plan 30 hardening: buildVisibleAliasMap must share resolveChannelMessages'
// fail-closed author + intent bind, so a supersede from a different author (or a
// different intent) cannot alias a root event away. Defense-in-depth: the alias
// map (used for reply-parent resolution) must not drift from the resolver.

import { describe, it, expect } from 'vitest';
import type { ChannelMessageEvent } from '@mylife/sync';
import { buildVisibleAliasMap } from '../(root)/data/community-core';

function evt(overrides: Partial<ChannelMessageEvent>): ChannelMessageEvent {
  return {
    version: 2,
    id: 'e',
    communityId: 'c1',
    channelId: 'ch1',
    authorDeviceId: 'A',
    body: 'b',
    hlc: { wall: '2026-07-03T12:00:00.000Z', counter: 0 },
    signature: 'sig',
    intent: 'message',
    ...overrides,
  } as ChannelMessageEvent;
}

describe('buildVisibleAliasMap fail-closed author/intent bind', () => {
  const root = evt({ id: 'R', authorDeviceId: 'A', hlc: { wall: '2026-07-03T12:00:00.000Z', counter: 0 } });
  const ownEdit = evt({
    id: 'R2',
    authorDeviceId: 'A',
    hlc: { wall: '2026-07-03T12:01:00.000Z', counter: 0 },
    supersedes: { id: 'R', deleted: false },
  });

  it('applies a same-author edit (root aliases to the edit)', () => {
    const alias = buildVisibleAliasMap([root, ownEdit]);
    expect(alias.get('R')).toBe('R2');
    expect(alias.get('R2')).toBe('R2');
  });

  it('ignores a cross-author tombstone naming the root', () => {
    const crossAuthorTombstone = evt({
      id: 'T',
      authorDeviceId: 'B',
      hlc: { wall: '2026-07-03T12:02:00.000Z', counter: 0 },
      supersedes: { id: 'R', deleted: true },
    });
    const alias = buildVisibleAliasMap([root, ownEdit, crossAuthorTombstone]);
    // The cross-author tombstone is fail-closed ignored: the root stays visible via
    // its own author's edit, and the tombstone does not alias into the root.
    expect(alias.get('R')).toBe('R2');
    expect(alias.get('T')).toBeUndefined();
  });

  it('ignores a cross-intent supersede naming the root', () => {
    const crossIntent = evt({
      id: 'X',
      authorDeviceId: 'A',
      intent: 'react',
      hlc: { wall: '2026-07-03T12:03:00.000Z', counter: 0 },
      supersedes: { id: 'R', deleted: true },
    });
    const alias = buildVisibleAliasMap([root, crossIntent]);
    // A 'react'-intent supersede cannot delete a 'message'-intent root.
    expect(alias.get('R')).toBe('R');
    expect(alias.get('X')).toBeUndefined();
  });
});
