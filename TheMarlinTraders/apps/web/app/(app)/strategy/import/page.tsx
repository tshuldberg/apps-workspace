'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@marlin/ui/lib/utils'

// ── Sample Pine Script (pre-filled for demo) ────────────────────────────────

const SAMPLE_PINE_SCRIPT = `//@version=5
strategy("MA Crossover", overlay=true, default_qty_value=100)

// Inputs
fastLen = input.int(10, "Fast MA Length", minval=1)
slowLen = input.int(30, "Slow MA Length", minval=1)
useEMA  = input.bool(false, "Use EMA instead of SMA")

// Calculate moving averages
fastMA = useEMA ? ta.ema(close, fastLen) : ta.sma(close, fastLen)
slowMA = useEMA ? ta.ema(close, slowLen) : ta.sma(close, slowLen)

// Entry conditions
longCondition  = ta.crossover(fastMA, slowMA)
shortCondition = ta.crossunder(fastMA, slowMA)

// Entries
if longCondition
    strategy.entry("Long", strategy.long)

if shortCondition
    strategy.close("Long")

// Plotting
plot(fastMA, "Fast MA", color=color.blue)
plot(slowMA, "Slow MA", color=color.red)
plotshape(longCondition, "Buy", shape.triangleup, location.belowbar, color.green)
plotshape(shortCondition, "Sell", shape.triangledown, location.abovebar, color.red)
`

// ── TranspileResult type (matches API service) ──────────────────────────────

interface TranspileWarning {
  line: number
  column: number
  message: string
  severity: 'info' | 'warning' | 'error'
  originalCode: string
}

interface TranspileResult {
  code: string
  warnings: TranspileWarning[]
  compatibility: number
}

// ── Client-side transpiler shim ─────────────────────────────────────────────
// In production, this calls the tRPC endpoint.
// For now, we inline a minimal client-side version to demonstrate the flow.

function clientTranspile(pineCode: string): TranspileResult {
  const lines = pineCode.split('\n')
  const output: string[] = []
  const warnings: TranspileWarning[] = []
  let success = 0
  let total = 0

  output.push('// Auto-generated from Pine Script v5')
  output.push('// Transpiled by TheMarlinTraders Pine Transpiler')
  output.push('')
  output.push('function _nz(value: number, replacement: number = 0): number {')
  output.push('  return Number.isNaN(value) || value === undefined ? replacement : value')
  output.push('}')
  output.push('')
  output.push('export function onBar(bar: Bar, indicators: Indicators, context: Context) {')

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('//@version')) continue
    total++

    // Strategy declaration
    if (trimmed.startsWith('strategy(') || trimmed.startsWith('indicator(')) {
      success++
      continue
    }

    // Input declarations
    if (/^\w+\s*=\s*input(\.\w+)?\s*\(/.test(trimmed)) {
      const match = trimmed.match(/^(\w+)\s*=\s*input\.\w+\s*\(([^,)]+)/)
      if (match) {
        output.push(`  const ${match[1]} = ${match[2]!.trim()}`)
        success++
      }
      continue
    }

    // Plot functions → comments
    if (/^(plot|plotshape|plotchar|plotarrow|bgcolor|barcolor|hline|fill)\s*\(/.test(trimmed)) {
      output.push(`  // [visual] ${trimmed}`)
      success++
      continue
    }

    // ta.sma / ta.ema etc
    let line = trimmed
      .replace(/ta\.sma\((\w+),\s*(\w+)\)/g, 'indicators.sma($2, \'close\')')
      .replace(/ta\.ema\((\w+),\s*(\w+)\)/g, 'indicators.ema($2, \'close\')')
      .replace(/ta\.rsi\((\w+),\s*(\w+)\)/g, 'indicators.rsi($2, \'close\')')
      .replace(/ta\.crossover\(/g, 'context.crossOver(')
      .replace(/ta\.crossunder\(/g, 'context.crossUnder(')
      .replace(/\bstrategy\.long\b/g, '"long"')
      .replace(/\bstrategy\.short\b/g, '"short"')
      .replace(/\bclose\b/g, 'bar.close')
      .replace(/\bopen\b/g, 'bar.open')
      .replace(/\bhigh\b/g, 'bar.high')
      .replace(/\blow\b/g, 'bar.low')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')

    // strategy.entry
    if (line.includes('strategy.entry(')) {
      const entryMatch = line.match(/strategy\.entry\("(\w+)",\s*"(\w+)"/)
      if (entryMatch) {
        line = entryMatch[2] === 'long' ? `  buy(100)` : `  sell(100)`
      } else {
        line = line.replace(/strategy\.entry\(.*\)/, 'buy(100)')
      }
      output.push(`  ${line.trim()}`)
      success++
      continue
    }

    // strategy.close
    if (line.includes('strategy.close(') || line.includes('strategy.bar.close(')) {
      output.push(`  closePosition()`)
      success++
      continue
    }

    // If blocks
    if (trimmed.startsWith('if ')) {
      const cond = line.slice(line.indexOf('if ') + 3)
      output.push(`  if (${cond}) {`)
      success++
      continue
    }

    // Assignment
    if (/^\w+\s*[:=]=?\s*.+/.test(trimmed)) {
      line = line.replace(/:=/g, '=')
      if (!line.startsWith('const ') && !line.startsWith('let ')) {
        line = `const ${line}`
      }
      output.push(`  ${line.trim()}`)
      success++
      continue
    }

    // Fallback: unsupported
    output.push(`  // UNSUPPORTED: ${trimmed}`)
    warnings.push({
      line: i + 1,
      column: 0,
      message: `Unsupported: ${trimmed.slice(0, 60)}`,
      severity: 'warning',
      originalCode: trimmed,
    })
  }

  output.push('}')

  return {
    code: output.join('\n'),
    warnings,
    compatibility: total > 0 ? Math.round((success / total) * 100) : 100,
  }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function PineImportPage() {
  const [pineCode, setPineCode] = useState(SAMPLE_PINE_SCRIPT)
  const [result, setResult] = useState<TranspileResult | null>(null)
  const [isTranspiling, setIsTranspiling] = useState(false)

  const handleTranspile = useCallback(async () => {
    setIsTranspiling(true)
    // Simulate async (in production, this calls tRPC endpoint)
    await new Promise((r) => setTimeout(r, 300))
    const transpiled = clientTranspile(pineCode)
    setResult(transpiled)
    setIsTranspiling(false)
  }, [pineCode])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result
      if (typeof text === 'string') {
        setPineCode(text)
        setResult(null)
      }
    }
    reader.readAsText(file)
  }, [])

  const compatibilityColor = useMemo(() => {
    if (!result) return ''
    if (result.compatibility >= 70) return 'text-trading-green bg-trading-green/20'
    if (result.compatibility >= 50) return 'text-amber-400 bg-amber-400/20'
    return 'text-trading-red bg-trading-red/20'
  }, [result])

  const handleOpenInIDE = useCallback(() => {
    if (!result) return
    // In production: navigate with the code as a query param or via state management
    // For now, copy to clipboard and show a message
    navigator.clipboard.writeText(result.code)
    // Could use router.push('/strategy/ide?code=...') in production
  }, [result])

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-navy-dark px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Pine Script Import</h1>
          <p className="text-xs text-text-muted">
            Paste your Pine Script v5 code below to transpile it to TypeScript
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded bg-navy-mid px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary">
            Upload .pine
            <input
              type="file"
              accept=".pine,.txt,.pinescript"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleTranspile}
            disabled={!pineCode.trim() || isTranspiling}
            className={cn(
              'rounded px-4 py-1.5 text-xs font-semibold transition-colors',
              pineCode.trim() && !isTranspiling
                ? 'bg-accent text-text-primary hover:bg-accent/80'
                : 'cursor-not-allowed bg-navy-mid text-text-muted',
            )}
          >
            {isTranspiling ? 'Transpiling...' : 'Transpile'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Pine Script Input */}
        <div className="flex w-1/2 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border bg-navy-dark px-4 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Pine Script v5
            </span>
            <span className="text-[10px] text-text-muted">
              {pineCode.split('\n').length} lines
            </span>
          </div>
          <textarea
            value={pineCode}
            onChange={(e) => {
              setPineCode(e.target.value)
              setResult(null)
            }}
            spellCheck={false}
            className="flex-1 resize-none bg-navy-black p-4 font-mono text-xs leading-relaxed text-text-secondary outline-none placeholder:text-text-muted/40"
            placeholder="Paste your Pine Script v5 code here..."
          />
        </div>

        {/* Right: Transpilation Result */}
        <div className="flex w-1/2 flex-col">
          {!result ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-text-muted">
                  Click "Transpile" to convert your Pine Script
                </p>
                <p className="mt-1 text-xs text-text-muted/60">
                  A sample MA crossover strategy is pre-loaded for demo
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Result header with score */}
              <div className="flex items-center justify-between border-b border-border bg-navy-dark px-4 py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Generated TypeScript
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    compatibilityColor,
                  )}>
                    {result.compatibility}% compatible
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(result.code)}
                    className="rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInIDE}
                    className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/30"
                  >
                    Open in IDE
                  </button>
                </div>
              </div>

              {/* Generated code */}
              <div className="flex-1 overflow-auto">
                <pre className="p-4 font-mono text-xs leading-relaxed text-text-secondary">
                  {result.code}
                </pre>
              </div>

              {/* Warnings panel */}
              {result.warnings.length > 0 && (
                <div className="shrink-0 border-t border-border bg-navy-dark">
                  <div className="border-b border-border px-4 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-trading-red">
                      {result.warnings.length} Warning{result.warnings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {result.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 border-b border-border/30 px-4 py-1.5 last:border-b-0"
                      >
                        <span className={cn(
                          'mt-0.5 shrink-0 rounded px-1 text-[9px] font-bold uppercase',
                          w.severity === 'error'
                            ? 'bg-trading-red/20 text-trading-red'
                            : w.severity === 'warning'
                              ? 'bg-amber-400/20 text-amber-400'
                              : 'bg-blue-400/20 text-blue-400',
                        )}>
                          {w.severity === 'error' ? 'ERR' : w.severity === 'warning' ? 'WARN' : 'INFO'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-text-secondary">{w.message}</p>
                          <p className="font-mono text-[10px] text-text-muted">
                            Line {w.line}: {w.originalCode.slice(0, 60)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
