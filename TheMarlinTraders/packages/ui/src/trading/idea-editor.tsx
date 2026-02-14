'use client'

import { useState, useCallback, type KeyboardEvent } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type Sentiment = 'bullish' | 'bearish' | 'neutral'

export interface IdeaEditorData {
  title: string
  body: string
  symbol: string
  sentiment: Sentiment
  tags: string[]
  chartSnapshotUrl: string
  timeframe: string
}

export interface IdeaEditorProps {
  initialData?: Partial<IdeaEditorData>
  onPublish?: (data: IdeaEditorData) => void
  onSaveDraft?: (data: IdeaEditorData) => void
  isSubmitting?: boolean
  className?: string
}

// ── Sentiment config ─────────────────────────────────────────────────────────

const SENTIMENTS: { value: Sentiment; label: string; color: string; activeColor: string }[] = [
  { value: 'bullish', label: 'Bullish', color: 'text-trading-green', activeColor: 'bg-trading-green/20 text-trading-green border-trading-green' },
  { value: 'bearish', label: 'Bearish', color: 'text-trading-red', activeColor: 'bg-trading-red/20 text-trading-red border-trading-red' },
  { value: 'neutral', label: 'Neutral', color: 'text-text-muted', activeColor: 'bg-text-muted/20 text-text-secondary border-text-muted' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function IdeaEditor({
  initialData,
  onPublish,
  onSaveDraft,
  isSubmitting = false,
  className,
}: IdeaEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [body, setBody] = useState(initialData?.body ?? '')
  const [symbol, setSymbol] = useState(initialData?.symbol ?? '')
  const [sentiment, setSentiment] = useState<Sentiment>(initialData?.sentiment ?? 'neutral')
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [chartSnapshotUrl, setChartSnapshotUrl] = useState(initialData?.chartSnapshotUrl ?? '')
  const [timeframe, setTimeframe] = useState(initialData?.timeframe ?? '')
  const [previewMode, setPreviewMode] = useState(false)

  const getData = useCallback((): IdeaEditorData => ({
    title,
    body,
    symbol: symbol.toUpperCase(),
    sentiment,
    tags,
    chartSnapshotUrl,
    timeframe,
  }), [title, body, symbol, sentiment, tags, chartSnapshotUrl, timeframe])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags((prev) => [...prev, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleTagKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        handleAddTag()
      }
    },
    [handleAddTag],
  )

  const canPublish = title.trim().length > 0 && body.trim().length > 0 && symbol.trim().length > 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your trading idea headline..."
          maxLength={200}
          className="flex h-10 w-full rounded-md border border-border bg-navy-dark px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <span className="mt-1 block text-right text-[10px] text-text-muted">
          {title.length}/200
        </span>
      </div>

      {/* Symbol + Timeframe row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Symbol
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={10}
            className="flex h-9 w-full rounded-md border border-border bg-navy-dark px-3 py-1 text-sm font-semibold text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>
        <div className="w-32">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Timeframe
          </label>
          <input
            type="text"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            placeholder="1D, 4H..."
            maxLength={20}
            className="flex h-9 w-full rounded-md border border-border bg-navy-dark px-3 py-1 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Sentiment */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Sentiment
        </label>
        <div className="flex gap-2">
          {SENTIMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSentiment(s.value)}
              className={cn(
                'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                sentiment === s.value
                  ? s.activeColor
                  : 'border-border text-text-muted hover:border-text-muted/50 hover:text-text-secondary',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body (markdown) with preview toggle */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Analysis
          </label>
          <button
            type="button"
            onClick={() => setPreviewMode((p) => !p)}
            className="text-xs text-accent hover:text-accent-hover"
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
        {previewMode ? (
          <div className="min-h-[200px] rounded-md border border-border bg-navy-dark p-4 text-sm leading-relaxed text-text-secondary">
            {body.split('\n').map((line, i) => (
              <p key={i} className={line.trim() === '' ? 'h-4' : ''}>
                {line.startsWith('# ')
                  ? <span className="text-base font-bold text-text-primary">{line.slice(2)}</span>
                  : line.startsWith('## ')
                    ? <span className="text-sm font-semibold text-text-primary">{line.slice(3)}</span>
                    : line.startsWith('**') && line.endsWith('**')
                      ? <strong className="text-text-primary">{line.slice(2, -2)}</strong>
                      : line}
              </p>
            ))}
            {!body && (
              <span className="text-text-muted">Nothing to preview yet...</span>
            )}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your analysis... (Markdown supported)"
            rows={10}
            className="flex min-h-[200px] w-full rounded-md border border-border bg-navy-dark px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 text-accent/60 hover:text-accent"
              >
                x
              </button>
            </span>
          ))}
          {tags.length < 10 && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder="Add tag..."
              className="h-7 w-28 rounded border-none bg-transparent px-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          )}
        </div>
        <span className="mt-1 block text-[10px] text-text-muted">
          Press Enter or comma to add. {tags.length}/10
        </span>
      </div>

      {/* Chart snapshot */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Chart Snapshot
        </label>
        {chartSnapshotUrl ? (
          <div className="relative">
            <img
              src={chartSnapshotUrl}
              alt="Chart snapshot"
              className="w-full rounded-md border border-border"
            />
            <button
              type="button"
              onClick={() => setChartSnapshotUrl('')}
              className="absolute right-2 top-2 rounded bg-navy-dark/80 px-2 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-border bg-navy-dark/50">
            <div className="text-center">
              <div className="text-sm text-text-muted">Chart snapshot</div>
              <div className="mt-1 text-[10px] text-text-muted">
                Paste an image URL or use the chart export tool
              </div>
              <input
                type="text"
                placeholder="Paste image URL..."
                className="mt-2 h-7 w-64 rounded border border-border bg-navy-dark px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setChartSnapshotUrl(e.currentTarget.value)
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => onPublish?.(getData())}
          disabled={!canPublish || isSubmitting}
          className={cn(
            'rounded-md px-6 py-2 text-sm font-semibold transition-colors',
            canPublish && !isSubmitting
              ? 'bg-accent text-text-primary hover:bg-accent-hover'
              : 'cursor-not-allowed bg-accent/30 text-text-muted',
          )}
        >
          {isSubmitting ? 'Publishing...' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={() => onSaveDraft?.(getData())}
          disabled={isSubmitting}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:border-text-muted/50 hover:text-text-secondary"
        >
          Save Draft
        </button>
      </div>
    </div>
  )
}
