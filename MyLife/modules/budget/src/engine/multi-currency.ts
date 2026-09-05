/**
 * Multi-currency conversion utilities.
 *
 * Exchange rates are stored as integers (rate * 1_000_000) for precision,
 * plus a string decimal representation for exact display. All monetary
 * amounts are integer cents.
 *
 * Example: 1 EUR = 1.08 USD -> rate = 1_080_000, rate_decimal = "1.08"
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Rate precision multiplier. Rates are stored as rate * RATE_PRECISION. */
export const RATE_PRECISION = 1_000_000;

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;          // integer: actual rate * RATE_PRECISION
  rateDecimal: string;   // exact string representation, e.g. "1.08"
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBase: boolean;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Convert an amount in cents using an exchange rate.
 * The rate is an integer (actual rate * RATE_PRECISION).
 */
export function convertAmount(amountCents: number, rate: number): number {
  return Math.round((amountCents * rate) / RATE_PRECISION);
}

/**
 * Format a currency amount for display with the correct symbol and
 * decimal places for the given currency.
 */
export function formatCurrencyAmount(
  cents: number,
  currencyCode: string,
  currencies: CurrencyInfo[],
): string {
  const currency = currencies.find((c) => c.code === currencyCode);
  const symbol = currency?.symbol ?? currencyCode;
  const decimalPlaces = currency?.decimalPlaces ?? 2;

  if (decimalPlaces === 0) {
    // Currencies like JPY have no decimal subdivision
    const value = cents;
    return `${symbol}${value.toLocaleString('en-US')}`;
  }

  const divisor = Math.pow(10, decimalPlaces);
  const value = cents / divisor;
  const formatted = value.toFixed(decimalPlaces);

  // Use symbol prefix for common currencies, code prefix otherwise
  if (symbol.length <= 2) {
    return `${symbol}${formatted}`;
  }
  return `${symbol} ${formatted}`;
}

/**
 * Convert an amount from one currency to the base currency.
 * Looks up the appropriate exchange rate from the rates list.
 *
 * @throws Error if no exchange rate is found
 */
export function convertToBase(
  amountCents: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: ExchangeRate[],
): number {
  if (fromCurrency === baseCurrency) return amountCents;

  // Look for direct rate (fromCurrency -> baseCurrency)
  const direct = rates.find(
    (r) => r.fromCurrency === fromCurrency && r.toCurrency === baseCurrency,
  );
  if (direct) {
    return convertAmount(amountCents, direct.rate);
  }

  // Look for inverse rate (baseCurrency -> fromCurrency) and invert
  const inverse = rates.find(
    (r) => r.fromCurrency === baseCurrency && r.toCurrency === fromCurrency,
  );
  if (inverse) {
    const invertedRate = Math.round((RATE_PRECISION * RATE_PRECISION) / inverse.rate);
    return convertAmount(amountCents, invertedRate);
  }

  throw new Error(`No exchange rate found for ${fromCurrency} -> ${baseCurrency}`);
}
