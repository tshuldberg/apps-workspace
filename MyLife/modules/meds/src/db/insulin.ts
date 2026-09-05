import type { DatabaseAdapter } from '@mylife/db';
import type {
  InsulinEntry,
  CreateInsulinEntryInput,
  InjectionSite,
  InjectionSiteName,
} from '../models/insulin';

function rowToInsulinEntry(row: Record<string, unknown>): InsulinEntry {
  return {
    id: row.id as string,
    medicationId: (row.medication_id as string) ?? null,
    insulinType: row.insulin_type as InsulinEntry['insulinType'],
    units: row.units as number,
    doseCategory: row.dose_category as InsulinEntry['doseCategory'],
    injectionSite: (row.injection_site as InsulinEntry['injectionSite']) ?? null,
    carbsCovered: (row.carbs_covered as number) ?? null,
    bloodGlucoseBefore: (row.blood_glucose_before as number) ?? null,
    notes: (row.notes as string) ?? null,
    administeredAt: row.administered_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToInjectionSite(row: Record<string, unknown>): InjectionSite {
  return {
    id: row.id as string,
    siteName: row.site_name as InjectionSiteName,
    lastUsedAt: row.last_used_at as string,
    useCount: row.use_count as number,
    createdAt: row.created_at as string,
  };
}

export function logInsulinEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateInsulinEntryInput,
): InsulinEntry {
  const now = new Date().toISOString();
  const administeredAt = input.administeredAt ?? now;

  db.transaction(() => {
    db.execute(
      `INSERT INTO md_insulin_entries (id, medication_id, insulin_type, units, dose_category, injection_site, carbs_covered, blood_glucose_before, notes, administered_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.medicationId ?? null,
        input.insulinType,
        input.units,
        input.doseCategory ?? 'correction',
        input.injectionSite ?? null,
        input.carbsCovered ?? null,
        input.bloodGlucoseBefore ?? null,
        input.notes ?? null,
        administeredAt,
        now,
      ],
    );

    // Update injection site tracker if a site was specified
    if (input.injectionSite) {
      upsertInjectionSite(db, input.injectionSite, administeredAt);
    }
  });

  return {
    id,
    medicationId: input.medicationId ?? null,
    insulinType: input.insulinType,
    units: input.units,
    doseCategory: input.doseCategory ?? 'correction',
    injectionSite: input.injectionSite ?? null,
    carbsCovered: input.carbsCovered ?? null,
    bloodGlucoseBefore: input.bloodGlucoseBefore ?? null,
    notes: input.notes ?? null,
    administeredAt,
    createdAt: now,
  };
}

function upsertInjectionSite(
  db: DatabaseAdapter,
  siteName: InjectionSiteName,
  usedAt: string,
): void {
  // Check if the site already exists
  const existing = db.query<{ id: string; use_count: number }>(
    'SELECT id, use_count FROM md_injection_sites WHERE site_name = ?',
    [siteName],
  );

  if (existing.length > 0) {
    db.execute(
      'UPDATE md_injection_sites SET last_used_at = ?, use_count = ? WHERE id = ?',
      [usedAt, existing[0].use_count + 1, existing[0].id],
    );
  } else {
    const id = `site-${siteName}-${Date.now()}`;
    db.execute(
      `INSERT INTO md_injection_sites (id, site_name, last_used_at, use_count, created_at)
       VALUES (?, ?, ?, 1, ?)`,
      [id, siteName, usedAt, new Date().toISOString()],
    );
  }
}

export function getInsulinEntryById(
  db: DatabaseAdapter,
  id: string,
): InsulinEntry | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_insulin_entries WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToInsulinEntry(rows[0]) : null;
}

export function getInsulinEntries(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; insulinType?: string; limit?: number },
): InsulinEntry[] {
  let sql = 'SELECT * FROM md_insulin_entries WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND administered_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND administered_at <= ?';
    params.push(opts.to);
  }
  if (opts?.insulinType) {
    sql += ' AND insulin_type = ?';
    params.push(opts.insulinType);
  }

  sql += ' ORDER BY administered_at DESC LIMIT ?';
  params.push(opts?.limit ?? 1000);

  return db.query<Record<string, unknown>>(sql, params).map(rowToInsulinEntry);
}

export function deleteInsulinEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_insulin_entries WHERE id = ?', [id]);
}

export function getInjectionSites(db: DatabaseAdapter): InjectionSite[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_injection_sites ORDER BY last_used_at ASC',
    )
    .map(rowToInjectionSite);
}

export function getInjectionSiteByName(
  db: DatabaseAdapter,
  siteName: InjectionSiteName,
): InjectionSite | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_injection_sites WHERE site_name = ?',
    [siteName],
  );
  return rows.length > 0 ? rowToInjectionSite(rows[0]) : null;
}
