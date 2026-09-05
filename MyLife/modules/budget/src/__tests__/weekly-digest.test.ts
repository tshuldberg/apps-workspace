import { describe, it, expect } from 'vitest';
import { generateWeeklyDigest } from '../engine/weekly-digest';
import type { DigestTransaction } from '../engine/weekly-digest';

describe('generateWeeklyDigest', () => {
  const baseTransactions: DigestTransaction[] = [
    { amountCents: 5000, direction: 'outflow', merchant: 'Coffee Shop', envelopeName: 'Dining', date: '2026-03-16' },
    { amountCents: 15000, direction: 'outflow', merchant: 'Grocery Store', envelopeName: 'Groceries', date: '2026-03-17' },
    { amountCents: 8000, direction: 'outflow', merchant: 'Gas Station', envelopeName: 'Transport', date: '2026-03-18' },
    { amountCents: 300000, direction: 'inflow', merchant: 'Employer', envelopeName: null, date: '2026-03-20' },
  ];

  it('calculates totals correctly', () => {
    const result = generateWeeklyDigest({
      transactions: baseTransactions,
      priorWeekSpentCents: null,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    expect(result.totalSpentCents).toBe(28000); // 5000 + 15000 + 8000
    expect(result.totalIncomeCents).toBe(300000);
    expect(result.netCents).toBe(272000); // 300000 - 28000
    expect(result.transactionCount).toBe(4);
    expect(result.weekEnd).toBe('2026-03-22');
  });

  it('identifies top categories', () => {
    const result = generateWeeklyDigest({
      transactions: baseTransactions,
      priorWeekSpentCents: null,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    expect(result.topCategories[0].envelopeName).toBe('Groceries');
    expect(result.topCategories[0].totalCents).toBe(15000);
  });

  it('finds biggest purchase', () => {
    const result = generateWeeklyDigest({
      transactions: baseTransactions,
      priorWeekSpentCents: null,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    expect(result.biggestPurchase?.merchant).toBe('Grocery Store');
    expect(result.biggestPurchase?.amountCents).toBe(15000);
  });

  it('calculates week-over-week change', () => {
    const result = generateWeeklyDigest({
      transactions: baseTransactions,
      priorWeekSpentCents: 35000,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    // (28000 - 35000) / 35000 = -0.2
    expect(result.weekOverWeekChange).toBeCloseTo(-0.2);
    expect(result.summary).toContain('down 20%');
  });

  it('counts no-spend days', () => {
    // Spending on 3 days (16, 17, 18), so 4 no-spend days
    const result = generateWeeklyDigest({
      transactions: baseTransactions,
      priorWeekSpentCents: null,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    // Inflow on 20th doesn't count as spend, outflow on 16, 17, 18
    expect(result.noSpendDays).toBe(4);
  });

  it('handles empty week', () => {
    const result = generateWeeklyDigest({
      transactions: [],
      priorWeekSpentCents: null,
      alertsTriggered: 0,
      weekStart: '2026-03-16',
    });

    expect(result.totalSpentCents).toBe(0);
    expect(result.topCategories).toHaveLength(0);
    expect(result.biggestPurchase).toBeNull();
    expect(result.noSpendDays).toBe(7);
  });
});
