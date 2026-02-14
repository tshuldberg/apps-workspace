'use client'

import { useState, useCallback } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Input } from '@marlin/ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@marlin/ui/primitives/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@marlin/ui/primitives/tabs'
import { FilterBuilder } from '@marlin/ui/trading/filter-builder'
import { ScreenerResults } from '@marlin/ui/trading/screener-results'
import type { ScreenerFilterSet, FilterDefinition } from '@marlin/ui/trading/filter-builder'
import type { ScreenerResultRow } from '@marlin/ui/trading/screener-results'
import { cn } from '@marlin/ui/lib/utils'

export interface ScreenerTemplate {
  id: string
  name: string
  description: string
  category: string
  filters: ScreenerFilterSet
}

export interface SavedScreener {
  id: string
  name: string
  filters: ScreenerFilterSet
  createdAt: string
}

export interface ScreenerPanelProps {
  filterDefinitions: {
    fundamental: FilterDefinition[]
    technical: FilterDefinition[]
    price_action: FilterDefinition[]
  }
  templates: ScreenerTemplate[]
  savedScreeners: SavedScreener[]
  results: ScreenerResultRow[]
  total: number
  isDelayed: boolean
  executionMs: number
  isLoading: boolean
  onScan: (filters: ScreenerFilterSet, page: number, sortBy: string, sortDir: 'asc' | 'desc') => void
  onSave: (name: string, filters: ScreenerFilterSet) => void
  onDeleteSaved: (id: string) => void
  onRowClick?: (symbol: string) => void
  onAddToWatchlist?: (symbol: string) => void
  className?: string
}

const PAGE_SIZE = 50

export function ScreenerPanel({
  filterDefinitions,
  templates,
  savedScreeners,
  results,
  total,
  isDelayed,
  executionMs,
  isLoading,
  onScan,
  onSave,
  onDeleteSaved,
  onRowClick,
  onAddToWatchlist,
  className,
}: ScreenerPanelProps) {
  const [filters, setFilters] = useState<ScreenerFilterSet>({ logic: 'AND', filters: [] })
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('symbol')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [templateSearch, setTemplateSearch] = useState('')

  const handleScan = useCallback(() => {
    if (filters.filters.length > 0) {
      setPage(0)
      onScan(filters, 0, sortBy, sortDir)
    }
  }, [filters, sortBy, sortDir, onScan])

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      onScan(filters, newPage, sortBy, sortDir)
    },
    [filters, sortBy, sortDir, onScan],
  )

  const handleSortChange = useCallback(
    (column: string) => {
      const newDir = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc'
      setSortBy(column)
      setSortDir(newDir)
      setPage(0)
      if (filters.filters.length > 0) {
        onScan(filters, 0, column, newDir)
      }
    },
    [sortBy, sortDir, filters, onScan],
  )

  const handleSave = useCallback(
    (name: string) => {
      onSave(name, filters)
    },
    [filters, onSave],
  )

  const loadTemplate = useCallback(
    (template: ScreenerTemplate) => {
      setFilters(template.filters)
      setPage(0)
      onScan(template.filters, 0, sortBy, sortDir)
    },
    [sortBy, sortDir, onScan],
  )

  const loadSaved = useCallback(
    (screener: SavedScreener) => {
      setFilters(screener.filters)
      setPage(0)
      onScan(screener.filters, 0, sortBy, sortDir)
    },
    [sortBy, sortDir, onScan],
  )

  const filteredTemplates = templates.filter(
    (t) =>
      !templateSearch.trim() ||
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase()),
  )

  // Group templates by category
  const templatesByCategory: Record<string, ScreenerTemplate[]> = {}
  for (const t of filteredTemplates) {
    if (!templatesByCategory[t.category]) templatesByCategory[t.category] = []
    templatesByCategory[t.category]!.push(t)
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left sidebar — filter builder */}
      <div className="flex w-72 flex-col border-r border-border bg-navy-dark">
        <Tabs defaultValue="filters" className="flex flex-1 flex-col">
          <TabsList className="mx-2 mt-2">
            <TabsTrigger value="filters" className="text-xs">Filters</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
            <TabsTrigger value="saved" className="text-xs">Saved</TabsTrigger>
          </TabsList>

          {/* Filters tab */}
          <TabsContent value="filters" className="flex-1 overflow-y-auto p-2">
            <FilterBuilder
              filterDefinitions={filterDefinitions}
              value={filters}
              onChange={setFilters}
              onSave={handleSave}
            />
            <Button
              variant="default"
              size="sm"
              className="mt-3 w-full"
              onClick={handleScan}
              disabled={filters.filters.length === 0 || isLoading}
            >
              {isLoading ? 'Scanning...' : 'Run Scan'}
            </Button>
          </TabsContent>

          {/* Templates tab */}
          <TabsContent value="templates" className="flex-1 overflow-y-auto p-2">
            <Input
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="mb-2"
            />
            {Object.entries(templatesByCategory).map(([category, catTemplates]) => (
              <div key={category} className="mb-3">
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {category}
                </h4>
                <div className="space-y-1">
                  {catTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:bg-navy-light"
                    >
                      <div className="text-xs font-medium text-text-primary">{t.name}</div>
                      <div className="text-[10px] text-text-muted">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Saved tab */}
          <TabsContent value="saved" className="flex-1 overflow-y-auto p-2">
            {savedScreeners.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-muted">No saved screeners yet</p>
            ) : (
              <div className="space-y-1">
                {savedScreeners.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 hover:bg-navy-light"
                  >
                    <button
                      type="button"
                      onClick={() => loadSaved(s)}
                      className="flex-1 text-left"
                    >
                      <div className="text-xs font-medium text-text-primary">{s.name}</div>
                      <div className="text-[10px] text-text-muted">
                        {s.filters.filters.length} filters
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-text-muted hover:text-trading-red"
                      onClick={() => onDeleteSaved(s.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Right area — results */}
      <div className="flex flex-1 flex-col">
        <ScreenerResults
          results={results}
          total={total}
          isDelayed={isDelayed}
          executionMs={executionMs}
          appliedFilters={filters.filters.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onRowClick={onRowClick}
          onAddToWatchlist={onAddToWatchlist}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          isLoading={isLoading}
          className="flex-1"
        />
      </div>
    </div>
  )
}
