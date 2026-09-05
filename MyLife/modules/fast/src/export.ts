import type { DatabaseAdapter } from '@mylife/db';

/** Escape a CSV field: wrap in quotes if it contains comma, quote, or newline */
function escapeField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeField).join(',');
}

/** Export all completed fasts as a CSV string */
export function exportFastsCSV(db: DatabaseAdapter): string {
  const header = toCsvRow([
    'id', 'protocol', 'target_hours', 'started_at', 'ended_at',
    'duration_seconds', 'hit_target', 'notes',
  ]);

  interface FastRow {
    id: string;
    protocol: string;
    target_hours: number;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    hit_target: number | null;
    notes: string | null;
  }

  const rows = db.query<FastRow>(
    `SELECT id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target, notes
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
     ORDER BY started_at DESC`,
  );

  const lines = [header];
  for (const row of rows) {
    lines.push(toCsvRow([
      row.id,
      row.protocol,
      row.target_hours,
      row.started_at,
      row.ended_at,
      row.duration_seconds,
      row.hit_target === null ? null : (row.hit_target === 1 ? 'yes' : 'no'),
      row.notes,
    ]));
  }

  return lines.join('\n') + '\n';
}

/** Export all weight entries as a CSV string */
export function exportWeightCSV(db: DatabaseAdapter): string {
  const header = toCsvRow(['id', 'weight_value', 'unit', 'date', 'notes']);

  interface WeightRow {
    id: string;
    weight_value: number;
    unit: string;
    date: string;
    notes: string | null;
  }

  const rows = db.query<WeightRow>(
    `SELECT id, weight_value, unit, date, notes
     FROM ft_weight_entries
     ORDER BY date DESC`,
  );

  const lines = [header];
  for (const row of rows) {
    lines.push(toCsvRow([
      row.id,
      row.weight_value,
      row.unit,
      row.date,
      row.notes,
    ]));
  }

  return lines.join('\n') + '\n';
}
