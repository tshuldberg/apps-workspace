'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../primitives/dialog.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js'
import { cn } from '../lib/utils.js'

const CONDITION_TYPES = [
  { value: 'price_above', label: 'Price Above', group: 'Price' },
  { value: 'price_below', label: 'Price Below', group: 'Price' },
  { value: 'price_crossing_up', label: 'Price Crossing Up', group: 'Price' },
  { value: 'price_crossing_down', label: 'Price Crossing Down', group: 'Price' },
  { value: 'volume_above', label: 'Volume Above', group: 'Volume' },
  { value: 'rvol_above', label: 'Relative Volume Above', group: 'Volume' },
  { value: 'rsi_above', label: 'RSI Above', group: 'Indicator' },
  { value: 'rsi_below', label: 'RSI Below', group: 'Indicator' },
  { value: 'macd_crossover', label: 'MACD Crossover', group: 'Indicator' },
  { value: 'ma_crossover', label: 'MA Crossover', group: 'Indicator' },
] as const

const DELIVERY_METHODS = [
  { value: 'in_app', label: 'In-App' },
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'push', label: 'Push Notification' },
] as const

type ConditionType = (typeof CONDITION_TYPES)[number]['value']
type DeliveryMethod = (typeof DELIVERY_METHODS)[number]['value']

export interface AlertCreateInput {
  symbol: string
  conditionType: ConditionType
  threshold: string
  deliveryMethod: DeliveryMethod
  webhookUrl?: string
  message?: string
}

export interface AlertCreatorProps {
  symbol?: string
  defaultPrice?: number
  onSubmit: (alert: AlertCreateInput) => void
  trigger?: React.ReactNode
  className?: string
}

export function AlertCreator({
  symbol: initialSymbol = '',
  defaultPrice,
  onSubmit,
  trigger,
  className,
}: AlertCreatorProps) {
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState(initialSymbol)
  const [conditionType, setConditionType] = useState<ConditionType>('price_above')
  const [threshold, setThreshold] = useState(defaultPrice?.toString() ?? '')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('in_app')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!symbol.trim() || !threshold.trim()) return

      onSubmit({
        symbol: symbol.toUpperCase(),
        conditionType,
        threshold,
        deliveryMethod,
        webhookUrl: deliveryMethod === 'webhook' ? webhookUrl : undefined,
        message: message.trim() || undefined,
      })

      setOpen(false)
      setThreshold('')
      setMessage('')
    },
    [symbol, conditionType, threshold, deliveryMethod, webhookUrl, message, onSubmit],
  )

  const needsThreshold = !['macd_crossover', 'ma_crossover'].includes(conditionType)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Create Alert
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Alert</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Symbol</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="AAPL"
              className="uppercase"
            />
          </div>

          {/* Condition Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Condition</label>
            <Select value={conditionType} onValueChange={(v) => setConditionType(v as ConditionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Threshold */}
          {needsThreshold && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Threshold</label>
              <Input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="150.00"
              />
            </div>
          )}

          {/* Delivery Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Delivery</label>
            <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_METHODS.map((dm) => (
                  <SelectItem key={dm.value} value={dm.value}>
                    {dm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Webhook URL (conditional) */}
          {deliveryMethod === 'webhook' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Webhook URL</label>
              <Input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>
          )}

          {/* Custom Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Message (optional)</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Custom alert message"
              maxLength={500}
            />
          </div>

          <Button type="submit" className="w-full">
            Create Alert
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
