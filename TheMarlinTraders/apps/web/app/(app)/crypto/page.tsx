'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import { CryptoTicker, type CryptoTickerData } from '@marlin/ui/trading/crypto-ticker'

// ── Mock Data ───────────────────────────────────────────────────────────────
// TODO: Replace with trpc.multiAsset.getCryptoList.useQuery()

function generateSparkline(trending: 'up' | 'down' | 'flat'): number[] {
  const points: number[] = []
  let price = 100
  for (let i = 0; i < 24; i++) {
    const drift = trending === 'up' ? 0.3 : trending === 'down' ? -0.3 : 0
    price += drift + (Math.random() - 0.5) * 2
    points.push(price)
  }
  return points
}

const MOCK_COINS: CryptoTickerData[] = [
  { pair: 'BTC-USD', price: 67_432.50, change24h: 1_245.30, changePercent24h: 1.88, volume24h: 28_500_000_000, high24h: 68_100, low24h: 65_900, marketCap: 1_325_000_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'ETH-USD', price: 3_521.80, change24h: -45.20, changePercent24h: -1.27, volume24h: 15_200_000_000, high24h: 3_600, low24h: 3_480, marketCap: 423_000_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'SOL-USD', price: 148.25, change24h: 8.75, changePercent24h: 6.27, volume24h: 3_800_000_000, high24h: 152, low24h: 138, marketCap: 65_000_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'BNB-USD', price: 598.40, change24h: 12.80, changePercent24h: 2.19, volume24h: 1_200_000_000, high24h: 605, low24h: 582, marketCap: 92_000_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'XRP-USD', price: 0.62, change24h: -0.01, changePercent24h: -1.59, volume24h: 1_800_000_000, high24h: 0.64, low24h: 0.61, marketCap: 34_000_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'ADA-USD', price: 0.48, change24h: 0.02, changePercent24h: 4.35, volume24h: 620_000_000, high24h: 0.49, low24h: 0.46, marketCap: 17_000_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'DOGE-USD', price: 0.165, change24h: 0.008, changePercent24h: 5.10, volume24h: 1_100_000_000, high24h: 0.17, low24h: 0.155, marketCap: 23_500_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'AVAX-USD', price: 38.90, change24h: -1.20, changePercent24h: -2.99, volume24h: 450_000_000, high24h: 40.5, low24h: 38.1, marketCap: 14_500_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'DOT-USD', price: 7.85, change24h: 0.15, changePercent24h: 1.95, volume24h: 280_000_000, high24h: 8.0, low24h: 7.6, marketCap: 10_200_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'MATIC-USD', price: 0.72, change24h: -0.03, changePercent24h: -4.00, volume24h: 350_000_000, high24h: 0.76, low24h: 0.71, marketCap: 6_700_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'LINK-USD', price: 18.45, change24h: 0.65, changePercent24h: 3.65, volume24h: 520_000_000, high24h: 18.9, low24h: 17.6, marketCap: 10_800_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'UNI-USD', price: 12.30, change24h: -0.40, changePercent24h: -3.15, volume24h: 210_000_000, high24h: 12.8, low24h: 12.1, marketCap: 7_400_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'ATOM-USD', price: 9.15, change24h: 0.25, changePercent24h: 2.81, volume24h: 180_000_000, high24h: 9.4, low24h: 8.8, marketCap: 3_500_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'LTC-USD', price: 84.60, change24h: 1.80, changePercent24h: 2.17, volume24h: 420_000_000, high24h: 86, low24h: 82, marketCap: 6_300_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'NEAR-USD', price: 7.20, change24h: 0.35, changePercent24h: 5.11, volume24h: 310_000_000, high24h: 7.4, low24h: 6.8, marketCap: 7_800_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'FIL-USD', price: 6.15, change24h: -0.20, changePercent24h: -3.15, volume24h: 150_000_000, high24h: 6.5, low24h: 6.0, marketCap: 3_200_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'APT-USD', price: 9.80, change24h: 0.45, changePercent24h: 4.81, volume24h: 200_000_000, high24h: 10.1, low24h: 9.2, marketCap: 4_300_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'ARB-USD', price: 1.22, change24h: -0.05, changePercent24h: -3.94, volume24h: 280_000_000, high24h: 1.28, low24h: 1.20, marketCap: 3_100_000_000, sparkline: generateSparkline('down'), lastUpdated: new Date().toISOString() },
  { pair: 'OP-USD', price: 3.45, change24h: 0.12, changePercent24h: 3.60, volume24h: 190_000_000, high24h: 3.55, low24h: 3.30, marketCap: 3_700_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
  { pair: 'SUI-USD', price: 1.85, change24h: 0.08, changePercent24h: 4.52, volume24h: 250_000_000, high24h: 1.90, low24h: 1.75, marketCap: 2_800_000_000, sparkline: generateSparkline('up'), lastUpdated: new Date().toISOString() },
]

interface TrendingCoin {
  symbol: string
  changePercent: number
}

const MOCK_TRENDING: TrendingCoin[] = [
  { symbol: 'SOL', changePercent: 6.27 },
  { symbol: 'NEAR', changePercent: 5.11 },
  { symbol: 'DOGE', changePercent: 5.10 },
  { symbol: 'APT', changePercent: 4.81 },
  { symbol: 'SUI', changePercent: 4.52 },
]

// ── Page Component ──────────────────────────────────────────────────────────

export default function CryptoPage() {
  const router = useRouter()

  const handleCoinClick = useCallback(
    (pair: string) => {
      const symbol = pair.replace('-', '')
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Crypto Markets</h1>
        <p className="text-xs text-text-muted">
          Real-time prices, market cap, and 24h performance for top cryptocurrencies
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Top stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* BTC Dominance */}
            <div className="rounded-lg border border-border bg-navy-dark p-4">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                BTC Dominance
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-accent">
                52.4%
              </span>
              <span className="ml-2 font-mono text-xs tabular-nums text-trading-green">
                +0.3%
              </span>
            </div>

            {/* Total Market Cap */}
            <div className="rounded-lg border border-border bg-navy-dark p-4">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                Total Market Cap
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
                $2.54T
              </span>
              <span className="ml-2 font-mono text-xs tabular-nums text-trading-green">
                +1.2%
              </span>
            </div>

            {/* 24h Volume */}
            <div className="rounded-lg border border-border bg-navy-dark p-4">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                24h Volume
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
                $98.2B
              </span>
              <span className="ml-2 font-mono text-xs tabular-nums text-trading-red">
                -5.4%
              </span>
            </div>

            {/* Fear & Greed */}
            <div className="rounded-lg border border-border bg-navy-dark p-4">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                Fear & Greed Index
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-yellow-500">
                  62
                </span>
                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500">
                  Greed
                </span>
              </div>
            </div>
          </div>

          {/* Trending coins */}
          <div className="rounded-lg border border-border bg-navy-dark p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
              Trending (24h)
            </h3>
            <div className="flex flex-wrap gap-2">
              {MOCK_TRENDING.map((coin) => (
                <button
                  key={coin.symbol}
                  type="button"
                  onClick={() => handleCoinClick(`${coin.symbol}-USD`)}
                  className="flex items-center gap-2 rounded-full border border-border bg-navy-black px-3 py-1.5 transition-colors hover:border-accent"
                >
                  <span className="font-mono text-xs font-medium text-text-primary">
                    {coin.symbol}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-trading-green">
                    +{coin.changePercent.toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main price table */}
          <CryptoTicker
            coins={MOCK_COINS}
            btcDominance={52.4}
            fearGreedIndex={62}
            fearGreedLabel="Greed"
            onCoinClick={handleCoinClick}
          />
        </div>
      </div>
    </div>
  )
}
