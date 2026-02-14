'use client'

import type { IDockviewPanelProps } from 'dockview-react'

const PLACEHOLDER_NEWS = [
  { id: '1', time: '2 min ago', title: 'Fed signals potential rate hold through Q2', source: 'Reuters' },
  { id: '2', time: '15 min ago', title: 'AAPL beats earnings estimates, guides higher', source: 'Bloomberg' },
  { id: '3', time: '32 min ago', title: 'Oil rises on supply concerns', source: 'CNBC' },
  { id: '4', time: '1h ago', title: 'NVDA announces next-gen GPU architecture', source: 'TechCrunch' },
  { id: '5', time: '2h ago', title: 'Treasury yields hold steady ahead of CPI data', source: 'WSJ' },
]

export function NewsFeedPanel(_props: IDockviewPanelProps) {
  return (
    <div className="flex h-full flex-col bg-navy-dark">
      <div className="flex items-center border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-text-primary">Market News</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {PLACEHOLDER_NEWS.map((item) => (
          <div
            key={item.id}
            className="cursor-pointer border-b border-border/50 px-3 py-2 hover:bg-navy-light"
          >
            <div className="text-xs text-text-primary">{item.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
              <span>{item.source}</span>
              <span>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
