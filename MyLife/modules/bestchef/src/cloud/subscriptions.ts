/**
 * Creator subscription records and launch availability.
 *
 * BestChef does not accept paid creator subscriptions at launch. The payment
 * entry point returns a typed unavailable result and never creates a record.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import {
  PAYMENTS_NOT_LAUNCHED,
  type PaymentsUnavailableResult,
} from './tips';
import type { Subscription, SubscriptionTier } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mappers ─────────────────────────────────────────────────────

function mapTier(row: Record<string, unknown>): SubscriptionTier {
  return {
    id: row.id as string,
    chefId: row.chef_id as string,
    name: row.name as string,
    description: row.description as string,
    priceCents: row.price_cents as number,
    benefits: row.benefits,
    sortOrder: row.sort_order as number,
    createdAt: new Date(row.created_at as string),
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    subscriberId: row.subscriber_id as string,
    chefId: row.chef_id as string,
    tierName: row.tier_name as string,
    priceCents: row.price_cents as number,
    platformFeeCents: row.platform_fee_cents as number,
    status: (row.status as Subscription['status']) ?? 'active',
    currentPeriodStart: new Date(row.current_period_start as string),
    currentPeriodEnd: new Date(row.current_period_end as string),
    stripeSubscriptionId: row.stripe_subscription_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ── Options ─────────────────────────────────────────────────────────

export interface GetSubscribersOptions {
  limit?: number;
  offset?: number;
}

// ── Tier CRUD ───────────────────────────────────────────────────────

export async function createSubscriptionTier(
  chefId: string,
  name: string,
  description: string,
  priceCents: number,
  benefits: unknown,
): Promise<BestChefResult<SubscriptionTier>> {
  if (name.trim().length === 0) {
    return err('Tier name cannot be empty');
  }
  if (priceCents < 0) {
    return err('Price cannot be negative');
  }

  // Determine sort order by counting existing tiers
  const { count } = await from('bc_subscription_tiers')
    .select('*', { count: 'exact', head: true })
    .eq('chef_id', chefId);

  const { data, error: dbErr } = await from('bc_subscription_tiers')
    .insert({
      chef_id: chefId,
      name: name.trim(),
      description,
      price_cents: priceCents,
      benefits,
      sort_order: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapTier(data));
}

export async function getSubscriptionTiers(
  chefId: string,
): Promise<BestChefResult<SubscriptionTier[]>> {
  const { data, error: dbErr } = await from('bc_subscription_tiers')
    .select('*')
    .eq('chef_id', chefId)
    .order('sort_order', { ascending: true });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapTier));
}

export async function updateSubscriptionTier(
  tierId: string,
  updates: Partial<Pick<SubscriptionTier, 'name' | 'description' | 'priceCents' | 'benefits' | 'sortOrder'>>,
): Promise<BestChefResult<SubscriptionTier>> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.priceCents !== undefined) dbUpdates.price_cents = updates.priceCents;
  if (updates.benefits !== undefined) dbUpdates.benefits = updates.benefits;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

  const { data, error: dbErr } = await from('bc_subscription_tiers')
    .update(dbUpdates)
    .eq('id', tierId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapTier(data));
}

export async function deleteSubscriptionTier(
  tierId: string,
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_subscription_tiers')
    .delete()
    .eq('id', tierId);

  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

// ── Subscription lifecycle ──────────────────────────────────────────

export async function subscribe(
  _subscriberId: string,
  _chefId: string,
  _tierId: string,
): Promise<PaymentsUnavailableResult> {
  return PAYMENTS_NOT_LAUNCHED;
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<BestChefResult<Subscription>> {
  const { data, error: dbErr } = await from('bc_subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapSubscription(data));
}

export async function getMySubscriptions(
  subscriberId: string,
): Promise<BestChefResult<Subscription[]>> {
  const { data, error: dbErr } = await from('bc_subscriptions')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapSubscription));
}

export async function getSubscribersForChef(
  chefId: string,
  options?: GetSubscribersOptions,
): Promise<BestChefResult<Subscription[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_subscriptions')
    .select('*')
    .eq('chef_id', chefId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapSubscription));
}

export async function getSubscriberCount(
  chefId: string,
): Promise<BestChefResult<number>> {
  const { count, error: dbErr } = await from('bc_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('chef_id', chefId)
    .eq('status', 'active');

  if (dbErr) return err(dbErr.message);
  return ok(count ?? 0);
}

export async function isSubscribed(
  subscriberId: string,
  chefId: string,
): Promise<BestChefResult<boolean>> {
  const { count, error: dbErr } = await from('bc_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('subscriber_id', subscriberId)
    .eq('chef_id', chefId)
    .eq('status', 'active');

  if (dbErr) return err(dbErr.message);
  return ok((count ?? 0) > 0);
}

export async function getSubscriptionRevenue(
  chefId: string,
): Promise<BestChefResult<number>> {
  const { data, error: dbErr } = await from('bc_subscriptions')
    .select('price_cents, platform_fee_cents')
    .eq('chef_id', chefId)
    .eq('status', 'active');

  if (dbErr) return err(dbErr.message);

  const total = (data ?? []).reduce((sum: number, row: Record<string, unknown>) => {
    const price = row.price_cents as number;
    const fee = row.platform_fee_cents as number;
    return sum + (price - fee);
  }, 0);

  return ok(total);
}
