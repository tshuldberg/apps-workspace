import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

// ── Types ────────────────────────────────────────────────────────────────────

interface OgParams {
  title: string
  symbol: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  author: string
}

// ── Sentiment styling ────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  bullish: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: 'BULLISH' },
  bearish: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'BEARISH' },
  neutral: { bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8', label: 'NEUTRAL' },
} as const

/**
 * Dynamic OG image generation for trading ideas.
 *
 * Usage: /api/og?title=...&symbol=AAPL&sentiment=bullish&author=TraderMike
 *
 * Returns a 1200x630 PNG suitable for og:image and twitter:image.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const params: OgParams = {
    title: searchParams.get('title') ?? 'Trading Idea',
    symbol: (searchParams.get('symbol') ?? 'SPY').toUpperCase(),
    sentiment: (searchParams.get('sentiment') as OgParams['sentiment']) ?? 'neutral',
    author: searchParams.get('author') ?? 'MarlinTraders',
  }

  const sentimentStyle = SENTIMENT_CONFIG[params.sentiment] ?? SENTIMENT_CONFIG.neutral

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          backgroundColor: '#0a0a0f',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top section: Logo + Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              MarlinTraders
            </span>
          </div>

          {/* Symbol badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              padding: '8px 20px',
            }}
          >
            <span style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>
              {params.symbol}
            </span>
          </div>
        </div>

        {/* Middle section: Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: '42px',
              fontWeight: 700,
              color: '#f8fafc',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              maxWidth: '900px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {params.title}
          </div>

          {/* Sentiment badge */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: sentimentStyle.bg,
                color: sentimentStyle.text,
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              {sentimentStyle.label}
            </div>
          </div>
        </div>

        {/* Bottom section: Author + branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Author avatar circle */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
                color: '#3b82f6',
              }}
            >
              {params.author.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '18px', color: '#94a3b8' }}>
              {params.author}
            </span>
          </div>

          <span style={{ fontSize: '14px', color: '#64748b' }}>
            marlintraders.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
