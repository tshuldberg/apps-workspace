'use client'

import { useState, useCallback } from 'react'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js'
import { cn } from '../lib/utils.js'

export interface FilterDefinition {
  field: string
  label: string
  category: 'fundamental' | 'technical' | 'price_action'
  operators: string[]
  valueType: 'number' | 'string' | 'number_range' | 'string_list'
  unit?: string
  description?: string
}

export interface ScreenerFilter {
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in'
  value: number | string | number[] | string[]
  category: 'fundamental' | 'technical' | 'price_action'
}

export interface ScreenerFilterSet {
  logic: 'AND' | 'OR'
  filters: ScreenerFilter[]
}

export interface FilterBuilderProps {
  filterDefinitions: {
    fundamental: FilterDefinition[]
    technical: FilterDefinition[]
    price_action: FilterDefinition[]
  }
  value: ScreenerFilterSet
  onChange: (filters: ScreenerFilterSet) => void
  onSave?: (name: string) => void
  className?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  fundamental: 'Fundamental',
  technical: 'Technical',
  price_action: 'Price Action',
}

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
  neq: '!=',
  between: 'Between',
  in: 'In',
}

export function FilterBuilder({
  filterDefinitions,
  value,
  onChange,
  onSave,
  className,
}: FilterBuilderProps) {
  const [saveName, setSaveName] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('fundamental')

  const allDefinitions = [
    ...filterDefinitions.fundamental,
    ...filterDefinitions.technical,
    ...filterDefinitions.price_action,
  ]

  const getDefinition = useCallback(
    (field: string) => allDefinitions.find((d) => d.field === field),
    [allDefinitions],
  )

  const addFilter = useCallback(
    (def: FilterDefinition) => {
      const defaultOp = def.operators[0] as ScreenerFilter['operator']
      const defaultValue = def.valueType === 'number' || def.valueType === 'number_range' ? 0 : ''
      const newFilter: ScreenerFilter = {
        field: def.field,
        operator: defaultOp,
        value: defaultOp === 'between' ? [0, 100] : defaultValue,
        category: def.category,
      }
      onChange({ ...value, filters: [...value.filters, newFilter] })
    },
    [value, onChange],
  )

  const removeFilter = useCallback(
    (index: number) => {
      const next = [...value.filters]
      next.splice(index, 1)
      onChange({ ...value, filters: next })
    },
    [value, onChange],
  )

  const updateFilter = useCallback(
    (index: number, patch: Partial<ScreenerFilter>) => {
      const next = [...value.filters]
      next[index] = { ...next[index]!, ...patch }
      onChange({ ...value, filters: next })
    },
    [value, onChange],
  )

  const toggleLogic = useCallback(() => {
    onChange({ ...value, logic: value.logic === 'AND' ? 'OR' : 'AND' })
  }, [value, onChange])

  const handleSave = useCallback(() => {
    if (saveName.trim() && onSave) {
      onSave(saveName.trim())
      setSaveName('')
    }
  }, [saveName, onSave])

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Logic toggle + save */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleLogic} className="h-7 px-2 text-xs font-mono">
          {value.logic}
        </Button>
        <span className="text-xs text-text-muted">
          {value.logic === 'AND' ? 'All filters must match' : 'Any filter can match'}
        </span>
        <div className="ml-auto flex gap-1">
          {onSave && (
            <>
              <Input
                placeholder="Save as..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-7 w-28 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!saveName.trim() || value.filters.length === 0}
                className="h-7 text-xs"
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Active filters */}
      {value.filters.length > 0 && (
        <div className="space-y-1.5">
          {value.filters.map((filter, i) => {
            const def = getDefinition(filter.field)
            return (
              <div
                key={`${filter.field}-${i}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-navy-mid px-2 py-1.5"
              >
                {/* Label */}
                <span className="min-w-[7rem] text-xs text-text-secondary">
                  {def?.label ?? filter.field}
                </span>

                {/* Operator */}
                <Select
                  value={filter.operator}
                  onValueChange={(op) => updateFilter(i, { operator: op as ScreenerFilter['operator'] })}
                >
                  <SelectTrigger className="h-6 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(def?.operators ?? ['gt', 'lt', 'eq']).map((op) => (
                      <SelectItem key={op} value={op} className="text-xs">
                        {OPERATOR_LABELS[op] ?? op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value */}
                {filter.operator === 'between' ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={Array.isArray(filter.value) ? (filter.value as number[])[0] : 0}
                      onChange={(e) =>
                        updateFilter(i, {
                          value: [Number(e.target.value), Array.isArray(filter.value) ? (filter.value as number[])[1]! : 100],
                        })
                      }
                      className="h-6 w-16 text-xs"
                      variant="monospace"
                    />
                    <span className="text-xs text-text-muted">-</span>
                    <Input
                      type="number"
                      value={Array.isArray(filter.value) ? (filter.value as number[])[1] : 100}
                      onChange={(e) =>
                        updateFilter(i, {
                          value: [Array.isArray(filter.value) ? (filter.value as number[])[0]! : 0, Number(e.target.value)],
                        })
                      }
                      className="h-6 w-16 text-xs"
                      variant="monospace"
                    />
                  </div>
                ) : (
                  <Input
                    type={def?.valueType === 'number' || def?.valueType === 'number_range' ? 'number' : 'text'}
                    value={typeof filter.value === 'object' ? (filter.value as string[]).join(', ') : String(filter.value)}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (def?.valueType === 'number' || def?.valueType === 'number_range') {
                        updateFilter(i, { value: Number(raw) })
                      } else if (filter.operator === 'in') {
                        updateFilter(i, { value: raw.split(',').map((s) => s.trim()) })
                      } else {
                        updateFilter(i, { value: raw })
                      }
                    }}
                    className="h-6 w-24 text-xs"
                    variant="monospace"
                  />
                )}

                {/* Unit */}
                {def?.unit && (
                  <span className="text-[10px] text-text-muted">{def.unit}</span>
                )}

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(i)}
                  className="ml-auto h-5 w-5 p-0 text-text-muted hover:text-trading-red"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter picker (accordion by category) */}
      <div className="space-y-1">
        {Object.entries(filterDefinitions).map(([category, defs]) => (
          <div key={category} className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold',
                'text-text-secondary hover:bg-navy-light',
                expandedCategory === category && 'bg-navy-mid text-text-primary',
              )}
            >
              <span>{CATEGORY_LABELS[category] ?? category}</span>
              <span className="text-text-muted">
                {expandedCategory === category ? '\u25B2' : '\u25BC'}
              </span>
            </button>

            {expandedCategory === category && (
              <div className="border-t border-border p-1.5">
                <div className="flex flex-wrap gap-1">
                  {(defs as FilterDefinition[]).map((def) => {
                    const isActive = value.filters.some((f) => f.field === def.field)
                    return (
                      <button
                        key={def.field}
                        type="button"
                        onClick={() => addFilter(def)}
                        disabled={isActive}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                          isActive
                            ? 'border-accent/50 bg-accent/10 text-accent cursor-default'
                            : 'border-border text-text-muted hover:border-accent hover:text-text-primary',
                        )}
                        title={def.description}
                      >
                        {def.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
