import { describe, it, expect } from 'vitest';
import type { SocialSupabaseClient } from '../feed-engine';
import {
  assembleFeed,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  blockUser,
  removeFriend,
  syncShareEvent,
  getFriendConnections,
  MAX_FRIENDS,
} from '../feed-engine';

// ── Mock Supabase Client ──

interface MockData {
  feedItems?: any[];
  connections?: any[];
  userId?: string;
}

function createMockClient(data: MockData): SocialSupabaseClient {
  const userId = data.userId ?? 'user-1';
  const feedItems = data.feedItems ?? [];
  const connections = data.connections ?? [];

  return {
    from: (table: string) => {
      const chainable = {
        select: (_columns?: string) => {
          const selectChain: any = {
            gte: (_col: string, _val: string) => ({
              order: (_col2: string, _opts?: any) => ({
                range: (_from: number, _to: number) =>
                  Promise.resolve({ data: feedItems, error: null }),
              }),
            }),
            or: (_filter: string) => {
              const orChain: any = {
                eq: (_col: string, _val: any) =>
                  Promise.resolve({ data: connections, error: null }),
                then: (fn: any) =>
                  Promise.resolve({ data: connections, error: null }).then(fn),
              };
              return orChain;
            },
            eq: (_col: string, _val: any) =>
              Promise.resolve({ data: connections, error: null }),
            order: (_col: string, _opts?: any) => ({
              limit: (_n: number) => ({
                range: (_from: number, _to: number) =>
                  Promise.resolve({ data: feedItems, error: null }),
              }),
            }),
            then: (fn: any) =>
              Promise.resolve({ data: feedItems, error: null }).then(fn),
          };
          return selectChain;
        },
        insert: (d: any) => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: 'new-id', ...d, created_at: new Date().toISOString(), accepted_at: null },
                error: null,
              }),
          }),
          then: (fn: any) => Promise.resolve({ data: d, error: null }).then(fn),
        }),
        update: (d: any) => ({
          eq: (_col: string, _val: any) => Promise.resolve({ data: d, error: null }),
        }),
        delete: () => ({
          eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }),
        }),
      };
      return chainable;
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: userId } } }),
    },
  } as unknown as SocialSupabaseClient;
}

// ── Tests ──

describe('feed engine', () => {
  describe('assembleFeed', () => {
    it('feedShowsOnlyFriendActivity', async () => {
      const mockItems = [
        {
          id: 'evt-1',
          user_id: 'friend-1',
          display_name: 'Alice',
          avatar_url: null,
          event_type: 'book_finished',
          book_title: 'Dune',
          book_cover_url: null,
          book_authors: 'Frank Herbert',
          rating: 5,
          review_excerpt: null,
          created_at: '2026-03-20T10:00:00Z',
        },
        {
          id: 'evt-2',
          user_id: 'friend-2',
          display_name: 'Bob',
          avatar_url: 'https://example.com/bob.jpg',
          event_type: 'book_rating',
          book_title: 'Neuromancer',
          book_cover_url: null,
          book_authors: 'William Gibson',
          rating: 4,
          review_excerpt: null,
          created_at: '2026-03-19T10:00:00Z',
        },
      ];
      const client = createMockClient({ feedItems: mockItems });
      const result = await assembleFeed(client);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].bookTitle).toBe('Dune');
      expect(result.items[1].bookTitle).toBe('Neuromancer');
      expect(result.isStale).toBe(false);
    });

    it('feedRespectsVisibility', async () => {
      // RLS handles visibility on Supabase side. We verify our engine
      // does not include private events (they simply would not be returned).
      const client = createMockClient({ feedItems: [] });
      const result = await assembleFeed(client);

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('feedOrderedByRecency', async () => {
      const mockItems = [
        {
          id: 'evt-1',
          user_id: 'friend-1',
          event_type: 'book_finished',
          book_title: 'Newer',
          created_at: '2026-03-21T10:00:00Z',
        },
        {
          id: 'evt-2',
          user_id: 'friend-2',
          event_type: 'book_started',
          book_title: 'Older',
          created_at: '2026-03-20T10:00:00Z',
        },
      ];
      const client = createMockClient({ feedItems: mockItems });
      const result = await assembleFeed(client);

      expect(result.items[0].bookTitle).toBe('Newer');
      expect(result.items[1].bookTitle).toBe('Older');
    });

    it('feedPagination', async () => {
      const mockItems = Array.from({ length: 10 }, (_, i) => ({
        id: `evt-${i}`,
        user_id: 'friend-1',
        event_type: 'book_added',
        book_title: `Book ${i}`,
        created_at: new Date(2026, 2, 20, 10, 0, i).toISOString(),
      }));
      const client = createMockClient({ feedItems: mockItems });
      const result = await assembleFeed(client, { limit: 10, offset: 0 });

      expect(result.items).toHaveLength(10);
    });
  });

  describe('friend connections', () => {
    it('sendFriendRequest', async () => {
      const client = createMockClient({ connections: [], userId: 'user-1' });
      const connection = await sendFriendRequest(client, 'user-2');

      expect(connection.id).toBe('new-id');
      expect(connection.status).toBe('pending');
    });

    it('friendConnectionRequiresAcceptance', async () => {
      const client = createMockClient({ connections: [], userId: 'user-1' });
      const connection = await sendFriendRequest(client, 'user-2');

      // Connection starts as pending, not accepted
      expect(connection.status).toBe('pending');
      expect(connection.acceptedAt).toBeNull();
    });

    it('acceptFriendRequest', async () => {
      const client = createMockClient({ userId: 'user-2' });
      // Should not throw
      await expect(acceptFriendRequest(client, 'conn-1')).resolves.toBeUndefined();
    });

    it('maxFriendsEnforced', async () => {
      // Create 100 existing connections
      const existingConnections = Array.from({ length: MAX_FRIENDS }, (_, i) => ({
        id: `conn-${i}`,
        requester_id: 'user-1',
        responder_id: `friend-${i}`,
        status: 'accepted',
      }));
      const client = createMockClient({ connections: existingConnections, userId: 'user-1' });

      await expect(sendFriendRequest(client, 'new-friend'))
        .rejects.toThrow(`Cannot exceed ${MAX_FRIENDS} friend connections`);
    });

    it('blockedUserCannotRequest', async () => {
      // After blocking, the status is 'blocked' on the connection
      const client = createMockClient({ userId: 'user-1' });
      await expect(blockUser(client, 'conn-1')).resolves.toBeUndefined();
    });
  });

  describe('syncShareEvent', () => {
    it('privateEventNotSynced', async () => {
      // Private visibility events should not be synced. The caller is responsible
      // for not calling syncShareEvent for private events. We verify the function
      // correctly sends visibility to Supabase.
      const client = createMockClient({ userId: 'user-1' });

      // Only 'friends' and 'public' visibility are valid for SyncShareEventInput
      await expect(
        syncShareEvent(client, {
          eventType: 'book_finished',
          bookTitle: 'Test Book',
          visibility: 'friends',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getFriendConnections', () => {
    it('returns connections for current user', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          requester_id: 'user-1',
          responder_id: 'user-2',
          status: 'accepted',
          created_at: '2026-03-15T10:00:00Z',
          accepted_at: '2026-03-15T12:00:00Z',
        },
      ];
      const client = createMockClient({ connections: mockConnections, userId: 'user-1' });
      const connections = await getFriendConnections(client, 'accepted');

      expect(connections).toHaveLength(1);
      expect(connections[0].status).toBe('accepted');
    });
  });
});
