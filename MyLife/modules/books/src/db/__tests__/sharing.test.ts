import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  createHubTestDatabase,
  runModuleMigrations,
  createFriendInvite,
  acceptFriendInvite,
  type DatabaseAdapter,
} from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createShareEvent,
  getShareEvent,
  listShareEventsVisibleToUser,
  updateShareEventVisibility,
  deleteShareEvent,
} from '../sharing';

describe('books sharing primitives', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    runModuleMigrations(db, 'books', BOOKS_MODULE.migrations ?? []);

    createFriendInvite(db, {
      id: 'invite-1',
      from_user_id: 'alice',
      to_user_id: 'bob',
    });
    expect(acceptFriendInvite(db, 'invite-1', 'bob')).toBe(true);
  });

  afterEach(() => {
    closeDb();
  });

  it('applies private/friends/public visibility rules', () => {
    createShareEvent(db, 'share-private', {
      actor_user_id: 'alice',
      object_type: 'book_review',
      object_id: 'review-1',
      visibility: 'private',
      payload_json: JSON.stringify({ note: 'private review' }),
    });

    createShareEvent(db, 'share-friends', {
      actor_user_id: 'alice',
      object_type: 'book_review',
      object_id: 'review-2',
      visibility: 'friends',
      payload_json: JSON.stringify({ note: 'friends review' }),
    });

    createShareEvent(db, 'share-public', {
      actor_user_id: 'alice',
      object_type: 'book_review',
      object_id: 'review-3',
      visibility: 'public',
      payload_json: JSON.stringify({ note: 'public review' }),
    });

    const aliceVisible = listShareEventsVisibleToUser(db, {
      viewer_user_id: 'alice',
    });
    expect(aliceVisible.map((item) => item.id).sort()).toEqual([
      'share-friends',
      'share-private',
      'share-public',
    ]);

    const bobVisible = listShareEventsVisibleToUser(db, {
      viewer_user_id: 'bob',
    });
    expect(bobVisible.map((item) => item.id)).toEqual([
      'share-public',
      'share-friends',
    ]);

    const charlieVisible = listShareEventsVisibleToUser(db, {
      viewer_user_id: 'charlie',
    });
    expect(charlieVisible.map((item) => item.id)).toEqual([
      'share-public',
    ]);
  });

  it('filters by actor/object and supports visibility updates/deletes', () => {
    createShareEvent(db, 'share-1', {
      actor_user_id: 'alice',
      object_type: 'book_rating',
      object_id: 'book-1',
      visibility: 'friends',
      payload_json: '{}',
    });

    createShareEvent(db, 'share-2', {
      actor_user_id: 'alice',
      object_type: 'book_rating',
      object_id: 'book-2',
      visibility: 'public',
      payload_json: '{}',
    });

    const book1ForBob = listShareEventsVisibleToUser(db, {
      viewer_user_id: 'bob',
      object_type: 'book_rating',
      object_id: 'book-1',
    });
    expect(book1ForBob).toHaveLength(1);
    expect(book1ForBob[0].id).toBe('share-1');

    updateShareEventVisibility(db, 'share-1', 'private');

    const updated = getShareEvent(db, 'share-1');
    expect(updated?.visibility).toBe('private');

    const afterVisibilityChange = listShareEventsVisibleToUser(db, {
      viewer_user_id: 'bob',
      actor_user_id: 'alice',
    });
    expect(afterVisibilityChange.map((item) => item.id)).toEqual(['share-2']);

    deleteShareEvent(db, 'share-2');
    expect(getShareEvent(db, 'share-2')).toBeNull();
  });
});
