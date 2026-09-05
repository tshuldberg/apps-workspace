import { describe, expect, it } from 'vitest';
import { calculateNetWorth } from '../engine/net-worth';

describe('calculateNetWorth', () => {
  it('treats budget credit accounts as liabilities', () => {
    const result = calculateNetWorth([
      { id: 'checking', name: 'Checking', accountType: 'checking', balance: 500_00 },
      { id: 'credit', name: 'Travel Card', accountType: 'credit', balance: 125_00 },
      { id: 'loan', name: 'Car Loan', accountType: 'loan', balance: 1_500_00 },
    ]);

    expect(result.totalAssets).toBe(500_00);
    expect(result.totalLiabilities).toBe(1_625_00);
    expect(result.netWorth).toBe(-1_125_00);
  });
});
