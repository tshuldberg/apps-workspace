'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { cn } from '../lib/utils.js'

export interface SearchResult {
  id: number
  symbol: string
  name: string
  exchange: string | null
  type: string
}

export interface CommandPaletteProps {
  /** Called when user types — should return search results */
  onSearch: (query: string) => Promise<SearchResult[]>
  /** Called when user selects a symbol */
  onSelect: (symbol: string) => void
  /** Recent symbols to show when query is empty */
  recentSymbols?: string[]
  className?: string
}

export function CommandPalette({ onSearch, onSelect, recentSymbols = [], className }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const hits = await onSearch(query)
        setResults(hits)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [query, onSearch])

  const handleSelect = useCallback(
    (symbol: string) => {
      onSelect(symbol)
      setOpen(false)
      setQuery('')
      setResults([])
    },
    [onSelect],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        role="button"
        tabIndex={-1}
      />

      <Command
        className={cn(
          'relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-navy-dark shadow-2xl',
          className,
        )}
        shouldFilter={false}
      >
        <div className="flex items-center border-b border-border px-3">
          <svg
            className="mr-2 shrink-0 text-text-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search symbols... (e.g. AAPL, Tesla)"
            className="flex h-11 w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="ml-2 hidden rounded border border-border bg-navy-mid px-1.5 py-0.5 text-[10px] text-text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-1">
          {loading && (
            <Command.Loading>
              <div className="px-3 py-2 text-xs text-text-muted">Searching...</div>
            </Command.Loading>
          )}

          <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
            {query ? 'No symbols found.' : 'Type to search symbols'}
          </Command.Empty>

          {/* Recent symbols (when no query) */}
          {!query && recentSymbols.length > 0 && (
            <Command.Group heading="Recent">
              {recentSymbols.map((sym) => (
                <Command.Item
                  key={`recent-${sym}`}
                  value={sym}
                  onSelect={() => handleSelect(sym)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary aria-selected:bg-navy-light aria-selected:text-text-primary"
                >
                  <span className="font-mono text-text-primary">{sym}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <Command.Group heading="Symbols">
              {results.map((r) => (
                <Command.Item
                  key={r.id}
                  value={r.symbol}
                  onSelect={() => handleSelect(r.symbol)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-navy-light"
                >
                  <span className="w-16 font-mono font-semibold text-text-primary">
                    {r.symbol}
                  </span>
                  <span className="flex-1 truncate text-text-secondary">{r.name}</span>
                  <span className="rounded bg-navy-mid px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
                    {r.type}
                  </span>
                  {r.exchange && (
                    <span className="text-[10px] text-text-muted">{r.exchange}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] text-text-muted">
          <span>
            <kbd className="rounded border border-border bg-navy-mid px-1 py-0.5">↑↓</kbd> navigate
            <kbd className="ml-2 rounded border border-border bg-navy-mid px-1 py-0.5">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded border border-border bg-navy-mid px-1 py-0.5">⌘K</kbd> toggle
          </span>
        </div>
      </Command>
    </div>
  )
}
