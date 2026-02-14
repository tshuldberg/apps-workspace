'use client'

import { useState, useMemo } from 'react'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs.js'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../primitives/tooltip.js'
import { cn } from '../lib/utils.js'

export interface Alert {
  id: string
  symbol: string
  conditionType: string
  threshold: string
  deliveryMethod: string
  status: 'active' | 'paused' | 'triggered'
  message: string | null
  createdAt: string
}

export interface AlertTrigger {
  id: string
  alertId: string
  triggeredAt: string
  priceAtTrigger: string
  message: string | null
}

export interface AlertManagerProps {
  alerts: Alert[]
  selectedAlertTriggers?: AlertTrigger[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onViewHistory: (alertId: string) => void
  onCreate: () => void
  className?: string
}

const CONDITION_LABELS: Record<string, string> = {
  price_above: 'Price Above',
  price_below: 'Price Below',
  price_crossing_up: 'Price Crossing Up',
  price_crossing_down: 'Price Crossing Down',
  volume_above: 'Volume Above',
  rvol_above: 'RVOL Above',
  rsi_above: 'RSI Above',
  rsi_below: 'RSI Below',
  macd_crossover: 'MACD Cross',
  ma_crossover: 'MA Cross',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-trading-green',
  paused: 'bg-amber-500',
  triggered: 'bg-accent',
}

export function AlertManager({
  alerts,
  selectedAlertTriggers = [],
  onPause,
  onResume,
  onDelete,
  onBulkDelete,
  onViewHistory,
  onCreate,
  className,
}: AlertManagerProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'triggered'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [historyAlertId, setHistoryAlertId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = alerts
    if (statusFilter !== 'all') {
      items = items.filter((a) => a.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          (CONDITION_LABELS[a.conditionType] ?? '').toLowerCase().includes(q),
      )
    }
    return items
  }, [alerts, statusFilter, search])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)))
    }
  }

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleViewHistory = (alertId: string) => {
    setHistoryAlertId(alertId)
    onViewHistory(alertId)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Alerts</h3>
        <Button variant="outline" size="sm" onClick={onCreate} className="gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Alert
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="triggered">Triggered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-navy-mid px-3 py-1.5 text-xs text-text-secondary">
          <span>{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={handleBulkDelete} className="h-6 text-xs text-trading-red">
            Delete
          </Button>
        </div>
      )}

      {/* Alert list */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="text-xs">List</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-2 max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No alerts{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
            </p>
          ) : (
            <div className="space-y-1">
              {/* Select all */}
              <div className="flex items-center gap-2 px-3 py-1 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="h-3 w-3 rounded border-border"
                />
                <span>Select all</span>
              </div>

              {filtered.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border px-3 py-2 transition-colors',
                    'hover:bg-navy-light',
                    selectedIds.has(alert.id) && 'bg-navy-mid',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(alert.id)}
                    onChange={() => toggleSelect(alert.id)}
                    className="h-3 w-3 rounded border-border"
                  />

                  {/* Status dot */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[alert.status])} />
                      </TooltipTrigger>
                      <TooltipContent>{alert.status}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Symbol */}
                  <span className="min-w-[4rem] font-mono text-sm font-semibold text-text-primary">
                    {alert.symbol}
                  </span>

                  {/* Condition */}
                  <span className="flex-1 text-xs text-text-secondary">
                    {CONDITION_LABELS[alert.conditionType] ?? alert.conditionType}
                    {!['macd_crossover', 'ma_crossover'].includes(alert.conditionType) && (
                      <span className="ml-1 font-mono text-text-primary">{alert.threshold}</span>
                    )}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1">
                    {alert.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => onPause(alert.id)}
                      >
                        Pause
                      </Button>
                    ) : alert.status === 'paused' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => onResume(alert.id)}
                      >
                        Resume
                      </Button>
                    ) : null}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleViewHistory(alert.id)}
                    >
                      History
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-trading-red"
                      onClick={() => onDelete(alert.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-2 max-h-96 overflow-y-auto">
          {historyAlertId === null ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Select an alert to view trigger history
            </p>
          ) : selectedAlertTriggers.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No triggers recorded for this alert
            </p>
          ) : (
            <div className="space-y-1">
              {selectedAlertTriggers.map((trigger) => (
                <div
                  key={trigger.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
                >
                  <span className="text-text-secondary">
                    {new Date(trigger.triggeredAt).toLocaleString()}
                  </span>
                  <span className="font-mono text-text-primary">
                    ${trigger.priceAtTrigger}
                  </span>
                  {trigger.message && (
                    <span className="max-w-48 truncate text-text-muted">{trigger.message}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
