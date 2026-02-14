'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LeaderboardTable,
  type LeaderboardTimeframe,
  type LeaderboardAssetClass,
  type LeaderboardStyle,
  type LeaderboardMetric,
  type LeaderboardEntry,
} from '@marlin/ui/trading/leaderboard-table'

// ── Mock data — will be replaced with tRPC query ─────────────────────────────
// trpc.leaderboards.getRankings.useQuery({
//   timeframe, assetClass, style, metric, limit, cursor,
// })

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: 'user_abc',
    displayName: 'MomentumKing',
    avatarUrl: null,
    metricValue: 42500.75,
    winRate: 64.2,
    sharpeRatio: 2.15,
    totalPnl: 42500.75,
    profitFactor: 2.34,
    totalTrades: 156,
  },
  {
    rank: 2,
    userId: 'user_def',
    displayName: 'SwingMaster',
    avatarUrl: null,
    metricValue: 31200.50,
    winRate: 58.8,
    sharpeRatio: 1.87,
    totalPnl: 31200.50,
    profitFactor: 1.92,
    totalTrades: 203,
  },
  {
    rank: 3,
    userId: 'user_ghi',
    displayName: 'AlphaTrader',
    avatarUrl: null,
    metricValue: 28900.00,
    winRate: 72.1,
    sharpeRatio: 2.45,
    totalPnl: 28900.00,
    profitFactor: 3.10,
    totalTrades: 89,
  },
  {
    rank: 4,
    userId: 'user_jkl',
    displayName: 'ChartWhisperer',
    avatarUrl: null,
    metricValue: 22400.30,
    winRate: 55.4,
    sharpeRatio: 1.52,
    totalPnl: 22400.30,
    profitFactor: 1.65,
    totalTrades: 312,
  },
  {
    rank: 5,
    userId: 'user_mno',
    displayName: 'PatientCapital',
    avatarUrl: null,
    metricValue: 18750.00,
    winRate: 61.3,
    sharpeRatio: 1.98,
    totalPnl: 18750.00,
    profitFactor: 2.12,
    totalTrades: 124,
  },
  {
    rank: 6,
    userId: 'user_pqr',
    displayName: 'BreakoutHunter',
    avatarUrl: null,
    metricValue: 15200.25,
    winRate: 48.7,
    sharpeRatio: 1.23,
    totalPnl: 15200.25,
    profitFactor: 1.41,
    totalTrades: 267,
  },
  {
    rank: 7,
    userId: 'user_stu',
    displayName: 'RiskManager',
    avatarUrl: null,
    metricValue: 12800.00,
    winRate: 67.5,
    sharpeRatio: 2.67,
    totalPnl: 12800.00,
    profitFactor: 2.88,
    totalTrades: 78,
  },
  {
    rank: 8,
    userId: 'user_vwx',
    displayName: 'TrendFollower',
    avatarUrl: null,
    metricValue: 9500.80,
    winRate: 42.3,
    sharpeRatio: 0.95,
    totalPnl: 9500.80,
    profitFactor: 1.18,
    totalTrades: 445,
  },
  {
    rank: 9,
    userId: 'user_yza',
    displayName: 'ScalpPro',
    avatarUrl: null,
    metricValue: 8200.00,
    winRate: 71.8,
    sharpeRatio: 1.45,
    totalPnl: 8200.00,
    profitFactor: 1.95,
    totalTrades: 892,
  },
  {
    rank: 10,
    userId: 'user_bcd',
    displayName: 'ValueSeeker',
    avatarUrl: null,
    metricValue: 6100.50,
    winRate: 53.2,
    sharpeRatio: 1.12,
    totalPnl: 6100.50,
    profitFactor: 1.34,
    totalTrades: 67,
  },
]

// ── Page Component ───────────────────────────────────────────────────────────

export default function LeaderboardsPage() {
  const router = useRouter()

  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('30d')
  const [assetClass, setAssetClass] = useState<LeaderboardAssetClass>('all')
  const [style, setStyle] = useState<LeaderboardStyle>('all')
  const [metric, setMetric] = useState<LeaderboardMetric>('totalPnl')

  // Will be replaced with tRPC infinite query
  const handleLoadMore = useCallback(() => {
    // noop -- mock data is static
  }, [])

  const handleUserClick = useCallback(
    (userId: string) => {
      router.push(`/profile/${userId}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Leaderboards</h1>
        <p className="text-xs text-text-muted">
          Top performing traders ranked by verified metrics
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <LeaderboardTable
            entries={MOCK_LEADERBOARD}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            assetClass={assetClass}
            onAssetClassChange={setAssetClass}
            style={style}
            onStyleChange={setStyle}
            metric={metric}
            onMetricChange={setMetric}
            hasMore={false}
            onLoadMore={handleLoadMore}
            isLoading={false}
            onUserClick={handleUserClick}
          />
        </div>
      </div>
    </div>
  )
}
