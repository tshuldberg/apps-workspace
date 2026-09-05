export { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, CREATE_FTS_TRIGGERS } from './schema';
export { NUTRITION_MIGRATION_V2, NUTRITION_MIGRATION_V3 } from './migrations';
export {
  createFood,
  createCustomFood,
  getFoodById,
  getFoodByBarcode,
  getRecentFoods,
  searchFoodsFTS,
  searchFoods,
  updateFood,
  deleteFood,
  createFoodFromAIEstimate,
} from './foods';
export {
  createNutrient,
  getNutrients,
  getNutrientById,
  deleteNutrient,
  setFoodNutrient,
  getFoodNutrients,
  deleteFoodNutrient,
  deleteFoodNutrients,
  getDailyNutrientTotals,
} from './nutrients';
export type { DailyNutrientTotal } from './nutrients';
export {
  createFoodLogEntry,
  getFoodLogEntries,
  getFoodLogEntryById,
  updateFoodLogEntry,
  deleteFoodLogEntry,
  addFoodLogItem,
  getFoodLogItems,
  updateFoodLogItem,
  deleteFoodLogItem,
  getDailyTotals,
  copyFoodLog,
} from './food-log';
export type { DailyTotals } from './food-log';
export {
  createDailyGoals,
  getDailyGoals,
  getActiveGoals,
  updateDailyGoals,
  deleteDailyGoals,
} from './goals';
export {
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
} from './settings';
export {
  getCachedBarcode,
  getRecentBarcodeScans,
  setCachedBarcode,
  deleteCachedBarcode,
  purgeExpiredCache,
} from './barcode-cache';
export type { RecentBarcodeScan } from './barcode-cache';
export {
  addFavorite,
  removeFavorite,
  isFavorite,
  getFavoriteIds,
  getFavoriteCount,
} from './favorites';
export type { FavoriteFood } from './favorites';
export {
  createMealTemplate,
  getMealTemplates,
  getMealTemplateById,
  deleteMealTemplate,
  addMealTemplateItem,
  getMealTemplateItems,
  deleteMealTemplateItem,
  getMealTemplateCount,
  logMealTemplate,
} from './meal-templates';
export type { MealTemplate, MealTemplateItem } from './meal-templates';
