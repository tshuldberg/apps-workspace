'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type TickerSpeed = 'slow' | 'normal' | 'fast'

export interface TickerItem {
  symbol: string
  price: number
  change: number
  changePercent: number
}

export interface TickerTapeProps {
  /** List of symbols with price data to display. */
  items: TickerItem[]
  /** Scroll speed of the tape. */
  speed?: TickerSpeed
  /** Background color override. */
  backgroundColor?: string
  /** Text color override. */
  textColor?: string
  /** Color theme (overridden by individual color props). */
  theme?: 'dark' | 'light'
  /** Show the "Powered by MarlinTraders" watermark. */
  showWatermark?: boolean
  className?: string
}

// ── Speed config ─────────────────────────────────────────────────────────────

const SPEED_DURATIONS: Record<TickerSpeed, number> = {
  slow: 60,
  normal: 35,
  fast: 18,
}

// ── Theme defaults ───────────────────────────────────────────────────────────

const THEME_DEFAULTS = {
  dark: { bg: '#0a0a0f', text: '#f8fafc', border: '#1e293b' },
  light: { bg: '#ffffff', text: '#0f172a', border: '#e2e8f0' },
}

// ── Mock data generator for demo ─────────────────────────────────────────────

export function generateMockTickerItems(symbols: string[]): TickerItem[] {
  return symbols.map((symbol) => {
    const basePrice = 100 + Math.random() * 400
    const change = (Math.random() - 0.45) * 8
    const changePercent = (change / basePrice) * 100
    return {
      symbol,
      price: Math.round(basePrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function TickerTape({
  items,
  speed = 'normal',
  backgroundColor,
  textColor,
  theme = 'dark',
  showWatermark = true,
  className,
}: TickerTapeProps) {
  const themeDefaults = THEME_DEFAULTS[theme]
  const bg = backgroundColor ?? themeDefaults.bg
  const text = textColor ?? themeDefaults.text
  const border = themeDefaults.border
  const duration = SPEED_DURATIONS[speed]

  // Duplicate items for seamless infinite scroll
  const duplicatedItems = useMemo(() => [...items, ...items], [items])

  // Build keyframes CSS for infinite scroll animation
  const animationStyle = useMemo(
    () => ({
      animation: `marlin-ticker-scroll ${duration}s linear infinite`,
    }),
    [duration],
  )

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        backgroundColor: bg,
        borderTop: `1px solid ${border}`,
        borderBottom: `1px solid ${border}`,
      }}
    >
      {/* Inline keyframes — self-contained for embed contexts */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marlin-ticker-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `,
        }}
      />

      <div
        className="flex items-center whitespace-nowrap py-2"
        style={animationStyle}
      >
        {duplicatedItems.map((item, i) => {
          const isPositive = item.change >= 0
          const changeColor = isPositive ? '#22c55e' : '#ef4444'
          const arrow = isPositive ? '\u25B2' : '\u25BC'

          return (
            <div
              key={`${item.symbol}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 px-4"
            >
              {/* Symbol */}
              <span
                className="text-xs font-semibold"
                style={{ color: text }}
              >
                {item.symbol}
              </span>

              {/* Price */}
              <span
                className="text-xs tabular-nums"
                style={{ color: text, opacity: 0.8 }}
              >
                ${item.price.toFixed(2)}
              </span>

              {/* Change */}
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: changeColor }}
              >
                {arrow} {isPositive ? '+' : ''}{item.change.toFixed(2)} ({isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%)
              </span>

              {/* Separator dot */}
              <span
                className="text-[8px]"
                style={{ color: text, opacity: 0.2 }}
              >
                |
              </span>
            </div>
          )
        })}

        {/* Watermark at end of tape */}
        {showWatermark && (
          <a
            href="https://marlintraders.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 px-4 text-[10px] font-medium no-underline opacity-50 transition-opacity hover:opacity-80"
            style={{ color: text }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            Powered by MarlinTraders
          </a>
        )}
      </div>
    </div>
  )
}
