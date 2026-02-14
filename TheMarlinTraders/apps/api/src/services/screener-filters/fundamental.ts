import type { ScreenerFilter } from '../../db/schema/screeners.js'

/**
 * Fundamental filter definitions for stock screener.
 * Each filter maps to a field name, display label, and valid operators.
 */

export interface FilterDefinition {
  field: string
  label: string
  category: 'fundamental' | 'technical' | 'price_action'
  operators: ScreenerFilter['operator'][]
  valueType: 'number' | 'string' | 'number_range' | 'string_list'
  unit?: string
  description?: string
}

export const FUNDAMENTAL_FILTERS: FilterDefinition[] = [
  // Market cap
  { field: 'market_cap', label: 'Market Cap', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '$' },
  { field: 'market_cap_class', label: 'Market Cap Class', category: 'fundamental', operators: ['eq', 'in'], valueType: 'string_list', description: 'mega, large, mid, small, micro, nano' },

  // Valuation
  { field: 'pe_ratio', label: 'P/E Ratio', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'forward_pe', label: 'Forward P/E', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'peg_ratio', label: 'PEG Ratio', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'price_to_sales', label: 'Price/Sales', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'price_to_book', label: 'Price/Book', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'ev_to_ebitda', label: 'EV/EBITDA', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },

  // Earnings & Revenue
  { field: 'eps', label: 'EPS (TTM)', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '$' },
  { field: 'eps_growth', label: 'EPS Growth %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'revenue', label: 'Revenue (TTM)', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '$' },
  { field: 'revenue_growth', label: 'Revenue Growth %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'profit_margin', label: 'Profit Margin %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'operating_margin', label: 'Operating Margin %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },

  // Dividends
  { field: 'dividend_yield', label: 'Dividend Yield %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'dividend_payout_ratio', label: 'Payout Ratio %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },

  // Financial health
  { field: 'debt_to_equity', label: 'Debt/Equity', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'current_ratio', label: 'Current Ratio', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number' },
  { field: 'roe', label: 'ROE %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },
  { field: 'roa', label: 'ROA %', category: 'fundamental', operators: ['gt', 'gte', 'lt', 'lte', 'between'], valueType: 'number', unit: '%' },

  // Classification
  { field: 'sector', label: 'Sector', category: 'fundamental', operators: ['eq', 'in'], valueType: 'string_list' },
  { field: 'industry', label: 'Industry', category: 'fundamental', operators: ['eq', 'in'], valueType: 'string_list' },
  { field: 'exchange', label: 'Exchange', category: 'fundamental', operators: ['eq', 'in'], valueType: 'string_list' },
  { field: 'country', label: 'Country', category: 'fundamental', operators: ['eq', 'in'], valueType: 'string_list' },
]

/**
 * Translate a fundamental filter to a SQL WHERE clause fragment.
 * Returns [clause, params] for parameterized queries.
 */
export function buildFundamentalCondition(
  filter: ScreenerFilter,
): { sql: string; params: unknown[] } {
  const col = sanitizeColumnName(filter.field)

  switch (filter.operator) {
    case 'gt':
      return { sql: `${col} > $1`, params: [filter.value] }
    case 'gte':
      return { sql: `${col} >= $1`, params: [filter.value] }
    case 'lt':
      return { sql: `${col} < $1`, params: [filter.value] }
    case 'lte':
      return { sql: `${col} <= $1`, params: [filter.value] }
    case 'eq':
      return { sql: `${col} = $1`, params: [filter.value] }
    case 'neq':
      return { sql: `${col} != $1`, params: [filter.value] }
    case 'between': {
      const range = filter.value as number[]
      return { sql: `${col} BETWEEN $1 AND $2`, params: [range[0], range[1]] }
    }
    case 'in': {
      const values = filter.value as (string | number)[]
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
      return { sql: `${col} IN (${placeholders})`, params: values }
    }
  }
}

/** Allowlist of valid fundamental column names to prevent SQL injection */
const VALID_COLUMNS = new Set(FUNDAMENTAL_FILTERS.map((f) => f.field))

function sanitizeColumnName(field: string): string {
  if (!VALID_COLUMNS.has(field)) {
    throw new Error(`Invalid fundamental filter field: ${field}`)
  }
  return `"${field}"`
}

export function isFundamentalFilter(field: string): boolean {
  return VALID_COLUMNS.has(field)
}
