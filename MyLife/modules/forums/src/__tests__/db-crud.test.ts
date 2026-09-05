import { describe, expect, it } from 'vitest';
import { getCachedThreadById } from '../db/crud';

describe('forums cache CRUD', () => {
  it('coerces cached numeric isPinned values into booleans', () => {
    const db = {
      run() {},
      get() {
        return {
          id: 'thread-1',
          communityId: 'community-1',
          authorId: 'profile-1',
          title: 'Pinned thread',
          body: 'Body',
          status: 'open',
          isPinned: 1,
          voteScore: 12,
          replyCount: 3,
          viewCount: 40,
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: '2026-03-10T00:00:00.000Z',
        };
      },
      all() {
        return [];
      },
    };

    const thread = getCachedThreadById(db as any, 'thread-1');

    expect(thread?.isPinned).toBe(true);
  });
});
