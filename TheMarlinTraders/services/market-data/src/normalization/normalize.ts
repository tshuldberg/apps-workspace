import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'
import type { PolygonTrade, PolygonAggregate } from '../providers/polygon-ws.js'

/** Exchange ID to MIC code mapping for common US exchanges */
const EXCHANGE_MAP: Record<number, string> = {
  1: 'XASE', // NYSE American
  2: 'XNAS', // NASDAQ OMX BX
  4: 'EDGX', // CBOE EDGX
  7: 'XNYS', // NYSE
  8: 'ARCX', // NYSE Arca
  11: 'XCHI', // NYSE Chicago
  12: 'XNAS', // NASDAQ
  15: 'IEXG', // IEX
  19: 'MEMX', // MEMX
}

/** Polygon condition codes — filter irregular trades */
const IRREGULAR_CONDITIONS = new Set([
  2,  // Average Price Trade
  7,  // Qualified Contingent Trade
  15, // Market Center Official Close
  16, // Market Center Official Open
  20, // Sub-Penny Trading
  21, // Form T (pre/post-market)
  22, // Extended Hours (Sold Out of Sequence)
  29, // Contingent Trade
  37, // Derivatively Priced
])

export function normalizeTrade(raw: PolygonTrade): NormalizedTrade {
  const conditions = raw.c?.map(String)
  return {
    symbol: raw.sym,
    price: raw.p,
    size: raw.s,
    timestamp: raw.t,
    conditions,
    exchange: raw.x !== undefined ? EXCHANGE_MAP[raw.x] : undefined,
  }
}

export function normalizeAggregate(raw: PolygonAggregate): NormalizedBar {
  return {
    symbol: raw.sym,
    timeframe: '1m',
    open: raw.o,
    high: raw.h,
    low: raw.l,
    close: raw.c,
    volume: raw.v,
    timestamp: raw.s,
    vwap: raw.vw,
    tradeCount: raw.z,
  }
}

export function isRegularTrade(trade: PolygonTrade): boolean {
  if (!trade.c) return true
  return !trade.c.some((c) => IRREGULAR_CONDITIONS.has(c))
}
