'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import { NewsFeed, type NewsArticleData } from '@marlin/ui/trading/news-feed'
import {
  EconomicCalendar,
  type EconomicEventData,
} from '@marlin/ui/trading/economic-calendar'
import {
  EarningsCalendar,
  type EarningsEventData,
} from '@marlin/ui/trading/earnings-calendar'

// ── Types ───────────────────────────────────────────────────────────────────

type Tab = 'news' | 'economic' | 'earnings'

const TABS: { value: Tab; label: string }[] = [
  { value: 'news', label: 'News Feed' },
  { value: 'economic', label: 'Economic Calendar' },
  { value: 'earnings', label: 'Earnings Calendar' },
]

// ── Mock data — will be replaced with tRPC queries ───────────────────────────
// TODO: Replace with trpc.news.getArticles.useInfiniteQuery()
// TODO: Replace with trpc.news.getEconomicCalendar.useQuery()
// TODO: Replace with trpc.news.getEarningsCalendar.useQuery()

const now = Date.now()

const MOCK_ARTICLES: NewsArticleData[] = [
  {
    id: 'art-1',
    title: 'Fed Signals Patience on Rate Cuts Amid Sticky Inflation',
    summary:
      'Federal Reserve officials indicated they are in no rush to lower interest rates, citing persistent inflationary pressures and a resilient labor market that continues to exceed expectations.',
    source: 'Benzinga',
    url: '#',
    imageUrl: null,
    symbols: ['SPY', 'QQQ', 'TLT'],
    categories: ['macro', 'fed'],
    publishedAt: new Date(now - 1800000).toISOString(),
  },
  {
    id: 'art-2',
    title: 'NVIDIA Beats Q4 Estimates, Revenue Surges 265% on AI Demand',
    summary:
      'NVIDIA reported fourth-quarter earnings that smashed Wall Street expectations, with revenue jumping 265% year-over-year driven by unprecedented demand for AI training chips.',
    source: 'Benzinga',
    url: '#',
    imageUrl: null,
    symbols: ['NVDA', 'AMD', 'SMCI'],
    categories: ['earnings', 'tech', 'ai'],
    publishedAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: 'art-3',
    title: 'Apple Announces $110 Billion Share Buyback, Largest in History',
    summary:
      'Apple Inc. announced a record-breaking $110 billion share repurchase program, the largest in corporate history, alongside a 4% increase in its quarterly dividend.',
    source: 'Benzinga',
    url: '#',
    imageUrl: null,
    symbols: ['AAPL'],
    categories: ['corporate', 'buyback'],
    publishedAt: new Date(now - 7200000).toISOString(),
  },
  {
    id: 'art-4',
    title: 'Tesla Delivery Numbers Fall Short of Expectations in Q1',
    summary:
      'Tesla delivered 386,810 vehicles in the first quarter, falling short of the 449,000 analyst consensus. The company cited factory retooling for the updated Model Y.',
    source: 'Benzinga',
    url: '#',
    imageUrl: null,
    symbols: ['TSLA'],
    categories: ['earnings', 'ev'],
    publishedAt: new Date(now - 14400000).toISOString(),
  },
  {
    id: 'art-5',
    title: 'Oil Prices Surge as OPEC+ Maintains Production Cuts',
    summary:
      'Crude oil prices rose over 3% after OPEC+ members agreed to extend production cuts through the end of the year, supporting prices amid global demand uncertainty.',
    source: 'Custom',
    url: '#',
    imageUrl: null,
    symbols: ['USO', 'XLE', 'CVX'],
    categories: ['commodities', 'energy'],
    publishedAt: new Date(now - 21600000).toISOString(),
  },
]

const todayStr = new Date().toISOString().slice(0, 10)
const tomorrowDate = new Date()
tomorrowDate.setDate(tomorrowDate.getDate() + 1)
const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

const MOCK_ECONOMIC_EVENTS: EconomicEventData[] = [
  {
    id: 'eco-1',
    name: 'FOMC Meeting Minutes',
    description: 'Minutes from the most recent Federal Open Market Committee meeting',
    eventDate: new Date(`${todayStr}T19:00:00Z`).toISOString(),
    impact: 'high',
    actual: null,
    forecast: null,
    previous: null,
    country: 'US',
  },
  {
    id: 'eco-2',
    name: 'Initial Jobless Claims',
    description: 'Weekly first-time unemployment benefit claims',
    eventDate: new Date(`${todayStr}T13:30:00Z`).toISOString(),
    impact: 'medium',
    actual: '215K',
    forecast: '220K',
    previous: '222K',
    country: 'US',
  },
  {
    id: 'eco-3',
    name: 'Existing Home Sales',
    description: 'Monthly existing home sales data',
    eventDate: new Date(`${todayStr}T15:00:00Z`).toISOString(),
    impact: 'medium',
    actual: null,
    forecast: '4.20M',
    previous: '4.00M',
    country: 'US',
  },
  {
    id: 'eco-4',
    name: 'CPI (YoY)',
    description: 'Consumer Price Index year-over-year',
    eventDate: new Date(`${tomorrowStr}T13:30:00Z`).toISOString(),
    impact: 'high',
    actual: null,
    forecast: '3.1%',
    previous: '3.2%',
    country: 'US',
  },
  {
    id: 'eco-5',
    name: 'PMI Manufacturing',
    description: 'Purchasing Managers Index for manufacturing sector',
    eventDate: new Date(`${tomorrowStr}T14:45:00Z`).toISOString(),
    impact: 'low',
    actual: null,
    forecast: '51.5',
    previous: '50.9',
    country: 'US',
  },
]

const MOCK_EARNINGS_EVENTS: EarningsEventData[] = [
  {
    id: 'earn-1',
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    reportDate: new Date(`${todayStr}T21:00:00Z`).toISOString(),
    quarter: 'Q4 2024',
    estimatedEps: '4.59',
    actualEps: '5.16',
    estimatedRevenue: '20500000000',
    actualRevenue: '22100000000',
  },
  {
    id: 'earn-2',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    reportDate: new Date(`${tomorrowStr}T21:00:00Z`).toISOString(),
    quarter: 'Q1 2025',
    estimatedEps: '2.10',
    actualEps: null,
    estimatedRevenue: '117800000000',
    actualRevenue: null,
  },
  {
    id: 'earn-3',
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    reportDate: new Date(`${tomorrowStr}T21:00:00Z`).toISOString(),
    quarter: 'Q2 2025',
    estimatedEps: '3.22',
    actualEps: null,
    estimatedRevenue: '68600000000',
    actualRevenue: null,
  },
  {
    id: 'earn-4',
    symbol: 'TSLA',
    companyName: 'Tesla Inc.',
    reportDate: new Date(`${tomorrowStr}T09:00:00Z`).toISOString(),
    quarter: 'Q1 2025',
    estimatedEps: '0.52',
    actualEps: null,
    estimatedRevenue: '25200000000',
    actualRevenue: null,
  },
  {
    id: 'earn-5',
    symbol: 'AMZN',
    companyName: 'Amazon.com Inc.',
    reportDate: new Date(`${todayStr}T09:00:00Z`).toISOString(),
    quarter: 'Q4 2024',
    estimatedEps: '1.00',
    actualEps: '1.21',
    estimatedRevenue: '166200000000',
    actualRevenue: '170000000000',
  },
]

// ── Page Component ───────────────────────────────────────────────────────────

export default function NewsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('news')
  const [symbolFilter, setSymbolFilter] = useState('')

  // Earnings calendar date range
  const weekFromNow = new Date()
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  const [earningsStartDate, setEarningsStartDate] = useState(todayStr)
  const [earningsEndDate, setEarningsEndDate] = useState(
    weekFromNow.toISOString().slice(0, 10),
  )

  const handleSymbolClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  // Client-side filtering for mock data
  let filteredArticles = MOCK_ARTICLES
  if (symbolFilter) {
    filteredArticles = filteredArticles.filter((a) =>
      a.symbols.some((s) => s.includes(symbolFilter)),
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">News & Events</h1>
        <p className="text-xs text-text-muted">
          Market news, economic calendar, and earnings reports
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
        <div className="mx-auto max-w-4xl">
          {activeTab === 'news' && (
            <NewsFeed
              articles={filteredArticles}
              hasMore={false}
              onLoadMore={() => {}}
              isLoading={false}
              symbolFilter={symbolFilter}
              onSymbolFilterChange={setSymbolFilter}
              onSymbolClick={handleSymbolClick}
            />
          )}

          {activeTab === 'economic' && (
            <EconomicCalendar
              events={MOCK_ECONOMIC_EVENTS}
              isLoading={false}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsCalendar
              events={MOCK_EARNINGS_EVENTS}
              isLoading={false}
              onSymbolClick={handleSymbolClick}
              startDate={earningsStartDate}
              endDate={earningsEndDate}
              onStartDateChange={setEarningsStartDate}
              onEndDateChange={setEarningsEndDate}
            />
          )}
        </div>
      </div>
    </div>
  )
}
