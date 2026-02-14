'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@marlin/ui/primitives/button'
import { IdeaFeed, type SortMode, type Sentiment } from '@marlin/ui/trading/idea-feed'
import type { IdeaCardData } from '@marlin/ui/trading/idea-card'

// ── Mock data — will be replaced with tRPC queries ───────────────────────────

const MOCK_IDEAS: IdeaCardData[] = [
  {
    id: '1',
    title: 'AAPL breaking out of ascending triangle — targeting $195',
    symbol: 'AAPL',
    sentiment: 'bullish',
    tags: ['breakout', 'tech', 'swing'],
    chartSnapshotUrl: null,
    upvotes: 24,
    downvotes: 3,
    commentCount: 8,
    publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    userId: 'user_abc',
    authorName: 'TraderMike',
  },
  {
    id: '2',
    title: 'TSLA bearish divergence on RSI — short opportunity below $240',
    symbol: 'TSLA',
    sentiment: 'bearish',
    tags: ['divergence', 'ev', 'short'],
    chartSnapshotUrl: null,
    upvotes: 15,
    downvotes: 7,
    commentCount: 12,
    publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    userId: 'user_def',
    authorName: 'ChartNinja',
  },
  {
    id: '3',
    title: 'SPY consolidating around 520 — waiting for a clear direction',
    symbol: 'SPY',
    sentiment: 'neutral',
    tags: ['index', 'range'],
    chartSnapshotUrl: null,
    upvotes: 9,
    downvotes: 1,
    commentCount: 3,
    publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    userId: 'user_ghi',
    authorName: 'PatientTrader',
  },
  {
    id: '4',
    title: 'NVDA cup and handle on the weekly — long-term target $1100',
    symbol: 'NVDA',
    sentiment: 'bullish',
    tags: ['ai', 'tech', 'pattern'],
    chartSnapshotUrl: null,
    upvotes: 42,
    downvotes: 5,
    commentCount: 21,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    userId: 'user_jkl',
    authorName: 'AIBull',
  },
  {
    id: '5',
    title: 'META double top forming — caution above $530',
    symbol: 'META',
    sentiment: 'bearish',
    tags: ['social', 'double-top'],
    chartSnapshotUrl: null,
    upvotes: 11,
    downvotes: 4,
    commentCount: 6,
    publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    userId: 'user_mno',
    authorName: 'TechBear',
  },
]

export default function IdeasPage() {
  const router = useRouter()
  const [sort, setSort] = useState<SortMode>('recent')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | null>(null)
  const [ideas] = useState<IdeaCardData[]>(MOCK_IDEAS)

  // Will be replaced with tRPC infinite query
  const handleLoadMore = useCallback(() => {
    // noop — mock data is static
  }, [])

  const handleVote = useCallback((ideaId: string, voteType: 'up' | 'down') => {
    // Will be replaced with tRPC mutation
    console.log('Vote:', ideaId, voteType)
  }, [])

  const handleClickIdea = useCallback(
    (ideaId: string) => {
      router.push(`/ideas/${ideaId}`)
    },
    [router],
  )

  // Client-side filtering for mock data
  let filtered = ideas
  if (symbolFilter) {
    filtered = filtered.filter((i) =>
      i.symbol.toUpperCase().includes(symbolFilter.toUpperCase()),
    )
  }
  if (sentimentFilter) {
    filtered = filtered.filter((i) => i.sentiment === sentimentFilter)
  }

  // Client-side sorting for mock data
  if (sort === 'top') {
    filtered = [...filtered].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
  } else if (sort === 'hot') {
    filtered = [...filtered].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
  }
  // recent is default sort (already sorted by publishedAt in mock)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Trading Ideas</h1>
          <p className="text-xs text-text-muted">
            {filtered.length} {filtered.length === 1 ? 'idea' : 'ideas'} published
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/ideas/new')}>
          + New Idea
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <IdeaFeed
            ideas={filtered}
            hasMore={false}
            onLoadMore={handleLoadMore}
            isLoading={false}
            onVote={handleVote}
            onClickIdea={handleClickIdea}
            sort={sort}
            onSortChange={setSort}
            symbolFilter={symbolFilter}
            onSymbolFilterChange={setSymbolFilter}
            sentimentFilter={sentimentFilter}
            onSentimentFilterChange={setSentimentFilter}
          />
        </div>
      </div>
    </div>
  )
}
