'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Foods CRUD
  createFood,
  getFoodById,
  getFoodByBarcode,
  getRecentFoods,
  searchFoods,
  searchFoodsFTS,
  updateFood,
  deleteFood,
  getFavoriteIds,
  getMealTemplates,
  getMealTemplateItems,
  logMealTemplate,
  // Food log
  createFoodLogEntry,
  getFoodLogEntries,
  updateFoodLogEntry,
  deleteFoodLogEntry,
  addFoodLogItem,
  getFoodLogItems,
  updateFoodLogItem,
  deleteFoodLogItem,
  getDailyTotals,
  // Goals
  createDailyGoals,
  getActiveGoals,
  getDailyGoals,
  updateDailyGoals,
  deleteDailyGoals,
  // Settings
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
  // Nutrients
  getNutrients,
  getFoodNutrients,
  // Stats
  getDailySummary,
  getDailyGoalProgress,
  getMealBreakdown,
  getWeeklyTrends,
  getMonthlyTrends,
  getCalorieHistory,
  getMacroRatios,
  getMicronutrientSummary,
  getMicronutrientDeficiencies,
  getTopNutrientSources,
  // Integration
  getEatingWindow,
  isInEatingWindow,
  // Export
  exportFoodLogCSV,
  exportNutritionSummaryCSV,
  // API search
  searchFoodUnified,
  // Water
  createWaterEntry,
  getWaterEntriesForDate,
  deleteWaterEntry,
  getDailyWaterTotal,
  getWaterGoalMl,
  getWaterContainers,
  getWaterUnit,
  getWeeklyWaterTotals,
  // Notes
  createDailyNote,
  getDailyNote,
  getDailyNotes,
  getDailyNotesByDate,
  updateDailyNote,
  deleteDailyNote,
  upsertDailyNote,
  searchNotes,
  // Restaurants
  createRestaurant,
  createMenuItem,
  getPopularChains,
  getAllRestaurants,
  getRestaurantById,
  searchRestaurants,
  getMenuItems,
  searchMenuItems,
  logMenuItemAsMeal,
  // Energy and profile
  getUserProfile,
  getEnergyBalance,
  getWeeklyEnergyBalance,
  // Insights
  getNutritionDays,
  getFastingDays,
  getWorkoutDays,
  getMoodDays,
  getCalorieGoal,
  generateNutritionInsights,
} from '@mylife/nutrition';

import { searchOFF } from '@mylife/nutrition';
import type { FoodSearchResult, MenuItem } from '@mylife/nutrition';

function db() {
  ensureModuleMigrations('nutrition');
  return getAdapter();
}

// --- Diary ---

export async function fetchDailySummary(date: string) {
  return getDailySummary(db(), date);
}

export async function fetchGoalProgress(date: string) {
  try { return getDailyGoalProgress(db(), date); } catch { return null; }
}

export async function fetchMealBreakdown(date: string) {
  return getMealBreakdown(db(), date);
}

export async function fetchDailyTotals(date: string) {
  return getDailyTotals(db(), date);
}

export async function fetchFoodLogEntries(date: string) {
  return getFoodLogEntries(db(), date);
}

export async function fetchFoodLogItems(logId: string) {
  return getFoodLogItems(db(), logId);
}

export async function fetchEatingWindow() {
  try { return getEatingWindow(db()); } catch { return null; }
}

export async function fetchIsInEatingWindow() {
  try { return isInEatingWindow(db()); } catch { return null; }
}

// --- Food Log Mutations ---

export async function doCreateFoodLogEntry(id: string, input: { date: string; mealType: string; notes?: string }) {
  createFoodLogEntry(db(), id, input);
}

export async function doUpdateFoodLogEntry(id: string, updates: Partial<{ mealType: string; notes: string }>) {
  updateFoodLogEntry(db(), id, updates);
}

export async function doDeleteFoodLogEntry(id: string) {
  deleteFoodLogEntry(db(), id);
}

export async function doAddFoodLogItem(
  id: string,
  input: { logId: string; foodId: string; servingCount?: number; calories: number; proteinG: number; carbsG: number; fatG: number },
) {
  addFoodLogItem(db(), id, input);
}

export async function doUpdateFoodLogItem(
  id: string,
  updates: Partial<{ servingCount: number; calories: number; proteinG: number; carbsG: number; fatG: number }>,
) {
  updateFoodLogItem(db(), id, updates);
}

export async function doDeleteFoodLogItem(id: string) {
  deleteFoodLogItem(db(), id);
}

export async function doClearFoodLog() {
  const d = db();
  d.transaction(() => {
    d.execute('DELETE FROM nu_food_log_items');
    d.execute('DELETE FROM nu_food_log');
  });
}

// --- Foods ---

export async function fetchFoodById(id: string) {
  return getFoodById(db(), id);
}

export async function fetchFoodByBarcode(barcode: string) {
  return getFoodByBarcode(db(), barcode);
}

export async function doSearchFoods(query: string, limit = 50) {
  const d = db();
  try {
    const results = searchFoodsFTS(d, query, limit);
    if (results.length > 0) return results;
  } catch { /* FTS may not be available */ }
  return searchFoods(d, query, limit);
}

export async function doSearchFoodUnified(query: string, source?: string, limit?: number) {
  try {
    return await searchFoodUnified(db(), { query, source: (source as 'all') ?? 'all', limit: limit ?? 50 });
  } catch {
    return [];
  }
}

export async function doCreateFood(
  id: string,
  input: {
    name: string;
    brand?: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    source?: string;
    barcode?: string;
  },
) {
  createFood(db(), id, input);
}

export async function doUpdateFood(
  id: string,
  updates: Partial<{
    name: string;
    brand: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>,
) {
  updateFood(db(), id, updates);
}

export async function doDeleteFood(id: string) {
  deleteFood(db(), id);
}

export async function fetchRecentFoods(limit = 12) {
  try { return getRecentFoods(db(), limit); } catch { return []; }
}

export async function fetchFavoriteFoods(limit = 12) {
  try {
    const d = db();
    const ids = getFavoriteIds(d).slice(0, limit);
    return ids
      .map((id) => getFoodById(d, id))
      .filter((food): food is NonNullable<typeof food> => food !== null);
  } catch {
    return [];
  }
}

export async function fetchMealTemplates() {
  try {
    const d = db();
    const templates = getMealTemplates(d);
    return templates.map((template) => ({
      ...template,
      items: getMealTemplateItems(d, template.id),
    }));
  } catch {
    return [];
  }
}

export async function doLogMealTemplate(templateId: string, mealType: string, date: string) {
  return logMealTemplate(db(), templateId, mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack', date);
}

// --- Nutrients ---

export async function fetchFoodNutrients(foodId: string) {
  const d = db();
  const nutrients = getFoodNutrients(d, foodId);
  const allNutrients = getNutrients(d);
  return nutrients.map((fn) => {
    const nutrient = allNutrients.find((n) => n.id === fn.nutrientId);
    return { ...fn, name: nutrient?.name ?? '', unit: nutrient?.unit ?? '', rda: nutrient?.rdaValue ?? null };
  });
}

// --- Goals ---

export async function fetchActiveGoals(date: string) {
  try { return getActiveGoals(db(), date); } catch { return null; }
}

export async function fetchAllGoals() {
  return getDailyGoals(db());
}

export async function doCreateGoals(
  id: string,
  input: { calories: number; proteinG: number; carbsG: number; fatG: number; effectiveDate: string },
) {
  createDailyGoals(db(), id, input);
}

export async function doUpdateGoals(
  id: string,
  updates: Partial<{ calories: number; proteinG: number; carbsG: number; fatG: number; effectiveDate: string }>,
) {
  updateDailyGoals(db(), id, updates);
}

export async function doDeleteGoals(id: string) {
  deleteDailyGoals(db(), id);
}

// --- Settings ---

export async function fetchSetting(key: string) {
  try { return getSetting(db(), key) ?? null; } catch { return null; }
}

export async function fetchAllSettings() {
  try { return getAllSettings(db()); } catch { return {}; }
}

export async function doSetSetting(key: string, value: string) {
  setSetting(db(), key, value);
}

export async function doDeleteSetting(key: string) {
  deleteSetting(db(), key);
}

export async function fetchUserProfile() {
  try { return getUserProfile(db()); } catch { return null; }
}

// --- Stats / Dashboard ---

export async function fetchMacroRatios(startDate: string, endDate: string) {
  try { return getMacroRatios(db(), startDate, endDate); } catch { return null; }
}

export async function fetchMicronutrientSummary(date: string) {
  try { return getMicronutrientSummary(db(), date); } catch { return []; }
}

export async function fetchMicronutrientDeficiencies(days: number) {
  try { return getMicronutrientDeficiencies(db(), days); } catch { return []; }
}

export async function fetchTopNutrientSources(nutrientId: string, limit = 10) {
  try { return getTopNutrientSources(db(), nutrientId, limit); } catch { return []; }
}

export async function fetchEnergyBalance(date: string) {
  try { return getEnergyBalance(db(), date); } catch { return null; }
}

export async function fetchWeeklyEnergyBalance(endDate: string) {
  try { return getWeeklyEnergyBalance(db(), endDate); } catch { return []; }
}

// --- Trends ---

export async function fetchWeeklyTrends(weekStartDate: string) {
  try { return getWeeklyTrends(db(), weekStartDate); } catch { return []; }
}

export async function fetchMonthlyTrends(year: number, month: number) {
  try { return getMonthlyTrends(db(), year, month); } catch { return []; }
}

export async function fetchCalorieHistory(days: number) {
  try { return getCalorieHistory(db(), days); } catch { return []; }
}

export async function fetchNutritionInsights(days = 30) {
  try {
    const d = db();
    return generateNutritionInsights({
      nutritionDays: getNutritionDays(d, days),
      fastingDays: getFastingDays(d, days),
      workoutDays: getWorkoutDays(d, days),
      moodDays: getMoodDays(d, days),
      calorieGoal: getCalorieGoal(d),
    });
  } catch {
    return [];
  }
}

// --- Export ---

export async function doExportFoodLog(startDate?: string, endDate?: string) {
  return exportFoodLogCSV(db(), startDate, endDate);
}

export async function doExportNutritionSummary(startDate?: string, endDate?: string) {
  return exportNutritionSummaryCSV(db(), startDate, endDate);
}

// --- Water ---

export async function fetchWaterEntriesForDate(date: string) {
  try { return getWaterEntriesForDate(db(), date); } catch { return []; }
}

export async function fetchDailyWaterTotal(date: string) {
  try { return getDailyWaterTotal(db(), date); } catch { return 0; }
}

export async function fetchWaterGoalMl() {
  try { return getWaterGoalMl(db()); } catch { return 2500; }
}

export async function fetchWaterContainers() {
  try { return getWaterContainers(db()); } catch { return [250, 500, 750]; }
}

export async function fetchWaterUnit() {
  try { return getWaterUnit(db()); } catch { return 'ml' as const; }
}

export async function fetchWeeklyWaterTotals(endDate: string) {
  try { return getWeeklyWaterTotals(db(), endDate); } catch { return { days: [], goalMl: 2500 }; }
}

export async function doCreateWaterEntry(
  id: string,
  input: { date: string; amountMl: number; source?: 'manual' | 'quick_add' | 'healthkit' },
) {
  createWaterEntry(db(), id, input);
}

export async function doDeleteWaterEntry(id: string) {
  deleteWaterEntry(db(), id);
}

// --- Notes ---

export async function fetchDailyNote(date: string) {
  try { return getDailyNote(db(), date) ?? null; } catch { return null; }
}

export async function fetchDailyNotes(limit = 90, offset = 0) {
  try { return getDailyNotes(db(), { limit, offset }); } catch { return []; }
}

export async function fetchDailyNotesByRange(startDate: string, endDate?: string) {
  try { return getDailyNotesByDate(db(), startDate, endDate ?? startDate); } catch { return []; }
}

export async function doCreateDailyNote(
  id: string,
  input: { date: string; content: string; tags?: string[] },
) {
  createDailyNote(db(), id, input);
}

export async function doUpdateDailyNote(
  date: string,
  updates: { content?: string; tags?: string[] },
) {
  updateDailyNote(db(), date, updates);
}

export async function doUpsertDailyNote(
  id: string,
  input: { date: string; content: string; tags?: string[] },
) {
  upsertDailyNote(db(), id, input);
}

export async function doDeleteDailyNote(date: string) {
  deleteDailyNote(db(), date);
}

export async function doSearchNotes(query: string) {
  try { return searchNotes(db(), query); } catch { return []; }
}

// --- Restaurants ---

export async function fetchPopularChains(limit = 200) {
  try { return getPopularChains(db(), limit); } catch { return []; }
}

export async function fetchAllRestaurants(limit = 500) {
  try { return getAllRestaurants(db(), limit); } catch { return []; }
}

export async function fetchRestaurantById(id: string) {
  try { return getRestaurantById(db(), id); } catch { return null; }
}

export async function doCreateRestaurant(
  id: string,
  input: {
    name: string;
    category?: 'fast_food' | 'casual' | 'fine_dining' | 'cafe' | 'pizza' | 'asian' | 'mexican' | 'other';
    chain?: boolean;
    logoEmoji?: string;
    website?: string;
  },
) {
  createRestaurant(db(), id, input);
}

export async function doSearchRestaurants(query: string) {
  try { return searchRestaurants(db(), query); } catch { return []; }
}

export async function fetchMenuItems(restaurantId: string) {
  try { return getMenuItems(db(), restaurantId); } catch { return []; }
}

export async function doCreateMenuItem(
  id: string,
  input: {
    restaurantId: string;
    name: string;
    description?: string;
    category?: string;
    servingSize?: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sodiumMg?: number;
  },
) {
  createMenuItem(db(), id, input);
}

export async function doSearchMenuItems(query: string) {
  try { return searchMenuItems(db(), query); } catch { return []; }
}

export async function doLogMenuItemAsMeal(
  ids: { foodId: string; logItemId: string },
  input: { menuItem: MenuItem; restaurantName: string; logId: string; servingCount?: number },
) {
  logMenuItemAsMeal(db(), ids, input);
}

// --- Live online search (Open Food Facts, keyless) ---

/**
 * Live text search against Open Food Facts. Network-backed and keyless; the
 * client is rate limited module-side. Returns [] on any failure so the search
 * page degrades to local-only results. FatSecret/USDA live search stays off
 * until credentials exist (no fake sources).
 */
export async function doSearchFoodsOnline(query: string): Promise<FoodSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  try {
    return await searchOFF(trimmed, 1, 20);
  } catch {
    return [];
  }
}

/**
 * Persist an Open Food Facts result into nu_foods so it can be logged and
 * reused offline. Returns the new local food id.
 */
export async function doImportOnlineFood(result: {
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  barcode: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  createFood(db(), id, {
    name: result.name,
    brand: result.brand ?? undefined,
    servingSize: result.servingSize,
    servingUnit: result.servingUnit,
    calories: result.calories,
    proteinG: result.proteinG,
    carbsG: result.carbsG,
    fatG: result.fatG,
    fiberG: result.fiberG,
    sugarG: result.sugarG,
    sodiumMg: result.sodiumMg,
    source: 'open_food_facts',
    barcode: result.barcode ?? undefined,
  });
  return id;
}
