import type { ScreenerFilterSet } from '../db/schema/screeners.js'

export interface ScreenerTemplate {
  id: string
  name: string
  description: string
  category: 'momentum' | 'value' | 'breakout' | 'income' | 'volatility' | 'volume'
  filters: ScreenerFilterSet
}

export const SCREENER_TEMPLATES: ScreenerTemplate[] = [
  // ── Momentum ──────────────────────────────────────────────
  {
    id: 'gap-scanner',
    name: 'Gap Scanner',
    description: 'Stocks gapping up or down more than 3% at open with above-average volume',
    category: 'momentum',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'gap_pct', operator: 'gt', value: 3, category: 'price_action' },
        { field: 'volume_vs_avg_20', operator: 'gt', value: 1.5, category: 'technical' },
      ],
    },
  },
  {
    id: 'momentum-scanner',
    name: 'Momentum Scanner',
    description: 'Strong uptrend: RSI 50-70, price above SMA(20) and SMA(50), positive 1M change',
    category: 'momentum',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'rsi_14', operator: 'between', value: [50, 70], category: 'technical' },
        { field: 'price_vs_sma_20', operator: 'gt', value: 0, category: 'technical' },
        { field: 'price_vs_sma_50', operator: 'gt', value: 0, category: 'technical' },
        { field: 'change_1m', operator: 'gt', value: 5, category: 'price_action' },
      ],
    },
  },
  {
    id: 'gap-down-reversal',
    name: 'Gap Down Reversal',
    description: 'Stocks that gapped down but are recovering with strong volume',
    category: 'momentum',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'gap_direction', operator: 'eq', value: 'down', category: 'price_action' },
        { field: 'change_1d', operator: 'gt', value: 0, category: 'price_action' },
        { field: 'volume_vs_avg_20', operator: 'gt', value: 2, category: 'technical' },
      ],
    },
  },

  // ── Breakout ──────────────────────────────────────────────
  {
    id: 'breakout-scanner',
    name: 'Breakout Scanner',
    description: 'Stocks near 52-week highs with volume surge and rising ADX',
    category: 'breakout',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'high_52w_pct', operator: 'lt', value: 3, category: 'price_action' },
        { field: 'volume_surge', operator: 'gt', value: 50, category: 'technical' },
        { field: 'adx_14', operator: 'gt', value: 25, category: 'technical' },
      ],
    },
  },
  {
    id: 'bollinger-squeeze',
    name: 'Bollinger Squeeze Breakout',
    description: 'Bollinger Bands contracting (potential breakout), volume starting to increase',
    category: 'breakout',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'bb_squeeze', operator: 'eq', value: 'true', category: 'technical' },
        { field: 'volume_vs_avg_20', operator: 'gt', value: 1.2, category: 'technical' },
        { field: 'adx_14', operator: 'lt', value: 20, category: 'technical' },
      ],
    },
  },
  {
    id: 'golden-cross',
    name: 'Golden Cross',
    description: 'SMA(50) crossing above SMA(200) — classic bullish signal',
    category: 'breakout',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'sma_50_vs_sma_200', operator: 'gt', value: 0, category: 'technical' },
        { field: 'sma_50_vs_sma_200', operator: 'lt', value: 2, category: 'technical' },
        { field: 'change_1d', operator: 'gt', value: 0, category: 'price_action' },
      ],
    },
  },

  // ── Value / Oversold ──────────────────────────────────────
  {
    id: 'oversold-bounce',
    name: 'Oversold Bounce',
    description: 'RSI below 30, price near 52-week lows, potential mean reversion',
    category: 'value',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'rsi_14', operator: 'lt', value: 30, category: 'technical' },
        { field: 'low_52w_pct', operator: 'lt', value: 10, category: 'price_action' },
        { field: 'change_1d', operator: 'gt', value: 0, category: 'price_action' },
      ],
    },
  },
  {
    id: 'deep-value',
    name: 'Deep Value',
    description: 'Low P/E, strong balance sheet, positive earnings',
    category: 'value',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'pe_ratio', operator: 'lt', value: 15, category: 'fundamental' },
        { field: 'pe_ratio', operator: 'gt', value: 0, category: 'fundamental' },
        { field: 'debt_to_equity', operator: 'lt', value: 1, category: 'fundamental' },
        { field: 'eps', operator: 'gt', value: 0, category: 'fundamental' },
      ],
    },
  },
  {
    id: 'stochastic-oversold',
    name: 'Stochastic Oversold',
    description: 'Stochastic %K below 20 with positive divergence',
    category: 'value',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'stoch_k', operator: 'lt', value: 20, category: 'technical' },
        { field: 'mfi_14', operator: 'lt', value: 30, category: 'technical' },
      ],
    },
  },

  // ── Volume ────────────────────────────────────────────────
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Volume 3x+ above 20-day average — unusual activity',
    category: 'volume',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'volume_vs_avg_20', operator: 'gt', value: 3, category: 'technical' },
        { field: 'last_price', operator: 'gt', value: 1, category: 'price_action' },
      ],
    },
  },
  {
    id: 'accumulation',
    name: 'Accumulation',
    description: 'Rising OBV with price consolidation — smart money buying',
    category: 'volume',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'obv_trend', operator: 'eq', value: 'rising', category: 'technical' },
        { field: 'change_1m', operator: 'between', value: [-5, 5], category: 'price_action' },
        { field: 'volume_vs_avg_20', operator: 'gt', value: 1.3, category: 'technical' },
      ],
    },
  },

  // ── Income ────────────────────────────────────────────────
  {
    id: 'high-dividend',
    name: 'High Dividend Yield',
    description: 'Dividend yield > 4% with sustainable payout ratio',
    category: 'income',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'dividend_yield', operator: 'gt', value: 4, category: 'fundamental' },
        { field: 'dividend_payout_ratio', operator: 'lt', value: 80, category: 'fundamental' },
        { field: 'eps', operator: 'gt', value: 0, category: 'fundamental' },
      ],
    },
  },

  // ── Volatility ────────────────────────────────────────────
  {
    id: 'high-volatility',
    name: 'High Volatility Movers',
    description: 'ATR > 3% of price with strong directional movement',
    category: 'volatility',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'atr_percent', operator: 'gt', value: 3, category: 'technical' },
        { field: 'adx_14', operator: 'gt', value: 30, category: 'technical' },
        { field: 'volume_vs_avg_20', operator: 'gt', value: 1.5, category: 'technical' },
      ],
    },
  },
  {
    id: 'low-volatility-breakout',
    name: 'Low Volatility Breakout',
    description: 'Tight range stocks ready to break: low ATR, Bollinger squeeze',
    category: 'volatility',
    filters: {
      logic: 'AND',
      filters: [
        { field: 'atr_percent', operator: 'lt', value: 1.5, category: 'technical' },
        { field: 'bb_squeeze', operator: 'eq', value: 'true', category: 'technical' },
        { field: 'daily_range_pct', operator: 'lt', value: 1, category: 'price_action' },
      ],
    },
  },
]

/**
 * Get all pre-built screener templates.
 */
export function getScreenerTemplates(): ScreenerTemplate[] {
  return SCREENER_TEMPLATES
}

/**
 * Get a specific template by ID.
 */
export function getScreenerTemplate(id: string): ScreenerTemplate | undefined {
  return SCREENER_TEMPLATES.find((t) => t.id === id)
}

/**
 * Get templates grouped by category.
 */
export function getTemplatesByCategory(): Record<string, ScreenerTemplate[]> {
  const groups: Record<string, ScreenerTemplate[]> = {}
  for (const template of SCREENER_TEMPLATES) {
    const cat = template.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(template)
  }
  return groups
}
