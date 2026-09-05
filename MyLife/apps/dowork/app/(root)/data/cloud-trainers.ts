// DoWork cloud trainer identity helpers.
//
// A user IS a trainer when a dw_trainers row exists for their auth user.
// Rows are created ONLY by the dowork-redeem-invite edge function (invite
// gated), so the client never inserts here. This module reads the directory,
// the public profile, and the caller's own row, plus writes the owner-editable
// profile fields (headline, specialties, socials, hero, price tier). The
// protect trigger on dw_trainers blocks is_verified / is_active /
// subscriber_count, so those are never sent from the client.

import type { SupabaseClient } from '@supabase/supabase-js';

const TRAINERS_TABLE = 'dw_trainers';

const TRAINER_COLUMNS =
  'id,user_id,display_name,bio,handle,headline,specialties,instagram,website,hero_image_path,is_active,is_verified,price_tier,subscriber_count,created_at';

export interface CloudTrainerProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  handle: string | null;
  headline: string | null;
  specialties: string[];
  instagram: string | null;
  website: string | null;
  heroImagePath: string | null;
  priceTier: number;
  subscriberCount: number;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export type CloudTrainersResult<T> = ({ ok: true } & T) | { ok: false; error: string };

interface RawTrainerRow {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  handle: string | null;
  headline: string | null;
  specialties: string[] | null;
  instagram: string | null;
  website: string | null;
  hero_image_path: string | null;
  is_active: boolean;
  is_verified: boolean;
  price_tier: number | null;
  subscriber_count: number | null;
  created_at: string;
}

// The fixed 8-tier subscription ladder ($4.99 .. $39.99). price_tier on a
// trainer row selects the RevenueCat product on their profile (Phase 5). The
// product ids match dowork_trainer_tier_1..8.
export interface TrainerPriceTier {
  tier: number;
  priceUsd: number;
  label: string;
  productId: string;
}

export const TRAINER_PRICE_TIERS: readonly TrainerPriceTier[] = [
  { tier: 1, priceUsd: 4.99, label: '$4.99/mo', productId: 'dowork_trainer_tier_1' },
  { tier: 2, priceUsd: 9.99, label: '$9.99/mo', productId: 'dowork_trainer_tier_2' },
  { tier: 3, priceUsd: 14.99, label: '$14.99/mo', productId: 'dowork_trainer_tier_3' },
  { tier: 4, priceUsd: 19.99, label: '$19.99/mo', productId: 'dowork_trainer_tier_4' },
  { tier: 5, priceUsd: 24.99, label: '$24.99/mo', productId: 'dowork_trainer_tier_5' },
  { tier: 6, priceUsd: 29.99, label: '$29.99/mo', productId: 'dowork_trainer_tier_6' },
  { tier: 7, priceUsd: 34.99, label: '$34.99/mo', productId: 'dowork_trainer_tier_7' },
  { tier: 8, priceUsd: 39.99, label: '$39.99/mo', productId: 'dowork_trainer_tier_8' },
] as const;

export function getTrainerPriceTier(tier: number): TrainerPriceTier {
  return TRAINER_PRICE_TIERS.find((entry) => entry.tier === tier) ?? TRAINER_PRICE_TIERS[0];
}

export function formatTrainerPrice(tier: number): string {
  return getTrainerPriceTier(tier).label;
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function toProfile(raw: RawTrainerRow): CloudTrainerProfile {
  return {
    id: raw.id,
    userId: raw.user_id,
    displayName: raw.display_name,
    bio: raw.bio ?? '',
    handle: raw.handle ?? null,
    headline: raw.headline ?? null,
    specialties: Array.isArray(raw.specialties) ? raw.specialties : [],
    instagram: raw.instagram ?? null,
    website: raw.website ?? null,
    heroImagePath: raw.hero_image_path ?? null,
    priceTier: typeof raw.price_tier === 'number' ? raw.price_tier : 1,
    subscriberCount: typeof raw.subscriber_count === 'number' ? raw.subscriber_count : 0,
    isActive: raw.is_active,
    isVerified: raw.is_verified,
    createdAt: raw.created_at,
  };
}

// The signed-in user's own trainer profile, or null when they are not a
// trainer. Owner RLS (dw_trainers_owner_select) covers inactive rows too.
export async function getMyTrainerProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudTrainersResult<{ trainer: CloudTrainerProfile | null }>> {
  if (!userId) return { ok: true, trainer: null };
  try {
    const result = await supabase
      .from(TRAINERS_TABLE)
      .select(TRAINER_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: true, trainer: null };
    return { ok: true, trainer: toProfile(result.data as RawTrainerRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Directory listing for the Trainers tab. Filters verified AND active rows
// (all trainers come from invites now, but the verified filter is kept as a
// belt), ordered by subscriber count so the most-followed trainer is featured.
export async function listActiveTrainers(
  supabase: SupabaseClient,
): Promise<CloudTrainersResult<{ trainers: CloudTrainerProfile[] }>> {
  try {
    const result = await supabase
      .from(TRAINERS_TABLE)
      .select(TRAINER_COLUMNS)
      .eq('is_active', true)
      .eq('is_verified', true)
      .order('subscriber_count', { ascending: false })
      .order('created_at', { ascending: true });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const raw = (result.data ?? []) as RawTrainerRow[];
    return { ok: true, trainers: raw.map(toProfile) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Public profile lookup by handle. Verified + active only so an unverified or
// deactivated handle 404s at the screen level.
export async function getTrainerByHandle(
  supabase: SupabaseClient,
  handle: string,
): Promise<CloudTrainersResult<{ trainer: CloudTrainerProfile | null }>> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return { ok: true, trainer: null };
  try {
    const result = await supabase
      .from(TRAINERS_TABLE)
      .select(TRAINER_COLUMNS)
      .eq('handle', normalized)
      .eq('is_active', true)
      .eq('is_verified', true)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: true, trainer: null };
    return { ok: true, trainer: toProfile(result.data as RawTrainerRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface TrainerProfilePatch {
  headline?: string | null;
  specialties?: string[];
  instagram?: string | null;
  website?: string | null;
  heroImagePath?: string | null;
  priceTier?: number;
}

// Owner-only profile edit. Only the owner-editable columns are ever sent; the
// protect trigger rejects is_verified / is_active / subscriber_count writes, so
// this client never attempts them. price_tier is clamped to the 1..8 ladder.
export async function updateMyTrainerProfile(
  supabase: SupabaseClient,
  trainerId: string,
  patch: TrainerProfilePatch,
): Promise<CloudTrainersResult<{ trainer: CloudTrainerProfile }>> {
  if (!trainerId) return { ok: false, error: 'A trainer id is required.' };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.headline !== undefined) update.headline = patch.headline?.trim() || null;
  if (patch.instagram !== undefined) update.instagram = patch.instagram?.trim() || null;
  if (patch.website !== undefined) update.website = patch.website?.trim() || null;
  if (patch.heroImagePath !== undefined) update.hero_image_path = patch.heroImagePath?.trim() || null;
  if (patch.specialties !== undefined) {
    update.specialties = patch.specialties
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 12);
  }
  if (patch.priceTier !== undefined) {
    const tier = Math.round(patch.priceTier);
    if (!Number.isFinite(tier) || tier < 1 || tier > 8) {
      return { ok: false, error: 'Price tier must be between 1 and 8.' };
    }
    update.price_tier = tier;
  }

  try {
    const result = await supabase
      .from(TRAINERS_TABLE)
      .update(update)
      .eq('id', trainerId)
      .select(TRAINER_COLUMNS)
      .single();

    if (result.error || !result.data) {
      return { ok: false, error: errMessage(result.error) };
    }
    return { ok: true, trainer: toProfile(result.data as RawTrainerRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
