export interface Position {
  symbol: string
  quantity: number
  averageCost: number
  currentPrice: number
}

export interface PortfolioSummary {
  totalValue: number
  cashBalance: number
  positionsValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  dailyPnL: number
  dailyPnLPercent: number
  buyingPower: number
}

export interface PositionPnL {
  symbol: string
  quantity: number
  averageCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
}

/**
 * Tracks paper trading positions and calculates P&L.
 */
export class PositionTracker {
  /**
   * Calculate unrealized P&L for a single position.
   * unrealizedPnL = (currentPrice - averageCost) * quantity
   */
  calculatePositionPnL(position: Position): PositionPnL {
    const marketValue = position.currentPrice * position.quantity
    const costBasis = position.averageCost * position.quantity
    const unrealizedPnL = marketValue - costBasis
    const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0

    return {
      symbol: position.symbol,
      quantity: position.quantity,
      averageCost: position.averageCost,
      currentPrice: position.currentPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
    }
  }

  /**
   * Calculate new average cost after adding to a position.
   * newAvgCost = (oldQty * oldAvg + fillQty * fillPrice) / (oldQty + fillQty)
   */
  calculateNewAverageCost(
    existingQuantity: number,
    existingAvgCost: number,
    fillQuantity: number,
    fillPrice: number,
  ): number {
    const totalCost = existingQuantity * existingAvgCost + fillQuantity * fillPrice
    const totalQuantity = existingQuantity + fillQuantity
    return totalQuantity > 0 ? totalCost / totalQuantity : 0
  }

  /**
   * Calculate realized P&L when closing (selling) a position.
   * realizedPnL = (sellPrice - averageCost) * sellQuantity
   */
  calculateRealizedPnL(averageCost: number, sellPrice: number, sellQuantity: number): number {
    return (sellPrice - averageCost) * sellQuantity
  }

  /**
   * Build a full portfolio summary from positions and cash balance.
   */
  calculatePortfolioSummary(
    positions: Position[],
    cashBalance: number,
    previousTotalValue?: number,
  ): PortfolioSummary {
    let positionsValue = 0
    let totalCostBasis = 0

    for (const pos of positions) {
      positionsValue += pos.currentPrice * pos.quantity
      totalCostBasis += pos.averageCost * pos.quantity
    }

    const totalValue = cashBalance + positionsValue
    const unrealizedPnL = positionsValue - totalCostBasis
    const unrealizedPnLPercent = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0

    const prevTotal = previousTotalValue ?? totalValue
    const dailyPnL = totalValue - prevTotal
    const dailyPnLPercent = prevTotal > 0 ? (dailyPnL / prevTotal) * 100 : 0

    return {
      totalValue,
      cashBalance,
      positionsValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      dailyPnL,
      dailyPnLPercent,
      buyingPower: cashBalance,
    }
  }
}
