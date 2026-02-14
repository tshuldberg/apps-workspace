'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import { FuturesDashboard } from '@marlin/ui/trading/futures-dashboard'
import { RolloverCalendar } from '@marlin/ui/trading/rollover-calendar'
import { COTChart } from '@marlin/ui/trading/cot-chart'
import { FuturesSpread, type SpreadDataPoint, type SpreadBands } from '@marlin/ui/trading/futures-spread'
import type {
  FuturesQuote,
  RolloverCalendar as RolloverCalendarData,
  COTData,
} from '@marlin/shared'

// ── Types ───────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'rollover' | 'cot' | 'spreads'

const TABS: { value: Tab; label: string }[] = [
  { value: 'dashboard', label: 'Futures Dashboard' },
  { value: 'rollover', label: 'Rollover Calendar' },
  { value: 'cot', label: 'COT Reports' },
  { value: 'spreads', label: 'Spreads' },
]

// ── Mock Data ───────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries

const now = Date.now()

function generateSparkline(base: number, volatility: number, points: number = 24): number[] {
  const data: number[] = [base]
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.5) * volatility
    data.push(data[i - 1]! + change)
  }
  return data
}

const MOCK_FUTURES_QUOTES: FuturesQuote[] = [
  {
    symbol: 'ESH26',
    name: 'E-mini S&P 500',
    underlyingSymbol: 'ES',
    assetClass: 'indices',
    price: 5892.75,
    change: 23.50,
    changePercent: 0.40,
    volume: 1_243_500,
    openInterest: 2_567_000,
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    high24h: 5910.00,
    low24h: 5865.25,
    sparkline: generateSparkline(5870, 10),
  },
  {
    symbol: 'NQH26',
    name: 'E-mini NASDAQ-100',
    underlyingSymbol: 'NQ',
    assetClass: 'indices',
    price: 21245.50,
    change: 156.25,
    changePercent: 0.74,
    volume: 876_200,
    openInterest: 1_432_000,
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    high24h: 21300.00,
    low24h: 21050.00,
    sparkline: generateSparkline(21100, 50),
  },
  {
    symbol: 'YMH26',
    name: 'E-mini Dow',
    underlyingSymbol: 'YM',
    assetClass: 'indices',
    price: 43850,
    change: -125,
    changePercent: -0.28,
    volume: 234_500,
    openInterest: 567_000,
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    high24h: 44050,
    low24h: 43720,
    sparkline: generateSparkline(43950, 80),
  },
  {
    symbol: 'RTYH26',
    name: 'E-mini Russell 2000',
    underlyingSymbol: 'RTY',
    assetClass: 'indices',
    price: 2234.50,
    change: 8.30,
    changePercent: 0.37,
    volume: 156_800,
    openInterest: 345_000,
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    high24h: 2245.00,
    low24h: 2220.00,
    sparkline: generateSparkline(2225, 5),
  },
  {
    symbol: 'CLH26',
    name: 'Crude Oil WTI',
    underlyingSymbol: 'CL',
    assetClass: 'commodities',
    price: 78.42,
    change: 1.23,
    changePercent: 1.59,
    volume: 567_300,
    openInterest: 1_234_000,
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    high24h: 79.10,
    low24h: 77.05,
    sparkline: generateSparkline(77.5, 0.5),
  },
  {
    symbol: 'GCJ26',
    name: 'Gold',
    underlyingSymbol: 'GC',
    assetClass: 'commodities',
    price: 2945.60,
    change: 18.40,
    changePercent: 0.63,
    volume: 234_100,
    openInterest: 456_000,
    contractMonth: '202604',
    expirationDate: '2026-04-28T00:00:00Z',
    high24h: 2960.00,
    low24h: 2925.00,
    sparkline: generateSparkline(2930, 8),
  },
  {
    symbol: 'SIH26',
    name: 'Silver',
    underlyingSymbol: 'SI',
    assetClass: 'commodities',
    price: 33.85,
    change: -0.45,
    changePercent: -1.31,
    volume: 89_500,
    openInterest: 178_000,
    contractMonth: '202603',
    expirationDate: '2026-03-27T00:00:00Z',
    high24h: 34.50,
    low24h: 33.60,
    sparkline: generateSparkline(34.2, 0.2),
  },
  {
    symbol: 'ZBH26',
    name: '30-Year T-Bond',
    underlyingSymbol: 'ZB',
    assetClass: 'bonds',
    price: 118.156,
    change: -0.312,
    changePercent: -0.26,
    volume: 123_400,
    openInterest: 678_000,
    contractMonth: '202603',
    expirationDate: '2026-03-19T00:00:00Z',
    high24h: 118.625,
    low24h: 117.875,
    sparkline: generateSparkline(118.3, 0.15),
  },
  {
    symbol: 'ZNH26',
    name: '10-Year T-Note',
    underlyingSymbol: 'ZN',
    assetClass: 'bonds',
    price: 109.984,
    change: -0.156,
    changePercent: -0.14,
    volume: 245_600,
    openInterest: 1_123_000,
    contractMonth: '202603',
    expirationDate: '2026-03-19T00:00:00Z',
    high24h: 110.250,
    low24h: 109.750,
    sparkline: generateSparkline(110.0, 0.1),
  },
  {
    symbol: '6EH26',
    name: 'Euro FX',
    underlyingSymbol: '6E',
    assetClass: 'currencies',
    price: 1.08245,
    change: 0.00125,
    changePercent: 0.12,
    volume: 156_700,
    openInterest: 567_000,
    contractMonth: '202603',
    expirationDate: '2026-03-15T00:00:00Z',
    high24h: 1.08450,
    low24h: 1.08050,
    sparkline: generateSparkline(1.081, 0.001),
  },
  {
    symbol: '6JH26',
    name: 'Japanese Yen',
    underlyingSymbol: '6J',
    assetClass: 'currencies',
    price: 0.006542,
    change: -0.000023,
    changePercent: -0.35,
    volume: 89_300,
    openInterest: 234_000,
    contractMonth: '202603',
    expirationDate: '2026-03-15T00:00:00Z',
    high24h: 0.006575,
    low24h: 0.006510,
    sparkline: generateSparkline(0.00655, 0.00001),
  },
]

const MOCK_ROLLOVER_CALENDARS: RolloverCalendarData[] = [
  {
    symbol: 'ES',
    contracts: [
      { month: '202603', firstNoticeDate: '2026-02-28T00:00:00Z', lastTradingDate: '2026-03-20T00:00:00Z', volume: 1_243_500 },
      { month: '202606', firstNoticeDate: '2026-05-29T00:00:00Z', lastTradingDate: '2026-06-19T00:00:00Z', volume: 345_200 },
      { month: '202609', firstNoticeDate: '2026-08-28T00:00:00Z', lastTradingDate: '2026-09-18T00:00:00Z', volume: 12_100 },
      { month: '202612', firstNoticeDate: '2026-11-27T00:00:00Z', lastTradingDate: '2026-12-18T00:00:00Z', volume: 1_200 },
    ],
  },
  {
    symbol: 'CL',
    contracts: [
      { month: '202603', firstNoticeDate: '2026-02-20T00:00:00Z', lastTradingDate: '2026-03-20T00:00:00Z', volume: 567_300 },
      { month: '202604', firstNoticeDate: '2026-03-20T00:00:00Z', lastTradingDate: '2026-04-20T00:00:00Z', volume: 234_100 },
      { month: '202605', firstNoticeDate: '2026-04-20T00:00:00Z', lastTradingDate: '2026-05-20T00:00:00Z', volume: 78_500 },
      { month: '202606', firstNoticeDate: '2026-05-20T00:00:00Z', lastTradingDate: '2026-06-19T00:00:00Z', volume: 12_300 },
    ],
  },
  {
    symbol: 'GC',
    contracts: [
      { month: '202604', firstNoticeDate: '2026-03-27T00:00:00Z', lastTradingDate: '2026-04-28T00:00:00Z', volume: 234_100 },
      { month: '202606', firstNoticeDate: '2026-05-28T00:00:00Z', lastTradingDate: '2026-06-26T00:00:00Z', volume: 89_500 },
      { month: '202608', firstNoticeDate: '2026-07-28T00:00:00Z', lastTradingDate: '2026-08-27T00:00:00Z', volume: 12_400 },
    ],
  },
  {
    symbol: 'NQ',
    contracts: [
      { month: '202603', firstNoticeDate: '2026-02-28T00:00:00Z', lastTradingDate: '2026-03-20T00:00:00Z', volume: 876_200 },
      { month: '202606', firstNoticeDate: '2026-05-29T00:00:00Z', lastTradingDate: '2026-06-19T00:00:00Z', volume: 234_500 },
    ],
  },
]

const MOCK_COT_DATA: COTData[] = Array.from({ length: 26 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (25 - i) * 7)
  const base = 150_000
  return {
    symbol: 'ES',
    reportDate: date.toISOString().slice(0, 10),
    commercialLong: base + Math.floor(Math.random() * 50_000),
    commercialShort: base + Math.floor(Math.random() * 50_000) + 20_000,
    nonCommercialLong: base + Math.floor(Math.random() * 40_000) + 30_000,
    nonCommercialShort: base + Math.floor(Math.random() * 40_000),
    nonReportableLong: Math.floor(Math.random() * 30_000) + 20_000,
    nonReportableShort: Math.floor(Math.random() * 30_000) + 20_000,
  }
})

const MOCK_SPREAD_DATA: SpreadDataPoint[] = Array.from({ length: 60 }, (_, i) => {
  const timestamp = now - (59 - i) * 24 * 60 * 60 * 1000
  const base = 5890
  const frontPrice = base + Math.random() * 30 - 15
  const backPrice = frontPrice - 2.5 + Math.random() * 5
  return {
    timestamp,
    frontPrice,
    backPrice,
    spread: frontPrice - backPrice,
  }
})

const MOCK_SPREAD_BANDS: SpreadBands = {
  mean: 1.25,
  upper1sd: 3.50,
  lower1sd: -1.00,
  upper2sd: 5.75,
  lower2sd: -3.25,
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function FuturesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [cotSymbol, setCotSymbol] = useState('ES')
  const [symbolSearch, setSymbolSearch] = useState('')

  // COT date range
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const [cotStartDate, setCotStartDate] = useState(sixMonthsAgo.toISOString().slice(0, 10))
  const [cotEndDate, setCotEndDate] = useState(new Date().toISOString().slice(0, 10))

  const handleContractClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  // Available COT symbols
  const cotSymbols = ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6J']

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Futures</h1>
            <p className="text-xs text-text-muted">
              Contract data, rollovers, COT reports, and spread analysis
            </p>
          </div>
          {/* Symbol search */}
          <input
            type="text"
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value.toUpperCase())}
            placeholder="Search futures..."
            className="h-8 w-48 rounded border border-border bg-navy-mid px-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.value
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {activeTab === 'dashboard' && (
            <FuturesDashboard
              quotes={
                symbolSearch
                  ? MOCK_FUTURES_QUOTES.filter(
                      (q) =>
                        q.symbol.includes(symbolSearch) ||
                        q.underlyingSymbol.includes(symbolSearch) ||
                        q.name.toUpperCase().includes(symbolSearch),
                    )
                  : MOCK_FUTURES_QUOTES
              }
              onContractClick={handleContractClick}
            />
          )}

          {activeTab === 'rollover' && (
            <RolloverCalendar
              calendars={MOCK_ROLLOVER_CALENDARS}
              onContractClick={(symbol, month) => handleContractClick(symbol)}
            />
          )}

          {activeTab === 'cot' && (
            <div className="space-y-4">
              {/* COT symbol selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-muted">Symbol:</span>
                <div className="flex gap-1">
                  {cotSymbols.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setCotSymbol(sym)}
                      className={cn(
                        'rounded px-2 py-1 font-mono text-[10px] font-semibold transition-colors',
                        cotSymbol === sym
                          ? 'bg-accent text-text-primary'
                          : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
                      )}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              <COTChart
                data={MOCK_COT_DATA}
                cotIndex={68}
                symbol={cotSymbol}
                startDate={cotStartDate}
                endDate={cotEndDate}
                onStartDateChange={setCotStartDate}
                onEndDateChange={setCotEndDate}
              />
            </div>
          )}

          {activeTab === 'spreads' && (
            <FuturesSpread
              frontSymbol="ESH26"
              backSymbol="ESM26"
              data={MOCK_SPREAD_DATA}
              bands={MOCK_SPREAD_BANDS}
            />
          )}
        </div>
      </div>
    </div>
  )
}
