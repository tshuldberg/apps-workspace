/**
 * Python Strategy Types
 * Sprints 47-48: Visual Builder + Python Interop + Pine Script Import
 *
 * Type definitions for Python-based strategy execution.
 * Mirrors the TypeScript strategy API so users can write
 * strategies in either language with identical semantics.
 */

import { z } from 'zod'
import { StrategyConfigSchema } from './types.js'

// ── Allowed Python Packages ─────────────────────────────────────────────────

export const ALLOWED_PYTHON_PACKAGES = ['numpy', 'pandas', 'scipy'] as const

export const AllowedPythonPackageSchema = z.enum(ALLOWED_PYTHON_PACKAGES)
export type AllowedPythonPackage = z.infer<typeof AllowedPythonPackageSchema>

// ── Python Runtime Config ───────────────────────────────────────────────────

export const PythonRuntimeConfigSchema = z.object({
  /** Maximum memory allocation in MB for the Python sandbox. */
  memoryLimitMb: z.number().int().min(64).max(2048).default(512),

  /** Maximum execution time per bar in milliseconds. */
  timeoutMs: z.number().int().min(100).max(30_000).default(5_000),

  /** Maximum total execution time for a full backtest run in seconds. */
  totalTimeoutSec: z.number().int().min(10).max(3600).default(300),

  /** Allowed third-party packages. Only numpy, pandas, and scipy are permitted. */
  allowedPackages: z.array(AllowedPythonPackageSchema).default(['numpy', 'pandas']),

  /** Python version to target (for display/validation only; runtime is sandboxed). */
  pythonVersion: z.enum(['3.10', '3.11', '3.12']).default('3.12'),

  /** Enable network access within the sandbox (always false for safety). */
  networkAccess: z.literal(false).default(false),

  /** Enable filesystem access within the sandbox (always false for safety). */
  filesystemAccess: z.literal(false).default(false),
})

export type PythonRuntimeConfig = z.infer<typeof PythonRuntimeConfigSchema>

// ── Python Strategy Config ──────────────────────────────────────────────────

export const PythonStrategyConfigSchema = StrategyConfigSchema.extend({
  language: z.literal('python'),

  /** Python-specific runtime constraints. */
  runtime: PythonRuntimeConfigSchema.default({
    memoryLimitMb: 512,
    timeoutMs: 5_000,
    totalTimeoutSec: 300,
    allowedPackages: ['numpy', 'pandas'],
    pythonVersion: '3.12',
    networkAccess: false,
    filesystemAccess: false,
  }),

  /** The Python source code of the strategy. */
  code: z.string().min(1),
})

export type PythonStrategyConfig = z.infer<typeof PythonStrategyConfigSchema>

// ── Python Strategy API Definition ──────────────────────────────────────────
// These types document the Python API that strategy code can call.
// They are used for documentation, code completion, and validation.

/**
 * The bar object passed to `on_bar()`. Mirrors OHLCV.
 *
 * Python equivalent:
 * ```python
 * class Bar:
 *     open: float
 *     high: float
 *     low: float
 *     close: float
 *     volume: float
 *     timestamp: int
 * ```
 */
export interface PythonBarAPI {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

/**
 * The indicators object passed to `on_bar()`.
 *
 * Python equivalent:
 * ```python
 * class Indicators:
 *     def sma(self, period: int, source: str = 'close') -> float: ...
 *     def ema(self, period: int, source: str = 'close') -> float: ...
 *     def rsi(self, period: int, source: str = 'close') -> float: ...
 *     def macd(self, fast: int = 12, slow: int = 26, signal: int = 9, source: str = 'close') -> dict: ...
 *     def bollinger(self, period: int = 20, std_dev: float = 2.0, source: str = 'close') -> dict: ...
 *     def atr(self, period: int = 14) -> float: ...
 *     def crossover(self, series_a: float, series_b: float) -> bool: ...
 *     def crossunder(self, series_a: float, series_b: float) -> bool: ...
 * ```
 */
export interface PythonIndicatorsAPI {
  sma: (period: number, source?: string) => number
  ema: (period: number, source?: string) => number
  rsi: (period: number, source?: string) => number
  macd: (fast?: number, slow?: number, signal?: number, source?: string) => {
    macd: number
    signal: number
    histogram: number
  }
  bollinger: (period?: number, stdDev?: number, source?: string) => {
    upper: number
    middle: number
    lower: number
  }
  atr: (period?: number) => number
  crossover: (a: number, b: number) => boolean
  crossunder: (a: number, b: number) => boolean
}

/**
 * The context object passed to `on_bar()`.
 *
 * Python equivalent:
 * ```python
 * class Context:
 *     bar_index: int
 *     equity: float
 *     cash: float
 *
 *     def position(self) -> dict | None: ...
 *     def history(self, field: str, lookback: int) -> list[float]: ...
 * ```
 */
export interface PythonContextAPI {
  barIndex: number
  equity: number
  cash: number
  position: () => { side: 'long' | 'short'; quantity: number; avgPrice: number } | null
  history: (field: string, lookback: number) => number[]
}

/**
 * The trading functions available globally in the Python strategy.
 *
 * Python equivalent:
 * ```python
 * def buy(quantity: int) -> None: ...
 * def sell(quantity: int) -> None: ...
 * def close_position(percent: float = 1.0) -> None: ...
 * def set_stop(price: float) -> None: ...
 * def set_trailing_stop(distance: float) -> None: ...
 * def set_take_profit(price: float) -> None: ...
 * ```
 */
export interface PythonTradingAPI {
  buy: (quantity: number) => void
  sell: (quantity: number) => void
  closePosition: (percent?: number) => void
  setStop: (price: number) => void
  setTrailingStop: (distance: number) => void
  setTakeProfit: (price: number) => void
}

// ── Python Strategy Template Code ───────────────────────────────────────────

export const PYTHON_MA_CROSSOVER_TEMPLATE = `"""
Moving Average Crossover Strategy
Buys when fast MA crosses above slow MA, sells on cross below.
"""

def on_bar(bar, indicators, context):
    fast_ma = indicators.sma(10, 'close')
    slow_ma = indicators.sma(30, 'close')

    if indicators.crossover(fast_ma, slow_ma):
        if context.position() is None:
            buy(100)

    if indicators.crossunder(fast_ma, slow_ma):
        if context.position() is not None:
            close_position()
`

export const PYTHON_RSI_STRATEGY_TEMPLATE = `"""
RSI Mean Reversion Strategy
Buys when RSI drops below oversold level, sells when RSI exceeds overbought level.
"""

OVERSOLD = 30
OVERBOUGHT = 70
POSITION_SIZE = 100

def on_bar(bar, indicators, context):
    rsi = indicators.rsi(14, 'close')
    pos = context.position()

    if rsi < OVERSOLD and pos is None:
        buy(POSITION_SIZE)
        set_stop(bar.close * 0.97)  # 3% stop loss

    elif rsi > OVERBOUGHT and pos is not None:
        close_position()
`

// ── Python API Stub (for documentation / editor support) ────────────────────

export const PYTHON_API_STUB = `"""
TheMarlinTraders Python Strategy API
This module is automatically available in the strategy sandbox.
"""

from typing import Optional, Dict, List

class Bar:
    """Current price bar data."""
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: int

class Position:
    """Current position information."""
    side: str  # 'long' or 'short'
    quantity: int
    avg_price: float

class Indicators:
    """Technical indicator calculations."""

    def sma(self, period: int, source: str = 'close') -> float:
        """Simple Moving Average."""
        ...

    def ema(self, period: int, source: str = 'close') -> float:
        """Exponential Moving Average."""
        ...

    def rsi(self, period: int, source: str = 'close') -> float:
        """Relative Strength Index (0-100)."""
        ...

    def macd(self, fast: int = 12, slow: int = 26, signal: int = 9, source: str = 'close') -> Dict[str, float]:
        """MACD. Returns {'macd': float, 'signal': float, 'histogram': float}."""
        ...

    def bollinger(self, period: int = 20, std_dev: float = 2.0, source: str = 'close') -> Dict[str, float]:
        """Bollinger Bands. Returns {'upper': float, 'middle': float, 'lower': float}."""
        ...

    def atr(self, period: int = 14) -> float:
        """Average True Range."""
        ...

    def crossover(self, series_a: float, series_b: float) -> bool:
        """True when series_a crosses above series_b."""
        ...

    def crossunder(self, series_a: float, series_b: float) -> bool:
        """True when series_a crosses below series_b."""
        ...

class Context:
    """Execution context."""
    bar_index: int
    equity: float
    cash: float

    def position(self) -> Optional[Position]:
        """Current open position, or None."""
        ...

    def history(self, field: str, lookback: int) -> List[float]:
        """Historical values for a field (e.g., 'close') over lookback bars."""
        ...

# ── Trading Functions (globally available) ──

def buy(quantity: int) -> None:
    """Open a long position with the given number of shares."""
    ...

def sell(quantity: int) -> None:
    """Open a short position with the given number of shares."""
    ...

def close_position(percent: float = 1.0) -> None:
    """Close the current position. percent=0.5 closes half."""
    ...

def set_stop(price: float) -> None:
    """Set a fixed stop loss at the given price."""
    ...

def set_trailing_stop(distance: float) -> None:
    """Set a trailing stop at the given distance from price."""
    ...

def set_take_profit(price: float) -> None:
    """Set a take profit at the given price."""
    ...

# ── Strategy Entry Point ──

def on_bar(bar: Bar, indicators: Indicators, context: Context) -> None:
    """
    Called once per bar. This is the main strategy function.
    Use buy(), sell(), close_position(), set_stop(), etc. to place orders.
    """
    ...
`
