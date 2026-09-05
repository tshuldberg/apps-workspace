import { describe, expect, it, vi } from 'vitest';
import { runYearnRepositoryHarness } from '../repositoryHarness';
import { MemoryYearnOfflineCache } from '../../lib/offlineCache';

const fixedNow = () => new Date('2026-05-31T00:00:00.000Z');
const userId = '11111111-1111-1111-1111-111111111111';

function client({
  session = { user: { id: userId } },
  sessionError = null,
  rpc,
}: {
  session?: { user: { id: string } } | null;
  sessionError?: { message: string } | null;
  rpc: ReturnType<typeof vi.fn>;
}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: sessionError,
      }),
    },
    rpc,
  } as never;
}

describe('runYearnRepositoryHarness', () => {
  it('skips every check when Supabase is not configured', async () => {
    await expect(runYearnRepositoryHarness(null, fixedNow)).resolves.toEqual({
      status: 'not_configured',
      ranAt: '2026-05-31T00:00:00.000Z',
      checks: expect.arrayContaining([
        expect.objectContaining({ id: 'session', status: 'skip' }),
        expect.objectContaining({ id: 'discover_profiles', status: 'skip' }),
      ]),
    });
  });

  it('reports no_session before running authenticated RPCs', async () => {
    const rpc = vi.fn();
    const result = await runYearnRepositoryHarness(client({ session: null, rpc }), fixedNow);

    expect(result.status).toBe('no_session');
    expect(result.checks).toEqual([
      expect.objectContaining({ id: 'session', status: 'fail' }),
      expect.objectContaining({ id: 'current_membership', status: 'skip' }),
      expect.objectContaining({ id: 'discover_profiles', status: 'skip' }),
      expect.objectContaining({ id: 'incoming_likes', status: 'skip' }),
      expect.objectContaining({ id: 'my_matches', status: 'skip' }),
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('runs the typed Yearn RPC surface in order for a restored session', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{ is_member: false, status: 'none', expires_at: null }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await runYearnRepositoryHarness(client({ rpc }), fixedNow);

    expect(result.status).toBe('passed');
    expect(result.checks.map((check) => [check.id, check.status])).toEqual([
      ['session', 'pass'],
      ['current_membership', 'pass'],
      ['discover_profiles', 'pass'],
      ['incoming_likes', 'pass'],
      ['my_matches', 'pass'],
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, 'current_membership');
    expect(rpc).toHaveBeenNthCalledWith(2, 'discover_profiles', { p_limit: 12 });
    expect(rpc).toHaveBeenNthCalledWith(3, 'incoming_likes');
    expect(rpc).toHaveBeenNthCalledWith(4, 'my_matches');
  });

  it('keeps running independent checks and marks the harness failed when one RPC fails', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{ is_member: false, status: 'none', expires_at: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'discover_profiles: not authenticated' },
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await runYearnRepositoryHarness(client({ rpc }), fixedNow);

    expect(result.status).toBe('failed');
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'discover_profiles',
      status: 'fail',
      detail: 'discover_profiles: not authenticated',
    }));
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'incoming_likes',
      status: 'pass',
    }));
  });

  it('reports offline cache and pending mutation state when a cache is provided', async () => {
    const cache = new MemoryYearnOfflineCache();
    await cache.writeDeck([{
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Mara',
      age: 31,
      pronouns: 'they/them',
      intention: 'Intentional dating',
      relationshipStructure: 'Monogamous',
      photos: [],
      prompts: [],
      interests: [],
      isVerified: false,
    }]);
    await cache.enqueueMutation({
      id: 'mutation-1',
      type: 'pass',
      profileId: '22222222-2222-2222-2222-222222222222',
      createdAt: '2026-05-31T00:00:00.000Z',
    });

    const result = await runYearnRepositoryHarness(null, { now: fixedNow, cache });

    expect(result.status).toBe('not_configured');
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'offline_deck_cache',
      status: 'pass',
      detail: '1 cached profiles',
    }));
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'pending_mutation_queue',
      status: 'pass',
      detail: '1 queued mutations',
    }));
  });
});
