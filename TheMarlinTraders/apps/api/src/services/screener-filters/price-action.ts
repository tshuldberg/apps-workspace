import type { ScreenerFilter } from '../../db/schema/screeners.js'
import type { FilterDefinition } from './fundamental.js'

/**
 * Price-action filter definitions for stock screener.
 * Based on computed price data rather than fundamental or indicator data.
 */

export const PRICE_ACTION_FILTERS: FilterDefinition[] = [
  // Price
  { field: 'last_price', label: 'Last Price', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '$' },

  // % Change
  { field: 'change_1d', label: 'Change % (1D)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'change_1w', label: 'Change % (1W)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'change_1m', label: 'Change % (1M)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'change_3m', label: 'Change % (3M)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'change_ytd', label: 'Change % (YTD)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'change_1y', label: 'Change % (1Y)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },

  // 52-Week Range
  { field: 'high_52w_pct', label: '52W High Proximity %', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%', description: '% below 52-week high' },
  { field: 'low_52w_pct', label: '52W Low Proximity %', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%', description: '% above 52-week low' },
  { field: 'at_52w_high', label: 'New 52W High', category: 'price_action', operators: ['eq'], valueType: 'string', description: 'true, false' },
  { field: 'at_52w_low', label: 'New 52W Low', category: 'price_action', operators: ['eq'], valueType: 'string', description: 'true, false' },

  // Gap
  { field: 'gap_pct', label: 'Gap %', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'gap_direction', label: 'Gap Direction', category: 'price_action', operators: ['eq'], valueType: 'string', description: 'up, down, none' },

  // Highs/Lows
  { field: 'new_high_days', label: 'New High (X-day)', category: 'price_action', operators: ['eq', 'gt', 'gte', 'lt', 'lte'], valueType: 'number', description: 'Number of days since last high' },
  { field: 'new_low_days', label: 'New Low (X-day)', category: 'price_action', operators: ['eq', 'gt', 'gte', 'lt', 'lte'], valueType: 'number', description: 'Number of days since last low' },

  // Candle patterns
  { field: 'candle_pattern', label: 'Candle Pattern', category: 'price_action', operators: ['eq', 'in'], valueType: 'string_list', description: 'doji, hammer, engulfing_bull, engulfing_bear, morning_star, evening_star' },

  // Volume context
  { field: 'volume_today', label: 'Volume Today', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'avg_volume_20d', label: 'Avg Volume (20d)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // Range
  { field: 'daily_range_pct', label: 'Daily Range %', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%', description: '(High - Low) / Close' },
  { field: 'avg_range_pct_5d', label: 'Avg Range % (5d)', category: 'price_action', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
]

/**
 * Translate a price-action filter to a SQL condition against a pre-computed
 * price_action JSONB column or CTE.
 */
export function buildPriceActionCondition(
  filter: ScreenerFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  const col = sanitizePriceActionField(filter.field)

  switch (filter.operator) {
    case 'gt':
      return { sql: `(price_action->>'${col}')::numeric > $${paramOffset + 1}`, params: [filter.value] }
    case 'gte':
      return { sql: `(price_action->>'${col}')::numeric >= $${paramOffset + 1}`, params: [filter.value] }
    case 'lt':
      return { sql: `(price_action->>'${col}')::numeric < $${paramOffset + 1}`, params: [filter.value] }
    case 'lte':
      return { sql: `(price_action->>'${col}')::numeric <= $${paramOffset + 1}`, params: [filter.value] }
    case 'eq':
      return { sql: `price_action->>'${col}' = $${paramOffset + 1}`, params: [filter.value] }
    case 'neq':
      return { sql: `price_action->>'${col}' != $${paramOffset + 1}`, params: [filter.value] }
    case 'between': {
      const range = filter.value as number[]
      return {
        sql: `(price_action->>'${col}')::numeric BETWEEN $${paramOffset + 1} AND $${paramOffset + 2}`,
        params: [range[0], range[1]],
      }
    }
    case 'in': {
      const values = filter.value as (string | number)[]
      const placeholders = values.map((_, i) => `$${paramOffset + i + 1}`).join(', ')
      return {
        sql: `price_action->>'${col}' IN (${placeholders})`,
        params: values,
      }
    }
  }
}

const VALID_PRICE_ACTION_FIELDS = new Set(PRICE_ACTION_FILTERS.map((f) => f.field))

function sanitizePriceActionField(field: string): string {
  if (!VALID_PRICE_ACTION_FIELDS.has(field)) {
    throw new Error(`Invalid price-action filter field: ${field}`)
  }
  return field
}

export function isPriceActionFilter(field: string): boolean {
  return VALID_PRICE_ACTION_FIELDS.has(field)
}
