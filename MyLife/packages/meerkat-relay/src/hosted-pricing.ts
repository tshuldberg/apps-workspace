/**
 * Transparent Hosted-Node pricing ledger (plan 14, MK-042; design D13).
 *
 * D13's promise is cost-plus pricing with a PUBLISHED ledger: every tier shows
 * the raw infra cost and the Meerkat take side by side, take = cost x markup
 * (default 25%). This module is the pure pricing engine + the breakdown the
 * public page renders. It is honest about its inputs: the default unit costs and
 * tiers here are ILLUSTRATIVE placeholders -- `illustrative: true` rides on every
 * computed line -- to be replaced with real provider-invoice numbers (founder
 * op) before anything is published. The MARKUP POLICY (cost + 25%) is real and
 * enforced/tested; the dollar figures are not, until actuals land.
 */

/** Provider unit costs (cents). Illustrative until real invoices replace them. */
export interface InfraUnitCosts {
  /** Cost per GB of storage per month. */
  storageGbMonthCents: number;
  /** Cost per GB of egress. */
  egressGbCents: number;
  /** Fixed per-node compute/overhead per month (the box, monitoring, etc.). */
  nodeMonthCents: number;
  /** Source label, e.g. "illustrative-2026-06" or "aws-invoice-2026-07". */
  source: string;
}

/** A hosting tier's resource envelope. */
export interface PricingTier {
  id: string;
  name: string;
  storageGb: number;
  /** Egress included per month before overage (overage pricing is future work). */
  egressGbIncluded: number;
  nodes: number;
}

export interface TierPrice {
  tierId: string;
  name: string;
  /** Raw provider cost for the tier's envelope, in cents. */
  rawCostCents: number;
  /** Meerkat take = rawCost x markupRatio, in cents. */
  takeCents: number;
  /** What the member pays = rawCost + take, in cents. */
  totalCents: number;
  /** The markup ratio applied (e.g. 0.25). */
  markupRatio: number;
  /** Per-line cost breakdown for the transparency page. */
  breakdown: { label: string; cents: number }[];
  /** True while the numbers are placeholders, not real invoices. */
  illustrative: boolean;
}

export const DEFAULT_MARKUP_RATIO = 0.25;

/**
 * Illustrative unit costs. Placeholder magnitudes only -- the markup policy is
 * what matters until a real invoice replaces `source`.
 */
export const ILLUSTRATIVE_UNIT_COSTS: InfraUnitCosts = {
  storageGbMonthCents: 2, // ~ $0.02 / GB-month
  egressGbCents: 1, // ~ $0.01 / GB
  nodeMonthCents: 500, // ~ $5 / node-month overhead
  source: 'illustrative-2026-06',
};

/** Illustrative tiers. Replace with the real product ladder before publishing. */
export const ILLUSTRATIVE_TIERS: readonly PricingTier[] = [
  { id: 'starter', name: 'Starter', storageGb: 50, egressGbIncluded: 100, nodes: 1 },
  { id: 'community', name: 'Community', storageGb: 500, egressGbIncluded: 1000, nodes: 1 },
  { id: 'fleet', name: 'Fleet', storageGb: 2000, egressGbIncluded: 5000, nodes: 3 },
];

function round(cents: number): number {
  return Math.round(cents);
}

/**
 * Price one tier: raw provider cost, the cost-plus take, and the total. The
 * `illustrative` flag is true unless the unit costs carry a non-illustrative
 * source (i.e. real invoice numbers were supplied).
 */
export function computeTierPrice(
  tier: PricingTier,
  costs: InfraUnitCosts = ILLUSTRATIVE_UNIT_COSTS,
  markupRatio: number = DEFAULT_MARKUP_RATIO,
): TierPrice {
  if (markupRatio < 0) throw new Error('markupRatio must be >= 0');
  const storage = round(tier.storageGb * costs.storageGbMonthCents);
  const egress = round(tier.egressGbIncluded * costs.egressGbCents);
  const compute = round(tier.nodes * costs.nodeMonthCents);
  const rawCostCents = storage + egress + compute;
  const takeCents = round(rawCostCents * markupRatio);
  return {
    tierId: tier.id,
    name: tier.name,
    rawCostCents,
    takeCents,
    totalCents: rawCostCents + takeCents,
    markupRatio,
    breakdown: [
      { label: `Storage (${tier.storageGb} GB)`, cents: storage },
      { label: `Egress (${tier.egressGbIncluded} GB included)`, cents: egress },
      { label: `Compute (${tier.nodes} node${tier.nodes === 1 ? '' : 's'})`, cents: compute },
      { label: `Infra cost`, cents: rawCostCents },
      { label: `Meerkat take (+${Math.round(markupRatio * 100)}%)`, cents: takeCents },
    ],
    illustrative: costs.source.startsWith('illustrative'),
  };
}

export interface PricingLedger {
  markupRatio: number;
  costSource: string;
  /** True if ANY tier is still illustrative -- the page must say so. */
  illustrative: boolean;
  tiers: TierPrice[];
  notice: string;
}

/** The full transparent ledger the public page renders. */
export function pricingLedger(
  tiers: readonly PricingTier[] = ILLUSTRATIVE_TIERS,
  costs: InfraUnitCosts = ILLUSTRATIVE_UNIT_COSTS,
  markupRatio: number = DEFAULT_MARKUP_RATIO,
): PricingLedger {
  const priced = tiers.map((t) => computeTierPrice(t, costs, markupRatio));
  const illustrative = priced.some((t) => t.illustrative);
  return {
    markupRatio,
    costSource: costs.source,
    illustrative,
    tiers: priced,
    notice: illustrative
      ? 'Illustrative pricing: figures are placeholders pending real provider invoices. The cost-plus policy (infra cost plus the listed markup) is final; the dollar amounts are not.'
      : `Cost-plus pricing from ${costs.source}: each tier is provider cost plus a ${Math.round(markupRatio * 100)}% Meerkat take.`,
  };
}

/** Format cents as a dollar string for the page (e.g. 1234 -> "$12.34"). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
