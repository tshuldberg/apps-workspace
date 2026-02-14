/**
 * NLP Query Parser
 * Sprints 31-32: AI Chart Analysis
 *
 * Parses natural language trading queries into structured screener filters.
 * Keyword-based approach — no LLM dependency required.
 */

import type { ScreenerFilter, NLPQuery } from '@marlin/shared'

// ── Keyword Rules ──────────────────────────────────────────────────────────

interface KeywordRule {
  /** Patterns to match (case-insensitive). First match wins. */
  patterns: RegExp[]
  /** Filters generated when the pattern matches */
  filters: ScreenerFilter[]
  /** Indicators implied by this keyword */
  indicators: string[]
  /** Recommended action */
  action?: 'chart' | 'screen' | 'alert'
}

const KEYWORD_RULES: KeywordRule[] = [
  // ─── RSI ─────────────────────────────────────────
  {
    patterns: [/\boversold\b/i],
    filters: [
      { field: 'rsi_14', operator: 'lt', value: 30, category: 'technical' },
    ],
    indicators: ['RSI'],
    action: 'screen',
  },
  {
    patterns: [/\boverbought\b/i],
    filters: [
      { field: 'rsi_14', operator: 'gt', value: 70, category: 'technical' },
    ],
    indicators: ['RSI'],
    action: 'screen',
  },

  // ─── Market Cap ──────────────────────────────────
  {
    patterns: [/\blarge[\s-]?caps?\b/i, /\blarge[\s-]?cap\b/i],
    filters: [
      { field: 'market_cap', operator: 'gt', value: 10_000_000_000, category: 'fundamental' },
    ],
    indicators: [],
    action: 'screen',
  },
  {
    patterns: [/\bmid[\s-]?caps?\b/i, /\bmid[\s-]?cap\b/i],
    filters: [
      { field: 'market_cap', operator: 'between', value: [2_000_000_000, 10_000_000_000], category: 'fundamental' },
    ],
    indicators: [],
    action: 'screen',
  },
  {
    patterns: [/\bsmall[\s-]?caps?\b/i, /\bsmall[\s-]?cap\b/i],
    filters: [
      { field: 'market_cap', operator: 'lt', value: 2_000_000_000, category: 'fundamental' },
    ],
    indicators: [],
    action: 'screen',
  },

  // ─── Breakout ────────────────────────────────────
  {
    patterns: [/\bbreaking\s*out\b/i, /\bbreakout\b/i],
    filters: [
      { field: 'price_vs_20d_high', operator: 'gt', value: 0, category: 'price_action' },
      { field: 'volume_ratio_20d', operator: 'gt', value: 1.5, category: 'technical' },
    ],
    indicators: ['SMA', 'Volume'],
    action: 'screen',
  },

  // ─── Trend Direction ─────────────────────────────
  {
    patterns: [/\bbullish\b/i],
    filters: [
      { field: 'price_vs_sma50', operator: 'gt', value: 0, category: 'technical' },
      { field: 'sma50_vs_sma200', operator: 'gt', value: 0, category: 'technical' },
    ],
    indicators: ['SMA'],
    action: 'screen',
  },
  {
    patterns: [/\bbearish\b/i],
    filters: [
      { field: 'price_vs_sma50', operator: 'lt', value: 0, category: 'technical' },
      { field: 'sma50_vs_sma200', operator: 'lt', value: 0, category: 'technical' },
    ],
    indicators: ['SMA'],
    action: 'screen',
  },

  // ─── Volume ──────────────────────────────────────
  {
    patterns: [/\bhigh\s*volume\b/i, /\bheavy\s*volume\b/i],
    filters: [
      { field: 'volume_ratio_20d', operator: 'gt', value: 2, category: 'technical' },
    ],
    indicators: ['Volume'],
    action: 'screen',
  },

  // ─── Gaps ────────────────────────────────────────
  {
    patterns: [/\bgap\s*up\b/i, /\bgapped\s*up\b/i],
    filters: [
      { field: 'gap_percent', operator: 'gt', value: 3, category: 'price_action' },
    ],
    indicators: [],
    action: 'screen',
  },
  {
    patterns: [/\bgap\s*down\b/i, /\bgapped\s*down\b/i],
    filters: [
      { field: 'gap_percent', operator: 'lt', value: -3, category: 'price_action' },
    ],
    indicators: [],
    action: 'screen',
  },

  // ─── 52-Week Levels ──────────────────────────────
  {
    patterns: [/\bnear\s*52[\s-]?week\s*high\b/i, /\b52[\s-]?week\s*high\b/i],
    filters: [
      { field: 'pct_from_52w_high', operator: 'gte', value: -5, category: 'price_action' },
    ],
    indicators: [],
    action: 'screen',
  },
  {
    patterns: [/\bnear\s*52[\s-]?week\s*low\b/i, /\b52[\s-]?week\s*low\b/i],
    filters: [
      { field: 'pct_from_52w_low', operator: 'lte', value: 5, category: 'price_action' },
    ],
    indicators: [],
    action: 'screen',
  },

  // ─── MACD ────────────────────────────────────────
  {
    patterns: [/\bmacd\s*cross(over)?\b/i, /\bmacd\s*bullish\b/i],
    filters: [
      { field: 'macd_signal', operator: 'gt', value: 0, category: 'technical' },
    ],
    indicators: ['MACD'],
    action: 'screen',
  },

  // ─── Golden / Death Cross ────────────────────────
  {
    patterns: [/\bgolden\s*cross\b/i],
    filters: [
      { field: 'sma50_vs_sma200', operator: 'gt', value: 0, category: 'technical' },
    ],
    indicators: ['SMA'],
    action: 'screen',
  },
  {
    patterns: [/\bdeath\s*cross\b/i],
    filters: [
      { field: 'sma50_vs_sma200', operator: 'lt', value: 0, category: 'technical' },
    ],
    indicators: ['SMA'],
    action: 'screen',
  },

  // ─── Specific symbols ───────────────────────────
  {
    patterns: [/\bchart\b/i, /\bshow\s*me\b/i, /\bpull\s*up\b/i],
    filters: [],
    indicators: [],
    action: 'chart',
  },
  {
    patterns: [/\balert\b/i, /\bnotify\b/i, /\bwatch\b/i],
    filters: [],
    indicators: [],
    action: 'alert',
  },
]

// ── Symbol Extraction ──────────────────────────────────────────────────────

const TICKER_REGEX = /\b[A-Z]{1,5}\b/g
const COMMON_WORDS = new Set([
  'I', 'A', 'AT', 'IN', 'ON', 'THE', 'AND', 'OR', 'FOR', 'TO', 'OF',
  'IS', 'IT', 'BY', 'IF', 'UP', 'AS', 'ME', 'MY', 'DO', 'NO', 'SO',
  'AN', 'BE', 'ALL', 'HAS', 'HAD', 'ARE', 'NOT', 'BUT', 'CAN', 'MAY',
  'RSI', 'SMA', 'EMA', 'MACD', 'P', 'E', 'PE', 'PEG', 'EPS',
  'SHOW', 'GET', 'SET', 'RUN', 'HIGH', 'LOW', 'WITH', 'NEAR',
  'FIND', 'TOP', 'CAP', 'CAPS', 'VOL',
])

function extractPossibleSymbols(text: string): string[] {
  const matches = text.match(TICKER_REGEX) ?? []
  return matches.filter((m) => !COMMON_WORDS.has(m) && m.length >= 2)
}

// ── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse a natural language trading query into structured filters.
 */
export function parseNLPQuery(text: string): NLPQuery {
  const normalizedText = text.trim()
  const allFilters: ScreenerFilter[] = []
  const allIndicators = new Set<string>()
  const allActions = new Set<'chart' | 'screen' | 'alert'>()

  // Apply keyword rules
  for (const rule of KEYWORD_RULES) {
    const matched = rule.patterns.some((p) => p.test(normalizedText))
    if (!matched) continue

    for (const filter of rule.filters) {
      // Avoid duplicate filters
      const isDuplicate = allFilters.some(
        (f) => f.field === filter.field && f.operator === filter.operator,
      )
      if (!isDuplicate) {
        allFilters.push({ ...filter })
      }
    }

    for (const ind of rule.indicators) {
      allIndicators.add(ind)
    }

    if (rule.action) {
      allActions.add(rule.action)
    }
  }

  // Extract possible ticker symbols (for chart action)
  const symbols = extractPossibleSymbols(normalizedText)
  if (symbols.length > 0 && allActions.has('chart')) {
    // If "chart" action detected and symbols found, the intent is to chart them
  }

  // Default action if none detected
  if (allActions.size === 0) {
    if (allFilters.length > 0) {
      allActions.add('screen')
    } else if (symbols.length > 0) {
      allActions.add('chart')
    } else {
      allActions.add('screen')
    }
  }

  return {
    rawText: normalizedText,
    parsedFilters: allFilters,
    parsedIndicators: Array.from(allIndicators),
    parsedActions: Array.from(allActions),
  }
}

/**
 * Get example NLP queries for placeholder text.
 */
export function getNLPExamples(): string[] {
  return [
    'Show me oversold large-caps breaking out',
    'Bullish stocks near 52-week high with high volume',
    'Small-cap stocks that gapped up today',
    'Overbought tech stocks with MACD crossover',
    'Chart AAPL',
    'Find bearish stocks with death cross',
  ]
}
