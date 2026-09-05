import Stripe from 'stripe';
import type { DepositConfig, CaptureResult } from './types';

export function calculateDepositAmount(config: {
  depositCents: number;
  perPerson: boolean;
  partySize: number;
}): number {
  if (config.perPerson) {
    return config.depositCents * config.partySize;
  }
  return config.depositCents;
}

export function calculateApplicationFee(_amountCents: number): number {
  // $1 per booking flat fee (100 cents)
  return 100;
}

export async function createDepositIntent(
  stripe: Stripe,
  config: DepositConfig,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(
    {
      amount: config.amountCents,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: config.applicationFeeCents,
      transfer_data: {
        destination: config.restaurantStripeAccountId,
      },
    },
    {
      idempotencyKey: undefined,
    },
  );
}

export async function captureDeposit(
  stripe: Stripe,
  paymentIntentId: string,
  amountToCaptureCents?: number,
): Promise<CaptureResult> {
  try {
    const pi = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountToCaptureCents,
    });
    return {
      success: true,
      capturedAmountCents: pi.amount_received,
    };
  } catch (error) {
    return {
      success: false,
      capturedAmountCents: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function cancelDeposit(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function refundDeposit(
  stripe: Stripe,
  paymentIntentId: string,
  amountCents?: number,
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
    });
    return { success: true, refundId: refund.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isAuthExpiringSoon(authorizedAt: Date, windowDays: number = 7): boolean {
  const msPerDay = 86400000;
  const expiresAt = new Date(authorizedAt.getTime() + windowDays * msPerDay);
  const now = new Date();
  const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / 3600000;
  return hoursUntilExpiry <= 24;
}
