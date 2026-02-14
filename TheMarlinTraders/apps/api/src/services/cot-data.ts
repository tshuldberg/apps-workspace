/**
 * COT (Commitment of Traders) Data Service
 * Sprints 37-38: Futures + Auto Pattern Recognition
 *
 * Fetches and parses CFTC COT reports for futures analysis.
 * COT reports are released every Friday at 3:30pm ET, covering data as of Tuesday.
 */

import { z } from 'zod'
import type { COTData } from '@marlin/shared'
import { calculateCOTIndex } from '@marlin/shared'

// ── CFTC Data Source ────────────────────────────────────────────────────────

/**
 * CFTC Commitments of Traders JSON endpoint.
 * Uses the Socrata Open Data API on the CFTC site.
 */
const CFTC_API_BASE = 'https://publicreporting.cftc.gov/resource/dv4d-7e6b.json'

// ── CFTC Symbol Mapping ─────────────────────────────────────────────────────
// Maps our futures root symbols to CFTC commodity codes

const CFTC_SYMBOL_MAP: Record<string, { cftcCode: string; name: string }> = {
  ES: { cftcCode: '13874A', name: 'E-MINI S&P 500' },
  NQ: { cftcCode: '20974A', name: 'E-MINI NASDAQ-100' },
  YM: { cftcCode: '124606', name: 'MINI-SIZED DOW' },
  RTY: { cftcCode: '239742', name: 'E-MINI RUSSELL 2000' },
  CL: { cftcCode: '067651', name: 'CRUDE OIL, LIGHT SWEET' },
  GC: { cftcCode: '088691', name: 'GOLD' },
  SI: { cftcCode: '084691', name: 'SILVER' },
  ZB: { cftcCode: '020601', name: 'U.S. TREASURY BONDS' },
  ZN: { cftcCode: '043602', name: '10-YEAR U.S. TREASURY NOTES' },
  '6E': { cftcCode: '099741', name: 'EURO FX' },
  '6J': { cftcCode: '097741', name: 'JAPANESE YEN' },
}

// ── Response Schema ─────────────────────────────────────────────────────────

const CFTCRowSchema = z.object({
  report_date_as_yyyy_mm_dd: z.string(),
  cftc_contract_market_code: z.string(),
  comm_positions_long_all: z.string().optional(),
  comm_positions_short_all: z.string().optional(),
  noncomm_positions_long_all: z.string().optional(),
  noncomm_positions_short_all: z.string().optional(),
  nonrept_positions_long_all: z.string().optional(),
  nonrept_positions_short_all: z.string().optional(),
})

type CFTCRow = z.infer<typeof CFTCRowSchema>

// ── Service Functions ───────────────────────────────────────────────────────

function parseCFTCRow(row: CFTCRow, symbol: string): COTData {
  return {
    symbol,
    reportDate: row.report_date_as_yyyy_mm_dd,
    commercialLong: parseInt(row.comm_positions_long_all ?? '0', 10),
    commercialShort: parseInt(row.comm_positions_short_all ?? '0', 10),
    nonCommercialLong: parseInt(row.noncomm_positions_long_all ?? '0', 10),
    nonCommercialShort: parseInt(row.noncomm_positions_short_all ?? '0', 10),
    nonReportableLong: parseInt(row.nonrept_positions_long_all ?? '0', 10),
    nonReportableShort: parseInt(row.nonrept_positions_short_all ?? '0', 10),
  }
}

/**
 * Fetch the latest COT report for a given futures symbol.
 */
export async function fetchCOTReport(symbol: string): Promise<COTData | null> {
  const mapping = CFTC_SYMBOL_MAP[symbol.toUpperCase()]
  if (!mapping) return null

  const url = `${CFTC_API_BASE}?$where=cftc_contract_market_code='${mapping.cftcCode}'&$order=report_date_as_yyyy_mm_dd DESC&$limit=1`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`CFTC API error: ${res.status}`)

    const json = await res.json()
    if (!Array.isArray(json) || json.length === 0) return null

    const parsed = CFTCRowSchema.safeParse(json[0])
    if (!parsed.success) return null

    return parseCFTCRow(parsed.data, symbol.toUpperCase())
  } catch {
    return null
  }
}

/**
 * Fetch historical COT data for a given futures symbol and date range.
 */
export async function fetchCOTHistory(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<COTData[]> {
  const mapping = CFTC_SYMBOL_MAP[symbol.toUpperCase()]
  if (!mapping) return []

  const url = `${CFTC_API_BASE}?$where=cftc_contract_market_code='${mapping.cftcCode}' AND report_date_as_yyyy_mm_dd>='${startDate}' AND report_date_as_yyyy_mm_dd<='${endDate}'&$order=report_date_as_yyyy_mm_dd ASC&$limit=1000`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`CFTC API error: ${res.status}`)

    const json = await res.json()
    if (!Array.isArray(json)) return []

    return json
      .map((row) => {
        const parsed = CFTCRowSchema.safeParse(row)
        return parsed.success ? parseCFTCRow(parsed.data, symbol.toUpperCase()) : null
      })
      .filter((d): d is COTData => d !== null)
  } catch {
    return []
  }
}

/**
 * Calculate net positions from COT data.
 */
export function calculateNetPositions(data: COTData): {
  commercialNet: number
  nonCommercialNet: number
  nonReportableNet: number
} {
  return {
    commercialNet: data.commercialLong - data.commercialShort,
    nonCommercialNet: data.nonCommercialLong - data.nonCommercialShort,
    nonReportableNet: data.nonReportableLong - data.nonReportableShort,
  }
}

/**
 * Calculate week-over-week changes in net positions.
 */
export function calculatePositionChanges(
  current: COTData,
  previous: COTData,
): {
  commercialChange: number
  nonCommercialChange: number
  nonReportableChange: number
} {
  const currentNets = calculateNetPositions(current)
  const previousNets = calculateNetPositions(previous)

  return {
    commercialChange: currentNets.commercialNet - previousNets.commercialNet,
    nonCommercialChange: currentNets.nonCommercialNet - previousNets.nonCommercialNet,
    nonReportableChange: currentNets.nonReportableNet - previousNets.nonReportableNet,
  }
}

/**
 * Calculate COT index for non-commercial (large speculator) positions.
 * Index of current net position relative to the 52-week range.
 */
export function getCOTIndexFromHistory(
  history: COTData[],
  weeks: number = 52,
): number {
  if (history.length === 0) return 50

  const recentHistory = history.slice(-weeks)
  const weeklyNets = recentHistory.map((d) => d.nonCommercialLong - d.nonCommercialShort)
  const currentNet = weeklyNets[weeklyNets.length - 1] ?? 0

  return calculateCOTIndex(currentNet, weeklyNets)
}

/**
 * Get available COT symbols.
 */
export function getAvailableCOTSymbols(): { symbol: string; name: string }[] {
  return Object.entries(CFTC_SYMBOL_MAP).map(([symbol, { name }]) => ({
    symbol,
    name,
  }))
}
