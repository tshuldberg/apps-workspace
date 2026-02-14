'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Command } from 'cmdk'
import type { NLPQuery, ScreenerFilter } from '@marlin/shared'
import { PATTERN_LABELS } from '@marlin/shared'
import { cn } from '../lib/utils.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface NLPSearchResult {
  type: 'symbol' | 'screener' | 'pattern' | 'action'
  label: string
  description: string
  action: () => void
}

export interface NLPSearchProps {
  /** Called when user submits a query — should parse via the API */
  onQuery: (text: string) => Promise<NLPQuery | null>
  /** Called when user selects a symbol result */
  onOpenChart?: (symbol: string) => void
  /** Called when user wants to apply screener filters */
  onOpenScreener?: (filters: ScreenerFilter[]) => void
  /** Called when user selects an alert action */
  onCreateAlert?: (symbol: string) => void
  /** Stored recent NLP queries for quick re-use */
  recentQueries?: string[]
  /** Called to persist a new recent query */
  onSaveQuery?: (query: string) => void
  className?: string
}

const NLP_EXAMPLES = [
  'Show me oversold large-caps breaking out',
  'Bullish stocks near 52-week high with high volume',
  'Small-cap stocks that gapped up today',
  'Chart AAPL',
]

// ── Component ──────────────────────────────────────────────────────────────

export function NLPSearch({
  onQuery,
  onOpenChart,
  onOpenScreener,
  onCreateAlert,
  recentQueries = [],
  onSaveQuery,
  className,
}: NLPSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<NLPQuery | null>(null)
  const [results, setResults] = useState<NLPSearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⌘+J to toggle NLP search (distinct from ⌘+K for symbol search)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Parse query with debounce
  useEffect(() => {
    if (!query.trim()) {
      setParsed(null)
      setResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await onQuery(query)
        setParsed(result)

        if (result) {
          const newResults: NLPSearchResult[] = []

          // If filters were extracted, suggest opening screener
          if (result.parsedFilters.length > 0) {
            newResults.push({
              type: 'screener',
              label: 'Open Screener',
              description: `${result.parsedFilters.length} filter(s): ${result.parsedFilters.map((f) => f.field).join(', ')}`,
              action: () => {
                onOpenScreener?.(result.parsedFilters)
                setOpen(false)
              },
            })
          }

          // If chart action detected
          if (result.parsedActions.includes('chart')) {
            // Try to extract symbols from the raw text
            const symbols = extractSymbols(result.rawText)
            for (const sym of symbols) {
              newResults.push({
                type: 'symbol',
                label: sym,
                description: `Open chart for ${sym}`,
                action: () => {
                  onOpenChart?.(sym)
                  setOpen(false)
                },
              })
            }
          }

          // If alert action detected
          if (result.parsedActions.includes('alert')) {
            const symbols = extractSymbols(result.rawText)
            for (const sym of symbols) {
              newResults.push({
                type: 'action',
                label: `Alert on ${sym}`,
                description: 'Create a price alert',
                action: () => {
                  onCreateAlert?.(sym)
                  setOpen(false)
                },
              })
            }
          }

          // Show detected indicators
          if (result.parsedIndicators.length > 0) {
            newResults.push({
              type: 'action',
              label: 'Add Indicators',
              description: `Suggested: ${result.parsedIndicators.join(', ')}`,
              action: () => { setOpen(false) },
            })
          }

          setResults(newResults)
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, onQuery, onOpenChart, onOpenScreener, onCreateAlert])

  const handleSelect = useCallback(
    (result: NLPSearchResult) => {
      result.action()
      if (query.trim()) {
        onSaveQuery?.(query.trim())
      }
      setQuery('')
      setParsed(null)
      setResults([])
    },
    [query, onSaveQuery],
  )

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery('')
    setParsed(null)
    setResults([])
  }, [])

  // Cycle through example placeholders
  const [exampleIdx, setExampleIdx] = useState(0)
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => {
      setExampleIdx((prev) => (prev + 1) % NLP_EXAMPLES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose()
        }}
        role="button"
        tabIndex={-1}
      />

      <Command
        className={cn(
          'relative w-full max-w-xl overflow-hidden rounded-lg border border-border bg-navy-dark shadow-2xl',
          className,
        )}
        shouldFilter={false}
      >
        {/* Input */}
        <div className="flex items-center border-b border-border px-3">
          <svg
            className="mr-2 shrink-0 text-accent"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a10 10 0 1 0 10 10" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={NLP_EXAMPLES[exampleIdx]}
            className="flex h-12 w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted/60"
          />
          {loading && (
            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          )}
          <kbd className="ml-2 hidden rounded border border-border bg-navy-mid px-1.5 py-0.5 text-[10px] text-text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[350px] overflow-y-auto p-1">
          {/* Parsed filter badges */}
          {parsed && parsed.parsedFilters.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {parsed.parsedFilters.map((f, i) => (
                <span
                  key={`filter-${i}`}
                  className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent"
                >
                  {f.field} {f.operator} {Array.isArray(f.value) ? f.value.join('-') : f.value}
                </span>
              ))}
            </div>
          )}

          <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
            {query
              ? 'Type a trading question or command...'
              : 'Ask anything about the market in plain English'}
          </Command.Empty>

          {/* Recent queries (when no input) */}
          {!query && recentQueries.length > 0 && (
            <Command.Group heading="Recent queries">
              {recentQueries.slice(0, 5).map((rq, idx) => (
                <Command.Item
                  key={`recent-${idx}`}
                  value={rq}
                  onSelect={() => setQuery(rq)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary aria-selected:bg-navy-light aria-selected:text-text-primary"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                  <span className="text-xs">{rq}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Command.Group heading="Results">
              {results.map((r, idx) => (
                <Command.Item
                  key={`result-${idx}`}
                  value={r.label}
                  onSelect={() => handleSelect(r)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-navy-light"
                >
                  <ResultIcon type={r.type} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-text-primary">{r.label}</span>
                    <p className="truncate text-[11px] text-text-muted">{r.description}</p>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] text-text-muted">
          <span>
            <kbd className="rounded border border-border bg-navy-mid px-1 py-0.5">↑↓</kbd> navigate
            <kbd className="ml-2 rounded border border-border bg-navy-mid px-1 py-0.5">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded border border-border bg-navy-mid px-1 py-0.5">⌘J</kbd> toggle
          </span>
        </div>
      </Command>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ResultIcon({ type }: { type: NLPSearchResult['type'] }) {
  switch (type) {
    case 'symbol':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-[10px] font-bold text-accent">
          $
        </span>
      )
    case 'screener':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded bg-yellow-400/15 text-[10px] text-yellow-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </span>
      )
    case 'pattern':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded bg-trading-green/15 text-[10px] text-trading-green">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </span>
      )
    case 'action':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded bg-text-muted/15 text-[10px] text-text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      )
  }
}

const COMMON_WORDS = new Set([
  'I', 'A', 'AT', 'IN', 'ON', 'THE', 'AND', 'OR', 'FOR', 'TO', 'OF',
  'IS', 'IT', 'BY', 'IF', 'UP', 'AS', 'ME', 'MY', 'DO', 'NO', 'SO',
  'AN', 'BE', 'ALL', 'HAS', 'HAD', 'ARE', 'NOT', 'BUT', 'CAN', 'MAY',
  'RSI', 'SMA', 'EMA', 'MACD', 'PE', 'PEG', 'EPS',
  'SHOW', 'GET', 'SET', 'RUN', 'HIGH', 'LOW', 'WITH', 'NEAR',
  'FIND', 'TOP', 'CAP', 'CAPS', 'VOL',
])

function extractSymbols(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) ?? []
  return matches.filter((m) => !COMMON_WORDS.has(m) && m.length >= 2)
}
