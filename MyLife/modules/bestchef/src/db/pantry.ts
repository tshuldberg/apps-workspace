import type { DatabaseAdapter } from '@mylife/db';
import type {
  ConfirmPantryItemIdentityInput,
  CreatePantryBatch,
  CreatePantryItem,
  ExpirationDateConfirmationInput,
  ExpirationDateConfirmationResult,
  FoodRecognitionConfirmationInput,
  FoodRecognitionConfirmationResult,
  NutritionCandidate,
  PantryBatch,
  PantryFilters,
  PantryItem,
  ReceiptImport,
  ReceiptImportConfirmationResult,
  ReceiptImportLine,
  ReceiptLineConfirmationInput,
  ReceiptLineConfirmationResult,
  ReceiptLineProductCandidate,
  UpdatePantryBatch,
  UpdatePantryItem,
} from '../types';
import { getPantryUseNextBatch } from '../pantry/expiration';
import {
  extractBarcodeFromReceiptLine,
  fuzzyItemMatch,
  normalizeReceiptLineDescription,
} from '../pantry/name-normalizer';
import {
  createFoodProduct,
  createFoodProductAlias,
  createNutritionData,
  getFoodProductById,
  getNutritionById,
  normalizeFoodAliasValue,
  recordFoodConfirmation,
} from './nutrition';

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

const PANTRY_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  expiration_date: 'expiration_date',
  created_at: 'created_at',
  storage_location: 'storage_location',
};

const PANTRY_SELECT_COLUMNS = `
      id,
      name,
      quantity,
      unit,
      storage_location,
      expiration_date,
      purchase_date,
      barcode,
      photo_path,
      notes,
      grocery_section,
      is_staple,
      product_id,
      nutrition_data_id,
      confirmation_status,
      confirmed_at,
      created_at,
      updated_at`;

const PANTRY_BATCH_SELECT_COLUMNS = `
      id,
      pantry_item_id,
      lot_code,
      quantity,
      unit,
      expiration_date,
      purchase_date,
      source,
      receipt_link,
      photos_json,
      created_at,
      updated_at`;

const DEFAULT_STORAGE_BY_SECTION: Record<NonNullable<CreatePantryItem['grocery_section']>, CreatePantryItem['storage_location']> = {
  produce: 'fridge',
  dairy: 'fridge',
  meat: 'fridge',
  pantry: 'pantry',
  frozen: 'freezer',
  bakery: 'counter',
  beverages: 'pantry',
  snacks: 'pantry',
  condiments: 'fridge',
  other: 'pantry',
};

interface PantryBatchRow extends Omit<PantryBatch, 'photos'> {
  photos_json: string;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseCandidateJson(value: string | null): ReceiptLineProductCandidate[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is ReceiptLineProductCandidate => {
          if (!entry || typeof entry !== 'object') return false;
          const candidate = entry as Partial<ReceiptLineProductCandidate>;
          return typeof candidate.id === 'string'
            && typeof candidate.label === 'string'
            && typeof candidate.confidence === 'number';
        })
      : [];
  } catch {
    return [];
  }
}

function receiptCandidateForLine(
  line: ReceiptImportLine,
  input: ReceiptLineConfirmationInput,
): ReceiptLineProductCandidate | null {
  if (input.selectedCandidateId === null) return null;
  const candidates = parseCandidateJson(line.candidate_json);
  if (input.selectedCandidateId) {
    return candidates.find((candidate) => candidate.id === input.selectedCandidateId) ?? null;
  }
  return candidates.sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function safeRecordFoodConfirmation(
  db: DatabaseAdapter,
  subjectType: 'food_product' | 'product_alias' | 'nutrition_data' | 'pantry_item',
  subjectId: string,
  confidence: number | null,
  notes: string,
): void {
  recordFoodConfirmation(db, createId('food-confirmation'), {
    subject_type: subjectType,
    subject_id: subjectId,
    decision: 'confirmed',
    confidence,
    notes,
  });
}

function tryCreateReceiptAlias(
  db: DatabaseAdapter,
  productId: string,
  aliasType: 'barcode' | 'receipt_line',
  aliasValue: string,
  confidence: number | null,
  now: string,
): void {
  const trimmed = aliasValue.trim();
  if (!trimmed) return;
  try {
    createFoodProductAlias(db, createId('food-alias'), {
      product_id: productId,
      alias_type: aliasType,
      alias_value: trimmed,
      normalized_value: normalizeFoodAliasValue(trimmed, aliasType),
      source: 'receipt_ocr',
      confidence,
      fetched_at: now,
      is_user_confirmed: 1,
      confirmed_at: now,
    });
  } catch {
    // Barcode aliases are unique; existing confirmed aliases are acceptable.
  }
}

function parsePhotosJson(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function serializePhotos(photos?: string[] | null): string {
  return JSON.stringify((photos ?? []).filter((entry) => entry.trim().length > 0));
}

function mapPantryBatch(row: PantryBatchRow): PantryBatch {
  return {
    id: row.id,
    pantry_item_id: row.pantry_item_id,
    lot_code: row.lot_code,
    quantity: row.quantity,
    unit: row.unit,
    expiration_date: row.expiration_date,
    purchase_date: row.purchase_date,
    source: row.source,
    receipt_link: row.receipt_link,
    photos: parsePhotosJson(row.photos_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getBatchesForItems(db: DatabaseAdapter, itemIds: string[]): Map<string, PantryBatch[]> {
  const batches = new Map<string, PantryBatch[]>();
  if (itemIds.length === 0) return batches;

  const placeholders = itemIds.map(() => '?').join(', ');
  const rows = db.query<PantryBatchRow>(
    `SELECT
      ${PANTRY_BATCH_SELECT_COLUMNS}
     FROM rc_pantry_batches
     WHERE pantry_item_id IN (${placeholders})
     ORDER BY
       CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,
       expiration_date ASC,
       purchase_date ASC,
       created_at ASC`,
    itemIds,
  );

  for (const row of rows) {
    const batch = mapPantryBatch(row);
    const existing = batches.get(batch.pantry_item_id) ?? [];
    existing.push(batch);
    batches.set(batch.pantry_item_id, existing);
  }

  return batches;
}

function attachBatches(db: DatabaseAdapter, items: PantryItem[]): PantryItem[] {
  const batchesByItem = getBatchesForItems(db, items.map((item) => item.id));
  return items.map((item) => {
    const batches = batchesByItem.get(item.id) ?? [];
    const useNext = getPantryUseNextBatch(batches);
    return {
      ...item,
      batch_count: batches.length,
      use_next_batch_id: useNext?.id ?? null,
      batches,
    };
  });
}

function firstPhotoPath(batch: PantryBatch | null): string | null {
  return batch?.photos[0] ?? null;
}

function syncPantryItemBatchSummary(db: DatabaseAdapter, pantryItemId: string): void {
  const batches = getPantryBatches(db, pantryItemId);
  if (batches.length === 0) {
    db.execute(
      `UPDATE rc_pantry_items
       SET quantity = 0,
           expiration_date = NULL,
           purchase_date = NULL,
           photo_path = NULL,
           updated_at = datetime('now')
       WHERE id = ?`,
      [pantryItemId],
    );
    return;
  }

  const useNext = getPantryUseNextBatch(batches);
  const quantityValues = batches
    .map((batch) => batch.quantity)
    .filter((quantity): quantity is number => quantity !== null);
  const totalQuantity = quantityValues.length > 0
    ? Math.round(quantityValues.reduce((sum, quantity) => sum + quantity, 0) * 1000) / 1000
    : null;
  const distinctUnits = new Set(
    batches
      .map((batch) => batch.unit)
      .filter((unit): unit is string => unit !== null && unit.trim().length > 0),
  );
  const summaryUnit = distinctUnits.size === 1
    ? Array.from(distinctUnits)[0]!
    : useNext?.unit ?? null;

  db.execute(
    `UPDATE rc_pantry_items
     SET quantity = ?,
         unit = ?,
         expiration_date = ?,
         purchase_date = ?,
         photo_path = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      totalQuantity,
      summaryUnit,
      useNext?.expiration_date ?? null,
      useNext?.purchase_date ?? null,
      firstPhotoPath(useNext ?? null),
      pantryItemId,
    ],
  );
}

export function createPantryItem(db: DatabaseAdapter, input: CreatePantryItem): PantryItem {
  const id = createId('pantry');
  const now = new Date().toISOString();

  db.transaction(() => {
    db.execute(
      `INSERT INTO rc_pantry_items (
        id,
        name,
        quantity,
        unit,
        storage_location,
        expiration_date,
        purchase_date,
        barcode,
        photo_path,
        notes,
        grocery_section,
        is_staple,
        product_id,
        nutrition_data_id,
        confirmation_status,
        confirmed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.quantity ?? null,
        input.unit ?? null,
        input.storage_location,
        input.expiration_date ?? null,
        input.purchase_date ?? null,
        input.barcode ?? null,
        input.photo_path ?? null,
        input.notes ?? null,
        input.grocery_section ?? 'other',
        input.is_staple ?? 0,
        input.product_id ?? null,
        input.nutrition_data_id ?? null,
        input.confirmation_status ?? 'unconfirmed',
        input.confirmed_at ?? null,
        now,
        now,
      ],
    );

    createPantryBatch(db, {
      pantry_item_id: id,
      lot_code: input.lot_code ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expiration_date: input.expiration_date ?? null,
      purchase_date: input.purchase_date ?? null,
      source: input.batch_source ?? 'manual',
      receipt_link: input.receipt_link ?? null,
      photos: input.photos ?? (input.photo_path ? [input.photo_path] : []),
    });
  });

  const created = getPantryItemById(db, id);
  if (!created) throw new Error('Unable to create pantry item.');
  return created;
}

export function getPantryItems(db: DatabaseAdapter, filters?: PantryFilters): PantryItem[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.search) {
    conditions.push("name LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.search)}%`);
  }
  if (filters?.storageLocation) {
    conditions.push('storage_location = ?');
    params.push(filters.storageLocation);
  }
  if (filters?.grocerySection) {
    conditions.push('grocery_section = ?');
    params.push(filters.grocerySection);
  }
  if (filters?.isStaple !== undefined) {
    conditions.push('is_staple = ?');
    params.push(filters.isStaple ? 1 : 0);
  }
  if (filters?.expirationStatus) {
    const today = new Date().toISOString().split('T')[0];
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 3);
    const soonString = soonDate.toISOString().split('T')[0];

    switch (filters.expirationStatus) {
      case 'expired':
        conditions.push(`EXISTS (
          SELECT 1 FROM rc_pantry_batches batch
          WHERE batch.pantry_item_id = rc_pantry_items.id
            AND batch.expiration_date IS NOT NULL
            AND batch.expiration_date < ?
        )`);
        params.push(today);
        break;
      case 'expiring_soon':
        conditions.push(`EXISTS (
          SELECT 1 FROM rc_pantry_batches batch
          WHERE batch.pantry_item_id = rc_pantry_items.id
            AND batch.expiration_date IS NOT NULL
            AND batch.expiration_date >= ?
            AND batch.expiration_date <= ?
        )`);
        params.push(today, soonString);
        break;
      case 'fresh':
        conditions.push(`EXISTS (
          SELECT 1 FROM rc_pantry_batches batch
          WHERE batch.pantry_item_id = rc_pantry_items.id
            AND batch.expiration_date IS NOT NULL
            AND batch.expiration_date > ?
        )`);
        params.push(soonString);
        break;
      case 'no_date':
        conditions.push(`EXISTS (
          SELECT 1 FROM rc_pantry_batches batch
          WHERE batch.pantry_item_id = rc_pantry_items.id
            AND batch.expiration_date IS NULL
        )`);
        break;
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortBy = PANTRY_SORT_COLUMNS[filters?.sortBy ?? 'created_at'] ?? 'created_at';
  const sortDir = filters?.sortDir === 'ASC' ? 'ASC' : 'DESC';

  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     ${where}
     ORDER BY ${sortBy} ${sortDir}
     LIMIT 500`,
    params,
  );
  return attachBatches(db, rows);
}

export function getPantryItemById(db: DatabaseAdapter, id: string): PantryItem | null {
  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     WHERE id = ?`,
    [id],
  );
  return attachBatches(db, rows)[0] ?? null;
}

export function updatePantryItem(db: DatabaseAdapter, id: string, updates: UpdatePantryItem): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, keyof UpdatePantryItem> = {
    name: 'name',
    storage_location: 'storage_location',
    barcode: 'barcode',
    notes: 'notes',
    grocery_section: 'grocery_section',
    is_staple: 'is_staple',
    product_id: 'product_id',
    nutrition_data_id: 'nutrition_data_id',
    confirmation_status: 'confirmation_status',
    confirmed_at: 'confirmed_at',
  };

  for (const [column, key] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  const batchUpdates: UpdatePantryBatch = {};
  let hasBatchUpdates = false;
  if (updates.quantity !== undefined) {
    batchUpdates.quantity = updates.quantity;
    hasBatchUpdates = true;
  }
  if (updates.unit !== undefined) {
    batchUpdates.unit = updates.unit;
    hasBatchUpdates = true;
  }
  if (updates.expiration_date !== undefined) {
    batchUpdates.expiration_date = updates.expiration_date;
    hasBatchUpdates = true;
  }
  if (updates.purchase_date !== undefined) {
    batchUpdates.purchase_date = updates.purchase_date;
    hasBatchUpdates = true;
  }
  if (updates.photo_path !== undefined) {
    batchUpdates.photos = updates.photo_path ? [updates.photo_path] : [];
    hasBatchUpdates = true;
  }

  if (fields.length === 0 && !hasBatchUpdates) return;

  db.transaction(() => {
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.execute(`UPDATE rc_pantry_items SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (hasBatchUpdates) {
      const item = getPantryItemById(db, id);
      const batchId = item?.use_next_batch_id ?? item?.batches?.[0]?.id ?? null;
      if (batchId) {
        updatePantryBatch(db, batchId, batchUpdates);
      } else {
        createPantryBatch(db, {
          pantry_item_id: id,
          quantity: batchUpdates.quantity ?? null,
          unit: batchUpdates.unit ?? null,
          expiration_date: batchUpdates.expiration_date ?? null,
          purchase_date: batchUpdates.purchase_date ?? null,
          photos: batchUpdates.photos ?? [],
        });
      }
    }
  });
}

export function deletePantryItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rc_pantry_items WHERE id = ?', [id]);
}

export function createPantryBatch(db: DatabaseAdapter, input: CreatePantryBatch): PantryBatch {
  const id = createId('batch');
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO rc_pantry_batches (
      id,
      pantry_item_id,
      lot_code,
      quantity,
      unit,
      expiration_date,
      purchase_date,
      source,
      receipt_link,
      photos_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.pantry_item_id,
      input.lot_code ?? null,
      input.quantity ?? null,
      input.unit ?? null,
      input.expiration_date ?? null,
      input.purchase_date ?? null,
      input.source ?? 'manual',
      input.receipt_link ?? null,
      serializePhotos(input.photos),
      now,
      now,
    ],
  );
  syncPantryItemBatchSummary(db, input.pantry_item_id);

  return {
    id,
    pantry_item_id: input.pantry_item_id,
    lot_code: input.lot_code ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    expiration_date: input.expiration_date ?? null,
    purchase_date: input.purchase_date ?? null,
    source: input.source ?? 'manual',
    receipt_link: input.receipt_link ?? null,
    photos: input.photos ?? [],
    created_at: now,
    updated_at: now,
  };
}

export function getPantryBatches(db: DatabaseAdapter, pantryItemId: string): PantryBatch[] {
  return db.query<PantryBatchRow>(
    `SELECT
      ${PANTRY_BATCH_SELECT_COLUMNS}
     FROM rc_pantry_batches
     WHERE pantry_item_id = ?
     ORDER BY
       CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,
       expiration_date ASC,
       purchase_date ASC,
       created_at ASC`,
    [pantryItemId],
  ).map(mapPantryBatch);
}

export function getPantryBatchById(db: DatabaseAdapter, id: string): PantryBatch | null {
  const rows = db.query<PantryBatchRow>(
    `SELECT
      ${PANTRY_BATCH_SELECT_COLUMNS}
     FROM rc_pantry_batches
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapPantryBatch(rows[0]) : null;
}

export function updatePantryBatch(db: DatabaseAdapter, id: string, updates: UpdatePantryBatch): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  const fieldMap: Record<string, keyof UpdatePantryBatch> = {
    lot_code: 'lot_code',
    quantity: 'quantity',
    unit: 'unit',
    expiration_date: 'expiration_date',
    purchase_date: 'purchase_date',
    source: 'source',
    receipt_link: 'receipt_link',
  };

  for (const [column, key] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }
  if (updates.photos !== undefined) {
    fields.push('photos_json = ?');
    values.push(serializePhotos(updates.photos));
  }

  if (fields.length === 0) return;

  const existing = getPantryBatchById(db, id);
  if (!existing) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.execute(`UPDATE rc_pantry_batches SET ${fields.join(', ')} WHERE id = ?`, values);
  syncPantryItemBatchSummary(db, existing.pantry_item_id);
}

export function deletePantryBatch(db: DatabaseAdapter, id: string): void {
  const existing = getPantryBatchById(db, id);
  if (!existing) return;
  db.execute('DELETE FROM rc_pantry_batches WHERE id = ?', [id]);
  syncPantryItemBatchSummary(db, existing.pantry_item_id);
}

export function useNextPantryBatch(
  db: DatabaseAdapter,
  pantryItemId: string,
  amount = 1,
): PantryBatch | null {
  const batches = getPantryBatches(db, pantryItemId);
  const next = getPantryUseNextBatch(batches);
  if (!next) return null;
  if (next.quantity === null) return next;

  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
  const newQuantity = Math.max(0, Math.round((next.quantity - normalizedAmount) * 1000) / 1000);
  updatePantryBatch(db, next.id, { quantity: newQuantity });
  return getPantryBatchById(db, next.id);
}

export function getPantryItemByBarcode(db: DatabaseAdapter, barcode: string): PantryItem | null {
  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     WHERE barcode = ?
        OR product_id IN (
          SELECT product_id
          FROM rc_food_product_aliases
          WHERE alias_type = 'barcode' AND normalized_value = ?
       )
     LIMIT 1`,
    [barcode, barcode.trim()],
  );
  return attachBatches(db, rows)[0] ?? null;
}

export function getExpiringItems(db: DatabaseAdapter, daysAhead: number): PantryItem[] {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureString = futureDate.toISOString().split('T')[0];

  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     WHERE id IN (
       SELECT DISTINCT pantry_item_id
       FROM rc_pantry_batches
       WHERE expiration_date IS NOT NULL AND expiration_date >= ? AND expiration_date <= ?
     )
     ORDER BY expiration_date ASC`,
    [today, futureString],
  );
  return attachBatches(db, rows);
}

export function getPantryItemsByName(db: DatabaseAdapter, name: string): PantryItem[] {
  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE
     LIMIT 200`,
    [`%${escapeLike(name)}%`],
  );
  return attachBatches(db, rows);
}

export function bulkUpdateQuantities(
  db: DatabaseAdapter,
  updates: Array<{ id: string; quantity: number }>,
): void {
  for (const update of updates) {
    updatePantryItem(db, update.id, { quantity: update.quantity });
  }
}

export function getPantryItemsByProduct(db: DatabaseAdapter, productId: string): PantryItem[] {
  const rows = db.query<PantryItem>(
    `SELECT
      ${PANTRY_SELECT_COLUMNS}
     FROM rc_pantry_items
     WHERE product_id = ?
     ORDER BY updated_at DESC
     LIMIT 200`,
    [productId],
  );
  return attachBatches(db, rows);
}

export function confirmPantryItemIdentity(
  db: DatabaseAdapter,
  id: string,
  input: ConfirmPantryItemIdentityInput,
): void {
  const confirmedAt = input.confirmed_at ?? new Date().toISOString();
  db.execute(
    `UPDATE rc_pantry_items
     SET product_id = ?,
         nutrition_data_id = ?,
         confirmation_status = 'confirmed',
         confirmed_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [input.product_id, input.nutrition_data_id ?? null, confirmedAt, id],
  );
}

function photoEvidence(input: { photoUri?: string | null; cropUri?: string | null }): string[] {
  return Array.from(new Set([input.cropUri, input.photoUri]
    .map((uri) => uri?.trim() ?? '')
    .filter(Boolean)));
}

function defaultStorageForSection(section: NonNullable<CreatePantryItem['grocery_section']>): CreatePantryItem['storage_location'] {
  return DEFAULT_STORAGE_BY_SECTION[section] ?? 'pantry';
}

function tryCreateFoodRecognitionAlias(
  db: DatabaseAdapter,
  productId: string,
  aliasValue: string,
  confidence: number | null,
  now: string,
  sourceId?: string | null,
): void {
  const trimmed = aliasValue.trim();
  if (!trimmed) return;
  try {
    createFoodProductAlias(db, createId('food-alias'), {
      product_id: productId,
      alias_type: 'ocr_label',
      alias_value: trimmed,
      normalized_value: normalizeFoodAliasValue(trimmed, 'ocr_label'),
      source: 'food_recognition',
      source_id: sourceId ?? null,
      confidence,
      fetched_at: now,
      is_user_confirmed: 1,
      confirmed_at: now,
    });
  } catch {
    // Duplicate labels are harmless for user-confirmed product identity.
  }
}

function tryCreateFoodRecognitionBarcodeAlias(
  db: DatabaseAdapter,
  productId: string,
  barcode: string | null | undefined,
  confidence: number | null,
  now: string,
  sourceId?: string | null,
): void {
  const normalized = barcode?.replace(/\D+/g, '') ?? '';
  if (normalized.length < 8 || normalized.length > 14) return;
  try {
    createFoodProductAlias(db, createId('food-alias'), {
      product_id: productId,
      alias_type: 'barcode',
      alias_value: normalized,
      normalized_value: normalizeFoodAliasValue(normalized, 'barcode'),
      source: 'food_recognition',
      source_id: sourceId ?? null,
      confidence,
      fetched_at: now,
      is_user_confirmed: 1,
      confirmed_at: now,
    });
  } catch {
    // Barcode aliases are unique; an existing alias is safe to reuse.
  }
}

function selectedNutritionCandidate(input: FoodRecognitionConfirmationInput): NutritionCandidate | null {
  const candidate = input.nutritionCandidate ?? null;
  if (!candidate) return null;
  if (input.selectedNutritionCandidateId && input.selectedNutritionCandidateId !== candidate.id) return null;
  return candidate;
}

function hasNutritionFacts(candidate: NutritionCandidate): boolean {
  return Object.values(candidate.nutrients).some((value) => value !== null);
}

function ensureFoodRecognitionProduct(
  db: DatabaseAdapter,
  input: FoodRecognitionConfirmationInput,
  now: string,
): string {
  const nutritionCandidate = selectedNutritionCandidate(input);
  const explicitProductId = input.productId ?? nutritionCandidate?.product_id ?? null;
  const confidence = nutritionCandidate?.confidence ?? input.confidence ?? null;
  const barcode = input.barcode ?? nutritionCandidate?.barcode ?? null;
  if (explicitProductId && getFoodProductById(db, explicitProductId)) {
    db.execute(
      `UPDATE rc_food_products
       SET is_user_confirmed = 1,
           confirmed_at = COALESCE(confirmed_at, ?),
           updated_at = datetime('now')
       WHERE id = ?`,
      [now, explicitProductId],
    );
    safeRecordFoodConfirmation(db, 'food_product', explicitProductId, confidence, 'Confirmed from grocery photo review.');
    for (const label of [input.name, ...(input.labels ?? [])]) {
      tryCreateFoodRecognitionAlias(db, explicitProductId, label, confidence, now, input.candidateId ?? null);
    }
    tryCreateFoodRecognitionBarcodeAlias(db, explicitProductId, barcode, confidence, now, nutritionCandidate?.source_id ?? input.candidateId ?? null);
    return explicitProductId;
  }

  const productId = createId('food-product');
  const section = input.grocerySection ?? 'other';
  const brand = input.brand ?? nutritionCandidate?.brand ?? null;
  const sourceId = nutritionCandidate?.source_id ?? input.candidateId ?? null;
  createFoodProduct(db, productId, {
    canonical_name: nutritionCandidate?.product_name?.trim() || input.name.trim(),
    brand,
    product_type: brand || barcode ? 'branded' : 'generic',
    grocery_section: section,
    default_storage_location: input.storageLocation ?? defaultStorageForSection(section),
    image_uri: input.photoUri ?? null,
    source: nutritionCandidate?.source ?? 'food_recognition',
    source_id: sourceId,
    confidence,
    is_user_confirmed: 1,
    confirmed_at: now,
  });
  safeRecordFoodConfirmation(db, 'food_product', productId, confidence, 'Created and confirmed from grocery photo review.');
  for (const label of [input.name, ...(input.labels ?? [])]) {
    tryCreateFoodRecognitionAlias(db, productId, label, confidence, now, input.candidateId ?? null);
  }
  tryCreateFoodRecognitionBarcodeAlias(db, productId, barcode, confidence, now, sourceId);
  return productId;
}

function ensureFoodRecognitionNutrition(
  db: DatabaseAdapter,
  productId: string,
  input: FoodRecognitionConfirmationInput,
  now: string,
): string | null {
  const nutritionCandidate = selectedNutritionCandidate(input);
  const nutritionDataId = input.nutritionDataId ?? nutritionCandidate?.nutrition_data_id ?? null;
  const confidence = nutritionCandidate?.confidence ?? input.confidence ?? null;
  if (nutritionDataId && getNutritionById(db, nutritionDataId)) {
    db.execute(
      `UPDATE rc_nutrition_data
       SET product_id = COALESCE(product_id, ?),
           is_user_confirmed = 1,
           confirmed_at = COALESCE(confirmed_at, ?)
       WHERE id = ?`,
      [productId, now, nutritionDataId],
    );
    safeRecordFoodConfirmation(db, 'nutrition_data', nutritionDataId, confidence, 'Linked from grocery photo review.');
    return nutritionDataId;
  }

  if (!nutritionCandidate) return null;
  if (nutritionCandidate.source === 'local_cache' && !hasNutritionFacts(nutritionCandidate)) {
    return null;
  }

  const nutritionId = createId('nutrition');
  createNutritionData(db, nutritionId, {
    pantry_item_id: null,
    product_id: productId,
    barcode: input.barcode ?? nutritionCandidate.barcode,
    product_name: nutritionCandidate.product_name ?? input.name,
    brand: nutritionCandidate.brand ?? input.brand ?? null,
    serving_size_text: nutritionCandidate.serving_size_text,
    calories: nutritionCandidate.nutrients.calories,
    fat_g: nutritionCandidate.nutrients.fat_g,
    saturated_fat_g: nutritionCandidate.nutrients.saturated_fat_g,
    carbs_g: nutritionCandidate.nutrients.carbs_g,
    fiber_g: nutritionCandidate.nutrients.fiber_g,
    sugar_g: nutritionCandidate.nutrients.sugar_g,
    protein_g: nutritionCandidate.nutrients.protein_g,
    sodium_mg: nutritionCandidate.nutrients.sodium_mg,
    source: nutritionCandidate.source,
    source_id: nutritionCandidate.source_id,
    source_url: nutritionCandidate.source_url,
    confidence: nutritionCandidate.confidence,
    serving_basis: nutritionCandidate.serving_basis,
    serving_quantity: nutritionCandidate.serving_quantity,
    serving_unit: nutritionCandidate.serving_unit,
    is_user_confirmed: 1,
    confirmed_at: now,
    fetched_at: nutritionCandidate.fetched_at ?? now,
  });
  safeRecordFoodConfirmation(db, 'nutrition_data', nutritionId, confidence, 'Created from selected grocery photo nutrition source.');
  return nutritionId;
}

function bestExistingPantryItemForFood(
  db: DatabaseAdapter,
  input: FoodRecognitionConfirmationInput,
  productId: string | null,
): PantryItem | null {
  if (input.pantryItemId) {
    const explicit = getPantryItemById(db, input.pantryItemId);
    if (explicit) return explicit;
  }

  if (productId) {
    const byProduct = getPantryItemsByProduct(db, productId)[0];
    if (byProduct) return byProduct;
  }

  const name = input.name.trim();
  return getPantryItems(db)
    .map((item) => ({ item, score: fuzzyItemMatch(name, item.name) }))
    .filter((entry) => entry.score >= 0.9)
    .sort((left, right) => right.score - left.score)[0]?.item ?? null;
}

export function confirmFoodRecognitionCandidateToPantry(
  db: DatabaseAdapter,
  input: FoodRecognitionConfirmationInput,
): FoodRecognitionConfirmationResult {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Food recognition candidate requires a name.');
  }

  const now = new Date().toISOString();
  const section = input.grocerySection ?? 'other';
  const storageLocation = input.storageLocation ?? defaultStorageForSection(section);
  const productId = ensureFoodRecognitionProduct(db, { ...input, name, grocerySection: section, storageLocation }, now);
  const nutritionDataId = ensureFoodRecognitionNutrition(db, productId, { ...input, name }, now);
  const existing = bestExistingPantryItemForFood(db, input, productId);
  let pantryItemId: string;
  let batchId: string;

  if (existing) {
    updatePantryItem(db, existing.id, {
      product_id: productId,
      nutrition_data_id: nutritionDataId,
      confirmation_status: 'confirmed',
      confirmed_at: now,
    });
    const batch = createPantryBatch(db, {
      pantry_item_id: existing.id,
      lot_code: input.lotCode ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expiration_date: input.expirationDate ?? null,
      purchase_date: input.purchaseDate ?? null,
      source: 'food_recognition',
      receipt_link: input.candidateId ? `food_photo:${input.candidateId}` : null,
      photos: photoEvidence(input),
    });
    pantryItemId = existing.id;
    batchId = batch.id;
  } else {
    const created = createPantryItem(db, {
      name,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      storage_location: storageLocation,
      expiration_date: input.expirationDate ?? null,
      purchase_date: input.purchaseDate ?? null,
      photo_path: input.photoUri ?? null,
      grocery_section: section,
      product_id: productId,
      nutrition_data_id: nutritionDataId,
      confirmation_status: 'confirmed',
      confirmed_at: now,
      lot_code: input.lotCode ?? null,
      batch_source: 'food_recognition',
      receipt_link: input.candidateId ? `food_photo:${input.candidateId}` : null,
      photos: photoEvidence(input),
    });
    pantryItemId = created.id;
    batchId = created.use_next_batch_id ?? created.batches?.[0]?.id ?? created.id;
  }

  safeRecordFoodConfirmation(db, 'pantry_item', pantryItemId, input.confidence ?? null, 'Confirmed from grocery photo review.');
  return {
    candidateId: input.candidateId ?? null,
    pantryItemId,
    batchId,
    productId,
    nutritionDataId,
  };
}

export function confirmFoodRecognitionCandidatesToPantry(
  db: DatabaseAdapter,
  inputs: FoodRecognitionConfirmationInput[],
): FoodRecognitionConfirmationResult[] {
  return inputs.map((input) => confirmFoodRecognitionCandidateToPantry(db, input));
}

function validateDateString(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Expiration date must use YYYY-MM-DD.');
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Expiration date must be a real calendar date.');
  }
  return trimmed;
}

export function confirmExpirationDateForPantryBatch(
  db: DatabaseAdapter,
  input: ExpirationDateConfirmationInput,
): ExpirationDateConfirmationResult {
  const expirationDate = validateDateString(input.expirationDate);
  const photos = photoEvidence(input);
  const existingBatch = input.pantryBatchId ? getPantryBatchById(db, input.pantryBatchId) : null;

  if (input.pantryBatchId && !existingBatch) {
    throw new Error('Selected pantry batch was not found.');
  }

  if (existingBatch) {
    updatePantryBatch(db, existingBatch.id, {
      lot_code: input.lotCode ?? existingBatch.lot_code,
      quantity: input.quantity ?? existingBatch.quantity,
      unit: input.unit ?? existingBatch.unit,
      expiration_date: expirationDate,
      source: existingBatch.source === 'manual' ? 'expiration_ocr' : existingBatch.source,
      photos: Array.from(new Set([...existingBatch.photos, ...photos])),
    });
    safeRecordFoodConfirmation(db, 'pantry_item', existingBatch.pantry_item_id, input.confidence ?? null, 'Expiration date confirmed from photo OCR.');
    return {
      pantryItemId: existingBatch.pantry_item_id,
      batchId: existingBatch.id,
      expirationDate,
      createdItem: false,
    };
  }

  const existingItem = input.pantryItemId ? getPantryItemById(db, input.pantryItemId) : null;
  if (input.pantryItemId && !existingItem) {
    throw new Error('Selected pantry item was not found.');
  }

  if (existingItem) {
    const batch = createPantryBatch(db, {
      pantry_item_id: existingItem.id,
      lot_code: input.lotCode ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expiration_date: expirationDate,
      source: 'expiration_ocr',
      receipt_link: input.rawText ? 'expiration_photo:ocr' : null,
      photos,
    });
    safeRecordFoodConfirmation(db, 'pantry_item', existingItem.id, input.confidence ?? null, 'Expiration date confirmed from photo OCR.');
    return {
      pantryItemId: existingItem.id,
      batchId: batch.id,
      expirationDate,
      createdItem: false,
    };
  }

  const itemName = input.itemName?.trim();
  if (!itemName) {
    throw new Error('Select a pantry item or enter an item name before confirming an expiration date.');
  }

  const section = input.grocerySection ?? 'other';
  const created = createPantryItem(db, {
    name: itemName,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    storage_location: input.storageLocation ?? defaultStorageForSection(section),
    expiration_date: expirationDate,
    grocery_section: section,
    lot_code: input.lotCode ?? null,
    batch_source: 'expiration_ocr',
    receipt_link: input.rawText ? 'expiration_photo:ocr' : null,
    photos,
    confirmation_status: 'needs_review',
  });
  safeRecordFoodConfirmation(db, 'pantry_item', created.id, input.confidence ?? null, 'Expiration date confirmed from photo OCR.');
  return {
    pantryItemId: created.id,
    batchId: created.use_next_batch_id ?? created.batches?.[0]?.id ?? created.id,
    expirationDate,
    createdItem: true,
  };
}

function getReceiptImportById(db: DatabaseAdapter, id: string): ReceiptImport | null {
  return db.query<ReceiptImport>(
    `SELECT * FROM rc_receipt_imports WHERE id = ? LIMIT 1`,
    [id],
  )[0] ?? null;
}

function getReceiptLineById(db: DatabaseAdapter, id: string): ReceiptImportLine | null {
  return db.query<ReceiptImportLine>(
    `SELECT * FROM rc_receipt_import_lines WHERE id = ? LIMIT 1`,
    [id],
  )[0] ?? null;
}

function ensureReceiptProduct(
  db: DatabaseAdapter,
  line: ReceiptImportLine,
  candidate: ReceiptLineProductCandidate | null,
  input: ReceiptLineConfirmationInput,
  now: string,
): string {
  const storedProductId = input.selectedCandidateId === null ? null : line.product_id;
  const explicitProductId = input.productId ?? storedProductId ?? candidate?.product_id ?? null;
  const normalizedName = input.itemName?.trim()
    || line.normalized_name
    || normalizeReceiptLineDescription(line.raw_description)
    || line.raw_description.trim();
  const confidence = line.match_confidence ?? candidate?.confidence ?? 0.58;

  if (explicitProductId && getFoodProductById(db, explicitProductId)) {
    db.execute(
      `UPDATE rc_food_products
       SET is_user_confirmed = 1,
           confirmed_at = COALESCE(confirmed_at, ?),
           updated_at = datetime('now')
       WHERE id = ?`,
      [now, explicitProductId],
    );
    safeRecordFoodConfirmation(db, 'food_product', explicitProductId, confidence, 'Confirmed from receipt review.');
    tryCreateReceiptAlias(db, explicitProductId, 'receipt_line', line.raw_description, confidence, now);
    const barcode = extractBarcodeFromReceiptLine(line.raw_description) ?? candidate?.barcode ?? null;
    if (barcode) {
      tryCreateReceiptAlias(db, explicitProductId, 'barcode', barcode, confidence, now);
    }
    return explicitProductId;
  }

  const productId = createId('food-product');
  createFoodProduct(db, productId, {
    canonical_name: normalizedName,
    product_type: 'generic',
    grocery_section: candidate?.grocery_section ?? 'other',
    default_storage_location: candidate?.storage_location ?? 'pantry',
    source: 'receipt_ocr',
    source_id: line.id,
    confidence,
    is_user_confirmed: 1,
    confirmed_at: now,
  });
  safeRecordFoodConfirmation(db, 'food_product', productId, confidence, 'Created and confirmed from receipt review.');
  tryCreateReceiptAlias(db, productId, 'receipt_line', line.raw_description, confidence, now);
  const barcode = extractBarcodeFromReceiptLine(line.raw_description) ?? candidate?.barcode ?? null;
  if (barcode) {
    tryCreateReceiptAlias(db, productId, 'barcode', barcode, confidence, now);
  }
  return productId;
}

function ensureReceiptNutrition(
  db: DatabaseAdapter,
  line: ReceiptImportLine,
  candidate: ReceiptLineProductCandidate | null,
  productId: string,
  input: ReceiptLineConfirmationInput,
  now: string,
): string | null {
  const storedNutritionId = input.selectedCandidateId === null ? null : line.nutrition_data_id;
  const explicitNutritionId = input.nutritionDataId ?? storedNutritionId ?? candidate?.nutrition_data_id ?? null;
  if (explicitNutritionId && getNutritionById(db, explicitNutritionId)) {
    db.execute(
      `UPDATE rc_nutrition_data
       SET product_id = COALESCE(product_id, ?),
           is_user_confirmed = 1,
           confirmed_at = COALESCE(confirmed_at, ?)
       WHERE id = ?`,
      [productId, now, explicitNutritionId],
    );
    safeRecordFoodConfirmation(db, 'nutrition_data', explicitNutritionId, candidate?.confidence ?? line.match_confidence, 'Linked from receipt review.');
    return explicitNutritionId;
  }

  const nutritionCandidate = candidate?.nutritionCandidate;
  if (!nutritionCandidate) return null;

  const nutritionId = createId('nutrition');
  createNutritionData(db, nutritionId, {
    pantry_item_id: null,
    product_id: productId,
    barcode: nutritionCandidate.barcode,
    product_name: nutritionCandidate.product_name ?? input.itemName ?? line.normalized_name,
    brand: nutritionCandidate.brand,
    serving_size_text: nutritionCandidate.serving_size_text,
    calories: nutritionCandidate.nutrients.calories,
    fat_g: nutritionCandidate.nutrients.fat_g,
    saturated_fat_g: nutritionCandidate.nutrients.saturated_fat_g,
    carbs_g: nutritionCandidate.nutrients.carbs_g,
    fiber_g: nutritionCandidate.nutrients.fiber_g,
    sugar_g: nutritionCandidate.nutrients.sugar_g,
    protein_g: nutritionCandidate.nutrients.protein_g,
    sodium_mg: nutritionCandidate.nutrients.sodium_mg,
    source: nutritionCandidate.source,
    source_id: nutritionCandidate.source_id,
    source_url: nutritionCandidate.source_url,
    confidence: nutritionCandidate.confidence,
    serving_basis: nutritionCandidate.serving_basis,
    serving_quantity: nutritionCandidate.serving_quantity,
    serving_unit: nutritionCandidate.serving_unit,
    is_user_confirmed: 1,
    confirmed_at: now,
    fetched_at: nutritionCandidate.fetched_at ?? now,
  });
  safeRecordFoodConfirmation(db, 'nutrition_data', nutritionId, nutritionCandidate.confidence, 'Created from confirmed receipt candidate.');
  return nutritionId;
}

function updateReceiptReviewStatus(db: DatabaseAdapter, receiptImportId: string): void {
  const receipt = getReceiptImportById(db, receiptImportId);
  if (!receipt || receipt.provider_status === 'failed') return;

  const remaining = db.query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM rc_receipt_import_lines
     WHERE receipt_import_id = ?
       AND match_status IN ('unmatched', 'matched', 'ambiguous')`,
    [receiptImportId],
  )[0]?.count ?? 0;
  const confirmed = db.query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM rc_receipt_import_lines
     WHERE receipt_import_id = ?
       AND match_status = 'confirmed'`,
    [receiptImportId],
  )[0]?.count ?? 0;
  const nextStatus = remaining === 0
    ? (confirmed > 0 ? 'confirmed' : 'dismissed')
    : 'needs_review';

  db.execute(
    `UPDATE rc_receipt_imports
     SET review_status = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [nextStatus, receiptImportId],
  );
}

export function confirmReceiptLineToPantry(
  db: DatabaseAdapter,
  input: ReceiptLineConfirmationInput,
): ReceiptLineConfirmationResult {
  const line = getReceiptLineById(db, input.lineId);
  if (!line) {
    throw new Error(`Receipt line ${input.lineId} was not found.`);
  }
  const receipt = getReceiptImportById(db, line.receipt_import_id);
  if (!receipt) {
    throw new Error(`Receipt import ${line.receipt_import_id} was not found.`);
  }
  if (line.match_status === 'ignored') {
    throw new Error(`Receipt line ${input.lineId} is ignored.`);
  }

  const existingPantryItem = line.pantry_item_id ? getPantryItemById(db, line.pantry_item_id) : null;
  if (line.match_status === 'confirmed' && existingPantryItem) {
    return {
      lineId: line.id,
      pantryItemId: existingPantryItem.id,
      batchId: existingPantryItem.use_next_batch_id ?? existingPantryItem.batches?.[0]?.id ?? existingPantryItem.id,
      productId: line.product_id,
      nutritionDataId: line.nutrition_data_id,
    };
  }

  const now = new Date().toISOString();
  const candidate = receiptCandidateForLine(line, input);
  const productId = ensureReceiptProduct(db, line, candidate, input, now);
  const nutritionDataId = ensureReceiptNutrition(db, line, candidate, productId, input, now);
  const quantity = input.quantity !== undefined ? input.quantity : line.quantity;
  const unit = input.unit !== undefined ? input.unit : null;
  const itemName = input.itemName?.trim()
    || line.normalized_name
    || normalizeReceiptLineDescription(line.raw_description)
    || line.raw_description.trim();
  const pantryItemId = input.pantryItemId
    ?? (input.selectedCandidateId === null ? null : line.pantry_item_id)
    ?? candidate?.pantry_item_id
    ?? null;
  const receiptLink = `receipt_import:${receipt.id}`;
  let createdPantryItemId: string;
  let batchId: string;

  if (pantryItemId && getPantryItemById(db, pantryItemId)) {
    updatePantryItem(db, pantryItemId, {
      product_id: productId,
      nutrition_data_id: nutritionDataId,
      confirmation_status: 'confirmed',
      confirmed_at: now,
    });
    const batch = createPantryBatch(db, {
      pantry_item_id: pantryItemId,
      lot_code: input.lotCode ?? null,
      quantity,
      unit,
      purchase_date: receipt.receipt_date ?? null,
      expiration_date: input.expirationDate ?? null,
      source: 'receipt_ocr',
      receipt_link: receiptLink,
      photos: [receipt.photo_uri],
    });
    createdPantryItemId = pantryItemId;
    batchId = batch.id;
  } else {
    const created = createPantryItem(db, {
      name: itemName,
      quantity,
      unit,
      storage_location: candidate?.storage_location ?? 'pantry',
      grocery_section: candidate?.grocery_section ?? 'other',
      purchase_date: receipt.receipt_date ?? null,
      expiration_date: input.expirationDate ?? null,
      lot_code: input.lotCode ?? null,
      product_id: productId,
      nutrition_data_id: nutritionDataId,
      confirmation_status: 'confirmed',
      confirmed_at: now,
      batch_source: 'receipt_ocr',
      receipt_link: receiptLink,
      photos: [receipt.photo_uri],
    });
    createdPantryItemId = created.id;
    batchId = created.use_next_batch_id ?? created.batches?.[0]?.id ?? created.id;
  }

  db.execute(
    `UPDATE rc_receipt_import_lines
     SET product_id = ?,
         pantry_item_id = ?,
         nutrition_data_id = ?,
         normalized_name = ?,
         match_status = 'confirmed',
         updated_at = datetime('now')
     WHERE id = ?`,
    [productId, createdPantryItemId, nutritionDataId, itemName, line.id],
  );
  safeRecordFoodConfirmation(db, 'pantry_item', createdPantryItemId, line.match_confidence, 'Confirmed from receipt review.');
  updateReceiptReviewStatus(db, receipt.id);

  return {
    lineId: line.id,
    pantryItemId: createdPantryItemId,
    batchId,
    productId,
    nutritionDataId,
  };
}

export function ignoreReceiptImportLine(db: DatabaseAdapter, lineId: string): void {
  const line = getReceiptLineById(db, lineId);
  if (!line) return;
  db.execute(
    `UPDATE rc_receipt_import_lines
     SET match_status = 'ignored',
         updated_at = datetime('now')
     WHERE id = ?`,
    [lineId],
  );
  updateReceiptReviewStatus(db, line.receipt_import_id);
}

/**
 * Reverts a receipt import line back to a reviewable state. If the line had
 * already created or merged a pantry batch, that batch is removed. The pantry
 * item itself is preserved if it has other batches; otherwise it is deleted to
 * undo the receipt write entirely.
 */
export function undoReceiptImportLine(db: DatabaseAdapter, lineId: string): void {
  const line = getReceiptLineById(db, lineId);
  if (!line) return;
  if (line.match_status !== 'confirmed' && line.match_status !== 'ignored') return;

  if (line.match_status === 'confirmed' && line.pantry_item_id) {
    const receiptLink = `receipt_import:${line.receipt_import_id}`;
    const batches = db.query<{ id: string }>(
      `SELECT id FROM rc_pantry_batches
       WHERE pantry_item_id = ?
         AND receipt_link = ?`,
      [line.pantry_item_id, receiptLink],
    );
    for (const batch of batches) {
      deletePantryBatch(db, batch.id);
    }
    const remaining = db.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM rc_pantry_batches WHERE pantry_item_id = ?`,
      [line.pantry_item_id],
    )[0]?.count ?? 0;
    if (remaining === 0) {
      deletePantryItem(db, line.pantry_item_id);
    }
  }

  db.execute(
    `UPDATE rc_receipt_import_lines
     SET match_status = CASE WHEN match_confidence IS NULL THEN 'unmatched' ELSE 'matched' END,
         pantry_item_id = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [lineId],
  );
  updateReceiptReviewStatus(db, line.receipt_import_id);
}

export function confirmReceiptImportLines(
  db: DatabaseAdapter,
  receiptImportId: string,
  inputs: ReceiptLineConfirmationInput[],
): ReceiptImportConfirmationResult {
  const confirmed = inputs.map((input) => confirmReceiptLineToPantry(db, input));
  const remaining = db.query<{ id: string }>(
    `SELECT id
     FROM rc_receipt_import_lines
     WHERE receipt_import_id = ?
       AND match_status IN ('unmatched', 'matched', 'ambiguous')
     ORDER BY line_index ASC`,
    [receiptImportId],
  ).map((row) => row.id);
  const ignored = db.query<{ id: string }>(
    `SELECT id
     FROM rc_receipt_import_lines
     WHERE receipt_import_id = ?
       AND match_status = 'ignored'
     ORDER BY line_index ASC`,
    [receiptImportId],
  ).map((row) => row.id);

  return {
    receiptImportId,
    confirmedLineIds: confirmed.map((result) => result.lineId),
    createdPantryItemIds: confirmed.map((result) => result.pantryItemId),
    createdBatchIds: confirmed.map((result) => result.batchId),
    ambiguousLineIds: remaining,
    ignoredLineIds: ignored,
  };
}
