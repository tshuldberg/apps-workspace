'use client'

import { cn } from '../lib/utils.js'

export type TradeGrade = 'A' | 'B' | 'C' | 'D' | 'F'

const gradeColors: Record<TradeGrade, string> = {
  A: 'bg-trading-green/20 text-trading-green border-trading-green/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-trading-red/20 text-trading-red border-trading-red/30',
}

export interface TradeGradeBadgeProps {
  grade: TradeGrade
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TradeGradeBadge({ grade, size = 'sm', className }: TradeGradeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border font-bold tabular-nums',
        gradeColors[grade],
        size === 'sm' && 'h-5 w-5 text-xs',
        size === 'md' && 'h-6 w-6 text-sm',
        size === 'lg' && 'h-8 w-8 text-base',
        className,
      )}
    >
      {grade}
    </span>
  )
}
