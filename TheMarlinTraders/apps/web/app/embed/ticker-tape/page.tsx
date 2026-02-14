import type { Metadata } from 'next'
import { TickerTapeClient } from './client'

export const metadata: Metadata = {
  title: 'Ticker Tape — MarlinTraders',
  description: 'Embeddable scrolling ticker tape powered by MarlinTraders.',
  robots: 'noindex, nofollow',
}

/**
 * Embed page for the ticker tape widget. Renders outside the (app) layout group
 * so there is no sidebar or navigation — just the scrolling tape.
 *
 * Query params:
 *   ?symbols=AAPL,MSFT,GOOGL,AMZN&speed=normal&theme=dark
 *   Optional: ?bg=#0a0a0f&textColor=#f8fafc
 */
export default async function TickerTapeEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const symbolsRaw = typeof params.symbols === 'string' ? params.symbols : 'AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA'
  const symbols = symbolsRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const speed = typeof params.speed === 'string' ? params.speed : 'normal'
  const theme = params.theme === 'light' ? 'light' : 'dark'
  const bg = typeof params.bg === 'string' ? params.bg : undefined
  const textColor = typeof params.textColor === 'string' ? params.textColor : undefined

  return (
    <div
      className="flex h-screen w-screen items-center overflow-hidden"
      style={{
        backgroundColor: theme === 'dark' ? '#0a0a0f' : '#ffffff',
      }}
    >
      <TickerTapeClient
        symbols={symbols}
        speed={speed}
        theme={theme}
        bg={bg}
        textColor={textColor}
      />
    </div>
  )
}
