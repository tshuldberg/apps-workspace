import { describe, expect, it } from 'vitest';
import {
  MYNEWS_PLATFORM_FEE_BPS,
  calculatePlatformFeeCents,
  reconcileSupportLedger,
  splitReaderSupport,
  summarizeJournalistEarnings,
  summarizeJournalistPayout,
  summarizeReaderSupportHistory,
  type PayoutAccountSummary,
  type SupportLedgerEntry,
  type SupportReceipt,
} from './support';

const row = (
  id: string,
  kind: SupportLedgerEntry['kind'],
  amountCents: number,
  overrides: Partial<SupportLedgerEntry> = {},
): SupportLedgerEntry => ({
  id,
  supporterProfileId: 'reader-1',
  journalistProfileId: 'journalist-1',
  kind,
  amountCents,
  currency: 'USD',
  provider: 'stripe',
  providerRef: `ref-${id}`,
  idempotencyKey: `idem-${id}`,
  state: 'posted',
  createdAt: '2026-07-12T00:00:00.000Z',
  ...overrides,
});

describe('2 percent support math', () => {
  it('pins the platform fee at 200 basis points', () => {
    expect(MYNEWS_PLATFORM_FEE_BPS).toBe(200);
  });

  it.each([
    [100, 2],
    [499, 10],
    [500, 10],
    [999, 20],
    [10_000, 200],
  ])('rounds %i cents to a %i cent fee', (gross, fee) => {
    expect(calculatePlatformFeeCents(gross)).toBe(fee);
    expect(splitReaderSupport(gross)).toEqual({
      grossCents: gross,
      platformFeeCents: fee,
      journalistNetCents: gross - fee,
    });
  });

  it('rejects unsafe, fractional, too-small, and too-large amounts', () => {
    expect(() => calculatePlatformFeeCents(1.5)).toThrow(/integer/);
    expect(() => splitReaderSupport(99)).toThrow(/between/);
    expect(() => splitReaderSupport(100_001)).toThrow(/between/);
    expect(() => splitReaderSupport(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe('support summaries', () => {
  const entries = [
    row('charge', 'charge', 5_000),
    row('fee', 'platform_fee', 100),
    row('refund', 'refund', 500),
    row('hold', 'dispute_hold', 300),
    row('release', 'dispute_release', 100),
    row('payout', 'payout', 2_000, { supporterProfileId: null }),
    row('payout-reversal', 'payout_reversal', 200, { supporterProfileId: null }),
    row('other-journalist', 'charge', 8_000, { journalistProfileId: 'journalist-2' }),
    row('eur', 'charge', 7_000, { currency: 'EUR' }),
  ];

  it('summarizes only the requested journalist and currency', () => {
    expect(summarizeJournalistEarnings(entries, 'journalist-1')).toEqual({
      journalistProfileId: 'journalist-1',
      currency: 'USD',
      grossCents: 5_000,
      platformFeeCents: 100,
      platformFeeReversalCents: 0,
      refundedCents: 500,
      disputeHoldCents: 300,
      disputeReleaseCents: 100,
      paidOutCents: 2_000,
      payoutReversalCents: 200,
      availableCents: 2_400,
    });
  });

  it('only enables payouts for a verified onboarding account', () => {
    const account: PayoutAccountSummary = {
      journalistProfileId: 'journalist-1',
      state: 'pending',
      provider: 'stripe',
      statusReason: null,
      updatedAt: '2026-07-12T00:00:00.000Z',
    };
    expect(summarizeJournalistPayout(entries, account).canReceivePayouts).toBe(false);
    expect(
      summarizeJournalistPayout(entries, { ...account, state: 'verified' }).canReceivePayouts,
    ).toBe(true);
  });

  it('sorts and totals reader receipts without mixing readers or currencies', () => {
    const receipts: SupportReceipt[] = [
      {
        id: 'old',
        supporterProfileId: 'reader-1',
        journalistProfileId: 'journalist-1',
        grossCents: 500,
        platformFeeCents: 10,
        journalistNetCents: 490,
        refundedCents: 0,
        currency: 'USD',
        providerRef: 'pi-old',
        state: 'paid',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
      {
        id: 'new',
        supporterProfileId: 'reader-1',
        journalistProfileId: 'journalist-2',
        grossCents: 1_000,
        platformFeeCents: 20,
        journalistNetCents: 980,
        refundedCents: 0,
        currency: 'USD',
        providerRef: 'pi-new',
        state: 'paid',
        createdAt: '2026-07-11T00:00:00.000Z',
      },
      {
        id: 'other-reader',
        supporterProfileId: 'reader-2',
        journalistProfileId: 'journalist-1',
        grossCents: 9_999,
        platformFeeCents: 200,
        journalistNetCents: 9_799,
        refundedCents: 0,
        currency: 'USD',
        providerRef: 'pi-other',
        state: 'paid',
        createdAt: '2026-07-12T00:00:00.000Z',
      },
    ];
    const history = summarizeReaderSupportHistory(receipts, 'reader-1');
    expect(history.totalSupportedCents).toBe(1_500);
    expect(history.totalPlatformFeeCents).toBe(30);
    expect(history.totalJournalistNetCents).toBe(1_470);
    expect(history.receipts.map((receipt) => receipt.id)).toEqual(['new', 'old']);
  });
});

describe('support ledger reconciliation', () => {
  it('accepts a balanced charge, refund, and resolved dispute', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 1_000),
      row('fee', 'platform_fee', 20),
      row('refund', 'refund', 100),
      row('hold', 'dispute_hold', 200),
      row('release', 'dispute_release', 200),
    ]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.pairs[0]).toMatchObject({
      chargeCents: 1_000,
      platformFeeCents: 20,
      platformFeeReversalCents: 0,
      netCents: 980,
      refundCents: 100,
      grossRefundCents: 100,
      balanceCents: 880,
    });
  });

  it('detects platform fees that exceed charges', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 100),
      row('fee', 'platform_fee', 101),
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/platform fees exceed charges/);
    expect(result.issues.join(' ')).toMatch(/negative pair balance/);
  });

  it('detects refunds beyond the supported gross', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 500),
      row('fee', 'platform_fee', 10),
      row('refund', 'refund', 501),
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/refunds exceed charges/);
  });

  it('reconciles a full refund as net refund plus reversed platform fee', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 1_000),
      row('fee', 'platform_fee', 20),
      row('refund', 'refund', 980),
      row('fee-reversal', 'platform_fee', 20, { state: 'reversed' }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.pairs[0]).toMatchObject({
      chargeCents: 1_000,
      platformFeeCents: 20,
      platformFeeReversalCents: 20,
      refundCents: 980,
      grossRefundCents: 1_000,
      balanceCents: 0,
    });
  });

  it('detects a platform fee reversal beyond the posted fee', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 500),
      row('fee', 'platform_fee', 10),
      row('fee-reversal', 'platform_fee', 11, { state: 'reversed' }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/fee reversals exceed fees/);
  });

  it('detects a dispute release with no matching hold', () => {
    const result = reconcileSupportLedger([
      row('charge', 'charge', 500),
      row('release', 'dispute_release', 100),
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/releases exceed holds/);
  });

  it('detects invalid cents and currency without throwing', () => {
    const result = reconcileSupportLedger([
      row('zero', 'charge', 0),
      row('currency', 'charge', 500, { currency: 'usd' }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/non-positive amount/);
    expect(result.issues.join(' ')).toMatch(/invalid currency/);
  });

  it('keeps support pairs and currencies independent', () => {
    const result = reconcileSupportLedger([
      row('usd-charge', 'charge', 1_000),
      row('usd-fee', 'platform_fee', 20),
      row('eur-charge', 'charge', 2_000, { currency: 'EUR' }),
      row('eur-fee', 'platform_fee', 40, { currency: 'EUR' }),
      row('second-pair', 'charge', 3_000, { supporterProfileId: 'reader-2' }),
      row('second-pair-fee', 'platform_fee', 60, { supporterProfileId: 'reader-2' }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.pairs).toHaveLength(3);
  });
});
