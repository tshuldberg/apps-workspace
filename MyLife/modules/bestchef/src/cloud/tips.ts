/**
 * Tip record access and payment availability.
 *
 * BestChef does not accept tip payments at launch. The write entry point
 * returns a typed unavailable result and never creates a payment record.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Tip } from './types';

export type PaymentsUnavailableResult = Readonly<{
  status: 'unavailable';
  reason: 'payments_not_launched';
}>;

/** Stable result for payment actions while BestChef launches without payments. */
export const PAYMENTS_NOT_LAUNCHED = {
  status: 'unavailable',
  reason: 'payments_not_launched',
} as const satisfies PaymentsUnavailableResult;

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mapper ──────────────────────────────────────────────────────

function mapTip(row: Record<string, unknown>): Tip {
  return {
    id: row.id as string,
    tipperId: row.tipper_id as string,
    chefId: row.chef_id as string,
    submissionId: (row.submission_id as string) ?? null,
    amountCents: row.amount_cents as number,
    currency: row.currency as string,
    platformFeeCents: row.platform_fee_cents as number,
    paymentIntentId: row.payment_intent_id as string,
    status: (row.status as Tip['status']) ?? 'pending',
    createdAt: new Date(row.created_at as string),
  };
}

// ── Options ─────────────────────────────────────────────────────────

export interface SendTipOptions {
  submissionId?: string;
  currency?: string;
}

export interface GetTipsOptions {
  limit?: number;
  offset?: number;
}

// ── Write operations ────────────────────────────────────────────────

export async function sendTip(
  _tipperId: string,
  _chefId: string,
  _amountCents: number,
  _options?: SendTipOptions,
): Promise<PaymentsUnavailableResult> {
  return PAYMENTS_NOT_LAUNCHED;
}

export async function updateTipStatus(
  tipId: string,
  status: Tip['status'],
): Promise<BestChefResult<Tip>> {
  const { data, error: dbErr } = await from('bc_tips')
    .update({ status })
    .eq('id', tipId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapTip(data));
}

// ── Read operations ─────────────────────────────────────────────────

export async function getTipsForChef(
  chefId: string,
  options?: GetTipsOptions,
): Promise<BestChefResult<Tip[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_tips')
    .select('*')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapTip));
}

export async function getTipsByTipper(
  tipperId: string,
  options?: GetTipsOptions,
): Promise<BestChefResult<Tip[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_tips')
    .select('*')
    .eq('tipper_id', tipperId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapTip));
}

export async function getTipsBySubmission(
  submissionId: string,
): Promise<BestChefResult<Tip[]>> {
  const { data, error: dbErr } = await from('bc_tips')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapTip));
}

export async function getChefTipTotal(
  chefId: string,
): Promise<BestChefResult<number>> {
  const { data, error: dbErr } = await from('bc_tips')
    .select('amount_cents, platform_fee_cents')
    .eq('chef_id', chefId)
    .eq('status', 'completed');

  if (dbErr) return err(dbErr.message);

  const total = (data ?? []).reduce((sum: number, row: Record<string, unknown>) => {
    const amount = row.amount_cents as number;
    const fee = row.platform_fee_cents as number;
    return sum + (amount - fee);
  }, 0);

  return ok(total);
}
