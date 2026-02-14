import { parseForexPair, LOT_SIZES } from '../types/multi-asset.js'

/**
 * Calculate the monetary value of a single pip movement.
 *
 * For pairs where the account currency is the counter currency (e.g. EUR/USD
 * with a USD account), pip value = lotSize * pipSize.
 *
 * For pairs where the account currency is the base currency (e.g. USD/JPY
 * with a USD account), pip value = lotSize * pipSize / exchangeRate.
 *
 * @param pair     Forex pair string (e.g. 'EUR/USD')
 * @param lotSize  Trade size in units of base currency (e.g. 100000 for 1 standard lot)
 * @param accountCurrency  The currency the account is denominated in (default 'USD')
 * @param exchangeRate  Current exchange rate of the pair (needed for pairs where
 *                      account currency != counter currency). Defaults to 1.
 */
export function calculatePipValue(
  pair: string,
  lotSize: number,
  accountCurrency = 'USD',
  exchangeRate = 1,
): number {
  const { counter, pipSize } = parseForexPair(pair)

  // If account currency matches the counter currency, pip value is straightforward
  if (counter === accountCurrency.toUpperCase()) {
    return lotSize * pipSize
  }

  // Otherwise convert through the exchange rate
  if (exchangeRate <= 0) throw new Error('Exchange rate must be positive')
  return (lotSize * pipSize) / exchangeRate
}

/**
 * Calculate position size (lot size in units) given risk parameters.
 *
 * @param riskAmount     Maximum dollar amount willing to risk on the trade
 * @param stopLossPips   Distance from entry to stop loss in pips
 * @param pair           Forex pair string
 * @param accountCurrency  Account denomination currency (default 'USD')
 * @param exchangeRate   Current exchange rate (default 1)
 * @returns Position size in units of base currency
 */
export function calculateLotSize(
  riskAmount: number,
  stopLossPips: number,
  pair: string,
  accountCurrency = 'USD',
  exchangeRate = 1,
): number {
  if (stopLossPips <= 0) throw new Error('Stop loss pips must be positive')
  if (riskAmount <= 0) throw new Error('Risk amount must be positive')

  const { counter, pipSize } = parseForexPair(pair)

  // Value per pip for 1 unit of base currency
  let pipValuePerUnit: number
  if (counter === accountCurrency.toUpperCase()) {
    pipValuePerUnit = pipSize
  } else {
    if (exchangeRate <= 0) throw new Error('Exchange rate must be positive')
    pipValuePerUnit = pipSize / exchangeRate
  }

  return riskAmount / (stopLossPips * pipValuePerUnit)
}

/**
 * Calculate margin required to open a position.
 *
 * @param pair      Forex pair string
 * @param lotSize   Position size in units of base currency
 * @param leverage  Leverage ratio (e.g. 50 for 50:1)
 * @param exchangeRate  Current exchange rate (used if base != account currency)
 * @param accountCurrency  Account currency (default 'USD')
 * @returns Margin required in account currency
 */
export function calculateMarginRequired(
  pair: string,
  lotSize: number,
  leverage: number,
  exchangeRate = 1,
  accountCurrency = 'USD',
): number {
  if (leverage <= 0) throw new Error('Leverage must be positive')

  const { base } = parseForexPair(pair)
  const notional = lotSize / leverage

  // Convert notional to account currency if needed
  if (base === accountCurrency.toUpperCase()) {
    return notional
  }

  return notional * exchangeRate
}

/**
 * Convert a pip count to a price movement.
 *
 * @param pair  Forex pair string
 * @param pips  Number of pips
 * @returns Price delta corresponding to the given pip count
 */
export function pipToPrice(pair: string, pips: number): number {
  const { pipSize } = parseForexPair(pair)
  return pips * pipSize
}

/**
 * Convert a price movement to pips.
 *
 * @param pair       Forex pair string
 * @param priceMove  Price delta
 * @returns Number of pips
 */
export function priceToPip(pair: string, priceMove: number): number {
  const { pipSize } = parseForexPair(pair)
  return priceMove / pipSize
}

/**
 * Calculate profit/loss for a forex trade.
 *
 * @param pair          Forex pair string
 * @param entryPrice    Entry price
 * @param exitPrice     Exit price
 * @param lotSize       Position size in units
 * @param direction     'long' or 'short'
 * @param accountCurrency  Account currency (default 'USD')
 * @returns P&L in account currency
 */
export function calculatePnL(
  pair: string,
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  direction: 'long' | 'short',
  accountCurrency = 'USD',
): number {
  const { counter, pipSize } = parseForexPair(pair)
  const priceDiff = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  const pips = priceDiff / pipSize
  const pipValue = calculatePipValue(pair, lotSize, accountCurrency, exitPrice)
  return pips * pipValue
}

/**
 * Convert lot units to lot type label.
 */
export function unitsToLotLabel(units: number): string {
  if (units >= LOT_SIZES.standard) {
    const lots = units / LOT_SIZES.standard
    return `${lots.toFixed(lots % 1 === 0 ? 0 : 2)} standard lot${lots !== 1 ? 's' : ''}`
  }
  if (units >= LOT_SIZES.mini) {
    const lots = units / LOT_SIZES.mini
    return `${lots.toFixed(lots % 1 === 0 ? 0 : 2)} mini lot${lots !== 1 ? 's' : ''}`
  }
  const lots = units / LOT_SIZES.micro
  return `${lots.toFixed(lots % 1 === 0 ? 0 : 2)} micro lot${lots !== 1 ? 's' : ''}`
}
