'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = 'iframe' | 'javascript'

export interface EmbedConfig {
  symbol: string
  timeframe: string
  indicators: string[]
  width: string
  height: string
  theme: 'dark' | 'light'
}

export interface EmbedCodeGeneratorProps {
  /** Base URL for the embed (e.g. "https://marlintraders.com"). */
  baseUrl?: string
  className?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1H', label: '1 Hour' },
  { value: '4H', label: '4 Hours' },
  { value: '1D', label: '1 Day' },
  { value: '1W', label: '1 Week' },
  { value: '1M', label: '1 Month' },
]

const AVAILABLE_INDICATORS = [
  { key: 'sma20', label: 'SMA 20' },
  { key: 'sma50', label: 'SMA 50' },
  { key: 'sma200', label: 'SMA 200' },
  { key: 'ema9', label: 'EMA 9' },
  { key: 'ema21', label: 'EMA 21' },
  { key: 'ema50', label: 'EMA 50' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'bb', label: 'Bollinger Bands' },
  { key: 'vwap', label: 'VWAP' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildEmbedUrl(baseUrl: string, config: EmbedConfig): string {
  const params = new URLSearchParams()
  params.set('symbol', config.symbol)
  params.set('timeframe', config.timeframe)
  if (config.indicators.length > 0) {
    params.set('indicators', config.indicators.join(','))
  }
  params.set('theme', config.theme)
  return `${baseUrl}/embed/chart?${params.toString()}`
}

function generateIframeCode(url: string, config: EmbedConfig): string {
  return `<iframe
  src="${url}"
  width="${config.width}"
  height="${config.height}"
  frameborder="0"
  scrolling="no"
  allowtransparency="true"
  style="border: none; border-radius: 8px; overflow: hidden;"
  title="${config.symbol} Chart — MarlinTraders"
></iframe>`
}

function generateJsSnippet(url: string, config: EmbedConfig): string {
  return `<div id="marlin-chart-widget"></div>
<script>
(function() {
  var container = document.getElementById('marlin-chart-widget');
  if (!container) return;
  var iframe = document.createElement('iframe');
  iframe.src = '${url}';
  iframe.width = '${config.width}';
  iframe.height = '${config.height}';
  iframe.frameBorder = '0';
  iframe.scrolling = 'no';
  iframe.allowTransparency = true;
  iframe.style.cssText = 'border: none; border-radius: 8px; overflow: hidden;';
  iframe.title = '${config.symbol} Chart — MarlinTraders';
  container.appendChild(iframe);
})();
</script>`
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmbedCodeGenerator({
  baseUrl = 'https://marlintraders.com',
  className,
}: EmbedCodeGeneratorProps) {
  const [config, setConfig] = useState<EmbedConfig>({
    symbol: 'AAPL',
    timeframe: '1D',
    indicators: [],
    width: '800',
    height: '500',
    theme: 'dark',
  })
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('iframe')
  const [copied, setCopied] = useState(false)

  const embedUrl = useMemo(() => buildEmbedUrl(baseUrl, config), [baseUrl, config])

  const embedCode = useMemo(() => {
    if (outputFormat === 'iframe') {
      return generateIframeCode(embedUrl, config)
    }
    return generateJsSnippet(embedUrl, config)
  }, [embedUrl, config, outputFormat])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = embedCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [embedCode])

  const toggleIndicator = useCallback((key: string) => {
    setConfig((prev) => ({
      ...prev,
      indicators: prev.indicators.includes(key)
        ? prev.indicators.filter((k) => k !== key)
        : [...prev.indicators, key],
    }))
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {/* ── Configuration form ─────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border border-border bg-navy-dark p-5">
        <h3 className="text-sm font-semibold text-text-primary">Configure Embed</h3>

        {/* Symbol */}
        <div>
          <label htmlFor="embed-symbol" className="mb-1 block text-xs text-text-muted">
            Symbol
          </label>
          <input
            id="embed-symbol"
            type="text"
            value={config.symbol}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
            }
            className="flex h-9 w-full rounded-md border border-border bg-navy-mid px-3 py-1 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            placeholder="AAPL"
          />
        </div>

        {/* Timeframe */}
        <div>
          <label htmlFor="embed-timeframe" className="mb-1 block text-xs text-text-muted">
            Timeframe
          </label>
          <select
            id="embed-timeframe"
            value={config.timeframe}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, timeframe: e.target.value }))
            }
            className="flex h-9 w-full rounded-md border border-border bg-navy-mid px-3 py-1 text-sm text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf.value} value={tf.value}>
                {tf.label}
              </option>
            ))}
          </select>
        </div>

        {/* Indicators */}
        <div>
          <span className="mb-1.5 block text-xs text-text-muted">Indicators</span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_INDICATORS.map((ind) => {
              const active = config.indicators.includes(ind.key)
              return (
                <button
                  key={ind.key}
                  type="button"
                  onClick={() => toggleIndicator(ind.key)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-accent text-text-primary'
                      : 'bg-navy-mid text-text-muted hover:bg-navy-light hover:text-text-secondary',
                  )}
                >
                  {ind.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Width & Height */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="embed-width" className="mb-1 block text-xs text-text-muted">
              Width (px or %)
            </label>
            <input
              id="embed-width"
              type="text"
              value={config.width}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, width: e.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-border bg-navy-mid px-3 py-1 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              placeholder="800"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="embed-height" className="mb-1 block text-xs text-text-muted">
              Height (px)
            </label>
            <input
              id="embed-height"
              type="text"
              value={config.height}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, height: e.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-border bg-navy-mid px-3 py-1 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              placeholder="500"
            />
          </div>
        </div>

        {/* Theme */}
        <div>
          <span className="mb-1.5 block text-xs text-text-muted">Theme</span>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, theme: t }))}
                className={cn(
                  'rounded-md px-4 py-2 text-xs font-medium capitalize transition-colors',
                  config.theme === t
                    ? 'bg-accent text-text-primary'
                    : 'bg-navy-mid text-text-muted hover:bg-navy-light hover:text-text-secondary',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live preview ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Preview</h3>
        <div
          className="overflow-hidden rounded-lg border border-border"
          style={{
            width: '100%',
            maxWidth: '100%',
          }}
        >
          <iframe
            src={embedUrl}
            width="100%"
            height={config.height}
            frameBorder="0"
            scrolling="no"
            title={`${config.symbol} Chart Preview`}
            className="block"
            style={{ border: 'none' }}
          />
        </div>
      </div>

      {/* ── Code output ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Embed Code</h3>
          <div className="flex gap-1.5">
            {(['iframe', 'javascript'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setOutputFormat(fmt)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  outputFormat === fmt
                    ? 'bg-accent text-text-primary'
                    : 'bg-navy-mid text-text-muted hover:bg-navy-light hover:text-text-secondary',
                )}
              >
                {fmt === 'iframe' ? 'iframe HTML' : 'JavaScript'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-border bg-navy-mid p-4 text-xs leading-relaxed text-text-secondary">
            <code>{embedCode}</code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'absolute right-3 top-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              copied
                ? 'bg-trading-green/20 text-trading-green'
                : 'bg-navy-dark text-text-muted hover:bg-navy-light hover:text-text-primary',
            )}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
