import { describe, it, expect } from 'vitest'
import {
  STRATEGY_TEMPLATES,
  MA_CROSSOVER_TEMPLATE,
  RSI_MEAN_REVERSION_TEMPLATE,
  BREAKOUT_TEMPLATE,
  MACD_MOMENTUM_TEMPLATE,
  BOLLINGER_SQUEEZE_TEMPLATE,
  getStrategyTemplateById,
  getStrategyTemplatesByCategory,
  StrategyTemplateSchema,
  StrategyConfigSchema,
  StrategySignalSchema,
  BacktestConfigSchema,
  BacktestResultSchema,
  StrategyFileSchema,
  StrategyParameterSchema,
} from '../../src/strategy/index.js'

// ── Template Registry ──────────────────────────────────────────────────────

describe('STRATEGY_TEMPLATES', () => {
  it('contains exactly 5 built-in templates', () => {
    expect(STRATEGY_TEMPLATES).toHaveLength(5)
  })

  it('includes all expected templates by id', () => {
    const ids = STRATEGY_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('tmpl-ma-crossover')
    expect(ids).toContain('tmpl-rsi-mean-reversion')
    expect(ids).toContain('tmpl-breakout')
    expect(ids).toContain('tmpl-macd-momentum')
    expect(ids).toContain('tmpl-bollinger-squeeze')
  })

  it('has unique ids across all templates', () => {
    const ids = STRATEGY_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique names across all templates', () => {
    const names = STRATEGY_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

// ── Template Structure ─────────────────────────────────────────────────────

describe.each(STRATEGY_TEMPLATES)('Template: $name', (template) => {
  it('has all required fields', () => {
    expect(template.id).toBeDefined()
    expect(template.name).toBeDefined()
    expect(template.description).toBeDefined()
    expect(template.language).toBeDefined()
    expect(template.category).toBeDefined()
    expect(template.code).toBeDefined()
    expect(template.parameters).toBeDefined()
    expect(Array.isArray(template.parameters)).toBe(true)
  })

  it('passes StrategyTemplateSchema validation', () => {
    const result = StrategyTemplateSchema.safeParse(template)
    expect(result.success).toBe(true)
  })

  it('has a non-empty name', () => {
    expect(template.name.length).toBeGreaterThan(0)
    expect(template.name.length).toBeLessThanOrEqual(128)
  })

  it('has a descriptive description (at least 20 chars)', () => {
    expect(template.description.length).toBeGreaterThanOrEqual(20)
  })

  it('uses typescript as the language', () => {
    expect(template.language).toBe('typescript')
  })

  it('has a valid category', () => {
    const validCategories = ['trend', 'mean-reversion', 'breakout', 'momentum', 'volatility']
    expect(validCategories).toContain(template.category)
  })

  it('code contains onBar function', () => {
    expect(template.code).toContain('onBar')
  })

  it('code contains function keyword or arrow function', () => {
    expect(template.code).toMatch(/function\s+onBar/)
  })

  it('has at least one parameter', () => {
    expect(template.parameters.length).toBeGreaterThan(0)
  })

  it('all parameters have valid names (non-empty)', () => {
    for (const param of template.parameters) {
      expect(param.name.length).toBeGreaterThan(0)
    }
  })

  it('all parameters have unique names', () => {
    const names = template.parameters.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('all parameters pass StrategyParameterSchema validation', () => {
    for (const param of template.parameters) {
      const result = StrategyParameterSchema.safeParse(param)
      expect(result.success).toBe(true)
    }
  })
})

// ── Parameter Defaults Within Range ────────────────────────────────────────

describe('parameter defaults are within min/max range', () => {
  for (const template of STRATEGY_TEMPLATES) {
    for (const param of template.parameters) {
      if (param.type === 'number' && typeof param.default === 'number') {
        if (param.min !== undefined) {
          it(`${template.name} > ${param.name}: default (${param.default}) >= min (${param.min})`, () => {
            expect(param.default as number).toBeGreaterThanOrEqual(param.min!)
          })
        }
        if (param.max !== undefined) {
          it(`${template.name} > ${param.name}: default (${param.default}) <= max (${param.max})`, () => {
            expect(param.default as number).toBeLessThanOrEqual(param.max!)
          })
        }
        if (param.min !== undefined && param.max !== undefined) {
          it(`${template.name} > ${param.name}: min (${param.min}) < max (${param.max})`, () => {
            expect(param.min!).toBeLessThan(param.max!)
          })
        }
      }
    }
  }
})

// ── Individual Template Tests ──────────────────────────────────────────────

describe('MA Crossover template', () => {
  it('has trend category', () => {
    expect(MA_CROSSOVER_TEMPLATE.category).toBe('trend')
  })

  it('uses SMA indicator in code', () => {
    expect(MA_CROSSOVER_TEMPLATE.code).toContain('indicators.sma')
  })

  it('has fastPeriod and slowPeriod parameters', () => {
    const paramNames = MA_CROSSOVER_TEMPLATE.parameters.map((p) => p.name)
    expect(paramNames).toContain('fastPeriod')
    expect(paramNames).toContain('slowPeriod')
  })

  it('fast period default is less than slow period default', () => {
    const fast = MA_CROSSOVER_TEMPLATE.parameters.find((p) => p.name === 'fastPeriod')
    const slow = MA_CROSSOVER_TEMPLATE.parameters.find((p) => p.name === 'slowPeriod')
    expect(fast!.default as number).toBeLessThan(slow!.default as number)
  })
})

describe('RSI Mean Reversion template', () => {
  it('has mean-reversion category', () => {
    expect(RSI_MEAN_REVERSION_TEMPLATE.category).toBe('mean-reversion')
  })

  it('uses RSI indicator in code', () => {
    expect(RSI_MEAN_REVERSION_TEMPLATE.code).toContain('indicators.rsi')
  })

  it('has oversold and overbought parameters', () => {
    const paramNames = RSI_MEAN_REVERSION_TEMPLATE.parameters.map((p) => p.name)
    expect(paramNames).toContain('oversold')
    expect(paramNames).toContain('overbought')
  })

  it('oversold default is less than overbought default', () => {
    const os = RSI_MEAN_REVERSION_TEMPLATE.parameters.find((p) => p.name === 'oversold')
    const ob = RSI_MEAN_REVERSION_TEMPLATE.parameters.find((p) => p.name === 'overbought')
    expect(os!.default as number).toBeLessThan(ob!.default as number)
  })
})

describe('Breakout template', () => {
  it('has breakout category', () => {
    expect(BREAKOUT_TEMPLATE.category).toBe('breakout')
  })

  it('uses ATR indicator in code', () => {
    expect(BREAKOUT_TEMPLATE.code).toContain('indicators.atr')
  })

  it('has lookback and atrMultiplier parameters', () => {
    const paramNames = BREAKOUT_TEMPLATE.parameters.map((p) => p.name)
    expect(paramNames).toContain('lookback')
    expect(paramNames).toContain('atrMultiplier')
  })
})

describe('MACD Momentum template', () => {
  it('has momentum category', () => {
    expect(MACD_MOMENTUM_TEMPLATE.category).toBe('momentum')
  })

  it('uses MACD indicator in code', () => {
    expect(MACD_MOMENTUM_TEMPLATE.code).toContain('indicators.macd')
  })

  it('has fastPeriod, slowPeriod, and signalPeriod parameters', () => {
    const paramNames = MACD_MOMENTUM_TEMPLATE.parameters.map((p) => p.name)
    expect(paramNames).toContain('fastPeriod')
    expect(paramNames).toContain('slowPeriod')
    expect(paramNames).toContain('signalPeriod')
  })
})

describe('Bollinger Squeeze template', () => {
  it('has volatility category', () => {
    expect(BOLLINGER_SQUEEZE_TEMPLATE.category).toBe('volatility')
  })

  it('uses Bollinger Bands indicator in code', () => {
    expect(BOLLINGER_SQUEEZE_TEMPLATE.code).toContain('indicators.bbands')
  })

  it('has squeezeThreshold parameter', () => {
    const paramNames = BOLLINGER_SQUEEZE_TEMPLATE.parameters.map((p) => p.name)
    expect(paramNames).toContain('squeezeThreshold')
  })
})

// ── Lookup Functions ───────────────────────────────────────────────────────

describe('getStrategyTemplateById', () => {
  it('returns the correct template for a valid id', () => {
    const result = getStrategyTemplateById('tmpl-ma-crossover')
    expect(result).toBeDefined()
    expect(result!.name).toBe('MA Crossover')
  })

  it('returns undefined for an invalid id', () => {
    const result = getStrategyTemplateById('nonexistent-id')
    expect(result).toBeUndefined()
  })
})

describe('getStrategyTemplatesByCategory', () => {
  it('returns trend templates', () => {
    const result = getStrategyTemplatesByCategory('trend')
    expect(result.length).toBeGreaterThan(0)
    for (const t of result) {
      expect(t.category).toBe('trend')
    }
  })

  it('returns momentum templates', () => {
    const result = getStrategyTemplatesByCategory('momentum')
    expect(result.length).toBeGreaterThan(0)
    for (const t of result) {
      expect(t.category).toBe('momentum')
    }
  })

  it('covers all 5 categories', () => {
    const categories = ['trend', 'mean-reversion', 'breakout', 'momentum', 'volatility'] as const
    for (const cat of categories) {
      const result = getStrategyTemplatesByCategory(cat)
      expect(result.length).toBeGreaterThan(0)
    }
  })
})

// ── Zod Schema Validation ──────────────────────────────────────────────────

describe('StrategyConfigSchema', () => {
  it('validates a valid config', () => {
    const result = StrategyConfigSchema.safeParse({
      name: 'Test Strategy',
      language: 'typescript',
      parameters: [
        { name: 'period', type: 'number', default: 14, min: 1, max: 100 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = StrategyConfigSchema.safeParse({
      name: '',
      language: 'typescript',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid language', () => {
    const result = StrategyConfigSchema.safeParse({
      name: 'Test',
      language: 'java',
    })
    expect(result.success).toBe(false)
  })

  it('allows optional description', () => {
    const result = StrategyConfigSchema.safeParse({
      name: 'Test',
      language: 'python',
      description: 'A test strategy',
    })
    expect(result.success).toBe(true)
  })

  it('defaults parameters to empty array', () => {
    const result = StrategyConfigSchema.parse({
      name: 'Test',
      language: 'typescript',
    })
    expect(result.parameters).toEqual([])
  })
})

describe('StrategySignalSchema', () => {
  it('validates a valid signal', () => {
    const result = StrategySignalSchema.safeParse({
      timestamp: '2026-01-15T10:00:00Z',
      action: 'buy',
      symbol: 'AAPL',
      quantity: 100,
      price: 195.50,
      confidence: 0.85,
      reason: 'MA crossover',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = StrategySignalSchema.safeParse({
      timestamp: '2026-01-15T10:00:00Z',
      action: 'short',
      symbol: 'AAPL',
      quantity: 100,
      price: 195.50,
      confidence: 0.85,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = StrategySignalSchema.safeParse({
      timestamp: '2026-01-15T10:00:00Z',
      action: 'buy',
      symbol: 'AAPL',
      quantity: -10,
      price: 195.50,
      confidence: 0.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects confidence > 1', () => {
    const result = StrategySignalSchema.safeParse({
      timestamp: '2026-01-15T10:00:00Z',
      action: 'buy',
      symbol: 'AAPL',
      quantity: 100,
      price: 195.50,
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('BacktestConfigSchema', () => {
  it('validates a valid config', () => {
    const result = BacktestConfigSchema.safeParse({
      symbol: 'aapl',
      timeframe: '1D',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      initialCapital: 100_000,
      commission: { perShare: 0.005, perTrade: 1.0 },
      slippage: 0.001,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL') // transformed to uppercase
    }
  })

  it('uses defaults for optional fields', () => {
    const result = BacktestConfigSchema.parse({
      symbol: 'SPY',
      timeframe: '1h',
      startDate: '2025-06-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
    })
    expect(result.initialCapital).toBe(100_000)
    expect(result.commission.perShare).toBe(0)
    expect(result.commission.perTrade).toBe(0)
    expect(result.slippage).toBe(0.001)
  })

  it('rejects negative initial capital', () => {
    const result = BacktestConfigSchema.safeParse({
      symbol: 'AAPL',
      timeframe: '1D',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      initialCapital: -50_000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid timeframe', () => {
    const result = BacktestConfigSchema.safeParse({
      symbol: 'AAPL',
      timeframe: '2h',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slippage > 1', () => {
    const result = BacktestConfigSchema.safeParse({
      symbol: 'AAPL',
      timeframe: '1D',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      slippage: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('StrategyFileSchema', () => {
  it('validates a valid strategy file', () => {
    const result = StrategyFileSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user_123',
      name: 'My Strategy',
      language: 'typescript',
      code: 'function onBar() {}',
      parameters: [],
      isPublic: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid for id', () => {
    const result = StrategyFileSchema.safeParse({
      id: 'not-a-uuid',
      userId: 'user_123',
      name: 'My Strategy',
      language: 'typescript',
      code: 'function onBar() {}',
      parameters: [],
      isPublic: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('defaults isPublic to false', () => {
    const result = StrategyFileSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user_123',
      name: 'Test',
      language: 'pine',
      code: '',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.isPublic).toBe(false)
    expect(result.parameters).toEqual([])
  })
})
