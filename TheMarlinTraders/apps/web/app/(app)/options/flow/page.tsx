'use client'

import { useState, useEffect, useCallback } from 'react'
import { OptionsFlowTable } from '@marlin/ui/trading/options-flow-table'
import { PutCallChart } from '@marlin/ui/trading/put-call-chart'
import type { FlowEntry, FlowFilter, FlowSummary, PutCallRatio } from '@marlin/shared'
import type { PutCallDataPoint } from '@marlin/ui/trading/put-call-chart'

function formatPremium(premium: number): string {
  if (premium >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (premium >= 1_000) return `$${(premium / 1_000).toFixed(1)}K`
  return `$${premium.toFixed(0)}`
}

export default function OptionsFlowPage() {
  const [flowEntries, setFlowEntries] = useState<FlowEntry[]>([])
  const [flowSummary, setFlowSummary] = useState<FlowSummary | null>(null)
  const [putCallData, setPutCallData] = useState<PutCallDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Fetch flow data
  const fetchFlow = useCallback(
    async (filter?: FlowFilter) => {
      try {
        const params: Record<string, string> = {}
        if (filter?.symbol) params.symbol = filter.symbol
        if (filter?.minPremium) params.minPremium = filter.minPremium.toString()
        if (filter?.flowType) params.flowType = filter.flowType
        if (filter?.sentiment) params.sentiment = filter.sentiment

        const input = { '0': { json: params } }
        const res = await fetch(
          `${apiUrl}/trpc/optionsFlow.getFlow?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        const data = json[0]?.result?.data?.json ?? { entries: [], total: 0 }
        setFlowEntries(data.entries ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [apiUrl],
  )

  // Fetch flow summary
  const fetchSummary = useCallback(async () => {
    try {
      const input = { '0': { json: {} } }
      const res = await fetch(
        `${apiUrl}/trpc/optionsFlow.getFlowSummary?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      )
      if (!res.ok) return
      const json = await res.json()
      setFlowSummary(json[0]?.result?.data?.json ?? null)
    } catch {
      // Non-critical
    }
  }, [apiUrl])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchFlow(), fetchSummary()]).finally(() => setLoading(false))
  }, [fetchFlow, fetchSummary])

  const handleFilterChange = useCallback(
    (filter: FlowFilter) => {
      fetchFlow(filter)
    },
    [fetchFlow],
  )

  const handleEntryClick = useCallback((entry: FlowEntry) => {
    // Navigate to options chain for the symbol
    window.location.href = `/options/${entry.symbol.toLowerCase()}`
  }, [])

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border bg-navy-dark px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text-primary">Options Flow</h1>
          <span className="text-[10px] text-text-muted">Unusual Options Activity</span>
        </div>
        {loading && (
          <span className="text-[10px] text-accent">Loading...</span>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-trading-red/5 px-4 py-2">
          <span className="text-xs text-trading-red">{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); fetchFlow() }}
            className="rounded bg-accent px-2 py-0.5 text-[10px] text-text-primary hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Flow table — takes 60-70% */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <OptionsFlowTable
            entries={flowEntries}
            onEntryClick={handleEntryClick}
            onFilterChange={handleFilterChange}
            className="h-full"
          />
        </div>

        {/* Sidebar */}
        <div className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-navy-dark">
          {/* Flow Summary */}
          <div className="border-b border-border p-3">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Flow Summary
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[9px] uppercase text-text-muted">Total</div>
                <div className="font-mono text-xs font-bold tabular-nums text-text-primary">
                  {formatPremium(flowSummary?.totalPremium ?? 0)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] uppercase text-text-muted">Calls</div>
                <div className="font-mono text-xs font-bold tabular-nums text-trading-green">
                  {formatPremium(flowSummary?.callPremium ?? 0)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] uppercase text-text-muted">Puts</div>
                <div className="font-mono text-xs font-bold tabular-nums text-trading-red">
                  {formatPremium(flowSummary?.putPremium ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Top Bullish */}
          <div className="border-b border-border p-3">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-trading-green">
              Top 5 Bullish
            </h2>
            <div className="flex flex-col gap-1">
              {(flowSummary?.topBullish ?? []).map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleEntryClick(entry)}
                  className="flex items-center justify-between rounded px-2 py-1 text-left transition-colors hover:bg-navy-light"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">{i + 1}.</span>
                    <span className="font-mono text-xs font-semibold text-text-primary">{entry.symbol}</span>
                    <span className="font-mono text-[10px] tabular-nums text-text-muted">
                      ${entry.strike} {entry.type === 'call' ? 'C' : 'P'}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-trading-green">
                    {formatPremium(entry.premium)}
                  </span>
                </button>
              ))}
              {(flowSummary?.topBullish ?? []).length === 0 && (
                <div className="py-2 text-center text-[10px] text-text-muted">No data</div>
              )}
            </div>
          </div>

          {/* Top Bearish */}
          <div className="border-b border-border p-3">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-trading-red">
              Top 5 Bearish
            </h2>
            <div className="flex flex-col gap-1">
              {(flowSummary?.topBearish ?? []).map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleEntryClick(entry)}
                  className="flex items-center justify-between rounded px-2 py-1 text-left transition-colors hover:bg-navy-light"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">{i + 1}.</span>
                    <span className="font-mono text-xs font-semibold text-text-primary">{entry.symbol}</span>
                    <span className="font-mono text-[10px] tabular-nums text-text-muted">
                      ${entry.strike} {entry.type === 'call' ? 'C' : 'P'}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-trading-red">
                    {formatPremium(entry.premium)}
                  </span>
                </button>
              ))}
              {(flowSummary?.topBearish ?? []).length === 0 && (
                <div className="py-2 text-center text-[10px] text-text-muted">No data</div>
              )}
            </div>
          </div>

          {/* Put/Call Ratio Chart */}
          <div className="flex-1">
            <PutCallChart
              equityData={putCallData}
              currentRatio={
                flowSummary && flowSummary.callPremium > 0
                  ? flowSummary.putPremium / flowSummary.callPremium
                  : 0
              }
              className="h-full min-h-[200px]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
