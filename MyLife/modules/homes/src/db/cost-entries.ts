import type { DatabaseAdapter } from '@mylife/db';
import type { CostEntry, CostCategory } from '../types';

function rowToCostEntry(row: Record<string, unknown>): CostEntry {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    scheduleId: (row.schedule_id as string) ?? null,
    category: row.category as CostCategory,
    description: row.description as string,
    amountCents: row.amount_cents as number,
    vendor: (row.vendor as string) ?? null,
    receiptPhotoUri: (row.receipt_photo_uri as string) ?? null,
    costDate: row.cost_date as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createCostEntry(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    scheduleId?: string;
    category: CostCategory;
    description: string;
    amountCents: number;
    vendor?: string;
    receiptPhotoUri?: string;
    costDate: string;
  },
): CostEntry {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO hm_cost_entries (
      id, property_id, schedule_id, category, description,
      amount_cents, vendor, receipt_photo_uri, cost_date,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.scheduleId ?? null,
      input.category,
      input.description,
      input.amountCents,
      input.vendor ?? null,
      input.receiptPhotoUri ?? null,
      input.costDate,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    scheduleId: input.scheduleId ?? null,
    category: input.category,
    description: input.description,
    amountCents: input.amountCents,
    vendor: input.vendor ?? null,
    receiptPhotoUri: input.receiptPhotoUri ?? null,
    costDate: input.costDate,
    createdAt: now,
    updatedAt: now,
  };
}

export function getCostEntry(
  db: DatabaseAdapter,
  id: string,
): CostEntry | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_cost_entries WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToCostEntry(rows[0]) : null;
}

export function getCostEntriesForProperty(
  db: DatabaseAdapter,
  propertyId: string,
  options?: { category?: CostCategory; startDate?: string; endDate?: string },
): CostEntry[] {
  const conditions = ['property_id = ?'];
  const params: unknown[] = [propertyId];

  if (options?.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }
  if (options?.startDate) {
    conditions.push('cost_date >= ?');
    params.push(options.startDate);
  }
  if (options?.endDate) {
    conditions.push('cost_date <= ?');
    params.push(options.endDate);
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_cost_entries WHERE ${conditions.join(' AND ')} ORDER BY cost_date DESC LIMIT 500`,
      params,
    )
    .map(rowToCostEntry);
}

export function getCostEntriesForSchedule(
  db: DatabaseAdapter,
  scheduleId: string,
): CostEntry[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_cost_entries WHERE schedule_id = ? ORDER BY cost_date DESC LIMIT 500',
      [scheduleId],
    )
    .map(rowToCostEntry);
}

export function updateCostEntry(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    category: CostCategory;
    description: string;
    amountCents: number;
    vendor: string | null;
    receiptPhotoUri: string | null;
    costDate: string;
    scheduleId: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category); }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
  if (input.amountCents !== undefined) { sets.push('amount_cents = ?'); params.push(input.amountCents); }
  if (input.vendor !== undefined) { sets.push('vendor = ?'); params.push(input.vendor); }
  if (input.receiptPhotoUri !== undefined) { sets.push('receipt_photo_uri = ?'); params.push(input.receiptPhotoUri); }
  if (input.costDate !== undefined) { sets.push('cost_date = ?'); params.push(input.costDate); }
  if (input.scheduleId !== undefined) { sets.push('schedule_id = ?'); params.push(input.scheduleId); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_cost_entries SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteCostEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_cost_entries WHERE id = ?', [id]);
}
