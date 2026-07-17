'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import { NewsFeed, type NewsArticleData } from '@marlin/ui/trading/news-feed'
import { EconomicCalendar, type EconomicEventData } from '@marlin/ui/trading/economic-calendar'
import { EarningsCalendar, type EarningsEventData } from '@marlin/ui/trading/earnings-calendar'
import { TrpcClientError, trpcQuery } from '../../../lib/trpc-fetch.js'

type Tab = 'news' | 'economic' | 'earnings'

const TABS: { value: Tab; label: string }[] = [
  { value: 'news', label: 'News Feed' },
  { value: 'economic', label: 'Economic Calendar' },
  { value: 'earnings', label: 'Earnings Calendar' },
]

interface ApiArticlesResponse {
  items: {
    id: string
    source: 'benzinga' | 'custom'
    title: string
    summary: string
    url: string
    imageUrl: string | null
    symbols: string[]
    categories: string[]
    publishedAt: string
  }[]
  nextCursor?: string
}

interface ApiEconomicEvent {
  id: string
  name: string
  description: string | null
  eventDate: string
  impact: 'low' | 'medium' | 'high'
  actual: string | null
  forecast: string | null
  previous: string | null
  country: string
}

interface ApiEarningsEvent {
  id: string
  symbol: string
  companyName: string
  reportDate: string
  quarter: string
  estimatedEps: string | null
  actualEps: string | null
  estimatedRevenue: string | null
  actualRevenue: string | null
}

function toNewsArticleData(item: ApiArticlesResponse['items'][number]): NewsArticleData {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    source: item.source === 'benzinga' ? 'Benzinga' : 'Custom',
    url: item.url,
    imageUrl: item.imageUrl,
    symbols: item.symbols ?? [],
    categories: item.categories ?? [],
    publishedAt: item.publishedAt,
  }
}

function toEconomicEventData(item: ApiEconomicEvent): EconomicEventData {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    eventDate: item.eventDate,
    impact: item.impact,
    actual: item.actual,
    forecast: item.forecast,
    previous: item.previous,
    country: item.country,
  }
}

function toEarningsEventData(item: ApiEarningsEvent): EarningsEventData {
  return {
    id: item.id,
    symbol: item.symbol,
    companyName: item.companyName,
    reportDate: item.reportDate,
    quarter: item.quarter,
    estimatedEps: item.estimatedEps,
    actualEps: item.actualEps,
    estimatedRevenue: item.estimatedRevenue,
    actualRevenue: item.actualRevenue,
  }
}

function toIsoStart(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString()
}

function toIsoEnd(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString()
}

export default function NewsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('news')

  const [symbolFilter, setSymbolFilter] = useState('')
  const [articles, setArticles] = useState<NewsArticleData[]>([])
  const [articlesCursor, setArticlesCursor] = useState<string | undefined>(undefined)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [articlesLoadingMore, setArticlesLoadingMore] = useState(false)

  const [economicEvents, setEconomicEvents] = useState<EconomicEventData[]>([])
  const [economicLoading, setEconomicLoading] = useState(true)

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultEndDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  }, [])

  const [earningsStartDate, setEarningsStartDate] = useState(todayStr)
  const [earningsEndDate, setEarningsEndDate] = useState(defaultEndDate)
  const [earningsEvents, setEarningsEvents] = useState<EarningsEventData[]>([])
  const [earningsLoading, setEarningsLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const loadArticles = useCallback(
    async ({ cursor, append }: { cursor?: string; append?: boolean } = {}) => {
      if (append) {
        setArticlesLoadingMore(true)
      } else {
        setArticlesLoading(true)
      }
      setError(null)

      try {
        const response = await trpcQuery<ApiArticlesResponse>('news.getArticles', {
          symbol: symbolFilter.trim() || undefined,
          cursor,
          limit: 20,
        })

        const mapped = response.items.map(toNewsArticleData)
        setArticles((prev) => (append ? [...prev, ...mapped] : mapped))
        setArticlesCursor(response.nextCursor)
      } catch (err) {
        const message =
          err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
        setError(message)
        if (!append) {
          setArticles([])
          setArticlesCursor(undefined)
        }
      } finally {
        setArticlesLoading(false)
        setArticlesLoadingMore(false)
      }
    },
    [symbolFilter],
  )

  const loadEconomic = useCallback(async () => {
    setEconomicLoading(true)
    setError(null)
    try {
      const start = new Date()
      start.setDate(start.getDate() - 1)
      const end = new Date()
      end.setDate(end.getDate() + 7)

      const response = await trpcQuery<ApiEconomicEvent[]>('news.getEconomicCalendar', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      setEconomicEvents(response.map(toEconomicEventData))
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
      setEconomicEvents([])
    } finally {
      setEconomicLoading(false)
    }
  }, [])

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true)
    setError(null)
    try {
      const response = await trpcQuery<ApiEarningsEvent[]>('news.getEarningsCalendar', {
        startDate: toIsoStart(earningsStartDate),
        endDate: toIsoEnd(earningsEndDate),
      })
      setEarningsEvents(response.map(toEarningsEventData))
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
      setEarningsEvents([])
    } finally {
      setEarningsLoading(false)
    }
  }, [earningsEndDate, earningsStartDate])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  useEffect(() => {
    loadEconomic()
  }, [loadEconomic])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  const handleLoadMoreArticles = useCallback(() => {
    if (!articlesCursor || articlesLoadingMore) return
    loadArticles({ cursor: articlesCursor, append: true })
  }, [articlesCursor, articlesLoadingMore, loadArticles])

  const handleSymbolClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  const loading = articlesLoading || economicLoading || earningsLoading

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">News & Events</h1>
        <p className="text-xs text-text-muted">Market news, economic calendar, and earnings reports</p>
      </div>

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

      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-trading-red/5 px-6 py-2">
          <span className="text-xs text-trading-red">Failed to load data: {error}</span>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'news') loadArticles()
              if (activeTab === 'economic') loadEconomic()
              if (activeTab === 'earnings') loadEarnings()
            }}
            className="rounded bg-accent px-2 py-1 text-[10px] text-text-primary transition-colors hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {activeTab === 'news' && (
            <NewsFeed
              articles={articles}
              hasMore={Boolean(articlesCursor)}
              onLoadMore={handleLoadMoreArticles}
              isLoading={articlesLoading || articlesLoadingMore}
              symbolFilter={symbolFilter}
              onSymbolFilterChange={setSymbolFilter}
              onSymbolClick={handleSymbolClick}
            />
          )}

          {activeTab === 'economic' && <EconomicCalendar events={economicEvents} isLoading={economicLoading || loading} />}

          {activeTab === 'earnings' && (
            <EarningsCalendar
              events={earningsEvents}
              isLoading={earningsLoading || loading}
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
