'use client'

import { useState, useCallback } from 'react'
import type {
  PatternDetection,
  JournalAnalysis,
  JournalInsight,
} from '@marlin/shared'
import { PATTERN_LABELS } from '@marlin/shared'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AIAnalysisPanelProps {
  /** Detected patterns sorted by confidence */
  detections: PatternDetection[]
  /** Loading state for pattern detection */
  detectionsLoading?: boolean
  /** Journal analysis data */
  journalAnalysis?: JournalAnalysis | null
  /** Loading state for journal analysis */
  journalLoading?: boolean
  /** Called when user submits an NLP query */
  onNLPQuery?: (text: string) => void
  /** Loading state for NLP query */
  nlpLoading?: boolean
  /** NLP query result text */
  nlpResult?: string | null
  /** Called when user gives feedback on a detection */
  onFeedback?: (detection: PatternDetection, positive: boolean) => void
  /** Called when user clicks a pattern to highlight on chart */
  onPatternClick?: (detection: PatternDetection) => void
  className?: string
}

type TabId = 'patterns' | 'ask' | 'journal'

// ── Helpers ────────────────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-trading-green'
  if (confidence >= 0.5) return 'text-yellow-400'
  return 'text-trading-red'
}

function severityColor(severity: JournalInsight['severity']): string {
  switch (severity) {
    case 'critical': return 'border-trading-red/40 bg-trading-red/5'
    case 'warning': return 'border-yellow-400/40 bg-yellow-400/5'
    case 'info': return 'border-accent/40 bg-accent/5'
  }
}

function severityDot(severity: JournalInsight['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-trading-red'
    case 'warning': return 'bg-yellow-400'
    case 'info': return 'bg-accent'
  }
}

// ── Skeleton Loader ────────────────────────────────────────────────────────

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={cn('h-3 animate-pulse rounded bg-navy-mid', className)} />
  )
}

function SkeletonCard() {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-full" />
      <SkeletonLine className="w-1/2" />
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function AIAnalysisPanel({
  detections,
  detectionsLoading,
  journalAnalysis,
  journalLoading,
  onNLPQuery,
  nlpLoading,
  nlpResult,
  onFeedback,
  onPatternClick,
  className,
}: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('patterns')
  const [nlpInput, setNlpInput] = useState('')

  const handleNLPSubmit = useCallback(() => {
    if (!nlpInput.trim() || !onNLPQuery) return
    onNLPQuery(nlpInput.trim())
  }, [nlpInput, onNLPQuery])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'patterns', label: 'Patterns' },
    { id: 'ask', label: 'Ask AI' },
    { id: 'journal', label: 'Journal' },
  ]

  return (
    <div className={cn('flex flex-col border-l border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
          <path d="M12 2a10 10 0 1 0 10 10" />
          <path d="M12 2a10 10 0 0 1 10 10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="text-sm font-semibold text-text-primary">AI Analysis</span>
        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
          Beta
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-accent text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'patterns' && (
          <PatternsTab
            detections={detections}
            loading={detectionsLoading}
            onFeedback={onFeedback}
            onPatternClick={onPatternClick}
          />
        )}

        {activeTab === 'ask' && (
          <AskAITab
            nlpInput={nlpInput}
            onInputChange={setNlpInput}
            onSubmit={handleNLPSubmit}
            loading={nlpLoading}
            result={nlpResult}
          />
        )}

        {activeTab === 'journal' && (
          <JournalTab
            analysis={journalAnalysis}
            loading={journalLoading}
          />
        )}
      </div>
    </div>
  )
}

// ── Patterns Tab ───────────────────────────────────────────────────────────

function PatternsTab({
  detections,
  loading,
  onFeedback,
  onPatternClick,
}: {
  detections: PatternDetection[]
  loading?: boolean
  onFeedback?: (d: PatternDetection, positive: boolean) => void
  onPatternClick?: (d: PatternDetection) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (detections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-muted">
        <p className="text-sm">No patterns detected</p>
        <p className="mt-1 text-xs opacity-60">Patterns will appear as they are identified</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {detections.map((d, idx) => (
        <div
          key={`${d.pattern}-${d.startBar}-${idx}`}
          className="rounded-lg border border-border p-3 transition-colors hover:border-border/80"
        >
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left"
            onClick={() => onPatternClick?.(d)}
          >
            <span className={cn('text-xs', d.direction === 'bullish' ? 'text-trading-green' : 'text-trading-red')}>
              {d.direction === 'bullish' ? '\u25B2' : '\u25BC'}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">
                  {PATTERN_LABELS[d.pattern]}
                </span>
                <span className={cn('font-mono text-[11px] font-semibold tabular-nums', confidenceColor(d.confidence))}>
                  {(d.confidence * 100).toFixed(0)}%
                </span>
              </div>
              {d.priceTarget && (
                <p className="mt-0.5 text-[10px] text-text-muted">
                  Target: <span className="font-mono tabular-nums text-trading-green">${d.priceTarget.toFixed(2)}</span>
                  {d.stopLoss && (
                    <>
                      {' | '}Stop: <span className="font-mono tabular-nums text-trading-red">${d.stopLoss.toFixed(2)}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </button>

          {/* Feedback buttons */}
          {onFeedback && (
            <div className="mt-2 flex gap-2 border-t border-border/50 pt-2">
              <button
                type="button"
                onClick={() => onFeedback(d, true)}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-trading-green/10 hover:text-trading-green"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                Helpful
              </button>
              <button
                type="button"
                onClick={() => onFeedback(d, false)}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-trading-red/10 hover:text-trading-red"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                  <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
                Not useful
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Ask AI Tab ─────────────────────────────────────────────────────────────

function AskAITab({
  nlpInput,
  onInputChange,
  onSubmit,
  loading,
  result,
}: {
  nlpInput: string
  onInputChange: (v: string) => void
  onSubmit: () => void
  loading?: boolean
  result?: string | null
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-muted">
        Ask questions in plain English about the market, your portfolio, or chart patterns.
      </p>

      <div className="flex gap-2">
        <Input
          value={nlpInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
          placeholder="e.g. Show me oversold large-caps"
          className="flex-1 text-xs"
          disabled={loading}
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!nlpInput.trim() || loading}
          className="shrink-0"
        >
          {loading ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-text-primary border-t-transparent" />
          ) : (
            'Ask'
          )}
        </Button>
      </div>

      {/* Example queries */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Try asking:
        </p>
        {[
          'Show me oversold large-caps breaking out',
          'Bullish stocks near 52-week high',
          'Small-cap stocks with high volume',
        ].map((example) => (
          <button
            key={example}
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-[11px] text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary"
            onClick={() => {
              onInputChange(example)
            }}
          >
            "{example}"
          </button>
        ))}
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs text-text-secondary">{result}</p>
        </div>
      )}
    </div>
  )
}

// ── Journal Insights Tab ───────────────────────────────────────────────────

function JournalTab({
  analysis,
  loading,
}: {
  analysis?: JournalAnalysis | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-muted">
        <p className="text-sm">No journal data</p>
        <p className="mt-1 text-xs opacity-60">Log trades to see AI insights</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Insights */}
      {analysis.insights.map((insight, idx) => (
        <div
          key={`insight-${idx}`}
          className={cn('rounded-lg border p-3', severityColor(insight.severity))}
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', severityDot(insight.severity))} />
            <span className="text-xs font-semibold text-text-primary">{insight.title}</span>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">{insight.description}</p>
        </div>
      ))}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Suggestions
          </p>
          <ul className="space-y-1">
            {analysis.suggestions.map((s, idx) => (
              <li key={idx} className="text-[11px] text-text-secondary">
                <span className="mr-1 text-accent">-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Emotional correlations */}
      {analysis.emotionalCorrelations.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Emotion vs P&L
          </p>
          <div className="space-y-1">
            {analysis.emotionalCorrelations.map((e) => (
              <div key={e.emotion} className="flex items-center justify-between text-[11px]">
                <span className="capitalize text-text-secondary">{e.emotion}</span>
                <div className="flex gap-3">
                  <span className="font-mono tabular-nums text-text-muted">{e.winRate.toFixed(0)}% WR</span>
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      e.avgPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {e.avgPnl >= 0 ? '+' : ''}${e.avgPnl.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
