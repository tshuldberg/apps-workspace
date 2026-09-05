import { describe, expect, it } from 'vitest';
import { DEFAULT_FEE_CONFIG, payoutEligible, splitCharge } from './fees';

describe('splitCharge', () => {
  it('splits the documented $18 example', () => {
    const split = splitCharge([
      { journalistId: 'a', amountCents: 500 },
      { journalistId: 'b', amountCents: 300 },
      { journalistId: 'c', amountCents: 1000 },
    ]);
    expect(split.grossCents).toBe(1800);
    expect(split.processingFeeCents).toBe(82);
    expect(split.platformFeeCents).toBe(36);
    const net = split.journalistNetCents.reduce((s, j) => s + j.netCents, 0);
    expect(net).toBe(1800 - 82 - 36);
  });

  it('conserves every cent across 500 randomized charges (seeded)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let t = 0; t < 500; t++) {
      const n = 1 + Math.floor(rnd() * 6);
      const pledges = Array.from({ length: n }, (_, i) => ({
        journalistId: `j${i}`,
        amountCents: 100 + Math.floor(rnd() * 5000),
      }));
      const split = splitCharge(pledges);
      const net = split.journalistNetCents.reduce((s, j) => s + j.netCents, 0);
      expect(net + split.platformFeeCents + split.processingFeeCents).toBe(split.grossCents);
      for (const j of split.journalistNetCents) expect(j.netCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('allocates proportionally (larger pledge, larger net)', () => {
    const split = splitCharge([
      { journalistId: 'small', amountCents: 200 },
      { journalistId: 'big', amountCents: 2000 },
    ]);
    const small = split.journalistNetCents.find((j) => j.journalistId === 'small')!;
    const big = split.journalistNetCents.find((j) => j.journalistId === 'big')!;
    expect(big.netCents).toBeGreaterThan(small.netCents * 8);
  });

  it('rejects empty and non-positive inputs', () => {
    expect(() => splitCharge([])).toThrow();
    expect(() => splitCharge([{ journalistId: 'a', amountCents: 0 }])).toThrow();
  });

  it('rejects charges too small to cover fees', () => {
    expect(() => splitCharge([{ journalistId: 'a', amountCents: 30 }])).toThrow();
  });
});

describe('payoutEligible', () => {
  it('applies the $10 threshold', () => {
    expect(payoutEligible(999)).toBe(false);
    expect(payoutEligible(1000)).toBe(true);
    expect(DEFAULT_FEE_CONFIG.payoutMinCents).toBe(1000);
  });
});
