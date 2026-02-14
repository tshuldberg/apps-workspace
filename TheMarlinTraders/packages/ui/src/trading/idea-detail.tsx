'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type Sentiment = 'bullish' | 'bearish' | 'neutral'

export interface IdeaDetailData {
  id: string
  title: string
  body: string
  symbol: string
  sentiment: Sentiment
  tags: string[]
  chartSnapshotUrl: string | null
  timeframe: string | null
  upvotes: number
  downvotes: number
  commentCount: number
  isPublished: boolean
  publishedAt: string | Date | null
  createdAt: string | Date
  userId: string
  authorName?: string
  authorAvatarUrl?: string | null
}

export interface IdeaDetailProps {
  idea: IdeaDetailData
  onVote?: (ideaId: string, voteType: 'up' | 'down') => void
  currentVote?: 'up' | 'down' | null
  className?: string
}

// ── Sentiment badge ──────────────────────────────────────────────────────────

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  bullish: 'bg-trading-green/20 text-trading-green',
  bearish: 'bg-trading-red/20 text-trading-red',
  neutral: 'bg-text-muted/20 text-text-muted',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Minimal Markdown-like renderer for idea bodies. */
function renderMarkdown(text: string): JSX.Element[] {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={i} className="mb-1 mt-4 text-sm font-semibold text-text-primary">
          {line.slice(4)}
        </h4>
      )
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="mb-1 mt-4 text-base font-semibold text-text-primary">
          {line.slice(3)}
        </h3>
      )
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={i} className="mb-2 mt-4 text-lg font-bold text-text-primary">
          {line.slice(2)}
        </h2>
      )
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="ml-4 list-disc text-sm text-text-secondary">
          {line.slice(2)}
        </li>
      )
    }
    if (line.trim() === '') {
      return <div key={i} className="h-3" />
    }
    // Bold spans: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={i} className="text-sm leading-relaxed text-text-secondary">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-semibold text-text-primary">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
      </p>
    )
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function IdeaDetail({ idea, onVote, currentVote, className }: IdeaDetailProps) {
  const netVotes = idea.upvotes - idea.downvotes

  return (
    <article className={cn('space-y-6', className)}>
      {/* Author + Date header */}
      <div className="flex items-center gap-3">
        {idea.authorAvatarUrl ? (
          <img
            src={idea.authorAvatarUrl}
            alt=""
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
            {(idea.authorName ?? idea.userId).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <span className="text-sm font-medium text-text-primary">
            {idea.authorName ?? idea.userId.slice(0, 12)}
          </span>
          {idea.publishedAt && (
            <span className="ml-2 text-xs text-text-muted">
              {formatDate(idea.publishedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold leading-tight text-text-primary">
        {idea.title}
      </h1>

      {/* Symbol + Sentiment + Timeframe */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-accent/10 px-2 py-0.5 text-sm font-semibold text-accent">
          {idea.symbol}
        </span>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-bold uppercase',
            SENTIMENT_STYLES[idea.sentiment],
          )}
        >
          {idea.sentiment}
        </span>
        {idea.timeframe && (
          <span className="rounded bg-navy-mid px-2 py-0.5 text-xs text-text-muted">
            {idea.timeframe}
          </span>
        )}
      </div>

      {/* Chart snapshot */}
      {idea.chartSnapshotUrl && (
        <div className="overflow-hidden rounded-lg border border-border">
          <img
            src={idea.chartSnapshotUrl}
            alt={`${idea.symbol} chart`}
            className="w-full"
          />
        </div>
      )}

      {/* Body (markdown rendered) */}
      <div className="space-y-1">
        {renderMarkdown(idea.body)}
      </div>

      {/* Tags */}
      {idea.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {idea.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Vote bar */}
      <div className="flex items-center gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVote?.(idea.id, 'up')}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
              currentVote === 'up'
                ? 'bg-trading-green/20 text-trading-green'
                : 'bg-navy-mid text-text-muted hover:bg-navy-light hover:text-text-secondary',
            )}
          >
            ▲ Upvote
          </button>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              netVotes > 0 ? 'text-trading-green' : netVotes < 0 ? 'text-trading-red' : 'text-text-muted',
            )}
          >
            {netVotes}
          </span>
          <button
            type="button"
            onClick={() => onVote?.(idea.id, 'down')}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
              currentVote === 'down'
                ? 'bg-trading-red/20 text-trading-red'
                : 'bg-navy-mid text-text-muted hover:bg-navy-light hover:text-text-secondary',
            )}
          >
            ▼ Downvote
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        <span className="text-xs text-text-muted">
          {idea.commentCount} {idea.commentCount === 1 ? 'comment' : 'comments'}
        </span>
      </div>
    </article>
  )
}
