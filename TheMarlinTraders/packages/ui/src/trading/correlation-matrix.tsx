'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationMatrixData {
  symbols: string[]
  /** Row-major 2D array: matrix[i][j] = correlation between symbols[i] and symbols[j] */
  matrix: number[][]
  period: string
}

export type CorrelationPreset = 'major-forex' | 'crypto-top-10' | 'cross-asset' | 'custom'

export interface CorrelationMatrixProps {
  data: CorrelationMatrixData
  preset?: CorrelationPreset
  onPresetChange?: (preset: CorrelationPreset) => void
  onCellClick?: (symbolA: string, symbolB: string, coefficient: number) => void
  onAddSymbol?: (symbol: string) => void
  onRemoveSymbol?: (symbol: string) => void
  isLoading?: boolean
  className?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const PRESETS: { value: CorrelationPreset; label: string }[] = [
  { value: 'major-forex', label: 'Major Forex' },
  { value: 'crypto-top-10', label: 'Crypto Top 10' },
  { value: 'cross-asset', label: 'Cross-Asset' },
  { value: 'custom', label: 'Custom' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a correlation coefficient (-1 to +1) to a CSS background color.
 * -1 = red, 0 = neutral gray, +1 = green
 */
function getCorrelationColor(r: number): string {
  if (isNaN(r)) return 'bg-navy-black'

  const clamped = Math.max(-1, Math.min(1, r))

  if (clamped > 0.8) return 'bg-trading-green/80'
  if (clamped > 0.6) return 'bg-trading-green/50'
  if (clamped > 0.3) return 'bg-trading-green/25'
  if (clamped > 0.1) return 'bg-trading-green/10'
  if (clamped > -0.1) return 'bg-navy-black'
  if (clamped > -0.3) return 'bg-trading-red/10'
  if (clamped > -0.6) return 'bg-trading-red/25'
  if (clamped > -0.8) return 'bg-trading-red/50'
  return 'bg-trading-red/80'
}

function getCorrelationTextColor(r: number): string {
  if (isNaN(r)) return 'text-text-muted'

  const abs = Math.abs(r)
  if (abs > 0.6) return 'text-text-primary font-semibold'
  if (abs > 0.3) return 'text-text-secondary'
  return 'text-text-muted'
}

function correlationLabel(r: number): string {
  if (isNaN(r)) return 'N/A'
  const abs = Math.abs(r)
  if (abs >= 0.8) return r > 0 ? 'Strong +' : 'Strong -'
  if (abs >= 0.5) return r > 0 ? 'Moderate +' : 'Moderate -'
  if (abs >= 0.3) return r > 0 ? 'Weak +' : 'Weak -'
  return 'None'
}

// ── Component ───────────────────────────────────────────────────────────────

export function CorrelationMatrix({
  data,
  preset = 'major-forex',
  onPresetChange,
  onCellClick,
  onAddSymbol,
  onRemoveSymbol,
  isLoading = false,
  className,
}: CorrelationMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [addSymbolInput, setAddSymbolInput] = useState('')

  const { symbols, matrix } = data

  const handleAddSymbol = useCallback(() => {
    const sym = addSymbolInput.trim().toUpperCase()
    if (sym && onAddSymbol) {
      onAddSymbol(sym)
      setAddSymbolInput('')
    }
  }, [addSymbolInput, onAddSymbol])

  const hoveredValue = useMemo(() => {
    if (!hoveredCell) return null
    const value = matrix[hoveredCell.row]?.[hoveredCell.col]
    if (value === undefined || isNaN(value)) return null
    return {
      symbolA: symbols[hoveredCell.row]!,
      symbolB: symbols[hoveredCell.col]!,
      coefficient: value,
    }
  }, [hoveredCell, matrix, symbols])

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Correlation Matrix
          </h3>
          <span className="font-mono text-[10px] text-text-muted">
            Period: {data.period}
          </span>
        </div>

        {/* Preset selector */}
        <div className="flex gap-0 rounded border border-border">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPresetChange?.(p.value)}
              className={cn(
                'px-2 py-1 text-[10px] font-medium transition-colors',
                preset === p.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredValue && (
        <div className="border-b border-border bg-navy-black/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-text-primary">
              {hoveredValue.symbolA} / {hoveredValue.symbolB}
            </span>
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                hoveredValue.coefficient > 0
                  ? 'text-trading-green'
                  : hoveredValue.coefficient < 0
                    ? 'text-trading-red'
                    : 'text-text-muted',
              )}
            >
              {hoveredValue.coefficient.toFixed(4)}
            </span>
            <span className="text-[10px] text-text-muted">
              {correlationLabel(hoveredValue.coefficient)}
            </span>
          </div>
        </div>
      )}

      {/* Matrix grid */}
      <div className="overflow-x-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-text-muted">Computing correlations...</span>
          </div>
        ) : (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-0" />
                {symbols.map((sym, colIdx) => (
                  <th
                    key={sym}
                    className={cn(
                      'px-1 py-1.5 text-center',
                      hoveredCell?.col === colIdx && 'bg-accent/10',
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-[10px] font-semibold text-text-primary">
                        {sym.length > 6 ? sym.slice(0, 6) : sym}
                      </span>
                      {onRemoveSymbol && (
                        <button
                          type="button"
                          onClick={() => onRemoveSymbol(sym)}
                          className="text-[8px] text-text-muted hover:text-trading-red"
                        >
                          x
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((rowSym, rowIdx) => (
                <tr key={rowSym}>
                  <td
                    className={cn(
                      'px-2 py-1 text-right',
                      hoveredCell?.row === rowIdx && 'bg-accent/10',
                    )}
                  >
                    <span className="font-mono text-[10px] font-semibold text-text-primary">
                      {rowSym.length > 6 ? rowSym.slice(0, 6) : rowSym}
                    </span>
                  </td>
                  {symbols.map((_, colIdx) => {
                    const value = matrix[rowIdx]?.[colIdx] ?? NaN
                    const isSelf = rowIdx === colIdx
                    const isHovered =
                      hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx

                    return (
                      <td
                        key={`${rowIdx}-${colIdx}`}
                        className={cn(
                          'cursor-pointer border border-border/30 p-0 transition-all',
                          getCorrelationColor(value),
                          isHovered && 'ring-1 ring-accent',
                        )}
                        style={{ width: 44, height: 36 }}
                        onMouseEnter={() =>
                          setHoveredCell({ row: rowIdx, col: colIdx })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => {
                          if (!isSelf) {
                            onCellClick?.(
                              symbols[rowIdx]!,
                              symbols[colIdx]!,
                              value,
                            )
                          }
                        }}
                      >
                        <div className="flex h-full items-center justify-center">
                          <span
                            className={cn(
                              'font-mono text-[10px] tabular-nums',
                              isSelf
                                ? 'text-text-muted/50'
                                : getCorrelationTextColor(value),
                            )}
                          >
                            {isSelf ? '1.00' : isNaN(value) ? '--' : value.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add symbol bar */}
      {onAddSymbol && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2">
          <input
            type="text"
            value={addSymbolInput}
            onChange={(e) => setAddSymbolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSymbol()
            }}
            placeholder="Add symbol..."
            className="w-28 rounded border border-border bg-navy-black px-2 py-1 font-mono text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddSymbol}
            className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-text-primary transition-colors hover:bg-accent/80"
          >
            Add
          </button>
        </div>
      )}

      {/* Color legend */}
      <div className="flex items-center justify-center gap-1 border-t border-border px-4 py-2">
        <span className="text-[9px] text-text-muted">-1.0</span>
        <div className="flex gap-0.5">
          <div className="h-2 w-4 rounded-sm bg-trading-red/80" />
          <div className="h-2 w-4 rounded-sm bg-trading-red/50" />
          <div className="h-2 w-4 rounded-sm bg-trading-red/25" />
          <div className="h-2 w-4 rounded-sm bg-navy-black" />
          <div className="h-2 w-4 rounded-sm bg-trading-green/25" />
          <div className="h-2 w-4 rounded-sm bg-trading-green/50" />
          <div className="h-2 w-4 rounded-sm bg-trading-green/80" />
        </div>
        <span className="text-[9px] text-text-muted">+1.0</span>
      </div>
    </div>
  )
}
