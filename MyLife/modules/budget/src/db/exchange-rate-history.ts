/**
 * CRUD operations for Exchange Rate History.
 * Table: bg_exchange_rate_history
 *
 * Stores historical exchange rate snapshots for multi-currency tracking.
 * Rates are stored as integers (rate * 1_000_000) plus an exact decimal string.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ExchangeRateHistory, ExchangeRateHistoryInsert } from '../types';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createExchangeRateHistory(
  db: DatabaseAdapter,
  id: string,
  input: ExchangeRateHistoryInsert,
): ExchangeRateHistory {
  const now = new Date().toISOString();
  const record: ExchangeRateHistory = {
    id,
    from_currency: input.from_currency,
    to_currency: input.to_currency,
    rate: input.rate,
    rate_decimal: input.rate_decimal,
    effective_date: input.effective_date,
    source: input.source ?? 'manual',
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_exchange_rate_history
      (id, from_currency, to_currency, rate, rate_decimal, effective_date, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.from_currency, record.to_currency,
      record.rate, record.rate_decimal, record.effective_date,
      record.source, record.created_at,
    ],
  );

  return record;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the historical rate closest to (or on) a given date for a currency pair.
 */
export function getHistoricalRate(
  db: DatabaseAdapter,
  fromCurrency: string,
  toCurrency: string,
  date: string,
): ExchangeRateHistory | null {
  const rows = db.query<ExchangeRateHistory>(
    `SELECT * FROM bg_exchange_rate_history
     WHERE from_currency = ? AND to_currency = ? AND effective_date <= ?
     ORDER BY effective_date DESC LIMIT 1`,
    [fromCurrency, toCurrency, date],
  );
  return rows[0] ?? null;
}

/**
 * Get all historical rates for a currency pair within a date range.
 */
export function getHistoricalRates(
  db: DatabaseAdapter,
  fromCurrency: string,
  toCurrency: string,
  startDate?: string,
  endDate?: string,
): ExchangeRateHistory[] {
  if (startDate && endDate) {
    return db.query<ExchangeRateHistory>(
      `SELECT * FROM bg_exchange_rate_history
       WHERE from_currency = ? AND to_currency = ? AND effective_date >= ? AND effective_date <= ?
       ORDER BY effective_date ASC`,
      [fromCurrency, toCurrency, startDate, endDate],
    );
  }

  return db.query<ExchangeRateHistory>(
    `SELECT * FROM bg_exchange_rate_history
     WHERE from_currency = ? AND to_currency = ?
     ORDER BY effective_date ASC`,
    [fromCurrency, toCurrency],
  );
}
