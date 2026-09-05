import { describe, expect, it, vi } from 'vitest';

// ── Cloud client tests ──────────────────────────────────────────────

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

import { cloudGetCommunityByModule } from '../cloud/client';

type QueryResult = { data: unknown; error: unknown };

function createBuilder(result: QueryResult) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
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
  return builder;
}

function createSupabase(tables: Record<string, any>) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => {
      const response = tables[table];
      if (!response) throw new Error(`Missing table mock for ${table}`);
      return response;
    }),
    rpc: vi.fn(),
  };
}

describe('cloudGetCommunityByModule', () => {
  it('returns the community linked to a module', async () => {
    const builder = createBuilder({
      data: [
        {
          id: 'community-cycle',
          creator_id: '00000000-0000-0000-0000-000000000000',
          name: 'mycycle',
          display_name: 'MyCycle Community',
          description: 'Cycle discussions',
          icon_url: null,
          banner_url: null,
          community_type: 'public',
          humans_only: false,
          linked_module_id: 'cycle',
          member_count: 42,
          thread_count: 7,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const supabase = createSupabase({ fr_communities: builder });

    const result = await cloudGetCommunityByModule(supabase as any, 'cycle');

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'community-cycle',
        creatorId: '00000000-0000-0000-0000-000000000000',
        name: 'mycycle',
        displayName: 'MyCycle Community',
        description: 'Cycle discussions',
        iconUrl: null,
        bannerUrl: null,
        communityType: 'public',
        humansOnly: false,
        linkedModuleId: 'cycle',
        memberCount: 42,
        threadCount: 7,
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
      },
    });

    expect(builder.eq).toHaveBeenCalledWith('linked_module_id', 'cycle');
    expect(builder.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no community is linked to the module', async () => {
    const builder = createBuilder({ data: [], error: null });
    const supabase = createSupabase({ fr_communities: builder });

    const result = await cloudGetCommunityByModule(supabase as any, 'nonexistent');

    expect(result).toEqual({ ok: true, data: null });
  });

  it('returns error on Supabase failure', async () => {
    const builder = createBuilder({ data: null, error: 'connection failed' });
    const supabase = createSupabase({ fr_communities: builder });

    const result = await cloudGetCommunityByModule(supabase as any, 'cycle');

    expect(result).toEqual({ ok: false, error: 'connection failed' });
  });
});

// ── Cache CRUD tests ────────────────────────────────────────────────

import { getCachedCommunityByModule } from '../db/crud';

function createMockDb() {
  const store: Record<string, unknown[]> = {};
  return {
    run: vi.fn(),
    get: vi.fn((_sql: string, params?: unknown[]) => {
      const moduleId = params?.[0];
      const key = `module:${moduleId}`;
      return store[key]?.[0];
    }),
    all: vi.fn((_sql: string, params?: unknown[]) => {
      const moduleId = params?.[0];
      const key = `module:${moduleId}`;
      return store[key] ?? [];
    }),
    _seed: (moduleId: string, community: unknown) => {
      store[`module:${moduleId}`] = [community];
    },
  };
}

describe('getCachedCommunityByModule', () => {
  it('returns a community for a linked module', () => {
    const db = createMockDb();
    const community = {
      id: 'c1',
      creatorId: 'system',
      name: 'mycycle',
      displayName: 'MyCycle Community',
      description: null,
      iconUrl: null,
      bannerUrl: null,
      communityType: 'public',
      humansOnly: false,
      linkedModuleId: 'cycle',
      memberCount: 0,
      threadCount: 0,
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z',
    };
    db._seed('cycle', community);

    const result = getCachedCommunityByModule(db as any, 'cycle');

    expect(result).toEqual(community);
    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('linked_module_id'),
      ['cycle'],
    );
  });

  it('returns undefined when no community is linked', () => {
    const db = createMockDb();

    const result = getCachedCommunityByModule(db as any, 'nonexistent');

    expect(result).toBeUndefined();
  });
});
