'use client'

import { useCallback } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { WatchlistPanel, type WatchlistRow } from '@marlin/ui/trading/watchlist-panel'
import { useLinkingStore } from '@marlin/data/stores/linking-store'

// Demo data — in production this comes from the watchlist tRPC query
const DEMO_ROWS: WatchlistRow[] = [
  { id: '1', symbolId: 1, symbol: 'AAPL', lastPrice: 189.84, changePercent: 1.23, volume: 54_200_000 },
  { id: '2', symbolId: 2, symbol: 'MSFT', lastPrice: 420.55, changePercent: -0.34, volume: 22_100_000 },
  { id: '3', symbolId: 3, symbol: 'GOOGL', lastPrice: 175.98, changePercent: 0.87, volume: 18_300_000 },
  { id: '4', symbolId: 4, symbol: 'AMZN', lastPrice: 196.12, changePercent: 2.15, volume: 41_500_000 },
  { id: '5', symbolId: 5, symbol: 'TSLA', lastPrice: 248.42, changePercent: -1.56, volume: 95_600_000 },
  { id: '6', symbolId: 6, symbol: 'NVDA', lastPrice: 875.28, changePercent: 3.42, volume: 38_900_000 },
  { id: '7', symbolId: 7, symbol: 'META', lastPrice: 502.30, changePercent: 0.98, volume: 15_700_000 },
  { id: '8', symbolId: 8, symbol: 'JPM', lastPrice: 198.45, changePercent: -0.21, volume: 8_200_000 },
]

export function WatchlistPanelWrapper({ api }: IDockviewPanelProps) {
  const panelId = api.id
  const panelLinks = useLinkingStore((s) => s.panelLinks)
  const setGroupSymbol = useLinkingStore((s) => s.setGroupSymbol)
  const linkColor = panelLinks[panelId] ?? null

  const handleRowClick = useCallback(
    (symbol: string) => {
      // If this watchlist is linked to a color group, update the group symbol
      if (linkColor) {
        setGroupSymbol(linkColor, symbol)
      }
    },
    [linkColor, setGroupSymbol],
  )

  return (
    <div className="flex h-full flex-col bg-navy-dark">
      <WatchlistPanel rows={DEMO_ROWS} onRowClick={handleRowClick} className="h-full" />
    </div>
  )
}
