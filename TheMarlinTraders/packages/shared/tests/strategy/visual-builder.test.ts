import { describe, it, expect } from 'vitest'
import {
  VisualStrategySchema,
  StrategyBlockSchema,
  BlockConnectionSchema,
  ConditionConfigSchema,
  ActionConfigSchema,
  IndicatorConfigSchema,
  LogicConfigSchema,
  validateStrategy,
  compileToTypeScript,
  getDefaultPorts,
  type VisualStrategy,
  type StrategyBlock,
  type BlockConnection,
} from '../../src/strategy/visual-builder-types.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeBlock(overrides: Partial<StrategyBlock>): StrategyBlock {
  return {
    id: 'test_block',
    type: 'condition',
    label: 'Test Block',
    config: { variant: 'price_above', source: 'close', threshold: 100 },
    position: { x: 0, y: 0 },
    ports: getDefaultPorts('condition', 'price_above'),
    ...overrides,
  } as StrategyBlock
}

function makeConnection(overrides: Partial<BlockConnection>): BlockConnection {
  return {
    id: 'test_conn',
    fromBlockId: 'from',
    fromPort: 'result',
    toBlockId: 'to',
    toPort: 'trigger',
    ...overrides,
  }
}

function makeStrategy(overrides: Partial<VisualStrategy> = {}): VisualStrategy {
  return {
    name: 'Test Strategy',
    blocks: [],
    connections: [],
    ...overrides,
  }
}

// ── Zod Schema Validation ───────────────────────────────────────────────────

describe('Zod schemas', () => {
  describe('ConditionConfigSchema', () => {
    it('validates price_above config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'price_above',
        source: 'close',
        threshold: 150,
      })
      expect(result.success).toBe(true)
    })

    it('validates price_below config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'price_below',
        source: 'high',
        threshold: 200,
      })
      expect(result.success).toBe(true)
    })

    it('validates indicator_crossover config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'indicator_crossover',
        fastSource: 'fast',
        slowSource: 'slow',
        direction: 'cross_above',
      })
      expect(result.success).toBe(true)
    })

    it('validates indicator_threshold config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'indicator_threshold',
        indicatorSource: 'value',
        operator: 'gt',
        threshold: 70,
      })
      expect(result.success).toBe(true)
    })

    it('validates volume_spike config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'volume_spike',
        multiplier: 2.5,
        lookbackPeriod: 20,
      })
      expect(result.success).toBe(true)
    })

    it('validates time_of_day config', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'time_of_day',
        startHour: 9,
        startMinute: 30,
        endHour: 16,
        endMinute: 0,
        timezone: 'America/New_York',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid variant', () => {
      const result = ConditionConfigSchema.safeParse({
        variant: 'invalid_variant',
        threshold: 100,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ActionConfigSchema', () => {
    it('validates buy_market config', () => {
      const result = ActionConfigSchema.safeParse({
        variant: 'buy_market',
        quantity: 100,
        quantityType: 'shares',
      })
      expect(result.success).toBe(true)
    })

    it('validates sell_limit config', () => {
      const result = ActionConfigSchema.safeParse({
        variant: 'sell_limit',
        quantity: 50,
        quantityType: 'percent_equity',
        limitOffset: -0.5,
      })
      expect(result.success).toBe(true)
    })

    it('validates set_stop config', () => {
      const result = ActionConfigSchema.safeParse({
        variant: 'set_stop',
        stopType: 'trailing',
        stopValue: 2.5,
      })
      expect(result.success).toBe(true)
    })

    it('validates close_position config', () => {
      const result = ActionConfigSchema.safeParse({
        variant: 'close_position',
        closePercent: 50,
      })
      expect(result.success).toBe(true)
    })

    it('rejects negative quantity', () => {
      const result = ActionConfigSchema.safeParse({
        variant: 'buy_market',
        quantity: -10,
        quantityType: 'shares',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('IndicatorConfigSchema', () => {
    it('validates sma config', () => {
      const result = IndicatorConfigSchema.safeParse({
        variant: 'sma',
        period: 20,
        source: 'close',
      })
      expect(result.success).toBe(true)
    })

    it('validates macd config', () => {
      const result = IndicatorConfigSchema.safeParse({
        variant: 'macd',
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        source: 'close',
      })
      expect(result.success).toBe(true)
    })

    it('validates bollinger config', () => {
      const result = IndicatorConfigSchema.safeParse({
        variant: 'bollinger',
        period: 20,
        stdDev: 2,
        source: 'close',
      })
      expect(result.success).toBe(true)
    })

    it('validates atr config', () => {
      const result = IndicatorConfigSchema.safeParse({
        variant: 'atr',
        period: 14,
      })
      expect(result.success).toBe(true)
    })

    it('rejects period of 0', () => {
      const result = IndicatorConfigSchema.safeParse({
        variant: 'sma',
        period: 0,
        source: 'close',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('LogicConfigSchema', () => {
    it('validates and config', () => {
      const result = LogicConfigSchema.safeParse({ variant: 'and' })
      expect(result.success).toBe(true)
    })

    it('validates or config', () => {
      const result = LogicConfigSchema.safeParse({ variant: 'or' })
      expect(result.success).toBe(true)
    })

    it('validates not config', () => {
      const result = LogicConfigSchema.safeParse({ variant: 'not' })
      expect(result.success).toBe(true)
    })

    it('validates if_then_else config', () => {
      const result = LogicConfigSchema.safeParse({ variant: 'if_then_else' })
      expect(result.success).toBe(true)
    })
  })

  describe('StrategyBlockSchema', () => {
    it('validates a complete block', () => {
      const block = makeBlock({
        id: 'my_block',
        type: 'condition',
        label: 'Price Above',
        config: { variant: 'price_above', source: 'close', threshold: 150 },
        position: { x: 100, y: 200 },
      })
      const result = StrategyBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })

    it('rejects empty id', () => {
      const block = makeBlock({ id: '' })
      const result = StrategyBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })
  })

  describe('BlockConnectionSchema', () => {
    it('validates a connection', () => {
      const conn = makeConnection({})
      const result = BlockConnectionSchema.safeParse(conn)
      expect(result.success).toBe(true)
    })

    it('rejects empty fromBlockId', () => {
      const conn = makeConnection({ fromBlockId: '' })
      const result = BlockConnectionSchema.safeParse(conn)
      expect(result.success).toBe(false)
    })
  })

  describe('VisualStrategySchema', () => {
    it('validates an empty strategy', () => {
      const strategy = makeStrategy({ name: 'Empty' })
      const result = VisualStrategySchema.safeParse(strategy)
      expect(result.success).toBe(true)
    })

    it('rejects strategy with empty name', () => {
      const strategy = makeStrategy({ name: '' })
      const result = VisualStrategySchema.safeParse(strategy)
      expect(result.success).toBe(false)
    })
  })
})

// ── getDefaultPorts ─────────────────────────────────────────────────────────

describe('getDefaultPorts', () => {
  it('returns output port for condition blocks', () => {
    const ports = getDefaultPorts('condition', 'price_above')
    expect(ports.length).toBeGreaterThan(0)
    expect(ports.some((p) => p.direction === 'output' && p.id === 'result')).toBe(true)
  })

  it('returns input + output ports for indicator_crossover', () => {
    const ports = getDefaultPorts('condition', 'indicator_crossover')
    expect(ports.filter((p) => p.direction === 'input')).toHaveLength(2) // fast, slow
    expect(ports.filter((p) => p.direction === 'output')).toHaveLength(1) // result
  })

  it('returns trigger input for action blocks', () => {
    const ports = getDefaultPorts('action', 'buy_market')
    expect(ports.some((p) => p.direction === 'input' && p.id === 'trigger')).toBe(true)
  })

  it('returns value output for simple indicator blocks', () => {
    const ports = getDefaultPorts('indicator', 'sma')
    expect(ports.some((p) => p.direction === 'output' && p.id === 'value')).toBe(true)
  })

  it('returns multiple outputs for MACD', () => {
    const ports = getDefaultPorts('indicator', 'macd')
    const outputs = ports.filter((p) => p.direction === 'output')
    expect(outputs.length).toBe(3) // macd, signal, histogram
  })

  it('returns multiple outputs for Bollinger Bands', () => {
    const ports = getDefaultPorts('indicator', 'bollinger')
    const outputs = ports.filter((p) => p.direction === 'output')
    expect(outputs.length).toBe(3) // upper, middle, lower
  })

  it('returns a/b inputs and result output for AND logic', () => {
    const ports = getDefaultPorts('logic', 'and')
    expect(ports.filter((p) => p.direction === 'input')).toHaveLength(2)
    expect(ports.filter((p) => p.direction === 'output')).toHaveLength(1)
  })

  it('returns single input and result output for NOT logic', () => {
    const ports = getDefaultPorts('logic', 'not')
    expect(ports.filter((p) => p.direction === 'input')).toHaveLength(1)
    expect(ports.filter((p) => p.direction === 'output')).toHaveLength(1)
  })
})

// ── validateStrategy ────────────────────────────────────────────────────────

describe('validateStrategy', () => {
  it('returns no errors for an empty strategy', () => {
    const errors = validateStrategy(makeStrategy())
    expect(errors).toHaveLength(0)
  })

  it('catches disconnected required input ports', () => {
    const crossoverBlock = makeBlock({
      id: 'cross',
      type: 'condition',
      label: 'Crossover',
      config: { variant: 'indicator_crossover', fastSource: 'fast', slowSource: 'slow', direction: 'cross_above' },
      ports: getDefaultPorts('condition', 'indicator_crossover'),
    })

    const strategy = makeStrategy({
      blocks: [crossoverBlock],
      connections: [],
    })

    const errors = validateStrategy(strategy)
    expect(errors.length).toBeGreaterThan(0)
    // Should have errors for 'fast' and 'slow' input ports
    expect(errors.some((e) => e.portId === 'fast')).toBe(true)
    expect(errors.some((e) => e.portId === 'slow')).toBe(true)
  })

  it('passes when required ports are connected', () => {
    const smaBlock = makeBlock({
      id: 'sma1',
      type: 'indicator',
      label: 'SMA',
      config: { variant: 'sma', period: 20, source: 'close' },
      ports: getDefaultPorts('indicator', 'sma'),
    })

    const smaBlock2 = makeBlock({
      id: 'sma2',
      type: 'indicator',
      label: 'SMA',
      config: { variant: 'sma', period: 50, source: 'close' },
      ports: getDefaultPorts('indicator', 'sma'),
    })

    const crossoverBlock = makeBlock({
      id: 'cross',
      type: 'condition',
      label: 'Crossover',
      config: { variant: 'indicator_crossover', fastSource: 'fast', slowSource: 'slow', direction: 'cross_above' },
      ports: getDefaultPorts('condition', 'indicator_crossover'),
    })

    const strategy = makeStrategy({
      blocks: [smaBlock, smaBlock2, crossoverBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'sma1', fromPort: 'value', toBlockId: 'cross', toPort: 'fast' }),
        makeConnection({ id: 'c2', fromBlockId: 'sma2', fromPort: 'value', toBlockId: 'cross', toPort: 'slow' }),
      ],
    })

    const errors = validateStrategy(strategy)
    expect(errors).toHaveLength(0)
  })

  it('detects connection to non-existent block', () => {
    const strategy = makeStrategy({
      blocks: [],
      connections: [
        makeConnection({ fromBlockId: 'ghost', fromPort: 'result', toBlockId: 'phantom', toPort: 'trigger' }),
      ],
    })

    const errors = validateStrategy(strategy)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.message.includes('non-existent'))).toBe(true)
  })

  it('detects connection to non-existent port', () => {
    const block = makeBlock({
      id: 'b1',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 100 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const strategy = makeStrategy({
      blocks: [block],
      connections: [
        makeConnection({ fromBlockId: 'b1', fromPort: 'nonexistent_port', toBlockId: 'b1', toPort: 'result' }),
      ],
    })

    const errors = validateStrategy(strategy)
    expect(errors.some((e) => e.message.includes('does not exist'))).toBe(true)
  })

  it('allows blocks with no required ports and no connections', () => {
    // Price above only has an output port (no required inputs)
    const block = makeBlock({
      id: 'pa',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 100 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const strategy = makeStrategy({ blocks: [block] })
    const errors = validateStrategy(strategy)
    expect(errors).toHaveLength(0)
  })
})

// ── compileToTypeScript ─────────────────────────────────────────────────────

describe('compileToTypeScript', () => {
  it('compiles simple condition -> action flow', () => {
    const condBlock = makeBlock({
      id: 'cond1',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 150 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const actionBlock = makeBlock({
      id: 'action1',
      type: 'action',
      label: 'Buy Market',
      config: { variant: 'buy_market', quantity: 100, quantityType: 'shares' },
      ports: getDefaultPorts('action', 'buy_market'),
    })

    const strategy = makeStrategy({
      name: 'Simple Buy',
      blocks: [condBlock, actionBlock],
      connections: [
        makeConnection({
          id: 'c1',
          fromBlockId: 'cond1',
          fromPort: 'result',
          toBlockId: 'action1',
          toPort: 'trigger',
        }),
      ],
    })

    const code = compileToTypeScript(strategy)

    // Should contain the strategy name
    expect(code).toContain('Simple Buy')
    // Should contain the onBar function
    expect(code).toContain('export function onBar(')
    // Should contain condition evaluation
    expect(code).toContain('bar.close > 150')
    // Should contain the action wrapped in if
    expect(code).toContain('if (cond1)')
    expect(code).toContain('buy(100)')
  })

  it('compiles indicator blocks', () => {
    const smaBlock = makeBlock({
      id: 'sma_20',
      type: 'indicator',
      label: 'SMA 20',
      config: { variant: 'sma', period: 20, source: 'close' },
      ports: getDefaultPorts('indicator', 'sma'),
    })

    const strategy = makeStrategy({
      name: 'Indicator Test',
      blocks: [smaBlock],
      connections: [],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('indicators.sma(20,')
  })

  it('compiles AND logic block combining conditions', () => {
    const condA = makeBlock({
      id: 'cond_a',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 100 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const condB = makeBlock({
      id: 'cond_b',
      type: 'condition',
      label: 'Volume Spike',
      config: { variant: 'volume_spike', multiplier: 2, lookbackPeriod: 20 },
      ports: getDefaultPorts('condition', 'volume_spike'),
    })

    const andBlock = makeBlock({
      id: 'and_gate',
      type: 'logic',
      label: 'AND',
      config: { variant: 'and' },
      ports: getDefaultPorts('logic', 'and'),
    })

    const buyBlock = makeBlock({
      id: 'buy_action',
      type: 'action',
      label: 'Buy Market',
      config: { variant: 'buy_market', quantity: 50, quantityType: 'shares' },
      ports: getDefaultPorts('action', 'buy_market'),
    })

    const strategy = makeStrategy({
      name: 'AND Logic Test',
      blocks: [condA, condB, andBlock, buyBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'cond_a', fromPort: 'result', toBlockId: 'and_gate', toPort: 'a' }),
        makeConnection({ id: 'c2', fromBlockId: 'cond_b', fromPort: 'result', toBlockId: 'and_gate', toPort: 'b' }),
        makeConnection({ id: 'c3', fromBlockId: 'and_gate', fromPort: 'result', toBlockId: 'buy_action', toPort: 'trigger' }),
      ],
    })

    const code = compileToTypeScript(strategy)

    // Should have AND logic
    expect(code).toContain('cond_a && cond_b')
    // Should trigger buy on combined condition
    expect(code).toContain('if (and_gate)')
    expect(code).toContain('buy(50)')
  })

  it('compiles OR logic block combining conditions', () => {
    const condA = makeBlock({
      id: 'cond_a',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 100 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const condB = makeBlock({
      id: 'cond_b',
      type: 'condition',
      label: 'Price Below',
      config: { variant: 'price_below', source: 'close', threshold: 50 },
      ports: getDefaultPorts('condition', 'price_below'),
    })

    const orBlock = makeBlock({
      id: 'or_gate',
      type: 'logic',
      label: 'OR',
      config: { variant: 'or' },
      ports: getDefaultPorts('logic', 'or'),
    })

    const strategy = makeStrategy({
      name: 'OR Logic Test',
      blocks: [condA, condB, orBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'cond_a', fromPort: 'result', toBlockId: 'or_gate', toPort: 'a' }),
        makeConnection({ id: 'c2', fromBlockId: 'cond_b', fromPort: 'result', toBlockId: 'or_gate', toPort: 'b' }),
      ],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('cond_a || cond_b')
  })

  it('compiles NOT logic block', () => {
    const condBlock = makeBlock({
      id: 'cond1',
      type: 'condition',
      label: 'Price Above',
      config: { variant: 'price_above', source: 'close', threshold: 100 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const notBlock = makeBlock({
      id: 'not_gate',
      type: 'logic',
      label: 'NOT',
      config: { variant: 'not' },
      ports: getDefaultPorts('logic', 'not'),
    })

    const strategy = makeStrategy({
      name: 'NOT Logic Test',
      blocks: [condBlock, notBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'cond1', fromPort: 'result', toBlockId: 'not_gate', toPort: 'input' }),
      ],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('!cond1')
  })

  it('handles empty strategy gracefully', () => {
    const code = compileToTypeScript(makeStrategy({ name: 'Empty' }))
    expect(code).toContain('export function onBar(')
    expect(code).toContain('Empty')
  })

  it('compiles close_position action', () => {
    const condBlock = makeBlock({
      id: 'cond1',
      type: 'condition',
      label: 'Price Below',
      config: { variant: 'price_below', source: 'close', threshold: 50 },
      ports: getDefaultPorts('condition', 'price_below'),
    })

    const closeBlock = makeBlock({
      id: 'close1',
      type: 'action',
      label: 'Close Position',
      config: { variant: 'close_position', closePercent: 100 },
      ports: getDefaultPorts('action', 'close_position'),
    })

    const strategy = makeStrategy({
      name: 'Close Test',
      blocks: [condBlock, closeBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'cond1', fromPort: 'result', toBlockId: 'close1', toPort: 'trigger' }),
      ],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('closePosition()')
  })

  it('compiles partial close (50%)', () => {
    const condBlock = makeBlock({
      id: 'cond1',
      type: 'condition',
      label: 'RSI High',
      config: { variant: 'price_above', source: 'close', threshold: 200 },
      ports: getDefaultPorts('condition', 'price_above'),
    })

    const closeBlock = makeBlock({
      id: 'close50',
      type: 'action',
      label: 'Close 50%',
      config: { variant: 'close_position', closePercent: 50 },
      ports: getDefaultPorts('action', 'close_position'),
    })

    const strategy = makeStrategy({
      name: 'Partial Close',
      blocks: [condBlock, closeBlock],
      connections: [
        makeConnection({ id: 'c1', fromBlockId: 'cond1', fromPort: 'result', toBlockId: 'close50', toPort: 'trigger' }),
      ],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('closePosition(0.5)')
  })

  it('compiles volume spike condition', () => {
    const block = makeBlock({
      id: 'vol_spike',
      type: 'condition',
      label: 'Volume Spike',
      config: { variant: 'volume_spike', multiplier: 3, lookbackPeriod: 10 },
      ports: getDefaultPorts('condition', 'volume_spike'),
    })

    const strategy = makeStrategy({
      name: 'Volume Test',
      blocks: [block],
      connections: [],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('bar.volume')
    expect(code).toContain('3')
    expect(code).toContain('10')
  })

  it('compiles time_of_day condition', () => {
    const block = makeBlock({
      id: 'time_filter',
      type: 'condition',
      label: 'Time of Day',
      config: { variant: 'time_of_day', startHour: 9, startMinute: 30, endHour: 16, endMinute: 0, timezone: 'America/New_York' },
      ports: getDefaultPorts('condition', 'time_of_day'),
    })

    const strategy = makeStrategy({
      name: 'Time Test',
      blocks: [block],
      connections: [],
    })

    const code = compileToTypeScript(strategy)
    expect(code).toContain('09:30')
    expect(code).toContain('16:00')
    expect(code).toContain('America/New_York')
  })

  it('skips action blocks with no trigger connection', () => {
    const actionBlock = makeBlock({
      id: 'orphan_buy',
      type: 'action',
      label: 'Buy Market',
      config: { variant: 'buy_market', quantity: 100, quantityType: 'shares' },
      ports: getDefaultPorts('action', 'buy_market'),
    })

    const strategy = makeStrategy({
      name: 'Orphan Action',
      blocks: [actionBlock],
      connections: [],
    })

    const code = compileToTypeScript(strategy)
    // Orphaned action should not produce a buy() call
    expect(code).not.toContain('buy(100)')
  })
})
