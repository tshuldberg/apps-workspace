'use client'

import { useState, useCallback, useMemo } from 'react'
import { getIndicatorMeta } from '@marlin/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../primitives/dialog.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import type { ActiveIndicator } from './indicator-picker.js'

const LINE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
] as const

export interface IndicatorSettingsProps {
  indicator: ActiveIndicator | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (id: string, params: Record<string, unknown>, colors: string[]) => void
}

export function IndicatorSettings({
  indicator,
  open,
  onOpenChange,
  onApply,
}: IndicatorSettingsProps) {
  const meta = useMemo(
    () => (indicator ? getIndicatorMeta(indicator.name) : null),
    [indicator],
  )

  const [params, setParams] = useState<Record<string, unknown>>({})
  const [colors, setColors] = useState<string[]>([])
  const [lineStyle, setLineStyle] = useState<string>('solid')

  // Sync state when indicator changes
  const prevIdRef = useState<string | null>(null)
  if (indicator && indicator.id !== prevIdRef[0]) {
    prevIdRef[1](indicator.id)
    setParams({ ...indicator.params })
    setColors([...indicator.colors])
  }

  const handleParamChange = useCallback(
    (key: string, value: string) => {
      setParams((prev) => ({
        ...prev,
        [key]: isNaN(Number(value)) ? value : Number(value),
      }))
    },
    [],
  )

  const handleColorChange = useCallback((idx: number, value: string) => {
    setColors((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }, [])

  const handleApply = useCallback(() => {
    if (!indicator) return
    onApply(indicator.id, { ...params, lineStyle }, colors)
    onOpenChange(false)
  }, [indicator, params, colors, lineStyle, onApply, onOpenChange])

  if (!indicator || !meta) return null

  const paramEntries = Object.entries(meta.defaultParams)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.label} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Parameters */}
          {paramEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Parameters</p>
              {paramEntries.map(([key, defaultVal]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-text-secondary capitalize min-w-[80px]">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <Input
                    variant="monospace"
                    className="w-24 text-right"
                    type={typeof defaultVal === 'number' ? 'number' : 'text'}
                    value={String(params[key] ?? defaultVal)}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Colors */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Colors</p>
            {meta.outputs.map((output, idx) => (
              <div key={output} className="flex items-center justify-between gap-3">
                <label className="text-sm text-text-secondary capitalize">{output}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colors[idx] ?? meta.defaultColors[idx] ?? '#3b82f6'}
                    onChange={(e) => handleColorChange(idx, e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <span className="text-xs text-text-muted font-mono">
                    {colors[idx] ?? meta.defaultColors[idx] ?? '#3b82f6'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Line Style */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Line Style</p>
            <div className="flex gap-2">
              {LINE_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    lineStyle === style.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-secondary hover:border-border-hover'
                  }`}
                  onClick={() => setLineStyle(style.value)}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
