export const ARCHIVE_PIN_RECONCILE_CURSOR_SQL = `
-- Plan 43 WP-43B follow-up. The always-on archive seeder resumes its fenced pin reconciliation
-- from a durable cursor so a crash (or a host with more pins than one tick's bound) continues in
-- place instead of restarting from the first page every tick. The cursor is the reconciler's
-- structured {pinCursor, servingCursor} pair, stored as jsonb; the fenced ops.job_leases row is
-- still the single-writer authority - this table only remembers WHERE the winner got to.

CREATE TABLE ops.archive_pin_reconcile_runs (
  scan_id text PRIMARY KEY,
  cursor jsonb,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT archive_pin_reconcile_scan_id_bounded
    CHECK (length(scan_id) BETWEEN 1 AND 128),
  CONSTRAINT archive_pin_reconcile_cursor_bounded
    CHECK (cursor IS NULL OR pg_column_size(cursor) <= 4096)
);
`;
