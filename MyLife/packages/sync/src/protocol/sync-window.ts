/**
 * Sliding-window sync (plan 14, MK-028; the Matrix lesson).
 *
 * A cold start against a large workspace should not make the user stare at a
 * spinner while ten years of history crosses the wire. The sender splits a
 * module snapshot into two batches: a PRIORITY WINDOW of the most recently
 * updated rows -- the ones any UI renders first -- and the backfill remainder.
 * The window ships first and is applied immediately; the backfill follows in
 * the same session. The receive path is unchanged (batches apply in arrival
 * order), so visible data is on screen while history is still streaming.
 *
 * Pure: operates on the LWW snapshot wire format (SnapshotWire JSON). Rows are
 * ranked by their `updated_at` column; rows without one rank oldest.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SnapshotWire {
  tables: { [tableName: string]: { [rowId: string]: Record<string, unknown> } };
}

export interface WindowSplit {
  /** The priority window: the most recently updated rows. */
  window: Uint8Array;
  /** Everything else, or null when the snapshot fit inside the window. */
  backfill: Uint8Array | null;
  windowRows: number;
  backfillRows: number;
}

function rowRecency(row: Record<string, unknown>): string {
  const value = row.updated_at;
  return typeof value === 'string' ? value : '';
}

/**
 * Split a snapshot into a priority window of the `windowSize` most recently
 * updated rows plus the backfill remainder. Returns null when the input is not
 * a parseable snapshot (the caller falls back to sending it whole).
 */
export function splitSnapshotForWindow(
  snapshot: Uint8Array,
  windowSize: number,
): WindowSplit | null {
  let wire: SnapshotWire;
  try {
    wire = JSON.parse(decoder.decode(snapshot)) as SnapshotWire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !wire.tables) return null;

  const rows: Array<{ table: string; rowId: string; row: Record<string, unknown>; recency: string }> = [];
  for (const [table, byId] of Object.entries(wire.tables)) {
    for (const [rowId, row] of Object.entries(byId)) {
      rows.push({ table, rowId, row, recency: rowRecency(row) });
    }
  }

  if (rows.length <= windowSize) {
    return { window: snapshot, backfill: null, windowRows: rows.length, backfillRows: 0 };
  }

  // Most recent first; ties broken deterministically by table/rowId.
  rows.sort((a, b) =>
    b.recency.localeCompare(a.recency)
    || a.table.localeCompare(b.table)
    || a.rowId.localeCompare(b.rowId));

  const windowWire: SnapshotWire = { tables: {} };
  const backfillWire: SnapshotWire = { tables: {} };
  rows.forEach((entry, i) => {
    const target = i < windowSize ? windowWire : backfillWire;
    (target.tables[entry.table] ??= {})[entry.rowId] = entry.row;
  });

  return {
    window: encoder.encode(JSON.stringify(windowWire)),
    backfill: encoder.encode(JSON.stringify(backfillWire)),
    windowRows: Math.min(windowSize, rows.length),
    backfillRows: rows.length - windowSize,
  };
}
