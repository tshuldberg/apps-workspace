'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { cn } from '../lib/utils.js'
import type {
  VisualStrategy,
  StrategyBlock,
  BlockConnection,
  BlockType,
  PortDefinition,
  ValidationError,
  ConditionVariant,
  ActionVariant,
  IndicatorVariant,
  LogicVariant,
} from '@marlin/shared'
import {
  getDefaultPorts,
  BLOCK_LABELS,
  BLOCK_TYPE_COLORS,
  validateStrategy,
  compileToTypeScript,
} from '@marlin/shared'

// ── Props ───────────────────────────────────────────────────────────────────

export interface VisualStrategyBuilderProps {
  strategy: VisualStrategy
  onStrategyChange: (strategy: VisualStrategy) => void
  className?: string
}

// ── Block Palette Definitions ───────────────────────────────────────────────

interface PaletteItem {
  type: BlockType
  variant: string
  label: string
}

const PALETTE_CATEGORIES: { label: string; type: BlockType; items: PaletteItem[] }[] = [
  {
    label: 'Conditions',
    type: 'condition',
    items: [
      { type: 'condition', variant: 'price_above', label: 'Price Above' },
      { type: 'condition', variant: 'price_below', label: 'Price Below' },
      { type: 'condition', variant: 'indicator_crossover', label: 'Crossover' },
      { type: 'condition', variant: 'indicator_threshold', label: 'Threshold' },
      { type: 'condition', variant: 'volume_spike', label: 'Volume Spike' },
      { type: 'condition', variant: 'time_of_day', label: 'Time of Day' },
    ],
  },
  {
    label: 'Actions',
    type: 'action',
    items: [
      { type: 'action', variant: 'buy_market', label: 'Buy Market' },
      { type: 'action', variant: 'sell_market', label: 'Sell Market' },
      { type: 'action', variant: 'buy_limit', label: 'Buy Limit' },
      { type: 'action', variant: 'sell_limit', label: 'Sell Limit' },
      { type: 'action', variant: 'set_stop', label: 'Set Stop' },
      { type: 'action', variant: 'close_position', label: 'Close Position' },
    ],
  },
  {
    label: 'Indicators',
    type: 'indicator',
    items: [
      { type: 'indicator', variant: 'sma', label: 'SMA' },
      { type: 'indicator', variant: 'ema', label: 'EMA' },
      { type: 'indicator', variant: 'rsi', label: 'RSI' },
      { type: 'indicator', variant: 'macd', label: 'MACD' },
      { type: 'indicator', variant: 'bollinger', label: 'Bollinger Bands' },
      { type: 'indicator', variant: 'atr', label: 'ATR' },
    ],
  },
  {
    label: 'Logic',
    type: 'logic',
    items: [
      { type: 'logic', variant: 'and', label: 'AND' },
      { type: 'logic', variant: 'or', label: 'OR' },
      { type: 'logic', variant: 'not', label: 'NOT' },
      { type: 'logic', variant: 'if_then_else', label: 'If / Then / Else' },
    ],
  },
]

// ── Default Block Configs ───────────────────────────────────────────────────

function getDefaultConfig(type: BlockType, variant: string): Record<string, unknown> {
  const base = { variant }

  switch (type) {
    case 'condition':
      switch (variant) {
        case 'price_above': return { ...base, source: 'close', threshold: 100 }
        case 'price_below': return { ...base, source: 'close', threshold: 100 }
        case 'indicator_crossover': return { ...base, fastSource: 'fast', slowSource: 'slow', direction: 'cross_above' }
        case 'indicator_threshold': return { ...base, indicatorSource: 'value', operator: 'gt', threshold: 70 }
        case 'volume_spike': return { ...base, multiplier: 2, lookbackPeriod: 20 }
        case 'time_of_day': return { ...base, startHour: 9, startMinute: 30, endHour: 16, endMinute: 0, timezone: 'America/New_York' }
        default: return base
      }
    case 'action':
      switch (variant) {
        case 'buy_market': return { ...base, quantity: 100, quantityType: 'shares' }
        case 'sell_market': return { ...base, quantity: 100, quantityType: 'shares' }
        case 'buy_limit': return { ...base, quantity: 100, quantityType: 'shares', limitOffset: 0 }
        case 'sell_limit': return { ...base, quantity: 100, quantityType: 'shares', limitOffset: 0 }
        case 'set_stop': return { ...base, stopType: 'fixed', stopValue: 2 }
        case 'close_position': return { ...base, closePercent: 100 }
        default: return base
      }
    case 'indicator':
      switch (variant) {
        case 'sma': return { ...base, period: 20, source: 'close' }
        case 'ema': return { ...base, period: 12, source: 'close' }
        case 'rsi': return { ...base, period: 14, source: 'close' }
        case 'macd': return { ...base, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: 'close' }
        case 'bollinger': return { ...base, period: 20, stdDev: 2, source: 'close' }
        case 'atr': return { ...base, period: 14 }
        default: return base
      }
    case 'logic':
      return base
    default:
      return base
  }
}

// ── ID Generator ────────────────────────────────────────────────────────────

let nextBlockId = 0
function generateBlockId(): string {
  nextBlockId++
  return `block_${Date.now()}_${nextBlockId}`
}

let nextConnectionId = 0
function generateConnectionId(): string {
  nextConnectionId++
  return `conn_${Date.now()}_${nextConnectionId}`
}

// ── Main Component ──────────────────────────────────────────────────────────

export function VisualStrategyBuilder({
  strategy,
  onStrategyChange,
  className,
}: VisualStrategyBuilderProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // ── Local State ─────────────────────────────────────────────────────────
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [connectingFrom, setConnectingFrom] = useState<{ blockId: string; portId: string } | null>(null)
  const [connectingMouse, setConnectingMouse] = useState({ x: 0, y: 0 })
  const [showCodePreview, setShowCodePreview] = useState(false)
  const [expandedPaletteCategory, setExpandedPaletteCategory] = useState<string>('Conditions')

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedBlock = useMemo(
    () => strategy.blocks.find((b) => b.id === selectedBlockId) ?? null,
    [strategy.blocks, selectedBlockId],
  )

  const validationErrors = useMemo(() => validateStrategy(strategy), [strategy])

  const generatedCode = useMemo(() => {
    if (strategy.blocks.length === 0) return '// Add blocks to generate strategy code'
    return compileToTypeScript(strategy)
  }, [strategy])

  const disconnectedPorts = useMemo(() => {
    const set = new Set<string>()
    for (const err of validationErrors) {
      set.add(`${err.blockId}:${err.portId}`)
    }
    return set
  }, [validationErrors])

  // ── Block Operations ──────────────────────────────────────────────────

  const addBlock = useCallback(
    (type: BlockType, variant: string) => {
      const id = generateBlockId()
      const ports = getDefaultPorts(type, variant)
      const label = BLOCK_LABELS[variant] ?? variant
      const config = getDefaultConfig(type, variant)

      // Place new block in a reasonable position
      const xBase = type === 'indicator' ? 100 : type === 'condition' ? 350 : type === 'logic' ? 550 : 750
      const yOffset = strategy.blocks.filter((b) => b.type === type).length * 160
      const position = { x: xBase, y: 80 + yOffset }

      const newBlock: StrategyBlock = {
        id,
        type,
        label,
        config: config as StrategyBlock['config'],
        position,
        ports,
      }

      onStrategyChange({
        ...strategy,
        blocks: [...strategy.blocks, newBlock],
      })

      setSelectedBlockId(id)
    },
    [strategy, onStrategyChange],
  )

  const deleteBlock = useCallback(
    (blockId: string) => {
      onStrategyChange({
        ...strategy,
        blocks: strategy.blocks.filter((b) => b.id !== blockId),
        connections: strategy.connections.filter(
          (c) => c.fromBlockId !== blockId && c.toBlockId !== blockId,
        ),
      })
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null)
      }
    },
    [strategy, onStrategyChange, selectedBlockId],
  )

  const updateBlockConfig = useCallback(
    (blockId: string, configUpdates: Record<string, unknown>) => {
      onStrategyChange({
        ...strategy,
        blocks: strategy.blocks.map((b) => {
          if (b.id !== blockId) return b
          return { ...b, config: { ...b.config, ...configUpdates } as StrategyBlock['config'] }
        }),
      })
    },
    [strategy, onStrategyChange],
  )

  const moveBlock = useCallback(
    (blockId: string, x: number, y: number) => {
      onStrategyChange({
        ...strategy,
        blocks: strategy.blocks.map((b) =>
          b.id === blockId ? { ...b, position: { x, y } } : b,
        ),
      })
    },
    [strategy, onStrategyChange],
  )

  // ── Connection Operations ─────────────────────────────────────────────

  const addConnection = useCallback(
    (fromBlockId: string, fromPort: string, toBlockId: string, toPort: string) => {
      // Prevent duplicate connections
      const exists = strategy.connections.some(
        (c) => c.fromBlockId === fromBlockId && c.fromPort === fromPort &&
               c.toBlockId === toBlockId && c.toPort === toPort,
      )
      if (exists) return

      // Prevent connecting to self
      if (fromBlockId === toBlockId) return

      // Remove existing connection to same input port (only one input per port)
      const filtered = strategy.connections.filter(
        (c) => !(c.toBlockId === toBlockId && c.toPort === toPort),
      )

      const newConn: BlockConnection = {
        id: generateConnectionId(),
        fromBlockId,
        fromPort,
        toBlockId,
        toPort,
      }

      onStrategyChange({
        ...strategy,
        connections: [...filtered, newConn],
      })
    },
    [strategy, onStrategyChange],
  )

  const deleteConnection = useCallback(
    (connId: string) => {
      onStrategyChange({
        ...strategy,
        connections: strategy.connections.filter((c) => c.id !== connId),
      })
    },
    [strategy, onStrategyChange],
  )

  const clearAll = useCallback(() => {
    onStrategyChange({
      ...strategy,
      blocks: [],
      connections: [],
    })
    setSelectedBlockId(null)
  }, [strategy, onStrategyChange])

  // ── Drag Handling ─────────────────────────────────────────────────────

  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, blockId: string) => {
      if ((e.target as HTMLElement).dataset.port) return // Don't drag when clicking port

      e.preventDefault()
      e.stopPropagation()
      setDraggingBlockId(blockId)
      setSelectedBlockId(blockId)

      const block = strategy.blocks.find((b) => b.id === blockId)
      if (!block) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      setDragOffset({
        x: e.clientX - rect.left - block.position.x,
        y: e.clientY - rect.top - block.position.y,
      })
    },
    [strategy.blocks],
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Block dragging
      if (draggingBlockId) {
        const x = Math.max(0, e.clientX - rect.left - dragOffset.x)
        const y = Math.max(0, e.clientY - rect.top - dragOffset.y)
        moveBlock(draggingBlockId, x, y)
      }

      // Connection drawing
      if (connectingFrom) {
        setConnectingMouse({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    },
    [draggingBlockId, dragOffset, moveBlock, connectingFrom],
  )

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingBlockId(null)
    if (connectingFrom) {
      setConnectingFrom(null)
    }
  }, [connectingFrom])

  // ── Port Click Handling ───────────────────────────────────────────────

  const handlePortClick = useCallback(
    (blockId: string, portId: string, direction: 'input' | 'output') => {
      if (direction === 'output') {
        setConnectingFrom({ blockId, portId })
      } else if (connectingFrom) {
        addConnection(connectingFrom.blockId, connectingFrom.portId, blockId, portId)
        setConnectingFrom(null)
      }
    },
    [connectingFrom, addConnection],
  )

  // ── Get Port Position (for SVG lines) ─────────────────────────────────

  function getPortPosition(block: StrategyBlock, port: PortDefinition): { x: number; y: number } {
    const BLOCK_WIDTH = 200
    const PORT_SPACING = 28
    const HEADER_HEIGHT = 32

    const portsOfDirection = block.ports.filter((p) => p.direction === port.direction)
    const portIndex = portsOfDirection.indexOf(port)

    return {
      x: block.position.x + (port.direction === 'input' ? 0 : BLOCK_WIDTH),
      y: block.position.y + HEADER_HEIGHT + 14 + portIndex * PORT_SPACING,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex h-full flex-col bg-navy-black', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-navy-dark px-4 py-2">
        <span className="text-sm font-semibold text-text-primary">Visual Strategy Builder</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCodePreview(!showCodePreview)}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              showCodePreview
                ? 'bg-accent text-text-primary'
                : 'bg-navy-mid text-text-muted hover:text-text-primary',
            )}
          >
            {showCodePreview ? 'Hide Code' : 'Show Code'}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={strategy.blocks.length === 0}
            className="rounded px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-trading-red/20 hover:text-trading-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear All
          </button>
        </div>

        {/* Validation badge */}
        {strategy.blocks.length > 0 && (
          <div className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
            validationErrors.length === 0
              ? 'bg-trading-green/20 text-trading-green'
              : 'bg-trading-red/20 text-trading-red',
          )}>
            {validationErrors.length === 0 ? 'Valid' : `${validationErrors.length} issue${validationErrors.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette Sidebar */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-border bg-navy-dark">
          <div className="px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Block Palette
            </span>
          </div>

          {PALETTE_CATEGORIES.map((category) => (
            <div key={category.label}>
              <button
                type="button"
                onClick={() => setExpandedPaletteCategory(
                  expandedPaletteCategory === category.label ? '' : category.label,
                )}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold transition-colors',
                  expandedPaletteCategory === category.label
                    ? 'bg-navy-mid text-text-primary'
                    : 'text-text-secondary hover:bg-navy-mid/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: BLOCK_TYPE_COLORS[category.type] }}
                  />
                  <span>{category.label}</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  {expandedPaletteCategory === category.label ? '\u25B2' : '\u25BC'}
                </span>
              </button>

              {expandedPaletteCategory === category.label && (
                <div className="px-2 py-1">
                  {category.items.map((item) => (
                    <button
                      key={`${item.type}-${item.variant}`}
                      type="button"
                      onClick={() => addBlock(item.type, item.variant)}
                      className="mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-navy-light hover:text-text-primary"
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: BLOCK_TYPE_COLORS[item.type] }}
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            ref={canvasRef}
            className="relative flex-1 overflow-auto bg-navy-black"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={() => {
              if (!draggingBlockId) setSelectedBlockId(null)
            }}
            style={{ minHeight: 600, minWidth: 900 }}
          >
            {/* Grid background */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Connection lines SVG */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
              {strategy.connections.map((conn) => {
                const fromBlock = strategy.blocks.find((b) => b.id === conn.fromBlockId)
                const toBlock = strategy.blocks.find((b) => b.id === conn.toBlockId)
                if (!fromBlock || !toBlock) return null

                const fromPort = fromBlock.ports.find((p) => p.id === conn.fromPort)
                const toPort = toBlock.ports.find((p) => p.id === conn.toPort)
                if (!fromPort || !toPort) return null

                const from = getPortPosition(fromBlock, fromPort)
                const to = getPortPosition(toBlock, toPort)

                const midX = (from.x + to.x) / 2
                const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`

                return (
                  <g key={conn.id}>
                    {/* Hit target (wider, invisible) */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConnection(conn.id)
                      }}
                    />
                    {/* Visible line */}
                    <path
                      d={path}
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                  </g>
                )
              })}

              {/* Active connection being drawn */}
              {connectingFrom && (() => {
                const fromBlock = strategy.blocks.find((b) => b.id === connectingFrom.blockId)
                if (!fromBlock) return null
                const fromPort = fromBlock.ports.find((p) => p.id === connectingFrom.portId)
                if (!fromPort) return null
                const from = getPortPosition(fromBlock, fromPort)
                const midX = (from.x + connectingMouse.x) / 2
                const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${connectingMouse.y}, ${connectingMouse.x} ${connectingMouse.y}`

                return (
                  <path
                    d={path}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.7"
                  />
                )
              })()}
            </svg>

            {/* Blocks */}
            {strategy.blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                disconnectedPorts={disconnectedPorts}
                connectingFrom={connectingFrom}
                onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                onDelete={() => deleteBlock(block.id)}
                onPortClick={(portId, direction) => handlePortClick(block.id, portId, direction)}
              />
            ))}

            {/* Empty state */}
            {strategy.blocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-text-muted">
                    Click blocks in the palette to add them to the canvas
                  </p>
                  <p className="mt-1 text-xs text-text-muted/60">
                    Connect output ports to input ports to build your strategy
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Code Preview Panel (bottom) */}
          {showCodePreview && (
            <div className="h-64 shrink-0 overflow-auto border-t border-border bg-navy-dark">
              <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Generated TypeScript
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode)
                  }}
                  className="rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 font-mono text-xs leading-relaxed text-text-secondary">
                {generatedCode}
              </pre>
            </div>
          )}
        </div>

        {/* Settings Panel (right side, shown when a block is selected) */}
        {selectedBlock && (
          <BlockSettingsPanel
            block={selectedBlock}
            onConfigChange={(updates) => updateBlockConfig(selectedBlock.id, updates)}
            onClose={() => setSelectedBlockId(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── BlockCard Sub-component ─────────────────────────────────────────────────

function BlockCard({
  block,
  isSelected,
  disconnectedPorts,
  connectingFrom,
  onMouseDown,
  onDelete,
  onPortClick,
}: {
  block: StrategyBlock
  isSelected: boolean
  disconnectedPorts: Set<string>
  connectingFrom: { blockId: string; portId: string } | null
  onMouseDown: (e: React.MouseEvent) => void
  onDelete: () => void
  onPortClick: (portId: string, direction: 'input' | 'output') => void
}) {
  const BLOCK_WIDTH = 200
  const PORT_SPACING = 28
  const HEADER_HEIGHT = 32
  const color = BLOCK_TYPE_COLORS[block.type]

  const inputPorts = block.ports.filter((p) => p.direction === 'input')
  const outputPorts = block.ports.filter((p) => p.direction === 'output')
  const maxPorts = Math.max(inputPorts.length, outputPorts.length, 1)
  const bodyHeight = maxPorts * PORT_SPACING + 12

  return (
    <div
      className={cn(
        'absolute select-none rounded-lg border shadow-lg transition-shadow',
        isSelected ? 'ring-2 ring-accent shadow-accent/20' : 'shadow-black/30',
      )}
      style={{
        left: block.position.x,
        top: block.position.y,
        width: BLOCK_WIDTH,
        zIndex: isSelected ? 20 : 10,
        borderColor: `${color}40`,
        backgroundColor: 'rgb(15 17 30 / 0.95)',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-t-lg px-3"
        style={{
          height: HEADER_HEIGHT,
          backgroundColor: `${color}20`,
          borderBottom: `1px solid ${color}30`,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-text-primary">{block.label}</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="rounded p-0.5 text-text-muted transition-colors hover:bg-trading-red/20 hover:text-trading-red"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>

      {/* Body with ports */}
      <div className="relative" style={{ height: bodyHeight }}>
        {/* Input ports (left side) */}
        {inputPorts.map((port, idx) => {
          const isDisconnected = disconnectedPorts.has(`${block.id}:${port.id}`)
          const isValidTarget = connectingFrom && connectingFrom.blockId !== block.id

          return (
            <div
              key={port.id}
              className="absolute flex items-center gap-1.5"
              style={{
                left: -6,
                top: 8 + idx * PORT_SPACING,
              }}
            >
              <button
                type="button"
                data-port="true"
                onClick={(e) => {
                  e.stopPropagation()
                  onPortClick(port.id, 'input')
                }}
                className={cn(
                  'h-3 w-3 rounded-full border-2 transition-all',
                  isDisconnected
                    ? 'border-trading-red bg-trading-red/30 animate-pulse'
                    : isValidTarget
                      ? 'border-accent bg-accent/30 scale-125'
                      : 'border-text-muted/40 bg-navy-dark hover:border-text-muted',
                )}
              />
              <span className="text-[10px] text-text-muted">{port.label}</span>
            </div>
          )
        })}

        {/* Output ports (right side) */}
        {outputPorts.map((port, idx) => (
          <div
            key={port.id}
            className="absolute flex items-center gap-1.5"
            style={{
              right: -6,
              top: 8 + idx * PORT_SPACING,
            }}
          >
            <span className="mr-1 text-[10px] text-text-muted">{port.label}</span>
            <button
              type="button"
              data-port="true"
              onClick={(e) => {
                e.stopPropagation()
                onPortClick(port.id, 'output')
              }}
              className={cn(
                'h-3 w-3 rounded-full border-2 transition-all',
                connectingFrom?.blockId === block.id && connectingFrom?.portId === port.id
                  ? 'border-accent bg-accent scale-125'
                  : 'border-text-muted/40 bg-navy-dark hover:border-accent hover:bg-accent/30',
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── BlockSettingsPanel ──────────────────────────────────────────────────────

function BlockSettingsPanel({
  block,
  onConfigChange,
  onClose,
}: {
  block: StrategyBlock
  onConfigChange: (updates: Record<string, unknown>) => void
  onClose: () => void
}) {
  const config = block.config as Record<string, unknown>

  return (
    <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-navy-dark">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold text-text-primary">{block.label} Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {/* Render config fields dynamically based on the block config */}
        {Object.entries(config).map(([key, value]) => {
          // Skip variant field (it's shown in the header)
          if (key === 'variant') return null

          return (
            <div key={key}>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                {formatConfigLabel(key)}
              </label>
              {typeof value === 'number' && (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => onConfigChange({ [key]: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-primary outline-none focus:border-accent"
                />
              )}
              {typeof value === 'string' && (
                isEnumField(key) ? (
                  <select
                    value={value}
                    onChange={(e) => onConfigChange({ [key]: e.target.value })}
                    className="w-full rounded border border-border bg-navy-mid px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                  >
                    {getEnumOptions(key).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onConfigChange({ [key]: e.target.value })}
                    className="w-full rounded border border-border bg-navy-mid px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                  />
                )
              )}
              {typeof value === 'boolean' && (
                <button
                  type="button"
                  onClick={() => onConfigChange({ [key]: !value })}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    value
                      ? 'bg-trading-green/20 text-trading-green'
                      : 'bg-navy-mid text-text-muted',
                  )}
                >
                  {value ? 'On' : 'Off'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Settings Panel Helpers ──────────────────────────────────────────────────

function formatConfigLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
}

function isEnumField(key: string): boolean {
  const enumFields = new Set([
    'source', 'direction', 'operator', 'stopType', 'quantityType', 'timezone',
  ])
  return enumFields.has(key)
}

function getEnumOptions(key: string): string[] {
  switch (key) {
    case 'source':
      return ['close', 'open', 'high', 'low', 'hl2', 'hlc3']
    case 'direction':
      return ['cross_above', 'cross_below']
    case 'operator':
      return ['gt', 'gte', 'lt', 'lte', 'eq']
    case 'stopType':
      return ['fixed', 'trailing', 'atr_based']
    case 'quantityType':
      return ['shares', 'percent_equity']
    default:
      return []
  }
}
