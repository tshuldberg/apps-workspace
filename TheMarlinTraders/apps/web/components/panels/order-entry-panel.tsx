'use client'

import { useCallback } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { OrderEntry, type OrderEntryValues } from '@marlin/ui/trading/order-entry'
import { useLinkingStore } from '@marlin/data/stores/linking-store'

export function OrderEntryPanel({ api }: IDockviewPanelProps) {
  const panelId = api.id
  const linkedSymbol = useLinkingStore((s) => s.getLinkedSymbol(panelId))

  const handleSubmit = useCallback((order: OrderEntryValues) => {
    // Paper trading submission — will be wired to paper trading tRPC router
    console.log('[OrderEntryPanel] Paper order submitted:', order)
  }, [])

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-navy-dark p-2">
      <OrderEntry
        symbol={linkedSymbol ?? undefined}
        onSubmit={handleSubmit}
        className="w-full max-w-sm"
      />
    </div>
  )
}
