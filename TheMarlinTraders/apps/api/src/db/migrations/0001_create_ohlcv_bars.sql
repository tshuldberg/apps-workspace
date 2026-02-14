CREATE TABLE IF NOT EXISTS "ohlcv_bars" (
  "symbol" varchar(20) NOT NULL,
  "timeframe" varchar(10) NOT NULL,
  "timestamp" timestamptz NOT NULL,
  "open" numeric(18, 8) NOT NULL,
  "high" numeric(18, 8) NOT NULL,
  "low" numeric(18, 8) NOT NULL,
  "close" numeric(18, 8) NOT NULL,
  "volume" numeric(20, 2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ohlcv_symbol_tf_ts_idx"
  ON "ohlcv_bars" ("symbol", "timeframe", "timestamp");
