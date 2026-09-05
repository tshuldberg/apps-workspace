import { describe, it, expect } from 'vitest';
import {
  calculateAgeOfMoney,
  buildFifoQueue,
  getAoMStatus,
  calculateAoMTrend,
} from '../age-of-money';
import type { AoMTransaction } from '../age-of-money';

describe('buildFifoQueue', () => {
  it('orders inflows by date ascending', () => {
    const txns: AoMTransaction[] = [
      { amount: 1000, direction: 'inflow', occurredOn: '2026-03-01' },
      { amount: 2000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 3000, direction: 'inflow', occurredOn: '2026-02-01' },
    ];
    const queue = buildFifoQueue(txns);
    expect(queue).toHaveLength(3);
    expect(queue[0].date).toBe('2026-01-01');
    expect(queue[1].date).toBe('2026-02-01');
    expect(queue[2].date).toBe('2026-03-01');
  });

  it('skips outflows, transfers, and zero amounts', () => {
    const txns: AoMTransaction[] = [
      { amount: 1000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 500, direction: 'outflow', occurredOn: '2026-01-02' },
      { amount: 300, direction: 'transfer', occurredOn: '2026-01-03' },
      { amount: 0, direction: 'inflow', occurredOn: '2026-01-04' },
    ];
    const queue = buildFifoQueue(txns);
    expect(queue).toHaveLength(1);
    expect(queue[0].remainingAmount).toBe(1000);
  });
});

describe('calculateAgeOfMoney', () => {
  it('returns null for empty transactions', () => {
    expect(calculateAgeOfMoney([], '2026-03-15')).toBeNull();
  });

  it('returns null for only inflows (no outflows)', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-01-01' },
    ];
    expect(calculateAgeOfMoney(txns, '2026-03-15')).toBeNull();
  });

  it('returns AoM = 0 for only outflows (no inflows / deficit spending)', () => {
    const txns: AoMTransaction[] = [
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    expect(result!.ageDays).toBe(0);
  });

  it('calculates AoM = 0 for single inflow and outflow on same day', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-03-15' },
      { amount: 50000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    expect(result!.ageDays).toBe(0);
  });

  it('calculates AoM = 30 for inflows 30 days ago', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-02-13' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    expect(result!.ageDays).toBe(30);
  });

  it('calculates correct AoM with 3 inflows and 10 outflows (FIFO method)', () => {
    // 3 inflows: $1000 each on Jan 1, Feb 1, Mar 1
    // 10 outflows: $100 each on Mar 15
    // Total outflows = $1000, consumes all of Jan 1 inflow
    // Age = days from Jan 1 to Mar 15 = 73 days
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 100000, direction: 'inflow', occurredOn: '2026-02-01' },
      { amount: 100000, direction: 'inflow', occurredOn: '2026-03-01' },
      ...Array.from({ length: 10 }, () => ({
        amount: 10000,
        direction: 'outflow' as const,
        occurredOn: '2026-03-15',
      })),
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    // All 10 outflows consume from Jan 1 inflow (73 days old on Mar 15)
    expect(result!.ageDays).toBe(73);
    expect(result!.sampleSize).toBe(10);
    expect(result!.isEstimate).toBe(false);
  });

  it('excludes transfers from both queues', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 50000, direction: 'transfer', occurredOn: '2026-02-01' },
      { amount: 10000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    expect(result!.ageDays).toBe(73); // Jan 1 to Mar 15
    expect(result!.sampleSize).toBe(1);
  });

  it('handles outflow split across multiple inflows with weighted average', () => {
    // Inflow 1: $500 on Jan 1 (73 days old on Mar 15)
    // Inflow 2: $500 on Feb 1 (42 days old on Mar 15)
    // Outflow: $800 on Mar 15 -> consumes $500 from Jan 1 + $300 from Feb 1
    // weighted age = (500*73 + 300*42) / 800 = (36500+12600)/800 = 61.375 -> 61
    const txns: AoMTransaction[] = [
      { amount: 50000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 50000, direction: 'inflow', occurredOn: '2026-02-01' },
      { amount: 80000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15');
    expect(result).not.toBeNull();
    expect(result!.ageDays).toBe(61);
  });

  it('respects sampleSize parameter', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-10' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-11' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-12' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-13' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-14' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15', 3);
    expect(result).not.toBeNull();
    // Samples last 3 outflows: Mar 15, 14, 13
    expect(result!.sampleSize).toBe(3);
    expect(result!.isEstimate).toBe(false);
  });

  it('sets isEstimate true when fewer outflows than sample size', () => {
    const txns: AoMTransaction[] = [
      { amount: 100000, direction: 'inflow', occurredOn: '2026-01-01' },
      { amount: 5000, direction: 'outflow', occurredOn: '2026-03-15' },
    ];
    const result = calculateAgeOfMoney(txns, '2026-03-15', 10);
    expect(result).not.toBeNull();
    expect(result!.sampleSize).toBe(1);
    expect(result!.isEstimate).toBe(true);
  });
});

describe('getAoMStatus', () => {
  it('returns urgent for < 14 days', () => {
    expect(getAoMStatus(0)).toBe('urgent');
    expect(getAoMStatus(13)).toBe('urgent');
  });

  it('returns improving for 14-29 days', () => {
    expect(getAoMStatus(14)).toBe('improving');
    expect(getAoMStatus(29)).toBe('improving');
  });

  it('returns healthy for 30+ days', () => {
    expect(getAoMStatus(30)).toBe('healthy');
    expect(getAoMStatus(365)).toBe('healthy');
  });
});

describe('calculateAoMTrend', () => {
  it('returns flat when previous is null', () => {
    expect(calculateAoMTrend(30, null)).toEqual({ change: 0, direction: 'flat' });
  });

  it('returns up when current > previous', () => {
    expect(calculateAoMTrend(35, 30)).toEqual({ change: 5, direction: 'up' });
  });

  it('returns down when current < previous', () => {
    expect(calculateAoMTrend(25, 30)).toEqual({ change: -5, direction: 'down' });
  });

  it('returns flat when current === previous', () => {
    expect(calculateAoMTrend(30, 30)).toEqual({ change: 0, direction: 'flat' });
  });
});
