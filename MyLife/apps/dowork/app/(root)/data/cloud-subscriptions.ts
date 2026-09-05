// DoWork subscription + earnings cloud client (server truth).
//
// This module is the read side of monetization. It never imports
// react-native-purchases (that lives only in data/purchases.ts) so it stays in
// the test graph and screens can read entitlement without pulling native code.
//
// Entitlement truth is the SERVER: a dw_trainer_subscriptions row written by the
// dowork-rc-webhook edge function (service role) after RevenueCat confirms the
// purchase, which flips the dw_trainer_videos RLS paywall. A local store receipt
// is never sufficient on its own, so the purchase flow (purchases.ts) confirms
// against these reads before any UI treats the viewer as subscribed.
//
// Security: self-read RLS (dw_trainer_subscriptions_self_select) scopes these
// reads to the caller's own rows. Earnings go through the security-definer RPC
// dw_get_trainer_earnings(); dw_purchase_events is service-role only and is
// NEVER selected here.

import type { SupabaseClient } from '@supabase/supabase-js';

const SUBSCRIPTIONS_TABLE = 'dw_trainer_subscriptions';
const EARNINGS_RPC = 'dw_get_trainer_earnings';

const SUBSCRIPTION_COLUMNS =
  'id,user_id,trainer_id,product_id,store,status,current_period_end,created_at,updated_at';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'billing_issue';
export type SubscriptionStore = 'app_store' | 'play_store';

export interface MyTrainerSubscription {
  id: string;
  userId: string;
  trainerId: string;
  productId: string;
  store: SubscriptionStore;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerEarningsMonth {
  month: string;
  paidEvents: number;
  grossUsd: number;
}

export type SubscriptionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

interface RawSubscriptionRow {
  id: string;
  user_id: string;
  trainer_id: string;
  product_id: string | null;
  store: string | null;
  status: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

interface RawEarningsRow {
  month: string | null;
  paid_events: number | string | null;
  gross_usd: number | string | null;
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

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStatus(value: string | null): SubscriptionStatus {
  return value === 'active' || value === 'cancelled' || value === 'expired' || value === 'billing_issue'
    ? value
    : 'expired';
}

function asStore(value: string | null): SubscriptionStore {
  return value === 'play_store' ? 'play_store' : 'app_store';
}

function toSubscription(raw: RawSubscriptionRow): MyTrainerSubscription {
  return {
    id: raw.id,
    userId: raw.user_id,
    trainerId: raw.trainer_id,
    productId: raw.product_id ?? '',
    store: asStore(raw.store),
    status: asStatus(raw.status),
    currentPeriodEnd: raw.current_period_end ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toEarningsMonth(raw: RawEarningsRow): TrainerEarningsMonth {
  return {
    month: typeof raw.month === 'string' ? raw.month : '',
    paidEvents: numberOr(raw.paid_events, 0),
    grossUsd: numberOr(raw.gross_usd, 0),
  };
}

// True when a subscription grants access right now. Mirrors the DB paywall
// (dw_trainer_videos_select_entitled); the server remains the enforcement,
// this is the honest client read. Two entitled shapes:
//   - active, with period end unknown or in the future
//   - cancelled (auto-renew off) with paid time remaining: access runs to
//     current_period_end. Refunds arrive with period end <= now, so they
//     revoke immediately; EXPIRATION later flips the status to expired.
export function isSubscriptionActive(
  subscription: MyTrainerSubscription,
  nowMs: number = Date.now(),
): boolean {
  if (subscription.status === 'active') {
    if (subscription.currentPeriodEnd === null) return true;
    const end = Date.parse(subscription.currentPeriodEnd);
    if (Number.isNaN(end)) return true; // unparseable end: trust the active status
    return end > nowMs;
  }
  if (subscription.status === 'cancelled') {
    if (subscription.currentPeriodEnd === null) return false;
    const end = Date.parse(subscription.currentPeriodEnd);
    if (Number.isNaN(end)) return false; // cancelled needs a provable future period
    return end > nowMs;
  }
  return false;
}

// The caller's subscription row for one trainer, or null when none exists.
// Self-read RLS scopes this to auth.uid(); the user_id filter is belt.
export async function getMySubscriptionForTrainer(
  supabase: SupabaseClient,
  userId: string,
  trainerId: string,
): Promise<SubscriptionResult<{ subscription: MyTrainerSubscription | null }>> {
  if (!userId || !trainerId) return { ok: true, subscription: null };
  try {
    const result = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', userId)
      .eq('trainer_id', trainerId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: true, subscription: null };
    return { ok: true, subscription: toSubscription(result.data as RawSubscriptionRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Every active, unexpired subscription the caller holds, newest first. Used to
// badge trainers the viewer already subscribes to.
export async function listMyActiveSubscriptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionResult<{ subscriptions: MyTrainerSubscription[] }>> {
  if (!userId) return { ok: true, subscriptions: [] };
  try {
    const result = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as RawSubscriptionRow[];
    const nowMs = Date.now();
    const subscriptions = rows
      .map(toSubscription)
      .filter((subscription) => isSubscriptionActive(subscription, nowMs));
    return { ok: true, subscriptions };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface WaitForSubscriptionOptions {
  timeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type WaitForSubscriptionResult =
  | { ok: true; active: boolean; subscription: MyTrainerSubscription | null; attempts: number }
  | { ok: false; error: string };

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Server-truth confirmation: after a store purchase, poll the caller's
// subscription row with backoff until it goes active or the timeout elapses. The
// webhook writes the row asynchronously, so a just-purchased user starts with no
// active row; a timeout returns { active: false } (honest pending), NOT an
// error, so the UI can show "confirming" rather than "failed". A transport error
// on every attempt surfaces as { ok: false } so the UI can offer a retry.
export async function waitForActiveSubscription(
  supabase: SupabaseClient,
  params: { userId: string; trainerId: string },
  options: WaitForSubscriptionOptions = {},
): Promise<WaitForSubscriptionResult> {
  if (!params.userId || !params.trainerId) {
    return { ok: false, error: 'A signed-in account and trainer are required.' };
  }
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxDelay = options.maxDelayMs ?? 5_000;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;

  const start = now();
  let delay = options.initialDelayMs ?? 1_000;
  let attempts = 0;
  let sawResponse = false;
  let lastError: string | null = null;

  for (;;) {
    attempts += 1;
    const nowMs = now();
    const result = await getMySubscriptionForTrainer(supabase, params.userId, params.trainerId);
    if (result.ok) {
      sawResponse = true;
      lastError = null;
      if (result.subscription && isSubscriptionActive(result.subscription, nowMs)) {
        return { ok: true, active: true, subscription: result.subscription, attempts };
      }
    } else {
      lastError = result.error;
    }

    if (nowMs - start >= timeoutMs) {
      // Only fail hard if we never got a clean response; otherwise it is an
      // honest not-yet-confirmed pending state.
      if (!sawResponse && lastError) return { ok: false, error: lastError };
      return { ok: true, active: false, subscription: null, attempts };
    }

    await sleep(delay);
    delay = Math.min(Math.floor(delay * 1.5), maxDelay);
  }
}

// Trainer earnings, newest month first, via the security-definer RPC. The RPC
// aggregates only the caller's own trainer events (INITIAL_PURCHASE + RENEWAL);
// gross_usd is store price before Apple/Google take their cut. dw_purchase_events
// is service-role only and is never selected directly.
export async function getTrainerEarnings(
  supabase: SupabaseClient,
): Promise<SubscriptionResult<{ months: TrainerEarningsMonth[] }>> {
  try {
    const { data, error } = await supabase.rpc(EARNINGS_RPC);
    if (error) return { ok: false, error: errMessage(error) };
    const rows = Array.isArray(data) ? (data as RawEarningsRow[]) : [];
    return { ok: true, months: rows.map(toEarningsMonth) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
