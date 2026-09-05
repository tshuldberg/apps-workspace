import type { DatabaseAdapter } from '@mylife/db';
import { serializeClosetExport } from '../engine/export';
import { calculateAverageWearsBetweenWashes } from '../engine/laundry';
import { generatePackingSuggestions, inferPackingSeason } from '../engine/packing';
import {
  ClosetDashboardSchema,
  ClosetSettingSchema,
  ClothingItemFilterSchema,
  ClothingItemSchema,
  ClosetTagSchema,
  AddPackingListCustomItemInputSchema,
  CreateClothingItemInputSchema,
  CreateOutfitInputSchema,
  CreatePackingListInputSchema,
  CreateWearLogInputSchema,
  ExportClosetDataInputSchema,
  MarkLaundryItemsCleanInputSchema,
  OutfitSchema,
  PackingListItemSchema,
  PackingListSchema,
  UpdateClothingItemInputSchema,
  WearLogSchema,
  LaundryEventSchema,
  type AddPackingListCustomItemInput,
  type ClosetDashboard,
  type ClosetExportBundle,
  type ClosetSetting,
  type ClosetTag,
  type ClothingItem,
  type ClothingItemFilter,
  type CreateClothingItemInput,
  type CreateOutfitInput,
  type CreatePackingListInput,
  type CreateWearLogInput,
  type ExportClosetDataInput,
  type LaundryEvent,
  type MarkLaundryItemsCleanInput,
  type Outfit,
  type PackingList,
  type PackingListItem,
  type UpdateClothingItemInput,
  type WearLog,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function parseBoolean(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
}

function parseNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function getItemTags(db: DatabaseAdapter, itemId: string): string[] {
  return db.query<{ name: string }>(
    `SELECT t.name
     FROM cl_tags t
     INNER JOIN cl_item_tags it ON it.tag_id = t.id
     WHERE it.item_id = ?
     ORDER BY t.name ASC`,
    [itemId],
  ).map((row) => row.name);
}

function batchGetItemTags(db: DatabaseAdapter, itemIds: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (itemIds.length === 0) return result;
  for (const id of itemIds) result.set(id, []);
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = db.query<{ item_id: string; name: string }>(
    `SELECT it.item_id, t.name
     FROM cl_tags t
     INNER JOIN cl_item_tags it ON it.tag_id = t.id
     WHERE it.item_id IN (${placeholders})
     ORDER BY t.name ASC`,
    itemIds,
  );
  for (const row of rows) {
    result.get(row.item_id)?.push(row.name);
  }
  return result;
}

function syncItemTags(db: DatabaseAdapter, itemId: string, tags: string[], createdAt: string): void {
  db.execute(`DELETE FROM cl_item_tags WHERE item_id = ?`, [itemId]);

  for (const tagName of [...new Set(tags.map(normalizeTagName).filter(Boolean))]) {
    const existing = db.query<{ id: string }>(`SELECT id FROM cl_tags WHERE name = ?`, [tagName])[0];
    const tagId = existing?.id ?? createId('cl_tag');

    if (!existing) {
      db.execute(
        `INSERT INTO cl_tags (id, name, created_at) VALUES (?, ?, ?)`,
        [tagId, tagName, createdAt],
      );
    }

    db.execute(
      `INSERT OR IGNORE INTO cl_item_tags (id, item_id, tag_id, created_at) VALUES (?, ?, ?, ?)`,
      [createId('cl_item_tag'), itemId, tagId, createdAt],
    );
  }
}

function getOutfitItemIds(db: DatabaseAdapter, outfitId: string): string[] {
  return db.query<{ item_id: string }>(
    `SELECT item_id
     FROM cl_outfit_items
     WHERE outfit_id = ?
     ORDER BY created_at ASC`,
    [outfitId],
  ).map((row) => row.item_id);
}

function getWearLogItemIds(db: DatabaseAdapter, wearLogId: string): string[] {
  return db.query<{ item_id: string }>(
    `SELECT item_id
     FROM cl_wear_log_items
     WHERE wear_log_id = ?
     ORDER BY created_at ASC`,
    [wearLogId],
  ).map((row) => row.item_id);
}

function getPackingListItems(db: DatabaseAdapter, packingListId: string): PackingListItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT *
       FROM cl_packing_list_items
       WHERE packing_list_id = ?
       ORDER BY category_group ASC, sort_order ASC, created_at ASC`,
      [packingListId],
    )
    .map(rowToPackingListItem);
}

function rowToItem(row: Record<string, unknown>, tags: string[] = []): ClothingItem {
  return ClothingItemSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    color: row.color ?? null,
    brand: row.brand ?? null,
    purchasePriceCents: row.purchase_price_cents ?? null,
    purchaseDate: row.purchase_date ?? null,
    imageUri: row.image_uri ?? null,
    seasons: parseStringArray(row.seasons_json),
    occasions: parseStringArray(row.occasions_json),
    condition: row.condition,
    status: row.status,
    laundryStatus: row.laundry_status,
    careInstructions: row.care_instructions ?? 'machine_wash',
    autoDirtyOnWear: parseBoolean(row.auto_dirty_on_wear ?? 1),
    wearsSinceWash: parseNumber(row.wears_since_wash),
    timesWorn: parseNumber(row.times_worn),
    lastWornDate: row.last_worn_date ?? null,
    notes: row.notes ?? null,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToOutfit(db: DatabaseAdapter, row: Record<string, unknown>): Outfit {
  return OutfitSchema.parse({
    id: row.id,
    name: row.name,
    itemIds: getOutfitItemIds(db, row.id as string),
    occasion: row.occasion ?? null,
    season: row.season ?? null,
    imageUri: row.image_uri ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToWearLog(db: DatabaseAdapter, row: Record<string, unknown>): WearLog {
  return WearLogSchema.parse({
    id: row.id,
    date: row.date,
    outfitId: row.outfit_id ?? null,
    itemIds: getWearLogItemIds(db, row.id as string),
    notes: row.notes ?? null,
    createdAt: row.created_at,
  });
}

function rowToLaundryEvent(row: Record<string, unknown>): LaundryEvent {
  return LaundryEventSchema.parse({
    id: row.id,
    clothingItemId: row.clothing_item_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    wearsBeforeWash: parseNumber(row.wears_before_wash),
    createdAt: row.created_at,
  });
}

function rowToPackingListItem(row: Record<string, unknown>): PackingListItem {
  return PackingListItemSchema.parse({
    id: row.id,
    packingListId: row.packing_list_id,
    clothingItemId: row.clothing_item_id ?? null,
    customName: row.custom_name ?? null,
    categoryGroup: row.category_group,
    quantity: parseNumber(row.quantity, 1),
    isPacked: parseBoolean(row.is_packed),
    sortOrder: parseNumber(row.sort_order),
    createdAt: row.created_at,
  });
}

function rowToPackingList(db: DatabaseAdapter, row: Record<string, unknown>): PackingList {
  return PackingListSchema.parse({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    occasions: parseStringArray(row.occasions_json),
    season: row.season,
    mode: row.mode,
    items: getPackingListItems(db, row.id as string),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToTag(row: Record<string, unknown>): ClosetTag {
  return ClosetTagSchema.parse({
    id: row.id,
    name: row.name,
    usageCount: parseNumber(row.usage_count),
    createdAt: row.created_at,
  });
}

function getLaundryAutoDirtyEnabled(db: DatabaseAdapter): boolean {
  return getClosetSetting(db, 'laundryAutoDirty') !== '0';
}

function getLaundryWearThreshold(db: DatabaseAdapter): number {
  return Math.max(1, Number(getClosetSetting(db, 'laundryWearsBeforeDirty') ?? '1'));
}

export function createClothingItem(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateClothingItemInput,
): ClothingItem {
  const input = CreateClothingItemInputSchema.parse(rawInput);
  const now = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO cl_items (
        id, name, category, color, brand, purchase_price_cents, purchase_date, image_uri,
        seasons_json, occasions_json, condition, status, laundry_status, care_instructions,
        auto_dirty_on_wear, wears_since_wash, times_worn, last_worn_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?, ?)`,
      [
        id,
        input.name.trim(),
        input.category,
        input.color,
        input.brand,
        input.purchasePriceCents,
        input.purchaseDate,
        input.imageUri,
        JSON.stringify(input.seasons),
        JSON.stringify(input.occasions),
        input.condition,
        input.status,
        input.laundryStatus,
        input.careInstructions,
        input.autoDirtyOnWear ? 1 : 0,
        input.notes,
        now,
        now,
      ],
    );

    syncItemTags(db, id, input.tags, now);
  });

  return getClothingItemById(db, id)!;
}

export function updateClothingItem(
  db: DatabaseAdapter,
  itemId: string,
  rawInput: UpdateClothingItemInput,
): ClothingItem | null {
  const existing = getClothingItemById(db, itemId);
  if (!existing) {
    return null;
  }

  const input = UpdateClothingItemInputSchema.parse(rawInput);
  const now = nowIso();
  const next = {
    name: input.name?.trim() ?? existing.name,
    category: input.category ?? existing.category,
    color: input.color === undefined ? existing.color : input.color,
    brand: input.brand === undefined ? existing.brand : input.brand,
    purchasePriceCents:
      input.purchasePriceCents === undefined ? existing.purchasePriceCents : input.purchasePriceCents,
    purchaseDate: input.purchaseDate === undefined ? existing.purchaseDate : input.purchaseDate,
    imageUri: input.imageUri === undefined ? existing.imageUri : input.imageUri,
    seasons: input.seasons ?? existing.seasons,
    occasions: input.occasions ?? existing.occasions,
    condition: input.condition ?? existing.condition,
    status: input.status ?? existing.status,
    laundryStatus: input.laundryStatus ?? existing.laundryStatus,
    careInstructions: input.careInstructions ?? existing.careInstructions,
    autoDirtyOnWear: input.autoDirtyOnWear ?? existing.autoDirtyOnWear,
    wearsSinceWash: input.wearsSinceWash ?? existing.wearsSinceWash,
    timesWorn: input.timesWorn ?? existing.timesWorn,
    lastWornDate: input.lastWornDate === undefined ? existing.lastWornDate : input.lastWornDate,
    notes: input.notes === undefined ? existing.notes : input.notes,
    tags: input.tags ?? existing.tags,
  };

  db.transaction(() => {
    db.execute(
      `UPDATE cl_items
       SET name = ?, category = ?, color = ?, brand = ?, purchase_price_cents = ?, purchase_date = ?,
           image_uri = ?, seasons_json = ?, occasions_json = ?, condition = ?, status = ?,
           laundry_status = ?, care_instructions = ?, auto_dirty_on_wear = ?, wears_since_wash = ?,
           times_worn = ?, last_worn_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.name,
        next.category,
        next.color,
        next.brand,
        next.purchasePriceCents,
        next.purchaseDate,
        next.imageUri,
        JSON.stringify(next.seasons),
        JSON.stringify(next.occasions),
        next.condition,
        next.status,
        next.laundryStatus,
        next.careInstructions,
        next.autoDirtyOnWear ? 1 : 0,
        next.wearsSinceWash,
        next.timesWorn,
        next.lastWornDate,
        next.notes,
        now,
        itemId,
      ],
    );
    syncItemTags(db, itemId, next.tags, now);
  });

  return getClothingItemById(db, itemId);
}

export function getClothingItemById(db: DatabaseAdapter, itemId: string): ClothingItem | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM cl_items WHERE id = ?`, [itemId])[0];
  return row ? rowToItem(row, getItemTags(db, itemId)) : null;
}

export function listClothingItems(
  db: DatabaseAdapter,
  rawFilter?: ClothingItemFilter,
): ClothingItem[] {
  const filter = ClothingItemFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.category) {
    conditions.push(`i.category = ?`);
    params.push(filter.category);
  }
  if (filter.status) {
    conditions.push(`i.status = ?`);
    params.push(filter.status);
  }
  if (filter.laundryStatus) {
    conditions.push(`i.laundry_status = ?`);
    params.push(filter.laundryStatus);
  }
  if (filter.tag) {
    conditions.push(
      `i.id IN (
        SELECT it.item_id
        FROM cl_item_tags it
        INNER JOIN cl_tags t ON t.id = it.tag_id
        WHERE t.name = ?
      )`,
    );
    params.push(normalizeTagName(filter.tag));
  }
  if (filter.search?.trim()) {
    conditions.push(
      `(LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.brand, '')) LIKE ? OR LOWER(COALESCE(i.color, '')) LIKE ?)`,
    );
    const term = `%${filter.search.trim().toLowerCase()}%`;
    params.push(term, term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT i.*
     FROM cl_items i
     ${where}
     ORDER BY i.created_at DESC
     LIMIT ?`,
    [...params, filter.limit],
  );
  const tagMap = batchGetItemTags(db, rows.map((row) => row.id as string));
  return rows.map((row) => rowToItem(row, tagMap.get(row.id as string) ?? []));
}

export function listDirtyClothingItems(db: DatabaseAdapter): ClothingItem[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM cl_items
     WHERE status = 'active' AND laundry_status = 'dirty'
     ORDER BY care_instructions ASC, wears_since_wash DESC, times_worn DESC, updated_at DESC
     LIMIT 500`,
  );
  const tagMap = batchGetItemTags(db, rows.map((row) => row.id as string));
  return rows.map((row) => rowToItem(row, tagMap.get(row.id as string) ?? []));
}

export function listClosetTags(db: DatabaseAdapter): ClosetTag[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT t.id, t.name, t.created_at, COUNT(it.item_id) AS usage_count
       FROM cl_tags t
       LEFT JOIN cl_item_tags it ON it.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name ASC`,
    )
    .map(rowToTag);
}

export function createOutfit(db: DatabaseAdapter, id: string, rawInput: CreateOutfitInput): Outfit {
  const input = CreateOutfitInputSchema.parse(rawInput);
  const now = nowIso();
  const itemIds = [...new Set(input.itemIds)];

  db.transaction(() => {
    db.execute(
      `INSERT INTO cl_outfits (id, name, occasion, season, image_uri, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name.trim(), input.occasion, input.season, input.imageUri, input.notes, now, now],
    );

    for (const itemId of itemIds) {
      db.execute(
        `INSERT OR IGNORE INTO cl_outfit_items (id, outfit_id, item_id, created_at) VALUES (?, ?, ?, ?)`,
        [createId('cl_outfit_item'), id, itemId, now],
      );
    }
  });

  return getOutfitById(db, id)!;
}

export function getOutfitById(db: DatabaseAdapter, outfitId: string): Outfit | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM cl_outfits WHERE id = ?`, [outfitId])[0];
  return row ? rowToOutfit(db, row) : null;
}

export function listOutfits(db: DatabaseAdapter, limit: number = 200): Outfit[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cl_outfits ORDER BY created_at DESC LIMIT ?`,
      [limit],
    )
    .map((row) => rowToOutfit(db, row));
}

export function logWearEvent(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateWearLogInput,
): WearLog {
  const input = CreateWearLogInputSchema.parse(rawInput);
  const now = nowIso();
  const date = input.date ?? dateOnly(now);
  const outfitItemIds = input.outfitId ? getOutfitItemIds(db, input.outfitId) : [];
  const itemIds = [...new Set([...input.itemIds, ...outfitItemIds])];
  const autoDirtyEnabled = getLaundryAutoDirtyEnabled(db);
  const wearThreshold = getLaundryWearThreshold(db);

  db.transaction(() => {
    db.execute(
      `INSERT INTO cl_wear_logs (id, date, outfit_id, notes, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, date, input.outfitId, input.notes, now],
    );

    for (const itemId of itemIds) {
      db.execute(
        `INSERT OR IGNORE INTO cl_wear_log_items (id, wear_log_id, item_id, created_at) VALUES (?, ?, ?, ?)`,
        [createId('cl_wear_log_item'), id, itemId, now],
      );

      const row = db.query<Record<string, unknown>>(
        `SELECT laundry_status, auto_dirty_on_wear, wears_since_wash, times_worn FROM cl_items WHERE id = ?`,
        [itemId],
      )[0];
      if (!row) {
        continue;
      }

      const currentWearsSinceWash = parseNumber(row.wears_since_wash);
      const currentTimesWorn = parseNumber(row.times_worn);
      const currentLaundryStatus = row.laundry_status as string;
      const itemAutoDirty = parseBoolean(row.auto_dirty_on_wear ?? 1);

      const nextWearsSinceWash = currentWearsSinceWash + 1;
      const shouldDirty =
        currentLaundryStatus === 'dirty'
        || (autoDirtyEnabled && itemAutoDirty && nextWearsSinceWash >= wearThreshold);

      db.execute(
        `UPDATE cl_items
         SET times_worn = ?, last_worn_date = ?, laundry_status = ?, wears_since_wash = ?, updated_at = ?
         WHERE id = ?`,
        [
          currentTimesWorn + 1,
          date,
          shouldDirty ? 'dirty' : currentLaundryStatus,
          nextWearsSinceWash,
          now,
          itemId,
        ],
      );
    }
  });

  return getWearLogById(db, id)!;
}

export function getWearLogById(db: DatabaseAdapter, wearLogId: string): WearLog | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM cl_wear_logs WHERE id = ?`, [wearLogId])[0];
  return row ? rowToWearLog(db, row) : null;
}

export function listWearLogs(
  db: DatabaseAdapter,
  options?: { startDate?: string; endDate?: string; limit?: number },
): WearLog[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.startDate) {
    conditions.push(`date >= ?`);
    params.push(options.startDate);
  }
  if (options?.endDate) {
    conditions.push(`date <= ?`);
    params.push(options.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT *
       FROM cl_wear_logs
       ${where}
       ORDER BY date DESC, created_at DESC
       LIMIT ?`,
      [...params, options?.limit ?? 60],
    )
    .map((row) => rowToWearLog(db, row));
}

export function listLaundryEventsForItem(db: DatabaseAdapter, itemId: string, limit: number = 200): LaundryEvent[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT *
       FROM cl_laundry_events
       WHERE clothing_item_id = ?
       ORDER BY event_date DESC, created_at DESC
       LIMIT ?`,
      [itemId, limit],
    )
    .map(rowToLaundryEvent);
}

export function markLaundryItemsClean(
  db: DatabaseAdapter,
  rawInput: MarkLaundryItemsCleanInput,
): number {
  const input = MarkLaundryItemsCleanInputSchema.parse(rawInput);
  const now = nowIso();
  const eventDate = input.eventDate ?? dateOnly(now);
  const itemIds = [...new Set(input.itemIds)];
  let updatedCount = 0;

  db.transaction(() => {
    for (const itemId of itemIds) {
      const row = db.query<Record<string, unknown>>(
        `SELECT wears_since_wash FROM cl_items WHERE id = ?`,
        [itemId],
      )[0];
      if (!row) {
        continue;
      }

      db.execute(
        `INSERT INTO cl_laundry_events (
          id, clothing_item_id, event_type, event_date, wears_before_wash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [createId('cl_laundry'), itemId, input.eventType, eventDate, parseNumber(row.wears_since_wash), now],
      );

      db.execute(
        `UPDATE cl_items
         SET laundry_status = 'clean', wears_since_wash = 0, updated_at = ?
         WHERE id = ?`,
        [now, itemId],
      );

      updatedCount += 1;
    }
  });

  return updatedCount;
}

export function getAverageWearsBetweenWashes(db: DatabaseAdapter, itemId: string): number | null {
  return calculateAverageWearsBetweenWashes(listLaundryEventsForItem(db, itemId));
}

export function createPackingList(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreatePackingListInput,
): PackingList {
  const input = CreatePackingListInputSchema.parse(rawInput);
  const now = nowIso();
  const season = inferPackingSeason(input.startDate);
  const items = listClothingItems(db, { status: 'active', limit: 5000 });
  const suggestions = generatePackingSuggestions(items, input);

  db.transaction(() => {
    db.execute(
      `INSERT INTO cl_packing_lists (
        id, name, start_date, end_date, occasions_json, season, mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name.trim(),
        input.startDate,
        input.endDate,
        JSON.stringify(input.occasions),
        season,
        input.mode,
        now,
        now,
      ],
    );

    for (const suggestion of suggestions) {
      db.execute(
        `INSERT INTO cl_packing_list_items (
          id, packing_list_id, clothing_item_id, custom_name, category_group, quantity, is_packed, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          createId('cl_packing_item'),
          id,
          suggestion.clothingItemId,
          suggestion.customName,
          suggestion.categoryGroup,
          suggestion.quantity,
          suggestion.sortOrder,
          now,
        ],
      );
    }
  });

  return getPackingListById(db, id)!;
}

export function getPackingListById(db: DatabaseAdapter, packingListId: string): PackingList | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_packing_lists WHERE id = ?`,
    [packingListId],
  )[0];
  return row ? rowToPackingList(db, row) : null;
}

export function listPackingLists(db: DatabaseAdapter, limit: number = 100): PackingList[] {
  const today = dateOnly(nowIso());
  return db
    .query<Record<string, unknown>>(
      `SELECT *
       FROM cl_packing_lists
       ORDER BY CASE WHEN end_date >= ? THEN 0 ELSE 1 END ASC,
         CASE WHEN end_date >= ? THEN start_date END ASC,
         CASE WHEN end_date < ? THEN start_date END DESC
       LIMIT ?`,
      [today, today, today, limit],
    )
    .map((row) => rowToPackingList(db, row));
}

export function togglePackingListItemPacked(
  db: DatabaseAdapter,
  packingListItemId: string,
): PackingListItem | null {
  const existing = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_packing_list_items WHERE id = ?`,
    [packingListItemId],
  )[0];
  if (!existing) {
    return null;
  }

  const next = parseBoolean(existing.is_packed) ? 0 : 1;
  db.execute(
    `UPDATE cl_packing_list_items SET is_packed = ? WHERE id = ?`,
    [next, packingListItemId],
  );

  const updated = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_packing_list_items WHERE id = ?`,
    [packingListItemId],
  )[0];
  return updated ? rowToPackingListItem(updated) : null;
}

export function addPackingListCustomItem(
  db: DatabaseAdapter,
  packingListId: string,
  rawInput: AddPackingListCustomItemInput,
): PackingListItem | null {
  const input = AddPackingListCustomItemInputSchema.parse(rawInput);
  const existingList = getPackingListById(db, packingListId);
  if (!existingList) {
    return null;
  }

  const nextSortOrder =
    db.query<{ max_sort: number | null }>(
      `SELECT MAX(sort_order) AS max_sort FROM cl_packing_list_items WHERE packing_list_id = ?`,
      [packingListId],
    )[0]?.max_sort ?? -1;

  const id = createId('cl_packing_item');
  const now = nowIso();
  db.execute(
    `INSERT INTO cl_packing_list_items (
      id, packing_list_id, clothing_item_id, custom_name, category_group, quantity, is_packed, sort_order, created_at
    ) VALUES (?, ?, NULL, ?, ?, ?, 0, ?, ?)`,
    [id, packingListId, input.customName, input.categoryGroup, input.quantity, nextSortOrder + 1, now],
  );

  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_packing_list_items WHERE id = ?`,
    [id],
  )[0];
  return row ? rowToPackingListItem(row) : null;
}

export function getClosetSetting(db: DatabaseAdapter, key: string): string | null {
  const row = db.query<{ value: string }>(`SELECT value FROM cl_settings WHERE key = ?`, [key])[0];
  return row?.value ?? null;
}

export function setClosetSetting(db: DatabaseAdapter, key: string, value: string): ClosetSetting {
  db.execute(
    `INSERT INTO cl_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
  return ClosetSettingSchema.parse({ key, value });
}

export function listClosetSettings(db: DatabaseAdapter): ClosetSetting[] {
  return db
    .query<Record<string, unknown>>(`SELECT key, value FROM cl_settings ORDER BY key ASC`)
    .map((row) => ClosetSettingSchema.parse({ key: row.key, value: row.value }));
}

export function listDonationCandidates(
  db: DatabaseAdapter,
  referenceDate = dateOnly(nowIso()),
  limit: number = 500,
): ClothingItem[] {
  const thresholdDays = Number(getClosetSetting(db, 'donationThresholdDays') ?? '365');
  const cutoff = new Date(`${referenceDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - thresholdDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM cl_items
     WHERE status = 'active'
       AND (last_worn_date IS NULL OR last_worn_date < ?)
     ORDER BY COALESCE(last_worn_date, '0000-00-00') ASC, created_at ASC
     LIMIT ?`,
    [cutoffDate, limit],
  );
  const tagMap = batchGetItemTags(db, rows.map((row) => row.id as string));
  return rows.map((row) => rowToItem(row, tagMap.get(row.id as string) ?? []));
}

function countDonationCandidates(
  db: DatabaseAdapter,
  referenceDate = dateOnly(nowIso()),
): number {
  const thresholdDays = Number(getClosetSetting(db, 'donationThresholdDays') ?? '365');
  const cutoff = new Date(`${referenceDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - thresholdDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM cl_items
     WHERE status = 'active'
       AND (last_worn_date IS NULL OR last_worn_date < ?)`,
    [cutoffDate],
  )[0]?.count ?? 0;
}

export function exportClosetData(
  db: DatabaseAdapter,
  rawInput?: ExportClosetDataInput,
): ClosetExportBundle {
  const input = ExportClosetDataInputSchema.parse(rawInput ?? {});
  const bundle = {
    exportVersion: '1.0' as const,
    exportedAt: nowIso(),
    module: 'closet' as const,
    items: input.includeItems ? listClothingItems(db, { limit: 5000 }) : [],
    outfits: input.includeOutfits ? listOutfits(db) : [],
    wearLogs: input.includeWearLogs ? listWearLogs(db, { limit: 5000 }) : [],
    laundryEvents: input.includeLaundryEvents
      ? db.query<Record<string, unknown>>(
        `SELECT * FROM cl_laundry_events ORDER BY event_date DESC, created_at DESC`,
      ).map(rowToLaundryEvent)
      : [],
    packingLists: input.includePackingLists ? listPackingLists(db) : [],
    settings: input.includeSettings ? listClosetSettings(db) : [],
  };

  return {
    ...bundle,
    items: [...bundle.items].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

export function getClosetDashboard(
  db: DatabaseAdapter,
  referenceDate = dateOnly(nowIso()),
): ClosetDashboard {
  const activeStats = db.query<{ count: number; total_value: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(purchase_price_cents), 0) as total_value
     FROM cl_items WHERE status = 'active'`,
  )[0] ?? { count: 0, total_value: 0 };
  const totalOutfits = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM cl_outfits`)[0]?.count ?? 0;
  const windowStart = new Date(`${referenceDate}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);
  const itemsWorn30Days =
    db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT item_id) as count
       FROM cl_wear_log_items wli
       INNER JOIN cl_wear_logs wl ON wl.id = wli.wear_log_id
       WHERE wl.date >= ? AND wl.date <= ?`,
      [windowStart.toISOString().slice(0, 10), referenceDate],
    )[0]?.count ?? 0;
  const donationCandidateCount = countDonationCandidates(db, referenceDate);

  return ClosetDashboardSchema.parse({
    totalItems: activeStats.count,
    totalOutfits,
    wardrobeValueCents: activeStats.total_value,
    itemsWorn30Days,
    donationCandidateCount,
  });
}

export { serializeClosetExport };
