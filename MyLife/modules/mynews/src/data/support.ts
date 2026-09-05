export const MYNEWS_PLATFORM_FEE_BPS = 200;
export const MYNEWS_PLATFORM_FEE_PERCENT = 2;
export const MYNEWS_MIN_SUPPORT_CENTS = 100;
export const MYNEWS_MAX_SUPPORT_CENTS = 100_000;

export const SUPPORT_LEDGER_KINDS = [
  'charge',
  'platform_fee',
  'refund',
  'dispute_hold',
  'dispute_release',
  'payout',
  'payout_reversal',
] as const;

export type SupportLedgerKind = (typeof SUPPORT_LEDGER_KINDS)[number];
export type PayoutOnboardingState = 'none' | 'pending' | 'verified' | 'blocked';
export type SupportReceiptState =
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'
  | 'dispute_released';

export interface SupportSplit {
  grossCents: number;
  platformFeeCents: number;
  journalistNetCents: number;
}

export interface SupportLedgerEntry {
  id: string;
  supporterProfileId: string | null;
  journalistProfileId: string;
  kind: SupportLedgerKind;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string | null;
  idempotencyKey: string;
  state: string;
  createdAt: string;
}

export interface SupportReceipt {
  id: string;
  supporterProfileId: string;
  journalistProfileId: string;
  journalistHandle?: string | null;
  grossCents: number;
  platformFeeCents: number;
  journalistNetCents: number;
  refundedCents: number;
  currency: string;
  providerRef: string;
  state: SupportReceiptState;
  createdAt: string;
}

export interface PayoutAccountSummary {
  journalistProfileId: string;
  state: PayoutOnboardingState;
  provider: string | null;
  statusReason: string | null;
  updatedAt: string;
}

export interface JournalistEarningsSummary {
  journalistProfileId: string;
  currency: string;
  grossCents: number;
  platformFeeCents: number;
  platformFeeReversalCents: number;
  refundedCents: number;
  disputeHoldCents: number;
  disputeReleaseCents: number;
  paidOutCents: number;
  payoutReversalCents: number;
  availableCents: number;
}

export interface JournalistPayoutSummary extends JournalistEarningsSummary {
  onboardingState: PayoutOnboardingState;
  canReceivePayouts: boolean;
}

export interface ReaderSupportHistory {
  supporterProfileId: string;
  currency: string;
  totalSupportedCents: number;
  totalPlatformFeeCents: number;
  totalJournalistNetCents: number;
  receipts: SupportReceipt[];
}

export interface SupportReconciliationPair {
  supporterProfileId: string;
  journalistProfileId: string;
  currency: string;
  chargeCents: number;
  platformFeeCents: number;
  platformFeeReversalCents: number;
  netCents: number;
  refundCents: number;
  grossRefundCents: number;
  balanceCents: number;
}

export interface SupportReconciliationResult {
  ok: boolean;
  issues: string[];
  pairs: SupportReconciliationPair[];
}

function assertCents(value: number, label: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} integer number of cents`);
  }
}

export function calculatePlatformFeeCents(grossCents: number): number {
  assertCents(grossCents, 'grossCents');
  return Math.round((grossCents * MYNEWS_PLATFORM_FEE_BPS) / 10_000);
}

export function splitReaderSupport(grossCents: number): SupportSplit {
  if (grossCents < MYNEWS_MIN_SUPPORT_CENTS || grossCents > MYNEWS_MAX_SUPPORT_CENTS) {
    throw new Error(
      `grossCents must be between ${MYNEWS_MIN_SUPPORT_CENTS} and ${MYNEWS_MAX_SUPPORT_CENTS}`,
    );
  }
  const platformFeeCents = calculatePlatformFeeCents(grossCents);
  return {
    grossCents,
    platformFeeCents,
    journalistNetCents: grossCents - platformFeeCents,
  };
}

export function summarizeJournalistEarnings(
  entries: readonly SupportLedgerEntry[],
  journalistProfileId: string,
  currency = 'USD',
): JournalistEarningsSummary {
  const scoped = entries.filter(
    (entry) =>
      entry.journalistProfileId === journalistProfileId && entry.currency === currency,
  );
  const sum = (kind: SupportLedgerKind, state?: string) =>
    scoped
      .filter((entry) => entry.kind === kind && (state === undefined || entry.state === state))
      .reduce((total, entry) => total + entry.amountCents, 0);
  const grossCents = sum('charge');
  const postedPlatformFeeCents = scoped
    .filter((entry) => entry.kind === 'platform_fee' && entry.state !== 'reversed')
    .reduce((total, entry) => total + entry.amountCents, 0);
  const platformFeeReversalCents = sum('platform_fee', 'reversed');
  const refundedCents = sum('refund');
  const disputeHoldCents = sum('dispute_hold');
  const disputeReleaseCents = sum('dispute_release');
  const paidOutCents = sum('payout');
  const payoutReversalCents = sum('payout_reversal');

  return {
    journalistProfileId,
    currency,
    grossCents,
    platformFeeCents: postedPlatformFeeCents,
    platformFeeReversalCents,
    refundedCents,
    disputeHoldCents,
    disputeReleaseCents,
    paidOutCents,
    payoutReversalCents,
    availableCents:
      grossCents -
      postedPlatformFeeCents -
      refundedCents -
      disputeHoldCents +
      disputeReleaseCents -
      paidOutCents +
      payoutReversalCents,
  };
}

export function summarizeJournalistPayout(
  entries: readonly SupportLedgerEntry[],
  account: PayoutAccountSummary,
  currency = 'USD',
): JournalistPayoutSummary {
  return {
    ...summarizeJournalistEarnings(entries, account.journalistProfileId, currency),
    onboardingState: account.state,
    canReceivePayouts: account.state === 'verified',
  };
}

export function summarizeReaderSupportHistory(
  receipts: readonly SupportReceipt[],
  supporterProfileId: string,
  currency = 'USD',
): ReaderSupportHistory {
  const scoped = receipts
    .filter(
      (receipt) =>
        receipt.supporterProfileId === supporterProfileId && receipt.currency === currency,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    supporterProfileId,
    currency,
    totalSupportedCents: scoped.reduce((sum, receipt) => sum + receipt.grossCents, 0),
    totalPlatformFeeCents: scoped.reduce(
      (sum, receipt) => sum + receipt.platformFeeCents,
      0,
    ),
    totalJournalistNetCents: scoped.reduce(
      (sum, receipt) => sum + receipt.journalistNetCents,
      0,
    ),
    receipts: scoped,
  };
}

function pairKey(entry: SupportLedgerEntry): string | null {
  if (!entry.supporterProfileId) return null;
  return `${entry.supporterProfileId}\u0000${entry.journalistProfileId}\u0000${entry.currency}`;
}

/**
 * Checks the accounting invariants available from the append-only ledger.
 * Payout rows are journalist-wide and are checked in the earnings summary;
 * support-pair balances cover charge, fee, refund, and dispute transitions.
 */
export function reconcileSupportLedger(
  entries: readonly SupportLedgerEntry[],
): SupportReconciliationResult {
  const issues: string[] = [];
  const groups = new Map<string, SupportLedgerEntry[]>();

  for (const entry of entries) {
    if (!SUPPORT_LEDGER_KINDS.includes(entry.kind)) {
      issues.push(`unknown ledger kind on ${entry.id}`);
      continue;
    }
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents <= 0) {
      issues.push(`non-positive amount on ${entry.id}`);
      continue;
    }
    if (!/^[A-Z]{3}$/.test(entry.currency)) issues.push(`invalid currency on ${entry.id}`);
    const key = pairKey(entry);
    if (!key || entry.kind === 'payout' || entry.kind === 'payout_reversal') continue;
    const rows = groups.get(key) ?? [];
    rows.push(entry);
    groups.set(key, rows);
  }

  const pairs: SupportReconciliationPair[] = [];
  for (const [key, rows] of groups) {
    const [supporterProfileId, journalistProfileId, currency] = key.split('\u0000') as [
      string,
      string,
      string,
    ];
    const amount = (kind: SupportLedgerKind) =>
      rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amountCents, 0);
    const chargeCents = amount('charge');
    const platformFeeCents = rows
      .filter((row) => row.kind === 'platform_fee' && row.state !== 'reversed')
      .reduce((sum, row) => sum + row.amountCents, 0);
    const platformFeeReversalCents = rows
      .filter((row) => row.kind === 'platform_fee' && row.state === 'reversed')
      .reduce((sum, row) => sum + row.amountCents, 0);
    const refundCents = amount('refund');
    const grossRefundCents = refundCents + platformFeeReversalCents;
    const heldCents = amount('dispute_hold');
    const releasedCents = amount('dispute_release');
    const netCents = chargeCents - platformFeeCents;
    const balanceCents = netCents - refundCents - heldCents + releasedCents;

    if (platformFeeCents > chargeCents) {
      issues.push(`platform fees exceed charges for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (platformFeeReversalCents > platformFeeCents) {
      issues.push(`platform fee reversals exceed fees for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (grossRefundCents > chargeCents) {
      issues.push(`refunds exceed charges for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (releasedCents > heldCents) {
      issues.push(`dispute releases exceed holds for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (chargeCents !== platformFeeCents + netCents) {
      issues.push(`charge split does not conserve cents for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (balanceCents < 0) {
      issues.push(`negative pair balance for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }

    pairs.push({
      supporterProfileId,
      journalistProfileId,
      currency,
      chargeCents,
      platformFeeCents,
      platformFeeReversalCents,
      netCents,
      refundCents,
      grossRefundCents,
      balanceCents,
    });
  }

  pairs.sort((left, right) =>
    `${left.supporterProfileId}/${left.journalistProfileId}/${left.currency}`.localeCompare(
      `${right.supporterProfileId}/${right.journalistProfileId}/${right.currency}`,
    ),
  );
  return { ok: issues.length === 0, issues, pairs };
}
