import { describe, expect, it, vi } from 'vitest';
import { SocialClient } from '../client';

type QueryResult = { data: unknown; error: unknown };

function createSupabaseMock(config: {
  authUserId?: string | null;
  tableResults: Record<string, QueryResult[]>;
  rpcResults?: Record<string, QueryResult>;
}) {
  const tableQueues = new Map(
    Object.entries(config.tableResults).map(([table, results]) => [table, [...results]]),
  );

  function nextResult(table: string): QueryResult {
    const queue = tableQueues.get(table);
    if (!queue || queue.length === 0) {
      throw new Error(`No queued result for table ${table}`);
    }
    return queue.shift()!;
  }

  function createBuilder(table: string) {
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      is: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      or: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => nextResult(table)),
      single: vi.fn(async () => nextResult(table)),
      then: (resolve: (value: QueryResult) => void) =>
        Promise.resolve(nextResult(table)).then(resolve),
    };

    return builder;
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: config.authUserId
            ? { id: config.authUserId }
            : null,
        },
      })),
    },
    from: vi.fn((table: string) => createBuilder(table)),
    rpc: vi.fn(async (fn: string) => {
      return config.rpcResults?.[fn] ?? {
        data: null,
        error: { message: `Missing RPC mock for ${fn}` },
      };
    }),
  };
}

describe('SocialClient leaderboards', () => {
  it('falls back to client-side friends leaderboard aggregation when the RPC is unavailable', async () => {
    const supabase = createSupabaseMock({
      authUserId: 'user-1',
      tableResults: {
        social_profiles: [
          {
            data: {
              id: 'profile-self',
              user_id: 'user-1',
              handle: 'trey',
              display_name: 'Trey',
              avatar_url: null,
              bio: null,
              privacy_settings: {
                discoverable: false,
                showModules: false,
                showStreaks: false,
                openFollows: false,
                moduleSettings: [],
              },
              follower_count: 0,
              following_count: 1,
              enabled_modules: ['forums'],
              created_at: '2026-03-01T00:00:00.000Z',
              updated_at: '2026-03-01T00:00:00.000Z',
            },
            error: null,
          },
          {
            data: [
              {
                id: 'profile-self',
                handle: 'trey',
                display_name: 'Trey',
                avatar_url: null,
              },
              {
                id: 'profile-friend',
                handle: 'alex',
                display_name: 'Alex',
                avatar_url: null,
              },
            ],
            error: null,
          },
        ],
        social_follows: [
          {
            data: [{ followee_id: 'profile-friend' }],
            error: null,
          },
        ],
        social_activities: [
          {
            data: [
              {
                profile_id: 'profile-friend',
                module_id: 'books',
                type: 'books_finished',
                created_at: '2026-03-09T00:00:00.000Z',
              },
              {
                profile_id: 'profile-friend',
                module_id: 'books',
                type: 'books_finished',
                created_at: '2026-03-09T01:00:00.000Z',
              },
              {
                profile_id: 'profile-self',
                module_id: 'forums',
                type: 'forums_thread_created',
                created_at: '2026-03-09T02:00:00.000Z',
              },
            ],
            error: null,
          },
        ],
      },
      rpcResults: {
        compute_friends_leaderboard: {
          data: null,
          error: { message: 'Function not deployed' },
        },
      },
    });

    const client = new SocialClient(supabase as any);
    const result = await client.getFriendsLeaderboard('weekly');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toEqual([
      {
        profileId: 'profile-friend',
        handle: 'alex',
        displayName: 'Alex',
        avatarUrl: null,
        score: 2,
        rank: 1,
        moduleScores: { books: 2 },
      },
      {
        profileId: 'profile-self',
        handle: 'trey',
        displayName: 'Trey',
        avatarUrl: null,
        score: 1,
        rank: 2,
        moduleScores: { forums: 1 },
      },
    ]);
  });
});
