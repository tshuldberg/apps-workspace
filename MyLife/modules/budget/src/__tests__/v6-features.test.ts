import { describe, it, expect } from 'vitest';

// Receipt parser
import {
  parseReceiptText,
  calculateConfidence,
  normalizeMerchant as normalizeReceiptMerchant,
  isReceiptPaymentLine,
  redactReceiptPaymentLines,
} from '../engine/receipt-parser';

// Categorizer
import {
  predictCategory,
  calculateAccuracy,
  normalizeMerchant as normalizeCategorizerMerchant,
} from '../engine/categorizer';
import type { FeedbackRecord } from '../engine/categorizer';

// Loan planner
import {
  calculateMonthlyPayment,
  generateLoanAmortization,
  getLoanSummary,
  compareScenarios,
  splitPayment,
  calculateTotalInterest,
} from '../engine/loan-planner';

// Investment tracker
import {
  calculateHoldingValue,
  calculateHoldingGainLoss,
  calculatePortfolioSummary,
  calculateAllocation,
  buildPerformanceTimeline,
} from '../engine/investment-tracker';
import type { HoldingInput } from '../engine/investment-tracker';

// Family sharing
import {
  generateInviteCode,
  isInviteExpired,
  resolveConflict,
  canWriteToEnvelope,
  canViewEnvelope,
  MAX_FAMILY_SIZE,
} from '../engine/family-sharing';
import type { SyncPayload } from '../engine/family-sharing';

// Expense splitting
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  validateSplitAmounts,
  validatePercentages,
  calculateBalances,
} from '../engine/expense-splitting';

// =====================================================================
// Receipt Parser
// =====================================================================

describe('Receipt Parser', () => {
  describe('parseReceiptText', () => {
    it('extracts merchant from common receipt format', () => {
      const text = `WHOLE FOODS MARKET
123 Main St, San Francisco CA 94105
03/15/2026

Organic Bananas    $2.99
Almond Milk        $4.49
SUBTOTAL           $7.48
TAX                $0.62
TOTAL              $8.10`;
      const result = parseReceiptText(text);
      expect(result.merchant).toContain('WHOLE FOODS');
      expect(result.total).toBe(810);
      expect(result.tax).toBe(62);
      expect(result.subtotal).toBe(748);
      expect(result.date).toBe('2026-03-15');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('extracts total with currency symbols', () => {
      const text = `Store Name
TOTAL £25.50`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(2550);
      expect(result.currency).toBe('GBP');
    });

    it('handles empty text', () => {
      const result = parseReceiptText('');
      expect(result.merchant).toBeNull();
      expect(result.total).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('handles garbage text', () => {
      const result = parseReceiptText('asdfqwer\nxyz123\n!!!');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('sums line items when no total found', () => {
      const text = `My Store
Item A    $5.00
Item B    $3.00`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(800);
      expect(result.lineItems.length).toBe(2);
    });

    it('does not parse tender, authorization, or masked-card lines as items', () => {
      const text = `TRADER JOE'S
Bananas          $2.49
VISA **** 4242   $2.49
AUTH 123456 APPROVED
TOTAL            $2.49`;
      const result = parseReceiptText(text);
      expect(result.lineItems.map((item) => item.description)).toEqual(['Bananas']);
    });
  });

  describe('redactReceiptPaymentLines', () => {
    it('redacts payment lines while keeping food lines parseable', () => {
      const text = `GROCERY STORE
Organic Milk     $5.99
Debit card ending in 1234
AUTH CODE 991122 APPROVED
TOTAL            $5.99`;
      const redacted = redactReceiptPaymentLines(text);
      expect(redacted.redactedText).toContain('Organic Milk');
      expect(redacted.redactedText).not.toContain('1234');
      expect(redacted.redactedText).not.toContain('991122');
      expect(redacted.redactions).toHaveLength(2);
      expect(parseReceiptText(redacted.redactedText).lineItems[0]?.description).toBe('Organic Milk');
    });

    it('detects common payment evidence lines', () => {
      expect(isReceiptPaymentLine('VISA **** 1111 12.45')).toBe(true);
      expect(isReceiptPaymentLine('Organic Apples 12.45')).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('returns 0 for empty text', () => {
      expect(calculateConfidence('')).toBe(0);
    });

    it('returns higher confidence for well-structured receipts', () => {
      const good = `STORE NAME\n01/01/2026\nTOTAL $10.00`;
      const bad = `random text`;
      expect(calculateConfidence(good)).toBeGreaterThan(calculateConfidence(bad));
    });
  });

  describe('normalizeReceiptMerchant', () => {
    it('strips store numbers', () => {
      expect(normalizeReceiptMerchant('WHOLE FOODS #10456')).toBe('whole foods');
    });

    it('handles empty input', () => {
      expect(normalizeReceiptMerchant('')).toBe('');
    });
  });
});

// =====================================================================
// Categorizer
// =====================================================================

describe('ML Categorizer', () => {
  const makeHistory = (merchant: string, envelopeId: string, count: number, daysAgo = 5): FeedbackRecord[] => {
    const records: FeedbackRecord[] = [];
    const baseDate = new Date('2026-03-15');
    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - daysAgo - i);
      records.push({
        merchantNormalized: merchant,
        envelopeId,
        wasAccepted: true,
        amount: 5000,
        date: date.toISOString().split('T')[0],
      });
    }
    return records;
  };

  describe('normalizeMerchant', () => {
    it('strips store numbers and normalizes', () => {
      expect(normalizeCategorizerMerchant('TRADER JOE\'S #123')).toBe("trader joe's");
    });

    it('handles empty input', () => {
      expect(normalizeCategorizerMerchant('')).toBe('');
    });
  });

  describe('predictCategory', () => {
    it('returns top envelope for known merchant', () => {
      const history = makeHistory('trader joes', 'env-groceries', 12);
      const result = predictCategory(
        { merchant: 'trader joes', amount: 5000, date: '2026-03-15' },
        history,
      );
      expect(result).not.toBeNull();
      expect(result!.envelopeId).toBe('env-groceries');
      expect(result!.confidence).toBeGreaterThan(0.6);
    });

    it('returns null for unknown merchant', () => {
      const history = makeHistory('trader joes', 'env-groceries', 12);
      const result = predictCategory(
        { merchant: 'random store xyz', amount: 5000, date: '2026-03-15' },
        history,
      );
      expect(result).toBeNull();
    });

    it('returns null with insufficient history', () => {
      const history = makeHistory('store', 'env-a', 5);
      const result = predictCategory(
        { merchant: 'store', amount: 5000, date: '2026-03-15' },
        history,
        { minHistory: 10 },
      );
      expect(result).toBeNull();
    });

    it('applies recency bias', () => {
      // 5 old records for envelope A, 5 recent records for envelope B
      const oldHistory = makeHistory('store', 'env-a', 5, 60);
      const recentHistory = makeHistory('store', 'env-b', 5, 1);
      const combined = [...oldHistory, ...recentHistory];

      const result = predictCategory(
        { merchant: 'store', amount: 5000, date: '2026-03-15' },
        combined,
      );
      expect(result).not.toBeNull();
      expect(result!.envelopeId).toBe('env-b');
    });
  });

  describe('calculateAccuracy', () => {
    it('calculates accuracy ratio', () => {
      const result = calculateAccuracy(8, 2);
      expect(result.accuracy).toBe(0.8);
      expect(result.total).toBe(10);
    });

    it('handles zero total', () => {
      const result = calculateAccuracy(0, 0);
      expect(result.accuracy).toBe(0);
    });
  });
});

// =====================================================================
// Loan Planner
// =====================================================================

describe('Loan Planner', () => {
  describe('calculateMonthlyPayment', () => {
    it('calculates 30yr mortgage at 6.50%', () => {
      const payment = calculateMonthlyPayment({
        principal: 30000000, // $300,000
        interestRate: 650,   // 6.50%
        termMonths: 360,
      });
      // Expected ~$1896/mo -> ~189620 cents
      expect(payment).toBeGreaterThan(189000);
      expect(payment).toBeLessThan(190500);
    });

    it('handles 0% interest', () => {
      const payment = calculateMonthlyPayment({
        principal: 1200000, // $12,000
        interestRate: 0,
        termMonths: 12,
      });
      expect(payment).toBe(100000); // $1,000/mo
    });

    it('returns 0 for zero principal', () => {
      expect(calculateMonthlyPayment({ principal: 0, interestRate: 650, termMonths: 360 })).toBe(0);
    });
  });

  describe('generateLoanAmortization', () => {
    it('generates correct number of entries', () => {
      const schedule = generateLoanAmortization({
        principal: 1200000, // $12,000
        interestRate: 500,  // 5.00%
        termMonths: 12,
      });
      expect(schedule.length).toBe(12);
    });

    it('ends with zero balance', () => {
      const schedule = generateLoanAmortization({
        principal: 1200000,
        interestRate: 500,
        termMonths: 12,
      });
      const last = schedule[schedule.length - 1];
      expect(last.remainingBalance).toBe(0);
    });

    it('extra payments reduce term', () => {
      const normal = generateLoanAmortization({
        principal: 2400000, // $24,000
        interestRate: 500,
        termMonths: 24,
      });
      const withExtra = generateLoanAmortization({
        principal: 2400000,
        interestRate: 500,
        termMonths: 24,
        extraPayment: 50000, // $500/mo extra
      });
      expect(withExtra.length).toBeLessThan(normal.length);
    });
  });

  describe('compareScenarios', () => {
    it('shows interest savings for shorter term', () => {
      const result = compareScenarios(
        { principal: 30000000, interestRate: 650, termMonths: 360 },
        { principal: 30000000, interestRate: 650, termMonths: 180 },
      );
      expect(result.interestSaved).toBeGreaterThan(0);
      expect(result.monthsSaved).toBeGreaterThan(0);
    });
  });

  describe('splitPayment', () => {
    it('correctly splits principal and interest', () => {
      const result = splitPayment(30000000, 650, 189620);
      expect(result.interestAmount).toBeGreaterThan(0);
      expect(result.principalAmount).toBeGreaterThan(0);
      expect(result.principalAmount + result.interestAmount).toBeLessThanOrEqual(189620);
    });

    it('handles 0% interest', () => {
      const result = splitPayment(1200000, 0, 100000);
      expect(result.interestAmount).toBe(0);
      expect(result.principalAmount).toBe(100000);
    });
  });

  describe('calculateTotalInterest', () => {
    it('returns total interest for loan lifetime', () => {
      const interest = calculateTotalInterest({
        principal: 30000000,
        interestRate: 650,
        termMonths: 360,
      });
      expect(interest).toBeGreaterThan(30000000); // More interest than principal for 30yr at 6.5%
    });
  });
});

// =====================================================================
// Investment Tracker
// =====================================================================

describe('Investment Tracker', () => {
  const holdings: HoldingInput[] = [
    { id: 'h1', symbol: 'VTI', name: 'Vanguard Total Stock', assetClass: 'etf', shares: 50, costBasis: 1000000, currentPrice: 22000, isActive: true },
    { id: 'h2', symbol: 'BND', name: 'Vanguard Total Bond', assetClass: 'bond', shares: 100, costBasis: 700000, currentPrice: 7200, isActive: true },
    { id: 'h3', symbol: 'OLD', name: 'Sold Position', assetClass: 'stock', shares: 0, costBasis: 500000, currentPrice: 10000, isActive: false },
  ];

  describe('calculateHoldingValue', () => {
    it('multiplies shares by price', () => {
      expect(calculateHoldingValue(50, 22000)).toBe(1100000);
    });
  });

  describe('calculateHoldingGainLoss', () => {
    it('calculates gain correctly', () => {
      const result = calculateHoldingGainLoss(holdings[0]);
      expect(result.currentValue).toBe(1100000);
      expect(result.gainLoss).toBe(100000); // +$1000
      expect(result.returnPct).toBe(10);
    });

    it('handles zero cost basis', () => {
      const h: HoldingInput = { ...holdings[0], costBasis: 0 };
      const result = calculateHoldingGainLoss(h);
      expect(result.returnPct).toBe(0);
    });
  });

  describe('calculatePortfolioSummary', () => {
    it('sums active holdings only', () => {
      const result = calculatePortfolioSummary(holdings);
      expect(result.holdingCount).toBe(2);
      expect(result.totalValue).toBe(1100000 + 720000);
      expect(result.totalCostBasis).toBe(1000000 + 700000);
    });

    it('handles empty portfolio', () => {
      const result = calculatePortfolioSummary([]);
      expect(result.totalValue).toBe(0);
      expect(result.holdingCount).toBe(0);
    });
  });

  describe('calculateAllocation', () => {
    it('returns percentages summing close to 100', () => {
      const alloc = calculateAllocation(holdings);
      const sum = alloc.reduce((s, a) => s + a.percentage, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(1);
      expect(alloc.length).toBe(2); // etf + bond (inactive excluded)
    });
  });

  describe('buildPerformanceTimeline', () => {
    it('groups by date and sorts chronologically', () => {
      const snapshots = [
        { date: '2026-03-02', totalValue: 500000 },
        { date: '2026-03-01', totalValue: 480000 },
        { date: '2026-03-02', totalValue: 300000 },
      ];
      const timeline = buildPerformanceTimeline(snapshots);
      expect(timeline.length).toBe(2);
      expect(timeline[0].date).toBe('2026-03-01');
      expect(timeline[1].totalValue).toBe(800000); // 500k + 300k
    });
  });
});

// =====================================================================
// Family Sharing
// =====================================================================

describe('Family Sharing', () => {
  describe('generateInviteCode', () => {
    it('produces 8-character code', () => {
      const code = generateInviteCode();
      expect(code.length).toBe(8);
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
    });

    it('produces unique codes', () => {
      const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
      expect(codes.size).toBe(20);
    });
  });

  describe('isInviteExpired', () => {
    it('returns false for recent invite', () => {
      const now = new Date('2026-03-15T12:00:00Z');
      const created = '2026-03-15T10:00:00Z'; // 2 hours ago
      expect(isInviteExpired(created, now)).toBe(false);
    });

    it('returns true after 24 hours', () => {
      const now = new Date('2026-03-16T13:00:00Z');
      const created = '2026-03-15T12:00:00Z'; // 25 hours ago
      expect(isInviteExpired(created, now)).toBe(true);
    });
  });

  describe('resolveConflict', () => {
    const makePayload = (ts: string, deviceId = 'device-a'): SyncPayload => ({
      operation: 'update',
      tableName: 'bg_transactions',
      recordId: 'txn-1',
      record: { amount: 5000 },
      timestamp: ts,
      deviceId,
    });

    it('selects later timestamp as winner', () => {
      const a = makePayload('2026-03-15T10:00:00Z');
      const b = makePayload('2026-03-15T11:00:00Z');
      const result = resolveConflict(a, b);
      expect(result.winner.timestamp).toBe('2026-03-15T11:00:00Z');
    });

    it('uses device ID tiebreak for equal timestamps', () => {
      const a = makePayload('2026-03-15T10:00:00Z', 'device-a');
      const b = makePayload('2026-03-15T10:00:00Z', 'device-b');
      const result = resolveConflict(a, b);
      expect(result.winner.deviceId).toBe('device-b');
    });
  });

  describe('permissions', () => {
    it('owner can write to private envelope', () => {
      expect(canWriteToEnvelope('private', 'owner', true)).toBe(true);
    });

    it('non-owner cannot write to private envelope', () => {
      expect(canWriteToEnvelope('private', 'member', false)).toBe(false);
    });

    it('viewer cannot write to shared envelope', () => {
      expect(canWriteToEnvelope('shared', 'viewer', false)).toBe(false);
    });

    it('member can write to shared envelope', () => {
      expect(canWriteToEnvelope('shared', 'member', false)).toBe(true);
    });

    it('non-owner cannot view private envelope', () => {
      expect(canViewEnvelope('private', false)).toBe(false);
    });

    it('anyone can view shared envelope', () => {
      expect(canViewEnvelope('shared', false)).toBe(true);
    });
  });

  it('MAX_FAMILY_SIZE is 6', () => {
    expect(MAX_FAMILY_SIZE).toBe(6);
  });
});

// =====================================================================
// Expense Splitting
// =====================================================================

describe('Expense Splitting', () => {
  describe('calculateEqualSplit', () => {
    it('splits evenly for divisible amount', () => {
      const result = calculateEqualSplit(1000, [
        { contactId: null, isSelf: true },
        { contactId: 'c1', isSelf: false },
      ]);
      expect(result.length).toBe(2);
      expect(result[0].shareAmount).toBe(500);
      expect(result[1].shareAmount).toBe(500);
    });

    it('assigns remainder to first participant', () => {
      const result = calculateEqualSplit(10000, [
        { contactId: null, isSelf: true },
        { contactId: 'c1', isSelf: false },
        { contactId: 'c2', isSelf: false },
      ]);
      // $100 / 3 = $33.33 each, remainder 1 cent to first
      expect(result[0].shareAmount).toBe(3334);
      expect(result[1].shareAmount).toBe(3333);
      expect(result[2].shareAmount).toBe(3333);
      expect(result.reduce((s, r) => s + r.shareAmount, 0)).toBe(10000);
    });
  });

  describe('calculatePercentageSplit', () => {
    it('splits by percentage', () => {
      const result = calculatePercentageSplit(10000, [
        { contactId: null, isSelf: true, shareValue: 0.5 },
        { contactId: 'c1', isSelf: false, shareValue: 0.3 },
        { contactId: 'c2', isSelf: false, shareValue: 0.2 },
      ]);
      expect(result[0].shareAmount).toBe(5000);
      expect(result[1].shareAmount).toBe(3000);
      expect(result[2].shareAmount).toBe(2000);
    });
  });

  describe('calculateSharesSplit', () => {
    it('splits proportionally by shares', () => {
      const result = calculateSharesSplit(9000, [
        { contactId: null, isSelf: true, shareValue: 2 },
        { contactId: 'c1', isSelf: false, shareValue: 1 },
      ]);
      expect(result[0].shareAmount).toBe(6000);
      expect(result[1].shareAmount).toBe(3000);
    });
  });

  describe('validateSplitAmounts', () => {
    it('validates correct sum', () => {
      expect(validateSplitAmounts([5000, 3000, 2000], 10000).valid).toBe(true);
    });

    it('rejects incorrect sum', () => {
      const result = validateSplitAmounts([5000, 3000], 10000);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(2000);
    });
  });

  describe('validatePercentages', () => {
    it('validates 100%', () => {
      expect(validatePercentages([0.5, 0.3, 0.2]).valid).toBe(true);
    });

    it('rejects non-100%', () => {
      expect(validatePercentages([0.5, 0.3]).valid).toBe(false);
    });
  });

  describe('calculateBalances', () => {
    it('tracks who owes whom', () => {
      const splits = [
        {
          paidBy: 'self',
          participants: [
            { contactId: null, isSelf: true, shareAmount: 5000 },
            { contactId: 'c1', isSelf: false, shareAmount: 5000 },
          ],
          isSettled: false,
        },
      ];
      const result = calculateBalances(splits, [], new Map([['c1', 'Alex']]));
      expect(result.totalOwedToYou).toBe(5000);
      expect(result.entries[0].netBalance).toBe(5000);
      expect(result.entries[0].contactName).toBe('Alex');
    });

    it('reduces balance with settlements', () => {
      const splits = [
        {
          paidBy: 'self',
          participants: [
            { contactId: null, isSelf: true, shareAmount: 5000 },
            { contactId: 'c1', isSelf: false, shareAmount: 5000 },
          ],
          isSettled: false,
        },
      ];
      const settlements = [{ contactId: 'c1', amount: -3000 }]; // they paid back $30
      const result = calculateBalances(splits, settlements, new Map([['c1', 'Alex']]));
      expect(result.entries[0].netBalance).toBe(2000); // $50 - $30 = $20 remaining
    });

    it('handles when someone else paid', () => {
      const splits = [
        {
          paidBy: 'c1',
          participants: [
            { contactId: null, isSelf: true, shareAmount: 3000 },
            { contactId: 'c1', isSelf: false, shareAmount: 3000 },
          ],
          isSettled: false,
        },
      ];
      const result = calculateBalances(splits, [], new Map([['c1', 'Alex']]));
      expect(result.totalYouOwe).toBe(3000);
      expect(result.entries[0].netBalance).toBe(-3000);
    });

    it('returns empty for settled splits', () => {
      const splits = [
        {
          paidBy: 'self',
          participants: [
            { contactId: null, isSelf: true, shareAmount: 5000 },
            { contactId: 'c1', isSelf: false, shareAmount: 5000 },
          ],
          isSettled: true,
        },
      ];
      const result = calculateBalances(splits, [], new Map([['c1', 'Alex']]));
      expect(result.entries.length).toBe(0);
    });
  });
});
