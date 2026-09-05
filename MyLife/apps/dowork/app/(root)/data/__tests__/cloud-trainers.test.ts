// DoWork cloud-trainers contract tests.

import { describe, expect, it } from 'vitest';
import {
  TRAINER_PRICE_TIERS,
  formatTrainerPrice,
  getMyTrainerProfile,
  getTrainerByHandle,
  getTrainerPriceTier,
  listActiveTrainers,
  updateMyTrainerProfile,
} from '../cloud-trainers';
import { makeSupabase } from './_supabase-mock';

const RAW_TRAINER = {
  id: 't1',
  user_id: 'u1',
  display_name: 'Marcus Vale',
  bio: 'Strength coach',
  handle: 'marcus-vale',
  headline: 'Barbell strength for real life',
  specialties: ['Powerlifting', 'Mobility'],
  instagram: 'marcusvale',
  website: 'https://marcus.fit',
  hero_image_path: 'https://cdn.example.com/hero.jpg',
  is_active: true,
  is_verified: true,
  price_tier: 3,
  subscriber_count: 42,
  created_at: '2026-01-01T00:00:00Z',
};

describe('cloud-trainers price tiers', () => {
  it('exposes the fixed 8-tier ladder', () => {
    expect(TRAINER_PRICE_TIERS).toHaveLength(8);
    expect(TRAINER_PRICE_TIERS[0]).toMatchObject({ tier: 1, priceUsd: 4.99 });
    expect(TRAINER_PRICE_TIERS[7]).toMatchObject({ tier: 8, priceUsd: 39.99 });
  });

  it('resolves a tier and falls back to tier 1 for out-of-range input', () => {
    expect(getTrainerPriceTier(3).priceUsd).toBe(14.99);
    expect(getTrainerPriceTier(99).tier).toBe(1);
    expect(formatTrainerPrice(2)).toBe('$9.99/mo');
  });
});

describe('getMyTrainerProfile', () => {
  it('returns null trainer without a user id', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await getMyTrainerProfile(supabase, '');
    expect(result).toEqual({ ok: true, trainer: null });
  });

  it('hydrates the caller row', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: RAW_TRAINER, error: null } },
    });
    const result = await getMyTrainerProfile(supabase, 'u1');
    expect(result.ok).toBe(true);
    if (result.ok && result.trainer) {
      expect(result.trainer.handle).toBe('marcus-vale');
      expect(result.trainer.specialties).toEqual(['Powerlifting', 'Mobility']);
      expect(result.trainer.priceTier).toBe(3);
    }
  });

  it('returns null when no row exists', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: null, error: null } },
    });
    const result = await getMyTrainerProfile(supabase, 'u1');
    expect(result).toEqual({ ok: true, trainer: null });
  });

  it('propagates a supabase error', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: null, error: { message: 'rls denied' } } },
    });
    const result = await getMyTrainerProfile(supabase, 'u1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rls denied');
  });
});

describe('listActiveTrainers', () => {
  it('maps verified active rows', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: [RAW_TRAINER], error: null } },
    });
    const result = await listActiveTrainers(supabase);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]?.subscriberCount).toBe(42);
    }
  });

  it('defaults specialties and price tier when columns are absent', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_trainers:select': {
          data: [{ ...RAW_TRAINER, specialties: null, price_tier: null, subscriber_count: null }],
          error: null,
        },
      },
    });
    const result = await listActiveTrainers(supabase);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trainers[0]?.specialties).toEqual([]);
      expect(result.trainers[0]?.priceTier).toBe(1);
      expect(result.trainers[0]?.subscriberCount).toBe(0);
    }
  });

  it('propagates the supabase error', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: null, error: { message: 'broke' } } },
    });
    const result = await listActiveTrainers(supabase);
    expect(result.ok).toBe(false);
  });
});

describe('getTrainerByHandle', () => {
  it('returns null for an empty handle', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await getTrainerByHandle(supabase, '   ');
    expect(result).toEqual({ ok: true, trainer: null });
  });

  it('hydrates a matched handle', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: RAW_TRAINER, error: null } },
    });
    const result = await getTrainerByHandle(supabase, 'Marcus-Vale');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.trainer?.displayName).toBe('Marcus Vale');
  });

  it('returns null when no handle matches', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: null, error: null } },
    });
    const result = await getTrainerByHandle(supabase, 'ghost');
    expect(result).toEqual({ ok: true, trainer: null });
  });

  it('propagates a supabase error', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:select': { data: null, error: { message: 'oops' } } },
    });
    const result = await getTrainerByHandle(supabase, 'marcus-vale');
    expect(result.ok).toBe(false);
  });
});

describe('updateMyTrainerProfile', () => {
  it('requires a trainer id', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await updateMyTrainerProfile(supabase, '', { headline: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects an out-of-range price tier', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await updateMyTrainerProfile(supabase, 't1', { priceTier: 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/between 1 and 8/);
  });

  it('writes the owner-editable fields and returns the row', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_trainers:update': {
          data: { ...RAW_TRAINER, headline: 'New headline', price_tier: 5 },
          error: null,
        },
      },
    });
    const result = await updateMyTrainerProfile(supabase, 't1', {
      headline: 'New headline',
      specialties: [' Powerlifting ', '', 'Mobility'],
      priceTier: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trainer.headline).toBe('New headline');
      expect(result.trainer.priceTier).toBe(5);
    }
  });

  it('propagates a supabase update error', async () => {
    const supabase = makeSupabase({
      responses: { 'dw_trainers:update': { data: null, error: { message: 'denied' } } },
    });
    const result = await updateMyTrainerProfile(supabase, 't1', { headline: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('denied');
  });
});
