import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  blockProfileCloud,
  unblockProfileCloud,
  listBlockedProfileIdsCloud,
  isProfileBlockedCloud,
} from '../cloud-blocks';

interface MockResult {
  data?: unknown;
  error: { message: string } | null;
}

function mockClient(result: MockResult) {
  const builder = {
    upsert: vi.fn().mockResolvedValue(result),
    delete: vi.fn(() => builder),
    match: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
    eq: vi.fn().mockResolvedValue(result),
  };
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, builder };
}

describe('cloud-blocks', () => {
  it('blocks a profile via bc_blocks upsert', async () => {
    const { client, from, builder } = mockClient({ error: null });
    const res = await blockProfileCloud(client, 'viewer', 'target');
    expect(res.ok).toBe(true);
    expect(from).toHaveBeenCalledWith('bc_blocks');
    expect(builder.upsert).toHaveBeenCalledWith(
      { blocker_id: 'viewer', blocked_id: 'target' },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  });

  it('refuses to block self or empty target without calling the network', async () => {
    const { client, from } = mockClient({ error: null });
    expect((await blockProfileCloud(client, 'me', 'me')).ok).toBe(false);
    expect((await blockProfileCloud(client, '', 'x')).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a server error', async () => {
    const { client } = mockClient({ error: { message: 'rls denied' } });
    const res = await blockProfileCloud(client, 'viewer', 'target');
    expect(res).toEqual({ ok: false, error: 'rls denied' });
  });

  it('unblocks a profile via delete().match()', async () => {
    const { client, builder } = mockClient({ error: null });
    const res = await unblockProfileCloud(client, 'viewer', 'target');
    expect(res.ok).toBe(true);
    expect(builder.match).toHaveBeenCalledWith({ blocker_id: 'viewer', blocked_id: 'target' });
  });

  it('lists blocked profile ids and drops empties', async () => {
    const { client } = mockClient({
      data: [{ blocked_id: 'a' }, { blocked_id: '' }, { blocked_id: 'b' }],
      error: null,
    });
    const ids = await listBlockedProfileIdsCloud(client, 'viewer');
    expect(ids).toEqual(['a', 'b']);
  });

  it('returns an empty list on error', async () => {
    const { client } = mockClient({ data: null, error: { message: 'boom' } });
    expect(await listBlockedProfileIdsCloud(client, 'viewer')).toEqual([]);
  });

  function singleRowClient(result: MockResult) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const match = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ match }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as SupabaseClient, from, match };
  }

  it('reads the authoritative cloud block state (cloud wins)', async () => {
    const blockedCase = singleRowClient({ data: { blocked_id: 'target' }, error: null });
    expect(await isProfileBlockedCloud(blockedCase.client, 'viewer', 'target')).toBe(true);
    expect(blockedCase.match).toHaveBeenCalledWith({ blocker_id: 'viewer', blocked_id: 'target' });

    const unblockedCase = singleRowClient({ data: null, error: null });
    expect(await isProfileBlockedCloud(unblockedCase.client, 'viewer', 'target')).toBe(false);
  });

  it('returns null (keep local answer) when the cloud state is unreadable', async () => {
    const errorCase = singleRowClient({ data: null, error: { message: 'offline' } });
    expect(await isProfileBlockedCloud(errorCase.client, 'viewer', 'target')).toBe(null);

    const invalid = singleRowClient({ data: null, error: null });
    expect(await isProfileBlockedCloud(invalid.client, '', 'target')).toBe(null);
    expect(invalid.from).not.toHaveBeenCalled();
  });
});
