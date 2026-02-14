'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { Strike, OptionsContract } from '@marlin/shared'

export interface OptionsChainProps {
  strikes: Strike[]
  underlyingPrice: number
  onContractClick?: (contract: OptionsContract) => void
  className?: string
}

const COLUMNS = ['Bid', 'Ask', 'Last', 'Vol', 'OI', 'IV', '\u0394', '\u0393', '\u0398', 'V'] as const

function formatNumber(n: number | undefined, decimals = 2): string {
  if (n === undefined || n === 0) return '-'
  return n.toFixed(decimals)
}

function formatVolume(vol: number | undefined): string {
  if (!vol) return '-'
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

function formatIV(iv: number | undefined): string {
  if (!iv) return '-'
  return `${(iv * 100).toFixed(1)}%`
}

function ContractRow({
  contract,
  isITM,
  side,
  onContractClick,
}: {
  contract?: OptionsContract
  isITM: boolean
  side: 'call' | 'put'
  onContractClick?: (contract: OptionsContract) => void
}) {
  if (!contract) {
    return (
      <div className="flex">
        {COLUMNS.map((_, i) => (
          <div key={i} className="w-[60px] px-1 py-0.5 text-right font-mono text-[11px] text-text-muted">
            -
          </div>
        ))}
      </div>
    )
  }

  const cells = [
    { value: formatNumber(contract.bid), color: 'text-text-secondary' },
    { value: formatNumber(contract.ask), color: 'text-text-secondary' },
    { value: formatNumber(contract.last), color: 'text-text-primary' },
    { value: formatVolume(contract.volume), color: 'text-text-secondary' },
    { value: formatVolume(contract.openInterest), color: 'text-text-secondary' },
    { value: formatIV(contract.iv), color: 'text-accent' },
    { value: formatNumber(contract.greeks.delta, 3), color: 'text-text-secondary' },
    { value: formatNumber(contract.greeks.gamma, 4), color: 'text-text-secondary' },
    { value: formatNumber(contract.greeks.theta, 3), color: 'text-text-secondary' },
    { value: formatNumber(contract.greeks.vega, 3), color: 'text-text-secondary' },
  ]

  // Reverse for puts so the layout mirrors
  const displayCells = side === 'put' ? [...cells].reverse() : cells

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onContractClick?.(contract)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onContractClick?.(contract)
      }}
      className={cn(
        'flex cursor-pointer transition-colors hover:bg-navy-light',
        isITM && 'bg-accent/5',
      )}
    >
      {displayCells.map((cell, i) => (
        <div
          key={i}
          className={cn(
            'w-[60px] px-1 py-0.5 font-mono text-[11px] tabular-nums',
            side === 'put' ? 'text-left' : 'text-right',
            cell.color,
          )}
        >
          {cell.value}
        </div>
      ))}
    </div>
  )
}

export function OptionsChain({ strikes, underlyingPrice, onContractClick, className }: OptionsChainProps) {
  // Find the index where strike crosses from ITM to OTM for calls
  const atmIndex = useMemo(() => {
    let closest = 0
    let minDiff = Infinity
    for (let i = 0; i < strikes.length; i++) {
      const diff = Math.abs(strikes[i]!.price - underlyingPrice)
      if (diff < minDiff) {
        minDiff = diff
        closest = i
      }
    }
    return closest
  }, [strikes, underlyingPrice])

  const callHeaders = COLUMNS
  const putHeaders = [...COLUMNS].reverse()

  return (
    <div className={cn('flex flex-col overflow-hidden bg-navy-dark', className)}>
      {/* Column Headers */}
      <div className="flex border-b border-border">
        {/* Calls header */}
        <div className="flex flex-1 items-center justify-center border-r border-border py-1">
          <span className="text-xs font-semibold text-trading-green">CALLS</span>
        </div>
        {/* Strike header */}
        <div className="flex w-[80px] items-center justify-center py-1">
          <span className="text-xs font-semibold text-text-primary">Strike</span>
        </div>
        {/* Puts header */}
        <div className="flex flex-1 items-center justify-center border-l border-border py-1">
          <span className="text-xs font-semibold text-trading-red">PUTS</span>
        </div>
      </div>

      {/* Sub-headers */}
      <div className="flex border-b border-border bg-navy-mid/50">
        {/* Call columns */}
        <div className="flex flex-1 border-r border-border">
          {callHeaders.map((col) => (
            <div
              key={col}
              className="w-[60px] px-1 py-0.5 text-right text-[10px] font-medium text-text-muted"
            >
              {col}
            </div>
          ))}
        </div>
        {/* Strike column */}
        <div className="w-[80px]" />
        {/* Put columns (reversed) */}
        <div className="flex flex-1 border-l border-border">
          {putHeaders.map((col) => (
            <div
              key={col}
              className="w-[60px] px-1 py-0.5 text-left text-[10px] font-medium text-text-muted"
            >
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {strikes.map((strike, i) => {
          const callITM = strike.price < underlyingPrice
          const putITM = strike.price > underlyingPrice
          const isATM = i === atmIndex

          return (
            <div
              key={strike.price}
              className={cn('flex border-b border-border/30', isATM && 'border-b-accent/40')}
            >
              {/* Call side */}
              <div className="flex flex-1 border-r border-border">
                <ContractRow
                  contract={strike.call}
                  isITM={callITM}
                  side="call"
                  onContractClick={onContractClick}
                />
              </div>

              {/* Strike price center */}
              <div
                className={cn(
                  'flex w-[80px] items-center justify-center font-mono text-xs font-semibold tabular-nums',
                  isATM ? 'bg-accent/10 text-accent' : 'text-text-primary',
                )}
              >
                {strike.price.toFixed(2)}
              </div>

              {/* Put side */}
              <div className="flex flex-1 border-l border-border">
                <ContractRow
                  contract={strike.put}
                  isITM={putITM}
                  side="put"
                  onContractClick={onContractClick}
                />
              </div>
            </div>
          )
        })}

        {strikes.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No options data available
          </div>
        )}
      </div>
    </div>
  )
}
