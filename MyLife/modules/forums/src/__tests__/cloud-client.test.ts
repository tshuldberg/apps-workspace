import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  emitForumCommunityCreated,
  emitForumReplyPosted,
  emitForumThreadCreated,
} = vi.hoisted(() => ({
  emitForumCommunityCreated: vi.fn(),
  emitForumReplyPosted: vi.fn(),
  emitForumThreadCreated: vi.fn(),
}));

vi.mock('@mylife/social', () => ({
  emitForumCommunityCreated,
  emitForumReplyPosted,
  emitForumThreadCreated,
}));

import {
  cloudCreateCommunity,
  cloudCreateReport,
  cloudGetUserStats,
} from '../cloud/client';

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
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => void) =>
      Promise.resolve(result).then(resolve),
  };

  return { builder, state };
}

function createSupabase(tables: Record<string, ReturnType<typeof createBuilder>>, userId = 'profile-1') {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
    from: vi.fn((table: string) => {
      const response = tables[table];
      if (!response) throw new Error(`Missing table mock for ${table}`);
      return response.builder;
    }),
    rpc: vi.fn(),
  };
}

describe('forums cloud client', () => {
  beforeEach(() => {
    emitForumCommunityCreated.mockReset();
    emitForumReplyPosted.mockReset();
    emitForumThreadCreated.mockReset();
  });

  it('writes snake_case community inserts and maps the created community', async () => {
    const table = createBuilder({
      data: {
        id: 'community-1',
        creator_id: 'profile-1',
        name: 'camera-club',
        display_name: 'Camera Club',
        description: 'Talk lenses and street photography.',
        icon_url: null,
        banner_url: null,
        community_type: 'public',
        linked_module_id: 'market',
        member_count: 1,
        thread_count: 0,
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const supabase = createSupabase({ fr_communities: table });

    const result = await cloudCreateCommunity(supabase as any, {
      name: 'camera-club',
      displayName: 'Camera Club',
      description: 'Talk lenses and street photography.',
      communityType: 'public',
      linkedModuleId: 'market',
    });

    expect(table.state.insertPayload).toEqual({
      creator_id: 'profile-1',
      name: 'camera-club',
      display_name: 'Camera Club',
      description: 'Talk lenses and street photography.',
      community_type: 'public',
      linked_module_id: 'market',
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        creatorId: 'profile-1',
        displayName: 'Camera Club',
        communityType: 'public',
        linkedModuleId: 'market',
      },
    });
    expect(emitForumCommunityCreated).toHaveBeenCalledTimes(1);
  });

  it('writes snake_case report payloads', async () => {
    const table = createBuilder({
      data: {
        id: 'report-1',
        reporter_id: 'profile-1',
        community_id: 'community-1',
        target_type: 'thread',
        target_id: 'thread-1',
        reason: 'spam',
        details: 'Repeated marketplace spam.',
        created_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const supabase = createSupabase({ fr_reports: table });

    const result = await cloudCreateReport(supabase as any, {
      communityId: 'community-1',
      targetType: 'thread',
      targetId: 'thread-1',
      reason: 'spam',
      details: 'Repeated marketplace spam.',
    });

    expect(table.state.insertPayload).toEqual({
      reporter_id: 'profile-1',
      community_id: 'community-1',
      target_type: 'thread',
      target_id: 'thread-1',
      reason: 'spam',
      details: 'Repeated marketplace spam.',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'report-1',
        reporterId: 'profile-1',
        communityId: 'community-1',
        targetType: 'thread',
        targetId: 'thread-1',
        reason: 'spam',
        details: 'Repeated marketplace spam.',
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('maps user stats into camelCase fields', async () => {
    const supabase = createSupabase({
      fr_user_stats: createBuilder({
        data: {
          profile_id: 'profile-1',
          thread_count: 9,
          reply_count: 27,
          karma: 42,
          communities_joined: 3,
        },
        error: null,
      }),
    });

    const result = await cloudGetUserStats(supabase as any, 'profile-1');

    expect(result).toEqual({
      ok: true,
      data: {
        profileId: 'profile-1',
        threadCount: 9,
        replyCount: 27,
        karma: 42,
        communitiesJoined: 3,
      },
    });
  });
});
