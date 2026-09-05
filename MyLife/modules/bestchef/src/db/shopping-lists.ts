import type { DatabaseAdapter } from '@mylife/db';
import type {
  ShoppingList,
  ShoppingListItemRow,
  CreateShoppingListItem,
  ShoppingListSummary,
  GrocerySection,
  RecipeGroceryFlag,
  GroceryFlaggedRecipe,
  ShoppingListFilter,
  ShoppingListMetadata,
  UpdateShoppingListInput,
  DuplicateShoppingListOptions,
} from '../types';
import { getStructuredIngredients } from './crud';
import { categorizeItem } from '../grocery/categorize';
import { parseIngredientText } from '../parser/ingredient-parser';

// ─────────────────────────────────────────────────────────────────────────
// List CRUD
// ─────────────────────────────────────────────────────────────────────────

function normalizeListFilter(filter: ShoppingListFilter | boolean): ShoppingListFilter {
  if (filter === true) return 'active';
  if (filter === false) return 'all';
  return filter;
}

function normalizeMetadataValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function touchShoppingList(db: DatabaseAdapter, listId: string): void {
  db.execute(`UPDATE rc_shopping_lists SET updated_at = datetime('now') WHERE id = ?`, [listId]);
}

interface ShoppingListRow extends Omit<ShoppingList, 'media_uris'> {
  media_uris_json: string | null;
}

function parseShoppingListMediaUris(value: string | null): string[] {
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

function serializeShoppingListMediaUris(uris?: string[] | null): string {
  return JSON.stringify((uris ?? []).filter((entry) => entry.trim().length > 0));
}

function mapShoppingListRow(row: ShoppingListRow): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    store_name: row.store_name,
    event_name: row.event_name,
    event_date: row.event_date,
    is_active: row.is_active,
    archived_at: row.archived_at,
    media_uris: parseShoppingListMediaUris(row.media_uris_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function groceryItemNameForRecipeIngredient(ingredient: ReturnType<typeof getStructuredIngredients>[number]): string {
  const hasParsedAmount = ingredient.quantity_value !== null || Boolean(ingredient.unit);
  if (!hasParsedAmount) return ingredient.name;
  return ingredient.item || ingredient.name;
}

export function createShoppingList(
  db: DatabaseAdapter,
  id: string,
  name: string,
  metadata: ShoppingListMetadata = {},
): void {
  db.execute(
    `INSERT INTO rc_shopping_lists (id, name, store_name, event_name, event_date)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      name,
      normalizeMetadataValue(metadata.store_name),
      normalizeMetadataValue(metadata.event_name),
      normalizeMetadataValue(metadata.event_date),
    ],
  );
}

export function getShoppingLists(
  db: DatabaseAdapter,
  filter: ShoppingListFilter | boolean = 'active',
): ShoppingList[] {
  const normalizedFilter = normalizeListFilter(filter);
  const where = normalizedFilter === 'active'
    ? 'WHERE is_active = 1'
    : normalizedFilter === 'archived'
      ? 'WHERE is_active = 0'
      : '';
  const sql = `SELECT * FROM rc_shopping_lists
    ${where}
    ORDER BY
      CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
      COALESCE(archived_at, updated_at) DESC,
      updated_at DESC
    LIMIT 100`;
  return db.query<ShoppingListRow>(sql).map(mapShoppingListRow);
}

export function getShoppingListById(db: DatabaseAdapter, id: string): ShoppingList | null {
  const rows = db.query<ShoppingListRow>(
    `SELECT * FROM rc_shopping_lists WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapShoppingListRow(rows[0]) : null;
}

export function updateShoppingList(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateShoppingListInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.is_active !== undefined) {
    sets.push('is_active = ?');
    params.push(updates.is_active);
  }
  if (updates.store_name !== undefined) {
    sets.push('store_name = ?');
    params.push(normalizeMetadataValue(updates.store_name));
  }
  if (updates.event_name !== undefined) {
    sets.push('event_name = ?');
    params.push(normalizeMetadataValue(updates.event_name));
  }
  if (updates.event_date !== undefined) {
    sets.push('event_date = ?');
    params.push(normalizeMetadataValue(updates.event_date));
  }
  if (updates.archived_at !== undefined) {
    sets.push('archived_at = ?');
    params.push(updates.archived_at);
  }
  if (updates.media_uris !== undefined) {
    sets.push('media_uris_json = ?');
    params.push(serializeShoppingListMediaUris(updates.media_uris));
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.execute(`UPDATE rc_shopping_lists SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteShoppingList(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_shopping_lists WHERE id = ?`, [id]);
}

export function addShoppingListMediaUri(
  db: DatabaseAdapter,
  listId: string,
  uri: string,
): ShoppingList | null {
  const trimmed = uri.trim();
  if (!trimmed) return getShoppingListById(db, listId);
  const list = getShoppingListById(db, listId);
  if (!list) return null;
  if (list.media_uris.includes(trimmed)) return list;
  updateShoppingList(db, listId, { media_uris: [...list.media_uris, trimmed] });
  return getShoppingListById(db, listId);
}

export function removeShoppingListMediaUri(
  db: DatabaseAdapter,
  listId: string,
  uri: string,
): ShoppingList | null {
  const list = getShoppingListById(db, listId);
  if (!list) return null;
  const next = list.media_uris.filter((entry) => entry !== uri);
  if (next.length === list.media_uris.length) return list;
  updateShoppingList(db, listId, { media_uris: next });
  return getShoppingListById(db, listId);
}

export function archiveShoppingList(db: DatabaseAdapter, id: string): void {
  updateShoppingList(db, id, {
    is_active: 0,
    archived_at: new Date().toISOString(),
  });
}

export function restoreShoppingList(db: DatabaseAdapter, id: string): void {
  updateShoppingList(db, id, {
    is_active: 1,
    archived_at: null,
  });
}

export function completeShoppingList(db: DatabaseAdapter, id: string): void {
  archiveShoppingList(db, id);
}

export function duplicateShoppingList(
  db: DatabaseAdapter,
  sourceListId: string,
  newListId: string,
  generateItemId: () => string,
  options: DuplicateShoppingListOptions = {},
): ShoppingList | null {
  const source = getShoppingListById(db, sourceListId);
  if (!source) return null;

  db.transaction(() => {
    createShoppingList(db, newListId, options.name ?? `${source.name} Copy`, {
      store_name: options.store_name !== undefined ? options.store_name : source.store_name,
      event_name: options.event_name !== undefined ? options.event_name : source.event_name,
      event_date: options.event_date !== undefined ? options.event_date : source.event_date,
    });

    for (const item of getShoppingListItems(db, sourceListId)) {
      const itemId = generateItemId();
      addShoppingListItem(db, itemId, newListId, {
        item: item.item,
        quantity: item.quantity,
        unit: item.unit,
        grocery_section: item.grocery_section,
        recipe_id: item.recipe_id,
        recipe_multiplier: item.recipe_multiplier,
        is_custom: item.is_custom,
        sort_order: item.sort_order,
      });
      if (options.includeCheckedState && item.is_checked === 1) {
        updateShoppingListItem(db, itemId, { is_checked: 1 });
      }
    }
  });

  return getShoppingListById(db, newListId);
}

// ─────────────────────────────────────────────────────────────────────────
// Item CRUD
// ─────────────────────────────────────────────────────────────────────────

export function addShoppingListItem(
  db: DatabaseAdapter,
  id: string,
  listId: string,
  item: CreateShoppingListItem,
): void {
  db.execute(
    `INSERT INTO rc_shopping_list_items (id, list_id, item, quantity, unit, grocery_section, recipe_id, recipe_multiplier, is_custom, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      listId,
      item.item,
      item.quantity ?? null,
      item.unit ?? null,
      item.grocery_section ?? 'other',
      item.recipe_id ?? null,
      item.recipe_multiplier ?? 1,
      item.is_custom ?? 0,
      item.sort_order ?? 0,
    ],
  );
  touchShoppingList(db, listId);
}

export function getShoppingListItems(db: DatabaseAdapter, listId: string): ShoppingListItemRow[] {
  return db.query<ShoppingListItemRow>(
    `SELECT * FROM rc_shopping_list_items WHERE list_id = ? ORDER BY grocery_section, sort_order, item`,
    [listId],
  );
}

export function updateShoppingListItem(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateShoppingListItem & { is_checked: number }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.item !== undefined) { sets.push('item = ?'); params.push(updates.item); }
  if (updates.quantity !== undefined) { sets.push('quantity = ?'); params.push(updates.quantity); }
  if (updates.unit !== undefined) { sets.push('unit = ?'); params.push(updates.unit); }
  if (updates.grocery_section !== undefined) { sets.push('grocery_section = ?'); params.push(updates.grocery_section); }
  if (updates.is_checked !== undefined) { sets.push('is_checked = ?'); params.push(updates.is_checked); }
  if (updates.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(updates.sort_order); }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.execute(`UPDATE rc_shopping_list_items SET ${sets.join(', ')} WHERE id = ?`, params);

  const rows = db.query<{ list_id: string }>(
    `SELECT list_id FROM rc_shopping_list_items WHERE id = ?`,
    [id],
  );
  if (rows[0]?.list_id) touchShoppingList(db, rows[0].list_id);
}

export function deleteShoppingListItem(db: DatabaseAdapter, id: string): void {
  const rows = db.query<{ list_id: string }>(
    `SELECT list_id FROM rc_shopping_list_items WHERE id = ?`,
    [id],
  );
  db.execute(`DELETE FROM rc_shopping_list_items WHERE id = ?`, [id]);
  if (rows[0]?.list_id) touchShoppingList(db, rows[0].list_id);
}

export function toggleItemChecked(db: DatabaseAdapter, id: string): boolean {
  db.execute(
    `UPDATE rc_shopping_list_items SET is_checked = CASE WHEN is_checked = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
  const rows = db.query<{ is_checked: number }>(
    `SELECT is_checked FROM rc_shopping_list_items WHERE id = ?`,
    [id],
  );
  const listRows = db.query<{ list_id: string }>(
    `SELECT list_id FROM rc_shopping_list_items WHERE id = ?`,
    [id],
  );
  if (listRows[0]?.list_id) touchShoppingList(db, listRows[0].list_id);
  return rows[0]?.is_checked === 1;
}

export function uncheckAllItems(db: DatabaseAdapter, listId: string): void {
  db.execute(
    `UPDATE rc_shopping_list_items SET is_checked = 0, updated_at = datetime('now') WHERE list_id = ?`,
    [listId],
  );
  touchShoppingList(db, listId);
}

// ─────────────────────────────────────────────────────────────────────────
// Recipe integration
// ─────────────────────────────────────────────────────────────────────────

// Transaction-free core: callers own the transaction boundary. The shipped
// adapters (expo-sqlite, sql.js) issue a raw BEGIN that cannot nest, so
// addFlaggedRecipesToShoppingList must reuse this INSIDE its own transaction
// instead of calling addRecipeToShoppingList (BEGIN-inside-BEGIN throws).
function applyRecipeToShoppingList(
  db: DatabaseAdapter,
  listId: string,
  recipeId: string,
  multiplier: number,
  generateId: () => string,
): void {
  {
    const ingredients = getStructuredIngredients(db, recipeId);
    const maxRows = db.query<{ mx: number | null }>(
      `SELECT MAX(sort_order) as mx FROM rc_shopping_list_items WHERE list_id = ?`,
      [listId],
    );
    let sortOrder = (maxRows[0]?.mx ?? -1) + 1;

    for (const ing of ingredients) {
      const scaledQty = ing.quantity_value !== null ? ing.quantity_value * multiplier : null;
      const itemName = groceryItemNameForRecipeIngredient(ing);
      const section = categorizeItem(itemName);

      addShoppingListItem(db, generateId(), listId, {
        item: itemName,
        quantity: scaledQty,
        unit: ing.unit,
        grocery_section: section,
        recipe_id: recipeId,
        recipe_multiplier: multiplier,
        is_custom: 0,
        sort_order: sortOrder++,
      });
    }

    touchShoppingList(db, listId);
  }
}

/**
 * Add all ingredients from a recipe to a shopping list, scaled by multiplier.
 * Each ingredient is categorized into a grocery section automatically.
 */
export function addRecipeToShoppingList(
  db: DatabaseAdapter,
  listId: string,
  recipeId: string,
  multiplier: number,
  generateId: () => string,
): void {
  db.transaction(() => {
    applyRecipeToShoppingList(db, listId, recipeId, multiplier, generateId);
  });
}

/** Remove all items sourced from a specific recipe. */
export function removeRecipeFromShoppingList(
  db: DatabaseAdapter,
  listId: string,
  recipeId: string,
): void {
  db.execute(
    `DELETE FROM rc_shopping_list_items WHERE list_id = ? AND recipe_id = ?`,
    [listId, recipeId],
  );
  touchShoppingList(db, listId);
}

// ─────────────────────────────────────────────────────────────────────────
// Custom items
// ─────────────────────────────────────────────────────────────────────────

/**
 * Add a custom typed item. Parses the text with the ingredient NLP parser
 * to extract quantity/unit, then auto-categorizes into a grocery section.
 */
export function addCustomItem(
  db: DatabaseAdapter,
  id: string,
  listId: string,
  itemText: string,
): void {
  const parsed = parseIngredientText(itemText);
  const section: GrocerySection = categorizeItem(parsed.item);

  const maxRows = db.query<{ mx: number | null }>(
    `SELECT MAX(sort_order) as mx FROM rc_shopping_list_items WHERE list_id = ?`,
    [listId],
  );

  addShoppingListItem(db, id, listId, {
    item: parsed.item,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grocery_section: section,
    is_custom: 1,
    sort_order: (maxRows[0]?.mx ?? -1) + 1,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Pantry sync
// ─────────────────────────────────────────────────────────────────────────

/**
 * Bulk-add checked (purchased) shopping list items to the pantry.
 * Returns the number of items added.
 */
export function addCheckedItemsToPantry(
  db: DatabaseAdapter,
  listId: string,
  generateId: () => string,
): number {
  const checked = db.query<ShoppingListItemRow>(
    `SELECT * FROM rc_shopping_list_items WHERE list_id = ? AND is_checked = 1`,
    [listId],
  );

  let count = 0;
  for (const item of checked) {
    // Skip items already in pantry with the same name
    const existing = db.query<{ id: string }>(
      `SELECT id FROM rc_pantry_items WHERE LOWER(name) = LOWER(?)`,
      [item.item],
    );
    if (existing.length > 0) continue;

    const pantryItemId = generateId();
    db.execute(
      `INSERT INTO rc_pantry_items (id, name, quantity, unit, storage_location, grocery_section)
       VALUES (?, ?, ?, ?, 'pantry', ?)`,
      [pantryItemId, item.item, item.quantity, item.unit, item.grocery_section],
    );
    db.execute(
      `INSERT INTO rc_pantry_batches (
         id,
         pantry_item_id,
         quantity,
         unit,
         source,
         photos_json
       ) VALUES (?, ?, ?, ?, 'grocery_list', '[]')`,
      [generateId(), pantryItemId, item.quantity, item.unit],
    );
    count++;
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

export function getShoppingListSummary(db: DatabaseAdapter, listId: string): ShoppingListSummary | null {
  const list = getShoppingListById(db, listId);
  if (!list) return null;

  const rows = db.query<{ total: number; checked: number; recipes: number; custom: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) as checked,
       COUNT(DISTINCT recipe_id) as recipes,
       SUM(CASE WHEN is_custom = 1 THEN 1 ELSE 0 END) as custom
     FROM rc_shopping_list_items WHERE list_id = ?`,
    [listId],
  );
  const totals = rows[0];

  return {
    list,
    totalItems: totals?.total ?? 0,
    checkedItems: totals?.checked ?? 0,
    recipeCount: totals?.recipes ?? 0,
    customItemCount: totals?.custom ?? 0,
  };
}

/** Get distinct recipes added to a shopping list with their multipliers. */
export function getRecipesInShoppingList(
  db: DatabaseAdapter,
  listId: string,
): Array<{ recipe_id: string; recipe_title: string; multiplier: number }> {
  return db.query<{ recipe_id: string; recipe_title: string; multiplier: number }>(
    `SELECT DISTINCT sli.recipe_id, r.title as recipe_title, sli.recipe_multiplier as multiplier
     FROM rc_shopping_list_items sli
     JOIN rc_recipes r ON r.id = sli.recipe_id
     WHERE sli.list_id = ? AND sli.recipe_id IS NOT NULL
     ORDER BY r.title`,
    [listId],
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Recipe grocery flags
// ─────────────────────────────────────────────────────────────────────────

export function setRecipeGroceryFlag(
  db: DatabaseAdapter,
  recipeId: string,
  multiplier = 1,
): RecipeGroceryFlag | null {
  const recipeRows = db.query<{ id: string }>(
    `SELECT id FROM rc_recipes WHERE id = ? LIMIT 1`,
    [recipeId],
  );
  if (recipeRows.length === 0) return null;

  const now = new Date().toISOString();
  const normalizedMultiplier = Math.max(0.25, multiplier);
  db.execute(
    `INSERT INTO rc_recipe_grocery_flags (recipe_id, default_multiplier, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(recipe_id) DO UPDATE SET
       default_multiplier = excluded.default_multiplier,
       updated_at = excluded.updated_at`,
    [recipeId, normalizedMultiplier, now, now],
  );

  const rows = db.query<RecipeGroceryFlag>(
    `SELECT recipe_id, default_multiplier, created_at, updated_at
     FROM rc_recipe_grocery_flags
     WHERE recipe_id = ?
     LIMIT 1`,
    [recipeId],
  );
  return rows[0] ?? null;
}

export function removeRecipeGroceryFlag(db: DatabaseAdapter, recipeId: string): boolean {
  db.execute(`DELETE FROM rc_recipe_grocery_flags WHERE recipe_id = ?`, [recipeId]);
  return !isRecipeFlaggedForGrocery(db, recipeId);
}

export function isRecipeFlaggedForGrocery(db: DatabaseAdapter, recipeId: string): boolean {
  const rows = db.query<{ recipe_id: string }>(
    `SELECT recipe_id FROM rc_recipe_grocery_flags WHERE recipe_id = ? LIMIT 1`,
    [recipeId],
  );
  return rows.length > 0;
}

export function getGroceryFlaggedRecipes(db: DatabaseAdapter): GroceryFlaggedRecipe[] {
  return db.query<GroceryFlaggedRecipe>(
    `SELECT
       f.recipe_id,
       f.default_multiplier,
       f.created_at,
       f.updated_at,
       r.title AS recipe_title,
       r.image_uri AS recipe_image_uri,
       COUNT(i.id) AS ingredient_count
     FROM rc_recipe_grocery_flags f
     JOIN rc_recipes r ON r.id = f.recipe_id
     LEFT JOIN rc_ingredients i ON i.recipe_id = f.recipe_id
     GROUP BY f.recipe_id, f.default_multiplier, f.created_at, f.updated_at, r.title, r.image_uri
     ORDER BY f.updated_at DESC`,
  );
}

export function addFlaggedRecipesToShoppingList(
  db: DatabaseAdapter,
  listId: string,
  generateId: () => string,
): number {
  const list = getShoppingListById(db, listId);
  if (!list) return 0;

  const flagged = getGroceryFlaggedRecipes(db).filter((recipe) => recipe.ingredient_count > 0);
  if (flagged.length === 0) return 0;

  db.transaction(() => {
    for (const recipe of flagged) {
      removeRecipeFromShoppingList(db, listId, recipe.recipe_id);
      // Transaction-free core: a nested addRecipeToShoppingList call would
      // BEGIN inside this BEGIN and throw on the shipped adapters.
      applyRecipeToShoppingList(
        db,
        listId,
        recipe.recipe_id,
        recipe.default_multiplier,
        generateId,
      );
    }
  });

  return flagged.length;
}
