import { z } from 'zod'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { journalEntries } from '../db/schema/journal.js'
import { parseNLPQuery, getNLPExamples } from '../services/nlp-query.js'
import { CHART_PATTERNS } from '@marlin/shared'
import type {
  PatternDetection,
  ChartPattern,
  JournalAnalysis,
  JournalInsight,
} from '@marlin/shared'

const DetectPatternsSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M']).default('1D'),
  lookbackBars: z.number().int().min(20).max(500).default(100),
})

const NLPQuerySchema = z.object({
  text: z.string().min(1).max(500).trim(),
})

const AnalyzeJournalSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

const PatternScanSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).max(50).optional(),
  minConfidence: z.number().min(0).max(1).default(0.5),
  patternTypes: z.array(z.enum(CHART_PATTERNS as unknown as readonly [string, ...string[]])).optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const aiAnalysisRouter = router({
  /**
   * Detect chart patterns on a given symbol/timeframe.
   * Currently returns mock/placeholder data — real detection
   * requires market data bars from the data pipeline.
   */
  detectPatterns: protectedProcedure
    .input(DetectPatternsSchema)
    .query(async ({ ctx, input }) => {
      // In production, fetch bars from the market data service and run detection.
      // For now, return a placeholder response to wire up the frontend.
      const mockDetections: PatternDetection[] = [
        {
          pattern: 'double_bottom',
          confidence: 0.82,
          startBar: 45,
          endBar: 78,
          keyPoints: [
            { time: Date.now() - 86400000 * 33, price: 148.5 },
            { time: Date.now() - 86400000 * 20, price: 155.2 },
            { time: Date.now() - 86400000 * 8, price: 149.1 },
          ],
          priceTarget: 162.0,
          stopLoss: 146.0,
          direction: 'bullish',
        },
        {
          pattern: 'ascending_triangle',
          confidence: 0.67,
          startBar: 60,
          endBar: 95,
          keyPoints: [
            { time: Date.now() - 86400000 * 28, price: 150.0 },
            { time: Date.now() - 86400000 * 22, price: 158.0 },
            { time: Date.now() - 86400000 * 15, price: 152.5 },
            { time: Date.now() - 86400000 * 10, price: 158.2 },
            { time: Date.now() - 86400000 * 5, price: 155.0 },
          ],
          priceTarget: 166.0,
          stopLoss: 150.0,
          direction: 'bullish',
        },
      ]

      return {
        symbol: input.symbol,
        timeframe: input.timeframe,
        detections: mockDetections,
        scannedBars: input.lookbackBars,
        timestamp: new Date().toISOString(),
      }
    }),

  /**
   * Parse a natural language trading query into structured filters.
   */
  nlpQuery: protectedProcedure
    .input(NLPQuerySchema)
    .query(({ input }) => {
      const parsed = parseNLPQuery(input.text)

      return {
        ...parsed,
        examples: getNLPExamples(),
      }
    }),

  /**
   * Analyze a user's journal entries for behavioral patterns and insights.
   */
  analyzeJournal: protectedProcedure
    .input(AnalyzeJournalSchema.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(journalEntries.userId, ctx.userId),
        eq(journalEntries.isDeleted, false),
      ]

      if (input?.startDate) {
        conditions.push(gte(journalEntries.entryDate, new Date(input.startDate)))
      }
      if (input?.endDate) {
        conditions.push(lte(journalEntries.entryDate, new Date(input.endDate)))
      }

      const entries = await db
        .select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.entryDate))

      return buildJournalAnalysis(entries)
    }),

  /**
   * Scan universe for active patterns across a list of symbols.
   * Public procedure — available to free-tier users.
   */
  getPatternScan: publicProcedure
    .input(PatternScanSchema.optional())
    .query(async ({ input }) => {
      // In production, iterate symbols from watchlist or market universe,
      // fetch bars, and run detectPatterns() on each.
      // For now, return placeholder data to wire up the frontend.
      const mockResults: Array<{
        symbol: string
        detections: PatternDetection[]
      }> = [
        {
          symbol: 'AAPL',
          detections: [
            {
              pattern: 'bull_flag',
              confidence: 0.78,
              startBar: 80,
              endBar: 98,
              keyPoints: [
                { time: Date.now() - 86400000 * 15, price: 172.0 },
                { time: Date.now() - 86400000 * 10, price: 185.0 },
                { time: Date.now() - 86400000 * 3, price: 182.5 },
              ],
              priceTarget: 198.0,
              stopLoss: 180.0,
              direction: 'bullish',
            },
          ],
        },
        {
          symbol: 'TSLA',
          detections: [
            {
              pattern: 'head_and_shoulders',
              confidence: 0.71,
              startBar: 55,
              endBar: 92,
              keyPoints: [
                { time: Date.now() - 86400000 * 30, price: 240.0 },
                { time: Date.now() - 86400000 * 25, price: 230.0 },
                { time: Date.now() - 86400000 * 18, price: 255.0 },
                { time: Date.now() - 86400000 * 12, price: 228.0 },
                { time: Date.now() - 86400000 * 5, price: 242.0 },
              ],
              priceTarget: 215.0,
              stopLoss: 258.0,
              direction: 'bearish',
            },
          ],
        },
        {
          symbol: 'NVDA',
          detections: [
            {
              pattern: 'cup_and_handle',
              confidence: 0.85,
              startBar: 40,
              endBar: 95,
              keyPoints: [
                { time: Date.now() - 86400000 * 45, price: 880.0 },
                { time: Date.now() - 86400000 * 25, price: 810.0 },
                { time: Date.now() - 86400000 * 8, price: 878.0 },
                { time: Date.now() - 86400000 * 3, price: 865.0 },
              ],
              priceTarget: 950.0,
              stopLoss: 860.0,
              direction: 'bullish',
            },
          ],
        },
      ]

      // Apply filters
      let filtered = mockResults
      if (input?.symbols && input.symbols.length > 0) {
        const upperSymbols = input.symbols.map((s) => s.toUpperCase())
        filtered = filtered.filter((r) => upperSymbols.includes(r.symbol))
      }

      if (input?.patternTypes && input.patternTypes.length > 0) {
        const types = new Set(input.patternTypes)
        filtered = filtered.map((r) => ({
          ...r,
          detections: r.detections.filter((d) => types.has(d.pattern)),
        })).filter((r) => r.detections.length > 0)
      }

      const minConf = input?.minConfidence ?? 0.5
      filtered = filtered.map((r) => ({
        ...r,
        detections: r.detections.filter((d) => d.confidence >= minConf),
      })).filter((r) => r.detections.length > 0)

      const limit = input?.limit ?? 20

      // Flatten, sort by confidence, and limit
      const allDetections = filtered
        .flatMap((r) =>
          r.detections.map((d) => ({ symbol: r.symbol, ...d })),
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit)

      return {
        results: allDetections,
        scannedSymbols: mockResults.length,
        timestamp: new Date().toISOString(),
      }
    }),
})

// ── Journal Analysis Helpers ───────────────────────────────────────────────

interface JournalEntry {
  pnl: string | null
  rMultiple: string | null
  setupType: string
  emotionalState: string
  marketCondition: string
  entryDate: Date
  exitDate: Date | null
  grade: string | null
}

function buildJournalAnalysis(entries: JournalEntry[]): JournalAnalysis {
  const insights: JournalInsight[] = []
  const tradesWithPnl = entries.filter((e) => e.pnl !== null)

  if (tradesWithPnl.length === 0) {
    return {
      insights: [{
        category: 'behavioral',
        title: 'Not enough data',
        description: 'Log more trades with P&L to unlock AI insights.',
        severity: 'info',
        dataPoints: 0,
      }],
      bestSetups: [],
      worstSetups: [],
      bestTradingDays: [],
      worstTradingDays: [],
      emotionalCorrelations: [],
      suggestions: ['Start logging your trades with entry/exit prices and emotional state.'],
    }
  }

  // ─── Setup Type Analysis ────────────────────────
  const setupMap = new Map<string, { wins: number; losses: number; totalPnl: number; count: number }>()
  for (const e of tradesWithPnl) {
    const pnl = parseFloat(e.pnl!)
    const existing = setupMap.get(e.setupType) ?? { wins: 0, losses: 0, totalPnl: 0, count: 0 }
    existing.count++
    existing.totalPnl += pnl
    if (pnl > 0) existing.wins++
    else existing.losses++
    setupMap.set(e.setupType, existing)
  }

  const setupStats = Array.from(setupMap.entries()).map(([setupType, stats]) => ({
    setupType,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgPnl: stats.count > 0 ? stats.totalPnl / stats.count : 0,
    count: stats.count,
  }))

  const bestSetups = setupStats.filter((s) => s.count >= 2).sort((a, b) => b.winRate - a.winRate).slice(0, 3)
  const worstSetups = setupStats.filter((s) => s.count >= 2).sort((a, b) => a.winRate - b.winRate).slice(0, 3)

  // ─── Day of Week Analysis ───────────────────────
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayMap = new Map<string, { wins: number; losses: number; totalPnl: number; count: number }>()
  for (const e of tradesWithPnl) {
    const dayName = dayNames[e.entryDate.getDay()]!
    const pnl = parseFloat(e.pnl!)
    const existing = dayMap.get(dayName) ?? { wins: 0, losses: 0, totalPnl: 0, count: 0 }
    existing.count++
    existing.totalPnl += pnl
    if (pnl > 0) existing.wins++
    else existing.losses++
    dayMap.set(dayName, existing)
  }

  const dayStats = Array.from(dayMap.entries()).map(([day, stats]) => ({
    day,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgPnl: stats.count > 0 ? stats.totalPnl / stats.count : 0,
    count: stats.count,
  }))

  const bestTradingDays = dayStats.sort((a, b) => b.winRate - a.winRate).slice(0, 3)
  const worstTradingDays = dayStats.sort((a, b) => a.winRate - b.winRate).slice(0, 3)

  // ─── Emotional State Correlation ────────────────
  const emotionMap = new Map<string, { wins: number; losses: number; totalPnl: number; count: number }>()
  for (const e of tradesWithPnl) {
    const pnl = parseFloat(e.pnl!)
    const existing = emotionMap.get(e.emotionalState) ?? { wins: 0, losses: 0, totalPnl: 0, count: 0 }
    existing.count++
    existing.totalPnl += pnl
    if (pnl > 0) existing.wins++
    else existing.losses++
    emotionMap.set(e.emotionalState, existing)
  }

  const emotionalCorrelations = Array.from(emotionMap.entries()).map(([emotion, stats]) => ({
    emotion,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgPnl: stats.count > 0 ? stats.totalPnl / stats.count : 0,
    count: stats.count,
  }))

  // ─── Behavioral Insights ────────────────────────
  const suggestions: string[] = []

  // Overtrading detection
  const dateTradeCount = new Map<string, number>()
  for (const e of entries) {
    const date = e.entryDate.toISOString().slice(0, 10)
    dateTradeCount.set(date, (dateTradeCount.get(date) ?? 0) + 1)
  }
  const overtradingDays = Array.from(dateTradeCount.entries()).filter(([_, count]) => count >= 5)
  if (overtradingDays.length > 0) {
    insights.push({
      category: 'behavioral',
      title: 'Overtrading detected',
      description: `You placed 5+ trades on ${overtradingDays.length} day(s). Consider being more selective.`,
      severity: 'warning',
      dataPoints: overtradingDays.length,
    })
    suggestions.push('Limit yourself to 3-4 high-quality setups per day.')
  }

  // FOMO / Revenge trading
  const fomoTrades = tradesWithPnl.filter((e) => e.emotionalState === 'fomo')
  if (fomoTrades.length > 0) {
    const fomoWinRate = (fomoTrades.filter((e) => parseFloat(e.pnl!) > 0).length / fomoTrades.length) * 100
    insights.push({
      category: 'emotional',
      title: 'FOMO trades underperform',
      description: `Your ${fomoTrades.length} FOMO trades have a ${fomoWinRate.toFixed(0)}% win rate. Avoid chasing entries.`,
      severity: fomoWinRate < 40 ? 'critical' : 'warning',
      dataPoints: fomoTrades.length,
    })
    suggestions.push('Set price alerts instead of chasing moves. Wait for pullbacks.')
  }

  // Fearful trades
  const fearfulTrades = tradesWithPnl.filter((e) => e.emotionalState === 'fearful')
  if (fearfulTrades.length > 0) {
    const fearAvgPnl = fearfulTrades.reduce((sum, e) => sum + parseFloat(e.pnl!), 0) / fearfulTrades.length
    if (fearAvgPnl < 0) {
      insights.push({
        category: 'emotional',
        title: 'Fear-based trades are unprofitable',
        description: `Trades taken while fearful average $${fearAvgPnl.toFixed(2)} P&L. Consider skipping trades when feeling fearful.`,
        severity: 'warning',
        dataPoints: fearfulTrades.length,
      })
    }
  }

  // Best setup recommendation
  if (bestSetups.length > 0 && bestSetups[0]!.winRate > 60) {
    insights.push({
      category: 'setup',
      title: `${bestSetups[0]!.setupType} is your best setup`,
      description: `${bestSetups[0]!.winRate.toFixed(0)}% win rate across ${bestSetups[0]!.count} trades. Focus more on this pattern.`,
      severity: 'info',
      dataPoints: bestSetups[0]!.count,
    })
    suggestions.push(`Prioritize ${bestSetups[0]!.setupType} setups — your edge is strongest here.`)
  }

  // Worst setup warning
  if (worstSetups.length > 0 && worstSetups[0]!.winRate < 35 && worstSetups[0]!.count >= 3) {
    insights.push({
      category: 'setup',
      title: `Avoid ${worstSetups[0]!.setupType} trades`,
      description: `Only ${worstSetups[0]!.winRate.toFixed(0)}% win rate across ${worstSetups[0]!.count} trades. Consider removing this from your playbook.`,
      severity: 'critical',
      dataPoints: worstSetups[0]!.count,
    })
    suggestions.push(`Stop trading ${worstSetups[0]!.setupType} setups until you refine your edge.`)
  }

  // Disciplined trades outperform
  const disciplinedTrades = tradesWithPnl.filter((e) => e.emotionalState === 'disciplined')
  if (disciplinedTrades.length >= 3) {
    const discWinRate = (disciplinedTrades.filter((e) => parseFloat(e.pnl!) > 0).length / disciplinedTrades.length) * 100
    const overallWinRate = (tradesWithPnl.filter((e) => parseFloat(e.pnl!) > 0).length / tradesWithPnl.length) * 100
    if (discWinRate > overallWinRate + 5) {
      insights.push({
        category: 'emotional',
        title: 'Discipline pays off',
        description: `Disciplined trades: ${discWinRate.toFixed(0)}% win rate vs overall ${overallWinRate.toFixed(0)}%. Keep following your rules.`,
        severity: 'info',
        dataPoints: disciplinedTrades.length,
      })
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('Keep logging trades consistently to unlock deeper insights.')
  }

  return {
    insights,
    bestSetups,
    worstSetups,
    bestTradingDays,
    worstTradingDays,
    emotionalCorrelations,
    suggestions,
  }
}
