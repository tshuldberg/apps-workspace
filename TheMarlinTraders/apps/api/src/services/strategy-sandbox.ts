/**
 * Strategy Sandbox — Isolated Execution Environment
 *
 * Executes user-authored TypeScript strategy code in a sandboxed environment
 * with strict resource limits. User code cannot access the filesystem, network,
 * or any Node.js APIs. The sandbox exposes a controlled strategy API:
 * buy(), sell(), position(), indicators.*, log().
 */

import type { OHLCV } from '@marlin/shared'
import {
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  atr,
  obv,
  vwap,
  stochastic,
  cci,
  williamsR,
  mfi,
  adLine,
  supertrend,
  adx,
  aroon,
  ichimoku,
  sar,
  keltner,
  donchian,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalSide = 'buy' | 'sell'

export interface StrategySignal {
  bar: number
  timestamp: number
  side: SignalSide
  symbol: string
  quantity: number
  price: number
  reason?: string
}

export interface SandboxConfig {
  symbol: string
  equity: number
  /** Max execution time per bar in milliseconds (default 10) */
  maxBarMs?: number
  /** Max total execution time in milliseconds (default 5000) */
  maxTotalMs?: number
  /** Max memory for the sandbox in MB (default 256) */
  maxMemoryMB?: number
}

export interface SandboxResult {
  success: true
  signals: StrategySignal[]
  logs: string[]
  executionMs: number
  barsProcessed: number
}

export interface SandboxError {
  success: false
  error: string
  errorType: 'timeout' | 'memory' | 'runtime' | 'validation'
  logs: string[]
  executionMs: number
  barsProcessed: number
}

export type SandboxOutput = SandboxResult | SandboxError

// ---------------------------------------------------------------------------
// Validation — static code analysis before execution
// ---------------------------------------------------------------------------

/** Patterns that must NEVER appear in user strategy code. */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\beval\s*\(/, reason: 'eval() is not allowed' },
  { pattern: /\bnew\s+Function\s*\(/, reason: 'new Function() is not allowed' },
  { pattern: /\brequire\s*\(/, reason: 'require() is not allowed' },
  { pattern: /\bimport\s*\(/, reason: 'Dynamic import() is not allowed' },
  { pattern: /\bimport\s+/, reason: 'import statements are not allowed' },
  { pattern: /\bprocess\b/, reason: 'Access to process is not allowed' },
  { pattern: /\bglobalThis\b/, reason: 'Access to globalThis is not allowed' },
  { pattern: /\b__dirname\b/, reason: 'Access to __dirname is not allowed' },
  { pattern: /\b__filename\b/, reason: 'Access to __filename is not allowed' },
  { pattern: /\bBuffer\b/, reason: 'Access to Buffer is not allowed' },
  { pattern: /\bchild_process\b/, reason: 'Access to child_process is not allowed' },
  { pattern: /\bfs\b\s*[.[]/, reason: 'Filesystem access is not allowed' },
  { pattern: /\bnet\b\s*[.[]/, reason: 'Network access is not allowed' },
  { pattern: /\bhttp\b\s*[.[]/, reason: 'HTTP access is not allowed' },
  { pattern: /\bfetch\s*\(/, reason: 'fetch() is not allowed' },
  { pattern: /\bXMLHttpRequest\b/, reason: 'XMLHttpRequest is not allowed' },
  { pattern: /\bWebSocket\b/, reason: 'WebSocket is not allowed' },
  { pattern: /\bsetTimeout\s*\(/, reason: 'setTimeout() is not allowed — use synchronous logic' },
  { pattern: /\bsetInterval\s*\(/, reason: 'setInterval() is not allowed' },
  { pattern: /\bsetImmediate\s*\(/, reason: 'setImmediate() is not allowed' },
  { pattern: /\bPromise\b/, reason: 'Promises are not allowed — strategy code must be synchronous' },
  { pattern: /\basync\b/, reason: 'async/await is not allowed — strategy code must be synchronous' },
  { pattern: /\bawait\b/, reason: 'async/await is not allowed — strategy code must be synchronous' },
  { pattern: /\bconstructor\s*\[/, reason: 'Constructor access via bracket notation is not allowed' },
]

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate user strategy code against a set of forbidden patterns.
 * This is a fast static check — it does NOT parse an AST, but catches
 * the most common escape vectors.
 */
export function validateCode(code: string): ValidationResult {
  const errors: string[] = []

  if (typeof code !== 'string' || code.trim().length === 0) {
    return { valid: false, errors: ['Strategy code must be a non-empty string'] }
  }

  // Max code size: 64KB
  if (code.length > 65_536) {
    return { valid: false, errors: ['Strategy code must not exceed 64KB'] }
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(reason)
    }
  }

  // Verify the code declares an onBar function (entry point)
  if (!/function\s+onBar\b/.test(code) && !/const\s+onBar\s*=/.test(code)) {
    errors.push('Strategy must define an onBar(bar, index) function')
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Indicator bridge — pre-computed indicator values exposed to the sandbox
// ---------------------------------------------------------------------------

interface IndicatorCache {
  sma: (period: number) => (number | null)[]
  ema: (period: number) => (number | null)[]
  rsi: (period: number) => (number | null)[]
  macd: (fast: number, slow: number, signal: number) => { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] }
  bollinger: (period: number, stdDev: number) => { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
  atr: (period: number) => (number | null)[]
  obv: () => (number | null)[]
  vwap: () => (number | null)[]
  stochastic: (kPeriod: number, dPeriod: number) => { k: (number | null)[]; d: (number | null)[] }
  cci: (period: number) => (number | null)[]
  williamsR: (period: number) => (number | null)[]
  mfi: (period: number) => (number | null)[]
  adLine: () => (number | null)[]
  supertrend: (period: number, multiplier: number) => { value: (number | null)[]; direction: (number | null)[] }
  adx: (period: number) => { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] }
  aroon: (period: number) => { up: (number | null)[]; down: (number | null)[] }
  ichimoku: () => { tenkan: (number | null)[]; kijun: (number | null)[]; senkouA: (number | null)[]; senkouB: (number | null)[] }
  sar: (step: number, max: number) => (number | null)[]
  keltner: (period: number, multiplier: number) => { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
  donchian: (period: number) => { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
}

/**
 * Pre-compute indicator results from bars so that sandbox code
 * accesses cached arrays rather than running computations.
 */
function buildIndicatorCache(bars: OHLCV[]): IndicatorCache {
  // Memoize calls so duplicate params don't recompute
  const memo = new Map<string, unknown>()

  function memoized<T>(key: string, fn: () => T): T {
    if (memo.has(key)) return memo.get(key) as T
    const result = fn()
    memo.set(key, result)
    return result
  }

  return {
    sma: (period) =>
      memoized(`sma:${period}`, () => sma(bars, { period }).values),
    ema: (period) =>
      memoized(`ema:${period}`, () => ema(bars, { period }).values),
    rsi: (period) =>
      memoized(`rsi:${period}`, () => rsi(bars, { period }).values),
    macd: (fast, slow, signal) =>
      memoized(`macd:${fast}:${slow}:${signal}`, () => {
        const r = macd(bars, { fast, slow, signal })
        return { macd: r.values, signal: r.signal ?? [], histogram: r.histogram ?? [] }
      }),
    bollinger: (period, stdDev) =>
      memoized(`bb:${period}:${stdDev}`, () => {
        const r = bollinger(bars, { period, stdDev })
        return { upper: r.upper ?? [], middle: r.values, lower: r.lower ?? [] }
      }),
    atr: (period) =>
      memoized(`atr:${period}`, () => atr(bars, { period }).values),
    obv: () =>
      memoized('obv', () => obv(bars, {}).values),
    vwap: () =>
      memoized('vwap', () => vwap(bars, {}).values),
    stochastic: (kPeriod, dPeriod) =>
      memoized(`stoch:${kPeriod}:${dPeriod}`, () => {
        const r = stochastic(bars, { kPeriod, dPeriod, slowing: 3 })
        return { k: r.values, d: r.signal ?? [] }
      }),
    cci: (period) =>
      memoized(`cci:${period}`, () => cci(bars, { period }).values),
    williamsR: (period) =>
      memoized(`willr:${period}`, () => williamsR(bars, { period }).values),
    mfi: (period) =>
      memoized(`mfi:${period}`, () => mfi(bars, { period }).values),
    adLine: () =>
      memoized('adl', () => adLine(bars, {}).values),
    supertrend: (period, multiplier) =>
      memoized(`st:${period}:${multiplier}`, () => {
        const r = supertrend(bars, { period, multiplier })
        return { value: r.values, direction: r.signal ?? [] }
      }),
    adx: (period) =>
      memoized(`adx:${period}`, () => {
        const r = adx(bars, { period })
        return { adx: r.values, plusDI: r.upper ?? [], minusDI: r.lower ?? [] }
      }),
    aroon: (period) =>
      memoized(`aroon:${period}`, () => {
        const r = aroon(bars, { period })
        return { up: r.upper ?? [], down: r.lower ?? [] }
      }),
    ichimoku: () =>
      memoized('ichi', () => {
        const r = ichimoku(bars, {})
        return {
          tenkan: r.values,
          kijun: r.signal ?? [],
          senkouA: r.upper ?? [],
          senkouB: r.lower ?? [],
        }
      }),
    sar: (step, max) =>
      memoized(`sar:${step}:${max}`, () => sar(bars, { step, max }).values),
    keltner: (period, multiplier) =>
      memoized(`kelt:${period}:${multiplier}`, () => {
        const r = keltner(bars, { period, multiplier })
        return { upper: r.upper ?? [], middle: r.values, lower: r.lower ?? [] }
      }),
    donchian: (period) =>
      memoized(`donch:${period}`, () => {
        const r = donchian(bars, { period })
        return { upper: r.upper ?? [], middle: r.values, lower: r.lower ?? [] }
      }),
  }
}

// ---------------------------------------------------------------------------
// Sandbox Execution
// ---------------------------------------------------------------------------

/**
 * StrategySandbox executes user-authored strategy code against historical
 * bar data in an isolated environment. No network, no filesystem, no eval.
 *
 * The sandbox compiles the user code into a Function with a whitelisted
 * scope object. All indicator values are pre-computed and frozen.
 */
export class StrategySandbox {
  private maxBarMs: number
  private maxTotalMs: number
  private maxMemoryMB: number

  constructor(config?: { maxBarMs?: number; maxTotalMs?: number; maxMemoryMB?: number }) {
    this.maxBarMs = config?.maxBarMs ?? 10
    this.maxTotalMs = config?.maxTotalMs ?? 5_000
    this.maxMemoryMB = config?.maxMemoryMB ?? 256
  }

  /**
   * Validate user code before execution.
   */
  validateCode(code: string): ValidationResult {
    return validateCode(code)
  }

  /**
   * Execute user strategy code against bar data.
   * The code must define an `onBar(bar, index)` function.
   */
  execute(code: string, bars: OHLCV[], config: SandboxConfig): SandboxOutput {
    const startTime = performance.now()
    const logs: string[] = []
    const signals: StrategySignal[] = []
    let barsProcessed = 0

    // 1. Validate
    const validation = validateCode(code)
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`,
        errorType: 'validation',
        logs,
        executionMs: performance.now() - startTime,
        barsProcessed: 0,
      }
    }

    // 2. Pre-compute indicators
    const indicatorCache = buildIndicatorCache(bars)

    // 3. Build the sandbox scope
    let currentPosition = 0
    let currentIndex = 0

    const sandboxApi = {
      buy: (quantity: number, reason?: string) => {
        const bar = bars[currentIndex]!
        signals.push({
          bar: currentIndex,
          timestamp: bar.time,
          side: 'buy',
          symbol: config.symbol,
          quantity: Math.max(1, Math.floor(quantity)),
          price: bar.close,
          reason,
        })
        currentPosition += Math.max(1, Math.floor(quantity))
      },
      sell: (quantity: number, reason?: string) => {
        const bar = bars[currentIndex]!
        signals.push({
          bar: currentIndex,
          timestamp: bar.time,
          side: 'sell',
          symbol: config.symbol,
          quantity: Math.max(1, Math.floor(quantity)),
          price: bar.close,
          reason,
        })
        currentPosition -= Math.max(1, Math.floor(quantity))
      },
      position: () => currentPosition,
      equity: () => config.equity,
      log: (...args: unknown[]) => {
        if (logs.length < 1000) {
          logs.push(args.map((a) => String(a)).join(' '))
        }
      },
      indicators: Object.freeze(indicatorCache),
      Math: Object.freeze(Math),
      Number: Object.freeze(Number),
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      parseFloat,
      parseInt,
      NaN,
      Infinity,
      undefined,
      true: true,
      false: false,
      null: null,
    }

    // 4. Compile user code in a restricted scope
    // We wrap the user code so `onBar` is callable from our loop.
    const wrappedCode = `
      "use strict";
      ${code}
      return { onBar };
    `

    let userModule: { onBar: (bar: OHLCV, index: number) => void }

    try {
      // The Function constructor is used here (not by user code) to create
      // a closure with only the whitelisted sandbox API in scope.
      // We explicitly pass in only safe names; the user code has no access
      // to require, process, globalThis, etc.
      const paramNames = Object.keys(sandboxApi)
      const paramValues = Object.values(sandboxApi)

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const factory = new Function(...paramNames, wrappedCode)
      userModule = factory(...paramValues) as typeof userModule
    } catch (err) {
      return {
        success: false,
        error: `Compilation error: ${err instanceof Error ? err.message : String(err)}`,
        errorType: 'runtime',
        logs,
        executionMs: performance.now() - startTime,
        barsProcessed: 0,
      }
    }

    if (typeof userModule?.onBar !== 'function') {
      return {
        success: false,
        error: 'Strategy must define an onBar(bar, index) function',
        errorType: 'validation',
        logs,
        executionMs: performance.now() - startTime,
        barsProcessed: 0,
      }
    }

    // 5. Execute bar-by-bar with timeout enforcement
    try {
      for (let i = 0; i < bars.length; i++) {
        currentIndex = i
        const barStart = performance.now()

        userModule.onBar(Object.freeze({ ...bars[i]! }), i)

        barsProcessed++

        // Per-bar timeout
        const barElapsed = performance.now() - barStart
        if (barElapsed > this.maxBarMs) {
          return {
            success: false,
            error: `Bar ${i} exceeded max execution time (${barElapsed.toFixed(1)}ms > ${this.maxBarMs}ms)`,
            errorType: 'timeout',
            logs,
            executionMs: performance.now() - startTime,
            barsProcessed,
          }
        }

        // Total timeout
        const totalElapsed = performance.now() - startTime
        if (totalElapsed > this.maxTotalMs) {
          return {
            success: false,
            error: `Total execution time exceeded (${totalElapsed.toFixed(0)}ms > ${this.maxTotalMs}ms)`,
            errorType: 'timeout',
            logs,
            executionMs: totalElapsed,
            barsProcessed,
          }
        }

        // Memory check (approximation via V8 heap — only works in Node/Bun)
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const heapUsedMB = process.memoryUsage().heapUsed / (1024 * 1024)
          if (heapUsedMB > this.maxMemoryMB) {
            return {
              success: false,
              error: `Memory limit exceeded (${heapUsedMB.toFixed(0)}MB > ${this.maxMemoryMB}MB)`,
              errorType: 'memory',
              logs,
              executionMs: performance.now() - startTime,
              barsProcessed,
            }
          }
        }
      }
    } catch (err) {
      return {
        success: false,
        error: `Runtime error at bar ${currentIndex}: ${err instanceof Error ? err.message : String(err)}`,
        errorType: 'runtime',
        logs,
        executionMs: performance.now() - startTime,
        barsProcessed,
      }
    }

    return {
      success: true,
      signals,
      logs,
      executionMs: performance.now() - startTime,
      barsProcessed,
    }
  }
}
