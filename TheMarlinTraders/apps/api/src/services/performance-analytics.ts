/**
 * Performance Analytics Service
 *
 * Pure-function analytics engine that operates on journal entries.
 * All inputs are the raw DB rows from the journalEntries table;
 * numeric fields arrive as strings and are parsed here.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface JournalEntry {
  id: string
  userId: string
  symbol: string
  side: 'buy' | 'sell'
  entryPrice: string
  exitPrice: string | null
  quantity: string
  pnl: string | null
  rMultiple: string | null
  setupType: string
  emotionalState: string
  marketCondition: string
  grade: string | null
  notes: string | null
  tags: string[]
  entryDate: Date
  exitDate: Date | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PerformanceMetrics {
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  expectancy: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  maxDrawdownDuration: number // days
  totalPnl: number
  totalTrades: number
  avgHoldingTime: number // hours
}

export interface HourlyBreakdown {
  hour: number
  winRate: number
  avgPnl: number
  count: number
  totalPnl: number
}

export interface SetupBreakdown {
  setupType: string
  winRate: number
  avgPnl: number
  count: number
  totalPnl: number
}

export interface RollingSharpePoint {
  date: string
  sharpe: number
}

export interface HoldingTimePoint {
  holdingTimeHours: number
  pnl: number
  symbol: string
  date: string
}

export interface EquityCurvePoint {
  date: string
  cumulativePnl: number
  drawdown: number
}

// ─── Helpers ───────────────────────────────────────────────────

function closedEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter((e) => e.pnl !== null && !e.isDeleted)
}

function pnl(e: JournalEntry): number {
  return parseFloat(e.pnl!)
}

function holdingHours(e: JournalEntry): number {
  if (!e.exitDate) return 0
  return (e.exitDate.getTime() - e.entryDate.getTime()) / (1000 * 60 * 60)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function downsideDev(values: number[], target: number): number {
  if (values.length < 2) return 0
  const negDiffs = values.filter((v) => v < target).map((v) => (v - target) ** 2)
  if (negDiffs.length === 0) return 0
  return Math.sqrt(negDiffs.reduce((a, b) => a + b, 0) / values.length)
}

// ─── Core Metrics ──────────────────────────────────────────────

export function calculateMetrics(entries: JournalEntry[]): PerformanceMetrics {
  const closed = closedEntries(entries)
  const totalTrades = closed.length

  if (totalTrades === 0) {
    return {
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      totalPnl: 0,
      totalTrades: 0,
      avgHoldingTime: 0,
    }
  }

  const pnls = closed.map(pnl)
  const winners = pnls.filter((p) => p > 0)
  const losers = pnls.filter((p) => p < 0)

  const winRate = (winners.length / totalTrades) * 100
  const avgWin = mean(winners)
  const avgLoss = mean(losers)
  const totalPnl = pnls.reduce((a, b) => a + b, 0)
  const grossWins = winners.reduce((a, b) => a + b, 0)
  const grossLosses = Math.abs(losers.reduce((a, b) => a + b, 0))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0
  const expectancy = mean(pnls)

  // Sharpe ratio (annualized, assuming ~252 trading days)
  const avgPnl = mean(pnls)
  const pnlStdDev = stdDev(pnls, avgPnl)
  const sharpeRatio = pnlStdDev > 0 ? (avgPnl / pnlStdDev) * Math.sqrt(252) : 0

  // Sortino ratio (annualized)
  const downside = downsideDev(pnls, 0)
  const sortinoRatio = downside > 0 ? (avgPnl / downside) * Math.sqrt(252) : 0

  // Max drawdown and duration
  const sorted = [...closed].sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime(),
  )
  let peak = 0
  let cumulative = 0
  let maxDD = 0
  let maxDDDuration = 0
  let ddStartDate: Date | null = null

  for (const entry of sorted) {
    cumulative += pnl(entry)
    if (cumulative > peak) {
      peak = cumulative
      ddStartDate = null
    }
    const dd = peak - cumulative
    if (dd > maxDD) {
      maxDD = dd
    }
    if (dd > 0) {
      if (!ddStartDate) ddStartDate = entry.entryDate
      const duration =
        (entry.entryDate.getTime() - ddStartDate.getTime()) / (1000 * 60 * 60 * 24)
      if (duration > maxDDDuration) {
        maxDDDuration = duration
      }
    }
  }

  // Average holding time
  const holdingTimes = closed.filter((e) => e.exitDate).map(holdingHours)
  const avgHoldingTime = mean(holdingTimes)

  return {
    winRate: round2(winRate),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    profitFactor: round2(profitFactor === Infinity ? 999.99 : profitFactor),
    expectancy: round2(expectancy),
    sharpeRatio: round2(sharpeRatio),
    sortinoRatio: round2(sortinoRatio),
    maxDrawdown: round2(maxDD),
    maxDrawdownDuration: round2(maxDDDuration),
    totalPnl: round2(totalPnl),
    totalTrades,
    avgHoldingTime: round2(avgHoldingTime),
  }
}

// ─── Time of Day Analysis ──────────────────────────────────────

export function timeOfDayAnalysis(entries: JournalEntry[]): HourlyBreakdown[] {
  const closed = closedEntries(entries)
  const buckets = new Map<number, { pnls: number[] }>()

  for (let h = 0; h < 24; h++) {
    buckets.set(h, { pnls: [] })
  }

  for (const entry of closed) {
    const hour = entry.entryDate.getHours()
    buckets.get(hour)!.pnls.push(pnl(entry))
  }

  const result: HourlyBreakdown[] = []
  for (let hour = 0; hour < 24; hour++) {
    const { pnls } = buckets.get(hour)!
    if (pnls.length === 0) {
      result.push({ hour, winRate: 0, avgPnl: 0, count: 0, totalPnl: 0 })
      continue
    }
    const winners = pnls.filter((p) => p > 0).length
    result.push({
      hour,
      winRate: round2((winners / pnls.length) * 100),
      avgPnl: round2(mean(pnls)),
      count: pnls.length,
      totalPnl: round2(pnls.reduce((a, b) => a + b, 0)),
    })
  }

  return result
}

// ─── Setup Type Breakdown ──────────────────────────────────────

export function setupTypeBreakdown(entries: JournalEntry[]): SetupBreakdown[] {
  const closed = closedEntries(entries)
  const buckets = new Map<string, number[]>()

  for (const entry of closed) {
    const key = entry.setupType
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(pnl(entry))
  }

  const result: SetupBreakdown[] = []
  for (const [setupType, pnls] of buckets) {
    const winners = pnls.filter((p) => p > 0).length
    result.push({
      setupType,
      winRate: round2((winners / pnls.length) * 100),
      avgPnl: round2(mean(pnls)),
      count: pnls.length,
      totalPnl: round2(pnls.reduce((a, b) => a + b, 0)),
    })
  }

  return result.sort((a, b) => b.count - a.count)
}

// ─── Rolling Sharpe ────────────────────────────────────────────

export function rollingSharpe(
  entries: JournalEntry[],
  windowDays: number = 30,
): RollingSharpePoint[] {
  const closed = closedEntries(entries).sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime(),
  )

  if (closed.length < 2) return []

  const result: RollingSharpePoint[] = []
  const windowMs = windowDays * 24 * 60 * 60 * 1000

  for (let i = 0; i < closed.length; i++) {
    const endDate = closed[i].entryDate
    const startDate = new Date(endDate.getTime() - windowMs)

    const windowEntries = closed.filter(
      (e) => e.entryDate >= startDate && e.entryDate <= endDate,
    )

    if (windowEntries.length < 2) continue

    const pnls = windowEntries.map(pnl)
    const avg = mean(pnls)
    const sd = stdDev(pnls, avg)
    const sharpe = sd > 0 ? (avg / sd) * Math.sqrt(252) : 0

    result.push({
      date: endDate.toISOString().slice(0, 10),
      sharpe: round2(sharpe),
    })
  }

  // Deduplicate by date (keep last entry per day)
  const byDate = new Map<string, RollingSharpePoint>()
  for (const point of result) {
    byDate.set(point.date, point)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Holding Time Analysis ─────────────────────────────────────

export function holdingTimeAnalysis(entries: JournalEntry[]): HoldingTimePoint[] {
  const closed = closedEntries(entries).filter((e) => e.exitDate)

  return closed.map((entry) => ({
    holdingTimeHours: round2(holdingHours(entry)),
    pnl: round2(pnl(entry)),
    symbol: entry.symbol,
    date: entry.entryDate.toISOString().slice(0, 10),
  }))
}

// ─── Equity Curve with Drawdown ────────────────────────────────

export function equityCurve(entries: JournalEntry[]): EquityCurvePoint[] {
  const closed = closedEntries(entries).sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime(),
  )

  let cumulative = 0
  let peak = 0
  const result: EquityCurvePoint[] = []

  for (const entry of closed) {
    cumulative += pnl(entry)
    if (cumulative > peak) peak = cumulative
    const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0

    result.push({
      date: entry.entryDate.toISOString().slice(0, 10),
      cumulativePnl: round2(cumulative),
      drawdown: round2(drawdown),
    })
  }

  return result
}
