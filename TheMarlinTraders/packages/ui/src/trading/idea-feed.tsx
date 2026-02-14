'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'
import { IdeaCard, type IdeaCardData } from './idea-card.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type SortMode = 'recent' | 'top' | 'hot'
export type Sentiment = 'bullish' | 'bearish' | 'neutral'

export interface IdeaFeedProps {
  ideas: IdeaCardData[]
  hasMore: boolean
  onLoadMore: () => void
  isLoading?: boolean
  onVote?: (ideaId: string, voteType: 'up' | 'down') => void
  onClickIdea?: (ideaId: string) => void
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  symbolFilter: string
  onSymbolFilterChange: (symbol: string) => void
  sentimentFilter: Sentiment | null
  onSentimentFilterChange: (sentiment: Sentiment | null) => void
  className?: string
}

// ── Sort tabs ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'top', label: 'Top' },
  { value: 'hot', label: 'Hot' },
]

const SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function IdeaFeed({
  ideas,
  hasMore,
  onLoadMore,
  isLoading = false,
  onVote,
  onClickIdea,
  sort,
  onSortChange,
  symbolFilter,
  onSymbolFilterChange,
  sentimentFilter,
  onSentimentFilterChange,
  className,
}: IdeaFeedProps) {
  const observerRef = useRef<HTMLDivElement | null>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const node = observerRef.current
    if (!node || !hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort tabs */}
        <div className="flex rounded-md border border-border">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSortChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                sort === opt.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Symbol filter */}
        <input
          type="text"
          value={symbolFilter}
          onChange={(e) => onSymbolFilterChange(e.target.value.toUpperCase())}
          placeholder="Filter by symbol..."
          className="h-8 w-28 rounded border border-border bg-navy-dark px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />

        <div className="h-4 w-px bg-border" />

        {/* Sentiment filter chips */}
        {SENTIMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              onSentimentFilterChange(sentimentFilter === opt.value ? null : opt.value)
            }
            className={cn(
              'rounded-full px-2.5 py-1 text-xs transition-colors',
              sentimentFilter === opt.value
                ? opt.value === 'bullish'
                  ? 'bg-trading-green/20 text-trading-green'
                  : opt.value === 'bearish'
                    ? 'bg-trading-red/20 text-trading-red'
                    : 'bg-text-muted/20 text-text-secondary'
                : 'bg-navy-mid text-text-muted hover:text-text-primary',
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* Clear all */}
        {(symbolFilter || sentimentFilter) && (
          <button
            type="button"
            onClick={() => {
              onSymbolFilterChange('')
              onSentimentFilterChange(null)
            }}
            className="text-xs text-text-muted underline hover:text-text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Ideas list */}
      {ideas.length > 0 ? (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onVote={onVote}
              onClick={onClickIdea}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isLoading ? 'Loading ideas...' : 'No ideas found'}
          </span>
          {!isLoading && (
            <span className="text-xs text-text-muted">
              Be the first to share a trading idea
            </span>
          )}
        </div>
      )}

      {/* Loading indicator / infinite scroll sentinel */}
      {isLoading && ideas.length > 0 && (
        <div className="flex justify-center py-4">
          <span className="text-xs text-text-muted">Loading more ideas...</span>
        </div>
      )}

      {/* Intersection observer sentinel */}
      {hasMore && <div ref={observerRef} className="h-1" />}
    </div>
  )
}
