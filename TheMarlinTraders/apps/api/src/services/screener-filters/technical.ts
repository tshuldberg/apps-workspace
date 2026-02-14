import type { ScreenerFilter } from '../../db/schema/screeners.js'
import type { FilterDefinition } from './fundamental.js'

/**
 * Technical indicator filter definitions for stock screener.
 * These filters reference computed indicator values rather than raw DB columns.
 */

export const TECHNICAL_FILTERS: FilterDefinition[] = [
  // Moving Averages - Position
  { field: 'price_vs_sma_20', label: 'Price vs SMA(20)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%', description: '% above/below SMA 20' },
  { field: 'price_vs_sma_50', label: 'Price vs SMA(50)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%', description: '% above/below SMA 50' },
  { field: 'price_vs_sma_200', label: 'Price vs SMA(200)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%', description: '% above/below SMA 200' },
  { field: 'price_vs_ema_9', label: 'Price vs EMA(9)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%' },
  { field: 'price_vs_ema_21', label: 'Price vs EMA(21)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%' },
  { field: 'sma_20_vs_sma_50', label: 'SMA(20) vs SMA(50)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%', description: 'Golden/Death cross proximity' },
  { field: 'sma_50_vs_sma_200', label: 'SMA(50) vs SMA(200)', category: 'technical', operators: ['gt', 'lt'], valueType: 'number', unit: '%' },

  // RSI
  { field: 'rsi_14', label: 'RSI(14)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'rsi_7', label: 'RSI(7)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // MACD
  { field: 'macd_signal', label: 'MACD Signal', category: 'technical', operators: ['eq'], valueType: 'string', description: 'bullish_cross, bearish_cross, above, below' },
  { field: 'macd_histogram', label: 'MACD Histogram', category: 'technical', operators: ['gt', 'lt'], valueType: 'number' },

  // Stochastic
  { field: 'stoch_k', label: 'Stochastic %K', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'stoch_d', label: 'Stochastic %D', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // Volume
  { field: 'volume_vs_avg_20', label: 'Volume vs 20d Avg', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte'], valueType: 'number', unit: 'x', description: 'Multiple of 20-day avg volume' },
  { field: 'volume_surge', label: 'Volume Surge %', category: 'technical', operators: ['gt', 'gte'], valueType: 'number', unit: '%', description: '% above average volume' },
  { field: 'obv_trend', label: 'OBV Trend', category: 'technical', operators: ['eq'], valueType: 'string', description: 'rising, falling, flat' },

  // Bollinger Bands
  { field: 'bb_position', label: 'Bollinger Position', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', description: '0 = lower band, 0.5 = middle, 1 = upper band' },
  { field: 'bb_width', label: 'Bollinger Width %', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'bb_squeeze', label: 'Bollinger Squeeze', category: 'technical', operators: ['eq'], valueType: 'string', description: 'true, false' },

  // ATR
  { field: 'atr_14', label: 'ATR(14)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'atr_percent', label: 'ATR % of Price', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },

  // CCI
  { field: 'cci_20', label: 'CCI(20)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // Williams %R
  { field: 'williams_r_14', label: 'Williams %R(14)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // ADX
  { field: 'adx_14', label: 'ADX(14)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', description: 'Trend strength' },

  // MFI
  { field: 'mfi_14', label: 'MFI(14)', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // Supertrend
  { field: 'supertrend_signal', label: 'Supertrend Signal', category: 'technical', operators: ['eq'], valueType: 'string', description: 'buy, sell' },

  // Ichimoku
  { field: 'ichimoku_cloud', label: 'Ichimoku Cloud', category: 'technical', operators: ['eq'], valueType: 'string', description: 'above, below, inside' },

  // Parabolic SAR
  { field: 'sar_signal', label: 'Parabolic SAR', category: 'technical', operators: ['eq'], valueType: 'string', description: 'bullish, bearish' },

  // Aroon
  { field: 'aroon_oscillator', label: 'Aroon Oscillator', category: 'technical', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
]

/**
 * Translate a technical filter to a SQL condition against a pre-computed
 * technicals JSONB column or CTE.
 */
export function buildTechnicalCondition(
  filter: ScreenerFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  const col = sanitizeTechnicalField(filter.field)

  switch (filter.operator) {
    case 'gt':
      return { sql: `(technicals->>'${col}')::numeric > $${paramOffset + 1}`, params: [filter.value] }
    case 'gte':
      return { sql: `(technicals->>'${col}')::numeric >= $${paramOffset + 1}`, params: [filter.value] }
    case 'lt':
      return { sql: `(technicals->>'${col}')::numeric < $${paramOffset + 1}`, params: [filter.value] }
    case 'lte':
      return { sql: `(technicals->>'${col}')::numeric <= $${paramOffset + 1}`, params: [filter.value] }
    case 'eq':
      return { sql: `technicals->>'${col}' = $${paramOffset + 1}`, params: [filter.value] }
    case 'neq':
      return { sql: `technicals->>'${col}' != $${paramOffset + 1}`, params: [filter.value] }
    case 'between': {
      const range = filter.value as number[]
      return {
        sql: `(technicals->>'${col}')::numeric BETWEEN $${paramOffset + 1} AND $${paramOffset + 2}`,
        params: [range[0], range[1]],
      }
    }
    case 'in': {
      const values = filter.value as (string | number)[]
      const placeholders = values.map((_, i) => `$${paramOffset + i + 1}`).join(', ')
      return {
        sql: `technicals->>'${col}' IN (${placeholders})`,
        params: values,
      }
    }
  }
}

const VALID_TECHNICAL_FIELDS = new Set(TECHNICAL_FILTERS.map((f) => f.field))

function sanitizeTechnicalField(field: string): string {
  if (!VALID_TECHNICAL_FIELDS.has(field)) {
    throw new Error(`Invalid technical filter field: ${field}`)
  }
  return field
}

export function isTechnicalFilter(field: string): boolean {
  return VALID_TECHNICAL_FIELDS.has(field)
}
