/**
 * Performance Metrics Calculator
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * Computes comprehensive backtest metrics from an equity curve and trade list.
 * All ratio calculations follow standard quantitative finance conventions.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface EquityPoint {
  /** Timestamp (ms since epoch) */
  timestamp: number
  /** Portfolio equity value at this point */
  equity: number
}

export interface CompletedTrade {
  /** Entry timestamp */
  entryTime: number
  /** Exit timestamp */
  exitTime: number
  /** Symbol traded */
  symbol: string
  /** Trade direction */
  side: 'long' | 'short'
  /** Number of shares/contracts */
  quantity: number
  /** Average entry price */
  entryPrice: number
  /** Average exit price */
  exitPrice: number
  /** Realized P&L (after commissions) */
  pnl: number
  /** Commission paid on this trade */
  commission: number
}

export interface BacktestMetrics {
  // ── Return Metrics ────────────────────────────────────────────────────
  /** Total return as a percentage */
  totalReturnPct: number
  /** Total return in dollars */
  totalReturnDollar: number
  /** Annualized return percentage (CAGR) */
  annualizedReturnPct: number

  // ── Risk-Adjusted Metrics ─────────────────────────────────────────────
  /** Annualized Sharpe ratio (risk-free rate = 0) */
  sharpeRatio: number
  /** Annualized Sortino ratio (risk-free rate = 0) */
  sortinoRatio: number
  /** Calmar ratio (annualized return / max drawdown %) */
  calmarRatio: number
  /** Recovery factor (net profit / max drawdown $) */
  recoveryFactor: number

  // ── Drawdown Metrics ──────────────────────────────────────────────────
  /** Maximum drawdown as a percentage of peak equity */
  maxDrawdownPct: number
  /** Maximum drawdown in dollars */
  maxDrawdownDollar: number

  // ── Trade Statistics ──────────────────────────────────────────────────
  /** Total number of completed trades */
  totalTrades: number
  /** Winning trade percentage */
  winRate: number
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number
  /** Expected value per trade in dollars */
  expectancy: number
  /** Average winning trade P&L */
  avgWin: number
  /** Average losing trade P&L */
  avgLoss: number
  /** Largest single winning trade */
  largestWin: number
  /** Largest single losing trade */
  largestLoss: number
  /** Maximum consecutive winning trades */
  maxConsecutiveWins: number
  /** Maximum consecutive losing trades */
  maxConsecutiveLosses: number

  // ── Commission ────────────────────────────────────────────────────────
  /** Total commissions paid */
  totalCommissions: number
}

// ── Main Calculator ───────────────────────────────────────────────────────

/**
 * Calculate comprehensive performance metrics from an equity curve and trade list.
 *
 * @param equity  Array of equity points (must be chronologically sorted)
 * @param trades  Array of completed trades
 * @returns       Full BacktestMetrics object
 */
export function calculateMetrics(
  equity: EquityPoint[],
  trades: CompletedTrade[],
): BacktestMetrics {
  // Handle edge case: no trades or no equity data
  if (equity.length < 2 || trades.length === 0) {
    return emptyMetrics()
  }

  const initialEquity = equity[0]!.equity
  const finalEquity = equity[equity.length - 1]!.equity

  // ── Return Metrics ──────────────────────────────────────────────────────

  const totalReturnDollar = finalEquity - initialEquity
  const totalReturnPct =
    initialEquity !== 0 ? (totalReturnDollar / initialEquity) * 100 : 0

  // Annualized return (CAGR)
  const durationMs = equity[equity.length - 1]!.timestamp - equity[0]!.timestamp
  const durationYears = durationMs / (365.25 * 24 * 60 * 60 * 1000)
  const annualizedReturnPct =
    durationYears > 0 && initialEquity > 0
      ? (Math.pow(finalEquity / initialEquity, 1 / durationYears) - 1) * 100
      : 0

  // ── Drawdown ────────────────────────────────────────────────────────────

  const { maxDrawdownPct, maxDrawdownDollar } = calculateDrawdown(equity)

  // ── Daily Returns for Sharpe/Sortino ────────────────────────────────────

  const returns = calculateReturns(equity)

  const sharpeRatio = calculateSharpeRatio(returns)
  const sortinoRatio = calculateSortinoRatio(returns)

  // ── Calmar & Recovery ───────────────────────────────────────────────────

  const calmarRatio =
    maxDrawdownPct !== 0 ? annualizedReturnPct / Math.abs(maxDrawdownPct) : 0

  const recoveryFactor =
    maxDrawdownDollar !== 0
      ? Math.abs(totalReturnDollar) / Math.abs(maxDrawdownDollar)
      : 0

  // ── Trade Statistics ────────────────────────────────────────────────────

  const winners = trades.filter((t) => t.pnl > 0)
  const losers = trades.filter((t) => t.pnl < 0)

  const totalTrades = trades.length
  const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0

  const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0))

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0
  const avgLoss = losers.length > 0 ? -grossLoss / losers.length : 0

  const expectancy = totalTrades > 0 ? totalReturnDollar / totalTrades : 0

  const largestWin = winners.length > 0 ? Math.max(...winners.map((t) => t.pnl)) : 0
  const largestLoss = losers.length > 0 ? Math.min(...losers.map((t) => t.pnl)) : 0

  const { maxConsecutiveWins, maxConsecutiveLosses } = calculateConsecutive(trades)

  const totalCommissions = trades.reduce((sum, t) => sum + t.commission, 0)

  return {
    totalReturnPct,
    totalReturnDollar,
    annualizedReturnPct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    recoveryFactor,
    maxDrawdownPct,
    maxDrawdownDollar,
    totalTrades,
    winRate,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    totalCommissions,
  }
}

// ── Drawdown Calculator ───────────────────────────────────────────────────

interface DrawdownResult {
  maxDrawdownPct: number
  maxDrawdownDollar: number
}

function calculateDrawdown(equity: EquityPoint[]): DrawdownResult {
  let peak = equity[0]!.equity
  let maxDdPct = 0
  let maxDdDollar = 0

  for (const point of equity) {
    if (point.equity > peak) {
      peak = point.equity
    }

    const ddDollar = peak - point.equity
    const ddPct = peak > 0 ? (ddDollar / peak) * 100 : 0

    if (ddPct > maxDdPct) {
      maxDdPct = ddPct
    }
    if (ddDollar > maxDdDollar) {
      maxDdDollar = ddDollar
    }
  }

  return { maxDrawdownPct: maxDdPct, maxDrawdownDollar: maxDdDollar }
}

// ── Return Series ─────────────────────────────────────────────────────────

/**
 * Calculate period-over-period returns from the equity curve.
 * Returns are expressed as decimals (e.g. 0.01 = 1%).
 */
function calculateReturns(equity: EquityPoint[]): number[] {
  const returns: number[] = []

  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]!.equity
    const curr = equity[i]!.equity

    if (prev !== 0) {
      returns.push((curr - prev) / prev)
    } else {
      returns.push(0)
    }
  }

  return returns
}

// ── Sharpe Ratio ──────────────────────────────────────────────────────────

/**
 * Annualized Sharpe ratio.
 *
 * Sharpe = (mean(returns) / std(returns)) * sqrt(252)
 *
 * Uses 252 trading days per year for annualization.
 * Risk-free rate is assumed to be 0 (standard for backtesting).
 */
export function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length

  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  const std = Math.sqrt(variance)

  if (std === 0) return 0

  return (mean / std) * Math.sqrt(252)
}

// ── Sortino Ratio ─────────────────────────────────────────────────────────

/**
 * Annualized Sortino ratio.
 *
 * Sortino = (mean(returns) / downside_deviation) * sqrt(252)
 *
 * Only negative returns contribute to the downside deviation.
 */
export function calculateSortinoRatio(returns: number[]): number {
  if (returns.length < 2) return 0

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length

  const downsideSquared = returns
    .filter((r) => r < 0)
    .map((r) => r ** 2)

  if (downsideSquared.length === 0) {
    // No downside: return large positive if mean > 0, else 0
    return mean > 0 ? Infinity : 0
  }

  const downsideVariance =
    downsideSquared.reduce((sum, s) => sum + s, 0) / returns.length
  const downsideDeviation = Math.sqrt(downsideVariance)

  if (downsideDeviation === 0) return 0

  return (mean / downsideDeviation) * Math.sqrt(252)
}

// ── Consecutive Wins/Losses ───────────────────────────────────────────────

interface ConsecutiveResult {
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
}

function calculateConsecutive(trades: CompletedTrade[]): ConsecutiveResult {
  let maxWins = 0
  let maxLosses = 0
  let currentWins = 0
  let currentLosses = 0

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWins++
      currentLosses = 0
      maxWins = Math.max(maxWins, currentWins)
    } else if (trade.pnl < 0) {
      currentLosses++
      currentWins = 0
      maxLosses = Math.max(maxLosses, currentLosses)
    } else {
      // Breakeven trade resets both streaks
      currentWins = 0
      currentLosses = 0
    }
  }

  return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses }
}

// ── Empty Metrics ─────────────────────────────────────────────────────────

function emptyMetrics(): BacktestMetrics {
  return {
    totalReturnPct: 0,
    totalReturnDollar: 0,
    annualizedReturnPct: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    recoveryFactor: 0,
    maxDrawdownPct: 0,
    maxDrawdownDollar: 0,
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    expectancy: 0,
    avgWin: 0,
    avgLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    totalCommissions: 0,
  }
}
