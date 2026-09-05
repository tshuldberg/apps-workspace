// DoWork user-blocking contract tests.

import { describe, expect, it } from 'vitest';
import { blockUser, listBlockedUserIds, unblockUser } from '../cloud-blocks';
import { makeSupabase } from './_supabase-mock';

describe('blockUser', () => {
  it('blocks a user', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:insert': { data: null, error: null },
      },
    });
    const result = await blockUser(supabase, 'user-1', 'user-2');
    expect(result).toEqual({ ok: true });
  });

  it('requires both user ids', async () => {
    const supabase = makeSupabase({ responses: {} });
    expect(await blockUser(supabase, '', 'user-2')).toEqual({
      ok: false,
      error: 'Both user ids are required.',
    });
    expect(await blockUser(supabase, 'user-1', '')).toEqual({
      ok: false,
      error: 'Both user ids are required.',
    });
  });

  it('rejects blocking yourself without calling the network', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await blockUser(supabase, 'user-1', 'user-1');
    expect(result).toEqual({ ok: false, error: 'You cannot block yourself.' });
  });

  it('treats an already-blocked duplicate as success', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:insert': {
          data: null,
          error: { message: 'duplicate key value violates unique constraint', code: '23505' },
        },
      },
    });
    const result = await blockUser(supabase, 'user-1', 'user-2');
    expect(result).toEqual({ ok: true });
  });

  it('surfaces a genuine insert error', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:insert': { data: null, error: { message: 'network request failed' } },
      },
    });
    const result = await blockUser(supabase, 'user-1', 'user-2');
    expect(result).toEqual({ ok: false, error: 'network request failed' });
  });
});

describe('unblockUser', () => {
  it('unblocks a user', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:delete': { data: null, error: null },
      },
    });
    const result = await unblockUser(supabase, 'user-1', 'user-2');
    expect(result).toEqual({ ok: true });
  });

  it('surfaces a delete error', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:delete': { data: null, error: { message: 'network request failed' } },
      },
    });
    const result = await unblockUser(supabase, 'user-1', 'user-2');
    expect(result).toEqual({ ok: false, error: 'network request failed' });
  });
});

describe('listBlockedUserIds', () => {
  it('returns an empty set for an empty user id without calling the network', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await listBlockedUserIds(supabase, '');
    expect(result).toEqual({ ok: true, blockedUserIds: new Set() });
  });

  it('returns the blocked user id set', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:select': {
          data: [{ blocked_user_id: 'u2' }, { blocked_user_id: 'u3' }],
          error: null,
        },
      },
    });
    const result = await listBlockedUserIds(supabase, 'u1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blockedUserIds).toEqual(new Set(['u2', 'u3']));
    }
  });

  it('surfaces a select error', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_blocks:select': { data: null, error: { message: 'network request failed' } },
      },
    });
    const result = await listBlockedUserIds(supabase, 'u1');
    expect(result).toEqual({ ok: false, error: 'network request failed' });
  });
});
