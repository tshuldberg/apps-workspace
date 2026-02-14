'use client'

import {
  TickerTape,
  generateMockTickerItems,
  type TickerSpeed,
} from '@marlin/ui/widgets/ticker-tape'

interface TickerTapeClientProps {
  symbols: string[]
  speed: string
  theme: string
  bg?: string
  textColor?: string
}

const VALID_SPEEDS: TickerSpeed[] = ['slow', 'normal', 'fast']

export function TickerTapeClient({ symbols, speed, theme, bg, textColor }: TickerTapeClientProps) {
  const validSpeed: TickerSpeed = VALID_SPEEDS.includes(speed as TickerSpeed)
    ? (speed as TickerSpeed)
    : 'normal'

  // In production, this would fetch live data from the market-data service.
  // For now, generate deterministic mock data based on symbols.
  const items = generateMockTickerItems(symbols)

  return (
    <TickerTape
      items={items}
      speed={validSpeed}
      theme={theme === 'light' ? 'light' : 'dark'}
      backgroundColor={bg}
      textColor={textColor}
      showWatermark
      className="w-full"
    />
  )
}
