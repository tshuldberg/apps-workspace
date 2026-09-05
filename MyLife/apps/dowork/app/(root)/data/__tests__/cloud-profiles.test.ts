import { describe, expect, it } from 'vitest';
import { makeSupabase, type MockResult } from './_supabase-mock';
import { ensureUserProfile, generateHandle, getPublicProfiles } from '../cloud-profiles';

const PROFILE_ROW = {
  user_id: 'user-1',
  handle: 'lifter_abc123',
  display_name: null,
  avatar_url: null,
  bio: null,
};

describe('generateHandle', () => {
  it('is deterministic on the first attempt', () => {
    const a = generateHandle('aabbccdd-1111-2222-3333-444455556666', 0);
    const b = generateHandle('aabbccdd-1111-2222-3333-444455556666', 0);
    expect(a).toBe(b);
    expect(a).toBe('lifter_aabbcc');
  });

  it('randomizes on retry attempts', () => {
    const handle = generateHandle('aabbccdd-1111-2222-3333-444455556666', 1);
    expect(handle).toMatch(/^lifter_[a-z0-9]+$/);
    expect(handle).not.toBe('lifter_aabbcc');
  });
});

describe('ensureUserProfile', () => {
  it('returns the existing profile without inserting', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_profiles:select': { data: PROFILE_ROW, error: null },
      },
    });
    const result = await ensureUserProfile(supabase, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.handle).toBe('lifter_abc123');
  });

  it('creates a profile with a generated handle when missing', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_profiles:select': { data: null, error: null },
        'dw_user_profiles:insert': { data: PROFILE_ROW, error: null },
      },
    });
    const result = await ensureUserProfile(supabase, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.userId).toBe('user-1');
  });

  it('retries with a new handle on a handle collision', async () => {
    let inserts = 0;
    const insertResponse = (): MockResult => {
      inserts += 1;
      if (inserts === 1) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "dw_user_profiles_handle_key" (23505)' } };
      }
      return { data: PROFILE_ROW, error: null };
    };
    const supabase = makeSupabase({
      responses: {
        'dw_user_profiles:select': { data: null, error: null },
        'dw_user_profiles:insert': insertResponse,
      },
    });
    const result = await ensureUserProfile(supabase, 'user-1');
    expect(result.ok).toBe(true);
    expect(inserts).toBe(2);
  });

  it('surfaces non-unique insert errors', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_user_profiles:select': { data: null, error: null },
        'dw_user_profiles:insert': { data: null, error: { message: 'permission denied' } },
      },
    });
    const result = await ensureUserProfile(supabase, 'user-1');
    expect(result.ok).toBe(false);
  });
});

describe('getPublicProfiles', () => {
  it('returns an empty map for no ids without querying', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await getPublicProfiles(supabase, []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profiles.size).toBe(0);
  });

  it('maps rows by user id', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_public_profiles:select': {
          data: [PROFILE_ROW, { ...PROFILE_ROW, user_id: 'user-2', handle: 'lifter_x' }],
          error: null,
        },
      },
    });
    const result = await getPublicProfiles(supabase, ['user-1', 'user-2', 'user-1']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profiles.get('user-1')?.handle).toBe('lifter_abc123');
      expect(result.profiles.get('user-2')?.handle).toBe('lifter_x');
    }
  });
});
