import type { Metadata } from 'next'
import { ChartEmbedClient } from './client'

export const metadata: Metadata = {
  title: 'Chart Embed — MarlinTraders',
  description: 'Embeddable trading chart powered by MarlinTraders.',
  robots: 'noindex, nofollow',
}

/**
 * Embed page for charts. Renders outside the (app) layout group
 * so there is no sidebar or navigation — just a bare chart.
 *
 * Query params:
 *   ?symbol=AAPL&timeframe=1D&indicators=sma20,ema50&theme=dark
 *
 * Headers are set via next.config.ts to allow iframe embedding.
 */
export default async function ChartEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const symbol = (typeof params.symbol === 'string' ? params.symbol : 'SPY').toUpperCase()
  const timeframe = typeof params.timeframe === 'string' ? params.timeframe : '1D'
  const indicatorsRaw = typeof params.indicators === 'string' ? params.indicators : ''
  const indicators = indicatorsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const theme = params.theme === 'light' ? 'light' : 'dark'

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0f' : '#ffffff',
      }}
    >
      <ChartEmbedClient
        symbol={symbol}
        timeframe={timeframe}
        indicators={indicators}
        theme={theme}
      />
    </div>
  )
}
