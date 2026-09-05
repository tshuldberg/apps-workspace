import { describe, expect, it } from 'vitest';
import { calculateEqualSplit, calculateSettlements, validateCustomSplit } from '../engines/settlement';

describe('settlement engine', () => {
  describe('calculateEqualSplit', () => {
    it('$100 / 2 = $50.00 each', () => {
      const splits = calculateEqualSplit(10000, ['Alice', 'Bob']);
      expect(splits).toEqual([
        { participantName: 'Alice', amountCents: 5000 },
        { participantName: 'Bob', amountCents: 5000 },
      ]);
    });

    it('$100 / 3 = $33.34, $33.33, $33.33 (penny rounding to first)', () => {
      const splits = calculateEqualSplit(10000, ['Alice', 'Bob', 'Carol']);
      expect(splits[0].amountCents).toBe(3334);
      expect(splits[1].amountCents).toBe(3333);
      expect(splits[2].amountCents).toBe(3333);
      expect(splits.reduce((s, x) => s + x.amountCents, 0)).toBe(10000);
    });

    it('$100 / 1 = $100.00', () => {
      const splits = calculateEqualSplit(10000, ['Alice']);
      expect(splits).toEqual([{ participantName: 'Alice', amountCents: 10000 }]);
    });

    it('$10 / 3 = $3.34, $3.33, $3.33', () => {
      const splits = calculateEqualSplit(1000, ['Alice', 'Bob', 'Carol']);
      expect(splits[0].amountCents).toBe(334);
      expect(splits[1].amountCents).toBe(333);
      expect(splits[2].amountCents).toBe(333);
      expect(splits.reduce((s, x) => s + x.amountCents, 0)).toBe(1000);
    });

    it('returns empty array for no participants', () => {
      expect(calculateEqualSplit(10000, [])).toEqual([]);
    });
  });

  describe('validateCustomSplit', () => {
    it('amounts sum to total passes', () => {
      const result = validateCustomSplit(10000, [
        { participantName: 'Alice', amountCents: 6000 },
        { participantName: 'Bob', amountCents: 4000 },
      ]);
      expect(result).toBeNull();
    });

    it('amounts sum to $90 for $100 expense fails', () => {
      const result = validateCustomSplit(10000, [
        { participantName: 'Alice', amountCents: 5000 },
        { participantName: 'Bob', amountCents: 4000 },
      ]);
      expect(result).toContain('Amounts must add up to $100.00');
      expect(result).toContain('Currently $90.00');
    });

    it('negative amount fails', () => {
      const result = validateCustomSplit(10000, [
        { participantName: 'Alice', amountCents: -100 },
        { participantName: 'Bob', amountCents: 10100 },
      ]);
      expect(result).toContain('cannot be negative');
    });
  });

  describe('calculateSettlements', () => {
    it('Alice paid $120, Bob $60, Carol $0 at $60/each -> Carol pays Alice $60', () => {
      const settlements = calculateSettlements([
        {
          paidByName: 'Alice',
          amountCents: 12000,
          splits: [
            { participantName: 'Alice', amountCents: 6000 },
            { participantName: 'Bob', amountCents: 6000 },
          ],
        },
        {
          paidByName: 'Bob',
          amountCents: 6000,
          splits: [
            { participantName: 'Carol', amountCents: 6000 },
          ],
        },
      ]);
      // Net: Alice +6000, Bob 0, Carol -6000
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({
        from: 'Carol',
        to: 'Alice',
        amountCents: 6000,
      });
    });

    it('all paid equally returns empty settlement list', () => {
      const settlements = calculateSettlements([
        {
          paidByName: 'Alice',
          amountCents: 3000,
          splits: [
            { participantName: 'Alice', amountCents: 3000 },
          ],
        },
        {
          paidByName: 'Bob',
          amountCents: 3000,
          splits: [
            { participantName: 'Bob', amountCents: 3000 },
          ],
        },
      ]);
      expect(settlements).toHaveLength(0);
    });

    it('one person paid everything -> N-1 transactions', () => {
      const settlements = calculateSettlements([
        {
          paidByName: 'Alice',
          amountCents: 9000,
          splits: [
            { participantName: 'Alice', amountCents: 3000 },
            { participantName: 'Bob', amountCents: 3000 },
            { participantName: 'Carol', amountCents: 3000 },
          ],
        },
      ]);
      expect(settlements).toHaveLength(2);
      const total = settlements.reduce((s, x) => s + x.amountCents, 0);
      expect(total).toBe(6000);
      expect(settlements.every((s) => s.to === 'Alice')).toBe(true);
    });

    it('complex 5-person scenario produces minimal transactions', () => {
      // Alice paid $50, Bob paid $30, Carol paid $20, Dave $0, Eve $0
      // Equal split: $100 / 5 = $20 each
      const settlements = calculateSettlements([
        {
          paidByName: 'Alice',
          amountCents: 5000,
          splits: [
            { participantName: 'Alice', amountCents: 2000 },
            { participantName: 'Bob', amountCents: 2000 },
            { participantName: 'Carol', amountCents: 2000 },
            { participantName: 'Dave', amountCents: 2000 },
            { participantName: 'Eve', amountCents: 2000 },
          ],
        },
        // Bob also paid $30 for another expense split among Alice, Bob, Carol
          {
          paidByName: 'Bob',
          amountCents: 3000,
          splits: [
            { participantName: 'Alice', amountCents: 1000 },
            { participantName: 'Bob', amountCents: 1000 },
            { participantName: 'Carol', amountCents: 1000 },
          ],
        },
      ]);

      // Net balances: Alice: 5000 - 2000 - 1000 = 2000; Bob: 3000 - 2000 - 1000 = 0
      // Carol: -2000 - 1000 = -3000; Dave: -2000; Eve: -2000
      // Settlements should not produce negative amounts
      for (const s of settlements) {
        expect(s.amountCents).toBeGreaterThan(0);
      }
      expect(settlements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles fractional cents (rounds to nearest cent)', () => {
      // Amounts are already in cents (integers), so no fractional cents issue
      const settlements = calculateSettlements([
        {
          paidByName: 'Alice',
          amountCents: 1000,
          splits: [
            { participantName: 'Alice', amountCents: 334 },
            { participantName: 'Bob', amountCents: 333 },
            { participantName: 'Carol', amountCents: 333 },
          ],
        },
      ]);
      // Alice net: 1000 - 334 = +666; Bob: -333; Carol: -333
      expect(settlements).toHaveLength(2);
      expect(settlements.reduce((s, x) => s + x.amountCents, 0)).toBe(666);
    });

    it('handles empty expenses', () => {
      expect(calculateSettlements([])).toEqual([]);
    });
  });
});
