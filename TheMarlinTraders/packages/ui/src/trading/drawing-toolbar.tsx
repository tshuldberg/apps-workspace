'use client'

import { useCallback } from 'react'
import { Button } from '../primitives/button.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../primitives/dropdown-menu.js'
import { cn } from '../lib/utils.js'

export type DrawingToolType =
  | 'trendline'
  | 'ray'
  | 'extended-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'parallel-channel'
  | 'regression-channel'
  | 'fib-retracement'
  | 'fib-extension'
  | 'fib-fan'
  | 'fib-arcs'
  | 'fib-time-zones'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'text-label'
  | 'price-label'
  | 'callout'
  | 'gann-fan'
  | 'gann-box'
  | 'elliott-wave'
  | 'xabcd-harmonic'
  | 'risk-reward'
  | 'price-range'
  | 'bar-count'

export type LineStyleType = 'solid' | 'dashed' | 'dotted'

interface ToolGroup {
  label: string
  tools: { type: DrawingToolType; label: string; icon: string }[]
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: 'Lines',
    tools: [
      { type: 'trendline', label: 'Trend Line', icon: '/' },
      { type: 'ray', label: 'Ray', icon: '\u2192' },
      { type: 'extended-line', label: 'Extended Line', icon: '\u2194' },
      { type: 'horizontal-line', label: 'Horizontal Line', icon: '\u2014' },
      { type: 'vertical-line', label: 'Vertical Line', icon: '|' },
    ],
  },
  {
    label: 'Channels',
    tools: [
      { type: 'parallel-channel', label: 'Parallel Channel', icon: '=' },
      { type: 'regression-channel', label: 'Regression Channel', icon: '\u2248' },
    ],
  },
  {
    label: 'Fibonacci',
    tools: [
      { type: 'fib-retracement', label: 'Fib Retracement', icon: '%' },
      { type: 'fib-extension', label: 'Fib Extension', icon: '\u2030' },
      { type: 'fib-fan', label: 'Fib Fan', icon: '\u2227' },
      { type: 'fib-arcs', label: 'Fib Arcs', icon: '\u2312' },
      { type: 'fib-time-zones', label: 'Fib Time Zones', icon: '\u23F0' },
    ],
  },
  {
    label: 'Gann',
    tools: [
      { type: 'gann-fan', label: 'Gann Fan', icon: '\u2299' },
      { type: 'gann-box', label: 'Gann Box', icon: '\u229E' },
    ],
  },
  {
    label: 'Patterns',
    tools: [
      { type: 'elliott-wave', label: 'Elliott Wave', icon: 'W' },
      { type: 'xabcd-harmonic', label: 'XABCD Harmonic', icon: 'H' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { type: 'rectangle', label: 'Rectangle', icon: '\u25A1' },
      { type: 'circle', label: 'Circle', icon: '\u25CB' },
      { type: 'triangle', label: 'Triangle', icon: '\u25B3' },
    ],
  },
  {
    label: 'Annotations',
    tools: [
      { type: 'text-label', label: 'Text', icon: 'T' },
      { type: 'price-label', label: 'Price Label', icon: '$' },
      { type: 'callout', label: 'Callout', icon: 'C' },
    ],
  },
  {
    label: 'Measure',
    tools: [
      { type: 'risk-reward', label: 'Risk/Reward', icon: 'R' },
      { type: 'price-range', label: 'Price Range', icon: '\u2195' },
      { type: 'bar-count', label: 'Bar Count', icon: '#' },
    ],
  },
]

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#8b5cf6',
  '#ffffff',
  '#94a3b8',
]

const LINE_WIDTHS = [1, 2, 3, 4, 5]

export interface DrawingToolbarProps {
  activeTool: DrawingToolType | null
  color: string
  lineWidth: number
  lineStyle: LineStyleType
  onSelectTool: (tool: DrawingToolType | null) => void
  onColorChange: (color: string) => void
  onLineWidthChange: (width: number) => void
  onLineStyleChange: (style: LineStyleType) => void
  onDeleteSelected: () => void
  onClearAll: () => void
  hasSelection: boolean
}

export function DrawingToolbar({
  activeTool,
  color,
  lineWidth,
  lineStyle,
  onSelectTool,
  onColorChange,
  onLineWidthChange,
  onLineStyleChange,
  onDeleteSelected,
  onClearAll,
  hasSelection,
}: DrawingToolbarProps) {
  const handleSelectTool = useCallback(
    (type: DrawingToolType) => {
      onSelectTool(activeTool === type ? null : type)
    },
    [activeTool, onSelectTool],
  )

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-navy-dark px-2 py-1">
      {/* Tool groups */}
      {TOOL_GROUPS.map((group) => (
        <DropdownMenu key={group.label}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-2 text-xs text-text-secondary hover:text-text-primary',
                group.tools.some((t) => t.type === activeTool) &&
                  'bg-accent text-text-primary',
              )}
            >
              {group.tools[0].icon}
              <span className="ml-1 hidden sm:inline">{group.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {group.tools.map((tool) => (
              <DropdownMenuItem
                key={tool.type}
                className={cn(
                  activeTool === tool.type && 'bg-accent text-text-primary',
                )}
                onSelect={() => handleSelectTool(tool.type)}
              >
                <span className="w-5 text-center">{tool.icon}</span>
                <span>{tool.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}

      {/* Separator */}
      <div className="mx-1 h-5 w-px bg-border" />

      {/* Color picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-6 w-6 rounded border border-border"
            style={{ backgroundColor: color }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2">
          <div className="grid grid-cols-6 gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'h-6 w-6 rounded border',
                  c === color ? 'border-text-primary' : 'border-border',
                )}
                style={{ backgroundColor: c }}
                onClick={() => onColorChange(c)}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Line width */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <div
              className="rounded-full bg-text-primary"
              style={{ width: lineWidth * 2 + 4, height: lineWidth * 2 + 4 }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2">
          <div className="flex gap-1">
            {LINE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded border',
                  w === lineWidth ? 'border-text-primary bg-accent' : 'border-border',
                )}
                onClick={() => onLineWidthChange(w)}
              >
                <div
                  className="rounded-full bg-text-primary"
                  style={{ width: w * 2 + 2, height: w * 2 + 2 }}
                />
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Line style */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            {lineStyle === 'solid' ? '___' : lineStyle === 'dashed' ? '- - -' : '...'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['solid', 'dashed', 'dotted'] as const).map((style) => (
            <DropdownMenuItem
              key={style}
              className={cn(
                style === lineStyle && 'bg-accent text-text-primary',
              )}
              onSelect={() => onLineStyleChange(style)}
            >
              <svg width="40" height="2" className="inline-block">
                <line
                  x1="0"
                  y1="1"
                  x2="40"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={
                    style === 'dashed' ? '8,4' : style === 'dotted' ? '2,4' : 'none'
                  }
                />
              </svg>
              <span className="capitalize">{style}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="mx-1 h-5 w-px bg-border" />

      {/* Delete */}
      {hasSelection && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-trading-red hover:text-trading-red"
          onClick={onDeleteSelected}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </Button>
      )}

      {/* Clear all */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-text-muted hover:text-text-secondary"
        onClick={onClearAll}
      >
        Clear
      </Button>

      {/* Cursor mode (deselect tool) */}
      {activeTool && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onSelectTool(null)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
        </Button>
      )}
    </div>
  )
}
