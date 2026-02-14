'use client'

import { useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'
import { TradeGradeBadge, type TradeGrade } from '@marlin/ui/trading/trade-grade-badge'

type SetupType = 'breakout' | 'pullback' | 'reversal' | 'range' | 'momentum' | 'other'
type EmotionalState = 'calm' | 'fomo' | 'fearful' | 'greedy' | 'disciplined' | 'other'
type MarketCondition = 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'low_volume'

interface JournalEntry {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  entryPrice: string
  exitPrice: string | null
  quantity: string
  pnl: string | null
  rMultiple: string | null
  setupType: SetupType
  emotionalState: EmotionalState
  marketCondition: MarketCondition
  grade: TradeGrade | null
  notes: string | null
  chartSnapshotUrl: string | null
  tags: string[]
  entryDate: string
  exitDate: string | null
}

const SETUP_TYPES: SetupType[] = ['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other']
const EMOTIONAL_STATES: EmotionalState[] = ['calm', 'fomo', 'fearful', 'greedy', 'disciplined', 'other']
const MARKET_CONDITIONS: MarketCondition[] = ['trending_up', 'trending_down', 'ranging', 'volatile', 'low_volume']
const GRADES: TradeGrade[] = ['A', 'B', 'C', 'D', 'F']

// Placeholder — will be replaced with tRPC query
const MOCK_ENTRY: JournalEntry = {
  id: '1',
  symbol: 'AAPL',
  side: 'buy',
  entryPrice: '178.50',
  exitPrice: '185.20',
  quantity: '100',
  pnl: '670.00',
  rMultiple: '2.15',
  setupType: 'breakout',
  emotionalState: 'disciplined',
  marketCondition: 'trending_up',
  grade: 'A',
  notes: 'Clean breakout above the 200 SMA on strong volume. Waited for the pullback retest before entering. Exit was on the second push toward resistance at 186. Could have held for more but followed the plan.',
  chartSnapshotUrl: null,
  tags: ['earnings', 'momentum'],
  entryDate: new Date(Date.now() - 86400000 * 2).toISOString(),
  exitDate: new Date(Date.now() - 86400000).toISOString(),
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RMultipleGauge({ value }: { value: number }) {
  // Scale: -3R to +3R mapped to 0-100%
  const clampedVal = Math.max(-3, Math.min(3, value))
  const percent = ((clampedVal + 3) / 6) * 100
  const isPositive = value >= 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">R-Multiple</span>
        <span
          className={cn(
            'font-mono text-sm font-bold tabular-nums',
            isPositive ? 'text-trading-green' : 'text-trading-red',
          )}
        >
          {isPositive ? '+' : ''}{value.toFixed(2)}R
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-navy-mid">
        {/* Center marker at 0R */}
        <div
          className="absolute top-0 h-full w-px bg-text-muted/50"
          style={{ left: '50%' }}
        />
        {/* Fill bar */}
        <div
          className={cn(
            'absolute top-0 h-full rounded-full transition-all',
            isPositive ? 'bg-trading-green' : 'bg-trading-red',
          )}
          style={
            isPositive
              ? { left: '50%', width: `${percent - 50}%` }
              : { left: `${percent}%`, width: `${50 - percent}%` }
          }
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>-3R</span>
        <span>0</span>
        <span>+3R</span>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-text-muted">{label}</span>
      <div>{children}</div>
    </div>
  )
}

export default function JournalEntryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [isEditing, setIsEditing] = useState(false)
  const [entry, setEntry] = useState<JournalEntry>(MOCK_ENTRY)

  // Edit state
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')
  const [editGrade, setEditGrade] = useState<TradeGrade | null>(entry.grade)
  const [editEmotional, setEditEmotional] = useState<EmotionalState>(entry.emotionalState)
  const [editSetup, setEditSetup] = useState<SetupType>(entry.setupType)
  const [editCondition, setEditCondition] = useState<MarketCondition>(entry.marketCondition)

  const pnlNum = entry.pnl ? parseFloat(entry.pnl) : null
  const rNum = entry.rMultiple ? parseFloat(entry.rMultiple) : null

  function handleSave() {
    setEntry({
      ...entry,
      notes: editNotes || null,
      grade: editGrade,
      emotionalState: editEmotional,
      setupType: editSetup,
      marketCondition: editCondition,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    setEditNotes(entry.notes ?? '')
    setEditGrade(entry.grade)
    setEditEmotional(entry.emotionalState)
    setEditSetup(entry.setupType)
    setEditCondition(entry.marketCondition)
    setIsEditing(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-text-muted hover:text-text-primary"
            onClick={() => router.push('/journal')}
          >
            &larr; Journal
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-semibold text-text-primary">{entry.symbol}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
              entry.side === 'buy'
                ? 'bg-trading-green/20 text-trading-green'
                : 'bg-trading-red/20 text-trading-red',
            )}
          >
            {entry.side}
          </span>
          {entry.grade && <TradeGradeBadge grade={entry.grade} size="md" />}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-trading-red hover:text-trading-red"
                onClick={() => {
                  router.push('/journal')
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Trade Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <DetailRow label="Entry Price">
                <span className="font-mono text-sm text-text-primary">{formatCurrency(entry.entryPrice)}</span>
              </DetailRow>
              <DetailRow label="Exit Price">
                <span className="font-mono text-sm text-text-primary">
                  {entry.exitPrice ? formatCurrency(entry.exitPrice) : '--'}
                </span>
              </DetailRow>
              <DetailRow label="Quantity">
                <span className="font-mono text-sm text-text-primary">{entry.quantity}</span>
              </DetailRow>
              <DetailRow label="P&L">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    pnlNum !== null ? (pnlNum >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-text-muted',
                  )}
                >
                  {pnlNum !== null ? formatCurrency(pnlNum) : '--'}
                </span>
              </DetailRow>
              <DetailRow label="Entry Date">
                <span className="text-xs text-text-primary">{formatDate(entry.entryDate)}</span>
              </DetailRow>
              <DetailRow label="Exit Date">
                <span className="text-xs text-text-primary">
                  {entry.exitDate ? formatDate(entry.exitDate) : '--'}
                </span>
              </DetailRow>
            </CardContent>
          </Card>

          {/* R-Multiple Gauge */}
          {rNum !== null && (
            <Card>
              <CardContent className="pt-6">
                <RMultipleGauge value={rNum} />
              </CardContent>
            </Card>
          )}

          {/* Classification */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Setup Type */}
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">Setup Type</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1.5">
                    {SETUP_TYPES.map((s) => (
                      <button
                        key={s}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs transition-colors',
                          editSetup === s
                            ? 'bg-accent text-text-primary'
                            : 'bg-navy-mid text-text-muted hover:text-text-primary',
                        )}
                        onClick={() => setEditSetup(s)}
                      >
                        {formatLabel(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="rounded bg-navy-mid px-2.5 py-1 text-xs text-text-primary">
                    {formatLabel(entry.setupType)}
                  </span>
                )}
              </div>

              {/* Emotional State */}
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">Emotional State</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1.5">
                    {EMOTIONAL_STATES.map((s) => (
                      <button
                        key={s}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs transition-colors',
                          editEmotional === s
                            ? 'bg-accent text-text-primary'
                            : 'bg-navy-mid text-text-muted hover:text-text-primary',
                        )}
                        onClick={() => setEditEmotional(s)}
                      >
                        {formatLabel(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="rounded bg-navy-mid px-2.5 py-1 text-xs text-text-primary">
                    {formatLabel(entry.emotionalState)}
                  </span>
                )}
              </div>

              {/* Market Condition */}
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">Market Condition</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1.5">
                    {MARKET_CONDITIONS.map((s) => (
                      <button
                        key={s}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs transition-colors',
                          editCondition === s
                            ? 'bg-accent text-text-primary'
                            : 'bg-navy-mid text-text-muted hover:text-text-primary',
                        )}
                        onClick={() => setEditCondition(s)}
                      >
                        {formatLabel(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="rounded bg-navy-mid px-2.5 py-1 text-xs text-text-primary">
                    {formatLabel(entry.marketCondition)}
                  </span>
                )}
              </div>

              {/* Grade */}
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">Trade Grade</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditGrade(editGrade === g ? null : g)}
                      >
                        <TradeGradeBadge
                          grade={g}
                          size="lg"
                          className={cn(
                            'transition-opacity',
                            editGrade === g ? 'opacity-100' : 'opacity-40 hover:opacity-70',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  entry.grade ? (
                    <TradeGradeBadge grade={entry.grade} size="lg" />
                  ) : (
                    <span className="text-xs text-text-muted">Not graded</span>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart Snapshot */}
          {entry.chartSnapshotUrl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart Snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <img
                    src={entry.chartSnapshotUrl}
                    alt={`${entry.symbol} chart snapshot`}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={6}
                  placeholder="What went well? What could improve? Key observations..."
                  className="w-full resize-none rounded-lg border border-border bg-navy-mid px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {entry.notes || 'No notes added.'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.length > 0 ? (
                  entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-muted">No tags</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
