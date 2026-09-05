/**
 * Currencies and exchange rates CRUD operations.
 *
 * Currencies define available monetary units. Exchange rates store
 * conversion factors as integers (rate * 1_000_000) for precision,
 * plus an exact decimal string for display.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Currency, ExchangeRate } from '../types';

export interface CurrencyInsert {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base?: number;
}

export interface ExchangeRateInsert {
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_decimal: string;
}

// ---------------------------------------------------------------------------
// Currency CRUD
// ---------------------------------------------------------------------------

export function createCurrency(
  db: DatabaseAdapter,
  input: CurrencyInsert,
): Currency {
  const now = new Date().toISOString();
  const currency: Currency = {
    code: input.code,
    name: input.name,
    symbol: input.symbol,
    decimal_places: input.decimal_places,
    is_base: input.is_base ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_currencies (code, name, symbol, decimal_places, is_base, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [currency.code, currency.name, currency.symbol, currency.decimal_places, currency.is_base, currency.created_at],
  );

  return currency;
}

export function getCurrency(
  db: DatabaseAdapter,
  code: string,
): Currency | null {
  const rows = db.query<Currency>(
    `SELECT * FROM bg_currencies WHERE code = ?`,
    [code],
  );
  return rows[0] ?? null;
}

export function getCurrencies(
  db: DatabaseAdapter,
): Currency[] {
  return db.query<Currency>(
    `SELECT * FROM bg_currencies ORDER BY is_base DESC, code ASC`,
  );
}

export function getBaseCurrency(
  db: DatabaseAdapter,
): Currency | null {
  const rows = db.query<Currency>(
    `SELECT * FROM bg_currencies WHERE is_base = 1`,
  );
  return rows[0] ?? null;
}

export function deleteCurrency(
  db: DatabaseAdapter,
  code: string,
): void {
  db.execute(`DELETE FROM bg_currencies WHERE code = ?`, [code]);
}

// ---------------------------------------------------------------------------
// Exchange Rate CRUD
// ---------------------------------------------------------------------------

export function upsertExchangeRate(
  db: DatabaseAdapter,
  id: string,
  input: ExchangeRateInsert,
): ExchangeRate {
  const now = new Date().toISOString();

  const existing = db.query<ExchangeRate>(
    `SELECT * FROM bg_exchange_rates WHERE from_currency = ? AND to_currency = ?`,
    [input.from_currency, input.to_currency],
  );

  if (existing.length > 0) {
    db.execute(
      `UPDATE bg_exchange_rates SET rate = ?, rate_decimal = ?, fetched_at = ? WHERE id = ?`,
      [input.rate, input.rate_decimal, now, existing[0].id],
    );
    return { ...existing[0], rate: input.rate, rate_decimal: input.rate_decimal, fetched_at: now };
  }

  db.execute(
    `INSERT INTO bg_exchange_rates (id, from_currency, to_currency, rate, rate_decimal, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.from_currency, input.to_currency, input.rate, input.rate_decimal, now],
  );

  return {
    id,
    from_currency: input.from_currency,
    to_currency: input.to_currency,
    rate: input.rate,
    rate_decimal: input.rate_decimal,
    fetched_at: now,
  };
}

export function getExchangeRate(
  db: DatabaseAdapter,
  fromCurrency: string,
  toCurrency: string,
): ExchangeRate | null {
  const rows = db.query<ExchangeRate>(
    `SELECT * FROM bg_exchange_rates WHERE from_currency = ? AND to_currency = ?`,
    [fromCurrency, toCurrency],
  );
  return rows[0] ?? null;
}

export function getExchangeRates(
  db: DatabaseAdapter,
): ExchangeRate[] {
  return db.query<ExchangeRate>(
    `SELECT * FROM bg_exchange_rates ORDER BY from_currency, to_currency`,
  );
}

export function deleteExchangeRate(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_exchange_rates WHERE id = ?`, [id]);
}
