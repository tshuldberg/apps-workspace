// DoWork cloud-invites contract tests.

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { redeemTrainerInvite } from '../cloud-invites';

type InvokeResult = { data: unknown; error: unknown };

function makeSupabase(handler: (name: string, opts: { body: unknown }) => InvokeResult) {
  const invoke = vi.fn(async (name: string, opts: { body: unknown }) => handler(name, opts));
  return { supabase: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

// Builds a supabase-js style FunctionsHttpError whose `context` is the raw
// Response carrying the machine error code.
function httpError(code: string) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: { json: async () => ({ error: code }) },
  };
}

const RAW_TRAINER = {
  id: 't1',
  user_id: 'u1',
  display_name: 'Marcus Vale',
  handle: 'marcus-vale',
  headline: null,
  specialties: ['Powerlifting'],
  is_verified: true,
  is_active: true,
  price_tier: 1,
  subscriber_count: 0,
  created_at: '2026-07-03T00:00:00Z',
};

describe('redeemTrainerInvite', () => {
  it('rejects an empty code without calling the function', async () => {
    const { supabase, invoke } = makeSupabase(() => ({ data: null, error: null }));
    const result = await redeemTrainerInvite(supabase, '   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_code');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('uppercases and trims the code and forwards an optional display name', async () => {
    const { supabase, invoke } = makeSupabase(() => ({ data: { trainer: RAW_TRAINER }, error: null }));
    const result = await redeemTrainerInvite(supabase, ' abcd2345wxyz ', 'Marcus Vale');
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('dowork-redeem-invite', {
      body: { code: 'ABCD2345WXYZ', displayName: 'Marcus Vale' },
    });
  });

  it('maps a redeemed trainer row', async () => {
    const { supabase } = makeSupabase(() => ({ data: { trainer: RAW_TRAINER }, error: null }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trainer.handle).toBe('marcus-vale');
      expect(result.trainer.specialties).toEqual(['Powerlifting']);
    }
  });

  it.each([
    ['already_claimed', 'already_claimed'],
    ['expired', 'expired'],
    ['already_trainer', 'already_trainer'],
    ['invalid_code', 'invalid_code'],
    ['unauthorized', 'unauthorized'],
  ])('maps the %s http error code', async (code, expected) => {
    const { supabase } = makeSupabase(() => ({ data: null, error: httpError(code) }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(expected);
  });

  it('normalizes server_error / config_error to server_error', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: httpError('config_error') }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('server_error');
  });

  it('falls back to the message when no context is present', async () => {
    const { supabase } = makeSupabase(() => ({
      data: null,
      error: { message: 'already_claimed happened' },
    }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('already_claimed');
  });

  it('surfaces an unknown code for an opaque error', async () => {
    const { supabase } = makeSupabase(() => ({ data: null, error: { message: 'boom' } }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unknown');
  });

  it('handles a 200 envelope that carries an error code', async () => {
    const { supabase } = makeSupabase(() => ({ data: { error: 'expired' }, error: null }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('expired');
  });

  it('rejects a success response missing the trainer', async () => {
    const { supabase } = makeSupabase(() => ({ data: {}, error: null }));
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unknown');
  });

  it('maps a thrown invoke to an error result', async () => {
    const supabase = {
      functions: {
        invoke: vi.fn(async () => {
          throw new Error('network down');
        }),
      },
    } as unknown as SupabaseClient;
    const result = await redeemTrainerInvite(supabase, 'ABCD2345WXYZ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network down');
  });
});
