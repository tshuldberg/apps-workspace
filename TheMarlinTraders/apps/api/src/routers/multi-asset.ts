import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import {
  TOP_CRYPTO_PAIRS,
  ALL_FOREX_PAIRS,
  MAJOR_FOREX_PAIRS,
  FOREX_SESSIONS,
  MAJOR_CURRENCIES,
  type CurrencyStrength,
  type CorrelationMatrix,
  type CorrelationPeriod,
} from '@marlin/shared'
import {
  calculateCurrencyStrength,
  computePairChanges,
  buildCorrelationMatrix,
} from '@marlin/shared'

// ── Mock Helpers ────────────────────────────────────────────────────────────
// TODO: Replace with real data from Coinbase/Binance/Polygon adapters

function mockCryptoPrice(pair: string): {
  pair: string
  price: number
  change24h: number
  changePercent24h: number
  volume24h: number
  high24h: number
  low24h: number
  marketCap: number
  lastUpdated: string
} {
  const basePrices: Record<string, number> = {
    'BTC-USD': 67_432.50,
    'ETH-USD': 3_521.80,
    'SOL-USD': 148.25,
    'BNB-USD': 598.40,
    'XRP-USD': 0.62,
    'ADA-USD': 0.48,
    'DOGE-USD': 0.165,
    'AVAX-USD': 38.90,
    'DOT-USD': 7.85,
    'MATIC-USD': 0.72,
    'LINK-USD': 18.45,
    'UNI-USD': 12.30,
    'ATOM-USD': 9.15,
    'LTC-USD': 84.60,
    'NEAR-USD': 7.20,
    'FIL-USD': 6.15,
    'APT-USD': 9.80,
    'ARB-USD': 1.22,
    'OP-USD': 3.45,
    'SUI-USD': 1.85,
  }

  const basePrice = basePrices[pair] ?? 100
  // Simulated jitter
  const jitter = (Math.random() - 0.5) * 0.02 * basePrice
  const price = basePrice + jitter
  const changePct = (Math.random() - 0.5) * 10
  const change = price * (changePct / 100)

  return {
    pair,
    price,
    change24h: change,
    changePercent24h: changePct,
    volume24h: Math.random() * 5_000_000_000,
    high24h: price * 1.03,
    low24h: price * 0.97,
    marketCap: price * (pair === 'BTC-USD' ? 19_500_000 : pair === 'ETH-USD' ? 120_000_000 : 1_000_000_000),
    lastUpdated: new Date().toISOString(),
  }
}

function mockForexPrice(pair: string): {
  pair: string
  bid: number
  ask: number
  mid: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  lastUpdated: string
} {
  const basePrices: Record<string, number> = {
    'EUR/USD': 1.0862,
    'GBP/USD': 1.2715,
    'USD/JPY': 154.82,
    'AUD/USD': 0.6532,
    'USD/CAD': 1.3625,
    'USD/CHF': 0.8845,
    'NZD/USD': 0.6048,
    'EUR/GBP': 0.8542,
    'EUR/JPY': 168.15,
    'GBP/JPY': 196.82,
    'USD/MXN': 17.15,
    'USD/ZAR': 18.62,
    'USD/TRY': 32.45,
  }

  const basePrice = basePrices[pair] ?? 1.0
  const spread = basePrice * 0.0001
  const jitter = (Math.random() - 0.5) * 0.002 * basePrice
  const mid = basePrice + jitter
  const changePct = (Math.random() - 0.5) * 2

  return {
    pair,
    bid: mid - spread / 2,
    ask: mid + spread / 2,
    mid,
    change24h: mid * (changePct / 100),
    changePercent24h: changePct,
    high24h: mid * 1.005,
    low24h: mid * 0.995,
    lastUpdated: new Date().toISOString(),
  }
}

function mockCurrencyStrengths(): CurrencyStrength[] {
  // Generate mock pair changes
  const pairChanges = new Map<string, number>()
  const allPairs = [
    'USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/AUD', 'USD/CAD', 'USD/CHF', 'USD/NZD',
    'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
    'GBP/JPY', 'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/NZD',
    'JPY/AUD', 'JPY/CAD', 'JPY/CHF', 'JPY/NZD',
    'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
    'CAD/CHF', 'CAD/NZD',
    'CHF/NZD',
  ]
  for (const pair of allPairs) {
    pairChanges.set(pair, (Math.random() - 0.5) * 3)
  }
  return calculateCurrencyStrength(pairChanges)
}

function mockCorrelationMatrix(symbols: string[], period: CorrelationPeriod): CorrelationMatrix {
  // Generate mock close price data
  const closePrices = new Map<string, number[]>()
  for (const symbol of symbols) {
    const prices: number[] = []
    let price = 100 + Math.random() * 50
    for (let i = 0; i < 100; i++) {
      price += (Math.random() - 0.5) * 2
      prices.push(price)
    }
    closePrices.set(symbol, prices)
  }
  return buildCorrelationMatrix(symbols, closePrices, period)
}

// ── Economic Calendar Mock ──────────────────────────────────────────────────

interface ForexEconomicEvent {
  id: string
  name: string
  country: string
  impact: 'low' | 'medium' | 'high'
  date: string
  actual?: string | null
  forecast?: string | null
  previous?: string | null
}

function mockForexCalendar(): ForexEconomicEvent[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  return [
    {
      id: 'fx-eco-1',
      name: 'Non-Farm Payrolls',
      country: 'US',
      impact: 'high',
      date: new Date(`${todayStr}T13:30:00Z`).toISOString(),
      actual: null,
      forecast: '185K',
      previous: '216K',
    },
    {
      id: 'fx-eco-2',
      name: 'ECB Interest Rate Decision',
      country: 'EU',
      impact: 'high',
      date: new Date(`${todayStr}T12:15:00Z`).toISOString(),
      actual: '4.50%',
      forecast: '4.50%',
      previous: '4.50%',
    },
    {
      id: 'fx-eco-3',
      name: 'BOJ Monetary Policy Statement',
      country: 'JP',
      impact: 'high',
      date: new Date(`${tomorrowStr}T03:00:00Z`).toISOString(),
      actual: null,
      forecast: null,
      previous: null,
    },
    {
      id: 'fx-eco-4',
      name: 'UK CPI (YoY)',
      country: 'GB',
      impact: 'medium',
      date: new Date(`${tomorrowStr}T07:00:00Z`).toISOString(),
      actual: null,
      forecast: '4.0%',
      previous: '4.2%',
    },
    {
      id: 'fx-eco-5',
      name: 'RBA Cash Rate',
      country: 'AU',
      impact: 'high',
      date: new Date(`${tomorrowStr}T03:30:00Z`).toISOString(),
      actual: null,
      forecast: '4.35%',
      previous: '4.35%',
    },
    {
      id: 'fx-eco-6',
      name: 'Canada Employment Change',
      country: 'CA',
      impact: 'medium',
      date: new Date(`${todayStr}T13:30:00Z`).toISOString(),
      actual: '37.3K',
      forecast: '25.0K',
      previous: '0.1K',
    },
  ]
}

// ── Session Status ──────────────────────────────────────────────────────────

function getSessionStatuses() {
  const now = new Date()
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const currentMinutes = etTime.getHours() * 60 + etTime.getMinutes()
  const dayOfWeek = etTime.getDay()

  return FOREX_SESSIONS.map((session) => {
    const [openH, openM] = session.openET.split(':').map(Number)
    const [closeH, closeM] = session.closeET.split(':').map(Number)
    const openMin = openH! * 60 + openM!
    const closeMin = closeH! * 60 + closeM!

    let isOpen: boolean
    if (openMin < closeMin) {
      isOpen = currentMinutes >= openMin && currentMinutes < closeMin
    } else {
      isOpen = currentMinutes >= openMin || currentMinutes < closeMin
    }

    if (dayOfWeek === 6) isOpen = false
    if (dayOfWeek === 0 && currentMinutes < 17 * 60) isOpen = false

    return {
      name: session.name,
      timezone: session.timezone,
      openET: session.openET,
      closeET: session.closeET,
      isOpen,
    }
  })
}

// ── Router ──────────────────────────────────────────────────────────────────

const CorrelationPeriodSchema = z.enum(['1D', '1W', '1M', '3M', '1Y'])

export const multiAssetRouter = router({
  getCryptoQuote: publicProcedure
    .input(
      z.object({
        pair: z.string().min(3).max(20).transform((s) => s.toUpperCase()),
      }),
    )
    .query(({ input }) => {
      return mockCryptoPrice(input.pair)
    }),

  getCryptoList: publicProcedure.query(() => {
    return TOP_CRYPTO_PAIRS.map((pair) => mockCryptoPrice(pair))
  }),

  getForexQuote: publicProcedure
    .input(
      z.object({
        pair: z.string().min(3).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(({ input }) => {
      return mockForexPrice(input.pair)
    }),

  getForexList: publicProcedure.query(() => {
    return ALL_FOREX_PAIRS.map((pair) => mockForexPrice(pair))
  }),

  getCurrencyStrength: publicProcedure
    .input(
      z
        .object({
          period: z.enum(['1D', '1W', '1M']).optional().default('1D'),
        })
        .optional()
        .default({}),
    )
    .query(() => {
      return mockCurrencyStrengths()
    }),

  getCorrelationMatrix: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string()).min(2).max(20),
        period: CorrelationPeriodSchema.optional().default('1M'),
      }),
    )
    .query(({ input }) => {
      return mockCorrelationMatrix(input.symbols, input.period)
    }),

  getForexSessions: publicProcedure.query(() => {
    return getSessionStatuses()
  }),

  getForexCalendar: publicProcedure.query(() => {
    return mockForexCalendar()
  }),
})
