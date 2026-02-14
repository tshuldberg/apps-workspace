import type { NormalizedBar, NormalizedQuote, OHLCV } from '@marlin/shared'

/** Format a NormalizedBar into the shape lightweight-charts expects */
export interface ChartBarUpdate {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface ChartVolumeUpdate {
  time: number
  value: number
  color: string
}

export interface QuoteUpdate {
  symbol: string
  bid: number
  ask: number
  mid: number
  spread: number
  timestamp: number
}

export interface ProcessedBarMessage {
  type: 'bar'
  symbol: string
  timeframe: string
  bar: ChartBarUpdate
  volume: ChartVolumeUpdate
  vwap?: number
}

export interface ProcessedQuoteMessage {
  type: 'quote'
  quote: QuoteUpdate
}

export type ProcessedMessage = ProcessedBarMessage | ProcessedQuoteMessage

const TRADING_GREEN = '#22c55e'
const TRADING_RED = '#ef4444'

export function processBar(bar: NormalizedBar): ProcessedBarMessage {
  const isUp = bar.close >= bar.open
  return {
    type: 'bar',
    symbol: bar.symbol,
    timeframe: bar.timeframe,
    bar: {
      time: Math.floor(bar.timestamp / 1000),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    },
    volume: {
      time: Math.floor(bar.timestamp / 1000),
      value: bar.volume,
      color: isUp ? `${TRADING_GREEN}80` : `${TRADING_RED}80`,
    },
    vwap: bar.vwap,
  }
}

export function processQuote(quote: NormalizedQuote): ProcessedQuoteMessage {
  const mid = (quote.bidPrice + quote.askPrice) / 2
  return {
    type: 'quote',
    quote: {
      symbol: quote.symbol,
      bid: quote.bidPrice,
      ask: quote.askPrice,
      mid,
      spread: quote.askPrice - quote.bidPrice,
      timestamp: quote.timestamp,
    },
  }
}

/** Parse a raw WebSocket data message and process it */
export function processMessage(channel: string, payload: unknown): ProcessedMessage | null {
  if (channel.startsWith('bars:')) {
    return processBar(payload as NormalizedBar)
  }
  if (channel.startsWith('quotes:')) {
    return processQuote(payload as NormalizedQuote)
  }
  return null
}
