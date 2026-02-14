import { sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { symbols } from '../db/schema/symbols.js'
import type { ScreenerFilter, ScreenerFilterSet } from '../db/schema/screeners.js'
import { isFundamentalFilter, isTechnicalFilter, isPriceActionFilter } from './screener-filters/index.js'
import { getUserTier, meetsMinimumTier } from '../middleware/tier-guard.js'
import type { PlanId } from './billing.js'

export interface ScreenerResult {
  symbol: string
  name: string
  exchange: string | null
  sector: string | null
  industry: string | null
  lastPrice: number | null
  changePercent: number | null
  volume: number | null
  marketCap: number | null
}

export interface ScanOutput {
  results: ScreenerResult[]
  total: number
  isDelayed: boolean
  appliedFilters: number
  executionMs: number
}

export interface ScanOptions {
  filters: ScreenerFilterSet
  limit?: number
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  clerkUserId?: string
}

/**
 * The screener engine translates a ScreenerFilterSet into a PostgreSQL query,
 * executes it, and returns matching symbols with metadata.
 *
 * Tier enforcement:
 * - free: results are flagged as delayed (15-min)
 * - pro+: real-time data
 */
export async function runScreenerScan(options: ScanOptions): Promise<ScanOutput> {
  const start = performance.now()
  const { filters, limit = 50, offset = 0, sortBy = 'symbol', sortDir = 'asc' } = options

  // Tier check
  let isDelayed = true
  if (options.clerkUserId) {
    const userTier = await getUserTier(options.clerkUserId)
    isDelayed = !meetsMinimumTier(userTier, 'pro')
  }

  // Build WHERE conditions
  const { whereClauses, params } = buildWhereFromFilters(filters)

  // Construct the query
  const whereSQL = whereClauses.length > 0
    ? `WHERE s.is_active = true AND (${whereClauses.join(filters.logic === 'OR' ? ' OR ' : ' AND ')})`
    : 'WHERE s.is_active = true'

  const validSortColumns: Record<string, string> = {
    symbol: 's.symbol',
    name: 's.name',
    market_cap: 's.market_cap',
    exchange: 's.exchange',
    sector: 's.sector',
  }
  const sortColumn = validSortColumns[sortBy] ?? 's.symbol'
  const direction = sortDir === 'desc' ? 'DESC' : 'ASC'

  const countQuery = `SELECT COUNT(*) as total FROM symbols s ${whereSQL}`
  const dataQuery = `
    SELECT
      s.symbol,
      s.name,
      s.exchange,
      s.sector,
      s.industry,
      s.market_cap as "marketCap"
    FROM symbols s
    ${whereSQL}
    ORDER BY ${sortColumn} ${direction}
    LIMIT ${limit}
    OFFSET ${offset}
  `

  // Execute queries
  const [countResult, dataResult] = await Promise.all([
    db.execute(sql.raw(countQuery)),
    db.execute(sql.raw(dataQuery)),
  ])

  const total = Number((countResult as any).rows?.[0]?.total ?? 0)
  const rows = ((dataResult as any).rows ?? []) as Array<{
    symbol: string
    name: string
    exchange: string | null
    sector: string | null
    industry: string | null
    marketCap: string | null
  }>

  const results: ScreenerResult[] = rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    industry: row.industry,
    lastPrice: null,
    changePercent: null,
    volume: null,
    marketCap: row.marketCap ? Number(row.marketCap) : null,
  }))

  const executionMs = Math.round(performance.now() - start)

  return {
    results,
    total,
    isDelayed,
    appliedFilters: filters.filters.length,
    executionMs,
  }
}

/**
 * Build parameterized WHERE clauses from the filter set.
 * Separates fundamental (direct column) from technical/price-action (JSONB).
 */
function buildWhereFromFilters(filterSet: ScreenerFilterSet): {
  whereClauses: string[]
  params: unknown[]
} {
  const whereClauses: string[] = []
  const params: unknown[] = []

  for (const filter of filterSet.filters) {
    const clause = buildSingleFilter(filter, params.length)
    if (clause) {
      whereClauses.push(clause.sql)
      params.push(...clause.params)
    }
  }

  return { whereClauses, params }
}

function buildSingleFilter(
  filter: ScreenerFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } | null {
  if (isFundamentalFilter(filter.field)) {
    return buildFundamentalSQL(filter, paramOffset)
  }
  if (isTechnicalFilter(filter.field)) {
    // Technical filters query against a materialized technicals view/column
    return buildJsonbCondition('technicals', filter, paramOffset)
  }
  if (isPriceActionFilter(filter.field)) {
    return buildJsonbCondition('price_action', filter, paramOffset)
  }
  return null
}

/** Builds SQL for fundamental columns that map directly to the symbols table */
function buildFundamentalSQL(
  filter: ScreenerFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  // Map filter fields to actual symbols table columns
  const columnMap: Record<string, string> = {
    market_cap: 's.market_cap',
    sector: 's.sector',
    industry: 's.industry',
    exchange: 's.exchange',
  }

  const col = columnMap[filter.field]
  if (!col) {
    // For fields not yet in the symbols table, skip silently
    return { sql: 'TRUE', params: [] }
  }

  switch (filter.operator) {
    case 'gt':
      return { sql: `${col}::numeric > $${paramOffset + 1}`, params: [filter.value] }
    case 'gte':
      return { sql: `${col}::numeric >= $${paramOffset + 1}`, params: [filter.value] }
    case 'lt':
      return { sql: `${col}::numeric < $${paramOffset + 1}`, params: [filter.value] }
    case 'lte':
      return { sql: `${col}::numeric <= $${paramOffset + 1}`, params: [filter.value] }
    case 'eq':
      return { sql: `${col} = $${paramOffset + 1}`, params: [filter.value] }
    case 'neq':
      return { sql: `${col} != $${paramOffset + 1}`, params: [filter.value] }
    case 'between': {
      const range = filter.value as number[]
      return { sql: `${col}::numeric BETWEEN $${paramOffset + 1} AND $${paramOffset + 2}`, params: [range[0], range[1]] }
    }
    case 'in': {
      const values = filter.value as (string | number)[]
      const placeholders = values.map((_, i) => `$${paramOffset + i + 1}`).join(', ')
      return { sql: `${col} IN (${placeholders})`, params: values }
    }
  }
}

/** Generic JSONB condition builder for technical and price-action filters */
function buildJsonbCondition(
  jsonbColumn: string,
  filter: ScreenerFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  const field = filter.field

  switch (filter.operator) {
    case 'gt':
      return { sql: `(s.${jsonbColumn}->>'${field}')::numeric > $${paramOffset + 1}`, params: [filter.value] }
    case 'gte':
      return { sql: `(s.${jsonbColumn}->>'${field}')::numeric >= $${paramOffset + 1}`, params: [filter.value] }
    case 'lt':
      return { sql: `(s.${jsonbColumn}->>'${field}')::numeric < $${paramOffset + 1}`, params: [filter.value] }
    case 'lte':
      return { sql: `(s.${jsonbColumn}->>'${field}')::numeric <= $${paramOffset + 1}`, params: [filter.value] }
    case 'eq':
      return { sql: `s.${jsonbColumn}->>'${field}' = $${paramOffset + 1}`, params: [filter.value] }
    case 'neq':
      return { sql: `s.${jsonbColumn}->>'${field}' != $${paramOffset + 1}`, params: [filter.value] }
    case 'between': {
      const range = filter.value as number[]
      return {
        sql: `(s.${jsonbColumn}->>'${field}')::numeric BETWEEN $${paramOffset + 1} AND $${paramOffset + 2}`,
        params: [range[0], range[1]],
      }
    }
    case 'in': {
      const values = filter.value as (string | number)[]
      const placeholders = values.map((_, i) => `$${paramOffset + i + 1}`).join(', ')
      return { sql: `s.${jsonbColumn}->>'${field}' IN (${placeholders})`, params: values }
    }
  }
}

/**
 * Get the available filter definitions grouped by category.
 * Used by the UI to render the filter builder.
 */
export function getFilterDefinitions() {
  // Lazy import to avoid circular deps
  const { FUNDAMENTAL_FILTERS } = require('./screener-filters/fundamental.js')
  const { TECHNICAL_FILTERS } = require('./screener-filters/technical.js')
  const { PRICE_ACTION_FILTERS } = require('./screener-filters/price-action.js')

  return {
    fundamental: FUNDAMENTAL_FILTERS,
    technical: TECHNICAL_FILTERS,
    price_action: PRICE_ACTION_FILTERS,
  }
}
