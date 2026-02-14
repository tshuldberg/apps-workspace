'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IdeaDetail, type IdeaDetailData } from '@marlin/ui/trading/idea-detail'
import { CommentThread, type CommentData } from '@marlin/ui/trading/comment-thread'
import { IdeaJsonLd } from '@marlin/ui/seo/json-ld'

// ── Mock data — will be replaced with tRPC queries ───────────────────────────
// Exported so the server component (page.tsx) can use it for generateMetadata.

export const MOCK_IDEA: IdeaDetailData = {
  id: '1',
  title: 'AAPL breaking out of ascending triangle — targeting $195',
  body: `## Setup

AAPL has been forming an ascending triangle on the daily chart since mid-January. The horizontal resistance sits at $185, with higher lows forming a rising trendline from the $170 level.

## Entry

Looking for a clean break and close above $185 with **above-average volume**. Ideal entry is on a pullback retest of the breakout level.

## Target

- First target: $190 (prior swing high)
- Second target: $195 (measured move from the triangle)

## Risk Management

- Stop loss: $182 (below the last higher low)
- Risk/reward: approximately 1:2.5

## Key Observations

- RSI is showing strength above 60 without being overbought
- MACD crossed bullish last week
- Earnings beat expectations — fundamentals support the move`,
  symbol: 'AAPL',
  sentiment: 'bullish',
  tags: ['breakout', 'tech', 'swing'],
  chartSnapshotUrl: null,
  timeframe: '1D',
  upvotes: 24,
  downvotes: 3,
  commentCount: 3,
  isPublished: true,
  publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  userId: 'user_abc',
  authorName: 'TraderMike',
}

export const MOCK_COMMENTS: CommentData[] = [
  {
    id: 'c1',
    ideaId: '1',
    userId: 'user_def',
    parentId: null,
    body: 'Great analysis! I have been watching the same pattern. Volume was strong today on the push toward resistance.',
    upvotes: 5,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    authorName: 'ChartNinja',
  },
  {
    id: 'c2',
    ideaId: '1',
    userId: 'user_ghi',
    parentId: 'c1',
    body: 'Agreed on the volume. I also noticed the 50-day MA is acting as dynamic support now.',
    upvotes: 2,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    authorName: 'PatientTrader',
  },
  {
    id: 'c3',
    ideaId: '1',
    userId: 'user_jkl',
    parentId: null,
    body: 'What about the broader market? If SPY rolls over, AAPL might struggle to hold the breakout.',
    upvotes: 3,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    authorName: 'AIBull',
  },
]

// ── Client component ─────────────────────────────────────────────────────────

interface IdeaDetailClientProps {
  ideaId: string
}

export function IdeaDetailClient({ ideaId }: IdeaDetailClientProps) {
  const router = useRouter()

  const [idea] = useState<IdeaDetailData>(MOCK_IDEA)
  const [comments, setComments] = useState<CommentData[]>(MOCK_COMMENTS)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleVote = useCallback((id: string, voteType: 'up' | 'down') => {
    // Will be replaced with tRPC mutation
    console.log('Vote:', id, voteType)
  }, [])

  const handleSubmitComment = useCallback(
    (body: string, parentId?: string) => {
      setIsSubmitting(true)

      // Mock: add comment locally
      const newComment: CommentData = {
        id: `c${Date.now()}`,
        ideaId,
        userId: 'current_user',
        parentId: parentId ?? null,
        body,
        upvotes: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorName: 'You',
      }

      setComments((prev) => [newComment, ...prev])
      setIsSubmitting(false)
    },
    [ideaId],
  )

  const handleLoadMoreComments = useCallback(() => {
    // Will be replaced with tRPC cursor pagination
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-text-muted hover:text-text-primary"
            onClick={() => router.push('/ideas')}
          >
            &larr; Ideas
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-semibold text-accent">{idea.symbol}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* JSON-LD structured data (Task 20.4) */}
          <IdeaJsonLd
            title={idea.title}
            body={idea.body}
            author={idea.authorName ?? 'MarlinTraders'}
            datePublished={idea.publishedAt ? new Date(idea.publishedAt).toISOString() : new Date(idea.createdAt).toISOString()}
            dateModified={new Date(idea.createdAt).toISOString()}
            symbol={idea.symbol}
            url={`https://marlintraders.com/ideas/${ideaId}`}
            image={`/api/og?title=${encodeURIComponent(idea.title)}&symbol=${idea.symbol}&sentiment=${idea.sentiment}&author=${encodeURIComponent(idea.authorName ?? 'MarlinTraders')}`}
          />

          {/* Idea detail */}
          <IdeaDetail
            idea={idea}
            onVote={handleVote}
          />

          {/* Comments section */}
          <div className="border-t border-border pt-6">
            <CommentThread
              comments={comments}
              hasMore={false}
              onLoadMore={handleLoadMoreComments}
              onSubmitComment={handleSubmitComment}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
