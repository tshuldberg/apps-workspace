import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedHabit {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: string;
  target_count: string;
  unit: string;
  habit_type: string;
  time_of_day: string;
  specific_days: string;
  grace_period: string;
  reminder_time: string;
  is_archived: string;
  sort_order: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedCompletion {
  id: string;
  habit_id: string;
  completed_at: string;
  value: string;
  notes: string;
  created_at: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCSVSection(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csv.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'));
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Parse functions (pure, no DB)
// ---------------------------------------------------------------------------

export function parseHabitsCSV(csv: string): ParsedHabit[] {
  const { rows } = parseCSVSection(csv);
  return rows as unknown as ParsedHabit[];
}

export function parseCompletionsCSV(csv: string): ParsedCompletion[] {
  const { rows } = parseCSVSection(csv);
  return rows as unknown as ParsedCompletion[];
}

// ---------------------------------------------------------------------------
// Import functions (DB)
// ---------------------------------------------------------------------------

function extractSection(fullCSV: string, sectionName: string): string {
  const marker = `# ${sectionName}`;
  const idx = fullCSV.indexOf(marker);
  if (idx === -1) return '';
  const afterMarker = fullCSV.slice(idx + marker.length);
  // Find next section marker
  const nextSection = afterMarker.indexOf('\n#');
  const section = nextSection === -1 ? afterMarker : afterMarker.slice(0, nextSection);
  return section.trim();
}

export function importHabits(db: DatabaseAdapter, csv: string): ImportResult {
  const section = extractSection(csv, 'Habits');
  if (!section) return { imported: 0, skipped: 0, errors: [] };
  const parsed = parseHabitsCSV(section);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const h of parsed) {
    if (!h.id || !h.name) {
      errors.push(`Row missing id or name: ${JSON.stringify(h).slice(0, 80)}`);
      continue;
    }
    // Check for duplicate
    const existing = db.query<Record<string, unknown>>(
      'SELECT id FROM hb_habits WHERE id = ?',
      [h.id],
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    try {
      const specificDays = h.specific_days || null;
      const now = new Date().toISOString();
      db.execute(
        `INSERT INTO hb_habits (id, name, description, icon, color, frequency, target_count, unit, habit_type, time_of_day, specific_days, grace_period, reminder_time, is_archived, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          h.id,
          h.name,
          h.description || null,
          h.icon || null,
          h.color || null,
          h.frequency || 'daily',
          Number(h.target_count) || 1,
          h.unit || null,
          h.habit_type || 'standard',
          h.time_of_day || 'anytime',
          specificDays,
          Number(h.grace_period) || 0,
          h.reminder_time || null,
          Number(h.is_archived) || 0,
          Number(h.sort_order) || 0,
          h.created_at || now,
          h.updated_at || now,
        ],
      );
      imported++;
    } catch (err) {
      errors.push(`Failed to import habit "${h.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { imported, skipped, errors };
}

export function importCompletions(db: DatabaseAdapter, csv: string): ImportResult {
  const section = extractSection(csv, 'Completions');
  if (!section) return { imported: 0, skipped: 0, errors: [] };
  const parsed = parseCompletionsCSV(section);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of parsed) {
    if (!c.id || !c.habit_id) {
      errors.push(`Row missing id or habit_id`);
      continue;
    }
    const existing = db.query<Record<string, unknown>>(
      'SELECT id FROM hb_completions WHERE id = ?',
      [c.id],
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    try {
      const now = new Date().toISOString();
      db.execute(
        `INSERT INTO hb_completions (id, habit_id, completed_at, value, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.habit_id,
          c.completed_at || now,
          Number(c.value) || null,
          c.notes || null,
          c.created_at || now,
        ],
      );
      imported++;
    } catch (err) {
      errors.push(`Failed to import completion: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { imported, skipped, errors };
}

/**
 * Import a full CSV dump (habits + completions). Returns combined results.
 */
export function importAllCSV(db: DatabaseAdapter, csv: string): { habits: ImportResult; completions: ImportResult } {
  const habits = importHabits(db, csv);
  const completions = importCompletions(db, csv);
  return { habits, completions };
}
