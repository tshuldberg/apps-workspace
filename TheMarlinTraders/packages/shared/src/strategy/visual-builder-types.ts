/**
 * Visual Strategy Builder Types
 * Sprints 47-48: Visual Builder + Python Interop + Pine Script Import
 *
 * Block-graph model for drag-and-drop strategy composition.
 * Each strategy is a directed graph of blocks (condition, action, indicator, logic)
 * connected via typed ports. The graph compiles to executable TypeScript.
 */

import { z } from 'zod'

// ── Block Position ──────────────────────────────────────────────────────────

export const BlockPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export type BlockPosition = z.infer<typeof BlockPositionSchema>

// ── Block Types ─────────────────────────────────────────────────────────────

export const BlockTypeSchema = z.enum(['condition', 'action', 'indicator', 'logic'])
export type BlockType = z.infer<typeof BlockTypeSchema>

// ── Port Definitions ────────────────────────────────────────────────────────

export const PortDirectionSchema = z.enum(['input', 'output'])
export type PortDirection = z.infer<typeof PortDirectionSchema>

export const PortDataTypeSchema = z.enum(['boolean', 'number', 'signal', 'series'])
export type PortDataType = z.infer<typeof PortDataTypeSchema>

export const PortDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  direction: PortDirectionSchema,
  dataType: PortDataTypeSchema,
  required: z.boolean().default(true),
})

export type PortDefinition = z.infer<typeof PortDefinitionSchema>

// ── Condition Block Variants ────────────────────────────────────────────────

export const ConditionVariantSchema = z.enum([
  'price_above',
  'price_below',
  'indicator_crossover',
  'indicator_threshold',
  'volume_spike',
  'time_of_day',
])

export type ConditionVariant = z.infer<typeof ConditionVariantSchema>

export const ConditionConfigSchema = z.discriminatedUnion('variant', [
  z.object({
    variant: z.literal('price_above'),
    source: z.enum(['close', 'open', 'high', 'low']).default('close'),
    threshold: z.number(),
  }),
  z.object({
    variant: z.literal('price_below'),
    source: z.enum(['close', 'open', 'high', 'low']).default('close'),
    threshold: z.number(),
  }),
  z.object({
    variant: z.literal('indicator_crossover'),
    fastSource: z.string().default('fast'), // port reference
    slowSource: z.string().default('slow'), // port reference
    direction: z.enum(['cross_above', 'cross_below']).default('cross_above'),
  }),
  z.object({
    variant: z.literal('indicator_threshold'),
    indicatorSource: z.string().default('value'), // port reference
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).default('gt'),
    threshold: z.number(),
  }),
  z.object({
    variant: z.literal('volume_spike'),
    multiplier: z.number().min(1).default(2),
    lookbackPeriod: z.number().int().min(1).default(20),
  }),
  z.object({
    variant: z.literal('time_of_day'),
    startHour: z.number().int().min(0).max(23).default(9),
    startMinute: z.number().int().min(0).max(59).default(30),
    endHour: z.number().int().min(0).max(23).default(16),
    endMinute: z.number().int().min(0).max(59).default(0),
    timezone: z.string().default('America/New_York'),
  }),
])

export type ConditionConfig = z.infer<typeof ConditionConfigSchema>

// ── Action Block Variants ───────────────────────────────────────────────────

export const ActionVariantSchema = z.enum([
  'buy_market',
  'sell_market',
  'buy_limit',
  'sell_limit',
  'set_stop',
  'close_position',
])

export type ActionVariant = z.infer<typeof ActionVariantSchema>

export const ActionConfigSchema = z.discriminatedUnion('variant', [
  z.object({
    variant: z.literal('buy_market'),
    quantity: z.number().positive().default(100),
    quantityType: z.enum(['shares', 'percent_equity']).default('shares'),
  }),
  z.object({
    variant: z.literal('sell_market'),
    quantity: z.number().positive().default(100),
    quantityType: z.enum(['shares', 'percent_equity']).default('shares'),
  }),
  z.object({
    variant: z.literal('buy_limit'),
    quantity: z.number().positive().default(100),
    quantityType: z.enum(['shares', 'percent_equity']).default('shares'),
    limitOffset: z.number().default(0), // offset from current price
  }),
  z.object({
    variant: z.literal('sell_limit'),
    quantity: z.number().positive().default(100),
    quantityType: z.enum(['shares', 'percent_equity']).default('shares'),
    limitOffset: z.number().default(0),
  }),
  z.object({
    variant: z.literal('set_stop'),
    stopType: z.enum(['fixed', 'trailing', 'atr_based']).default('fixed'),
    stopValue: z.number().positive().default(2),
    atrMultiplier: z.number().positive().optional(),
  }),
  z.object({
    variant: z.literal('close_position'),
    closePercent: z.number().min(0).max(100).default(100),
  }),
])

export type ActionConfig = z.infer<typeof ActionConfigSchema>

// ── Indicator Block Variants ────────────────────────────────────────────────

export const IndicatorVariantSchema = z.enum([
  'sma',
  'ema',
  'rsi',
  'macd',
  'bollinger',
  'atr',
])

export type IndicatorVariant = z.infer<typeof IndicatorVariantSchema>

export const IndicatorConfigSchema = z.discriminatedUnion('variant', [
  z.object({
    variant: z.literal('sma'),
    period: z.number().int().min(1).default(20),
    source: z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3']).default('close'),
  }),
  z.object({
    variant: z.literal('ema'),
    period: z.number().int().min(1).default(12),
    source: z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3']).default('close'),
  }),
  z.object({
    variant: z.literal('rsi'),
    period: z.number().int().min(1).default(14),
    source: z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3']).default('close'),
  }),
  z.object({
    variant: z.literal('macd'),
    fastPeriod: z.number().int().min(1).default(12),
    slowPeriod: z.number().int().min(1).default(26),
    signalPeriod: z.number().int().min(1).default(9),
    source: z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3']).default('close'),
  }),
  z.object({
    variant: z.literal('bollinger'),
    period: z.number().int().min(1).default(20),
    stdDev: z.number().min(0.1).default(2),
    source: z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3']).default('close'),
  }),
  z.object({
    variant: z.literal('atr'),
    period: z.number().int().min(1).default(14),
  }),
])

export type IndicatorConfig = z.infer<typeof IndicatorConfigSchema>

// ── Logic Block Variants ────────────────────────────────────────────────────

export const LogicVariantSchema = z.enum(['and', 'or', 'not', 'if_then_else'])
export type LogicVariant = z.infer<typeof LogicVariantSchema>

export const LogicConfigSchema = z.discriminatedUnion('variant', [
  z.object({ variant: z.literal('and') }),
  z.object({ variant: z.literal('or') }),
  z.object({ variant: z.literal('not') }),
  z.object({
    variant: z.literal('if_then_else'),
  }),
])

export type LogicConfig = z.infer<typeof LogicConfigSchema>

// ── Strategy Block ──────────────────────────────────────────────────────────

export const StrategyBlockSchema = z.object({
  id: z.string().min(1),
  type: BlockTypeSchema,
  label: z.string().min(1),
  config: z.union([ConditionConfigSchema, ActionConfigSchema, IndicatorConfigSchema, LogicConfigSchema]),
  position: BlockPositionSchema,
  ports: z.array(PortDefinitionSchema),
})

export type StrategyBlock = z.infer<typeof StrategyBlockSchema>

// ── Block Connection ────────────────────────────────────────────────────────

export const BlockConnectionSchema = z.object({
  id: z.string().min(1),
  fromBlockId: z.string().min(1),
  fromPort: z.string().min(1),
  toBlockId: z.string().min(1),
  toPort: z.string().min(1),
})

export type BlockConnection = z.infer<typeof BlockConnectionSchema>

// ── Visual Strategy ─────────────────────────────────────────────────────────

export const VisualStrategySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  blocks: z.array(StrategyBlockSchema),
  connections: z.array(BlockConnectionSchema),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type VisualStrategy = z.infer<typeof VisualStrategySchema>

// ── Port Definitions per Block Variant ──────────────────────────────────────

/** Returns the default ports for a given block type and variant. */
export function getDefaultPorts(type: BlockType, variant: string): PortDefinition[] {
  switch (type) {
    case 'condition':
      switch (variant) {
        case 'price_above':
        case 'price_below':
          return [
            { id: 'result', label: 'Signal', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'indicator_crossover':
          return [
            { id: 'fast', label: 'Fast', direction: 'input', dataType: 'series', required: true },
            { id: 'slow', label: 'Slow', direction: 'input', dataType: 'series', required: true },
            { id: 'result', label: 'Signal', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'indicator_threshold':
          return [
            { id: 'value', label: 'Value', direction: 'input', dataType: 'series', required: true },
            { id: 'result', label: 'Signal', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'volume_spike':
          return [
            { id: 'result', label: 'Signal', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'time_of_day':
          return [
            { id: 'result', label: 'Active', direction: 'output', dataType: 'boolean', required: true },
          ]
        default:
          return [
            { id: 'result', label: 'Signal', direction: 'output', dataType: 'boolean', required: true },
          ]
      }

    case 'action':
      return [
        { id: 'trigger', label: 'Trigger', direction: 'input', dataType: 'boolean', required: true },
        { id: 'executed', label: 'Executed', direction: 'output', dataType: 'signal', required: false },
      ]

    case 'indicator':
      switch (variant) {
        case 'sma':
        case 'ema':
          return [
            { id: 'value', label: 'Value', direction: 'output', dataType: 'series', required: true },
          ]
        case 'rsi':
          return [
            { id: 'value', label: 'RSI', direction: 'output', dataType: 'series', required: true },
          ]
        case 'macd':
          return [
            { id: 'macd', label: 'MACD', direction: 'output', dataType: 'series', required: true },
            { id: 'signal', label: 'Signal', direction: 'output', dataType: 'series', required: true },
            { id: 'histogram', label: 'Histogram', direction: 'output', dataType: 'series', required: true },
          ]
        case 'bollinger':
          return [
            { id: 'upper', label: 'Upper', direction: 'output', dataType: 'series', required: true },
            { id: 'middle', label: 'Middle', direction: 'output', dataType: 'series', required: true },
            { id: 'lower', label: 'Lower', direction: 'output', dataType: 'series', required: true },
          ]
        case 'atr':
          return [
            { id: 'value', label: 'ATR', direction: 'output', dataType: 'series', required: true },
          ]
        default:
          return [
            { id: 'value', label: 'Value', direction: 'output', dataType: 'series', required: true },
          ]
      }

    case 'logic':
      switch (variant) {
        case 'and':
        case 'or':
          return [
            { id: 'a', label: 'A', direction: 'input', dataType: 'boolean', required: true },
            { id: 'b', label: 'B', direction: 'input', dataType: 'boolean', required: true },
            { id: 'result', label: 'Result', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'not':
          return [
            { id: 'input', label: 'Input', direction: 'input', dataType: 'boolean', required: true },
            { id: 'result', label: 'Result', direction: 'output', dataType: 'boolean', required: true },
          ]
        case 'if_then_else':
          return [
            { id: 'condition', label: 'If', direction: 'input', dataType: 'boolean', required: true },
            { id: 'then', label: 'Then', direction: 'output', dataType: 'signal', required: true },
            { id: 'else', label: 'Else', direction: 'output', dataType: 'signal', required: false },
          ]
        default:
          return []
      }

    default:
      return []
  }
}

// ── Block Labels ────────────────────────────────────────────────────────────

export const BLOCK_LABELS: Record<string, string> = {
  // Conditions
  price_above: 'Price Above',
  price_below: 'Price Below',
  indicator_crossover: 'Crossover',
  indicator_threshold: 'Threshold',
  volume_spike: 'Volume Spike',
  time_of_day: 'Time of Day',
  // Actions
  buy_market: 'Buy Market',
  sell_market: 'Sell Market',
  buy_limit: 'Buy Limit',
  sell_limit: 'Sell Limit',
  set_stop: 'Set Stop',
  close_position: 'Close Position',
  // Indicators
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  bollinger: 'Bollinger Bands',
  atr: 'ATR',
  // Logic
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  if_then_else: 'If / Then / Else',
}

// ── Block Colors ────────────────────────────────────────────────────────────

export const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  condition: '#3b82f6', // blue-500
  action: '#22c55e',    // green-500
  indicator: '#f59e0b', // amber-500
  logic: '#a855f7',     // purple-500
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface ValidationError {
  blockId: string
  portId: string
  message: string
}

/**
 * Validate a visual strategy graph. Returns an array of validation errors.
 * An empty array means the strategy is valid.
 */
export function validateStrategy(strategy: VisualStrategy): ValidationError[] {
  const errors: ValidationError[] = []
  const blockMap = new Map(strategy.blocks.map((b) => [b.id, b]))

  for (const block of strategy.blocks) {
    // Check that all required input ports have connections
    const inputPorts = block.ports.filter((p) => p.direction === 'input' && p.required)

    for (const port of inputPorts) {
      const hasConnection = strategy.connections.some(
        (c) => c.toBlockId === block.id && c.toPort === port.id,
      )
      if (!hasConnection) {
        errors.push({
          blockId: block.id,
          portId: port.id,
          message: `Required input port "${port.label}" on block "${block.label}" is not connected`,
        })
      }
    }
  }

  // Validate connection endpoints exist
  for (const conn of strategy.connections) {
    const fromBlock = blockMap.get(conn.fromBlockId)
    const toBlock = blockMap.get(conn.toBlockId)

    if (!fromBlock) {
      errors.push({
        blockId: conn.fromBlockId,
        portId: conn.fromPort,
        message: `Connection references non-existent source block "${conn.fromBlockId}"`,
      })
      continue
    }
    if (!toBlock) {
      errors.push({
        blockId: conn.toBlockId,
        portId: conn.toPort,
        message: `Connection references non-existent target block "${conn.toBlockId}"`,
      })
      continue
    }

    const fromPort = fromBlock.ports.find((p) => p.id === conn.fromPort)
    const toPort = toBlock.ports.find((p) => p.id === conn.toPort)

    if (!fromPort) {
      errors.push({
        blockId: conn.fromBlockId,
        portId: conn.fromPort,
        message: `Source port "${conn.fromPort}" does not exist on block "${fromBlock.label}"`,
      })
    }
    if (!toPort) {
      errors.push({
        blockId: conn.toBlockId,
        portId: conn.toPort,
        message: `Target port "${conn.toPort}" does not exist on block "${toBlock.label}"`,
      })
    }
  }

  return errors
}

// ── Compilation ─────────────────────────────────────────────────────────────

/**
 * Compile a visual strategy graph to executable TypeScript code.
 *
 * The generated code follows the standard strategy API:
 * - `on_bar(bar, indicators, context)` is called for each bar
 * - `buy(qty)`, `sell(qty)`, `position()` are available
 * - `indicators.sma(period)`, etc. are available
 */
export function compileToTypeScript(strategy: VisualStrategy): string {
  const blockMap = new Map(strategy.blocks.map((b) => [b.id, b]))
  const lines: string[] = []

  lines.push(`// Auto-generated from Visual Strategy Builder`)
  lines.push(`// Strategy: ${strategy.name}`)
  if (strategy.description) {
    lines.push(`// ${strategy.description}`)
  }
  lines.push(``)

  // ── Collect indicators ──────────────────────────────────────────────────
  const indicatorBlocks = strategy.blocks.filter((b) => b.type === 'indicator')
  const conditionBlocks = strategy.blocks.filter((b) => b.type === 'condition')
  const actionBlocks = strategy.blocks.filter((b) => b.type === 'action')
  const logicBlocks = strategy.blocks.filter((b) => b.type === 'logic')

  lines.push(`export function onBar(bar: Bar, indicators: Indicators, context: Context) {`)

  // ── Indicator computations ──────────────────────────────────────────────
  if (indicatorBlocks.length > 0) {
    lines.push(`  // ── Indicators ──`)
  }
  for (const block of indicatorBlocks) {
    const varName = sanitizeVarName(block.id)
    const config = block.config as IndicatorConfig

    switch (config.variant) {
      case 'sma':
        lines.push(`  const ${varName} = indicators.sma(${config.period}, '${config.source}')`)
        break
      case 'ema':
        lines.push(`  const ${varName} = indicators.ema(${config.period}, '${config.source}')`)
        break
      case 'rsi':
        lines.push(`  const ${varName} = indicators.rsi(${config.period}, '${config.source}')`)
        break
      case 'macd':
        lines.push(`  const ${varName} = indicators.macd(${config.fastPeriod}, ${config.slowPeriod}, ${config.signalPeriod}, '${config.source}')`)
        break
      case 'bollinger':
        lines.push(`  const ${varName} = indicators.bollinger(${config.period}, ${config.stdDev}, '${config.source}')`)
        break
      case 'atr':
        lines.push(`  const ${varName} = indicators.atr(${config.period})`)
        break
    }
  }

  if (indicatorBlocks.length > 0) {
    lines.push(``)
  }

  // ── Condition evaluations ───────────────────────────────────────────────
  if (conditionBlocks.length > 0) {
    lines.push(`  // ── Conditions ──`)
  }
  for (const block of conditionBlocks) {
    const varName = sanitizeVarName(block.id)
    const config = block.config as ConditionConfig

    switch (config.variant) {
      case 'price_above':
        lines.push(`  const ${varName} = bar.${config.source} > ${config.threshold}`)
        break
      case 'price_below':
        lines.push(`  const ${varName} = bar.${config.source} < ${config.threshold}`)
        break
      case 'indicator_crossover': {
        const fastConn = findInputConnection(strategy, block.id, 'fast')
        const slowConn = findInputConnection(strategy, block.id, 'slow')
        const fastVar = fastConn ? resolveOutputVarName(fastConn, blockMap) : '"unconnected"'
        const slowVar = slowConn ? resolveOutputVarName(slowConn, blockMap) : '"unconnected"'
        if (config.direction === 'cross_above') {
          lines.push(`  const ${varName} = context.crossOver(${fastVar}, ${slowVar})`)
        } else {
          lines.push(`  const ${varName} = context.crossUnder(${fastVar}, ${slowVar})`)
        }
        break
      }
      case 'indicator_threshold': {
        const valueConn = findInputConnection(strategy, block.id, 'value')
        const valueVar = valueConn ? resolveOutputVarName(valueConn, blockMap) : '0'
        const opMap = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '===' } as const
        lines.push(`  const ${varName} = ${valueVar} ${opMap[config.operator]} ${config.threshold}`)
        break
      }
      case 'volume_spike':
        lines.push(`  const ${varName} = bar.volume > indicators.sma(${config.lookbackPeriod}, 'volume') * ${config.multiplier}`)
        break
      case 'time_of_day':
        lines.push(`  const ${varName} = context.isWithinTime('${padTime(config.startHour, config.startMinute)}', '${padTime(config.endHour, config.endMinute)}', '${config.timezone}')`)
        break
    }
  }

  if (conditionBlocks.length > 0) {
    lines.push(``)
  }

  // ── Logic block evaluations ─────────────────────────────────────────────
  if (logicBlocks.length > 0) {
    lines.push(`  // ── Logic ──`)
  }
  for (const block of logicBlocks) {
    const varName = sanitizeVarName(block.id)
    const config = block.config as LogicConfig

    switch (config.variant) {
      case 'and': {
        const aConn = findInputConnection(strategy, block.id, 'a')
        const bConn = findInputConnection(strategy, block.id, 'b')
        const aVar = aConn ? resolveOutputVarName(aConn, blockMap) : 'false'
        const bVar = bConn ? resolveOutputVarName(bConn, blockMap) : 'false'
        lines.push(`  const ${varName} = ${aVar} && ${bVar}`)
        break
      }
      case 'or': {
        const aConn = findInputConnection(strategy, block.id, 'a')
        const bConn = findInputConnection(strategy, block.id, 'b')
        const aVar = aConn ? resolveOutputVarName(aConn, blockMap) : 'false'
        const bVar = bConn ? resolveOutputVarName(bConn, blockMap) : 'false'
        lines.push(`  const ${varName} = ${aVar} || ${bVar}`)
        break
      }
      case 'not': {
        const inputConn = findInputConnection(strategy, block.id, 'input')
        const inputVar = inputConn ? resolveOutputVarName(inputConn, blockMap) : 'false'
        lines.push(`  const ${varName} = !${inputVar}`)
        break
      }
      case 'if_then_else':
        // if_then_else wires to action triggers, handled below
        break
    }
  }

  if (logicBlocks.length > 0) {
    lines.push(``)
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  if (actionBlocks.length > 0) {
    lines.push(`  // ── Actions ──`)
  }
  for (const block of actionBlocks) {
    const config = block.config as ActionConfig
    const triggerConn = findInputConnection(strategy, block.id, 'trigger')

    if (!triggerConn) continue // no trigger = unreachable action

    const triggerVar = resolveOutputVarName(triggerConn, blockMap)
    const qty = formatQuantity(config)

    lines.push(`  if (${triggerVar}) {`)

    switch (config.variant) {
      case 'buy_market':
        lines.push(`    buy(${qty})`)
        break
      case 'sell_market':
        lines.push(`    sell(${qty})`)
        break
      case 'buy_limit':
        lines.push(`    buyLimit(${qty}, bar.close + ${config.limitOffset})`)
        break
      case 'sell_limit':
        lines.push(`    sellLimit(${qty}, bar.close + ${config.limitOffset})`)
        break
      case 'set_stop':
        if (config.stopType === 'trailing') {
          lines.push(`    setTrailingStop(${config.stopValue})`)
        } else if (config.stopType === 'atr_based') {
          lines.push(`    setStop(bar.close - indicators.atr(14) * ${config.atrMultiplier ?? 2})`)
        } else {
          lines.push(`    setStop(bar.close - ${config.stopValue})`)
        }
        break
      case 'close_position':
        if (config.closePercent === 100) {
          lines.push(`    closePosition()`)
        } else {
          lines.push(`    closePosition(${config.closePercent / 100})`)
        }
        break
    }

    lines.push(`  }`)
  }

  lines.push(`}`)

  return lines.join('\n')
}

// ── Compiler Helpers ────────────────────────────────────────────────────────

function sanitizeVarName(blockId: string): string {
  return blockId.replace(/[^a-zA-Z0-9_]/g, '_')
}

function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function findInputConnection(
  strategy: VisualStrategy,
  blockId: string,
  portId: string,
): BlockConnection | undefined {
  return strategy.connections.find(
    (c) => c.toBlockId === blockId && c.toPort === portId,
  )
}

function resolveOutputVarName(
  conn: BlockConnection,
  blockMap: Map<string, StrategyBlock>,
): string {
  const sourceBlock = blockMap.get(conn.fromBlockId)
  if (!sourceBlock) return '"unresolved"'

  const varName = sanitizeVarName(sourceBlock.id)

  // For blocks with multiple output ports, access the specific field
  if (sourceBlock.type === 'indicator') {
    const config = sourceBlock.config as IndicatorConfig
    if (config.variant === 'macd') {
      return `${varName}.${conn.fromPort}`
    }
    if (config.variant === 'bollinger') {
      return `${varName}.${conn.fromPort}`
    }
  }

  return varName
}

function formatQuantity(config: ActionConfig): string {
  if ('quantityType' in config && config.quantityType === 'percent_equity') {
    return `context.equityPercent(${config.quantity})`
  }
  if ('quantity' in config) {
    return String(config.quantity)
  }
  return '100'
}
