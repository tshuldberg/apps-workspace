/**
 * MK-042 -- transparent cost-plus pricing ledger. The markup policy (cost +
 * 25%) is real and enforced; the dollar figures are illustrative until real
 * provider invoices replace them, and the ledger says so.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTierPrice,
  pricingLedger,
  formatCents,
  DEFAULT_MARKUP_RATIO,
  ILLUSTRATIVE_UNIT_COSTS,
  ILLUSTRATIVE_TIERS,
  type InfraUnitCosts,
  type PricingTier,
} from '../hosted-pricing';

const COSTS: InfraUnitCosts = {
  storageGbMonthCents: 2,
  egressGbCents: 1,
  nodeMonthCents: 500,
  source: 'illustrative-test',
};
const TIER: PricingTier = { id: 't', name: 'Test', storageGb: 100, egressGbIncluded: 200, nodes: 1 };

describe('computeTierPrice (MK-042)', () => {
  it('applies cost-plus: total = raw cost + raw cost x markup', () => {
    const price = computeTierPrice(TIER, COSTS, 0.25);
    // storage 100*2=200, egress 200*1=200, compute 1*500=500 -> raw 900.
    expect(price.rawCostCents).toBe(900);
    expect(price.takeCents).toBe(225); // 900 * 0.25
    expect(price.totalCents).toBe(1125);
    expect(price.markupRatio).toBe(0.25);
  });

  it('the default markup is 25%', () => {
    expect(DEFAULT_MARKUP_RATIO).toBe(0.25);
    const price = computeTierPrice(TIER, COSTS);
    expect(price.takeCents).toBe(Math.round(price.rawCostCents * 0.25));
  });

  it('the breakdown lines sum coherently (storage+egress+compute = infra cost)', () => {
    const price = computeTierPrice(TIER, COSTS, 0.25);
    const map = Object.fromEntries(price.breakdown.map((b) => [b.label, b.cents]));
    const infra = map['Storage (100 GB)'] + map['Egress (200 GB included)'] + map['Compute (1 node)'];
    expect(infra).toBe(price.rawCostCents);
    expect(map['Infra cost']).toBe(price.rawCostCents);
    expect(map['Meerkat take (+25%)']).toBe(price.takeCents);
  });

  it('flags illustrative costs and rejects a negative markup', () => {
    expect(computeTierPrice(TIER, COSTS, 0.25).illustrative).toBe(true);
    expect(computeTierPrice(TIER, { ...COSTS, source: 'aws-invoice-2026-07' }).illustrative).toBe(false);
    expect(() => computeTierPrice(TIER, COSTS, -0.1)).toThrow();
  });

  it('a different founder-set markup flows through', () => {
    const price = computeTierPrice(TIER, COSTS, 0.4);
    expect(price.takeCents).toBe(360); // 900 * 0.4
    expect(price.totalCents).toBe(1260);
  });
});

describe('pricingLedger (MK-042 AC)', () => {
  it('prices every tier and carries an honest illustrative notice by default', () => {
    const ledger = pricingLedger();
    expect(ledger.tiers).toHaveLength(ILLUSTRATIVE_TIERS.length);
    expect(ledger.markupRatio).toBe(0.25);
    expect(ledger.illustrative).toBe(true);
    expect(ledger.notice.toLowerCase()).toContain('illustrative');
    // Every default tier is cost-plus and flagged illustrative.
    for (const tier of ledger.tiers) {
      expect(tier.totalCents).toBe(tier.rawCostCents + tier.takeCents);
      expect(tier.illustrative).toBe(true);
    }
  });

  it('with real invoice costs the notice drops the illustrative caveat', () => {
    const real: InfraUnitCosts = { ...ILLUSTRATIVE_UNIT_COSTS, source: 'gcp-invoice-2026-07' };
    const ledger = pricingLedger(ILLUSTRATIVE_TIERS, real, 0.25);
    expect(ledger.illustrative).toBe(false);
    expect(ledger.notice.toLowerCase()).not.toContain('illustrative');
    expect(ledger.notice).toContain('gcp-invoice-2026-07');
  });

  it('larger tiers cost more (monotonic in the envelope)', () => {
    const ledger = pricingLedger();
    const totals = ledger.tiers.map((t) => t.totalCents);
    for (let i = 1; i < totals.length; i++) expect(totals[i]!).toBeGreaterThan(totals[i - 1]!);
  });
});

describe('formatCents', () => {
  it('renders cents as dollars', () => {
    expect(formatCents(1125)).toBe('$11.25');
    expect(formatCents(0)).toBe('$0.00');
  });
});
