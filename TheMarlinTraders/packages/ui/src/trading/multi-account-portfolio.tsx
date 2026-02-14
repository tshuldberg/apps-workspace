'use client'

import { useMemo, useState } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'

// ── Types ────────────────────────────────────────────────

export interface AccountPosition {
  symbol: string
  quantity: number
  avgEntryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
}

export interface AccountInfo {
  accountId: string
  alias: string
  provider: 'alpaca' | 'ibkr' | 'tradier' | 'paper'
  isPaper: boolean
  equity: number
  cashBalance: number
  buyingPower: number
  portfolioValue: number
  unrealizedPnL: number
  positions: AccountPosition[]
}

export interface MultiAccountPortfolioProps {
  accounts: AccountInfo[]
  activeAccountId?: string | null
  onSwitchAccount?: (accountId: string) => void
  onClosePosition?: (accountId: string, symbol: string) => void
  className?: string
}

// ── Helpers ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

// ── Badge Styles ─────────────────────────────────────────

const PROVIDER_BADGES: Record<string, { label: string; className: string }> = {
  paper: { label: 'PAPER', className: 'bg-warning/20 text-warning' },
  alpaca: { label: 'ALPACA', className: 'bg-trading-green/20 text-trading-green' },
  'alpaca-paper': { label: 'ALPACA PAPER', className: 'bg-warning/20 text-warning' },
  ibkr: { label: 'IBKR', className: 'bg-accent/20 text-accent' },
  'ibkr-paper': { label: 'IBKR PAPER', className: 'bg-warning/20 text-warning' },
  tradier: { label: 'TRADIER', className: 'bg-purple-500/20 text-purple-400' },
}

function getProviderBadge(provider: string, isPaper: boolean) {
  const key = isPaper ? `${provider}-paper` : provider
  return PROVIDER_BADGES[key] ?? { label: provider.toUpperCase(), className: 'bg-text-muted/20 text-text-muted' }
}

// ── Component ────────────────────────────────────────────

export function MultiAccountPortfolio({
  accounts,
  activeAccountId,
  onSwitchAccount,
  onClosePosition,
  className,
}: MultiAccountPortfolioProps) {
  const [selectedTab, setSelectedTab] = useState<string>('all')

  // Compute aggregate totals
  const aggregate = useMemo(() => {
    let totalEquity = 0
    let totalCash = 0
    let totalBuyingPower = 0
    let totalPortfolioValue = 0
    let totalUnrealizedPnL = 0

    for (const account of accounts) {
      totalEquity += account.equity
      totalCash += account.cashBalance
      totalBuyingPower += account.buyingPower
      totalPortfolioValue += account.portfolioValue
      totalUnrealizedPnL += account.unrealizedPnL
    }

    return { totalEquity, totalCash, totalBuyingPower, totalPortfolioValue, totalUnrealizedPnL }
  }, [accounts])

  // Merge positions across all accounts for "All" view
  const allPositions = useMemo(() => {
    const posMap = new Map<string, AccountPosition & { accountId: string; alias: string }>()

    for (const account of accounts) {
      for (const pos of account.positions) {
        const existing = posMap.get(pos.symbol)
        if (existing) {
          // Aggregate: weighted average entry, sum quantities
          const totalQty = existing.quantity + pos.quantity
          const weightedAvg =
            (existing.avgEntryPrice * existing.quantity +
              pos.avgEntryPrice * pos.quantity) /
            totalQty
          posMap.set(pos.symbol, {
            ...existing,
            quantity: totalQty,
            avgEntryPrice: weightedAvg,
            currentPrice: pos.currentPrice,
            marketValue: existing.marketValue + pos.marketValue,
            unrealizedPnL: existing.unrealizedPnL + pos.unrealizedPnL,
            unrealizedPnLPercent:
              weightedAvg > 0
                ? ((pos.currentPrice - weightedAvg) / weightedAvg) * 100
                : 0,
            alias: 'Multiple',
          })
        } else {
          posMap.set(pos.symbol, {
            ...pos,
            accountId: account.accountId,
            alias: account.alias,
          })
        }
      }
    }

    return Array.from(posMap.values())
  }, [accounts])

  const selectedAccount = accounts.find((a) => a.accountId === selectedTab)
  const displayPositions =
    selectedTab === 'all'
      ? allPositions
      : selectedAccount?.positions.map((p) => ({
          ...p,
          accountId: selectedAccount.accountId,
          alias: selectedAccount.alias,
        })) ?? []

  const displaySummary =
    selectedTab === 'all'
      ? aggregate
      : selectedAccount
        ? {
            totalEquity: selectedAccount.equity,
            totalCash: selectedAccount.cashBalance,
            totalBuyingPower: selectedAccount.buyingPower,
            totalPortfolioValue: selectedAccount.portfolioValue,
            totalUnrealizedPnL: selectedAccount.unrealizedPnL,
          }
        : aggregate

  const pnlColor = displaySummary.totalUnrealizedPnL >= 0 ? 'text-trading-green' : 'text-trading-red'

  return (
    <div
      className={cn(
        'flex flex-col rounded-panel border border-border bg-navy-dark',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold text-text-primary">
          Portfolio
        </span>
        {activeAccountId && onSwitchAccount && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-text-muted hover:text-accent"
            onClick={() => {
              // Cycle to next account
              const idx = accounts.findIndex((a) => a.accountId === activeAccountId)
              const next = accounts[(idx + 1) % accounts.length]
              if (next) onSwitchAccount(next.accountId)
            }}
          >
            Switch Account
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
        <button
          onClick={() => setSelectedTab('all')}
          className={cn(
            'shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors',
            selectedTab === 'all'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          All Accounts
        </button>
        {accounts.map((account) => {
          const badge = getProviderBadge(account.provider, account.isPaper)
          return (
            <button
              key={account.accountId}
              onClick={() => setSelectedTab(account.accountId)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                selectedTab === account.accountId
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              <span className={cn('rounded px-1 py-0.5 text-[10px] font-bold', badge.className)}>
                {badge.label}
              </span>
              {account.alias}
            </button>
          )
        })}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Total Equity</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(displaySummary.totalEquity)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Cash</span>
          <span className="font-mono text-sm tabular-nums text-text-primary">
            {formatCurrency(displaySummary.totalCash)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Buying Power</span>
          <span className="font-mono text-sm tabular-nums text-text-primary">
            {formatCurrency(displaySummary.totalBuyingPower)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Unrealized P&L</span>
          <span className={cn('font-mono text-sm font-semibold tabular-nums', pnlColor)}>
            {formatCurrency(displaySummary.totalUnrealizedPnL)}
          </span>
        </div>
      </div>

      {/* Positions table */}
      {displayPositions.length === 0 ? (
        <div className="p-4 text-center text-sm text-text-muted">
          No open positions
          {selectedTab !== 'all' ? ' in this account' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="px-4 py-2 font-medium">Symbol</th>
                {selectedTab === 'all' && (
                  <th className="px-4 py-2 font-medium">Account</th>
                )}
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Avg Cost</th>
                <th className="px-4 py-2 font-medium text-right">Current</th>
                <th className="px-4 py-2 font-medium text-right">Mkt Value</th>
                <th className="px-4 py-2 font-medium text-right">P&L</th>
                <th className="px-4 py-2 font-medium text-right">%</th>
                {onClosePosition && <th className="px-4 py-2 font-medium text-right" />}
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((pos) => (
                <tr
                  key={`${pos.symbol}-${'accountId' in pos ? pos.accountId : ''}`}
                  className="border-b border-border/50 hover:bg-navy-mid/50"
                >
                  <td className="px-4 py-2 font-mono font-semibold text-text-primary">
                    {pos.symbol}
                  </td>
                  {selectedTab === 'all' && (
                    <td className="px-4 py-2 text-xs text-text-muted">
                      {'alias' in pos ? pos.alias : ''}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {pos.quantity}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-secondary">
                    {formatCurrency(pos.avgEntryPrice)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {formatCurrency(pos.currentPrice)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {formatCurrency(pos.marketValue)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-mono tabular-nums',
                      pos.unrealizedPnL >= 0
                        ? 'text-trading-green'
                        : 'text-trading-red',
                    )}
                  >
                    {formatCurrency(pos.unrealizedPnL)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-mono tabular-nums',
                      pos.unrealizedPnLPercent >= 0
                        ? 'text-trading-green'
                        : 'text-trading-red',
                    )}
                  >
                    {formatPercent(pos.unrealizedPnLPercent)}
                  </td>
                  {onClosePosition && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          onClosePosition(
                            'accountId' in pos ? (pos.accountId as string) : '',
                            pos.symbol,
                          )
                        }
                      >
                        Close
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
