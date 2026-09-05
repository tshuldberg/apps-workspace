import type { DatabaseAdapter } from '@mylife/db';
import type { InventoryItem, ItemCategory, Condition } from '../types';

function rowToInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
    category: row.category as ItemCategory,
    brand: (row.brand as string) ?? null,
    model: (row.model as string) ?? null,
    serialNumber: (row.serial_number as string) ?? null,
    purchaseDate: (row.purchase_date as string) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number) ?? null,
    estimatedValueCents: (row.estimated_value_cents as number) ?? null,
    condition: row.condition as Condition,
    photoUri: (row.photo_uri as string) ?? null,
    warrantyExpiry: (row.warranty_expiry as string) ?? null,
    documentId: (row.document_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createInventoryItem(
  db: DatabaseAdapter,
  id: string,
  input: {
    roomId: string;
    propertyId: string;
    name: string;
    category?: ItemCategory;
    brand?: string;
    model?: string;
    serialNumber?: string;
    purchaseDate?: string;
    purchasePriceCents?: number;
    estimatedValueCents?: number;
    condition?: Condition;
    photoUri?: string;
    warrantyExpiry?: string;
    documentId?: string;
    notes?: string;
  },
): InventoryItem {
  const now = new Date().toISOString();
  const category = input.category ?? 'other';
  const condition = input.condition ?? 'good';

  db.execute(
    `INSERT INTO hm_inventory_items (
      id, room_id, property_id, name, category, brand, model,
      serial_number, purchase_date, purchase_price_cents,
      estimated_value_cents, condition, photo_uri, warranty_expiry,
      document_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.roomId,
      input.propertyId,
      input.name,
      category,
      input.brand ?? null,
      input.model ?? null,
      input.serialNumber ?? null,
      input.purchaseDate ?? null,
      input.purchasePriceCents ?? null,
      input.estimatedValueCents ?? null,
      condition,
      input.photoUri ?? null,
      input.warrantyExpiry ?? null,
      input.documentId ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    roomId: input.roomId,
    propertyId: input.propertyId,
    name: input.name,
    category,
    brand: input.brand ?? null,
    model: input.model ?? null,
    serialNumber: input.serialNumber ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchasePriceCents: input.purchasePriceCents ?? null,
    estimatedValueCents: input.estimatedValueCents ?? null,
    condition,
    photoUri: input.photoUri ?? null,
    warrantyExpiry: input.warrantyExpiry ?? null,
    documentId: input.documentId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getInventoryItem(
  db: DatabaseAdapter,
  id: string,
): InventoryItem | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_inventory_items WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToInventoryItem(rows[0]) : null;
}

export function getItemsForRoom(
  db: DatabaseAdapter,
  roomId: string,
): InventoryItem[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_inventory_items WHERE room_id = ? ORDER BY name ASC LIMIT 500',
      [roomId],
    )
    .map(rowToInventoryItem);
}

export function getItemsForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): InventoryItem[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_inventory_items WHERE property_id = ? ORDER BY name ASC LIMIT 500',
      [propertyId],
    )
    .map(rowToInventoryItem);
}

export function updateInventoryItem(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    roomId: string;
    name: string;
    category: ItemCategory;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    purchaseDate: string | null;
    purchasePriceCents: number | null;
    estimatedValueCents: number | null;
    condition: Condition;
    photoUri: string | null;
    warrantyExpiry: string | null;
    documentId: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.roomId !== undefined) { sets.push('room_id = ?'); params.push(input.roomId); }
  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category); }
  if (input.brand !== undefined) { sets.push('brand = ?'); params.push(input.brand); }
  if (input.model !== undefined) { sets.push('model = ?'); params.push(input.model); }
  if (input.serialNumber !== undefined) { sets.push('serial_number = ?'); params.push(input.serialNumber); }
  if (input.purchaseDate !== undefined) { sets.push('purchase_date = ?'); params.push(input.purchaseDate); }
  if (input.purchasePriceCents !== undefined) { sets.push('purchase_price_cents = ?'); params.push(input.purchasePriceCents); }
  if (input.estimatedValueCents !== undefined) { sets.push('estimated_value_cents = ?'); params.push(input.estimatedValueCents); }
  if (input.condition !== undefined) { sets.push('condition = ?'); params.push(input.condition); }
  if (input.photoUri !== undefined) { sets.push('photo_uri = ?'); params.push(input.photoUri); }
  if (input.warrantyExpiry !== undefined) { sets.push('warranty_expiry = ?'); params.push(input.warrantyExpiry); }
  if (input.documentId !== undefined) { sets.push('document_id = ?'); params.push(input.documentId); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_inventory_items SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteInventoryItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_inventory_items WHERE id = ?', [id]);
}
