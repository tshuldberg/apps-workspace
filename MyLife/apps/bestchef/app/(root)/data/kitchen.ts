import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addCustomItem,
  addFlaggedRecipesToShoppingList,
  addCheckedItemsToPantry,
  addIngredient,
  addRecipeIngredientToPantry,
  addRecipeToShoppingList,
  addShoppingListItem,
  addStep,
  archiveShoppingList as archiveShoppingListRecord,
  applyRecipeCookPantryReview,
  areUnitsCompatible,
  calculateDishNutrition,
  calculateIngredientListNutrition,
  calculateRecipeNutrition,
  categorizeItem,
  confirmExpirationDateForPantryBatch,
  confirmFoodRecognitionCandidatesToPantry,
  confirmReceiptImportLines,
  countRecipes,
  createBrokerExpirationOcrProvider,
  createBrokerNutritionAdapter,
  createBrokerReceiptOcrProvider,
  createClaudeExpirationOcrProvider,
  createClaudeReceiptOcrProvider,
  createGs1DataHubIdentityAdapter,
  createReceiptImportDraft,
  createManualReceiptOcrProvider,
  createOpenFoodFactsNutritionAdapter,
  createStaticExpirationOcrProvider,
  createPantryItem,
  createRecipe,
  createUsdaFoodDataCentralAdapter,
  classifyExpiration,
  convertUnit,
  createMissingNutritionDetail,
  createShoppingList,
  deleteShoppingListItem,
  deletePantryItem,
  deleteIngredient,
  deleteRecipe,
  deleteStep,
  deleteShoppingList,
  detectStepTimerMinutes,
  duplicateShoppingList,
  getGroceryFlaggedRecipes,
  getPantryItems,
  getPantryUseNextBatch,
  getNutritionDetailForGroceryItem,
  getNutritionDetailForNutritionData,
  getNutritionDetailForPantryBatch,
  getNutritionSourceChoicesForPantryItem,
  getRecipeCookHistory,
  getRecipeCookPantryReview,
  getRecipeWithDetails,
  getReceiptImportReview,
  getRecipes,
  getShoppingListById,
  getShoppingLists,
  getShoppingListSummary,
  enrichFoodRecognitionCandidates,
  fuzzyItemMatch,
  identifyFood,
  identifyFoodViaBroker,
  ignoreReceiptImportLine,
  undoReceiptImportLine,
  isRecipeFlaggedForGrocery,
  parseFoodRecognitionResult,
  parseIngredientText,
  recipeNutritionToDetail,
  removeRecipeFromShoppingList,
  removeRecipeGroceryFlag,
  recognizeExpirationDates,
  restoreShoppingList as restoreShoppingListRecord,
  selectNutritionSourceForPantryItem,
  setRecipeGroceryFlag,
  suggestRecipesForUseNextBatches,
  toggleFavorite,
  toggleItemChecked,
  updateRecipe,
  updatePantryItem,
  updateShoppingList,
  addShoppingListMediaUri,
  removeShoppingListMediaUri,
  updateShoppingListItem,
  useNextPantryBatch,
  PANTRY_BATCH_SECTION_ORDER,
  type CreatePantryItem,
  type Difficulty,
  type ExpirationDateCandidate,
  type ExpirationDateConfirmationInput,
  type ExpirationDateConfirmationResult,
  type ExpirationOcrProviderStatus,
  type ExpirationStatus,
  type FoodRecognitionBoundingBox,
  type FoodRecognitionCandidate,
  type FoodRecognitionConfirmationInput,
  type FoodRecognitionConfirmationResult,
  type GroceryFlaggedRecipe,
  type Ingredient,
  type PantryBatch,
  type PantryFilters,
  type PantryItem,
  type Recipe,
  type RecipeCookHistoryEntry,
  type RecipeCookPantryApplyInput,
  type RecipeCookPantryApplyResult,
  type RecipeCookPantryReview,
  type RecipeTag,
  type NutritionProviderAdapter,
  type NutritionDetail,
  type NutritionSourceChoice,
  type ReceiptImportConfirmationResult,
  type ReceiptImportReview,
  type ReceiptLineConfirmationInput,
  type RecipeNutritionSummary,
  type ShoppingList,
  type ShoppingListFilter,
  type ShoppingListMetadata,
  type ShoppingListItemRow,
  type ShoppingListSummary,
  type Step,
  type UpdateShoppingListInput,
  type UseNextRecipePrompt,
} from '@mylife/bestchef';

export interface SavedRecipeListItem extends Recipe {
  ingredient_count: number;
  step_count: number;
  grocery_flagged: number;
}

export interface SavedRecipeDetails {
  recipe: Recipe;
  ingredients: Ingredient[];
  steps: Step[];
  tags: RecipeTag[];
  groceryFlagged: boolean;
  cookHistory: RecipeCookHistoryEntry[];
  nutritionSummary: RecipeNutritionSummary;
  nutritionDetail: NutritionDetail;
  ingredientNutritionDetails: NutritionDetail[];
}

export interface CommunityRecipeSaveInput {
  submissionId: string;
  title: string;
  description?: string | null;
  ingredients: string[];
  steps: string[];
  photoUrl?: string | null;
  chefId: string;
  chefName: string;
  chefHandle: string;
}

export interface CommunityRecipeSaveState {
  isSaved: boolean;
  recipeId: string | null;
  sourceSubmissionId: string | null;
  recipe: Recipe | null;
}

export interface KitchenStats {
  recipeCount: number;
  favoriteCount: number;
  pantryCount: number;
  activeListCount: number;
  groceryFlaggedCount: number;
}

export interface CreateSavedRecipeInput {
  title: string;
  description?: string;
  servings?: number | null;
  prepTimeMins?: number | null;
  cookTimeMins?: number | null;
  difficulty?: Difficulty | null;
  ingredientsText: string;
  stepsText: string;
  groceryFlagged?: boolean;
}

export type UpdateSavedRecipeInput = CreateSavedRecipeInput;

export interface GroceryListBundle {
  lists: ShoppingList[];
  activeLists: ShoppingList[];
  archivedLists: ShoppingList[];
  selectedList: ShoppingList | null;
  items: KitchenShoppingListItemRow[];
  summary: ShoppingListSummary | null;
  flaggedRecipes: GroceryFlaggedRecipe[];
  filter: ShoppingListFilter;
}

export interface KitchenShoppingListItemRow extends ShoppingListItemRow {
  nutritionDetail: NutritionDetail;
  recipe_title: string | null;
}

export interface PantryBatchRow {
  item: PantryItem;
  batch: PantryBatch;
  status: ExpirationStatus;
  useNext: boolean;
  nutritionDetail: NutritionDetail;
  nutritionSourceChoices: NutritionSourceChoice[];
}

export interface PantryBatchSection {
  status: ExpirationStatus;
  title: string;
  rows: PantryBatchRow[];
}

export type IngredientAvailabilityStatus = 'in-pantry' | 'low' | 'expired' | 'missing';

export interface IngredientAvailabilityRow {
  ingredientId: string;
  ingredientName: string;
  ingredientItem: string;
  quantity: string | null;
  quantityValue: number | null;
  unit: string | null;
  status: IngredientAvailabilityStatus;
  pantryItemId: string | null;
  pantryItemName: string | null;
  pantryQuantity: number | null;
  pantryUnit: string | null;
  matchScore: number;
  note: string | null;
  shoppingNeeded: boolean;
}

export interface IngredientAvailabilitySummary {
  rows: IngredientAvailabilityRow[];
  totalCount: number;
  onHandCount: number;
  lowCount: number;
  expiredCount: number;
  missingCount: number;
  shoppingNeededCount: number;
}

export type KitchenRecipeCookReview = RecipeCookPantryReview;
export type KitchenRecipeCookApplyInput = RecipeCookPantryApplyInput;
export type KitchenRecipeCookApplyResult = RecipeCookPantryApplyResult;

export const SAMPLE_RECEIPT_OCR_TEXT = `LOCAL MARKET
04/25/2026
049000042566 ORGANIC MILK $5.99
BANANAS $2.49
VISA **** 4242 $8.48
TOTAL $8.48`;

export const SAMPLE_GROCERY_PHOTO_JSON = JSON.stringify({
  candidates: [
    {
      name: 'Organic Milk',
      category: 'dairy',
      storage_location: 'fridge',
      confidence: 0.91,
      labels: ['organic milk', 'whole milk'],
      quantity: 1,
      unit: 'gallon',
      bounding_box: { x: 0.06, y: 0.16, width: 0.42, height: 0.58 },
      crop_uri: 'file://grocery-milk-crop.jpg',
    },
    {
      name: 'Bananas',
      category: 'produce',
      storage_location: 'counter',
      confidence: 0.84,
      labels: ['banana bunch'],
      quantity: 6,
      unit: 'count',
      bounding_box: { x: 0.53, y: 0.42, width: 0.36, height: 0.34 },
    },
  ],
}, null, 2);

export const SAMPLE_EXPIRATION_OCR_TEXT = 'BEST BY 05/03/2026\nLOT L-47';

export interface CreateKitchenReceiptImportInput {
  photoUri: string;
  photoMime?: string;
  imageBase64?: string;
  rawOcrText?: string;
  apiKey?: string | null;
  ocrProvider?: ReceiptOcrProviderChoice;
  includeNetworkNutrition?: boolean;
  nutritionProviders?: NutritionProviderAdapter[];
  usdaApiKey?: string | null;
  gs1ApiKey?: string | null;
  gs1Endpoint?: string | null;
  /** Optional broker client. When provided, server-side providers are used instead of BYO keys. */
  supabase?: SupabaseClient | null;
}

export interface CreateKitchenFoodPhotoReviewInput {
  photoUri: string;
  photoMime?: string;
  imageBase64?: string;
  rawCandidateJson?: string;
  apiKey?: string | null;
  includeNetworkNutrition?: boolean;
  nutritionProviders?: NutritionProviderAdapter[];
  usdaApiKey?: string | null;
  gs1ApiKey?: string | null;
  gs1Endpoint?: string | null;
  /** Optional broker client. When provided, server-side providers are used instead of BYO keys. */
  supabase?: SupabaseClient | null;
}

export interface KitchenFoodPhotoReview {
  photoUri: string;
  photoMime: string;
  candidates: FoodRecognitionCandidate[];
  labels: string[];
  rawText: string | null;
}

export interface CreateKitchenExpirationReviewInput {
  photoUri: string;
  photoMime?: string;
  imageBase64?: string;
  boundingBox?: FoodRecognitionBoundingBox | null;
  cropUri?: string | null;
  rawOcrText?: string;
  apiKey?: string | null;
  ocrProvider?: ExpirationOcrProviderChoice;
  /** Optional broker client. When provided, vision OCR runs server-side. */
  supabase?: SupabaseClient | null;
}

export interface KitchenExpirationReview {
  photoUri: string;
  photoMime: string;
  ocrProvider: ExpirationOcrProviderChoice;
  providerStatus: ExpirationOcrProviderStatus;
  providerMessage: string;
  rawText: string;
  confidence: number;
  candidates: ExpirationDateCandidate[];
  requiresManualSelection: boolean;
}

export interface KitchenRecipeNutritionBundle {
  summary: RecipeNutritionSummary;
  detail: NutritionDetail;
  ingredientDetails: NutritionDetail[];
}

export interface KitchenDishNutritionSubmission {
  id: string;
  title: string;
  ingredients: string[];
}

export type ReceiptOcrProviderChoice = 'manual_text' | 'claude_vision' | 'managed_cloud' | 'on_device';

export interface ReceiptOcrProviderOption {
  id: ReceiptOcrProviderChoice;
  title: string;
  detail: string;
  status: 'available' | 'requires_key' | 'server_managed' | 'planned';
}

export const RECEIPT_OCR_PROVIDER_OPTIONS: ReceiptOcrProviderOption[] = [
  {
    id: 'manual_text',
    title: 'Manual OCR text',
    detail: 'Paste or correct OCR text locally before review.',
    status: 'available',
  },
  {
    id: 'claude_vision',
    title: 'Claude Vision',
    detail: 'Uses a user-supplied key for opt-in receipt OCR.',
    status: 'requires_key',
  },
  {
    id: 'managed_cloud',
    title: 'Managed Textract or Document AI',
    detail: 'Server-side production OCR path, blocked until provider approval.',
    status: 'server_managed',
  },
  {
    id: 'on_device',
    title: 'On-device OCR',
    detail: 'Private local OCR path for approved native builds.',
    status: 'planned',
  },
];

export type ExpirationOcrProviderChoice = 'manual_text' | 'claude_vision' | 'managed_cloud' | 'on_device';

export interface ExpirationOcrProviderOption {
  id: ExpirationOcrProviderChoice;
  title: string;
  detail: string;
  status: 'available' | 'requires_key' | 'server_managed' | 'planned';
}

export const EXPIRATION_OCR_PROVIDER_OPTIONS: ExpirationOcrProviderOption[] = [
  {
    id: 'manual_text',
    title: 'Manual OCR text',
    detail: 'Paste label text or correct OCR locally before review.',
    status: 'available',
  },
  {
    id: 'claude_vision',
    title: 'Claude Vision',
    detail: 'Uses a user-supplied key for opt-in expiration OCR.',
    status: 'requires_key',
  },
  {
    id: 'managed_cloud',
    title: 'Managed Vision OCR',
    detail: 'Production cloud OCR path, blocked until provider approval.',
    status: 'server_managed',
  },
  {
    id: 'on_device',
    title: 'On-device OCR',
    detail: 'Private Apple Vision path for approved native builds.',
    status: 'planned',
  },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function totalTime(prepTimeMins?: number | null, cookTimeMins?: number | null): number | null {
  const prep = prepTimeMins ?? 0;
  const cook = cookTimeMins ?? 0;
  return prep + cook > 0 ? prep + cook : null;
}

function sourceUrlForSubmission(submissionId: string): string {
  return `https://bestchef.app/recipe/${encodeURIComponent(submissionId)}`;
}

function normalizeRecipeLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function getKitchenStats(db: DatabaseAdapter): KitchenStats {
  return {
    recipeCount: countRecipes(db),
    favoriteCount: countRecipes(db, { is_favorite: true }),
    pantryCount: getPantryItems(db).length,
    activeListCount: getShoppingLists(db, true).length,
    groceryFlaggedCount: getGroceryFlaggedRecipes(db).length,
  };
}

export function getSavedRecipes(db: DatabaseAdapter, search?: string): SavedRecipeListItem[] {
  return db.query<SavedRecipeListItem>(
    `SELECT
       r.*,
       COUNT(DISTINCT i.id) AS ingredient_count,
       COUNT(DISTINCT s.id) AS step_count,
       CASE WHEN f.recipe_id IS NULL THEN 0 ELSE 1 END AS grocery_flagged
     FROM rc_recipes r
     LEFT JOIN rc_ingredients i ON i.recipe_id = r.id
     LEFT JOIN rc_steps s ON s.recipe_id = r.id
     LEFT JOIN rc_recipe_grocery_flags f ON f.recipe_id = r.id
     WHERE (? = '' OR r.title LIKE ? ESCAPE '\\')
     GROUP BY r.id
     ORDER BY r.updated_at DESC
     LIMIT 100`,
    [search?.trim() ?? '', `%${(search ?? '').replace(/[%_]/g, (ch) => `\\${ch}`)}%`],
  );
}

export function getSavedRecipeDetails(db: DatabaseAdapter, id: string): SavedRecipeDetails | null {
  const details = getRecipeWithDetails(db, id);
  if (!details) return null;
  const nutritionSummary = calculateRecipeNutrition(db, id);
  const nutritionDetail = recipeNutritionToDetail(nutritionSummary, {
    surface: 'saved_recipe',
    subjectId: id,
    title: details.recipe.title,
    subtitle: details.recipe.servings ? `${details.recipe.servings} servings` : null,
  });
  return {
    ...details,
    groceryFlagged: isRecipeFlaggedForGrocery(db, id),
    cookHistory: getRecipeCookHistory(db, id, 5),
    nutritionSummary,
    nutritionDetail,
    ingredientNutritionDetails: buildIngredientNutritionDetails(db, details.ingredients, nutritionSummary),
  };
}

export function createSavedRecipe(db: DatabaseAdapter, input: CreateSavedRecipeInput): string {
  const recipeId = createId('recipe');
  const ingredients = splitLines(input.ingredientsText);
  const steps = splitLines(input.stepsText);

  db.transaction(() => {
    createRecipe(db, recipeId, {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      servings: input.servings ?? null,
      prep_time_mins: input.prepTimeMins ?? null,
      cook_time_mins: input.cookTimeMins ?? null,
      total_time_mins: totalTime(input.prepTimeMins, input.cookTimeMins),
      difficulty: input.difficulty ?? null,
    });

    ingredients.forEach((line, index) => {
      const parsed = parseIngredientText(line);
      addIngredient(db, createId('ingredient'), {
        recipe_id: recipeId,
        name: line,
        quantity: parsed.quantity == null ? null : String(parsed.quantity),
        quantity_value: parsed.quantity,
        unit: parsed.unit,
        item: parsed.item,
        prep_note: parsed.prepNote,
        sort_order: index,
      });
    });

    steps.forEach((instruction, index) => {
      addStep(db, createId('step'), {
        recipe_id: recipeId,
        step_number: index + 1,
        instruction,
        timer_minutes: detectStepTimerMinutes(instruction),
        sort_order: index,
      });
    });

    if (input.groceryFlagged) {
      setRecipeGroceryFlag(db, recipeId, 1);
    }
  });

  return recipeId;
}

export function updateSavedRecipe(
  db: DatabaseAdapter,
  recipeId: string,
  input: UpdateSavedRecipeInput,
): boolean {
  const existing = getRecipeWithDetails(db, recipeId);
  if (!existing) return false;

  const ingredients = splitLines(input.ingredientsText);
  const steps = splitLines(input.stepsText);

  db.transaction(() => {
    updateRecipe(db, recipeId, {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      servings: input.servings ?? null,
      prep_time_mins: input.prepTimeMins ?? null,
      cook_time_mins: input.cookTimeMins ?? null,
      total_time_mins: totalTime(input.prepTimeMins, input.cookTimeMins),
      difficulty: input.difficulty ?? null,
    });

    existing.ingredients.forEach((ingredient) => deleteIngredient(db, ingredient.id));
    ingredients.forEach((line, index) => {
      const parsed = parseIngredientText(line);
      addIngredient(db, createId('ingredient'), {
        recipe_id: recipeId,
        name: line,
        quantity: parsed.quantity == null ? null : String(parsed.quantity),
        quantity_value: parsed.quantity,
        unit: parsed.unit,
        item: parsed.item,
        prep_note: parsed.prepNote,
        sort_order: index,
      });
    });

    existing.steps.forEach((step) => deleteStep(db, step.id));
    steps.forEach((instruction, index) => {
      addStep(db, createId('step'), {
        recipe_id: recipeId,
        step_number: index + 1,
        instruction,
        timer_minutes: detectStepTimerMinutes(instruction),
        sort_order: index,
      });
    });

    if (input.groceryFlagged) {
      setRecipeGroceryFlag(db, recipeId, 1);
    } else {
      removeRecipeGroceryFlag(db, recipeId);
    }
  });

  return true;
}

export function getCommunityRecipeSaveState(
  db: DatabaseAdapter,
  submissionId: string,
): CommunityRecipeSaveState {
  const rows = db.query<Recipe>(
    `SELECT * FROM rc_recipes
     WHERE source_submission_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [submissionId],
  );
  const recipe = rows[0] ?? null;
  return {
    isSaved: recipe !== null,
    recipeId: recipe?.id ?? null,
    sourceSubmissionId: recipe?.source_submission_id ?? null,
    recipe,
  };
}

export function saveCommunityRecipeToKitchen(
  db: DatabaseAdapter,
  input: CommunityRecipeSaveInput,
): CommunityRecipeSaveState {
  const existing = getCommunityRecipeSaveState(db, input.submissionId);
  if (existing.isSaved) return existing;

  const recipeId = createId('recipe');
  const ingredients = normalizeRecipeLines(input.ingredients);
  const steps = normalizeRecipeLines(input.steps);

  db.transaction(() => {
    createRecipe(db, recipeId, {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      source_url: sourceUrlForSubmission(input.submissionId),
      source_submission_id: input.submissionId,
      source_chef_id: input.chefId,
      source_chef_name: input.chefName,
      source_chef_handle: input.chefHandle.replace(/^@/, ''),
      image_uri: input.photoUrl ?? null,
    });

    ingredients.forEach((line, index) => {
      const parsed = parseIngredientText(line);
      addIngredient(db, createId('ingredient'), {
        recipe_id: recipeId,
        name: line,
        quantity: parsed.quantity == null ? null : String(parsed.quantity),
        quantity_value: parsed.quantity,
        unit: parsed.unit,
        item: parsed.item,
        prep_note: parsed.prepNote,
        sort_order: index,
      });
    });

    steps.forEach((instruction, index) => {
      addStep(db, createId('step'), {
        recipe_id: recipeId,
        step_number: index + 1,
        instruction,
        timer_minutes: detectStepTimerMinutes(instruction),
        sort_order: index,
      });
    });
  });

  return getCommunityRecipeSaveState(db, input.submissionId);
}

export function removeCommunityRecipeFromKitchen(
  db: DatabaseAdapter,
  submissionId: string,
): boolean {
  const saved = getCommunityRecipeSaveState(db, submissionId);
  if (!saved.recipeId) return false;
  return deleteRecipe(db, saved.recipeId);
}

export function toggleRecipeFavorite(db: DatabaseAdapter, recipeId: string): boolean {
  return toggleFavorite(db, recipeId);
}

export function setSavedRecipeGroceryFlag(
  db: DatabaseAdapter,
  recipeId: string,
  flagged: boolean,
): boolean {
  if (flagged) {
    return setRecipeGroceryFlag(db, recipeId, 1) !== null;
  }
  return removeRecipeGroceryFlag(db, recipeId);
}

export function ensureShoppingList(db: DatabaseAdapter): ShoppingList {
  const existing = getShoppingLists(db, 'active')[0];
  if (existing) return existing;
  const id = createId('list');
  createShoppingList(db, id, 'Grocery List');
  const created = getShoppingListById(db, id);
  if (!created) throw new Error('Unable to create grocery list.');
  return created;
}

export function createNamedShoppingList(
  db: DatabaseAdapter,
  name: string,
  metadata: ShoppingListMetadata = {},
): ShoppingList {
  const id = createId('list');
  createShoppingList(db, id, name.trim() || 'Grocery List', metadata);
  const created = getShoppingListById(db, id);
  if (!created) throw new Error('Unable to create grocery list.');
  return created;
}

export function getGroceryListBundle(
  db: DatabaseAdapter,
  selectedListId?: string,
  filter: ShoppingListFilter = 'active',
): GroceryListBundle {
  const lists = getShoppingLists(db, filter);
  const activeLists = filter === 'active' ? lists : getShoppingLists(db, 'active');
  const archivedLists = filter === 'archived' ? lists : getShoppingLists(db, 'archived');
  const selectedList = selectedListId
    ? lists.find((list) => list.id === selectedListId) ?? null
    : lists.find((list) => list.is_active === 1) ?? lists[0] ?? null;
  const fallbackSelectedList = selectedList ?? lists[0] ?? null;

  return {
    lists,
    activeLists,
    archivedLists,
    selectedList: fallbackSelectedList,
    items: fallbackSelectedList ? groceryItemsWithNutrition(db, getShoppingListItemsWithRecipeTitles(db, fallbackSelectedList.id)) : [],
    summary: fallbackSelectedList ? getShoppingListSummary(db, fallbackSelectedList.id) : null,
    flaggedRecipes: getGroceryFlaggedRecipes(db),
    filter,
  };
}

export function duplicateShoppingListEntry(
  db: DatabaseAdapter,
  listId: string,
  name?: string,
): ShoppingList | null {
  return duplicateShoppingList(db, listId, createId('list'), () => createId('item'), {
    name,
  });
}

export function addSavedRecipeToList(
  db: DatabaseAdapter,
  recipeId: string,
  listId: string,
): void {
  removeRecipeFromShoppingList(db, listId, recipeId);
  addRecipeToShoppingList(db, listId, recipeId, 1, () => createId('item'));
}

export function removeSavedRecipeFromList(
  db: DatabaseAdapter,
  recipeId: string,
  listId: string,
): void {
  removeRecipeFromShoppingList(db, listId, recipeId);
}

export function addGroceryFlaggedRecipesToList(db: DatabaseAdapter, listId: string): number {
  return addFlaggedRecipesToShoppingList(db, listId, () => createId('item'));
}

export function addManualGroceryItem(db: DatabaseAdapter, listId: string, text: string): void {
  addCustomItem(db, createId('custom'), listId, text);
}

export function updateGroceryListItemText(db: DatabaseAdapter, itemId: string, text: string): void {
  const parsed = parseIngredientText(text);
  const itemName = parsed.item.trim() || text.trim();
  updateShoppingListItem(db, itemId, {
    item: itemName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grocery_section: categorizeItem(itemName),
  });
}

export function toggleGroceryItem(db: DatabaseAdapter, itemId: string): boolean {
  return toggleItemChecked(db, itemId);
}

export function removeGroceryListItem(db: DatabaseAdapter, itemId: string): void {
  deleteShoppingListItem(db, itemId);
}

export function copyCheckedGroceryItemsToPantry(db: DatabaseAdapter, listId: string): number {
  return addCheckedItemsToPantry(db, listId, () => createId('pantry'));
}

export function archiveShoppingList(db: DatabaseAdapter, listId: string): void {
  archiveShoppingListRecord(db, listId);
}

export function restoreShoppingList(db: DatabaseAdapter, listId: string): void {
  restoreShoppingListRecord(db, listId);
}

export function renameShoppingList(db: DatabaseAdapter, listId: string, name: string): void {
  updateShoppingList(db, listId, { name: name.trim() || 'Grocery List' });
}

export function updateShoppingListDetails(
  db: DatabaseAdapter,
  listId: string,
  details: Pick<UpdateShoppingListInput, 'name' | 'store_name' | 'event_name' | 'event_date'>,
): void {
  updateShoppingList(db, listId, {
    name: details.name?.trim() || 'Grocery List',
    store_name: details.store_name ?? null,
    event_name: details.event_name ?? null,
    event_date: details.event_date ?? null,
  });
}

export function removeShoppingList(db: DatabaseAdapter, listId: string): void {
  deleteShoppingList(db, listId);
}

export function addShoppingListMedia(
  db: DatabaseAdapter,
  listId: string,
  uri: string,
): ShoppingList | null {
  return addShoppingListMediaUri(db, listId, uri);
}

export function removeShoppingListMedia(
  db: DatabaseAdapter,
  listId: string,
  uri: string,
): ShoppingList | null {
  return removeShoppingListMediaUri(db, listId, uri);
}

export function addPantryEntry(db: DatabaseAdapter, input: CreatePantryItem): PantryItem {
  return createPantryItem(db, input);
}

export function getPantry(db: DatabaseAdapter, filters?: PantryFilters): PantryItem[] {
  return getPantryItems(db, filters);
}

function fallbackBatchForItem(item: PantryItem): PantryBatch {
  return {
    id: `${item.id}-summary-batch`,
    pantry_item_id: item.id,
    lot_code: null,
    quantity: item.quantity,
    unit: item.unit,
    expiration_date: item.expiration_date,
    purchase_date: item.purchase_date,
    source: 'manual',
    receipt_link: null,
    photos: item.photo_path ? [item.photo_path] : [],
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function getPantryBatchSections(
  db: DatabaseAdapter,
  filters?: PantryFilters,
): PantryBatchSection[] {
  const items = getPantry(db, filters);
  const rows = items.flatMap((item): PantryBatchRow[] => {
    const batches = item.batches && item.batches.length > 0
      ? item.batches
      : [fallbackBatchForItem(item)];
    const useNext = getPantryUseNextBatch(batches);
    return batches.map((batch) => ({
      item,
      batch,
      status: classifyExpiration(batch.expiration_date),
      useNext: useNext?.id === batch.id,
      nutritionDetail: getNutritionDetailForPantryBatch(db, batch.id),
      nutritionSourceChoices: getNutritionSourceChoicesForPantryItem(db, item.id),
    }));
  });

  return PANTRY_BATCH_SECTION_ORDER.map((status) => ({
    status,
    title: status,
    rows: rows
      .filter((row) => row.status === status)
      .sort((left, right) => {
        const leftDate = left.batch.expiration_date ?? '9999-12-31';
        const rightDate = right.batch.expiration_date ?? '9999-12-31';
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return left.item.name.localeCompare(right.item.name);
      }),
  }));
}

export function selectPantryNutritionSource(
  db: DatabaseAdapter,
  pantryItemId: string,
  nutritionDataId: string,
): NutritionSourceChoice {
  return selectNutritionSourceForPantryItem(db, pantryItemId, nutritionDataId);
}

export function useNextPantryBatchEntry(
  db: DatabaseAdapter,
  pantryItemId: string,
  amount = 1,
): PantryBatch | null {
  return useNextPantryBatch(db, pantryItemId, amount);
}

export function getKitchenUseNextRecipePrompts(
  db: DatabaseAdapter,
  daysAhead = 5,
  maxResults = 4,
): UseNextRecipePrompt[] {
  return suggestRecipesForUseNextBatches(db, daysAhead, maxResults);
}

export function updatePantryEntry(
  db: DatabaseAdapter,
  id: string,
  updates: Parameters<typeof updatePantryItem>[2],
): void {
  updatePantryItem(db, id, updates);
}

export function removePantryEntry(db: DatabaseAdapter, id: string): void {
  deletePantryItem(db, id);
}

export function removeSavedRecipe(db: DatabaseAdapter, recipeId: string): void {
  deleteRecipe(db, recipeId);
}

export function getSavedRecipeCookReview(
  db: DatabaseAdapter,
  recipeId: string,
): KitchenRecipeCookReview | null {
  return getRecipeCookPantryReview(db, recipeId);
}

export function addCookReviewIngredientToPantry(
  db: DatabaseAdapter,
  recipeId: string,
  ingredientId: string,
): PantryItem | null {
  return addRecipeIngredientToPantry(db, recipeId, ingredientId);
}

export function applySavedRecipeCookReview(
  db: DatabaseAdapter,
  input: KitchenRecipeCookApplyInput,
): KitchenRecipeCookApplyResult {
  return applyRecipeCookPantryReview(db, input);
}

interface AvailabilityIngredientInput {
  id: string;
  name: string;
  item?: string | null;
  quantity?: string | null;
  quantity_value?: number | null;
  unit?: string | null;
}

interface PantryQuantityTotal {
  quantity: number | null;
  unit: string | null;
  unitMismatch: boolean;
}

const AVAILABILITY_MATCH_THRESHOLD = 0.6;
const QUANTITY_EPSILON = 0.0001;

function ingredientItemName(ingredient: AvailabilityIngredientInput): string {
  return ingredient.item?.trim() || ingredient.name.trim();
}

function pantryBatchesForAvailability(item: PantryItem): PantryBatch[] {
  return item.batches && item.batches.length > 0 ? item.batches : [fallbackBatchForItem(item)];
}

function hasBatchQuantity(batch: PantryBatch): boolean {
  return batch.quantity === null || batch.quantity > 0;
}

function findAvailabilityPantryMatch(
  ingredient: AvailabilityIngredientInput,
  pantryItems: PantryItem[],
): { item: PantryItem; score: number } | null {
  const ingredientItem = ingredientItemName(ingredient);
  return pantryItems
    .map((item) => ({ item, score: fuzzyItemMatch(ingredientItem, item.name) }))
    .filter((entry) => entry.score >= AVAILABILITY_MATCH_THRESHOLD)
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

function totalUsableQuantity(
  batches: PantryBatch[],
  ingredientUnit: string | null,
): PantryQuantityTotal {
  let total = 0;
  let hasKnownQuantity = false;
  let unitMismatch = false;
  let displayUnit: string | null = ingredientUnit;

  for (const batch of batches) {
    if (batch.quantity === null) {
      return {
        quantity: null,
        unit: batch.unit ?? ingredientUnit,
        unitMismatch: false,
      };
    }

    hasKnownQuantity = true;
    if (!ingredientUnit) {
      total += batch.quantity;
      displayUnit = displayUnit ?? batch.unit;
      continue;
    }

    if (!batch.unit) {
      unitMismatch = true;
      continue;
    }

    if (batch.unit === ingredientUnit) {
      total += batch.quantity;
      continue;
    }

    if (areUnitsCompatible(batch.unit, ingredientUnit)) {
      const converted = convertUnit(batch.quantity, batch.unit, ingredientUnit);
      if (converted !== null) {
        total += converted;
        continue;
      }
    }

    unitMismatch = true;
  }

  return {
    quantity: hasKnownQuantity ? total : null,
    unit: displayUnit,
    unitMismatch,
  };
}

function createAvailabilityRow(
  ingredient: AvailabilityIngredientInput,
  status: IngredientAvailabilityStatus,
  options: {
    pantryItem?: PantryItem | null;
    pantryQuantity?: number | null;
    pantryUnit?: string | null;
    matchScore?: number;
    note?: string | null;
  } = {},
): IngredientAvailabilityRow {
  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    ingredientItem: ingredientItemName(ingredient),
    quantity: ingredient.quantity ?? null,
    quantityValue: ingredient.quantity_value ?? null,
    unit: ingredient.unit ?? null,
    status,
    pantryItemId: options.pantryItem?.id ?? null,
    pantryItemName: options.pantryItem?.name ?? null,
    pantryQuantity: options.pantryQuantity ?? options.pantryItem?.quantity ?? null,
    pantryUnit: options.pantryUnit ?? options.pantryItem?.unit ?? null,
    matchScore: options.matchScore ?? 0,
    note: options.note ?? null,
    shoppingNeeded: status !== 'in-pantry',
  };
}

function evaluateIngredientAvailability(
  ingredient: AvailabilityIngredientInput,
  pantryItems: PantryItem[],
): IngredientAvailabilityRow {
  const match = findAvailabilityPantryMatch(ingredient, pantryItems);
  if (!match) {
    return createAvailabilityRow(ingredient, 'missing');
  }

  const batches = pantryBatchesForAvailability(match.item).filter(hasBatchQuantity);
  const usableBatches = batches.filter((batch) => classifyExpiration(batch.expiration_date) !== 'expired');
  const expiredBatches = batches.filter((batch) => classifyExpiration(batch.expiration_date) === 'expired');

  if (usableBatches.length === 0) {
    return createAvailabilityRow(ingredient, expiredBatches.length > 0 ? 'expired' : 'missing', {
      pantryItem: match.item,
      matchScore: match.score,
      note: expiredBatches.length > 0 ? 'Pantry item is expired.' : null,
    });
  }

  const quantityValue = ingredient.quantity_value ?? null;
  const available = totalUsableQuantity(usableBatches, ingredient.unit ?? null);
  if (quantityValue !== null && available.quantity !== null) {
    if (available.unitMismatch) {
      return createAvailabilityRow(ingredient, 'in-pantry', {
        pantryItem: match.item,
        pantryQuantity: available.quantity,
        pantryUnit: available.unit,
        matchScore: match.score,
        note: 'Check pantry quantity manually.',
      });
    }

    if (available.quantity + QUANTITY_EPSILON < quantityValue) {
      return createAvailabilityRow(ingredient, 'low', {
        pantryItem: match.item,
        pantryQuantity: available.quantity,
        pantryUnit: available.unit,
        matchScore: match.score,
        note: 'Pantry has some, but not enough.',
      });
    }
  }

  return createAvailabilityRow(ingredient, 'in-pantry', {
    pantryItem: match.item,
    pantryQuantity: available.quantity,
    pantryUnit: available.unit,
    matchScore: match.score,
  });
}

function summarizeIngredientAvailability(rows: IngredientAvailabilityRow[]): IngredientAvailabilitySummary {
  const onHandCount = rows.filter((row) => row.status === 'in-pantry').length;
  const lowCount = rows.filter((row) => row.status === 'low').length;
  const expiredCount = rows.filter((row) => row.status === 'expired').length;
  const missingCount = rows.filter((row) => row.status === 'missing').length;
  return {
    rows,
    totalCount: rows.length,
    onHandCount,
    lowCount,
    expiredCount,
    missingCount,
    shoppingNeededCount: rows.filter((row) => row.shoppingNeeded).length,
  };
}

function getIngredientAvailabilitySummary(
  ingredients: AvailabilityIngredientInput[],
  pantryItems: PantryItem[],
): IngredientAvailabilitySummary {
  return summarizeIngredientAvailability(
    ingredients.map((ingredient) => evaluateIngredientAvailability(ingredient, pantryItems)),
  );
}

export function getSavedRecipeIngredientAvailability(
  db: DatabaseAdapter,
  recipeId: string,
): IngredientAvailabilitySummary {
  const details = getRecipeWithDetails(db, recipeId);
  if (!details) {
    return summarizeIngredientAvailability([]);
  }
  return getIngredientAvailabilitySummary(details.ingredients, getPantry(db));
}

export function getIngredientListAvailability(
  db: DatabaseAdapter,
  input: {
    submissionId: string;
    title: string;
    ingredients: string[];
  },
): IngredientAvailabilitySummary {
  const ingredients = buildIngredientRows(input.ingredients, input.submissionId);
  return getIngredientAvailabilitySummary(ingredients, getPantry(db));
}

export function addIngredientAvailabilityRowsToGroceryList(
  db: DatabaseAdapter,
  listId: string,
  rows: IngredientAvailabilityRow[],
  recipeId: string | null = null,
): number {
  const neededRows = rows.filter((row) => row.shoppingNeeded);
  db.transaction(() => {
    neededRows.forEach((row, index) => {
      addShoppingListItem(db, createId('item'), listId, {
        item: row.ingredientItem,
        quantity: row.quantityValue,
        unit: row.unit,
        grocery_section: categorizeItem(row.ingredientItem),
        recipe_id: recipeId,
        is_custom: recipeId ? 0 : 1,
        sort_order: index,
      });
    });
  });
  return neededRows.length;
}

/**
 * Add a flat list of ingredient strings to the default (or specified) shopping
 * list. Creates the list if none exists. Returns the number of items added.
 * Used by RecipeActionPills "Add to grocery" on the recipe detail screen.
 */
export function addRecipeIngredientsToGrocery(
  db: DatabaseAdapter,
  ingredients: string[],
  listId?: string,
): number {
  if (ingredients.length === 0) return 0;
  const list = listId
    ? (getShoppingListById(db, listId) ?? ensureShoppingList(db))
    : ensureShoppingList(db);
  ingredients.forEach((item, index) => {
    addShoppingListItem(db, createId('item'), list.id, {
      item,
      grocery_section: categorizeItem(item),
      sort_order: index,
    });
  });
  return ingredients.length;
}

export async function createKitchenReceiptImport(
  db: DatabaseAdapter,
  input: CreateKitchenReceiptImportInput,
): Promise<ReceiptImportReview> {
  const rawOcrText = input.rawOcrText?.trim();
  const ocrProvider = input.ocrProvider
    ?? (rawOcrText ? 'manual_text' : input.supabase || input.apiKey ? 'claude_vision' : 'manual_text');
  const provider = ocrProvider === 'manual_text' && rawOcrText
    ? createManualReceiptOcrProvider(rawOcrText)
    : ocrProvider === 'claude_vision' && input.supabase
      ? createBrokerReceiptOcrProvider(input.supabase)
      : ocrProvider === 'claude_vision' && input.apiKey
        ? createClaudeReceiptOcrProvider(input.apiKey)
        : undefined;
  const nutritionProviders = input.includeNetworkNutrition
    ? defaultNutritionProviders(input)
    : input.nutritionProviders ?? [];

  return createReceiptImportDraft(
    db,
    {
      photoUri: input.photoUri,
      photoMime: input.photoMime ?? 'image/jpeg',
      imageBase64: input.imageBase64,
      rawOcrText: ocrProvider === 'manual_text' ? rawOcrText || undefined : undefined,
    },
    provider,
    {
      includeNetworkNutrition: input.includeNetworkNutrition ?? false,
      nutritionProviders,
    },
  );
}

function defaultNutritionProviders(input: {
  nutritionProviders?: NutritionProviderAdapter[];
  usdaApiKey?: string | null;
  gs1ApiKey?: string | null;
  gs1Endpoint?: string | null;
  supabase?: SupabaseClient | null;
}): NutritionProviderAdapter[] {
  if (input.nutritionProviders) return input.nutritionProviders;
  if (input.supabase) {
    return [
      createBrokerNutritionAdapter(input.supabase, 'open_food_facts'),
      createBrokerNutritionAdapter(input.supabase, 'usda_fdc'),
    ];
  }
  return [
    createOpenFoodFactsNutritionAdapter(),
    createUsdaFoodDataCentralAdapter({ apiKey: input.usdaApiKey ?? null }),
    createGs1DataHubIdentityAdapter({
      apiKey: input.gs1ApiKey ?? null,
      endpoint: input.gs1Endpoint ?? null,
    }),
  ];
}

function getShoppingListItemsWithRecipeTitles(
  db: DatabaseAdapter,
  listId: string,
): Array<ShoppingListItemRow & { recipe_title: string | null }> {
  return db.query<ShoppingListItemRow & { recipe_title: string | null }>(
    `SELECT sli.*, r.title AS recipe_title
     FROM rc_shopping_list_items sli
     LEFT JOIN rc_recipes r ON r.id = sli.recipe_id
     WHERE sli.list_id = ?
     ORDER BY sli.sort_order, sli.grocery_section, sli.item`,
    [listId],
  );
}

function groceryItemsWithNutrition(
  db: DatabaseAdapter,
  items: Array<ShoppingListItemRow & { recipe_title: string | null }>,
): KitchenShoppingListItemRow[] {
  return items.map((item) => ({
    ...item,
    nutritionDetail: getNutritionDetailForGroceryItem(db, item.id),
  }));
}

function buildIngredientRows(ingredients: string[], prefix: string): Array<{
  id: string;
  item: string | null;
  name: string;
  quantity: string | null;
  quantity_value: number | null;
  unit: string | null;
}> {
  return ingredients.map((line, index) => {
    const parsed = parseIngredientText(line);
    return {
      id: `${prefix}:ingredient:${index}`,
      item: parsed.item,
      name: line,
      quantity: parsed.quantity === null ? null : String(parsed.quantity),
      quantity_value: parsed.quantity,
      unit: parsed.unit,
    };
  });
}

function buildIngredientNutritionDetails(
  db: DatabaseAdapter,
  ingredients: Ingredient[],
  summary: RecipeNutritionSummary,
): NutritionDetail[] {
  return ingredients.map((ingredient) => {
    const conversion = summary.ingredientConversions.find((entry) => entry.ingredientId === ingredient.id);
    if (conversion?.nutritionDataId) {
      return getNutritionDetailForNutritionData(db, conversion.nutritionDataId, {
        surface: 'recipe_ingredient',
        subjectId: ingredient.id,
        title: conversion.ingredientName,
        subtitle: [
          conversion.sourceLabel,
          conversion.sourceId ? `Source ${conversion.sourceId}` : null,
          conversion.warnings.length > 0 ? conversion.warnings.join(', ') : null,
        ].filter(Boolean).join(' / ') || null,
      }) ?? createMissingNutritionDetail({
        surface: 'recipe_ingredient',
        subjectId: ingredient.id,
        title: ingredient.item ?? ingredient.name,
        subtitle: 'Nutrition source was unavailable.',
      });
    }

    const missing = summary.missingIngredientDetails.find((entry) => entry.ingredientId === ingredient.id);
    return createMissingNutritionDetail({
      surface: 'recipe_ingredient',
      subjectId: ingredient.id,
      title: ingredient.item ?? ingredient.name,
      subtitle: missing?.reason === 'no_pantry_match'
        ? 'No pantry match for this ingredient.'
        : 'No nutrition record is linked to this ingredient.',
    });
  });
}

function buildAdHocIngredientDetails(
  db: DatabaseAdapter,
  summary: RecipeNutritionSummary,
  ingredients: Array<{ id: string; item: string | null; name: string }>,
): NutritionDetail[] {
  return ingredients.map((ingredient) => {
    const conversion = summary.ingredientConversions.find((entry) => entry.ingredientId === ingredient.id);
    if (!conversion?.nutritionDataId) {
      const missing = summary.missingIngredientDetails.find((entry) => entry.ingredientId === ingredient.id);
      return createMissingNutritionDetail({
        surface: 'recipe_ingredient',
        subjectId: ingredient.id,
        title: ingredient.item ?? ingredient.name,
        subtitle: missing?.reason === 'no_pantry_match'
          ? 'No pantry match for this ingredient.'
          : 'No nutrition record is linked to this ingredient.',
      });
    }
    return getNutritionDetailForNutritionData(db, conversion.nutritionDataId, {
      surface: 'recipe_ingredient',
      subjectId: conversion.ingredientId,
      title: conversion.ingredientName,
      subtitle: [
        conversion.sourceLabel,
        conversion.sourceId ? `Source ${conversion.sourceId}` : null,
        conversion.warnings.length > 0 ? conversion.warnings.join(', ') : null,
      ].filter(Boolean).join(' / ') || null,
    }) ?? createMissingNutritionDetail({
      surface: 'recipe_ingredient',
      subjectId: conversion.ingredientId,
      title: conversion.ingredientName,
      subtitle: 'Nutrition source was unavailable.',
    });
  });
}

export function getSubmissionRecipeNutrition(
  db: DatabaseAdapter,
  input: {
    submissionId: string;
    title: string;
    ingredients: string[];
    servings?: number | null;
  },
): KitchenRecipeNutritionBundle {
  const ingredients = buildIngredientRows(input.ingredients, input.submissionId);
  const summary = calculateIngredientListNutrition(db, {
    recipeId: input.submissionId,
    servings: input.servings ?? 1,
    ingredients,
  });
  return {
    summary,
    detail: recipeNutritionToDetail(summary, {
      surface: 'recipe',
      subjectId: input.submissionId,
      title: input.title,
      subtitle: `${summary.coveragePercent}% nutrition coverage`,
    }),
    ingredientDetails: buildAdHocIngredientDetails(db, summary, ingredients),
  };
}

export function getDishNutrition(
  db: DatabaseAdapter,
  input: {
    dishId: string;
    title: string;
    submissions?: KitchenDishNutritionSubmission[];
  },
): KitchenRecipeNutritionBundle {
  const ingredients = input.submissions?.flatMap((submission) => (
    buildIngredientRows(submission.ingredients, submission.id)
  ));
  const summary = input.submissions && input.submissions.length > 0
    ? calculateIngredientListNutrition(db, {
        recipeId: `dish:${input.dishId}`,
        servings: input.submissions.length,
        ingredients: ingredients ?? [],
      })
    : calculateDishNutrition(db, input.dishId);

  return {
    summary,
    detail: recipeNutritionToDetail(summary, {
      surface: 'dish',
      subjectId: input.dishId,
      title: input.title,
      subtitle: input.submissions?.length
        ? `${input.submissions.length} recipe submissions sampled`
        : `${summary.coveragePercent}% nutrition coverage`,
    }),
    ingredientDetails: buildAdHocIngredientDetails(db, summary, ingredients ?? []),
  };
}

export async function createKitchenFoodPhotoReview(
  db: DatabaseAdapter,
  input: CreateKitchenFoodPhotoReviewInput,
): Promise<KitchenFoodPhotoReview> {
  const rawCandidateJson = input.rawCandidateJson?.trim();
  const result = rawCandidateJson
    ? parseFoodRecognitionResult(rawCandidateJson)
    : input.supabase && input.imageBase64
      ? await identifyFoodViaBroker(input.supabase, input.imageBase64, input.photoMime ?? 'image/jpeg')
      : input.apiKey && input.imageBase64
        ? await identifyFood(input.imageBase64, input.apiKey, input.photoMime ?? 'image/jpeg')
        : parseFoodRecognitionResult('{"candidates":[]}');
  const candidates = await enrichFoodRecognitionCandidates(db, result.candidates, {
    providers: defaultNutritionProviders(input),
    includeNetwork: input.includeNetworkNutrition ?? true,
  });

  return {
    photoUri: input.photoUri,
    photoMime: input.photoMime ?? 'image/jpeg',
    candidates,
    labels: result.labels,
    rawText: result.rawText ?? null,
  };
}

export function confirmKitchenFoodPhotoCandidates(
  db: DatabaseAdapter,
  inputs: FoodRecognitionConfirmationInput[],
): FoodRecognitionConfirmationResult[] {
  return confirmFoodRecognitionCandidatesToPantry(db, inputs);
}

function expirationReviewNeedsManualSelection(candidates: ExpirationDateCandidate[]): boolean {
  return candidates.length !== 1 || candidates.some((candidate) => candidate.requiresManualSelection);
}

function expirationOcrStatusMessage(status: ExpirationOcrProviderStatus, fallback?: string | null): string {
  if (fallback) return fallback;
  switch (status) {
    case 'manual':
      return 'Manual expiration OCR text parsed locally.';
    case 'parsed':
      return 'Expiration OCR parsed candidates without changing pantry data.';
    case 'failed':
      return 'Expiration OCR did not find a usable date.';
    case 'unavailable':
      return 'Selected expiration OCR provider is not available in this build.';
  }
}

function createUnavailableExpirationReview(
  input: CreateKitchenExpirationReviewInput,
  ocrProvider: ExpirationOcrProviderChoice,
  message: string,
): KitchenExpirationReview {
  return {
    photoUri: input.photoUri,
    photoMime: input.photoMime ?? 'image/jpeg',
    ocrProvider,
    providerStatus: 'unavailable',
    providerMessage: message,
    rawText: input.rawOcrText?.trim() ?? '',
    confidence: 0,
    candidates: [],
    requiresManualSelection: true,
  };
}

export async function createKitchenExpirationReview(
  input: CreateKitchenExpirationReviewInput,
): Promise<KitchenExpirationReview> {
  const rawOcrText = input.rawOcrText?.trim();
  const ocrProvider = input.ocrProvider
    ?? (rawOcrText ? 'manual_text' : input.supabase || input.apiKey ? 'claude_vision' : 'manual_text');

  if (ocrProvider === 'managed_cloud') {
    return createUnavailableExpirationReview(
      input,
      ocrProvider,
      'Managed cloud expiration OCR is pending provider infrastructure. No pantry data changed.',
    );
  }

  if (ocrProvider === 'on_device') {
    return createUnavailableExpirationReview(
      input,
      ocrProvider,
      'On-device expiration OCR is pending native provider approval. No pantry data changed.',
    );
  }

  if (ocrProvider === 'claude_vision' && !input.imageBase64) {
    return createUnavailableExpirationReview(
      input,
      ocrProvider,
      'Vision expiration OCR requires a selected image. No pantry data changed.',
    );
  }

  if (ocrProvider === 'claude_vision' && !input.supabase && !input.apiKey) {
    return createUnavailableExpirationReview(
      input,
      ocrProvider,
      'Vision expiration OCR is not available in this build. No pantry data changed.',
    );
  }

  const provider = ocrProvider === 'manual_text'
    ? createStaticExpirationOcrProvider(rawOcrText ?? '')
    : input.supabase
      ? createBrokerExpirationOcrProvider(input.supabase)
      : createClaudeExpirationOcrProvider(input.apiKey ?? '');
  const result = await recognizeExpirationDates(
    {
      photoUri: input.photoUri,
      photoMime: input.photoMime ?? 'image/jpeg',
      imageBase64: input.imageBase64,
      boundingBox: input.boundingBox ?? null,
      cropUri: input.cropUri ?? null,
      rawText: rawOcrText || undefined,
    },
    provider,
  );
  const providerStatus = result.providerStatus ?? (result.candidates.length > 0 ? 'parsed' : 'failed');

  return {
    photoUri: input.photoUri,
    photoMime: input.photoMime ?? 'image/jpeg',
    ocrProvider,
    providerStatus,
    providerMessage: expirationOcrStatusMessage(providerStatus, result.providerError),
    rawText: result.rawText,
    confidence: result.confidence,
    candidates: result.candidates,
    requiresManualSelection: expirationReviewNeedsManualSelection(result.candidates),
  };
}

export function confirmKitchenExpirationDate(
  db: DatabaseAdapter,
  input: ExpirationDateConfirmationInput,
): ExpirationDateConfirmationResult {
  return confirmExpirationDateForPantryBatch(db, input);
}

export function getKitchenReceiptReview(
  db: DatabaseAdapter,
  receiptImportId: string,
): ReceiptImportReview | null {
  return getReceiptImportReview(db, receiptImportId);
}

export function confirmKitchenReceiptLines(
  db: DatabaseAdapter,
  receiptImportId: string,
  inputs: ReceiptLineConfirmationInput[],
): ReceiptImportConfirmationResult {
  return confirmReceiptImportLines(db, receiptImportId, inputs);
}

export function ignoreKitchenReceiptLine(db: DatabaseAdapter, lineId: string): void {
  ignoreReceiptImportLine(db, lineId);
}

export function undoKitchenReceiptLine(db: DatabaseAdapter, lineId: string): void {
  undoReceiptImportLine(db, lineId);
}
