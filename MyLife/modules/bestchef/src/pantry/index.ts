export {
  normalizeItemName,
  normalizeReceiptLineDescription,
  extractBarcodeFromReceiptLine,
  resolveItemName,
  itemsMatch,
  fuzzyItemMatch,
  resolveGenericName,
  addBrandMapping,
  getBrandMappings,
} from './name-normalizer';
export type { BrandMappingRow, GetBrandMappingsOptions } from './name-normalizer';
export {
  classifyExpiration,
  comparePantryBatchesForUse,
  daysUntilExpiration,
  getPantryUseNextBatch,
  groupPantryBatchesByExpiration,
  parseExpirationDateCandidates,
  createStaticExpirationOcrProvider,
  createClaudeExpirationOcrProvider,
  createBrokerExpirationOcrProvider,
  recognizeExpirationDates,
  getExpirationColor,
  getExpirationLabel,
  PANTRY_BATCH_SECTION_ORDER,
} from './expiration';
export { previewDeduction, deductPantryForRecipe } from './deduction';
export {
  matchRecipesToPantry,
  matchReceiptLineToPantry,
  suggestRecipesForExpiringItems,
  suggestRecipesForUseNextBatches,
  calculateMaxServings,
} from './matching';
export {
  lookupBarcode,
  mapOffCategoryToSection,
  offLookupToProviderResult,
  createOpenFoodFactsNutritionAdapter,
  createUsdaFoodDataCentralAdapter,
  createGs1DataHubIdentityAdapter,
  createBrokerNutritionAdapter,
} from './open-food-facts';
export type {
  OffLookupResult,
  OffNutritionData,
  UsdaFoodDataCentralAdapterOptions,
  Gs1DataHubAdapterOptions,
} from './open-food-facts';
export {
  identifyFood,
  identifyFoodViaBroker,
  parseFoodRecognitionResult,
  enrichFoodRecognitionCandidates,
} from './food-recognition';
export type { FoodRecognitionCandidate, FoodRecognitionResult } from './food-recognition';
