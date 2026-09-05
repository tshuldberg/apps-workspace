// @mylife/bestchef -- MyRecipes module

export { RECIPES_MODULE } from './definition';
export { SEED_PANTRY_STAPLES } from './db/schema';

export type {
  Recipe,
  CreateRecipe,
  UpdateRecipe,
  Ingredient,
  CreateIngredient,
  StructuredIngredient,
  ParsedIngredient,
  ParsedRecipe,
  RecipeTag,
  Difficulty,
  RecipeFilters,
  Step,
  CreateStep,
  CookingStepWithTimer,
  RecipeCookHistoryEntry,
  RecipeCookPantryApplyInput,
  RecipeCookPantryApplyItem,
  RecipeCookPantryApplyResult,
  RecipeCookPantryReview,
  RecipeCookPantryReviewItem,
  RecipeCookPantryReviewStatus,
  MealPlan,
  MealPlanItem,
  MealPlanWeek,
  MealSlot,
  SubstitutionSuggestion,
  PantryItem,
  PantryBatch,
  CreatePantryBatch,
  UpdatePantryBatch,
  PantryBatchSource,
  CreatePantryItem,
  UpdatePantryItem,
  ConfirmPantryItemIdentityInput,
  PantryFilters,
  GrocerySection,
  FoodDataSource,
  FoodProductType,
  FoodProductAliasType,
  FoodConfirmationSubjectType,
  FoodConfirmationDecision,
  FoodConfirmationStatus,
  NutritionServingBasis,
  FoodProduct,
  CreateFoodProduct,
  UpdateFoodProduct,
  FoodProductAlias,
  CreateFoodProductAlias,
  UpdateFoodProductAlias,
  FoodConfirmation,
  CreateFoodConfirmation,
  MergedGroceryItem,
  ShoppingListItem,
  ConsolidatedShoppingItem,
  MatchOptions,
  MatchedIngredient,
  RecipeMatch,
  ExpiringRecipeSuggestion,
  DeductionResult,
  StorageLocation,
  ExpirationStatus,
  ImportSource,
  ImportResult,
  ShoppingList,
  ShoppingListFilter,
  ShoppingListMetadata,
  UpdateShoppingListInput,
  DuplicateShoppingListOptions,
  ShoppingListItemRow,
  CreateShoppingListItem,
  ShoppingListSummary,
  RecipeForShoppingList,
  RecipeGroceryFlag,
  GroceryFlaggedRecipe,
  NutritionBreakdown,
  NutritionFieldKey,
  NutritionMissingField,
  NutritionFactsWithAddedSugar,
  NutritionDetailSurface,
  NutritionDetailStatus,
  NutritionSourceSummary,
  NutritionHealthSummary,
  NutritionDetail,
  RecipeNutritionSummary,
  RecipeIngredientNutritionConversion,
  NutritionCandidateOrigin,
  NutritionCandidateCompleteness,
  NutritionConfidenceLabel,
  NutritionSourceAccess,
  NutritionSourceDisplayData,
  NutritionSourceChoice,
  NutritionCandidate,
  NutritionProviderResult,
  NutritionResolveInput,
  NutritionProviderStatusCode,
  NutritionProviderStatus,
  NutritionResolutionResult,
  NutritionProviderAdapter,
  FoodRecognitionBoundingBox,
  FoodRecognitionCandidate,
  FoodRecognitionResult,
  FoodRecognitionConfirmationInput,
  FoodRecognitionConfirmationResult,
  ExpirationDateCandidate,
  ExpirationOcrInput,
  ExpirationOcrResult,
  ExpirationOcrProvider,
  ExpirationOcrProviderStatus,
  ExpirationDateConfirmationInput,
  ExpirationDateConfirmationResult,
  UseNextPantryBatchPrompt,
  UseNextRecipePrompt,
  ReceiptOcrProviderStatus,
  ReceiptReviewStatus,
  ReceiptLineMatchStatus,
  ReceiptLineProductCandidateSource,
  ReceiptImport,
  ReceiptImportLine,
  ReceiptLineProductCandidate,
  ReceiptLineMatch,
  ReceiptLineMatchInput,
  ReceiptLineMatchOptions,
  ReceiptOcrInput,
  ReceiptOcrResult,
  ReceiptOcrProvider,
  ReceiptImportDraftInput,
  ReceiptImportDraftOptions,
  ReceiptImportReview,
  ReceiptLineConfirmationInput,
  ReceiptLineConfirmationResult,
  ReceiptImportConfirmationResult,
  VoiceCommand,
  ParsedVoiceCommand,
  VideoImportResult,
  ShareFormat,
  ShareableRecipe,
  ShareToken,
  Collection,
  CreateCollection,
} from './types';
export type { ScaledIngredient } from './scaling';

export {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
} from './db/collections';

export {
  normalizeFoodAliasValue,
  createFoodProduct,
  getFoodProductById,
  getFoodProducts,
  updateFoodProduct,
  deleteFoodProduct,
  createFoodProductAlias,
  getFoodProductAliases,
  getFoodProductByBarcode,
  updateFoodProductAlias,
  deleteFoodProductAlias,
  recordFoodConfirmation,
  getFoodConfirmations,
  confirmFoodRecord,
  createNutritionData,
  getNutritionById,
  getNutritionForItem,
  getNutritionSourceChoicesForPantryItem,
  selectNutritionSourceForPantryItem,
  getNutritionByBarcode,
  getNutritionCandidatesForProduct,
  getBestNutritionForFoodName,
  getNutritionDetailForNutritionData,
  getNutritionDetailForPantryItem,
  getNutritionDetailForPantryBatch,
  getNutritionDetailForGroceryItem,
  nutritionFactsWithAddedSugar,
  getNutritionMissingFields,
  buildNutritionHealthSummary,
  createMissingNutritionDetail,
  nutritionDataToDetail,
  getNutritionSourceDisplayData,
  resolveNutritionCandidates,
  updateNutritionData,
  deleteNutritionData,
  createManualNutritionOverride,
} from './db/nutrition';
export type { NutritionData, CreateNutritionData, UpdateNutritionData, NutritionSource } from './types';

export {
  createUnitConversionCorrection,
  upsertUnitConversionCorrection,
  getUnitConversionCorrectionById,
  getUnitConversionCorrections,
  getReusableUnitConversionCorrections,
  deleteUnitConversionCorrection,
} from './db/unit-conversions';
export type {
  CreateUnitConversionCorrectionInput,
  UnitConversionCorrectionRecord,
  UnitConversionCorrectionSource,
} from './db/unit-conversions';

export {
  getRecipeWithDetails,
  duplicateRecipe,
  getDefaultServings,
  getMeasurementSystem,
} from './db/crud';

export {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  toggleFavorite,
  setRating,
  deleteRecipe,
  countRecipes,
  addIngredient,
  getIngredients,
  getStructuredIngredients,
  updateIngredient,
  deleteIngredient,
  addStep,
  getSteps,
  updateStep,
  deleteStep,
  addTag,
  getTags,
  deleteTag,
  getSetting,
  setSetting,
} from './db/crud';
export {
  createPantryItem,
  createPantryBatch,
  getPantryItems,
  getPantryItemById,
  getPantryBatches,
  getPantryBatchById,
  updatePantryItem,
  updatePantryBatch,
  deletePantryItem,
  deletePantryBatch,
  useNextPantryBatch,
  getPantryItemByBarcode,
  getExpiringItems,
  getPantryItemsByName,
  bulkUpdateQuantities,
  getPantryItemsByProduct,
  confirmPantryItemIdentity,
  confirmFoodRecognitionCandidateToPantry,
  confirmFoodRecognitionCandidatesToPantry,
  confirmExpirationDateForPantryBatch,
  confirmReceiptLineToPantry,
  confirmReceiptImportLines,
  ignoreReceiptImportLine,
  undoReceiptImportLine,
} from './db/pantry';
export {
  upsertMealPlanItem,
  removeMealPlanItem,
  getMealPlanWeek,
  getMealPlanWeekBundle,
  generateMealPlanShoppingList,
} from './db/meal-planner';
export {
  detectStepTimerMinutes,
  getCookingStepsWithTimers,
  suggestIngredientSubstitutions,
  getRecipeCookHistory,
  getRecipeCookPantryReview,
  addRecipeIngredientToPantry,
  applyRecipeCookPantryReview,
} from './db/cooking';
export {
  addSavedRecipeMedia,
  countSavedRecipeMedia,
  getSavedRecipeMedia,
  removeSavedRecipeMedia,
  reorderSavedRecipeMedia,
} from './db/saved-recipe-media';
export type {
  AddSavedRecipeMediaInput,
  RemoveSavedRecipeMediaInput,
  ReorderSavedRecipeMediaInput,
  SavedRecipeMediaRow,
} from './db/saved-recipe-media';
export {
  searchSavedRecipes,
  listDistinctSavedRecipeIngredients,
  listDistinctSavedRecipeCuisines,
} from './db/saved-recipes';
export type {
  SearchSavedRecipesInput,
  SavedRecipeSearchRow,
} from './db/saved-recipes';
export {
  parseIngredientText,
  parseRecipeFromText,
  parseIsoDuration,
  displayIngredient,
  displayIngredientRow,
  RECIPE_TEMPLATES,
  getRecipeTemplate,
} from './parser';
export type {
  UrlParsedRecipe,
  DisplayableIngredient,
  RecipeTemplateId,
  RecipeTemplateSeed,
} from './parser';
// parseRecipeFromHtml uses cheerio (Node.js only) -- import from '@mylife/bestchef/parser/url-parser' on web/server
export { scaleIngredients } from './scaling';
export {
  categorizeItem,
  mergeIngredients,
  generateShoppingList,
  UNIT_CONVERSIONS,
  areUnitsCompatible,
  convertUnit,
  bestDisplayUnit,
  normalizeUnit,
  convertIngredientAmount,
  resolveIngredientNutritionScale,
} from './grocery';
export type {
  UnitCategory,
  UnitConversion,
  UnitConversionCorrection,
  IngredientAmountConversion,
  IngredientNutritionScale,
  IngredientNutritionScaleInput,
} from './grocery';
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
  previewDeduction,
  deductPantryForRecipe,
  matchRecipesToPantry,
  matchReceiptLineToPantry,
  suggestRecipesForExpiringItems,
  suggestRecipesForUseNextBatches,
  calculateMaxServings,
  lookupBarcode,
  mapOffCategoryToSection,
  offLookupToProviderResult,
  createOpenFoodFactsNutritionAdapter,
  createUsdaFoodDataCentralAdapter,
  createGs1DataHubIdentityAdapter,
  createBrokerNutritionAdapter,
  identifyFood,
  identifyFoodViaBroker,
  parseFoodRecognitionResult,
  enrichFoodRecognitionCandidates,
} from './pantry';
export type {
  BrandMappingRow,
  GetBrandMappingsOptions,
  OffLookupResult,
  OffNutritionData,
  UsdaFoodDataCentralAdapterOptions,
  Gs1DataHubAdapterOptions,
} from './pantry';
export {
  toFraction,
  formatQuantity,
  formatDuration,
  isValidEmailShape,
} from './utils';

export {
  listCustomThemes,
  getCustomThemeById,
  createCustomTheme,
  renameCustomTheme,
  updateCustomTheme,
  duplicateCustomTheme,
  deleteCustomTheme,
} from './db/custom-themes';
export type {
  CustomTheme,
  CustomThemeRow,
  CreateCustomThemeInput,
  UpdateCustomThemeInput,
} from './db/custom-themes';

export {
  listCloudCustomThemes,
  createCloudCustomTheme,
  updateCloudCustomTheme,
  deleteCloudCustomTheme,
} from './cloud/custom-themes';
export type {
  CloudCustomTheme,
  CreateCloudCustomThemeInput,
  UpdateCloudCustomThemeInput,
} from './cloud/custom-themes';
export {
  fetchHtml,
  ImportError,
  detectPlatform,
  fetchSocialMetadata,
  extractRecipeFromText,
  extractRecipeFromTextViaBroker,
  extractRecipeFromImage,
  extractRecipeFromImageViaBroker,
  createClaudeReceiptOcrProvider,
  createBrokerReceiptOcrProvider,
  detectClipboardRecipeUrl,
  createManualReceiptOcrProvider,
  createReceiptImportDraft,
  createStaticReceiptOcrProvider,
  getReceiptImportReview,
  listReceiptImports,
} from './import';
export { importRecipeFromVideo } from './import/video-import';
export type {
  FetchResult,
  ImportErrorCode,
  SocialPlatform,
  SocialMediaResult,
  ClipboardDetection,
} from './import';
export {
  calculateRecipeNutrition,
  calculateDishNutrition,
  calculateIngredientListNutrition,
  recipeNutritionToDetail,
} from './nutrition/recipe-nutrition';
export type { IngredientListNutritionInput } from './nutrition/recipe-nutrition';

export { recipeToNutritionRule } from './automations/recipe-to-nutrition';
export type {
  RecipeCookedInput,
  RecipeCookedPreviewState,
  RecipeCookedResult,
} from './automations/recipe-to-nutrition';
export { parseVoiceCommand } from './voice/voice-commands';
export { generatePrintHtml } from './print/recipe-template';
export type { PrintOptions } from './print/recipe-template';
export {
  generateShareText,
  generateShareToken,
  getRecipeByShareToken,
  getShareTokenViewCount,
} from './share/recipe-share';
export {
  buildChefLocalMap,
  buildChefFollowSnapshot,
  buildFollowerUpdateSeedPayload,
  followChef,
  unfollowChef,
  getFollowedChef,
  listFollowedChefs,
  isFollowingChef,
  countFollowedChefs,
  publishFollowerUpdateSeed,
  applyFollowerUpdateSeed,
  getFollowerUpdateSeed,
  getLatestFollowerUpdateSeed,
  listFollowerUpdateSeeds,
} from './social/follower-updates';
export type {
  ChefSeedSubmissionInput,
  ChefSeedSubmission,
  ChefLocalMapSnapshot,
  ChefProfileSnapshotInput,
  ChefFollowSnapshot,
  FollowChefInput,
  FollowedChef,
  PublishFollowerUpdateInput,
  FollowerUpdateSeedPayload,
  FollowerUpdateSeedStatus,
  FollowerUpdateSeed,
} from './social/follower-updates';

export {
  VOTE_PROOF_DRAFT_TTL_DAYS,
  VOTE_PROOF_MAX_BYTES,
  VOTE_PROOF_DRAIN_STATES,
  castVoteWithProof,
  createLocalVoteProofDraft,
  deleteVoteWithProof,
  describeVoteProofError,
  drainPendingProofs,
  getLocalVoteProofDraft,
  listPendingVoteProofDrafts,
  prepareProof,
  stripJpegExifSegments,
  updateLocalVoteProofState,
} from './social/vote-proof';
export type {
  CastVoteProofErrorCode,
  CastVoteWithProofInput,
  CastVoteWithProofResult,
  CreateLocalVoteProofDraftInput,
  DeleteVoteWithProofInput,
  DeleteVoteWithProofResult,
  DrainPendingProofsDeps,
  DrainPendingProofsResult,
  LocalVoteProofDraft,
  LocalVoteProofState,
  PreparedVoteProof,
  PrepareProofDeps,
  ReviewVerdict,
  VoteProofRpcClient,
  VoteProofTier,
  VoteProofUploadResult,
} from './social/vote-proof';
export {
  DEFAULT_MINIMUM_AGE,
  REGION_MINIMUM_AGES,
  minimumAgeForRegion,
} from './social/age-gate';

// Tokens and typography are pure data (no react-native imports) so they
// can be re-exported from the main barrel. React Native UI components live
// under the '@mylife/bestchef/ui' subpath to keep web consumers free of RN.
export { JAKARTA_FONTS, RECIPES_TYPOGRAPHY_ROUNDED } from './ui/typography';
export type { JakartaWeight, RecipesRoundedVariant } from './ui/typography';
export {
  RECIPES_TYPOGRAPHY,
  RECIPES_ACCENT,
  RECIPES_ACCENT_LIGHT,
  RECIPES_SECONDARY,
  RECIPES_TERTIARY,
  RECIPES_DANGER,
  RECIPES_SURFACES,
  RECIPES_GLASS,
  RECIPES_NO_BORDER,
  RECIPES_CTA_GRADIENT,
  RECIPES_FRESHNESS_COLORS,
  RECIPES_CATEGORY_COLORS,
  HERO_GRADIENT,
  HERO_GRADIENT_DARK,
  GOLD_GRADIENT,
  MEDAL_GOLD,
  MEDAL_SILVER,
  MEDAL_BRONZE,
} from './ui/tokens';
export type { RecipesFreshness, RecipesCategory, GradientToken } from './ui/tokens';

// HeroGradientView and GoldGradientView import expo-linear-gradient and
// react-native; they are intentionally NOT re-exported here so the @mylife/
// bestchef package barrel stays free of RN. Consume them via the
// '@mylife/bestchef/ui' subpath in RN code.

// Spring presets are plain data, safe to expose from the package barrel so
// any module (RN or web/server) can read the timing values for non-RN use
// (docs, analytics, design tooling).
export { springs } from './ui/primitives/springs';
export type { SpringConfig, SpringName } from './ui/primitives/springs';

export {
  createShoppingList,
  getShoppingLists,
  getShoppingListById,
  updateShoppingList,
  deleteShoppingList,
  archiveShoppingList,
  restoreShoppingList,
  completeShoppingList,
  duplicateShoppingList,
  addShoppingListItem,
  getShoppingListItems,
  updateShoppingListItem,
  deleteShoppingListItem,
  toggleItemChecked,
  uncheckAllItems,
  addRecipeToShoppingList,
  removeRecipeFromShoppingList,
  addCustomItem,
  addCheckedItemsToPantry,
  getShoppingListSummary,
  getRecipesInShoppingList,
  setRecipeGroceryFlag,
  removeRecipeGroceryFlag,
  isRecipeFlaggedForGrocery,
  getGroceryFlaggedRecipes,
  addFlaggedRecipesToShoppingList,
  addShoppingListMediaUri,
  removeShoppingListMediaUri,
} from './db/shopping-lists';

// ── Cloud layer (Supabase bc_ tables) ──────────────────────────────────

export type {
  Dish as CloudDish,
  DishAlias,
  RecipeSnapshot,
  Submission,
  Vote,
  Ranking,
  Comment as CloudComment,
  CommentHelpful,
  PhotoReport,
  Flag,
  Note as CloudNote,
  NoteRating,
  BadgeDefinition,
  ChefBadge,
  CreatorApplication,
  Tip,
  Subscription as CloudSubscription,
  SubscriptionTier,
  Post,
  RecipeFork,
  BrandMapping,
  ContentModerationStatus as CloudContentModerationStatus,
  CuisineOrigin,
} from './cloud/types';
export {
  DishCategory,
  DishSchema,
  DishAliasSchema,
  RecipeSnapshotSchema,
  SubmissionSchema,
  VoteSchema,
  RankingSchema,
  CommentSchema,
  CommentHelpfulSchema,
  PhotoReportSchema,
  FlagSchema,
  NoteSchema,
  NoteRatingSchema,
  BadgeDefinitionSchema,
  ChefBadgeSchema,
  CreatorApplicationSchema,
  TipSchema,
  SubscriptionSchema,
  SubscriptionTierSchema,
  PostSchema,
  RecipeForkSchema,
  BrandMappingSchema,
  VoteTier,
  VOTE_TIER_WEIGHTS,
  DishStatus,
  VerificationMethod,
  ContentModerationStatus,
  CommentType,
  PhotoReportReason,
  PhotoReportStatus,
  FlagTargetType,
  FlagStatus,
  NoteStatus,
  NoteRatingValue,
  BadgeTier,
  CreatorApplicationStatus,
  TipStatus,
  SubscriptionStatus,
  PostType,
  PostVisibility,
  VoteTierSchema,
} from './cloud/types';

export {
  initBestChefClient,
  getBestChefClient,
  resetBestChefClient,
} from './cloud/client';
export type { BestChefResult } from './cloud/client';

export {
  callVisionBroker,
  callNutritionBroker,
  callProductIdentityBroker,
} from './cloud/provider-broker';
export type {
  BrokerErrorKind,
  BrokerErr,
  BrokerOk,
  BrokerResult,
  BrokerVisionTask,
  BrokerVisionRequest,
  BrokerVisionResponse,
  BrokerNutritionSource,
  BrokerNutritionRequest,
  BrokerNutritionResponse,
  BrokerNutritionCandidate,
  BrokerProductIdentitySource,
  BrokerProductIdentityRequest,
  BrokerProductIdentityResponse,
} from './cloud/provider-broker';

export {
  BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS,
  classifyBestChefIdentity,
  getCurrentBestChefIdentityStatus,
  requestBestChefAccountDeletion,
  getBestChefProfileOwnedRowCounts,
  getBestChefProfileMergeConflicts,
} from './cloud/account-lifecycle';
export type {
  BestChefAccountProvider,
  BestChefCloudDeletionRequest,
  BestChefIdentityStatus,
} from './cloud/account-lifecycle';

export {
  PROVIDER_CONFIGS,
  getProviderConfig,
  generateAffiliateTrackingId,
  generateCheckoutUrl,
  computeCartTotal,
  isInPantry,
  buildCartItems,
  searchProducts,
  buildCart,
  getCheckoutUrl,
  checkProviderAvailability,
  trackAffiliateOrder,
  getAffiliateRevenue,
} from './cloud/grocery-delivery';
export type {
  GroceryProvider,
  ProductMatch,
  CartItem,
  DeliveryCart,
  ProviderAvailability,
  ProviderConfig,
  SearchProductsOptions,
  BuildCartOptions,
  RecipeIngredientInput,
  AffiliateOrder,
  AffiliateRevenueSummary,
} from './cloud/grocery-delivery';

export {
  createDish,
  getDishById,
  getDishBySlug,
  searchDishes,
  getDishesForCuisine,
  getDishCategories,
  getCuisines,
  getAllDishes,
  addDishAlias,
  resolveDishAlias,
  proposeDish,
  proposeDishCloud,
  getCategoryTree,
  slugify,
  dishDisplayName,
  dishDisplayDescription,
  localizeDish,
} from './cloud/dish-taxonomy';
export type {
  CreateDishInput,
  ProposeDishInput,
  ProposeDishCloudInput,
  ProposeDishCloudResult,
  DishSearchFilters,
  CategoryTreeNode,
  DishListItem,
} from './cloud/dish-taxonomy';

export { listFeedVideos, getFeedVideoById } from './cloud/video-feed';
export type { FeedVideo, ListFeedVideosOptions } from './cloud/video-feed';

export {
  BC_CUISINES,
  UNKNOWN_CUISINE_GRADIENT,
  getCuisineGradient,
  getDishEmoji,
  getDishVisuals,
} from './cloud/dish-visuals';
export type {
  BcCuisine,
  DishGradient,
  DishVisuals,
} from './cloud/dish-visuals';

export {
  getSubmissionRank,
} from './cloud/ranking-engine';

export {
  publishRecipeToCloud,
  normalizeUgcLanguage,
  countUserSubmissionsForDish,
  getMySubmissions,
  getSubmissionsForDish,
  getSubmissionById,
  swapSubmission,
  getTopSubmissionsThisWeek,
  getVerifiedRestaurantSubmissions,
  getVoteFeed,
  getLeaderboardSubmissions,
  resolveLeaderboardRangeCutoff,
  getAllRegions,
  MAX_SUBMISSIONS_PER_DISH,
} from './cloud/submission';
export type { PublishLocation, SubmissionListOptions, SubmissionProfileSummary, TopSubmissionsOptions, VerifiedRestaurantSubmissionsOptions, VoteFeedOptions, LeaderboardKind, LeaderboardRange, LeaderboardSubmissionsOptions } from './cloud/submission';

export {
  uploadSubmissionPhoto,
  SUBMISSION_PHOTO_DEFAULT_MIME,
  SUBMISSION_VIDEO_DEFAULT_MIME,
} from './cloud/submission-photo';
export type {
  UploadSubmissionPhotoInput,
  UploadSubmissionPhotoResult,
  SubmissionMediaKind,
} from './cloud/submission-photo';

export { describeMediaUploadError, mediaUploadFailure, normalizeMediaUploadErrorCode } from './cloud/media-errors';
export {
  saveSubmission,
  unsaveSubmission,
  getSavedSubmissionIds,
  listSavedSubmissions,
} from './cloud/saved-submissions';
export type {
  SavedSubmissionInput,
  SavedSubmissionSummary,
  ListSavedSubmissionsOptions,
} from './cloud/saved-submissions';
export {
  listCachedSavedIds,
  isSubmissionSavedLocally,
  markSavedLocally,
  markUnsavedLocally,
  reconcileSavedCache,
  listPendingSaveOps,
  drainPendingSaves,
} from './social/saved-submissions-cache';
export type {
  SavedSubmissionCacheEntry,
  DrainPendingSavesDeps,
  DrainPendingSavesResult,
} from './social/saved-submissions-cache';
export {
  MEDIA_JOB_MAX_ATTEMPTS,
  enqueueMediaJob,
  getMediaJob,
  listActiveMediaJobs,
  listMediaJobsForOwner,
  updateMediaJob,
  cancelMediaJob,
  isMediaJobCancelled,
  pruneSettledMediaJobs,
  requeueStalledMediaJobs,
  drainMediaJobs,
} from './social/media-upload-queue';
export type {
  MediaUploadJob,
  MediaUploadJobStatus,
  MediaJobOutcome,
  DrainMediaJobsDeps,
  DrainMediaJobsResult,
  EnqueueMediaJobInput,
} from './social/media-upload-queue';
export {
  createSubmissionMediaIntent,
  finalizeSubmissionMedia,
} from './cloud/submission-photo';
export type { SubmissionMediaIntent } from './cloud/submission-photo';
export {
  SUBMISSION_IMAGE_BUCKET,
  SUBMISSION_IMAGE_SIGNED_TTL_SECONDS,
  submissionImageStoragePath,
  resolveSubmissionImageUrl,
  resolveSubmissionImageUrls,
} from './cloud/submission-image-url';
export type { SubmissionImageRef } from './cloud/submission-image-url';
export type {
  MediaUploadErrorCode,
  MediaUploadFailure,
  MediaUploadResult,
} from './cloud/media-errors';
export {
  parseEdgeFunctionError,
  extractEdgeErrorEnvelope,
  classifyEdgeStatus,
} from './cloud/edge-errors';
export type { ParsedEdgeError, EdgeErrorEnvelope } from './cloud/edge-errors';

export {
  getSubmissionLikeState,
  setSubmissionLike,
} from './cloud/submission-likes';
export type {
  SubmissionLikeInput,
  SubmissionLikeState,
  SetSubmissionLikeInput,
} from './cloud/submission-likes';

export {
  ensureSubmissionAlias,
  getSubmissionIdForAlias,
} from './cloud/submission-alias';
export type { EnsureSubmissionAliasInput } from './cloud/submission-alias';

export {
  enqueueFailedSubmission,
  retryPendingSubmission,
  listPendingSubmissions,
  getPendingSubmission,
  runPendingSubmissionSweep,
  updatePendingSubmissionPhotoUrl,
  computeNextAttemptDelayMinutes,
} from './cloud/submission-sync-queue';

export {
  enqueueReport,
  retryPendingReport,
  retryPendingReports,
  listPendingReports,
  getPendingReport,
  generatePendingReportLocalId,
  computeReportNextAttemptDelayMinutes,
} from './cloud/pending-reports';
export type {
  PendingReportPayload,
  PendingReportRow,
  EnqueueReportInput,
  EnqueueReportResult,
  RetryReportResult,
  PendingReportsSweepResult,
} from './cloud/pending-reports';
export type {
  PendingSubmissionPayload,
  PendingSubmissionRow,
  EnqueueFailedSubmissionInput,
  RetrySubmissionResult,
  PendingSubmissionSweepResult,
} from './cloud/submission-sync-queue';

export {
  getBestChefSeedContentApproval,
  getBestChefSeedContentRenderDecision,
  hasApprovedBestChefSeedContent,
  normalizePublicMediaUrl,
} from './cloud/public-data-policy';
export type {
  BestChefSeedContentApproval,
  BestChefSeedContentApprovalEnv,
  BestChefSeedContentApprovalStatus,
  BestChefSeedContentProvenance,
  BestChefSeedContentRecord,
  BestChefSeedContentRenderAction,
  BestChefSeedContentRenderDecision,
} from './cloud/public-data-policy';

export {
  castVote,
  castTapVote,
  getMyVote,
  getVotesForSubmission,
  getVoteDistribution,
  recalculateSubmissionScore,
  calculateWeightedWilsonScore,
} from './cloud/voting-engine';
export type { VoteDistribution, CastTapVoteInput, CastTapVoteResult } from './cloud/voting-engine';

export {
  createVoteProofMediaAsset,
  completeVoteProofUpload,
  getReviewedVotesForSubmission,
  VOTE_PROOF_MAX_BYTES as CLOUD_VOTE_PROOF_MAX_BYTES,
  VOTE_PROOF_MIME_TYPE,
} from './cloud/vote-proof';
export type {
  CompleteVoteProofUploadInput,
  CompleteVoteProofUploadResult,
  VoteProofMediaAssetInput,
  VoteProofMediaAssetUpload,
  ReviewedVoteRow,
  GetReviewedVotesOptions,
} from './cloud/vote-proof';

export {
  materializeRankings,
  getGlobalRankings,
  getRegionalRankings,
  getTopDishes,
  getTrendingDishes,
  enforceImageGate,
  enforceImageGateWithSubmissions,
  getChefRank,
  getChefBestRank,
  notifyRankChange,
  upsertRankHistoryEntry,
  getRankHistory,
  getMondayOfWeek,
} from './cloud/ranking-engine';
export type {
  RankingListOptions,
  TopDishesOptions,
  TrendingOptions,
  WeeklyBatchChefRank,
  GetRankHistoryOptions,
} from './cloud/ranking-engine';
export type { RankHistoryEntry } from './cloud/types';

export {
  getChefProfile,
  getChefProfileByHandle,
  getChefSubmissions,
  getChefStats,
  getChefAggregateStats,
  getSignatureDishes,
  setSignatureDishes,
  SIGNATURE_DISHES_MAX,
  checkHandleAvailability,
  HANDLE_COOLDOWN_DAYS,
  uploadAvatar,
  AVATAR_BUCKET,
  AVATAR_MAX_DIMENSION,
  searchChefs,
  getTopChefs,
  getCuisineBreakdown,
  aggregateCuisineBreakdown,
  findTopCuisine,
  computeAvgScore,
} from './cloud/chef-profile';
export type {
  ChefProfileData,
  ChefBadgeWithDef,
  SignatureDish,
  CuisineBreakdownEntry,
  ChefStats,
  ChefAggregateStats,
  ChefSearchOptions,
  ChefSubmissionListOptions,
  GetSignatureDishesInput,
  SetSignatureDishesInput,
  HandleAvailability,
  CheckHandleAvailabilityInput,
  UploadAvatarInput,
  UploadAvatarResult,
} from './cloud/chef-profile';

export {
  submitPhotoReport,
  getPhotoReports,
  getOpenReports,
  verifySubmissionPhoto,
  revokePhotoVerification,
  isPhotoVerified,
  getVerificationStatus,
  checkExifData,
  runAiDetectionHeuristics,
} from './cloud/photo-verification';
export type {
  OpenReportsOptions,
  VerificationStatus,
  ExifAnalysis,
  AiDetectionResult,
  PhotoReportReasonValue,
} from './cloud/photo-verification';

export {
  createFlag,
  getFlags,
  getFlagsForTarget,
  createNote,
  getNotesForFlag,
  rateNote,
  getPublicNotes,
  evaluateNoteConsensus,
  processConsensus,
  checkAutoAction,
  resolveFlag,
  getModerationStats,
  buildPublicContentModerationStatusPatch,
  reportContentToModeration,
  applyModerationDecision,
  BESTCHEF_MODERATION_RATE_LIMITS,
  MIN_RATINGS,
  MIN_HELPFUL_RATIO,
  MIN_UNIQUE_RATERS,
} from './cloud/moderation';
export type {
  FlagTargetTypeValue,
  ModerationTargetKind,
  ModerationDecisionAction,
  ModerationReportInput,
  ModerationReportResult,
  ModerationDecisionInput,
  ModerationDecisionResult,
  PublicContentModerationStatusPatch,
  GetFlagsOptions,
  ConsensusResult,
  AutoActionResult,
  ModerationStats,
} from './cloud/moderation';

export {
  addComment,
  getCommentsForSubmission,
  getComment,
  updateComment,
  editComment,
  deleteComment,
  pinComment,
  unpinComment,
  markHelpful,
  unmarkHelpful,
  toggleHelpful,
  getHelpfulVoters,
  getCommentHelpfulState,
  getTriedThisComments,
  getPinnedComments,
  getCommentCount,
  formatCommentPreview,
  isWithinEditWindow,
  MAX_COMMENT_LENGTH,
  COMMENT_EDIT_WINDOW_HOURS,
} from './cloud/comments';
export type {
  AddCommentOptions,
  GetCommentsOptions,
} from './cloud/comments';

export {
  forkRecipe,
  getForksOfRecipe,
  getForksByChef,
  getForkCount,
  getRecipeLineage,
  getSourceRecipe,
  isForked,
  buildLineageTree,
  getLineageDepth,
} from './cloud/remix';
export type {
  RecipeModifications,
  LineageNode,
} from './cloud/remix';

export {
  BADGE_DEFINITIONS,
  seedBadgeDefinitions,
  getBadgeDefinitions,
  getChefBadges,
  evaluateBadges,
  awardBadge,
  hasBadge,
  isValidBadgeDefinition,
  isCriteriaMet,
  buildEvalStats,
  getEarnedBadges,
  getAllBadgesForChef,
} from './cloud/badge-engine';
export type {
  BadgeCriteria,
  BadgeDefinitionSeed,
  BadgeEvalStats,
  EarnedBadge,
  Badge as ChefBadgeDisplay,
} from './cloud/badge-engine';

export {
  sendTip,
  updateTipStatus,
  getTipsForChef,
  getTipsByTipper,
  getTipsBySubmission,
  getChefTipTotal,
  PAYMENTS_NOT_LAUNCHED,
} from './cloud/tips';
export type {
  SendTipOptions,
  GetTipsOptions,
  PaymentsUnavailableResult,
} from './cloud/tips';

export {
  createSubscriptionTier,
  getSubscriptionTiers,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  subscribe,
  cancelSubscription,
  getMySubscriptions,
  getSubscribersForChef,
  getSubscriberCount,
  isSubscribed,
  getSubscriptionRevenue,
} from './cloud/subscriptions';
export type { GetSubscribersOptions } from './cloud/subscriptions';

export {
  createPost,
  getPostsByAuthor,
  getPostById,
  getPublicPostsByAuthor,
  updatePost,
  deletePost,
  likePost,
  canViewPost,
  getPostFeed,
  checkPostAccess,
} from './cloud/posts';
export type { GetPostsOptions, CreatePostInput } from './cloud/posts';

export {
  applyForCreator,
  getApplication,
  updateApplicationStatus,
  isCreator,
  getCreatorAnalytics,
  getCreatorEntitlement,
  getCreatorList,
  aggregateRevenueByMonth,
  validateApplicationFields,
  emptyAnalytics,
} from './cloud/creator-program';
export type {
  GetCreatorListOptions,
  CreatorAnalytics,
  CreatorEntitlement,
  CreatorEntitlementTier,
} from './cloud/creator-program';

export {
  submitCreatorApplication,
  getMyCreatorApplication,
  withdrawCreatorApplication,
} from './cloud/creator-applications';
export type {
  SubmitCreatorApplicationInput,
  WithdrawCreatorApplicationInput,
} from './cloud/creator-applications';
export type { CreatorApplicationStatusValue } from './cloud/types';

export {
  getChallengeTemplates,
  getSeasonalChallenges,
  getTemplateById,
  getCurrentSeason,
  getSeasonForMonth,
  createChallengeFromTemplate,
  getChallengeProgress,
  getActiveChallenges,
  getChallenges,
  getChallengeDetail,
  joinChallenge,
  leaveChallenge,
  getMyChallengeProgress,
  claimReward,
} from './cloud/challenges';
export type {
  Season,
  ChallengeMetricType,
  ChallengeMetric,
  ChallengeGoalTemplate,
  ChallengeTemplate,
  ChallengeProgress,
  GoalProgress,
  ChallengeRecord,
  ChallengeEnrollment,
  ChallengeListItem,
  ChallengeDetailView,
  ChallengeListStatus,
} from './cloud/challenges';

export {
  getNotificationFeed,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  removeNotification,
  subscribeNotificationFeed,
  kindToCategory,
  buildTargetRoute,
  buildTimeAgo,
  RANK_MILESTONES,
} from './cloud/notifications';
export type {
  NotificationViewModel,
  GetNotificationFeedOptions,
  GetUnreadCountOptions,
  SubscribeNotificationFeedOptions,
} from './cloud/notifications';

export {
  getRecipeNutritionSummary,
  getDailyNutritionFromMealPlan,
  suggestRecipesForNutrientGap,
  getMealPlanOptimizationHints,
  getRecipeHealthScore,
  calculateHealthScore,
} from './cloud/health-bridge';
export type {
  RecipeNutritionCard,
  RecipeSuggestion,
  HealthScore,
} from './cloud/health-bridge';

export {
  followChef as cloudFollowChef,
  unfollowChef as cloudUnfollowChef,
  isFollowingChef as cloudIsFollowingChef,
  getFollowers,
  getFollowing,
  getFollowerCount,
  getFollowingCount,
} from './cloud/followers';
export type {
  FollowerProfile,
  FollowersPage,
  FollowChefInput as CloudFollowChefInput,
  UnfollowChefInput as CloudUnfollowChefInput,
  IsFollowingInput as CloudIsFollowingInput,
  GetFollowersInput,
  GetFollowingInput,
} from './cloud/followers';

export {
  getProfileActivity,
} from './cloud/activity';
export type {
  ActivityEntry,
  ActivityKind,
  GetProfileActivityOptions,
} from './cloud/activity';

export {
  setProfilePrivacy,
  getProfilePrivacy,
  getPublicProfileByHandle,
} from './cloud/profile-privacy';
export type {
  SetProfilePrivacyInput,
  GetProfilePrivacyInput,
  GetPublicProfileByHandleInput,
  PublicProfileSummary,
} from './cloud/profile-privacy';
