import type { Pledge } from '../models';
import { MYNEWS_PLATFORM_FEE_BPS } from '../data/support';

export interface FeeConfig {
  platformFeeBps: number;
  processingPctBps: number;
  processingFixedCents: number;
  /**
   * Minimum balance the AGGREGATED-CHARGE model would hold before paying out.
   *
   * Not enforced by the live rail. The shipped support path uses Stripe Connect
   * destination charges, where Stripe schedules automatic payouts on the
   * journalist's connected account and MyNews neither initiates nor withholds
   * them. Nothing in `modules/mynews` or either app calls `payoutEligible`, and
   * no user-facing copy claims MyNews enforces a payout minimum. Treat this as
   * the model's parameter, not a platform promise; if MyNews ever moves to
   * manual payouts, enforce it server-side before publishing the claim.
   */
  payoutMinCents: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  platformFeeBps: MYNEWS_PLATFORM_FEE_BPS,
  processingPctBps: 290,
  processingFixedCents: 30,
  payoutMinCents: 1000,
};

export interface ChargeSplit {
  grossCents: number;
  processingFeeCents: number;
  platformFeeCents: number;
  journalistNetCents: Array<{ journalistId: string; netCents: number }>;
}

/**
 * Splits one aggregated monthly supporter charge. The processing fee is paid
 * once per charge (the whole point of aggregation); the platform keeps
 * platformFeeBps of gross; the remaining pool is allocated to journalists
 * pro-rata using largest-remainder so cents always conserve exactly.
 */
export function splitCharge(pledges: Pledge[], cfg: FeeConfig = DEFAULT_FEE_CONFIG): ChargeSplit {
  if (pledges.length === 0) throw new Error('splitCharge: no pledges');
  for (const p of pledges) {
    if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) {
      throw new Error(`splitCharge: invalid pledge amount ${p.amountCents}`);
    }
  }
  const grossCents = pledges.reduce((s, p) => s + p.amountCents, 0);
  const processingFeeCents =
    Math.round((grossCents * cfg.processingPctBps) / 10_000) + cfg.processingFixedCents;
  const platformFeeCents = Math.round((grossCents * cfg.platformFeeBps) / 10_000);
  const pool = grossCents - processingFeeCents - platformFeeCents;
  if (pool <= 0) throw new Error('splitCharge: charge too small to cover fees');

  const exact = pledges.map((p) => (pool * p.amountCents) / grossCents);
  const floors = exact.map(Math.floor);
  let remainder = pool - floors.reduce((s, f) => s + f, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  const nets = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    nets[i] = nets[i]! + 1;
    remainder -= 1;
  }
  return {
    grossCents,
    processingFeeCents,
    platformFeeCents,
    journalistNetCents: pledges.map((p, i) => ({
      journalistId: p.journalistId,
      netCents: nets[i]!,
    })),
  };
}

/**
 * Whether a balance clears the aggregated-charge model's payout minimum. Model
 * only: see the `payoutMinCents` note on FeeConfig. The live Stripe Connect rail
 * pays out on the provider's schedule, so this is not the gate on real money
 * leaving the platform.
 */
export function payoutEligible(
  balanceCents: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): boolean {
  return balanceCents >= cfg.payoutMinCents;
}
