import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'

interface PendingBar {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwapNumerator: number
  tradeCount: number
  minuteStart: number
}

/** Builds 1-minute bars from a stream of normalized trades.
 *  Emits a completed bar when the first trade of a new minute arrives. */
export class BarBuilder {
  private pending = new Map<string, PendingBar>()
  private onBar: (bar: NormalizedBar) => void

  constructor(onBar: (bar: NormalizedBar) => void) {
    this.onBar = onBar
  }

  /** Process an incoming trade. May emit a completed bar. */
  processTrade(trade: NormalizedTrade): void {
    const minuteStart = Math.floor(trade.timestamp / 60_000) * 60_000
    const existing = this.pending.get(trade.symbol)

    if (existing && existing.minuteStart !== minuteStart) {
      this.emitBar(existing)
      this.pending.delete(trade.symbol)
    }

    const bar = this.pending.get(trade.symbol)
    if (bar) {
      bar.high = Math.max(bar.high, trade.price)
      bar.low = Math.min(bar.low, trade.price)
      bar.close = trade.price
      bar.volume += trade.size
      bar.vwapNumerator += trade.price * trade.size
      bar.tradeCount++
    } else {
      this.pending.set(trade.symbol, {
        symbol: trade.symbol,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.size,
        vwapNumerator: trade.price * trade.size,
        tradeCount: 1,
        minuteStart,
      })
    }
  }

  /** Force-flush all pending bars (e.g., at market close). */
  flush(): void {
    for (const bar of this.pending.values()) {
      this.emitBar(bar)
    }
    this.pending.clear()
  }

  /** Flush a specific symbol's pending bar. */
  flushSymbol(symbol: string): void {
    const bar = this.pending.get(symbol)
    if (bar) {
      this.emitBar(bar)
      this.pending.delete(symbol)
    }
  }

  private emitBar(pending: PendingBar): void {
    const vwap = pending.volume > 0 ? pending.vwapNumerator / pending.volume : pending.close
    const bar: NormalizedBar = {
      symbol: pending.symbol,
      timeframe: '1m',
      open: pending.open,
      high: pending.high,
      low: pending.low,
      close: pending.close,
      volume: pending.volume,
      timestamp: pending.minuteStart,
      vwap,
      tradeCount: pending.tradeCount,
    }
    this.onBar(bar)
  }
}
