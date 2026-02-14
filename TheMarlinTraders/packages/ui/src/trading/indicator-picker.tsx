'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  getAllIndicatorMetas,
  type IndicatorMeta,
  type IndicatorCategory,
} from '@marlin/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../primitives/dialog.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs.js'
import { cn } from '../lib/utils.js'

const CATEGORIES: { value: IndicatorCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trend', label: 'Trend' },
  { value: 'momentum', label: 'Momentum' },
  { value: 'volume', label: 'Volume' },
  { value: 'volatility', label: 'Volatility' },
  { value: 'complex', label: 'Complex' },
]

export interface ActiveIndicator {
  id: string
  name: string
  params: Record<string, unknown>
  colors: string[]
}

export interface IndicatorPickerProps {
  activeIndicators: ActiveIndicator[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  onSettings: (indicator: ActiveIndicator) => void
}

export function IndicatorPicker({
  activeIndicators,
  onAdd,
  onRemove,
  onSettings,
}: IndicatorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<IndicatorCategory | 'all'>('all')

  const allMetas = useMemo(() => getAllIndicatorMetas(), [])

  const filtered = useMemo(() => {
    let items = allMetas
    if (category !== 'all') {
      items = items.filter((m) => m.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (m) => m.label.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      )
    }
    return items
  }, [allMetas, category, search])

  const handleAdd = useCallback(
    (meta: IndicatorMeta) => {
      onAdd(meta.name)
    },
    [onAdd],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          Indicators
          {activeIndicators.length > 0 && (
            <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-text-primary">
              {activeIndicators.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Indicators</DialogTitle>
        </DialogHeader>

        {/* Active indicators */}
        {activeIndicators.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
            {activeIndicators.map((ind) => {
              const meta = allMetas.find((m) => m.name === ind.name)
              return (
                <div
                  key={ind.id}
                  className="flex items-center gap-1 rounded-md border border-border bg-navy-mid px-2 py-1 text-xs text-text-secondary"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ind.colors[0] ?? '#3b82f6' }}
                  />
                  <button
                    type="button"
                    className="hover:text-text-primary transition-colors"
                    onClick={() => onSettings(ind)}
                  >
                    {meta?.label ?? ind.name}
                  </button>
                  <button
                    type="button"
                    className="ml-1 text-text-muted hover:text-trading-red transition-colors"
                    onClick={() => onRemove(ind.id)}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Search */}
        <Input
          placeholder="Search indicators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        {/* Category tabs */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as IndicatorCategory | 'all')}>
          <TabsList className="w-full">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="flex-1 text-xs">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-2 max-h-64 overflow-y-auto">
              <div className="space-y-0.5">
                {filtered.map((meta) => (
                  <button
                    key={meta.name}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                      'text-text-secondary hover:bg-navy-light hover:text-text-primary',
                    )}
                    onClick={() => handleAdd(meta)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.defaultColors[0] ?? '#3b82f6' }}
                      />
                      <span>{meta.label}</span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {meta.display === 'overlay' ? 'overlay' : 'panel'}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="py-4 text-center text-sm text-text-muted">No indicators found</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
