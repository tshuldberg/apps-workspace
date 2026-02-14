'use client'

import { ChartEmbed, type EmbedTheme, type EmbedTimeframe } from '@marlin/ui/widgets/chart-embed'

interface ChartEmbedClientProps {
  symbol: string
  timeframe: string
  indicators: string[]
  theme: string
}

export function ChartEmbedClient({ symbol, timeframe, indicators, theme }: ChartEmbedClientProps) {
  return (
    <ChartEmbed
      symbol={symbol}
      timeframe={timeframe as EmbedTimeframe}
      indicators={indicators}
      theme={theme as EmbedTheme}
      showWatermark
      className="h-full w-full"
    />
  )
}
