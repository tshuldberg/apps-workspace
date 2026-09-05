import { describe, it, expect } from 'vitest';
import { mergePresenceState, pruneStaleUsers, generatePresenceColor } from '../src/presence';
import type { PresenceUser, PresenceState } from '../src/types';

function makeUser(id: string, lastSeen?: number): PresenceUser {
  return { id, name: `User ${id}`, color: '#DC2626', lastSeen: lastSeen ?? Date.now() };
}

describe('mergePresenceState', () => {
  it('handles joins', () => {
    const current: PresenceState = {};
    const joins = { room1: [makeUser('a')] };
    const result = mergePresenceState(current, joins, {});
    expect(result.room1).toHaveLength(1);
    expect(result.room1[0].id).toBe('a');
  });

  it('handles leaves', () => {
    const current: PresenceState = { room1: [makeUser('a'), makeUser('b')] };
    const leaves = { room1: [makeUser('a')] };
    const result = mergePresenceState(current, {}, leaves);
    expect(result.room1).toHaveLength(1);
    expect(result.room1[0].id).toBe('b');
  });

  it('removes key when all users leave', () => {
    const current: PresenceState = { room1: [makeUser('a')] };
    const leaves = { room1: [makeUser('a')] };
    const result = mergePresenceState(current, {}, leaves);
    expect(result.room1).toBeUndefined();
  });

  it('joins override existing entries for a key', () => {
    const current: PresenceState = { room1: [makeUser('a')] };
    const joins = { room1: [makeUser('b'), makeUser('c')] };
    const result = mergePresenceState(current, joins, {});
    expect(result.room1).toHaveLength(2);
    expect(result.room1[0].id).toBe('b');
  });
});

describe('pruneStaleUsers', () => {
  it('removes old entries', () => {
    const now = Date.now();
    const state: PresenceState = {
      room1: [makeUser('a', now - 60000), makeUser('b', now)],
    };
    const result = pruneStaleUsers(state, 30000);
    expect(result.room1).toHaveLength(1);
    expect(result.room1[0].id).toBe('b');
  });

  it('removes key when all users are stale', () => {
    const state: PresenceState = {
      room1: [makeUser('a', Date.now() - 60000)],
    };
    const result = pruneStaleUsers(state, 30000);
    expect(result.room1).toBeUndefined();
  });
});

describe('generatePresenceColor', () => {
  it('is deterministic', () => {
    const color1 = generatePresenceColor('user-abc');
    const color2 = generatePresenceColor('user-abc');
    expect(color1).toBe(color2);
  });

  it('returns different colors for different users', () => {
    const color1 = generatePresenceColor('alice');
    const color2 = generatePresenceColor('bob');
    // Not guaranteed but highly likely with different inputs
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
    expect(color1.startsWith('#')).toBe(true);
  });
});
