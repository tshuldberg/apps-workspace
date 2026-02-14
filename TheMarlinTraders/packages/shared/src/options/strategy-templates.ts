import type {
  StrategyTemplate,
  StrategyLegPattern,
  StrikeReference,
  Strategy,
  StrategyLeg,
} from './strategy-types.js'
import type { OptionsChainData, Strike, OptionsContract } from './types.js'

// ---------------------------------------------------------------------------
// Template Definitions
// ---------------------------------------------------------------------------

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ── Directional ──────────────────────────────────────────────────────────
  {
    id: 'long-call',
    name: 'Long Call',
    description: 'Bullish bet with limited risk. Profit when stock rises above strike + premium.',
    category: 'Directional',
    riskProfile: 'defined',
    legPattern: [{ side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 }],
  },
  {
    id: 'long-put',
    name: 'Long Put',
    description: 'Bearish bet with limited risk. Profit when stock falls below strike - premium.',
    category: 'Directional',
    riskProfile: 'defined',
    legPattern: [{ side: 'buy', type: 'put', strikeRef: 'ATM', quantity: 1 }],
  },
  {
    id: 'covered-call',
    name: 'Covered Call',
    description: 'Own shares + sell a call. Collect premium; cap upside at the strike.',
    category: 'Directional',
    riskProfile: 'undefined',
    legPattern: [{ side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 }],
  },
  {
    id: 'protective-put',
    name: 'Protective Put',
    description: 'Own shares + buy a put. Insurance against downside; premium is the cost.',
    category: 'Directional',
    riskProfile: 'defined',
    legPattern: [{ side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 }],
  },
  {
    id: 'collar',
    name: 'Collar',
    description: 'Own shares + buy OTM put + sell OTM call. Cap both upside and downside.',
    category: 'Directional',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
    ],
  },

  // ── Spreads ──────────────────────────────────────────────────────────────
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    description: 'Buy lower call, sell higher call. Defined risk bullish debit spread.',
    category: 'Spreads',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
    ],
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    description: 'Buy higher put, sell lower put. Defined risk bearish debit spread.',
    category: 'Spreads',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'put', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
    ],
  },
  {
    id: 'bull-put-spread',
    name: 'Bull Put Spread',
    description: 'Sell higher put, buy lower put. Defined risk bullish credit spread.',
    category: 'Spreads',
    riskProfile: 'defined',
    legPattern: [
      { side: 'sell', type: 'put', strikeRef: 'ATM', quantity: 1 },
      { side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
    ],
  },
  {
    id: 'bear-call-spread',
    name: 'Bear Call Spread',
    description: 'Sell lower call, buy higher call. Defined risk bearish credit spread.',
    category: 'Spreads',
    riskProfile: 'defined',
    legPattern: [
      { side: 'sell', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
    ],
  },

  // ── Income ───────────────────────────────────────────────────────────────
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    description: 'Sell OTM put spread + sell OTM call spread. Profit when price stays in range.',
    category: 'Income',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'put', strikeRef: 'ATM-10', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM+10', quantity: 1 },
    ],
  },
  {
    id: 'iron-butterfly',
    name: 'Iron Butterfly',
    description: 'Sell ATM straddle + buy OTM strangle. Max profit at the center strike.',
    category: 'Income',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
    ],
  },
  {
    id: 'short-straddle',
    name: 'Short Straddle',
    description: 'Sell ATM call + ATM put. Profit when stock stays near strike. Undefined risk.',
    category: 'Income',
    riskProfile: 'undefined',
    legPattern: [
      { side: 'sell', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM', quantity: 1 },
    ],
  },
  {
    id: 'short-strangle',
    name: 'Short Strangle',
    description: 'Sell OTM call + OTM put. Wider profit zone than straddle. Undefined risk.',
    category: 'Income',
    riskProfile: 'undefined',
    legPattern: [
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
    ],
  },

  // ── Volatility ───────────────────────────────────────────────────────────
  {
    id: 'long-straddle',
    name: 'Long Straddle',
    description: 'Buy ATM call + ATM put. Profit from a large move in either direction.',
    category: 'Volatility',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'buy', type: 'put', strikeRef: 'ATM', quantity: 1 },
    ],
  },
  {
    id: 'long-strangle',
    name: 'Long Strangle',
    description: 'Buy OTM call + OTM put. Cheaper than straddle; needs a bigger move.',
    category: 'Volatility',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
    ],
  },
  {
    id: 'reverse-iron-condor',
    name: 'Reverse Iron Condor',
    description: 'Buy OTM put spread + buy OTM call spread. Profit from big move either way.',
    category: 'Volatility',
    riskProfile: 'defined',
    legPattern: [
      { side: 'sell', type: 'put', strikeRef: 'ATM-10', quantity: 1 },
      { side: 'buy', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+10', quantity: 1 },
    ],
  },

  // ── Calendar ─────────────────────────────────────────────────────────────
  {
    id: 'calendar-spread',
    name: 'Calendar Spread',
    description: 'Sell near-term call, buy same-strike longer-term call. Profit from time decay.',
    category: 'Calendar',
    riskProfile: 'defined',
    legPattern: [
      { side: 'sell', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 },
    ],
  },
  {
    id: 'diagonal-spread',
    name: 'Diagonal Spread',
    description: 'Sell near-term OTM call, buy longer-term ITM call. Directional calendar.',
    category: 'Calendar',
    riskProfile: 'defined',
    legPattern: [
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM-2', quantity: 1 },
    ],
  },

  // ── Advanced ─────────────────────────────────────────────────────────────
  {
    id: 'jade-lizard',
    name: 'Jade Lizard',
    description: 'Sell OTM put + sell call spread. No upside risk if credit > call spread width.',
    category: 'Advanced',
    riskProfile: 'mixed',
    legPattern: [
      { side: 'sell', type: 'put', strikeRef: 'ATM-5', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+3', quantity: 1 },
      { side: 'buy', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
    ],
  },
  {
    id: 'broken-wing-butterfly',
    name: 'Broken Wing Butterfly',
    description:
      'Unbalanced butterfly — skip-strike on one wing. Directional bias with defined risk.',
    category: 'Advanced',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'put', strikeRef: 'ATM-10', quantity: 1 },
      { side: 'sell', type: 'put', strikeRef: 'ATM-5', quantity: 2 },
      { side: 'buy', type: 'put', strikeRef: 'ATM', quantity: 1 },
    ],
  },
  {
    id: 'ratio-spread',
    name: 'Ratio Spread',
    description: 'Buy 1 call, sell 2 higher calls. Net credit or small debit; undefined upside risk.',
    category: 'Advanced',
    riskProfile: 'undefined',
    legPattern: [
      { side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 2 },
    ],
  },
  {
    id: 'christmas-tree',
    name: 'Christmas Tree',
    description: 'Buy 1 ATM call, sell 1 OTM call, sell 1 further OTM call. Cheap directional play.',
    category: 'Advanced',
    riskProfile: 'defined',
    legPattern: [
      { side: 'buy', type: 'call', strikeRef: 'ATM', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+5', quantity: 1 },
      { side: 'sell', type: 'call', strikeRef: 'ATM+10', quantity: 1 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Template Utilities
// ---------------------------------------------------------------------------

/**
 * Get templates grouped by category.
 */
export function getTemplatesByCategory(): Record<string, StrategyTemplate[]> {
  const grouped: Record<string, StrategyTemplate[]> = {}
  for (const template of STRATEGY_TEMPLATES) {
    if (!grouped[template.category]) {
      grouped[template.category] = []
    }
    grouped[template.category]!.push(template)
  }
  return grouped
}

/**
 * Find a template by its id.
 */
export function getTemplateById(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.id === id)
}

// ---------------------------------------------------------------------------
// Strike Resolution
// ---------------------------------------------------------------------------

/**
 * Parse a StrikeReference like "ATM+5" into an offset number.
 * "ATM" → 0, "ATM+5" → +5, "ATM-10" → -10
 */
function parseStrikeOffset(ref: StrikeReference): number {
  if (ref === 'ATM') return 0
  const match = ref.match(/^ATM([+-]\d+)$/)
  return match ? parseInt(match[1]!, 10) : 0
}

/**
 * Find the closest available strike to a target price in a chain.
 */
function findClosestStrike(strikes: Strike[], targetPrice: number): Strike | undefined {
  let closest: Strike | undefined
  let minDiff = Infinity
  for (const strike of strikes) {
    const diff = Math.abs(strike.price - targetPrice)
    if (diff < minDiff) {
      minDiff = diff
      closest = strike
    }
  }
  return closest
}

/**
 * Resolve a StrikeReference to an actual strike price from the chain.
 *
 * The offset represents "number of strikes away from ATM" rather than
 * dollar amounts — so ATM+5 means the 5th strike above ATM, not ATM + $5.
 */
function resolveStrikeRef(
  ref: StrikeReference,
  atmStrike: Strike,
  sortedStrikes: Strike[],
): Strike | undefined {
  const offset = parseStrikeOffset(ref)
  if (offset === 0) return atmStrike

  const atmIdx = sortedStrikes.findIndex((s) => s.price === atmStrike.price)
  if (atmIdx === -1) return undefined

  const targetIdx = atmIdx + offset
  if (targetIdx < 0 || targetIdx >= sortedStrikes.length) {
    // Clamp to first or last available strike
    return sortedStrikes[Math.max(0, Math.min(targetIdx, sortedStrikes.length - 1))]
  }
  return sortedStrikes[targetIdx]
}

/**
 * Get the mid price for a contract (average of bid/ask), with fallback to last price.
 */
function getMidPrice(contract: OptionsContract | undefined): number {
  if (!contract) return 0
  if (contract.bid > 0 && contract.ask > 0) {
    return (contract.bid + contract.ask) / 2
  }
  return contract.last
}

let legIdCounter = 0

/**
 * Generate a unique leg ID.
 */
function generateLegId(): string {
  legIdCounter += 1
  return `leg-${Date.now()}-${legIdCounter}`
}

/**
 * Build a concrete Strategy from a StrategyTemplate and live chain data.
 *
 * Resolves relative strike references (ATM, ATM+5, etc.) to real strikes
 * from the options chain and pulls live premiums from the chain data.
 */
export function buildStrategyFromTemplate(
  template: StrategyTemplate,
  chainData: OptionsChainData,
): Strategy {
  const sortedStrikes = [...chainData.strikes].sort((a, b) => a.price - b.price)
  const atmStrike = findClosestStrike(sortedStrikes, chainData.underlyingPrice)

  if (!atmStrike || sortedStrikes.length === 0) {
    return {
      name: template.name,
      legs: [],
      underlyingPrice: chainData.underlyingPrice,
    }
  }

  const legs: StrategyLeg[] = []

  for (const pattern of template.legPattern) {
    const resolvedStrike = resolveStrikeRef(pattern.strikeRef, atmStrike, sortedStrikes)
    if (!resolvedStrike) continue

    // Get the appropriate contract (call or put)
    const contract = pattern.type === 'call' ? resolvedStrike.call : resolvedStrike.put
    const premium = getMidPrice(contract)

    const leg: StrategyLeg = {
      id: generateLegId(),
      side: pattern.side,
      type: pattern.type,
      strike: resolvedStrike.price,
      expiration: chainData.expiration,
      quantity: pattern.quantity,
      premium,
      greeks: contract?.greeks,
    }

    legs.push(leg)
  }

  return {
    name: template.name,
    legs,
    underlyingPrice: chainData.underlyingPrice,
  }
}
