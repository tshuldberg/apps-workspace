import {
  assertPaymentsInvariant,
  createPaymentsDomainError,
} from './errors';
import type {
  PaymentsLedgerEntry,
  PaymentsLedgerPlan,
  PaymentsLedgerKind,
} from './types';
import type { CurrencyCode } from '../types';
import type { PaymentsBalanceBucket } from '../cloud/rpc';

export interface BuildPaymentsLedgerPlanInput {
  transferId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents?: number | null;
  destinationCurrency?: CurrencyCode | null;
  sourceBalanceBucket: PaymentsBalanceBucket;
  destinationBalanceBucket: PaymentsBalanceBucket;
  feeAmountCents?: number;
  feeWalletId?: string | null;
  feePayerWalletId?: string | null;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  createId?: (prefix: string) => string;
}

export interface BuildPaymentsReversalPlanInput {
  originalPlan: PaymentsLedgerPlan;
  originalTransferId: string;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  createId?: (prefix: string) => string;
}

export interface BuildPaymentsAdjustmentPlanInput {
  referenceId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  sourceBalanceBucket: PaymentsBalanceBucket;
  destinationBalanceBucket: PaymentsBalanceBucket;
  amountCents: number;
  currency: CurrencyCode;
  entryKind?: Extract<
    PaymentsLedgerKind,
    'adjustment' | 'chargeback' | 'hold' | 'release'
  >;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  createId?: (prefix: string) => string;
}

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function calculateNetByCurrency(
  entries: PaymentsLedgerEntry[],
): Record<string, number> {
  const net: Record<string, number> = {};

  for (const entry of entries) {
    const delta =
      entry.direction === 'credit'
        ? entry.amountCents
        : entry.amountCents * -1;
    net[entry.currency] = (net[entry.currency] ?? 0) + delta;
  }

  return net;
}

function assertBalancedNet(
  perCurrencyNet: Record<string, number>,
  details?: Record<string, unknown>,
): void {
  const unbalanced = Object.entries(perCurrencyNet).filter(
    ([, net]) => net !== 0,
  );
  if (unbalanced.length > 0) {
    throw createPaymentsDomainError(
      'posting_unbalanced',
      'Ledger plan is not balanced by currency',
      {
        ...details,
        perCurrencyNet,
      },
    );
  }
}

function makeEntry(input: {
  walletId: string;
  balanceBucket: PaymentsBalanceBucket;
  direction: 'debit' | 'credit';
  entryKind?: PaymentsLedgerKind;
  amountCents: number;
  currency: CurrencyCode;
  memo?: string | null;
  metadata?: Record<string, unknown>;
}): PaymentsLedgerEntry {
  return {
    walletId: input.walletId,
    balanceBucket: input.balanceBucket,
    direction: input.direction,
    entryKind: input.entryKind ?? 'principal',
    amountCents: input.amountCents,
    currency: input.currency,
    memo: input.memo,
    metadata: input.metadata ?? {},
  };
}

export function buildPaymentsLedgerPlan(
  input: BuildPaymentsLedgerPlanInput,
): PaymentsLedgerPlan {
  assertPaymentsInvariant(
    input.sourceAmountCents > 0,
    'invalid_command',
    'sourceAmountCents must be positive',
    { sourceAmountCents: input.sourceAmountCents },
  );
  assertPaymentsInvariant(
    input.sourceWalletId !== input.destinationWalletId ||
      input.sourceBalanceBucket !== input.destinationBalanceBucket,
    'posting_unbalanced',
    'Source and destination postings cannot be the same wallet bucket',
    {
      sourceWalletId: input.sourceWalletId,
      destinationWalletId: input.destinationWalletId,
      sourceBalanceBucket: input.sourceBalanceBucket,
      destinationBalanceBucket: input.destinationBalanceBucket,
    },
  );

  const destinationAmountCents =
    input.destinationAmountCents ?? input.sourceAmountCents;
  const destinationCurrency =
    input.destinationCurrency ?? input.sourceCurrency;
  const postingGroupId = (input.createId ?? defaultCreateId)('pay_posting_group');
  const metadata = {
    transferId: input.transferId,
    ...(input.metadata ?? {}),
  };
  const entries: PaymentsLedgerEntry[] = [
    makeEntry({
      walletId: input.sourceWalletId,
      balanceBucket: input.sourceBalanceBucket,
      direction: 'debit',
      amountCents: input.sourceAmountCents,
      currency: input.sourceCurrency,
      memo: input.memo,
      metadata,
    }),
    makeEntry({
      walletId: input.destinationWalletId,
      balanceBucket: input.destinationBalanceBucket,
      direction: 'credit',
      amountCents: destinationAmountCents,
      currency: destinationCurrency,
      memo: input.memo,
      metadata,
    }),
  ];

  if ((input.feeAmountCents ?? 0) > 0) {
    assertPaymentsInvariant(
      !!input.feeWalletId,
      'fee_wallet_required',
      'feeWalletId is required when feeAmountCents is positive',
      { transferId: input.transferId },
    );

    entries.push(
      makeEntry({
        walletId: input.feePayerWalletId ?? input.sourceWalletId,
        balanceBucket: input.sourceBalanceBucket,
        direction: 'debit',
        entryKind: 'fee',
        amountCents: input.feeAmountCents ?? 0,
        currency: input.sourceCurrency,
        memo: input.memo ?? 'Fee',
        metadata,
      }),
      makeEntry({
        walletId: input.feeWalletId ?? input.sourceWalletId,
        balanceBucket: 'available',
        direction: 'credit',
        entryKind: 'fee',
        amountCents: input.feeAmountCents ?? 0,
        currency: input.sourceCurrency,
        memo: input.memo ?? 'Fee revenue',
        metadata,
      }),
    );
  }

  const perCurrencyNet = calculateNetByCurrency(entries);
  assertBalancedNet(perCurrencyNet, { transferId: input.transferId });

  return {
    postingGroupId,
    entries,
    perCurrencyNet,
    balanced: true,
  };
}

export function buildPaymentsReversalPlan(
  input: BuildPaymentsReversalPlanInput,
): PaymentsLedgerPlan {
  const postingGroupId = (input.createId ?? defaultCreateId)('pay_posting_group');
  const entries = input.originalPlan.entries.map((entry) =>
    makeEntry({
      walletId: entry.walletId,
      balanceBucket: entry.balanceBucket,
      direction: entry.direction === 'credit' ? 'debit' : 'credit',
      entryKind: 'reversal',
      amountCents: entry.amountCents,
      currency: entry.currency,
      memo: input.memo ?? entry.memo ?? 'Transfer reversal',
      metadata: {
        ...entry.metadata,
        ...(input.metadata ?? {}),
        reversalOfTransferId: input.originalTransferId,
      },
    }),
  );
  const perCurrencyNet = calculateNetByCurrency(entries);
  assertBalancedNet(perCurrencyNet, {
    originalTransferId: input.originalTransferId,
  });

  return {
    postingGroupId,
    entries,
    perCurrencyNet,
    balanced: true,
  };
}

export function buildPaymentsAdjustmentPlan(
  input: BuildPaymentsAdjustmentPlanInput,
): PaymentsLedgerPlan {
  assertPaymentsInvariant(
    input.amountCents > 0,
    'invalid_command',
    'amountCents must be positive',
    {
      amountCents: input.amountCents,
      referenceId: input.referenceId,
    },
  );
  assertPaymentsInvariant(
    input.sourceWalletId !== input.destinationWalletId ||
      input.sourceBalanceBucket !== input.destinationBalanceBucket,
    'posting_unbalanced',
    'Adjustment postings cannot target the same wallet bucket',
    {
      sourceWalletId: input.sourceWalletId,
      destinationWalletId: input.destinationWalletId,
      sourceBalanceBucket: input.sourceBalanceBucket,
      destinationBalanceBucket: input.destinationBalanceBucket,
      referenceId: input.referenceId,
    },
  );

  const postingGroupId = (input.createId ?? defaultCreateId)('pay_posting_group');
  const metadata = {
    referenceId: input.referenceId,
    ...(input.metadata ?? {}),
  };
  const entryKind = input.entryKind ?? 'adjustment';
  const entries = [
    makeEntry({
      walletId: input.sourceWalletId,
      balanceBucket: input.sourceBalanceBucket,
      direction: 'debit',
      entryKind,
      amountCents: input.amountCents,
      currency: input.currency,
      memo: input.memo,
      metadata,
    }),
    makeEntry({
      walletId: input.destinationWalletId,
      balanceBucket: input.destinationBalanceBucket,
      direction: 'credit',
      entryKind,
      amountCents: input.amountCents,
      currency: input.currency,
      memo: input.memo,
      metadata,
    }),
  ];

  const perCurrencyNet = calculateNetByCurrency(entries);
  assertBalancedNet(perCurrencyNet, {
    referenceId: input.referenceId,
  });

  return {
    postingGroupId,
    entries,
    perCurrencyNet,
    balanced: true,
  };
}
