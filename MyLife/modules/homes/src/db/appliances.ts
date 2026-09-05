import type { DatabaseAdapter } from '@mylife/db';
import type { Appliance, ApplianceCategory, ApplianceCondition } from '../types';

function rowToAppliance(row: Record<string, unknown>): Appliance {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    roomId: (row.room_id as string) ?? null,
    inventoryItemId: (row.inventory_item_id as string) ?? null,
    name: row.name as string,
    brand: (row.brand as string) ?? null,
    modelNumber: (row.model_number as string) ?? null,
    serialNumber: (row.serial_number as string) ?? null,
    purchaseDate: (row.purchase_date as string) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number) ?? null,
    warrantyExpiry: (row.warranty_expiry as string) ?? null,
    manualUri: (row.manual_uri as string) ?? null,
    photoUri: (row.photo_uri as string) ?? null,
    category: row.category as ApplianceCategory,
    condition: row.condition as ApplianceCondition,
    scheduleId: (row.schedule_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createAppliance(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    roomId?: string;
    inventoryItemId?: string;
    name: string;
    brand?: string;
    modelNumber?: string;
    serialNumber?: string;
    purchaseDate?: string;
    purchasePriceCents?: number;
    warrantyExpiry?: string;
    manualUri?: string;
    photoUri?: string;
    category?: ApplianceCategory;
    condition?: ApplianceCondition;
    scheduleId?: string;
    notes?: string;
  },
): Appliance {
  const now = new Date().toISOString();
  const category = input.category ?? 'other';
  const condition = input.condition ?? 'good';

  db.execute(
    `INSERT INTO hm_appliances (
      id, property_id, room_id, inventory_item_id, name, brand,
      model_number, serial_number, purchase_date, purchase_price_cents,
      warranty_expiry, manual_uri, photo_uri, category, condition,
      schedule_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.roomId ?? null,
      input.inventoryItemId ?? null,
      input.name,
      input.brand ?? null,
      input.modelNumber ?? null,
      input.serialNumber ?? null,
      input.purchaseDate ?? null,
      input.purchasePriceCents ?? null,
      input.warrantyExpiry ?? null,
      input.manualUri ?? null,
      input.photoUri ?? null,
      category,
      condition,
      input.scheduleId ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    roomId: input.roomId ?? null,
    inventoryItemId: input.inventoryItemId ?? null,
    name: input.name,
    brand: input.brand ?? null,
    modelNumber: input.modelNumber ?? null,
    serialNumber: input.serialNumber ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchasePriceCents: input.purchasePriceCents ?? null,
    warrantyExpiry: input.warrantyExpiry ?? null,
    manualUri: input.manualUri ?? null,
    photoUri: input.photoUri ?? null,
    category,
    condition,
    scheduleId: input.scheduleId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getAppliance(
  db: DatabaseAdapter,
  id: string,
): Appliance | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_appliances WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToAppliance(rows[0]) : null;
}

export function getAppliancesForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): Appliance[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_appliances WHERE property_id = ? ORDER BY name ASC LIMIT 200',
      [propertyId],
    )
    .map(rowToAppliance);
}

export function updateAppliance(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    roomId: string | null;
    inventoryItemId: string | null;
    name: string;
    brand: string | null;
    modelNumber: string | null;
    serialNumber: string | null;
    purchaseDate: string | null;
    purchasePriceCents: number | null;
    warrantyExpiry: string | null;
    manualUri: string | null;
    photoUri: string | null;
    category: ApplianceCategory;
    condition: ApplianceCondition;
    scheduleId: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.roomId !== undefined) { sets.push('room_id = ?'); params.push(input.roomId); }
  if (input.inventoryItemId !== undefined) { sets.push('inventory_item_id = ?'); params.push(input.inventoryItemId); }
  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.brand !== undefined) { sets.push('brand = ?'); params.push(input.brand); }
  if (input.modelNumber !== undefined) { sets.push('model_number = ?'); params.push(input.modelNumber); }
  if (input.serialNumber !== undefined) { sets.push('serial_number = ?'); params.push(input.serialNumber); }
  if (input.purchaseDate !== undefined) { sets.push('purchase_date = ?'); params.push(input.purchaseDate); }
  if (input.purchasePriceCents !== undefined) { sets.push('purchase_price_cents = ?'); params.push(input.purchasePriceCents); }
  if (input.warrantyExpiry !== undefined) { sets.push('warranty_expiry = ?'); params.push(input.warrantyExpiry); }
  if (input.manualUri !== undefined) { sets.push('manual_uri = ?'); params.push(input.manualUri); }
  if (input.photoUri !== undefined) { sets.push('photo_uri = ?'); params.push(input.photoUri); }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category); }
  if (input.condition !== undefined) { sets.push('condition = ?'); params.push(input.condition); }
  if (input.scheduleId !== undefined) { sets.push('schedule_id = ?'); params.push(input.scheduleId); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_appliances SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteAppliance(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_appliances WHERE id = ?', [id]);
}
