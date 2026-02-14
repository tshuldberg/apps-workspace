'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import {
  ForexSessions,
  type ForexSessionData,
} from '@marlin/ui/trading/forex-sessions'
import {
  CurrencyStrengthMeter,
  type CurrencyStrengthData,
  type StrengthPeriod,
} from '@marlin/ui/trading/currency-strength-meter'
import {
  CorrelationMatrix,
  type CorrelationMatrixData,
  type CorrelationPreset,
} from '@marlin/ui/trading/correlation-matrix'
import { ForexCalculator } from '@marlin/ui/trading/forex-calculator'
import {
  EconomicCalendar,
  type EconomicEventData,
} from '@marlin/ui/trading/economic-calendar'

// ── Types ───────────────────────────────────────────────────────────────────

type ForexTab = 'overview' | 'strength' | 'correlation' | 'calculator' | 'calendar'

const TABS: { value: ForexTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'strength', label: 'Strength' },
  { value: 'correlation', label: 'Correlation' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'calendar', label: 'Calendar' },
]

// ── Mock Data ───────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries

const MOCK_SESSIONS: ForexSessionData[] = [
  { name: 'Sydney', timezone: 'Australia/Sydney', openET: '17:00', closeET: '02:00', isOpen: false },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', openET: '19:00', closeET: '04:00', isOpen: false },
  { name: 'London', timezone: 'Europe/London', openET: '03:00', closeET: '12:00', isOpen: true },
  { name: 'New York', timezone: 'America/New_York', openET: '08:00', closeET: '17:00', isOpen: true },
]

interface ForexQuote {
  pair: string
  bid: number
  ask: number
  spread: number
  change: number
  changePercent: number
}

const MOCK_FOREX_QUOTES: ForexQuote[] = [
  { pair: 'EUR/USD', bid: 1.0860, ask: 1.0862, spread: 0.2, change: 0.0015, changePercent: 0.14 },
  { pair: 'GBP/USD', bid: 1.2713, ask: 1.2716, spread: 0.3, change: -0.0028, changePercent: -0.22 },
  { pair: 'USD/JPY', bid: 154.80, ask: 154.83, spread: 0.3, change: 0.45, changePercent: 0.29 },
  { pair: 'AUD/USD', bid: 0.6530, ask: 0.6533, spread: 0.3, change: 0.0012, changePercent: 0.18 },
  { pair: 'USD/CAD', bid: 1.3623, ask: 1.3627, spread: 0.4, change: -0.0018, changePercent: -0.13 },
  { pair: 'USD/CHF', bid: 0.8843, ask: 0.8847, spread: 0.4, change: 0.0008, changePercent: 0.09 },
  { pair: 'NZD/USD', bid: 0.6046, ask: 0.6050, spread: 0.4, change: -0.0005, changePercent: -0.08 },
  { pair: 'EUR/GBP', bid: 0.8540, ask: 0.8544, spread: 0.4, change: 0.0022, changePercent: 0.26 },
  { pair: 'EUR/JPY', bid: 168.12, ask: 168.16, spread: 0.4, change: 0.68, changePercent: 0.41 },
  { pair: 'GBP/JPY', bid: 196.78, ask: 196.84, spread: 0.6, change: -0.35, changePercent: -0.18 },
]

const MOCK_CURRENCY_STRENGTH: CurrencyStrengthData[] = [
  { currency: 'USD', strength: 72, change: 3.2 },
  { currency: 'EUR', strength: 58, change: -1.5 },
  { currency: 'GBP', strength: 45, change: -4.1 },
  { currency: 'JPY', strength: 28, change: -2.8 },
  { currency: 'AUD', strength: 61, change: 5.0 },
  { currency: 'CAD', strength: 52, change: 1.2 },
  { currency: 'CHF', strength: 65, change: 2.1 },
  { currency: 'NZD', strength: 38, change: -3.5 },
]

const MOCK_CORRELATION: CorrelationMatrixData = {
  symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD'],
  matrix: [
    [1.00, 0.85, -0.72, 0.68, -0.78, -0.91, 0.62],
    [0.85, 1.00, -0.65, 0.58, -0.71, -0.82, 0.55],
    [-0.72, -0.65, 1.00, -0.45, 0.62, 0.68, -0.38],
    [0.68, 0.58, -0.45, 1.00, -0.55, -0.62, 0.88],
    [-0.78, -0.71, 0.62, -0.55, 1.00, 0.75, -0.48],
    [-0.91, -0.82, 0.68, -0.62, 0.75, 1.00, -0.58],
    [0.62, 0.55, -0.38, 0.88, -0.48, -0.58, 1.00],
  ],
  period: '1M',
}

const todayStr = new Date().toISOString().slice(0, 10)
const tomorrowDate = new Date()
tomorrowDate.setDate(tomorrowDate.getDate() + 1)
const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

const MOCK_FOREX_CALENDAR: EconomicEventData[] = [
  { id: 'fx-1', name: 'Non-Farm Payrolls', eventDate: new Date(`${todayStr}T13:30:00Z`).toISOString(), impact: 'high', actual: null, forecast: '185K', previous: '216K', country: 'US' },
  { id: 'fx-2', name: 'ECB Interest Rate Decision', eventDate: new Date(`${todayStr}T12:15:00Z`).toISOString(), impact: 'high', actual: '4.50%', forecast: '4.50%', previous: '4.50%', country: 'EU' },
  { id: 'fx-3', name: 'UK CPI (YoY)', eventDate: new Date(`${tomorrowStr}T07:00:00Z`).toISOString(), impact: 'medium', actual: null, forecast: '4.0%', previous: '4.2%', country: 'GB' },
  { id: 'fx-4', name: 'BOJ Monetary Policy Statement', eventDate: new Date(`${tomorrowStr}T03:00:00Z`).toISOString(), impact: 'high', actual: null, forecast: null, previous: null, country: 'JP' },
  { id: 'fx-5', name: 'RBA Cash Rate', eventDate: new Date(`${tomorrowStr}T03:30:00Z`).toISOString(), impact: 'high', actual: null, forecast: '4.35%', previous: '4.35%', country: 'AU' },
]

// ── Page Component ──────────────────────────────────────────────────────────

export default function ForexPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ForexTab>('overview')
  const [strengthPeriod, setStrengthPeriod] = useState<StrengthPeriod>('1D')
  const [correlationPreset, setCorrelationPreset] = useState<CorrelationPreset>('major-forex')

  const handlePairClick = useCallback(
    (pair: string) => {
      const symbol = pair.replace('/', '')
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Forex Markets</h1>
        <p className="text-xs text-text-muted">
          Currency pairs, session timings, strength analysis, and trading calculators
        </p>
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
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Session timeline */}
              <ForexSessions sessions={MOCK_SESSIONS} />

              {/* Major pairs grid */}
              <div className="rounded-lg border border-border bg-navy-dark">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Major & Cross Pairs
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-navy-dark">
                        <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                          Pair
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                          Bid
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                          Ask
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                          Spread
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_FOREX_QUOTES.map((q) => (
                        <tr
                          key={q.pair}
                          role="button"
                          tabIndex={0}
                          onClick={() => handlePairClick(q.pair)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePairClick(q.pair)
                          }}
                          className="cursor-pointer border-b border-border/50 transition-colors hover:bg-navy-light"
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-sm font-medium text-text-primary">
                              {q.pair}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-mono text-sm tabular-nums text-text-primary">
                              {q.bid.toFixed(q.pair.includes('JPY') ? 2 : 4)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-mono text-sm tabular-nums text-text-primary">
                              {q.ask.toFixed(q.pair.includes('JPY') ? 2 : 4)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-mono text-xs tabular-nums text-text-muted">
                              {q.spread.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={cn(
                                'font-mono text-sm tabular-nums',
                                q.changePercent >= 0 ? 'text-trading-green' : 'text-trading-red',
                              )}
                            >
                              {q.changePercent >= 0 ? '+' : ''}
                              {q.changePercent.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Side by side: Strength + Calendar */}
              <div className="grid gap-6 lg:grid-cols-2">
                <CurrencyStrengthMeter
                  data={MOCK_CURRENCY_STRENGTH}
                  period={strengthPeriod}
                  onPeriodChange={setStrengthPeriod}
                />

                <div className="rounded-lg border border-border bg-navy-dark p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Upcoming Events
                  </h3>
                  <EconomicCalendar events={MOCK_FOREX_CALENDAR} />
                </div>
              </div>
            </>
          )}

          {/* Strength Tab */}
          {activeTab === 'strength' && (
            <CurrencyStrengthMeter
              data={MOCK_CURRENCY_STRENGTH}
              period={strengthPeriod}
              onPeriodChange={setStrengthPeriod}
            />
          )}

          {/* Correlation Tab */}
          {activeTab === 'correlation' && (
            <CorrelationMatrix
              data={MOCK_CORRELATION}
              preset={correlationPreset}
              onPresetChange={setCorrelationPreset}
              onCellClick={(a, b, r) => {
                // TODO: Open rolling correlation chart
              }}
            />
          )}

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="mx-auto max-w-md">
              <ForexCalculator />
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <EconomicCalendar events={MOCK_FOREX_CALENDAR} />
          )}
        </div>
      </div>
    </div>
  )
}
