'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'
import type { JournalAnalysis, JournalInsight } from '@marlin/shared'

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ANALYSIS: JournalAnalysis = {
  insights: [
    {
      category: 'behavioral',
      title: 'Overtrading on Mondays',
      description: 'You placed 5+ trades on 4 Mondays this month. Your Monday win rate (38%) is significantly below your average (56%). Consider being more selective on Mondays.',
      severity: 'warning',
      dataPoints: 4,
    },
    {
      category: 'emotional',
      title: 'FOMO trades are unprofitable',
      description: 'Your 8 FOMO-flagged trades have a 25% win rate with an average loss of -$142. Avoid chasing entries — set alerts instead.',
      severity: 'critical',
      dataPoints: 8,
    },
    {
      category: 'setup',
      title: 'Breakout is your best setup',
      description: '72% win rate across 18 breakout trades with an average P&L of +$287. This is your highest-edge pattern.',
      severity: 'info',
      dataPoints: 18,
    },
    {
      category: 'emotional',
      title: 'Discipline pays off',
      description: 'Disciplined trades: 68% win rate vs overall 56%. When you follow your rules, results improve by 12 percentage points.',
      severity: 'info',
      dataPoints: 25,
    },
    {
      category: 'timing',
      title: 'First 30 minutes are risky',
      description: 'Trades entered in the first 30 minutes of the session have a 35% win rate. Consider waiting for the opening range to establish.',
      severity: 'warning',
      dataPoints: 12,
    },
    {
      category: 'risk',
      title: 'Avoid widening stops',
      description: 'On 6 occasions, you moved your stop loss further away. All 6 resulted in larger losses. Stick to your original stop.',
      severity: 'critical',
      dataPoints: 6,
    },
  ],
  bestSetups: [
    { setupType: 'breakout', winRate: 72, avgPnl: 287, count: 18 },
    { setupType: 'momentum', winRate: 64, avgPnl: 195, count: 11 },
    { setupType: 'pullback', winRate: 58, avgPnl: 120, count: 14 },
  ],
  worstSetups: [
    { setupType: 'reversal', winRate: 30, avgPnl: -165, count: 10 },
    { setupType: 'range', winRate: 40, avgPnl: -78, count: 8 },
  ],
  bestTradingDays: [
    { day: 'Wednesday', winRate: 68, avgPnl: 210, count: 15 },
    { day: 'Thursday', winRate: 62, avgPnl: 175, count: 12 },
    { day: 'Tuesday', winRate: 59, avgPnl: 130, count: 14 },
  ],
  worstTradingDays: [
    { day: 'Monday', winRate: 38, avgPnl: -95, count: 16 },
    { day: 'Friday', winRate: 45, avgPnl: -42, count: 10 },
  ],
  emotionalCorrelations: [
    { emotion: 'disciplined', winRate: 68, avgPnl: 245, count: 25 },
    { emotion: 'calm', winRate: 60, avgPnl: 158, count: 20 },
    { emotion: 'greedy', winRate: 42, avgPnl: -55, count: 7 },
    { emotion: 'fomo', winRate: 25, avgPnl: -142, count: 8 },
    { emotion: 'fearful', winRate: 33, avgPnl: -110, count: 6 },
  ],
  suggestions: [
    'Prioritize breakout setups — your edge is strongest here.',
    'Stop trading reversal setups until you refine your edge.',
    'Limit yourself to 3-4 high-quality setups per day.',
    'Set price alerts instead of chasing moves. Wait for pullbacks.',
    'Consider skipping the first 30 minutes of the trading session.',
    'Never widen your stop loss after entry — accept the original risk.',
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────────

function severityColor(severity: JournalInsight['severity']): string {
  switch (severity) {
    case 'critical': return 'border-trading-red/40 bg-trading-red/5'
    case 'warning': return 'border-yellow-400/40 bg-yellow-400/5'
    case 'info': return 'border-accent/40 bg-accent/5'
  }
}

function severityDot(severity: JournalInsight['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-trading-red'
    case 'warning': return 'bg-yellow-400'
    case 'info': return 'bg-accent'
  }
}

function severityLabel(severity: JournalInsight['severity']): string {
  switch (severity) {
    case 'critical': return 'Action Required'
    case 'warning': return 'Heads Up'
    case 'info': return 'Insight'
  }
}

function categoryIcon(category: JournalInsight['category']): string {
  switch (category) {
    case 'behavioral': return 'B'
    case 'emotional': return 'E'
    case 'setup': return 'S'
    case 'timing': return 'T'
    case 'risk': return 'R'
  }
}

type InsightFilter = 'all' | JournalInsight['category']

// ── Page Component ─────────────────────────────────────────────────────────

export default function JournalInsightsPage() {
  const router = useRouter()
  const [analysis] = useState<JournalAnalysis>(MOCK_ANALYSIS)
  const [insightFilter, setInsightFilter] = useState<InsightFilter>('all')

  const filteredInsights = useMemo(() => {
    if (insightFilter === 'all') return analysis.insights
    return analysis.insights.filter((i) => i.category === insightFilter)
  }, [analysis.insights, insightFilter])

  const categories: { value: InsightFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'emotional', label: 'Emotional' },
    { value: 'setup', label: 'Setups' },
    { value: 'timing', label: 'Timing' },
    { value: 'risk', label: 'Risk' },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text-primary">Journal Insights</h1>
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              Beta
            </span>
          </div>
          <p className="text-xs text-text-muted">
            AI-powered analysis of your trading patterns and behaviors
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/journal')}>
          Back to Journal
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Best Setup</p>
                <p className="mt-1 text-lg font-bold capitalize text-trading-green">
                  {analysis.bestSetups[0]?.setupType ?? 'N/A'}
                </p>
                <p className="text-xs text-text-muted">
                  {analysis.bestSetups[0]?.winRate.toFixed(0)}% WR | {analysis.bestSetups[0]?.count} trades
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Worst Setup</p>
                <p className="mt-1 text-lg font-bold capitalize text-trading-red">
                  {analysis.worstSetups[0]?.setupType ?? 'N/A'}
                </p>
                <p className="text-xs text-text-muted">
                  {analysis.worstSetups[0]?.winRate.toFixed(0)}% WR | {analysis.worstSetups[0]?.count} trades
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Best Day</p>
                <p className="mt-1 text-lg font-bold text-trading-green">
                  {analysis.bestTradingDays[0]?.day ?? 'N/A'}
                </p>
                <p className="text-xs text-text-muted">
                  {analysis.bestTradingDays[0]?.winRate.toFixed(0)}% WR | +${analysis.bestTradingDays[0]?.avgPnl.toFixed(0)} avg
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Best Emotion</p>
                <p className="mt-1 text-lg font-bold capitalize text-trading-green">
                  {analysis.emotionalCorrelations[0]?.emotion ?? 'N/A'}
                </p>
                <p className="text-xs text-text-muted">
                  {analysis.emotionalCorrelations[0]?.winRate.toFixed(0)}% WR | +${analysis.emotionalCorrelations[0]?.avgPnl.toFixed(0)} avg
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Insights section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">AI Insights</CardTitle>
                <div className="flex gap-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                        insightFilter === cat.value
                          ? 'bg-accent text-text-primary'
                          : 'bg-navy-mid text-text-muted hover:text-text-primary',
                      )}
                      onClick={() => setInsightFilter(cat.value)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={cn('rounded-lg border p-4', severityColor(insight.severity))}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-dark text-[10px] font-bold text-text-muted">
                        {categoryIcon(insight.category)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', severityDot(insight.severity))} />
                          <span className="text-sm font-semibold text-text-primary">{insight.title}</span>
                          <span className="text-[9px] uppercase tracking-wider text-text-muted">
                            {severityLabel(insight.severity)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{insight.description}</p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          Based on {insight.dataPoints} data point{insight.dataPoints !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Setup performance */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-trading-green">Best Setups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.bestSetups.map((setup) => (
                    <div
                      key={setup.setupType}
                      className="flex items-center justify-between rounded-md bg-trading-green/5 px-3 py-2"
                    >
                      <span className="text-xs font-medium capitalize text-text-primary">{setup.setupType}</span>
                      <div className="flex gap-4 text-[11px]">
                        <span className="font-mono tabular-nums text-trading-green">{setup.winRate.toFixed(0)}% WR</span>
                        <span className="font-mono tabular-nums text-trading-green">+${setup.avgPnl.toFixed(0)}</span>
                        <span className="text-text-muted">{setup.count} trades</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-trading-red">Worst Setups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.worstSetups.map((setup) => (
                    <div
                      key={setup.setupType}
                      className="flex items-center justify-between rounded-md bg-trading-red/5 px-3 py-2"
                    >
                      <span className="text-xs font-medium capitalize text-text-primary">{setup.setupType}</span>
                      <div className="flex gap-4 text-[11px]">
                        <span className="font-mono tabular-nums text-trading-red">{setup.winRate.toFixed(0)}% WR</span>
                        <span className="font-mono tabular-nums text-trading-red">${setup.avgPnl.toFixed(0)}</span>
                        <span className="text-text-muted">{setup.count} trades</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day of week performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {[...analysis.bestTradingDays, ...analysis.worstTradingDays]
                  .sort((a, b) => b.winRate - a.winRate)
                  .map((day) => (
                    <div
                      key={day.day}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-xs font-medium text-text-primary">{day.day}</span>
                      <div className="flex gap-3 text-[11px]">
                        <span
                          className={cn(
                            'font-mono tabular-nums',
                            day.winRate >= 50 ? 'text-trading-green' : 'text-trading-red',
                          )}
                        >
                          {day.winRate.toFixed(0)}% WR
                        </span>
                        <span
                          className={cn(
                            'font-mono tabular-nums',
                            day.avgPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                          )}
                        >
                          {day.avgPnl >= 0 ? '+' : ''}${day.avgPnl.toFixed(0)}
                        </span>
                        <span className="text-text-muted">{day.count} trades</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Emotional correlations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Emotional State vs Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.emotionalCorrelations.map((ec) => (
                  <div
                    key={ec.emotion}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="w-24 text-xs font-medium capitalize text-text-primary">{ec.emotion}</span>
                    {/* Win rate bar */}
                    <div className="flex-1">
                      <div className="h-2 w-full rounded-full bg-navy-mid">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            ec.winRate >= 50 ? 'bg-trading-green' : 'bg-trading-red',
                          )}
                          style={{ width: `${Math.min(ec.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex w-36 justify-end gap-3 text-[11px]">
                      <span
                        className={cn(
                          'font-mono tabular-nums',
                          ec.winRate >= 50 ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {ec.winRate.toFixed(0)}%
                      </span>
                      <span
                        className={cn(
                          'font-mono tabular-nums',
                          ec.avgPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {ec.avgPnl >= 0 ? '+' : ''}${ec.avgPnl.toFixed(0)}
                      </span>
                      <span className="text-text-muted">{ec.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actionable suggestions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Actionable Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {analysis.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex gap-3 text-xs text-text-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                      {idx + 1}
                    </span>
                    {suggestion}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
