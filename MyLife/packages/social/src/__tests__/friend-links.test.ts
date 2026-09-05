import { describe, expect, it, vi } from 'vitest';
import { SocialClient } from '../client';

type QueryResult = { data: unknown; error: unknown };

function createBuilder(result: QueryResult, state: { insertPayload?: unknown } = {}) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      state.insertPayload = payload;
      return builder;
    }),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => void) =>
      Promise.resolve(result).then(resolve),
  };

  return { builder, state };
}

function createSupabase(config: {
  authUserId?: string | null;
  tables: Record<string, ReturnType<typeof createBuilder>>;
  rpcResult?: QueryResult;
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: config.authUserId ? { id: config.authUserId } : null,
        },
      })),
    },
    from: vi.fn((table: string) => {
      const response = config.tables[table];
      if (!response) throw new Error(`Missing table mock for ${table}`);
      return response.builder;
    }),
    rpc: vi.fn(async () => config.rpcResult ?? { data: null, error: null }),
  };
}

const myProfileRow = {
  id: 'profile-1',
  user_id: 'user-1',
  handle: 'trey',
  display_name: 'Trey',
  bio: null,
  avatar_url: null,
  privacy_settings: {
    discoverable: false,
    showModules: false,
    showStreaks: false,
    openFollows: false,
    moduleSettings: [],
  },
  follower_count: 0,
  following_count: 0,
  enabled_modules: ['market'],
  created_at: '2026-03-10T00:00:00.000Z',
  updated_at: '2026-03-10T00:00:00.000Z',
};

describe('secure friend links', () => {
  it('creates a hashed friend link and returns the share code once', async () => {
    const linkTable = createBuilder({
      data: {
        id: 'link-1',
        creator_profile_id: 'profile-1',
        friend_profile_id: null,
        status: 'pending',
        code_hint: 'ABCD-EFGH',
        note: 'Met at the market',
        expires_at: null,
        confirmed_at: null,
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });

    const supabase = createSupabase({
      authUserId: 'user-1',
      tables: {
        social_profiles: createBuilder({
          data: myProfileRow,
          error: null,
        }),
        social_friend_links: linkTable,
      },
    });

    const client = new SocialClient(supabase as any);
    const result = await client.createFriendLink({ note: 'Met at the market' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.code).toMatch(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/);
    expect(linkTable.state.insertPayload).toEqual({
      creator_profile_id: 'profile-1',
      code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      code_hint: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/),
      note: 'Met at the market',
      expires_at: null,
    });
  });

  it('redeems a friend link through the confirmation RPC and maps the friendship', async () => {
    const supabase = createSupabase({
      authUserId: 'user-1',
      tables: {
        social_profiles: createBuilder({
          data: myProfileRow,
          error: null,
        }),
      },
      rpcResult: {
        data: {
          id: 'friendship-1',
          profile_a_id: 'profile-1',
          profile_b_id: 'profile-2',
          created_by_profile_id: 'profile-1',
          source_link_id: 'link-1',
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: '2026-03-10T00:00:00.000Z',
        },
        error: null,
      },
    });

    const client = new SocialClient(supabase as any);
    const result = await client.redeemFriendLink('ABCD-EFGH-JK23');

    expect(supabase.rpc).toHaveBeenCalledWith('social_confirm_friend_link', {
      link_code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      claimant_profile_id: 'profile-1',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friendship-1',
        profileAId: 'profile-1',
        profileBId: 'profile-2',
        createdByProfileId: 'profile-1',
        sourceLinkId: 'link-1',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });
});
