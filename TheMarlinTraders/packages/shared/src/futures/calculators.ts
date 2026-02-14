/**
 * Futures Calculators
 * Sprints 37-38: Futures + Auto Pattern Recognition
 */

import type { FuturesContract } from './types.js'

// ── Contract Specifications ─────────────────────────────────────────────────
// Canonical specs for major futures contracts

export interface ContractSpec {
  symbol: string
  name: string
  exchange: string
  tickSize: number
  tickValue: number
  pointValue: number
  initialMargin: number
  maintenanceMargin: number
  tradingHours: string
}

const CONTRACT_SPECS: Record<string, ContractSpec> = {
  ES: {
    symbol: 'ES',
    name: 'E-mini S&P 500',
    exchange: 'CME',
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    initialMargin: 12_980,
    maintenanceMargin: 11_800,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  NQ: {
    symbol: 'NQ',
    name: 'E-mini NASDAQ-100',
    exchange: 'CME',
    tickSize: 0.25,
    tickValue: 5,
    pointValue: 20,
    initialMargin: 18_700,
    maintenanceMargin: 17_000,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  YM: {
    symbol: 'YM',
    name: 'E-mini Dow ($5)',
    exchange: 'CBOT',
    tickSize: 1,
    tickValue: 5,
    pointValue: 5,
    initialMargin: 10_120,
    maintenanceMargin: 9_200,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  RTY: {
    symbol: 'RTY',
    name: 'E-mini Russell 2000',
    exchange: 'CME',
    tickSize: 0.1,
    tickValue: 5,
    pointValue: 50,
    initialMargin: 7_150,
    maintenanceMargin: 6_500,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  CL: {
    symbol: 'CL',
    name: 'Crude Oil (WTI)',
    exchange: 'NYMEX',
    tickSize: 0.01,
    tickValue: 10,
    pointValue: 1_000,
    initialMargin: 6_820,
    maintenanceMargin: 6_200,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  GC: {
    symbol: 'GC',
    name: 'Gold',
    exchange: 'COMEX',
    tickSize: 0.1,
    tickValue: 10,
    pointValue: 100,
    initialMargin: 10_450,
    maintenanceMargin: 9_500,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  SI: {
    symbol: 'SI',
    name: 'Silver',
    exchange: 'COMEX',
    tickSize: 0.005,
    tickValue: 25,
    pointValue: 5_000,
    initialMargin: 14_850,
    maintenanceMargin: 13_500,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  ZB: {
    symbol: 'ZB',
    name: 'U.S. Treasury Bond',
    exchange: 'CBOT',
    tickSize: 1 / 32,
    tickValue: 31.25,
    pointValue: 1_000,
    initialMargin: 4_400,
    maintenanceMargin: 4_000,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  ZN: {
    symbol: 'ZN',
    name: '10-Year T-Note',
    exchange: 'CBOT',
    tickSize: 1 / 64,
    tickValue: 15.625,
    pointValue: 1_000,
    initialMargin: 2_200,
    maintenanceMargin: 2_000,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  '6E': {
    symbol: '6E',
    name: 'Euro FX',
    exchange: 'CME',
    tickSize: 0.00005,
    tickValue: 6.25,
    pointValue: 125_000,
    initialMargin: 2_530,
    maintenanceMargin: 2_300,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
  '6J': {
    symbol: '6J',
    name: 'Japanese Yen',
    exchange: 'CME',
    tickSize: 0.0000005,
    tickValue: 6.25,
    pointValue: 12_500_000,
    initialMargin: 3_300,
    maintenanceMargin: 3_000,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
  },
}

/**
 * Get the contract multiplier (point value) for a symbol.
 * Falls back to 1 for unknown symbols.
 */
export function getContractMultiplier(symbol: string): number {
  const spec = CONTRACT_SPECS[symbol.toUpperCase()]
  return spec?.pointValue ?? 1
}

/**
 * Get the full contract specification for a symbol.
 * Returns null if the symbol is not in the known specs.
 */
export function getContractSpec(symbol: string): ContractSpec | null {
  return CONTRACT_SPECS[symbol.toUpperCase()] ?? null
}

/**
 * Get all known contract specs.
 */
export function getAllContractSpecs(): ContractSpec[] {
  return Object.values(CONTRACT_SPECS)
}

/**
 * Calculate the dollar value of one tick movement for a contract.
 */
export function calculateTickValue(contract: FuturesContract): number {
  return contract.tickValue
}

/**
 * Calculate P&L for a futures trade.
 *
 * @param contract   The futures contract definition
 * @param entryPrice Entry price
 * @param exitPrice  Exit price
 * @param qty        Number of contracts (positive = long, negative = short)
 * @returns P&L in dollars
 */
export function calculatePnL(
  contract: FuturesContract,
  entryPrice: number,
  exitPrice: number,
  qty: number,
): number {
  const priceDiff = exitPrice - entryPrice
  const ticks = priceDiff / contract.tickSize
  return ticks * contract.tickValue * qty
}

/**
 * Calculate margin required for a number of contracts.
 *
 * @param contract The futures contract definition
 * @param qty      Number of contracts (absolute value used)
 * @returns Initial margin required in dollars
 */
export function calculateMarginRequired(
  contract: FuturesContract,
  qty: number,
): number {
  return contract.initialMargin * Math.abs(qty)
}

/**
 * Calculate the spread value between two contract prices.
 * Spread = frontPrice - backPrice, expressed in contract points.
 *
 * @param frontPrice Front-month price
 * @param backPrice  Back-month price
 * @param contract   The base contract (for point value conversion)
 * @returns Spread value in dollars
 */
export function calculateSpreadValue(
  frontPrice: number,
  backPrice: number,
  contract: FuturesContract,
): number {
  const priceDiff = frontPrice - backPrice
  return priceDiff * contract.pointValue
}

/**
 * Calculate ticks between two prices for a given contract.
 */
export function calculateTicks(
  contract: FuturesContract,
  price1: number,
  price2: number,
): number {
  return (price2 - price1) / contract.tickSize
}

/**
 * Calculate the COT index (current net position vs 52-week range).
 * Returns a value from 0 to 100.
 *
 * @param currentNet Current net position (long - short)
 * @param weeklyNets Array of weekly net positions over the past 52 weeks
 * @returns COT index 0-100 (0 = most bearish, 100 = most bullish)
 */
export function calculateCOTIndex(
  currentNet: number,
  weeklyNets: number[],
): number {
  if (weeklyNets.length === 0) return 50

  const min = Math.min(...weeklyNets)
  const max = Math.max(...weeklyNets)

  if (max === min) return 50

  return ((currentNet - min) / (max - min)) * 100
}

export { CONTRACT_SPECS }
