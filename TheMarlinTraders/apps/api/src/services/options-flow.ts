import type {
  FlowEntry,
  FlowSentiment,
  FlowType,
  PutCallRatio,
  OptionType,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// Input types — raw trade data from market data provider
// ---------------------------------------------------------------------------

export interface OptionTrade {
  id: string
  timestamp: number
  symbol: string // underlying
  contractSymbol: string // OCC symbol
  expiration: string // YYYY-MM-DD
  strike: number
  type: OptionType
  price: number // fill price per contract
  size: number // number of contracts
  bid: number
  ask: number
  volume: number // cumulative day volume for this contract
  openInterest: number
  averageVolume: number // 20-day average volume for this contract
  exchange?: string
}

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

const UNUSUAL_VOLUME_MULTIPLIER = 2
const BLOCK_TRADE_THRESHOLD = 100 // contracts
const SWEEP_TIME_WINDOW_MS = 2_000 // 2 seconds
const SWEEP_MIN_EXCHANGES = 2
const MULTI_LEG_TIME_WINDOW_MS = 1_000 // 1 second
const CONTRACT_MULTIPLIER = 100 // standard options contract

// ---------------------------------------------------------------------------
// Sentiment classification
// ---------------------------------------------------------------------------

/**
 * Classify trade sentiment based on where the fill occurred relative to bid/ask.
 * At or above ask = aggressive buyer = bullish for calls / bearish for puts.
 * At or below bid = aggressive seller = bearish for calls / bullish for puts.
 */
function classifySentiment(trade: OptionTrade): FlowSentiment {
  const mid = (trade.bid + trade.ask) / 2

  let buyerInitiated: boolean | null = null
  if (trade.price >= trade.ask - 0.01) {
    buyerInitiated = true
  } else if (trade.price <= trade.bid + 0.01) {
    buyerInitiated = false
  } else if (trade.price > mid) {
    buyerInitiated = true
  } else if (trade.price < mid) {
    buyerInitiated = false
  }

  if (buyerInitiated === null) return 'neutral'

  // For calls: buying = bullish, selling = bearish
  // For puts: buying = bearish, selling = bullish
  if (trade.type === 'call') {
    return buyerInitiated ? 'bullish' : 'bearish'
  }
  // puts
  return buyerInitiated ? 'bearish' : 'bullish'
}

/**
 * Determine the trade side based on fill price vs bid/ask.
 */
function classifySide(trade: OptionTrade): 'buy' | 'sell' {
  const mid = (trade.bid + trade.ask) / 2
  return trade.price >= mid ? 'buy' : 'sell'
}

// ---------------------------------------------------------------------------
// Unusual score calculation
// ---------------------------------------------------------------------------

/**
 * Compute an "unusual score" from 0-100 based on multiple factors:
 * - Volume vs average volume ratio
 * - Volume vs open interest ratio
 * - Premium size (total dollars)
 * - Days to expiration (nearer = more unusual)
 */
function computeUnusualScore(trade: OptionTrade): number {
  let score = 0

  // Volume / avg volume ratio (0-30 pts)
  if (trade.averageVolume > 0) {
    const volRatio = trade.volume / trade.averageVolume
    score += Math.min(30, volRatio * 10)
  }

  // Volume / open interest ratio (0-25 pts)
  if (trade.openInterest > 0) {
    const oiRatio = trade.volume / trade.openInterest
    score += Math.min(25, oiRatio * 12)
  } else {
    // No OI = brand new interest, notable
    score += 15
  }

  // Premium size (0-25 pts)
  const totalPremium = trade.price * trade.size * CONTRACT_MULTIPLIER
  if (totalPremium >= 1_000_000) score += 25
  else if (totalPremium >= 500_000) score += 20
  else if (totalPremium >= 100_000) score += 15
  else if (totalPremium >= 50_000) score += 10
  else if (totalPremium >= 10_000) score += 5

  // Time to expiration (0-20 pts) — shorter DTE = more aggressive = higher score
  const now = new Date()
  const expDate = new Date(trade.expiration + 'T16:00:00')
  const dte = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000))
  if (dte <= 2) score += 20
  else if (dte <= 7) score += 15
  else if (dte <= 14) score += 10
  else if (dte <= 30) score += 5

  return Math.min(100, Math.max(0, Math.round(score)))
}

// ---------------------------------------------------------------------------
// Flow detection
// ---------------------------------------------------------------------------

/**
 * Detect unusual options activity from a list of raw trades.
 * Returns FlowEntry[] sorted by unusual score (highest first).
 */
export function detectUnusualActivity(trades: OptionTrade[]): FlowEntry[] {
  const entries: FlowEntry[] = []

  // Index trades by time window for multi-leg / sweep detection
  const sweepGroups = groupSweeps(trades)
  const multiLegGroups = groupMultiLeg(trades)
  const processedIds = new Set<string>()

  // --- Sweeps ---
  for (const group of sweepGroups) {
    const representative = group[0]!
    const totalSize = group.reduce((sum, t) => sum + t.size, 0)
    const totalPremium = group.reduce(
      (sum, t) => sum + t.price * t.size * CONTRACT_MULTIPLIER,
      0,
    )
    const entry: FlowEntry = {
      id: `sweep-${representative.id}`,
      timestamp: representative.timestamp,
      symbol: representative.symbol,
      expiration: representative.expiration,
      strike: representative.strike,
      type: representative.type,
      side: classifySide(representative),
      volume: totalSize,
      openInterest: representative.openInterest,
      premium: totalPremium,
      sentiment: classifySentiment(representative),
      flowType: 'sweep',
      unusualScore: computeUnusualScore({
        ...representative,
        size: totalSize,
        volume: group.reduce((sum, t) => sum + t.volume, 0),
      }),
    }
    entries.push(entry)
    group.forEach((t) => processedIds.add(t.id))
  }

  // --- Multi-leg ---
  for (const group of multiLegGroups) {
    const representative = group[0]!
    const totalPremium = group.reduce(
      (sum, t) => sum + t.price * t.size * CONTRACT_MULTIPLIER,
      0,
    )
    // Multi-leg sentiment: look at the dominant leg
    const callLegs = group.filter((t) => t.type === 'call')
    const putLegs = group.filter((t) => t.type === 'put')
    let sentiment: FlowSentiment = 'neutral'
    const callPremium = callLegs.reduce((s, t) => s + t.price * t.size, 0)
    const putPremium = putLegs.reduce((s, t) => s + t.price * t.size, 0)
    if (callPremium > putPremium * 1.5) sentiment = 'bullish'
    else if (putPremium > callPremium * 1.5) sentiment = 'bearish'

    const entry: FlowEntry = {
      id: `multileg-${representative.id}`,
      timestamp: representative.timestamp,
      symbol: representative.symbol,
      expiration: representative.expiration,
      strike: representative.strike,
      type: representative.type,
      side: classifySide(representative),
      volume: group.reduce((sum, t) => sum + t.size, 0),
      openInterest: representative.openInterest,
      premium: totalPremium,
      sentiment,
      flowType: 'multi_leg',
      unusualScore: computeUnusualScore(representative),
    }
    entries.push(entry)
    group.forEach((t) => processedIds.add(t.id))
  }

  // --- Block trades & single unusual prints ---
  for (const trade of trades) {
    if (processedIds.has(trade.id)) continue

    const isUnusualVolume =
      trade.averageVolume > 0 &&
      trade.volume > UNUSUAL_VOLUME_MULTIPLIER * trade.averageVolume &&
      trade.openInterest > 0 &&
      trade.volume > UNUSUAL_VOLUME_MULTIPLIER * trade.openInterest

    const isBlock = trade.size >= BLOCK_TRADE_THRESHOLD

    if (!isUnusualVolume && !isBlock) continue

    const totalPremium = trade.price * trade.size * CONTRACT_MULTIPLIER
    const flowType: FlowType = isBlock ? 'block' : 'split'

    entries.push({
      id: trade.id,
      timestamp: trade.timestamp,
      symbol: trade.symbol,
      expiration: trade.expiration,
      strike: trade.strike,
      type: trade.type,
      side: classifySide(trade),
      volume: trade.size,
      openInterest: trade.openInterest,
      premium: totalPremium,
      sentiment: classifySentiment(trade),
      flowType,
      unusualScore: computeUnusualScore(trade),
      exchange: trade.exchange,
    })
  }

  // Sort by unusual score descending
  entries.sort((a, b) => b.unusualScore - a.unusualScore)
  return entries
}

// ---------------------------------------------------------------------------
// Sweep detection — rapid fills across multiple exchanges
// ---------------------------------------------------------------------------

function groupSweeps(trades: OptionTrade[]): OptionTrade[][] {
  const groups: OptionTrade[][] = []

  // Group by (symbol, strike, expiration, type) then check time + exchange diversity
  const keyMap = new Map<string, OptionTrade[]>()
  for (const trade of trades) {
    const key = `${trade.symbol}|${trade.strike}|${trade.expiration}|${trade.type}`
    if (!keyMap.has(key)) keyMap.set(key, [])
    keyMap.get(key)!.push(trade)
  }

  for (const bucket of keyMap.values()) {
    if (bucket.length < SWEEP_MIN_EXCHANGES) continue

    // Sort by timestamp
    bucket.sort((a, b) => a.timestamp - b.timestamp)

    let windowStart = 0
    for (let i = 1; i < bucket.length; i++) {
      if (bucket[i]!.timestamp - bucket[windowStart]!.timestamp > SWEEP_TIME_WINDOW_MS) {
        windowStart = i
      }

      const window = bucket.slice(windowStart, i + 1)
      const uniqueExchanges = new Set(window.map((t) => t.exchange).filter(Boolean))

      if (uniqueExchanges.size >= SWEEP_MIN_EXCHANGES && window.length >= SWEEP_MIN_EXCHANGES) {
        groups.push(window)
        // Skip past this window
        windowStart = i + 1
      }
    }
  }

  return groups
}

// ---------------------------------------------------------------------------
// Multi-leg detection — same symbol, different strikes, similar timestamp
// ---------------------------------------------------------------------------

function groupMultiLeg(trades: OptionTrade[]): OptionTrade[][] {
  const groups: OptionTrade[][] = []
  const used = new Set<string>()

  // Sort by timestamp
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp)

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i]!
    if (used.has(trade.id)) continue

    const group: OptionTrade[] = [trade]

    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j]!
      if (used.has(candidate.id)) continue
      if (candidate.timestamp - trade.timestamp > MULTI_LEG_TIME_WINDOW_MS) break

      // Same underlying, different strike or type
      if (
        candidate.symbol === trade.symbol &&
        (candidate.strike !== trade.strike || candidate.type !== trade.type)
      ) {
        group.push(candidate)
      }
    }

    if (group.length >= 2) {
      groups.push(group)
      group.forEach((t) => used.add(t.id))
    }
  }

  return groups
}

// ---------------------------------------------------------------------------
// Put/Call ratio
// ---------------------------------------------------------------------------

/**
 * Build a put/call ratio from a list of trades for a given symbol.
 */
export function buildPutCallRatio(
  symbol: string,
  trades: OptionTrade[],
): PutCallRatio {
  let callVolume = 0
  let putVolume = 0

  for (const trade of trades) {
    if (trade.symbol !== symbol) continue
    if (trade.type === 'call') {
      callVolume += trade.size
    } else {
      putVolume += trade.size
    }
  }

  return {
    symbol,
    ratio: callVolume > 0 ? putVolume / callVolume : 0,
    callVolume,
    putVolume,
  }
}
