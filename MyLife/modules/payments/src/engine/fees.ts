import {
  assertPaymentsInvariant,
} from './errors';
import type {
  PaymentsFeeProfile,
  PaymentsFeeQuote,
  PaymentsTransferSpeed,
} from './types';
import type {
  PaymentsRail,
  PaymentsTransferKind,
} from '../cloud/rpc';

interface FeeSchedule {
  rateBasisPoints: number;
  fixedFeeCents: number;
  minimumFeeCents: number;
  maximumFeeCents: number | null;
}

export interface PaymentsFeeCalculationInput {
  kind: PaymentsTransferKind;
  amountCents: number;
  sourceRail?: PaymentsRail;
  destinationRail?: PaymentsRail;
  speed?: PaymentsTransferSpeed;
  feeProfile?: PaymentsFeeProfile;
  destinationAmountCents?: number | null;
}

const FEE_SCHEDULES: Record<PaymentsFeeProfile, FeeSchedule> = {
  p2p: {
    rateBasisPoints: 0,
    fixedFeeCents: 0,
    minimumFeeCents: 0,
    maximumFeeCents: 0,
  },
  instant_payout: {
    rateBasisPoints: 175,
    fixedFeeCents: 0,
    minimumFeeCents: 50,
    maximumFeeCents: 1_500,
  },
  merchant: {
    rateBasisPoints: 290,
    fixedFeeCents: 30,
    minimumFeeCents: 30,
    maximumFeeCents: 5_000,
  },
  card: {
    rateBasisPoints: 290,
    fixedFeeCents: 30,
    minimumFeeCents: 30,
    maximumFeeCents: 5_000,
  },
  remittance: {
    rateBasisPoints: 120,
    fixedFeeCents: 99,
    minimumFeeCents: 199,
    maximumFeeCents: 2_499,
  },
};

function applyFeeSchedule(
  amountCents: number,
  schedule: FeeSchedule,
): Pick<PaymentsFeeQuote, 'feeCents' | 'adjusted'> {
  const raw =
    Math.ceil((amountCents * schedule.rateBasisPoints) / 10_000) +
    schedule.fixedFeeCents;
  const withMinimum = Math.max(raw, schedule.minimumFeeCents);
  const feeCents =
    schedule.maximumFeeCents === null
      ? withMinimum
      : Math.min(withMinimum, schedule.maximumFeeCents);

  return {
    feeCents,
    adjusted: feeCents !== raw,
  };
}

export function resolvePaymentsFeeProfile(
  input: PaymentsFeeCalculationInput,
): PaymentsFeeProfile {
  if (input.feeProfile) {
    return input.feeProfile;
  }

  if (
    input.kind === 'remittance_send' ||
    input.kind === 'remittance_refund' ||
    input.sourceRail === 'remittance' ||
    input.destinationRail === 'remittance'
  ) {
    return 'remittance';
  }

  if (
    input.kind === 'merchant_charge' ||
    input.kind === 'merchant_refund' ||
    input.sourceRail === 'merchant' ||
    input.destinationRail === 'merchant'
  ) {
    return 'merchant';
  }

  if (
    input.kind === 'card_authorization' ||
    input.kind === 'card_capture' ||
    input.kind === 'card_refund'
  ) {
    return 'card';
  }

  if (
    input.kind === 'withdraw_wallet' &&
    input.speed === 'instant'
  ) {
    return 'instant_payout';
  }

  if (
    input.kind === 'fund_wallet' &&
    input.sourceRail === 'card'
  ) {
    return 'card';
  }

  return 'p2p';
}

export function calculatePaymentsFee(
  input: PaymentsFeeCalculationInput,
): PaymentsFeeQuote {
  assertPaymentsInvariant(
    Number.isInteger(input.amountCents) && input.amountCents > 0,
    'invalid_command',
    'amountCents must be a positive integer',
    { amountCents: input.amountCents },
  );

  const profile = resolvePaymentsFeeProfile(input);
  const schedule = FEE_SCHEDULES[profile];
  const { feeCents, adjusted } = applyFeeSchedule(input.amountCents, schedule);
  const destinationAmountCents =
    input.destinationAmountCents ?? input.amountCents;

  return {
    profile,
    rateBasisPoints: schedule.rateBasisPoints,
    fixedFeeCents: schedule.fixedFeeCents,
    minimumFeeCents: schedule.minimumFeeCents,
    maximumFeeCents: schedule.maximumFeeCents,
    feeCents,
    totalDebitCents: input.amountCents + feeCents,
    destinationAmountCents,
    adjusted,
  };
}

