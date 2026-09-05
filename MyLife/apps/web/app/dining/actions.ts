'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createRestaurant,
  addTagToRestaurant,
  listRestaurants,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listTags,
  getTagsForRestaurant,
  createTag,
  createWatchlistEntry,
  listWatchlistEntries,
  deleteWatchlistEntry,
  fulfillWatchlistEntry,
  expireStaleEntries,
  createVisit,
  getVisit,
  updateVisit,
  deleteVisit,
  listVisitsByRestaurant,
  listVisitsChronological,
  getVisitStats,
  createCompanion,
  createDish,
  getDish,
  updateDish,
  deleteDish,
  listDishesByVisit,
  listDishesByRestaurant,
  listTopDishes,
  checkAllergens,
  createWine,
  getWine,
  updateWine,
  deleteWine,
  listWinesByVisit,
  listWinesByRestaurant,
  createReservation,
  getReservation,
  updateReservation,
  deleteReservation,
  listReservations,
  listUpcomingReservations,
  cancelReservation,
  completeReservation,
  markNoShow,
  getReservationsByDateRange,
  createImport,
  confirmImport,
  rejectImport,
  listPendingImports,
  buildBookingUrl,
  getBestBookingPlatform,
  parseConfirmationEmail,
  generateYearInReview,
  parseCsvText,
  parseGoogleMapsExport,
  importCsvRows,
} from '@mylife/dining';
import type {
  CreateRestaurantInput,
  CreateTagInput,
  UpdateRestaurantInput,
  RestaurantFilter,
  Tag,
  CreateWatchlistInput,
  CreateVisitInput,
  UpdateVisitInput,
  VisitFilter,
  CreateDishInput,
  UpdateDishInput,
  CreateWineInput,
  UpdateWineInput,
  CreateReservationInput,
  UpdateReservationInput,
  ReservationFilter,
  CreateImportInput,
} from '@mylife/dining';
import { createCustomFood, createFoodLogEntry, addFoodLogItem } from '@mylife/nutrition';
import {
  buildNutritionMealFromVisit,
  type DiningDishMacros,
} from '../../../../modules/nutrition/src/integrations/dining';

function db() {
  ensureModuleMigrations('dining');
  return getAdapter();
}

function nutritionDb() {
  ensureModuleMigrations('nutrition');
  return getAdapter();
}

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function addRestaurant(
  input: CreateRestaurantInput,
  tagIds: string[],
): Promise<{ id: string }> {
  const id = genId();
  createRestaurant(db(), id, input);
  for (const tagId of tagIds) {
    addTagToRestaurant(db(), id, tagId);
  }
  return { id };
}

export async function getCuisineTags(): Promise<Tag[]> {
  return listTags(db(), 'cuisine');
}

export async function addCustomTag(input: CreateTagInput): Promise<Tag> {
  const id = genId();
  return createTag(db(), id, input);
}

export async function fetchRestaurants(filters?: RestaurantFilter) {
  return listRestaurants(db(), filters);
}

export async function fetchRestaurant(id: string) {
  return getRestaurant(db(), id);
}

export async function fetchTagsForRestaurant(restaurantId: string) {
  return getTagsForRestaurant(db(), restaurantId);
}

export async function updateRestaurantAction(
  id: string,
  input: UpdateRestaurantInput,
) {
  updateRestaurant(db(), id, input);
}

export async function deleteRestaurantAction(id: string) {
  deleteRestaurant(db(), id);
}

// -- Wishlist actions --

export async function fetchWishlistRestaurants() {
  try {
    return listRestaurants(db(), { is_wishlist: 1, sort_by: 'created_at', sort_dir: 'DESC', limit: 500 });
  } catch {
    return [];
  }
}

export async function toggleWishlistAction(id: string, currentValue: number) {
  try {
    updateRestaurant(db(), id, { is_wishlist: currentValue ? 0 : 1 });
  } catch {
    // silently handle
  }
}

// -- Watchlist actions --

export async function fetchWatchlistEntries() {
  try {
    expireStaleEntries(db());
    return listWatchlistEntries(db(), { status: 'active' });
  } catch {
    return [];
  }
}

export async function createWatchlistAction(input: CreateWatchlistInput) {
  try {
    const id = genId();
    return createWatchlistEntry(db(), id, input);
  } catch {
    return null;
  }
}

export async function deleteWatchlistAction(id: string) {
  try {
    deleteWatchlistEntry(db(), id);
  } catch {
    // silently handle
  }
}

export async function fulfillWatchlistAction(id: string) {
  try {
    fulfillWatchlistEntry(db(), id);
  } catch {
    // silently handle
  }
}

// -- Visit actions --

export async function addVisit(input: CreateVisitInput, companionNames: string[]) {
  const id = genId();
  const visit = createVisit(db(), id, input);
  for (const name of companionNames) {
    createCompanion(db(), genId(), { visit_id: id, display_name: name });
  }
  return visit;
}

export async function fetchVisit(id: string) {
  return getVisit(db(), id);
}

export async function updateVisitAction(id: string, input: UpdateVisitInput) {
  updateVisit(db(), id, input);
}

export async function deleteVisitAction(id: string) {
  deleteVisit(db(), id);
}

export async function fetchVisitsByRestaurant(restaurantId: string) {
  return listVisitsByRestaurant(db(), restaurantId);
}

export async function fetchVisitsChronological(filter?: VisitFilter) {
  return listVisitsChronological(db(), filter);
}

export async function fetchVisitStats(restaurantId?: string) {
  return getVisitStats(db(), restaurantId);
}

// -- Dish actions --

export async function addDish(input: CreateDishInput) {
  const id = genId();
  return createDish(db(), id, input);
}

export async function fetchDish(id: string) {
  return getDish(db(), id);
}

export async function updateDishAction(id: string, input: UpdateDishInput) {
  updateDish(db(), id, input);
}

export async function deleteDishAction(id: string) {
  deleteDish(db(), id);
}

export async function fetchDishesByVisit(visitId: string) {
  return listDishesByVisit(db(), visitId);
}

export async function fetchDishesByRestaurant(restaurantId: string) {
  return listDishesByRestaurant(db(), restaurantId);
}

export async function fetchTopDishes(limit?: number) {
  return listTopDishes(db(), { limit });
}

export async function checkDishAllergens(restaurantId: string, allergens: string[]) {
  return checkAllergens(db(), restaurantId, allergens);
}

// -- Wine actions --

export async function addWine(input: CreateWineInput) {
  const id = genId();
  return createWine(db(), id, input);
}

export async function fetchWine(id: string) {
  return getWine(db(), id);
}

export async function updateWineAction(id: string, input: UpdateWineInput) {
  updateWine(db(), id, input);
}

export async function deleteWineAction(id: string) {
  deleteWine(db(), id);
}

export async function fetchWinesByVisit(visitId: string) {
  return listWinesByVisit(db(), visitId);
}

export async function fetchWinesByRestaurant(restaurantId: string) {
  return listWinesByRestaurant(db(), restaurantId);
}

// -- Reservation actions --

export async function addReservation(input: CreateReservationInput) {
  const id = genId();
  return createReservation(db(), id, input);
}

export async function fetchReservation(id: string) {
  return getReservation(db(), id);
}

export async function updateReservationAction(id: string, input: UpdateReservationInput) {
  updateReservation(db(), id, input);
}

export async function deleteReservationAction(id: string) {
  deleteReservation(db(), id);
}

export async function fetchReservations(filter?: ReservationFilter) {
  return listReservations(db(), filter);
}

export async function fetchUpcomingReservations() {
  return listUpcomingReservations(db());
}

export async function cancelReservationAction(id: string, reason?: string) {
  cancelReservation(db(), id, reason);
}

export async function completeReservationAction(id: string, visitId?: string) {
  completeReservation(db(), id, visitId);
}

export async function markNoShowAction(id: string) {
  markNoShow(db(), id);
}

export async function fetchReservationsByDateRange(from: string, to: string) {
  return getReservationsByDateRange(db(), from, to);
}

export async function parseEmailAction(text: string) {
  return parseConfirmationEmail(text);
}

export async function createImportAction(input: CreateImportInput) {
  const id = genId();
  return createImport(db(), id, input);
}

export async function confirmImportAction(id: string, reservationId: string) {
  confirmImport(db(), id, reservationId);
}

export async function rejectImportAction(id: string) {
  rejectImport(db(), id);
}

export async function fetchPendingImports() {
  return listPendingImports(db());
}

export async function fetchBookingUrl(restaurantId: string) {
  const r = getRestaurant(db(), restaurantId);
  if (!r) return null;
  return buildBookingUrl(r);
}

export async function fetchBestPlatform(restaurantId: string) {
  const r = getRestaurant(db(), restaurantId);
  if (!r) return null;
  return getBestBookingPlatform(r);
}

// -- Year-in-review --

export async function fetchYearInReview(startDate: string, endDate: string) {
  return generateYearInReview(db(), startDate, endDate);
}

// -- CSV / Maps import --

export async function importCsvAction(text: string) {
  const rows = parseCsvText(text);
  const result = importCsvRows(db(), rows);
  await geocodeMissingRestaurants();
  return result;
}

export async function importGoogleMapsAction(jsonText: string) {
  const places = parseGoogleMapsExport(jsonText);
  const rows = places.map((p) => ({ name: p.name, address: p.address }));
  const result = importCsvRows(db(), rows);
  await geocodeMissingRestaurants();
  return result;
}

// ---------------------------------------------------------------------------
// Nutrition bridge: log macros for a dining meal
// ---------------------------------------------------------------------------

export interface LogMealMacrosInput {
  restaurantName: string;
  visitDate: string;
  dishes: Array<{
    name: string;
    course: string | null;
    macros: DiningDishMacros | null;
  }>;
}

export interface LogMealMacrosResult {
  logged: boolean;
  itemsLogged: number;
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

/**
 * Build a nutrition meal from a dining visit's dishes and persist it as a real
 * nutrition log: one custom food per dish with macro data, a single food log
 * entry, and a log item per food. Returns the count of items actually written.
 */
export async function logMealMacrosFromDishes(
  input: LogMealMacrosInput,
): Promise<LogMealMacrosResult> {
  const spec = buildNutritionMealFromVisit(
    {
      restaurantName: input.restaurantName,
      visitDate: input.visitDate || new Date().toISOString().slice(0, 10),
      dishes: input.dishes.map((d) => ({ name: d.name, course: d.course })),
    },
    input.dishes.map((d) => d.macros),
  );

  if (spec.foods.length === 0) {
    return { logged: false, itemsLogged: 0, totals: spec.totals };
  }

  const adapter = nutritionDb();
  const logId = genId();
  createFoodLogEntry(adapter, logId, {
    date: spec.date,
    mealType: spec.mealType,
    notes: spec.notes,
  });

  let itemsLogged = 0;
  for (const food of spec.foods) {
    const created = createCustomFood(adapter, {
      name: food.name,
      brand: food.brand,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
    });
    addFoodLogItem(adapter, genId(), {
      logId,
      foodId: created.id,
      servingCount: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
    });
    itemsLogged += 1;
  }

  return { logged: true, itemsLogged, totals: spec.totals };
}

// ---------------------------------------------------------------------------
// Geocoding (keyless, server-side OSM Nominatim)
// ---------------------------------------------------------------------------

interface NominatimResult {
  lat: string;
  lon: string;
}

/**
 * Resolve an address string to coordinates using the keyless OpenStreetMap
 * Nominatim service. This runs server-side (in the server action) so it is not
 * subject to the browser content-security-policy. Returns null on any failure
 * so callers can degrade gracefully. Nominatim usage policy requires a
 * descriptive User-Agent and at most one request per second.
 */
async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MyLife-Dining/1.0 (privacy-first dining tracker)',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function buildGeocodeQuery(r: {
  address: string | null;
  neighborhood: string | null;
  city: string | null;
}): string {
  return [r.address, r.neighborhood, r.city].filter(Boolean).join(', ');
}

/**
 * Geocode a single restaurant by id and persist its coordinates. Returns the
 * resolved coordinates, or null if the restaurant has no address or geocoding
 * failed.
 */
export async function geocodeRestaurantAction(
  id: string,
): Promise<{ lat: number; lng: number } | null> {
  const r = getRestaurant(db(), id);
  if (!r) return null;
  const query = buildGeocodeQuery(r);
  if (!query) return null;
  const coords = await geocodeAddress(query);
  if (!coords) return null;
  updateRestaurant(db(), id, { lat: coords.lat, lng: coords.lng });
  return coords;
}

/**
 * Geocode every restaurant that has an address but no coordinates yet. Called
 * after imports so newly added places appear on the map. Respects the Nominatim
 * one-request-per-second policy and caps the batch to avoid long-running calls.
 */
export async function geocodeMissingRestaurants(maxToProcess = 25): Promise<number> {
  const rows = listRestaurants(db(), { limit: 500 }) as Array<{
    id: string;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  }>;
  const pending = rows
    .filter((r) => (r.lat == null || r.lng == null) && buildGeocodeQuery(r))
    .slice(0, maxToProcess);

  let geocoded = 0;
  for (const r of pending) {
    const coords = await geocodeAddress(buildGeocodeQuery(r));
    if (coords) {
      updateRestaurant(db(), r.id, { lat: coords.lat, lng: coords.lng });
      geocoded += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return geocoded;
}

// ---------------------------------------------------------------------------
// Map tiles (keyless OSM raster, proxied server-side as data URIs)
// ---------------------------------------------------------------------------

export interface MapTileRequest {
  z: number;
  x: number;
  y: number;
}

export interface MapTile extends MapTileRequest {
  /** PNG data URI for the tile, or null if it could not be fetched. */
  dataUri: string | null;
}

const TILE_HOSTS = ['a', 'b', 'c'];

/**
 * Fetch OpenStreetMap raster tiles server-side and return them as data URIs.
 *
 * The browser content-security-policy restricts img-src to same-origin plus a
 * short allowlist, so external tile hosts cannot be loaded directly in the
 * client. Fetching the tiles here (server-side, CSP-exempt) and returning them
 * as data: URIs keeps rendering fully keyless while satisfying the existing
 * img-src 'self' data: policy. Tiles are deduplicated and capped per request.
 */
export async function fetchMapTiles(tiles: MapTileRequest[]): Promise<MapTile[]> {
  const seen = new Set<string>();
  const unique: MapTileRequest[] = [];
  for (const t of tiles) {
    const key = `${t.z}/${t.x}/${t.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
    if (unique.length >= 64) break;
  }

  const results = await Promise.all(
    unique.map(async (t): Promise<MapTile> => {
      try {
        const host = TILE_HOSTS[Math.abs(t.x + t.y) % TILE_HOSTS.length];
        const url = `https://${host}.tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'MyLife-Dining/1.0 (privacy-first dining tracker)' },
          cache: 'force-cache',
        });
        if (!res.ok) return { ...t, dataUri: null };
        const buf = Buffer.from(await res.arrayBuffer());
        return { ...t, dataUri: `data:image/png;base64,${buf.toString('base64')}` };
      } catch {
        return { ...t, dataUri: null };
      }
    }),
  );
  return results;
}
