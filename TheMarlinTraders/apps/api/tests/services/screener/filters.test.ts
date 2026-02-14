import { describe, it, expect } from 'vitest'
import {
  FUNDAMENTAL_FILTERS,
  TECHNICAL_FILTERS,
  PRICE_ACTION_FILTERS,
  isFundamentalFilter,
  isTechnicalFilter,
  isPriceActionFilter,
} from '../../../src/services/screener-filters/index.js'
import { buildFundamentalCondition } from '../../../src/services/screener-filters/fundamental.js'
import { buildTechnicalCondition } from '../../../src/services/screener-filters/technical.js'
import { buildPriceActionCondition } from '../../../src/services/screener-filters/price-action.js'
import type { ScreenerFilter } from '../../../src/db/schema/screeners.js'
import { getScreenerTemplates, getScreenerTemplate, getTemplatesByCategory } from '../../../src/services/screener-templates.js'

describe('Filter Definitions', () => {
  describe('FUNDAMENTAL_FILTERS', () => {
    it('has at least 20 filter definitions', () => {
      expect(FUNDAMENTAL_FILTERS.length).toBeGreaterThanOrEqual(20)
    })

    it('all filters have required properties', () => {
      for (const filter of FUNDAMENTAL_FILTERS) {
        expect(filter.field).toBeTruthy()
        expect(filter.label).toBeTruthy()
        expect(filter.category).toBe('fundamental')
        expect(filter.operators.length).toBeGreaterThan(0)
        expect(['number', 'string', 'number_range', 'string_list']).toContain(filter.valueType)
      }
    })

    it('has no duplicate field names', () => {
      const fields = FUNDAMENTAL_FILTERS.map((f) => f.field)
      expect(new Set(fields).size).toBe(fields.length)
    })
  })

  describe('TECHNICAL_FILTERS', () => {
    it('has at least 30 filter definitions', () => {
      expect(TECHNICAL_FILTERS.length).toBeGreaterThanOrEqual(30)
    })

    it('all filters have required properties', () => {
      for (const filter of TECHNICAL_FILTERS) {
        expect(filter.field).toBeTruthy()
        expect(filter.label).toBeTruthy()
        expect(filter.category).toBe('technical')
        expect(filter.operators.length).toBeGreaterThan(0)
      }
    })

    it('has no duplicate field names', () => {
      const fields = TECHNICAL_FILTERS.map((f) => f.field)
      expect(new Set(fields).size).toBe(fields.length)
    })

    it('includes RSI, MACD, and Bollinger filters', () => {
      const fields = new Set(TECHNICAL_FILTERS.map((f) => f.field))
      expect(fields.has('rsi_14')).toBe(true)
      expect(fields.has('macd_signal')).toBe(true)
      expect(fields.has('bb_position')).toBe(true)
    })
  })

  describe('PRICE_ACTION_FILTERS', () => {
    it('has at least 20 filter definitions', () => {
      expect(PRICE_ACTION_FILTERS.length).toBeGreaterThanOrEqual(20)
    })

    it('all filters have required properties', () => {
      for (const filter of PRICE_ACTION_FILTERS) {
        expect(filter.field).toBeTruthy()
        expect(filter.label).toBeTruthy()
        expect(filter.category).toBe('price_action')
        expect(filter.operators.length).toBeGreaterThan(0)
      }
    })

    it('has no duplicate field names', () => {
      const fields = PRICE_ACTION_FILTERS.map((f) => f.field)
      expect(new Set(fields).size).toBe(fields.length)
    })

    it('includes 52-week high/low and gap filters', () => {
      const fields = new Set(PRICE_ACTION_FILTERS.map((f) => f.field))
      expect(fields.has('high_52w_pct')).toBe(true)
      expect(fields.has('low_52w_pct')).toBe(true)
      expect(fields.has('gap_pct')).toBe(true)
      expect(fields.has('gap_direction')).toBe(true)
    })

    it('includes all timeframe change filters', () => {
      const fields = new Set(PRICE_ACTION_FILTERS.map((f) => f.field))
      expect(fields.has('change_1d')).toBe(true)
      expect(fields.has('change_1w')).toBe(true)
      expect(fields.has('change_1m')).toBe(true)
      expect(fields.has('change_3m')).toBe(true)
      expect(fields.has('change_ytd')).toBe(true)
      expect(fields.has('change_1y')).toBe(true)
    })
  })

  describe('no overlapping fields across categories', () => {
    it('fundamental, technical, and price-action fields are all unique', () => {
      const fundamentalFields = FUNDAMENTAL_FILTERS.map((f) => f.field)
      const technicalFields = TECHNICAL_FILTERS.map((f) => f.field)
      const priceActionFields = PRICE_ACTION_FILTERS.map((f) => f.field)

      const all = [...fundamentalFields, ...technicalFields, ...priceActionFields]
      expect(new Set(all).size).toBe(all.length)
    })
  })
})

describe('Filter Classification', () => {
  it('correctly classifies fundamental fields', () => {
    expect(isFundamentalFilter('market_cap')).toBe(true)
    expect(isFundamentalFilter('pe_ratio')).toBe(true)
    expect(isFundamentalFilter('sector')).toBe(true)
    expect(isFundamentalFilter('rsi_14')).toBe(false)
    expect(isFundamentalFilter('gap_pct')).toBe(false)
  })

  it('correctly classifies technical fields', () => {
    expect(isTechnicalFilter('rsi_14')).toBe(true)
    expect(isTechnicalFilter('macd_signal')).toBe(true)
    expect(isTechnicalFilter('bb_position')).toBe(true)
    expect(isTechnicalFilter('market_cap')).toBe(false)
    expect(isTechnicalFilter('gap_pct')).toBe(false)
  })

  it('correctly classifies price-action fields', () => {
    expect(isPriceActionFilter('gap_pct')).toBe(true)
    expect(isPriceActionFilter('change_1d')).toBe(true)
    expect(isPriceActionFilter('high_52w_pct')).toBe(true)
    expect(isPriceActionFilter('market_cap')).toBe(false)
    expect(isPriceActionFilter('rsi_14')).toBe(false)
  })
})

describe('buildFundamentalCondition', () => {
  it('builds gt condition', () => {
    const filter: ScreenerFilter = { field: 'market_cap', operator: 'gt', value: 1000000000, category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"market_cap" > $1')
    expect(result.params).toEqual([1000000000])
  })

  it('builds gte condition', () => {
    const filter: ScreenerFilter = { field: 'pe_ratio', operator: 'gte', value: 10, category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"pe_ratio" >= $1')
    expect(result.params).toEqual([10])
  })

  it('builds lt condition', () => {
    const filter: ScreenerFilter = { field: 'pe_ratio', operator: 'lt', value: 20, category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"pe_ratio" < $1')
    expect(result.params).toEqual([20])
  })

  it('builds eq condition', () => {
    const filter: ScreenerFilter = { field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"sector" = $1')
    expect(result.params).toEqual(['Technology'])
  })

  it('builds between condition', () => {
    const filter: ScreenerFilter = { field: 'market_cap', operator: 'between', value: [1e9, 1e10], category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"market_cap" BETWEEN $1 AND $2')
    expect(result.params).toEqual([1e9, 1e10])
  })

  it('builds in condition', () => {
    const filter: ScreenerFilter = { field: 'sector', operator: 'in', value: ['Technology', 'Healthcare'], category: 'fundamental' }
    const result = buildFundamentalCondition(filter)
    expect(result.sql).toBe('"sector" IN ($1, $2)')
    expect(result.params).toEqual(['Technology', 'Healthcare'])
  })

  it('throws on invalid field name', () => {
    const filter: ScreenerFilter = { field: 'drop_table', operator: 'eq', value: '1', category: 'fundamental' }
    expect(() => buildFundamentalCondition(filter)).toThrow('Invalid fundamental filter field')
  })
})

describe('buildTechnicalCondition', () => {
  it('builds numeric gt condition for JSONB field', () => {
    const filter: ScreenerFilter = { field: 'rsi_14', operator: 'gt', value: 70, category: 'technical' }
    const result = buildTechnicalCondition(filter, 0)
    expect(result.sql).toContain("'rsi_14'")
    expect(result.sql).toContain('> $1')
    expect(result.params).toEqual([70])
  })

  it('builds eq condition for string JSONB field', () => {
    const filter: ScreenerFilter = { field: 'macd_signal', operator: 'eq', value: 'bullish_cross', category: 'technical' }
    const result = buildTechnicalCondition(filter, 0)
    expect(result.sql).toContain("'macd_signal'")
    expect(result.sql).toContain('= $1')
    expect(result.params).toEqual(['bullish_cross'])
  })

  it('builds between condition with proper offsets', () => {
    const filter: ScreenerFilter = { field: 'rsi_14', operator: 'between', value: [30, 70], category: 'technical' }
    const result = buildTechnicalCondition(filter, 3)
    expect(result.sql).toContain('BETWEEN $4 AND $5')
    expect(result.params).toEqual([30, 70])
  })

  it('respects param offset', () => {
    const filter: ScreenerFilter = { field: 'rsi_14', operator: 'gt', value: 50, category: 'technical' }
    const result = buildTechnicalCondition(filter, 5)
    expect(result.sql).toContain('$6')
    expect(result.params).toEqual([50])
  })

  it('throws on invalid field', () => {
    const filter: ScreenerFilter = { field: 'evil_field', operator: 'eq', value: '1', category: 'technical' }
    expect(() => buildTechnicalCondition(filter, 0)).toThrow('Invalid technical filter field')
  })
})

describe('buildPriceActionCondition', () => {
  it('builds numeric condition for price-action field', () => {
    const filter: ScreenerFilter = { field: 'gap_pct', operator: 'gt', value: 3, category: 'price_action' }
    const result = buildPriceActionCondition(filter, 0)
    expect(result.sql).toContain("'gap_pct'")
    expect(result.sql).toContain('> $1')
    expect(result.params).toEqual([3])
  })

  it('builds string eq condition', () => {
    const filter: ScreenerFilter = { field: 'gap_direction', operator: 'eq', value: 'up', category: 'price_action' }
    const result = buildPriceActionCondition(filter, 0)
    expect(result.sql).toContain("'gap_direction'")
    expect(result.params).toEqual(['up'])
  })

  it('throws on invalid field', () => {
    const filter: ScreenerFilter = { field: 'sql_injection', operator: 'eq', value: '1', category: 'price_action' }
    expect(() => buildPriceActionCondition(filter, 0)).toThrow('Invalid price-action filter field')
  })
})

describe('Screener Templates', () => {
  it('returns all templates', () => {
    const templates = getScreenerTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(10)
  })

  it('all templates have valid filter sets', () => {
    const templates = getScreenerTemplates()
    for (const template of templates) {
      expect(template.id).toBeTruthy()
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.category).toBeTruthy()
      expect(template.filters.logic).toMatch(/^(AND|OR)$/)
      expect(template.filters.filters.length).toBeGreaterThan(0)

      for (const filter of template.filters.filters) {
        expect(filter.field).toBeTruthy()
        expect(filter.operator).toBeTruthy()
        expect(filter.category).toMatch(/^(fundamental|technical|price_action)$/)
      }
    }
  })

  it('template IDs are unique', () => {
    const templates = getScreenerTemplates()
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getScreenerTemplate returns correct template', () => {
    const template = getScreenerTemplate('gap-scanner')
    expect(template).toBeDefined()
    expect(template!.name).toBe('Gap Scanner')
  })

  it('getScreenerTemplate returns undefined for unknown id', () => {
    const template = getScreenerTemplate('nonexistent')
    expect(template).toBeUndefined()
  })

  it('getTemplatesByCategory groups templates correctly', () => {
    const grouped = getTemplatesByCategory()
    expect(Object.keys(grouped).length).toBeGreaterThan(0)
    for (const [category, templates] of Object.entries(grouped)) {
      for (const t of templates) {
        expect(t.category).toBe(category)
      }
    }
  })

  it('all template filter references are valid field names', () => {
    const templates = getScreenerTemplates()
    for (const template of templates) {
      for (const filter of template.filters.filters) {
        const isValid =
          isFundamentalFilter(filter.field) ||
          isTechnicalFilter(filter.field) ||
          isPriceActionFilter(filter.field)
        expect(isValid).toBe(true)
      }
    }
  })
})
