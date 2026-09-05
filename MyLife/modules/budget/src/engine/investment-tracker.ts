/**
 * Investment portfolio tracking engine.
 *
 * Calculates portfolio value, gain/loss, asset allocation,
 * and performance over time. All monetary values integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoldingInput {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  shares: number;
  costBasis: number;      // cents
  currentPrice: number;   // cents per share
  isActive: boolean;
}

export interface PortfolioSummary {
  totalValue: number;        // cents
  totalCostBasis: number;    // cents
  totalGainLoss: number;     // cents
  totalReturnPct: number;    // percentage (e.g., 10.5 for 10.5%)
  holdingCount: number;
}

export interface HoldingGainLoss {
  holdingId: string;
  currentValue: number;      // cents
  costBasis: number;         // cents
  gainLoss: number;          // cents
  returnPct: number;         // percentage
}

export interface AllocationEntry {
  assetClass: string;
  value: number;             // cents
  percentage: number;        // 0-100
}

export interface PerformancePoint {
  date: string;              // YYYY-MM-DD
  totalValue: number;        // cents
}

// ---------------------------------------------------------------------------
// Portfolio calculations
// ---------------------------------------------------------------------------

/**
 * Calculate the current value of a holding.
 */
export function calculateHoldingValue(shares: number, pricePerShare: number): number {
  return Math.round(shares * pricePerShare);
}

/**
 * Calculate gain/loss for a single holding.
 */
export function calculateHoldingGainLoss(holding: HoldingInput): HoldingGainLoss {
  const currentValue = calculateHoldingValue(holding.shares, holding.currentPrice);
  const gainLoss = currentValue - holding.costBasis;
  const returnPct = holding.costBasis > 0
    ? Math.round((gainLoss / holding.costBasis) * 1000) / 10
    : 0;

  return {
    holdingId: holding.id,
    currentValue,
    costBasis: holding.costBasis,
    gainLoss,
    returnPct,
  };
}

/**
 * Calculate portfolio summary across all active holdings.
 */
export function calculatePortfolioSummary(holdings: HoldingInput[]): PortfolioSummary {
  const active = holdings.filter(h => h.isActive);
  if (active.length === 0) {
    return { totalValue: 0, totalCostBasis: 0, totalGainLoss: 0, totalReturnPct: 0, holdingCount: 0 };
  }

  let totalValue = 0;
  let totalCostBasis = 0;

  for (const h of active) {
    totalValue += calculateHoldingValue(h.shares, h.currentPrice);
    totalCostBasis += h.costBasis;
  }

  const totalGainLoss = totalValue - totalCostBasis;
  const totalReturnPct = totalCostBasis > 0
    ? Math.round((totalGainLoss / totalCostBasis) * 1000) / 10
    : 0;

  return {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalReturnPct,
    holdingCount: active.length,
  };
}

/**
 * Calculate asset allocation percentages.
 */
export function calculateAllocation(holdings: HoldingInput[]): AllocationEntry[] {
  const active = holdings.filter(h => h.isActive);
  if (active.length === 0) return [];

  const classValues = new Map<string, number>();
  let total = 0;

  for (const h of active) {
    const value = calculateHoldingValue(h.shares, h.currentPrice);
    classValues.set(h.assetClass, (classValues.get(h.assetClass) ?? 0) + value);
    total += value;
  }

  if (total === 0) return [];

  const entries: AllocationEntry[] = [];
  for (const [assetClass, value] of classValues) {
    entries.push({
      assetClass,
      value,
      percentage: Math.round((value / total) * 1000) / 10,
    });
  }

  return entries.sort((a, b) => b.value - a.value);
}

/**
 * Build performance timeline from snapshots.
 */
export function buildPerformanceTimeline(
  snapshots: Array<{ date: string; totalValue: number }>,
): PerformancePoint[] {
  // Group by date, sum values
  const dateMap = new Map<string, number>();
  for (const s of snapshots) {
    dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.totalValue);
  }

  return Array.from(dateMap.entries())
    .map(([date, totalValue]) => ({ date, totalValue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
