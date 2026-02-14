'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewsArticleData {
  id: string
  title: string
  summary: string
  source: string
  url: string
  imageUrl?: string | null
  symbols: string[]
  categories: string[]
  publishedAt: string | Date
}

export interface NewsFeedProps {
  articles: NewsArticleData[]
  hasMore: boolean
  onLoadMore: () => void
  isLoading?: boolean
  symbolFilter: string
  onSymbolFilterChange: (symbol: string) => void
  onSymbolClick?: (symbol: string) => void
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

// ── Component ───────────────────────────────────────────────────────────────

export function NewsFeed({
  articles,
  hasMore,
  onLoadMore,
  isLoading = false,
  symbolFilter,
  onSymbolFilterChange,
  onSymbolClick,
  className,
}: NewsFeedProps) {
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
      {/* Symbol filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={symbolFilter}
          onChange={(e) => onSymbolFilterChange(e.target.value.toUpperCase())}
          placeholder="Filter by symbol..."
          className="h-8 w-40 rounded border border-border bg-navy-dark px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {symbolFilter && (
          <button
            type="button"
            onClick={() => onSymbolFilterChange('')}
            className="text-xs text-text-muted underline hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Articles */}
      {articles.length > 0 ? (
        <div className="space-y-3">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-lg border border-border bg-navy-dark p-4 transition-colors hover:border-accent/40 hover:bg-navy-mid"
            >
              {/* Thumbnail */}
              {article.imageUrl && (
                <div className="hidden shrink-0 overflow-hidden rounded-md sm:block">
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="h-20 w-28 object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase text-text-muted">
                    {article.source}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {timeAgo(article.publishedAt)}
                  </span>
                  {/* External link icon */}
                  <svg
                    className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>

                <h3 className="mb-1 text-sm font-medium leading-snug text-text-primary group-hover:text-accent">
                  {article.title}
                </h3>

                <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
                  {article.summary}
                </p>

                {/* Symbol tags */}
                {article.symbols.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.symbols.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onSymbolClick?.(sym)
                        }}
                        className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent transition-colors hover:bg-accent/20"
                      >
                        ${sym}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isLoading ? 'Loading articles...' : 'No news articles found'}
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && articles.length > 0 && (
        <div className="flex justify-center py-4">
          <span className="text-xs text-text-muted">Loading more articles...</span>
        </div>
      )}

      {/* Intersection observer sentinel */}
      {hasMore && <div ref={observerRef} className="h-1" />}
    </div>
  )
}
