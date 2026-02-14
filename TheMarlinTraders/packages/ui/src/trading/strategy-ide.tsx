'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import type {
  StrategyTemplate,
  StrategyFile,
  StrategyParameter,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
} from '@marlin/shared'

// ── Types ──────────────────────────────────────────────────────────────────

export interface StrategyTab {
  id: string
  name: string
  language: 'typescript' | 'python' | 'pine'
  code: string
  parameters: StrategyParameter[]
  isDirty: boolean
}

export interface StrategyIDEProps {
  /** Currently open tabs */
  tabs: StrategyTab[]
  /** Active tab id */
  activeTabId: string | null
  /** Backtest result for the active strategy (if available) */
  backtestResult: BacktestResult | null
  /** Whether a backtest is currently running */
  isRunning: boolean
  /** Available templates */
  templates: StrategyTemplate[]
  /** Callbacks */
  onTabChange: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onCodeChange: (tabId: string, code: string) => void
  onParameterChange: (tabId: string, paramName: string, value: number | string | boolean) => void
  onRunBacktest: () => void
  onSave: () => void
  onLoadTemplate: (template: StrategyTemplate) => void
  /** Validation errors */
  validationErrors?: { line: number; message: string }[]
  className?: string
}

// ── Color constants (matching app dark theme) ──────────────────────────────

const GREEN = '#22c55e'
const RED = '#ef4444'
const ACCENT = '#3b82f6'
const GRID_COLOR = '#1e293b'
const LABEL_COLOR = '#64748b'
const TEXT_PRIMARY = '#f1f5f9'

// ── Code Editor ────────────────────────────────────────────────────────────
// Uses a <textarea> with syntax-highlighting overlay
// In production, replace with @monaco-editor/react for full IDE experience

function CodeEditor({
  code,
  language,
  onChange,
  errors,
}: {
  code: string
  language: string
  onChange: (code: string) => void
  errors?: { line: number; message: string }[]
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [lineCount, setLineCount] = useState(1)

  useEffect(() => {
    setLineCount(code.split('\n').length)
  }, [code])

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const errorLines = useMemo(() => {
    const set = new Set<number>()
    for (const e of errors ?? []) set.add(e.line)
    return set
  }, [errors])

  return (
    <div className="relative flex h-full overflow-hidden bg-[#0a0a1a] font-mono text-sm">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none overflow-hidden border-r border-border bg-[#0d0d1f] px-3 py-3 text-right text-text-muted"
        style={{ width: '3.5rem' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i + 1}
            className={cn(
              'leading-6 text-[11px]',
              errorLines.has(i + 1) && 'text-trading-red font-bold',
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code input */}
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-3 leading-6 text-text-primary outline-none caret-accent placeholder:text-text-muted"
        placeholder={`// Write your ${language} strategy here...\n// Define onBar(bar, indicators, context) to get started`}
        style={{ tabSize: 2 }}
      />

      {/* Error markers in the gutter */}
      {errors && errors.length > 0 && (
        <div className="absolute bottom-0 right-0 max-h-32 w-full overflow-y-auto border-t border-trading-red/30 bg-trading-red/5 p-2">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-trading-red">
              <span className="shrink-0 font-mono tabular-nums">L{err.line}:</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Parameter Inputs ───────────────────────────────────────────────────────

function ParameterInputs({
  parameters,
  onParameterChange,
}: {
  parameters: StrategyParameter[]
  onParameterChange: (name: string, value: number | string | boolean) => void
}) {
  if (parameters.length === 0) return null

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border bg-navy-dark px-4 py-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        Parameters
      </span>
      {parameters.map((param) => (
        <div key={param.name} className="flex flex-col gap-0.5">
          <label className="text-[10px] text-text-muted">{param.description ?? param.name}</label>
          {param.type === 'boolean' ? (
            <button
              className={cn(
                'h-7 rounded border border-border px-3 text-xs transition-colors',
                param.default === true
                  ? 'bg-accent/20 text-accent'
                  : 'bg-navy-mid text-text-secondary',
              )}
              onClick={() => onParameterChange(param.name, !param.default)}
            >
              {String(param.default)}
            </button>
          ) : param.type === 'number' ? (
            <input
              type="number"
              value={param.default as number}
              min={param.min}
              max={param.max}
              step={param.min !== undefined && param.max !== undefined
                ? (param.max - param.min) > 10 ? 1 : 0.1
                : 1
              }
              onChange={(e) => onParameterChange(param.name, parseFloat(e.target.value) || 0)}
              className="h-7 w-24 rounded border border-border bg-navy-mid px-2 font-mono text-xs tabular-nums text-text-primary outline-none focus:border-accent"
            />
          ) : (
            <input
              type="text"
              value={param.default as string}
              onChange={(e) => onParameterChange(param.name, e.target.value)}
              className="h-7 w-32 rounded border border-border bg-navy-mid px-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Equity Curve Chart ─────────────────────────────────────────────────────

function EquityCurveChart({ equity }: { equity: EquityPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 140 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || equity.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 10, right: 50, bottom: 20, left: 10 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    const values = equity.map((p) => p.equity)
    const yMin = Math.min(...values)
    const yMax = Math.max(...values)
    const ySpan = yMax - yMin || 1

    const xToPixel = (i: number) => pad.left + (i / (equity.length - 1 || 1)) * plotW
    const yToPixel = (v: number) => pad.top + plotH - ((v - yMin) / ySpan) * plotH

    // Grid
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * plotH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()

      const val = yMax - (i / 3) * ySpan
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`$${val.toFixed(0)}`, w - pad.right + 4, y + 3)
    }

    // Fill under curve
    ctx.beginPath()
    ctx.moveTo(xToPixel(0), yToPixel(equity[0]!.equity))
    for (let i = 1; i < equity.length; i++) {
      ctx.lineTo(xToPixel(i), yToPixel(equity[i]!.equity))
    }
    ctx.lineTo(xToPixel(equity.length - 1), pad.top + plotH)
    ctx.lineTo(xToPixel(0), pad.top + plotH)
    ctx.closePath()

    const lastEquity = equity[equity.length - 1]!.equity
    const firstEquity = equity[0]!.equity
    const isProfit = lastEquity >= firstEquity
    ctx.fillStyle = isProfit ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = isProfit ? GREEN : RED
    ctx.lineWidth = 1.5
    for (let i = 0; i < equity.length; i++) {
      const x = xToPixel(i)
      const y = yToPixel(equity[i]!.equity)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }, [equity, dims])

  if (equity.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Run a backtest to see the equity curve
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ── Metrics Panel ──────────────────────────────────────────────────────────

function MetricsPanel({ metrics }: { metrics: BacktestResult['metrics'] }) {
  const rows: { label: string; value: string; color?: string }[] = [
    {
      label: 'Total Return',
      value: `${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn.toFixed(2)}%`,
      color: metrics.totalReturn >= 0 ? GREEN : RED,
    },
    { label: 'Sharpe Ratio', value: metrics.sharpe.toFixed(2) },
    { label: 'Sortino Ratio', value: metrics.sortino.toFixed(2) },
    {
      label: 'Max Drawdown',
      value: `${metrics.maxDrawdown.toFixed(2)}%`,
      color: RED,
    },
    {
      label: 'Win Rate',
      value: `${(metrics.winRate * 100).toFixed(1)}%`,
      color: metrics.winRate >= 0.5 ? GREEN : RED,
    },
    { label: 'Profit Factor', value: metrics.profitFactor.toFixed(2) },
    { label: 'Total Trades', value: String(metrics.totalTrades) },
    {
      label: 'Avg Win',
      value: `$${metrics.avgWin.toFixed(2)}`,
      color: GREEN,
    },
    {
      label: 'Avg Loss',
      value: `-$${Math.abs(metrics.avgLoss).toFixed(2)}`,
      color: RED,
    },
    { label: 'Expectancy', value: `$${metrics.expectancy.toFixed(2)}` },
  ]

  return (
    <div className="space-y-1.5 px-3 py-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between text-xs">
          <span className="text-text-muted">{row.label}</span>
          <span
            className="font-mono tabular-nums"
            style={{ color: row.color ?? TEXT_PRIMARY }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Trade List ─────────────────────────────────────────────────────────────

function TradeList({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No trades
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
            <th className="px-2 py-1.5">Entry</th>
            <th className="px-2 py-1.5">Exit</th>
            <th className="px-2 py-1.5">Side</th>
            <th className="px-2 py-1.5 text-right">Entry $</th>
            <th className="px-2 py-1.5 text-right">Exit $</th>
            <th className="px-2 py-1.5 text-right">Qty</th>
            <th className="px-2 py-1.5 text-right">P&L</th>
            <th className="px-2 py-1.5 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-border/50 hover:bg-navy-mid/30">
              <td className="px-2 py-1 font-mono tabular-nums text-text-secondary">
                {trade.entryDate.slice(5, 10)}
              </td>
              <td className="px-2 py-1 font-mono tabular-nums text-text-secondary">
                {trade.exitDate.slice(5, 10)}
              </td>
              <td className="px-2 py-1">
                <span
                  className={cn(
                    'rounded px-1 py-0.5 text-[10px] font-medium uppercase',
                    trade.side === 'long'
                      ? 'bg-trading-green/10 text-trading-green'
                      : 'bg-trading-red/10 text-trading-red',
                  )}
                >
                  {trade.side}
                </span>
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-text-primary">
                {trade.entryPrice.toFixed(2)}
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-text-primary">
                {trade.exitPrice.toFixed(2)}
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-text-secondary">
                {trade.quantity}
              </td>
              <td
                className="px-2 py-1 text-right font-mono tabular-nums"
                style={{ color: trade.pnl >= 0 ? GREEN : RED }}
              >
                {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
              </td>
              <td
                className="px-2 py-1 text-right font-mono tabular-nums"
                style={{ color: trade.pnlPercent >= 0 ? GREEN : RED }}
              >
                {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Results Panel ──────────────────────────────────────────────────────────

type ResultsView = 'metrics' | 'equity' | 'trades'

function ResultsPanel({
  result,
  isRunning,
}: {
  result: BacktestResult | null
  isRunning: boolean
}) {
  const [view, setView] = useState<ResultsView>('metrics')

  const views: { value: ResultsView; label: string }[] = [
    { value: 'metrics', label: 'Metrics' },
    { value: 'equity', label: 'Equity' },
    { value: 'trades', label: 'Trades' },
  ]

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        Running backtest...
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <span className="text-sm text-text-muted">No Results Yet</span>
        <span className="text-xs text-text-muted/60">
          Write a strategy and click Run Backtest to see performance metrics, equity curve, and trade list
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* View tabs */}
      <div className="flex shrink-0 border-b border-border">
        {views.map((v) => (
          <button
            key={v.value}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              view === v.value
                ? 'border-b-2 border-accent text-text-primary'
                : 'text-text-muted hover:text-text-primary',
            )}
            onClick={() => setView(v.value)}
          >
            {v.label}
            {v.value === 'trades' && ` (${result.trades.length})`}
          </button>
        ))}
      </div>

      {/* View content */}
      <div className="flex-1 overflow-auto">
        {view === 'metrics' && <MetricsPanel metrics={result.metrics} />}
        {view === 'equity' && (
          <div className="h-48 p-2">
            <EquityCurveChart equity={result.equity} />
          </div>
        )}
        {view === 'trades' && <TradeList trades={result.trades} />}
      </div>
    </div>
  )
}

// ── Template Picker ────────────────────────────────────────────────────────

function TemplatePicker({
  templates,
  isOpen,
  onClose,
  onSelect,
}: {
  templates: StrategyTemplate[]
  isOpen: boolean
  onClose: () => void
  onSelect: (template: StrategyTemplate) => void
}) {
  if (!isOpen) return null

  const categoryLabels: Record<string, string> = {
    trend: 'Trend Following',
    'mean-reversion': 'Mean Reversion',
    breakout: 'Breakout',
    momentum: 'Momentum',
    volatility: 'Volatility',
  }

  const categoryColors: Record<string, string> = {
    trend: 'bg-blue-500/20 text-blue-400',
    'mean-reversion': 'bg-purple-500/20 text-purple-400',
    breakout: 'bg-amber-500/20 text-amber-400',
    momentum: 'bg-green-500/20 text-green-400',
    volatility: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-2xl rounded-lg border border-border bg-navy-dark shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Strategy Templates</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Start from a proven template and customize it to your needs
            </p>
          </div>
          <button
            className="rounded p-1 text-text-muted hover:bg-navy-mid hover:text-text-primary"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-4">
          <div className="space-y-2">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                className="w-full rounded-lg border border-border bg-navy-mid/30 p-4 text-left transition-colors hover:border-accent/40 hover:bg-navy-mid/60"
                onClick={() => {
                  onSelect(tmpl)
                  onClose()
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{tmpl.name}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          categoryColors[tmpl.category] ?? 'bg-navy-mid text-text-muted',
                        )}
                      >
                        {categoryLabels[tmpl.category] ?? tmpl.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{tmpl.description}</p>
                  </div>
                  <span className="shrink-0 rounded bg-navy-mid px-2 py-0.5 text-[10px] font-mono text-text-muted">
                    {tmpl.language}
                  </span>
                </div>
                {tmpl.parameters.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tmpl.parameters.map((p) => (
                      <span
                        key={p.name}
                        className="rounded bg-navy-dark px-1.5 py-0.5 text-[10px] text-text-muted"
                      >
                        {p.name}: {String(p.default)}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Strategy IDE ──────────────────────────────────────────────────────

export function StrategyIDE({
  tabs,
  activeTabId,
  backtestResult,
  isRunning,
  templates,
  onTabChange,
  onTabClose,
  onCodeChange,
  onParameterChange,
  onRunBacktest,
  onSave,
  onLoadTemplate,
  validationErrors,
  className,
}: StrategyIDEProps) {
  const [showTemplates, setShowTemplates] = useState(false)

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  )

  return (
    <div className={cn('flex h-full flex-col bg-navy-black', className)}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
              isRunning
                ? 'cursor-not-allowed bg-accent/30 text-accent/60'
                : 'bg-accent text-white hover:bg-accent/90',
            )}
            onClick={onRunBacktest}
            disabled={isRunning || !activeTab}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2L10 6L3 10V2Z" fill="currentColor" />
            </svg>
            {isRunning ? 'Running...' : 'Run Backtest'}
          </button>

          <button
            className="rounded px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary"
            onClick={onSave}
            disabled={!activeTab}
          >
            Save
          </button>

          <div className="h-4 w-px bg-border" />

          <button
            className="rounded px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary"
            onClick={() => setShowTemplates(true)}
          >
            Load Template
          </button>
        </div>

        {activeTab && (
          <span className="rounded bg-navy-mid px-2 py-0.5 text-[10px] font-mono text-text-muted">
            {activeTab.language}
          </span>
        )}
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex shrink-0 gap-px overflow-x-auto border-b border-border bg-navy-dark">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-4 py-2 text-xs transition-colors',
                tab.id === activeTabId
                  ? 'bg-navy-black text-text-primary'
                  : 'bg-navy-dark text-text-muted hover:bg-navy-mid/50 hover:text-text-primary',
              )}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="max-w-[120px] truncate">
                {tab.name}
                {tab.isDirty && <span className="ml-1 text-accent">*</span>}
              </span>
              <button
                className="rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-navy-mid hover:text-text-primary group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main content: editor + results split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel (60%) */}
        <div className="flex w-[60%] flex-col border-r border-border">
          {activeTab ? (
            <>
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  code={activeTab.code}
                  language={activeTab.language}
                  onChange={(code) => onCodeChange(activeTab.id, code)}
                  errors={validationErrors}
                />
              </div>
              <ParameterInputs
                parameters={activeTab.parameters}
                onParameterChange={(name, value) => onParameterChange(activeTab.id, name, value)}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-sm text-text-muted">No strategy open</span>
              <button
                className="text-xs text-accent hover:underline"
                onClick={() => setShowTemplates(true)}
              >
                Start from a template
              </button>
            </div>
          )}
        </div>

        {/* Results panel (40%) */}
        <div className="w-[40%]">
          <ResultsPanel result={backtestResult} isRunning={isRunning} />
        </div>
      </div>

      {/* Template picker modal */}
      <TemplatePicker
        templates={templates}
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={onLoadTemplate}
      />
    </div>
  )
}
