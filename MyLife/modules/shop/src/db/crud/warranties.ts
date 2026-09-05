import type { DatabaseAdapter } from '@mylife/db';
import {
  ClaimInputSchema,
  WarrantyInputSchema,
  WarrantySchema,
  WarrantyUpdateSchema,
  type ClaimInput,
  type Warranty,
  type WarrantyInput,
  type WarrantyUpdate,
  type CoverageType,
} from '../../models/schemas';

function nowMs(): number {
  return Date.now();
}

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function parseBool(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
}

function parseInt0(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.length > 0) return Number(raw);
  return 0;
}

function rowToWarranty(row: Record<string, unknown>): Warranty {
  return WarrantySchema.parse({
    id: row.id,
    purchaseId: row.purchase_id ?? null,
    itemName: row.item_name,
    coverageType: row.coverage_type,
    startDate: parseInt0(row.start_date),
    expiryDate: parseInt0(row.expiry_date),
    coverageDetailsMd: row.coverage_details_md ?? null,
    serialNumber: row.serial_number ?? null,
    registrationNumber: row.registration_number ?? null,
    claimFiled: parseBool(row.claim_filed),
    claimNotes: row.claim_notes ?? null,
    reminderDaysBefore: parseInt0(row.reminder_days_before),
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

export function createWarranty(
  db: DatabaseAdapter,
  rawInput: WarrantyInput,
): Warranty {
  const input = WarrantyInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();

  db.execute(
    `INSERT INTO sh_warranties (
       id, purchase_id, item_name, coverage_type,
       start_date, expiry_date, coverage_details_md,
       serial_number, registration_number,
       claim_filed, claim_notes, reminder_days_before,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
    [
      id,
      input.purchaseId,
      input.itemName,
      input.coverageType,
      input.startDate,
      input.expiryDate,
      input.coverageDetailsMd,
      input.serialNumber,
      input.registrationNumber,
      input.reminderDaysBefore,
      now,
      now,
    ],
  );

  return getWarrantyById(db, id)!;
}

export function getWarrantyById(
  db: DatabaseAdapter,
  id: string,
): Warranty | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_warranties WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToWarranty(rows[0]) : null;
}

export function updateWarranty(
  db: DatabaseAdapter,
  id: string,
  rawPatch: WarrantyUpdate,
): Warranty | null {
  const existing = getWarrantyById(db, id);
  if (!existing) return null;
  const patch = WarrantyUpdateSchema.parse(rawPatch);

  const next = {
    purchaseId:
      patch.purchaseId === undefined ? existing.purchaseId : patch.purchaseId,
    itemName: patch.itemName ?? existing.itemName,
    coverageType: patch.coverageType ?? existing.coverageType,
    startDate: patch.startDate ?? existing.startDate,
    expiryDate: patch.expiryDate ?? existing.expiryDate,
    coverageDetailsMd:
      patch.coverageDetailsMd === undefined
        ? existing.coverageDetailsMd
        : patch.coverageDetailsMd,
    serialNumber:
      patch.serialNumber === undefined
        ? existing.serialNumber
        : patch.serialNumber,
    registrationNumber:
      patch.registrationNumber === undefined
        ? existing.registrationNumber
        : patch.registrationNumber,
    reminderDaysBefore:
      patch.reminderDaysBefore ?? existing.reminderDaysBefore,
  };

  if (next.expiryDate < next.startDate) {
    throw new Error('expiryDate must be >= startDate');
  }

  const now = nowMs();
  db.execute(
    `UPDATE sh_warranties
       SET purchase_id = ?, item_name = ?, coverage_type = ?,
           start_date = ?, expiry_date = ?, coverage_details_md = ?,
           serial_number = ?, registration_number = ?,
           reminder_days_before = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.purchaseId,
      next.itemName,
      next.coverageType,
      next.startDate,
      next.expiryDate,
      next.coverageDetailsMd,
      next.serialNumber,
      next.registrationNumber,
      next.reminderDaysBefore,
      now,
      id,
    ],
  );

  return getWarrantyById(db, id);
}

export function deleteWarranty(db: DatabaseAdapter, id: string): boolean {
  const existing = getWarrantyById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_warranties WHERE id = ?`, [id]);
  return true;
}

export interface ListWarrantiesOptions {
  coverageType?: CoverageType;
  includeExpired?: boolean;
}

export function listWarranties(
  db: DatabaseAdapter,
  opts: ListWarrantiesOptions = {},
): Warranty[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.coverageType) {
    conditions.push('coverage_type = ?');
    params.push(opts.coverageType);
  }
  if (opts.includeExpired === false) {
    conditions.push('expiry_date >= ?');
    params.push(nowMs());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_warranties ${where}
         ORDER BY expiry_date ASC
         LIMIT 1000`,
      params,
    )
    .map(rowToWarranty);
}

export function listActiveWarranties(db: DatabaseAdapter): Warranty[] {
  const now = nowMs();
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_warranties
         WHERE expiry_date >= ? AND claim_filed = 0
         ORDER BY expiry_date ASC
         LIMIT 1000`,
      [now],
    )
    .map(rowToWarranty);
}

export function listExpiredWarranties(db: DatabaseAdapter): Warranty[] {
  const now = nowMs();
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_warranties
         WHERE expiry_date < ?
         ORDER BY expiry_date DESC
         LIMIT 1000`,
      [now],
    )
    .map(rowToWarranty);
}

export function listExpiringSoon(
  db: DatabaseAdapter,
  daysAhead: number,
): Warranty[] {
  if (!Number.isFinite(daysAhead) || daysAhead < 0) return [];
  const now = nowMs();
  const cutoff = now + Math.floor(daysAhead) * 86_400_000;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_warranties
         WHERE expiry_date >= ? AND expiry_date <= ?
         ORDER BY expiry_date ASC
         LIMIT 1000`,
      [now, cutoff],
    )
    .map(rowToWarranty);
}

export function fileClaim(
  db: DatabaseAdapter,
  id: string,
  rawInput: ClaimInput,
): Warranty | null {
  const existing = getWarrantyById(db, id);
  if (!existing) return null;
  const input = ClaimInputSchema.parse(rawInput);
  const now = nowMs();
  db.execute(
    `UPDATE sh_warranties
       SET claim_filed = 1, claim_notes = ?, updated_at = ?
     WHERE id = ?`,
    [input.notes, now, id],
  );
  return getWarrantyById(db, id);
}

export function getWarrantiesByPurchase(
  db: DatabaseAdapter,
  purchaseId: string,
): Warranty[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_warranties
         WHERE purchase_id = ?
         ORDER BY expiry_date ASC
         LIMIT 100`,
      [purchaseId],
    )
    .map(rowToWarranty);
}
