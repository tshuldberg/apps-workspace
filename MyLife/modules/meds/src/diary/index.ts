import type { DatabaseAdapter } from '@mylife/db';
import type {
  CreateDiaryEntryInput,
  DiaryEntry,
  DiaryEntryDetail,
  DiaryInsights,
  UpdateDiaryEntryInput,
} from '../models/diary';

function parseSideEffects(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeSideEffects(sideEffects: string[]): string[] {
  return Array.from(
    new Set(
      sideEffects
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function rowToDiaryEntry(row: Record<string, unknown>): DiaryEntry {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    doseLogId: (row.dose_log_id as string) ?? null,
    mood: (row.mood as string) ?? null,
    painLevel: (row.pain_level as number) ?? null,
    effectiveness: row.effectiveness as number,
    sideEffects: parseSideEffects(row.side_effects),
    notes: (row.notes as string) ?? null,
    recordedAt: row.recorded_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToDiaryEntryDetail(row: Record<string, unknown>): DiaryEntryDetail {
  return {
    ...rowToDiaryEntry(row),
    medicationName: row.medication_name as string,
    dosage: (row.dosage as string) ?? null,
    scheduledTime: (row.scheduled_time as string) ?? null,
    actualTime: (row.actual_time as string) ?? null,
    doseStatus: (row.dose_status as DiaryEntryDetail['doseStatus']) ?? null,
  };
}

export function createDiaryEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateDiaryEntryInput,
): void {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO md_diary_entries
      (id, medication_id, dose_log_id, mood, pain_level, effectiveness, side_effects, notes, recorded_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.medicationId,
      input.doseLogId ?? null,
      input.mood ?? null,
      input.painLevel ?? null,
      input.effectiveness ?? 3,
      JSON.stringify(normalizeSideEffects(input.sideEffects ?? [])),
      input.notes ?? null,
      input.recordedAt ?? now,
      now,
      now,
    ],
  );
}

export function updateDiaryEntry(
  db: DatabaseAdapter,
  id: string,
  input: UpdateDiaryEntryInput,
): void {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.doseLogId !== undefined) {
    updates.push('dose_log_id = ?');
    params.push(input.doseLogId);
  }
  if (input.mood !== undefined) {
    updates.push('mood = ?');
    params.push(input.mood);
  }
  if (input.painLevel !== undefined) {
    updates.push('pain_level = ?');
    params.push(input.painLevel);
  }
  if (input.effectiveness !== undefined) {
    updates.push('effectiveness = ?');
    params.push(input.effectiveness);
  }
  if (input.sideEffects !== undefined) {
    updates.push('side_effects = ?');
    params.push(JSON.stringify(normalizeSideEffects(input.sideEffects)));
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    params.push(input.notes);
  }
  if (input.recordedAt !== undefined) {
    updates.push('recorded_at = ?');
    params.push(input.recordedAt);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(new Date().toISOString(), id);

  db.execute(
    `UPDATE md_diary_entries
     SET ${updates.join(', ')}, updated_at = ?
     WHERE id = ?`,
    params,
  );
}

export function deleteDiaryEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_diary_entries WHERE id = ?', [id]);
}

export function getDiaryEntryById(
  db: DatabaseAdapter,
  id: string,
): DiaryEntryDetail | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT e.*, m.name as medication_name, m.dosage,
            d.scheduled_time, d.actual_time, d.status as dose_status
     FROM md_diary_entries e
     JOIN md_medications m ON m.id = e.medication_id
     LEFT JOIN md_dose_logs d ON d.id = e.dose_log_id
     WHERE e.id = ?`,
    [id],
  );

  return rows.length > 0 ? rowToDiaryEntryDetail(rows[0]) : null;
}

export function getDiaryEntries(
  db: DatabaseAdapter,
  opts?: {
    from?: string;
    to?: string;
    medicationId?: string;
    limit?: number;
  },
): DiaryEntryDetail[] {
  let sql = `SELECT e.*, m.name as medication_name, m.dosage,
                    d.scheduled_time, d.actual_time, d.status as dose_status
             FROM md_diary_entries e
             JOIN md_medications m ON m.id = e.medication_id
             LEFT JOIN md_dose_logs d ON d.id = e.dose_log_id
             WHERE 1 = 1`;
  const params: unknown[] = [];

  if (opts?.medicationId) {
    sql += ' AND e.medication_id = ?';
    params.push(opts.medicationId);
  }
  if (opts?.from) {
    sql += ' AND e.recorded_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND e.recorded_at <= ?';
    params.push(opts.to);
  }

  sql += ' ORDER BY e.recorded_at DESC LIMIT ?';
  params.push(opts?.limit ?? 500);

  return db.query<Record<string, unknown>>(sql, params).map(rowToDiaryEntryDetail);
}

export function getDiaryInsights(
  db: DatabaseAdapter,
  opts?: {
    from?: string;
    to?: string;
    medicationId?: string;
  },
): DiaryInsights {
  const entries = getDiaryEntries(db, { ...opts, limit: 1000 });
  const sideEffectCounts = new Map<string, number>();
  const medicationRatings = new Map<
    string,
    { medicationId: string; name: string; total: number; count: number }
  >();

  let missedDoseCount = 0;
  let totalEffectiveness = 0;

  for (const entry of entries) {
    totalEffectiveness += entry.effectiveness;

    if (entry.doseStatus === 'skipped') {
      missedDoseCount += 1;
    }

    for (const sideEffect of entry.sideEffects) {
      const normalized = sideEffect.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      sideEffectCounts.set(normalized, (sideEffectCounts.get(normalized) ?? 0) + 1);
    }

    const current = medicationRatings.get(entry.medicationId) ?? {
      medicationId: entry.medicationId,
      name: entry.medicationName,
      total: 0,
      count: 0,
    };
    current.total += entry.effectiveness;
    current.count += 1;
    medicationRatings.set(entry.medicationId, current);
  }

  const topSideEffect = Array.from(sideEffectCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const mostCommonSideEffect = topSideEffect
    ? topSideEffect[0]
        .split(/[_\s]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : null;

  const highestRatedMedication = Array.from(medicationRatings.values())
    .map((item) => ({
      medicationId: item.medicationId,
      name: item.name,
      averageEffectiveness: item.total / item.count,
    }))
    .sort((a, b) => b.averageEffectiveness - a.averageEffectiveness)[0] ?? null;

  const patterns: string[] = [];

  if (topSideEffect && topSideEffect[1] >= 2) {
    patterns.push(`${mostCommonSideEffect} appears most often in recent diary entries.`);
  }
  if (highestRatedMedication && highestRatedMedication.averageEffectiveness >= 4) {
    patterns.push(
      `${highestRatedMedication.name} has the strongest reported response at ${highestRatedMedication.averageEffectiveness.toFixed(1)}/5.`,
    );
  }
  if (missedDoseCount > 0) {
    patterns.push(
      `${missedDoseCount} ${missedDoseCount === 1 ? 'entry tracks' : 'entries track'} missed doses.`,
    );
  }
  if (patterns.length === 0 && entries.length > 0) {
    patterns.push('Keep journaling for a few more days to unlock stronger medication patterns.');
  }

  return {
    entryCount: entries.length,
    missedDoseCount,
    averageEffectiveness:
      entries.length > 0 ? Number((totalEffectiveness / entries.length).toFixed(1)) : null,
    mostCommonSideEffect,
    highestRatedMedication: highestRatedMedication
      ? {
          ...highestRatedMedication,
          averageEffectiveness: Number(highestRatedMedication.averageEffectiveness.toFixed(1)),
        }
      : null,
    patterns,
  };
}
