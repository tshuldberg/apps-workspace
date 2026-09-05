import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeSupabase, type MockConfig, type MockResult } from './_supabase-mock';
import {
  getMySubscriptionForTrainer,
  getTrainerEarnings,
  isSubscriptionActive,
  listMyActiveSubscriptions,
  waitForActiveSubscription,
  type MyTrainerSubscription,
} from '../cloud-subscriptions';

interface SubsMockConfig {
  responses?: MockConfig['responses'];
  rpc?: (name: string, params: unknown) => MockResult;
  userId?: string | null;
}

function makeSubsSupabase(cfg: SubsMockConfig = {}): {
  supabase: SupabaseClient;
  rpc: ReturnType<typeof vi.fn>;
} {
  const base = makeSupabase({ responses: cfg.responses ?? {} }, { userId: cfg.userId ?? null });
  const rpc = vi.fn(async (name: string, params: unknown) =>
    cfg.rpc ? cfg.rpc(name, params) : { data: null, error: { message: `no rpc mock for ${name}` } },
  );
  const supabase = {
    ...(base as unknown as Record<string, unknown>),
    rpc,
  } as unknown as SupabaseClient;
  return { supabase, rpc };
}

const RAW_ACTIVE = {
  id: 'sub-1',
  user_id: 'user-1',
  trainer_id: 'trainer-1',
  product_id: 'dowork_trainer_tier_1',
  store: 'app_store',
  status: 'active',
  current_period_end: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

function activeSub(overrides: Partial<MyTrainerSubscription> = {}): MyTrainerSubscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    trainerId: 'trainer-1',
    productId: 'dowork_trainer_tier_1',
    store: 'app_store',
    status: 'active',
    currentPeriodEnd: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('isSubscriptionActive', () => {
  it('is active when status is active and period end is null', () => {
    expect(isSubscriptionActive(activeSub())).toBe(true);
  });

  it('is active when the period end is in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isSubscriptionActive(activeSub({ currentPeriodEnd: future }))).toBe(true);
  });

  it('is not active when the period end has passed', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isSubscriptionActive(activeSub({ currentPeriodEnd: past }))).toBe(false);
  });

  it('keeps paid-through access for a cancelled sub until the period ends', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      isSubscriptionActive(activeSub({ status: 'cancelled', currentPeriodEnd: future })),
    ).toBe(true);
  });

  it('revokes a cancelled sub once the paid period has passed', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isSubscriptionActive(activeSub({ status: 'cancelled', currentPeriodEnd: past }))).toBe(
      false,
    );
  });

  it('requires a provable future period for cancelled subs', () => {
    // cancelled with no or unparseable period end: no paid-through claim.
    expect(isSubscriptionActive(activeSub({ status: 'cancelled' }))).toBe(false);
    expect(
      isSubscriptionActive(activeSub({ status: 'cancelled', currentPeriodEnd: 'not-a-date' })),
    ).toBe(false);
  });

  it('is not active for expired or billing_issue statuses', () => {
    expect(isSubscriptionActive(activeSub({ status: 'expired' }))).toBe(false);
    expect(isSubscriptionActive(activeSub({ status: 'billing_issue' }))).toBe(false);
  });

  it('trusts an active status when the period end is unparseable', () => {
    expect(isSubscriptionActive(activeSub({ currentPeriodEnd: 'not-a-date' }))).toBe(true);
  });
});

describe('getMySubscriptionForTrainer', () => {
  it('maps the subscription row when present', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: RAW_ACTIVE, error: null } },
    });
    const result = await getMySubscriptionForTrainer(supabase, 'user-1', 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subscription?.status).toBe('active');
      expect(result.subscription?.productId).toBe('dowork_trainer_tier_1');
    }
  });

  it('returns null when no row exists', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: null, error: null } },
    });
    const result = await getMySubscriptionForTrainer(supabase, 'user-1', 'trainer-1');
    expect(result).toEqual({ ok: true, subscription: null });
  });

  it('returns null without querying when the user id is empty', async () => {
    const { supabase } = makeSubsSupabase();
    const result = await getMySubscriptionForTrainer(supabase, '', 'trainer-1');
    expect(result).toEqual({ ok: true, subscription: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces a query error', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: null, error: { message: 'boom' } } },
    });
    const result = await getMySubscriptionForTrainer(supabase, 'user-1', 'trainer-1');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});

describe('listMyActiveSubscriptions', () => {
  it('maps and keeps only active, unexpired rows', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const { supabase } = makeSubsSupabase({
      responses: {
        'dw_trainer_subscriptions:select': {
          data: [
            RAW_ACTIVE,
            { ...RAW_ACTIVE, id: 'sub-2', trainer_id: 'trainer-2', current_period_end: past },
          ],
          error: null,
        },
      },
    });
    const result = await listMyActiveSubscriptions(supabase, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].trainerId).toBe('trainer-1');
    }
  });

  it('returns an empty list without querying for an empty user id', async () => {
    const { supabase } = makeSubsSupabase();
    const result = await listMyActiveSubscriptions(supabase, '');
    expect(result).toEqual({ ok: true, subscriptions: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces a query error', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: null, error: { message: 'nope' } } },
    });
    const result = await listMyActiveSubscriptions(supabase, 'user-1');
    expect(result).toEqual({ ok: false, error: 'nope' });
  });
});

describe('waitForActiveSubscription', () => {
  it('rejects missing identifiers', async () => {
    const { supabase } = makeSubsSupabase();
    const result = await waitForActiveSubscription(supabase, { userId: '', trainerId: 't' });
    expect(result.ok).toBe(false);
  });

  it('resolves active on the first poll', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: RAW_ACTIVE, error: null } },
    });
    const result = await waitForActiveSubscription(
      supabase,
      { userId: 'user-1', trainerId: 'trainer-1' },
      { now: () => 0, sleep: async () => {} },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.active).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.subscription?.id).toBe('sub-1');
    }
  });

  it('resolves active on a later poll after the webhook lands', async () => {
    let call = 0;
    const { supabase } = makeSubsSupabase({
      responses: {
        'dw_trainer_subscriptions:select': () => {
          call += 1;
          return call === 1 ? { data: null, error: null } : { data: RAW_ACTIVE, error: null };
        },
      },
    });
    let clock = 0;
    const result = await waitForActiveSubscription(
      supabase,
      { userId: 'user-1', trainerId: 'trainer-1' },
      { timeoutMs: 60_000, now: () => clock, sleep: async () => { clock += 1_000; } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.active).toBe(true);
      expect(result.attempts).toBe(2);
    }
  });

  it('returns a pending (active:false) result on timeout, not an error', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: null, error: null } },
    });
    let clock = 0;
    const result = await waitForActiveSubscription(
      supabase,
      { userId: 'user-1', trainerId: 'trainer-1' },
      { timeoutMs: 1_000, now: () => clock, sleep: async () => { clock += 2_000; } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.active).toBe(false);
      expect(result.subscription).toBeNull();
    }
  });

  it('fails hard when every poll errors before a clean response', async () => {
    const { supabase } = makeSubsSupabase({
      responses: { 'dw_trainer_subscriptions:select': { data: null, error: { message: 'offline' } } },
    });
    let clock = 0;
    const result = await waitForActiveSubscription(
      supabase,
      { userId: 'user-1', trainerId: 'trainer-1' },
      { timeoutMs: 1_000, now: () => clock, sleep: async () => { clock += 2_000; } },
    );
    expect(result).toEqual({ ok: false, error: 'offline' });
  });
});

describe('getTrainerEarnings', () => {
  it('maps RPC rows and coerces string numerics', async () => {
    const { supabase, rpc } = makeSubsSupabase({
      rpc: () => ({
        data: [
          { month: '2026-07-01T00:00:00Z', paid_events: '3', gross_usd: '14.97' },
          { month: '2026-06-01T00:00:00Z', paid_events: 1, gross_usd: 4.99 },
        ],
        error: null,
      }),
    });
    const result = await getTrainerEarnings(supabase);
    expect(rpc).toHaveBeenCalledWith('dw_get_trainer_earnings');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.months).toHaveLength(2);
      expect(result.months[0]).toEqual({ month: '2026-07-01T00:00:00Z', paidEvents: 3, grossUsd: 14.97 });
      expect(result.months[1].grossUsd).toBe(4.99);
    }
  });

  it('returns an empty list when the RPC has no rows', async () => {
    const { supabase } = makeSubsSupabase({ rpc: () => ({ data: [], error: null }) });
    const result = await getTrainerEarnings(supabase);
    expect(result).toEqual({ ok: true, months: [] });
  });

  it('surfaces an RPC error', async () => {
    const { supabase } = makeSubsSupabase({ rpc: () => ({ data: null, error: { message: 'denied' } }) });
    const result = await getTrainerEarnings(supabase);
    expect(result).toEqual({ ok: false, error: 'denied' });
  });
});
