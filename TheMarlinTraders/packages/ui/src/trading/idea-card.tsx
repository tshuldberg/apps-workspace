'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type Sentiment = 'bullish' | 'bearish' | 'neutral'

export interface IdeaCardData {
  id: string
  title: string
  symbol: string
  sentiment: Sentiment
  tags: string[]
  chartSnapshotUrl: string | null
  upvotes: number
  downvotes: number
  commentCount: number
  publishedAt: string | Date | null
  userId: string
  /** Display name of the author (resolved client-side). */
  authorName?: string
  /** Avatar URL for the author. */
  authorAvatarUrl?: string | null
}

export interface IdeaCardProps {
  idea: IdeaCardData
  onVote?: (ideaId: string, voteType: 'up' | 'down') => void
  onClick?: (ideaId: string) => void
  currentVote?: 'up' | 'down' | null
  className?: string
}

// ── Sentiment badge config ───────────────────────────────────────────────────

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  bullish: 'bg-trading-green/20 text-trading-green',
  bearish: 'bg-trading-red/20 text-trading-red',
  neutral: 'bg-text-muted/20 text-text-muted',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

export function IdeaCard({ idea, onVote, onClick, currentVote, className }: IdeaCardProps) {
  const netVotes = idea.upvotes - idea.downvotes

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(idea.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(idea.id)
      }}
      className={cn(
        'flex gap-3 rounded-lg border border-border bg-navy-dark p-4 transition-colors',
        'cursor-pointer hover:border-text-muted/30 hover:bg-navy-mid',
        className,
      )}
    >
      {/* Vote column */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVote?.(idea.id, 'up')
          }}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-xs transition-colors',
            currentVote === 'up'
              ? 'bg-trading-green/20 text-trading-green'
              : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
          )}
          aria-label="Upvote"
        >
          ▲
        </button>
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            netVotes > 0 ? 'text-trading-green' : netVotes < 0 ? 'text-trading-red' : 'text-text-muted',
          )}
        >
          {netVotes}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVote?.(idea.id, 'down')
          }}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-xs transition-colors',
            currentVote === 'down'
              ? 'bg-trading-red/20 text-trading-red'
              : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
          )}
          aria-label="Downvote"
        >
          ▼
        </button>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-accent">{idea.symbol}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', SENTIMENT_STYLES[idea.sentiment])}>
            {idea.sentiment}
          </span>
          {idea.publishedAt && (
            <span className="text-[10px] text-text-muted">{timeAgo(idea.publishedAt)}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-1.5 text-sm font-semibold leading-tight text-text-primary line-clamp-2">
          {idea.title}
        </h3>

        {/* Chart thumbnail */}
        {idea.chartSnapshotUrl && (
          <div className="mb-2 overflow-hidden rounded border border-border">
            <img
              src={idea.chartSnapshotUrl}
              alt={`${idea.symbol} chart`}
              className="h-32 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Footer: tags + comment count + author */}
        <div className="flex items-center gap-3">
          {/* Tags */}
          <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
            {idea.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="truncate rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent"
              >
                #{tag}
              </span>
            ))}
            {idea.tags.length > 3 && (
              <span className="text-[10px] text-text-muted">+{idea.tags.length - 3}</span>
            )}
          </div>

          {/* Comment count */}
          <span className="shrink-0 text-[10px] text-text-muted">
            {idea.commentCount} {idea.commentCount === 1 ? 'comment' : 'comments'}
          </span>

          {/* Author */}
          <div className="flex shrink-0 items-center gap-1.5">
            {idea.authorAvatarUrl ? (
              <img
                src={idea.authorAvatarUrl}
                alt=""
                className="h-4 w-4 rounded-full"
              />
            ) : (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
                {(idea.authorName ?? idea.userId).charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[10px] text-text-muted">
              {idea.authorName ?? idea.userId.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
