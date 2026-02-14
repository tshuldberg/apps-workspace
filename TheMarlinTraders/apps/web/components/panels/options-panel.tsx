'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { OptionsHeader } from '@marlin/ui/trading/options-header'
import { ExpirationTabs } from '@marlin/ui/trading/expiration-tabs'
import { OptionsChain } from '@marlin/ui/trading/options-chain'
import { useLinkingStore, type LinkColor, LINK_COLORS } from '@marlin/data/stores/linking-store'
import type { OptionsChainData, Expiration, IVData } from '@marlin/shared'

const LINK_COLOR_OPTIONS: (LinkColor | null)[] = [null, 'red', 'green', 'blue', 'yellow']

export function OptionsPanel({ api, params }: IDockviewPanelProps<{ symbol?: string }>) {
  const panelId = api.id
  const initialSymbol = (params.symbol as string) ?? 'AAPL'

  const [localSymbol] = useState(initialSymbol)

  const linkedSymbol = useLinkingStore((s) => s.getLinkedSymbol(panelId))
  const linkPanel = useLinkingStore((s) => s.linkPanel)
  const panelLinks = useLinkingStore((s) => s.panelLinks)
  const currentLinkColor = panelLinks[panelId] ?? null

  const displaySymbol = linkedSymbol ?? localSymbol

  const [chainData, setChainData] = useState<OptionsChainData | null>(null)
  const [expirations, setExpirations] = useState<Expiration[]>([])
  const [ivData, setIVData] = useState<IVData | null>(null)
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Update panel title when symbol changes
  useEffect(() => {
    api.setTitle(`Options: ${displaySymbol}`)
  }, [api, displaySymbol])

  // Fetch expirations when symbol changes
  useEffect(() => {
    async function fetchExpirations() {
      try {
        const input = { '0': { json: { symbol: displaySymbol } } }
        const res = await fetch(
          `${apiUrl}/trpc/options.getExpirations?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) return
        const json = await res.json()
        const data: Expiration[] = json[0]?.result?.data?.json ?? []
        setExpirations(data)
        if (data.length > 0) {
          setSelectedExpiration(data[0]!.date)
        }
      } catch {
        // Fail silently in panel context
      }
    }
    fetchExpirations()
  }, [displaySymbol, apiUrl])

  // Fetch IV data
  useEffect(() => {
    async function fetchIV() {
      try {
        const input = { '0': { json: { symbol: displaySymbol } } }
        const res = await fetch(
          `${apiUrl}/trpc/options.getIVData?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) return
        const json = await res.json()
        setIVData(json[0]?.result?.data?.json ?? null)
      } catch {
        // supplementary
      }
    }
    fetchIV()
  }, [displaySymbol, apiUrl])

  // Fetch chain
  const fetchChain = useCallback(async () => {
    if (!selectedExpiration) return
    setLoading(true)
    try {
      const input = {
        '0': { json: { symbol: displaySymbol, expiration: selectedExpiration } },
      }
      const res = await fetch(
        `${apiUrl}/trpc/options.getChain?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      )
      if (!res.ok) return
      const json = await res.json()
      setChainData(json[0]?.result?.data?.json ?? null)
    } catch {
      // Fail silently
    } finally {
      setLoading(false)
    }
  }, [displaySymbol, selectedExpiration, apiUrl])

  useEffect(() => {
    fetchChain()
  }, [fetchChain])

  // Near-the-money filter (default for panel)
  const filteredStrikes = chainData?.strikes.filter((strike) => {
    const price = chainData.underlyingPrice
    const range = price * 0.1
    return strike.price >= price - range && strike.price <= price + range
  }) ?? []

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Toolbar with link selector */}
      <div className="flex items-center justify-between border-b border-border bg-navy-dark px-2 py-1">
        <span className="font-mono text-xs font-semibold text-text-primary">
          {displaySymbol} Options
        </span>
        <div className="flex items-center gap-1">
          {LINK_COLOR_OPTIONS.map((color) => (
            <button
              key={color ?? 'none'}
              onClick={() => linkPanel(panelId, color)}
              title={color ? `Link to ${color} group` : 'Unlink'}
              className={`h-4 w-4 rounded-full border transition-all ${
                currentLinkColor === color
                  ? 'scale-110 border-text-primary'
                  : 'border-border hover:border-text-muted'
              }`}
              style={{
                backgroundColor: color ? LINK_COLORS[color] : '#1a1a2e',
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <OptionsHeader
        symbol={displaySymbol}
        price={chainData?.underlyingPrice ?? 0}
        ivData={ivData}
      />

      {/* Expiration tabs */}
      <ExpirationTabs
        expirations={expirations}
        selected={selectedExpiration}
        onSelect={setSelectedExpiration}
      />

      {/* Chain */}
      <div className="flex-1 overflow-hidden">
        {loading && !chainData ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        ) : chainData ? (
          <OptionsChain
            strikes={filteredStrikes}
            underlyingPrice={chainData.underlyingPrice}
            className="h-full"
          />
        ) : null}
      </div>
    </div>
  )
}
