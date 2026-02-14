'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'

export interface ExportableData {
  metrics?: Record<string, string | number>
  equityCurve?: Array<{ date: string; cumulativePnl: number; drawdown: number }>
  timeOfDay?: Array<{ hour: number; avgPnl: number; winRate: number; count: number }>
  setupBreakdown?: Array<{ setupType: string; winRate: number; avgPnl: number; count: number; totalPnl: number }>
  holdingTime?: Array<{ holdingTimeHours: number; pnl: number; symbol: string; date: string }>
}

export interface ExportButtonProps {
  data: ExportableData
  filename?: string
  className?: string
}

function toCsvString(rows: Record<string, string | number>[], columns?: string[]): string {
  if (rows.length === 0) return ''
  const keys = columns ?? Object.keys(rows[0])
  const header = keys.join(',')
  const body = rows
    .map((row) =>
      keys
        .map((k) => {
          const val = row[k]
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val ?? ''
        })
        .join(','),
    )
    .join('\n')
  return `${header}\n${body}`
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildCsv(data: ExportableData): string {
  const sections: string[] = []

  if (data.metrics) {
    sections.push('=== Performance Metrics ===')
    const metricsRows = Object.entries(data.metrics).map(([key, value]) => ({
      Metric: key,
      Value: String(value),
    }))
    sections.push(toCsvString(metricsRows))
  }

  if (data.equityCurve && data.equityCurve.length > 0) {
    sections.push('\n=== Equity Curve ===')
    const rows = data.equityCurve.map((d) => ({
      Date: d.date,
      'Cumulative P&L': d.cumulativePnl,
      'Drawdown %': d.drawdown,
    }))
    sections.push(toCsvString(rows as unknown as Record<string, string | number>[]))
  }

  if (data.timeOfDay && data.timeOfDay.length > 0) {
    sections.push('\n=== Time of Day ===')
    const rows = data.timeOfDay
      .filter((d) => d.count > 0)
      .map((d) => ({
        Hour: d.hour,
        'Avg P&L': d.avgPnl,
        'Win Rate': `${d.winRate}%`,
        Trades: d.count,
      }))
    sections.push(toCsvString(rows as unknown as Record<string, string | number>[]))
  }

  if (data.setupBreakdown && data.setupBreakdown.length > 0) {
    sections.push('\n=== Setup Breakdown ===')
    const rows = data.setupBreakdown.map((d) => ({
      Setup: d.setupType,
      Trades: d.count,
      'Win Rate': `${d.winRate}%`,
      'Avg P&L': d.avgPnl,
      'Total P&L': d.totalPnl,
    }))
    sections.push(toCsvString(rows as unknown as Record<string, string | number>[]))
  }

  if (data.holdingTime && data.holdingTime.length > 0) {
    sections.push('\n=== Holding Time ===')
    const rows = data.holdingTime.map((d) => ({
      Symbol: d.symbol,
      Date: d.date,
      'Holding Time (hrs)': d.holdingTimeHours,
      'P&L': d.pnl,
    }))
    sections.push(toCsvString(rows as unknown as Record<string, string | number>[]))
  }

  return sections.join('\n')
}

export function ExportButton({ data, filename = 'performance-report', className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleCsvExport() {
    const csv = buildCsv(data)
    const dateSuffix = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `${filename}-${dateSuffix}.csv`, 'text/csv;charset=utf-8;')
    setIsOpen(false)
  }

  function handlePdfExport() {
    setIsOpen(false)
    // Use the browser's print dialog with @media print styles
    window.print()
  }

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border bg-navy-dark px-3 py-1.5',
          'text-xs font-medium text-text-muted transition-colors',
          'hover:border-text-muted/30 hover:text-text-primary',
        )}
        onClick={() => setIsOpen((o) => !o)}
      >
        {/* Download icon */}
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
          />
        </svg>
        Export
        <svg
          className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-border bg-navy-dark shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
            onClick={handleCsvExport}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
            onClick={handlePdfExport}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
            </svg>
            Print / PDF
          </button>
        </div>
      )}
    </div>
  )
}
