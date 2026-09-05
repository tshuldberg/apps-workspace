import { z } from 'zod';
import type {
  NutritionBreakdown as SharedNutritionBreakdown,
  RecipeNutritionSummary as SharedRecipeNutritionSummary,
} from '@mylife/nutrition-engine';

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const RecipeSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  servings: z.number().int().positive().nullable(),
  prep_time_mins: z.number().int().nonnegative().nullable(),
  cook_time_mins: z.number().int().nonnegative().nullable(),
  total_time_mins: z.number().int().nonnegative().nullable(),
  difficulty: DifficultySchema.nullable(),
  source_url: z.string().nullable(),
  source_submission_id: z.string().nullable(),
  source_chef_id: z.string().nullable(),
  source_chef_name: z.string().nullable(),
  source_chef_handle: z.string().nullable(),
  image_uri: z.string().nullable(),
  is_favorite: z.number().int().min(0).max(1),
  rating: z.number().int().min(0).max(5),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  servings: true,
  prep_time_mins: true,
  cook_time_mins: true,
  total_time_mins: true,
  difficulty: true,
  source_url: true,
  source_submission_id: true,
  source_chef_id: true,
  source_chef_name: true,
  source_chef_handle: true,
  image_uri: true,
  is_favorite: true,
  rating: true,
  notes: true,
});

export type CreateRecipe = z.infer<typeof CreateRecipeSchema>;

export const UpdateRecipeSchema = CreateRecipeSchema.partial();
export type UpdateRecipe = z.infer<typeof UpdateRecipeSchema>;

export const IngredientSchema = z.object({
  id: z.string(),
  recipe_id: z.string(),
  name: z.string().min(1),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  sort_order: z.number().int(),
  section: z.string().nullable().optional(),
  quantity_value: z.number().nullable().optional(),
  item: z.string().nullable().optional(),
  prep_note: z.string().nullable().optional(),
  is_optional: z.number().int().min(0).max(1).optional(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

export const CreateIngredientSchema = IngredientSchema.omit({ id: true }).partial({
  quantity: true,
  unit: true,
  sort_order: true,
  section: true,
  quantity_value: true,
  item: true,
  prep_note: true,
  is_optional: true,
});

export type CreateIngredient = z.infer<typeof CreateIngredientSchema>;

export interface StructuredIngredient {
  id: string;
  recipe_id: string;
  section: string | null;
  quantity_value: number | null;
  quantity: string | null;
  unit: string | null;
  item: string;
  name: string;
  prep_note: string | null;
  is_optional: number;
  sort_order: number;
}

export interface ParsedIngredient {
  raw: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  prepNote: string | null;
}

export const RecipeTagSchema = z.object({
  id: z.string(),
  recipe_id: z.string(),
  tag: z.string().min(1),
});

export type RecipeTag = z.infer<typeof RecipeTagSchema>;

export interface RecipeFilters {
  search?: string;
  is_favorite?: boolean;
  difficulty?: Difficulty;
  tag?: string;
  limit?: number;
  offset?: number;
}

export const StepSchema = z.object({
  id: z.string(),
  recipe_id: z.string(),
  step_number: z.number().int().positive(),
  instruction: z.string().min(1),
  timer_minutes: z.number().int().positive().nullable(),
  sort_order: z.number().int(),
  section: z.string().nullable().optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const CreateStepSchema = StepSchema.omit({ id: true }).partial({
  timer_minutes: true,
  sort_order: true,
  section: true,
});
export type CreateStep = z.infer<typeof CreateStepSchema>;

export interface CookingStepWithTimer extends Step {
  inferred_timer_minutes: number | null;
}

export const MealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealSlot = z.infer<typeof MealSlotSchema>;

export const MealPlanSchema = z.object({
  id: z.string(),
  week_start_date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MealPlan = z.infer<typeof MealPlanSchema>;

export const MealPlanItemSchema = z.object({
  id: z.string(),
  meal_plan_id: z.string(),
  recipe_id: z.string(),
  day_of_week: z.number().int().min(0).max(6),
  meal_slot: MealSlotSchema,
  servings: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MealPlanItem = z.infer<typeof MealPlanItemSchema>;

export interface MealPlanWeek {
  plan: MealPlan;
  items: Array<MealPlanItem & { recipe_title: string; recipe_image_uri: string | null }>;
}

export const PlantLocationSchema = z.enum(['indoor', 'outdoor', 'raised_bed', 'container']);
export type PlantLocation = z.infer<typeof PlantLocationSchema>;

export const GardenPlantSchema = z.object({
  id: z.string(),
  species: z.string(),
  location: PlantLocationSchema,
  planting_date: z.string(),
  watering_interval_days: z.number().int().positive(),
  last_watered_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type GardenPlant = z.infer<typeof GardenPlantSchema>;

export type PlantCareType = 'watered' | 'fertilized' | 'pruned' | 'repotted' | 'note';

export interface PlantCareLog {
  id: string;
  plant_id: string;
  care_type: PlantCareType;
  performed_at: string;
  notes: string | null;
  created_at: string;
}

export interface GardenLayoutCell {
  x: number;
  y: number;
  plantId: string | null;
  species: string | null;
}

export interface GardenLayout {
  id: string;
  name: string;
  grid_width: number;
  grid_height: number;
  cells_json: string;
  created_at: string;
  updated_at: string;
}

export interface GardenJournalEntry {
  id: string;
  plant_id: string | null;
  photo_path: string;
  note: string | null;
  identified_species: string | null;
  captured_at: string;
  created_at: string;
}

export interface Harvest {
  id: string;
  plant_id: string | null;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  harvested_at: string;
  note: string | null;
  created_at: string;
}

export interface HarvestRecipeLink {
  id: string;
  harvest_id: string;
  recipe_id: string;
  match_reason: string | null;
  created_at: string;
}

export interface GardenPlantDashboard extends GardenPlant {
  next_watering_date: string;
  needs_water: boolean;
  overdue_days: number;
}

export const EventResponseSchema = z.enum(['attending', 'maybe', 'declined']);
export type EventResponse = z.infer<typeof EventResponseSchema>;

export type EventCourse = 'appetizer' | 'main' | 'side' | 'dessert' | 'drink';

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  event_date: z.string(),
  event_time: z.string(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  capacity: z.number().int().nullable(),
  invite_token: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Event = z.infer<typeof EventSchema>;

export interface EventGuest {
  id: string;
  event_id: string;
  name: string;
  contact: string | null;
  dietary_preferences: string | null;
  allergies: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  guest_id: string;
  response: EventResponse;
  note: string | null;
  responded_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventMenuItem {
  id: string;
  event_id: string;
  recipe_id: string;
  course: EventCourse;
  servings: number;
  created_at: string;
  updated_at: string;
}

export interface EventPotluckClaim {
  id: string;
  event_id: string;
  guest_id: string;
  dish_name: string;
  note: string | null;
  claimed_at: string;
  created_at: string;
}

export interface EventTimelineItem {
  id: string;
  event_id: string;
  label: string;
  starts_at: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventAllergyWarning {
  guest_name: string;
  allergy: string;
  recipe_id: string;
  recipe_title: string;
  ingredient: string;
}

export interface EventBundle {
  event: Event;
  guests: EventGuest[];
  rsvps: EventRsvp[];
  menu: EventMenuItem[];
  potluck: EventPotluckClaim[];
  timeline: EventTimelineItem[];
  allergyWarnings: EventAllergyWarning[];
}

export interface EventInviteBundle {
  event: Event;
  menu: Array<{
    recipe_id: string;
    recipe_title: string;
    servings: number;
    course: EventCourse;
  }>;
  timeline: EventTimelineItem[];
  rsvpSummary: {
    attending: number;
    maybe: number;
    declined: number;
  };
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  servings?: number;
  ingredients: string[];
  steps: string[];
}

export type GrocerySection =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'pantry'
  | 'frozen'
  | 'bakery'
  | 'beverages'
  | 'snacks'
  | 'condiments'
  | 'other';

export interface MergedGroceryItem {
  item: string;
  quantity: number | null;
  unit: string | null;
  section: GrocerySection;
  recipeIds: string[];
}

export interface ShoppingListItem {
  item: string;
  quantity: number | null;
  unit: string | null;
  grocerySection: GrocerySection;
  inPantry: boolean;
  pantryQuantity: number | null;
  pantryUnit: string | null;
  needed: number | null;
  recipeIds: string[];
}

export interface ConsolidatedShoppingItem {
  item: string;
  quantity: number | null;
  unit: string | null;
  in_stock: boolean;
  grocery_section?: GrocerySection;
  needed?: number | null;
  recipe_ids?: string[];
}

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter' | 'other';
export type ExpirationStatus = 'fresh' | 'expiring_soon' | 'expired' | 'no_date';
export type PantryBatchSource =
  | 'manual'
  | 'grocery_list'
  | 'receipt_ocr'
  | 'barcode_scan'
  | 'food_recognition'
  | 'expiration_ocr'
  | 'import'
  | 'migration';

export const FoodDataSourceSchema = z.enum([
  'manual',
  'unknown',
  'open_food_facts',
  'usda_fdc',
  'gs1',
  'bestchef_cache',
  'local_cache',
  'receipt_ocr',
  'food_recognition',
]);
export type FoodDataSource = z.infer<typeof FoodDataSourceSchema>;

export const FoodProductTypeSchema = z.enum([
  'generic',
  'branded',
  'raw_ingredient',
  'prepared_food',
]);
export type FoodProductType = z.infer<typeof FoodProductTypeSchema>;

export const FoodProductAliasTypeSchema = z.enum([
  'barcode',
  'name',
  'receipt_line',
  'ocr_label',
  'source_id',
]);
export type FoodProductAliasType = z.infer<typeof FoodProductAliasTypeSchema>;

export const FoodConfirmationSubjectTypeSchema = z.enum([
  'food_product',
  'product_alias',
  'nutrition_data',
  'pantry_item',
]);
export type FoodConfirmationSubjectType = z.infer<typeof FoodConfirmationSubjectTypeSchema>;

export const FoodConfirmationDecisionSchema = z.enum([
  'confirmed',
  'rejected',
  'manual_override',
]);
export type FoodConfirmationDecision = z.infer<typeof FoodConfirmationDecisionSchema>;

export const FoodConfirmationStatusSchema = z.enum([
  'unconfirmed',
  'confirmed',
  'rejected',
  'needs_review',
]);
export type FoodConfirmationStatus = z.infer<typeof FoodConfirmationStatusSchema>;

export const NutritionServingBasisSchema = z.enum([
  'per_serving',
  'per_100g',
  'per_100ml',
  'per_package',
  'per_item',
]);
export type NutritionServingBasis = z.infer<typeof NutritionServingBasisSchema>;

export const FoodProductSchema = z.object({
  id: z.string(),
  canonical_name: z.string().min(1),
  brand: z.string().nullable(),
  manufacturer: z.string().nullable(),
  product_type: FoodProductTypeSchema,
  grocery_section: z.custom<GrocerySection>(),
  default_storage_location: z.custom<StorageLocation>().nullable(),
  image_uri: z.string().nullable(),
  source: FoodDataSourceSchema,
  source_id: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  is_user_confirmed: z.number().int().min(0).max(1),
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FoodProduct = z.infer<typeof FoodProductSchema>;

export const CreateFoodProductSchema = FoodProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  brand: true,
  manufacturer: true,
  product_type: true,
  grocery_section: true,
  default_storage_location: true,
  image_uri: true,
  source: true,
  source_id: true,
  confidence: true,
  is_user_confirmed: true,
  confirmed_at: true,
});
export type CreateFoodProduct = z.infer<typeof CreateFoodProductSchema>;

export const UpdateFoodProductSchema = CreateFoodProductSchema.partial();
export type UpdateFoodProduct = z.infer<typeof UpdateFoodProductSchema>;

export const FoodProductAliasSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  alias_type: FoodProductAliasTypeSchema,
  alias_value: z.string().min(1),
  normalized_value: z.string().min(1),
  source: FoodDataSourceSchema,
  source_id: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  fetched_at: z.string(),
  is_user_confirmed: z.number().int().min(0).max(1),
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FoodProductAlias = z.infer<typeof FoodProductAliasSchema>;

export const CreateFoodProductAliasSchema = FoodProductAliasSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  normalized_value: true,
  source: true,
  source_id: true,
  confidence: true,
  fetched_at: true,
  is_user_confirmed: true,
  confirmed_at: true,
});
export type CreateFoodProductAlias = z.infer<typeof CreateFoodProductAliasSchema>;

export const UpdateFoodProductAliasSchema = CreateFoodProductAliasSchema.partial().extend({
  alias_type: FoodProductAliasTypeSchema.optional(),
  alias_value: z.string().min(1).optional(),
});
export type UpdateFoodProductAlias = z.infer<typeof UpdateFoodProductAliasSchema>;

export const FoodConfirmationSchema = z.object({
  id: z.string(),
  subject_type: FoodConfirmationSubjectTypeSchema,
  subject_id: z.string(),
  decision: FoodConfirmationDecisionSchema,
  confidence: z.number().min(0).max(1).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type FoodConfirmation = z.infer<typeof FoodConfirmationSchema>;

export const CreateFoodConfirmationSchema = FoodConfirmationSchema.omit({
  id: true,
  created_at: true,
}).partial({
  confidence: true,
  notes: true,
});
export type CreateFoodConfirmation = z.infer<typeof CreateFoodConfirmationSchema>;

export interface PantryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  storage_location: StorageLocation;
  expiration_date: string | null;
  purchase_date: string | null;
  barcode: string | null;
  photo_path: string | null;
  notes: string | null;
  grocery_section: GrocerySection;
  is_staple: number;
  product_id: string | null;
  nutrition_data_id: string | null;
  confirmation_status: FoodConfirmationStatus;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  batch_count?: number;
  use_next_batch_id?: string | null;
  batches?: PantryBatch[];
}

export interface CreatePantryItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  storage_location: StorageLocation;
  expiration_date?: string | null;
  purchase_date?: string | null;
  barcode?: string | null;
  photo_path?: string | null;
  notes?: string | null;
  grocery_section?: GrocerySection;
  is_staple?: number;
  product_id?: string | null;
  nutrition_data_id?: string | null;
  confirmation_status?: FoodConfirmationStatus;
  confirmed_at?: string | null;
  lot_code?: string | null;
  batch_source?: PantryBatchSource;
  receipt_link?: string | null;
  photos?: string[];
}

export interface UpdatePantryItem {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  storage_location?: StorageLocation;
  expiration_date?: string | null;
  purchase_date?: string | null;
  barcode?: string | null;
  photo_path?: string | null;
  notes?: string | null;
  grocery_section?: GrocerySection;
  is_staple?: number;
  product_id?: string | null;
  nutrition_data_id?: string | null;
  confirmation_status?: FoodConfirmationStatus;
  confirmed_at?: string | null;
}

export interface ConfirmPantryItemIdentityInput {
  product_id: string | null;
  nutrition_data_id?: string | null;
  confirmed_at?: string;
}

export interface PantryBatch {
  id: string;
  pantry_item_id: string;
  lot_code: string | null;
  quantity: number | null;
  unit: string | null;
  expiration_date: string | null;
  purchase_date: string | null;
  source: PantryBatchSource;
  receipt_link: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface CreatePantryBatch {
  pantry_item_id: string;
  lot_code?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expiration_date?: string | null;
  purchase_date?: string | null;
  source?: PantryBatchSource;
  receipt_link?: string | null;
  photos?: string[];
}

export interface UpdatePantryBatch {
  lot_code?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expiration_date?: string | null;
  purchase_date?: string | null;
  source?: PantryBatchSource;
  receipt_link?: string | null;
  photos?: string[];
}

export interface PantryFilters {
  search?: string;
  storageLocation?: StorageLocation;
  grocerySection?: GrocerySection;
  expirationStatus?: ExpirationStatus;
  isStaple?: boolean;
  sortBy?: 'name' | 'expiration_date' | 'created_at' | 'storage_location';
  sortDir?: 'ASC' | 'DESC';
}

export interface FoodRecognitionCandidate {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  bounding_box: FoodRecognitionBoundingBox | null;
  crop_uri: string | null;
  grocery_section: GrocerySection;
  storage_location: StorageLocation;
  confidence: number;
  labels: string[];
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  product_id: string | null;
  nutrition_data_id: string | null;
  nutrition_candidates: NutritionCandidate[];
  nutrition_provider_statuses: NutritionProviderStatus[];
}

export interface FoodRecognitionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FoodRecognitionResult {
  suggestedName: string | null;
  suggestedCategory: GrocerySection | null;
  confidence: number;
  labels: string[];
  candidates: FoodRecognitionCandidate[];
  rawText?: string | null;
}

export interface FoodRecognitionConfirmationInput {
  candidateId?: string | null;
  name: string;
  brand?: string | null;
  grocerySection?: GrocerySection | null;
  storageLocation?: StorageLocation | null;
  quantity?: number | null;
  unit?: string | null;
  expirationDate?: string | null;
  purchaseDate?: string | null;
  lotCode?: string | null;
  photoUri?: string | null;
  cropUri?: string | null;
  labels?: string[];
  confidence?: number | null;
  productId?: string | null;
  pantryItemId?: string | null;
  nutritionDataId?: string | null;
  selectedNutritionCandidateId?: string | null;
  nutritionCandidate?: NutritionCandidate | null;
  barcode?: string | null;
}

export interface FoodRecognitionConfirmationResult {
  candidateId: string | null;
  pantryItemId: string;
  batchId: string;
  productId: string | null;
  nutritionDataId: string | null;
}

export interface ExpirationDateCandidate {
  id: string;
  rawText: string;
  normalizedDate: string;
  confidence: number;
  reason: string;
  context: string;
  requiresManualSelection: boolean;
  bounding_box?: FoodRecognitionBoundingBox | null;
  crop_uri?: string | null;
}

export interface ExpirationOcrInput {
  photoUri: string;
  photoMime?: string;
  imageBase64?: string;
  rawText?: string;
  boundingBox?: FoodRecognitionBoundingBox | null;
  cropUri?: string | null;
}

export type ExpirationOcrProviderStatus = 'manual' | 'parsed' | 'failed' | 'unavailable';

export interface ExpirationOcrResult {
  rawText: string;
  confidence: number;
  candidates: ExpirationDateCandidate[];
  providerId?: string | null;
  providerStatus?: ExpirationOcrProviderStatus;
  providerError?: string | null;
  providerRawJson?: unknown;
}

export interface ExpirationOcrProvider {
  id: string;
  recognize(input: ExpirationOcrInput): Promise<Omit<ExpirationOcrResult, 'candidates'>>;
}

export interface ExpirationDateConfirmationInput {
  expirationDate: string;
  photoUri?: string | null;
  cropUri?: string | null;
  rawText?: string | null;
  confidence?: number | null;
  pantryItemId?: string | null;
  pantryBatchId?: string | null;
  itemName?: string | null;
  grocerySection?: GrocerySection | null;
  storageLocation?: StorageLocation | null;
  quantity?: number | null;
  unit?: string | null;
  lotCode?: string | null;
}

export interface ExpirationDateConfirmationResult {
  pantryItemId: string;
  batchId: string;
  expirationDate: string;
  createdItem: boolean;
}

export interface DeductionResult {
  deducted: Array<{
    pantryItemId: string;
    pantryItemName: string;
    ingredientItem: string;
    previousQuantity: number | null;
    newQuantity: number | null;
    removed: boolean;
  }>;
  unmatched: string[];
}

export type RecipeCookPantryReviewStatus =
  | 'matched'
  | 'not_tracked'
  | 'review_quantity'
  | 'unit_mismatch';

export interface RecipeCookHistoryEntry {
  id: string;
  recipe_id: string;
  cooked_at: string;
  servings: number;
  pantry_decrements_json: string;
  created_at: string;
}

export interface RecipeCookPantryReviewItem {
  ingredientId: string;
  ingredientName: string;
  ingredientItem: string;
  ingredientQuantity: string | null;
  ingredientQuantityValue: number | null;
  ingredientUnit: string | null;
  pantryItemId: string | null;
  pantryItemName: string | null;
  pantryQuantity: number | null;
  pantryUnit: string | null;
  matchScore: number;
  suggestedDecrementQuantity: number | null;
  suggestedDecrementUnit: string | null;
  status: RecipeCookPantryReviewStatus;
  note: string | null;
}

export interface RecipeCookPantryReview {
  recipeId: string;
  recipeTitle: string;
  servings: number;
  cookedAt: string;
  items: RecipeCookPantryReviewItem[];
  cookHistory: RecipeCookHistoryEntry[];
}

export interface RecipeCookPantryApplyItem {
  ingredientId: string;
  pantryItemId: string;
  quantity: number;
  unit?: string | null;
}

export interface RecipeCookPantryApplyInput {
  recipeId: string;
  servings?: number;
  cookedAt?: string;
  decrements: RecipeCookPantryApplyItem[];
}

export interface RecipeCookPantryApplyResult {
  historyEntry: RecipeCookHistoryEntry;
  updatedPantryItems: Array<{
    pantryItemId: string;
    pantryItemName: string;
    decrementedQuantity: number;
    decrementUnit: string | null;
    previousQuantity: number | null;
    newQuantity: number | null;
    pantryUnit: string | null;
  }>;
  skippedIngredientIds: string[];
}

export interface MatchedIngredient {
  ingredientId: string;
  ingredientItem: string;
  pantryItemId: string | null;
  pantryItemName: string | null;
  matchScore: number;
  quantitySufficient: boolean | null;
  quantityNeeded: number | null;
  quantityAvailable: number | null;
  unit: string | null;
}

export interface RecipeMatch {
  recipeId: string;
  title: string;
  totalIngredients: number;
  matchedIngredients: number;
  missingIngredients: MatchedIngredient[];
  availableIngredients: MatchedIngredient[];
  matchPercentage: number;
  canMake: boolean;
}

export interface MatchOptions {
  minMatchPercent?: number;
  maxResults?: number;
  includeStaplesAsAvailable?: boolean;
}

export interface ExpiringRecipeSuggestion {
  recipe: RecipeMatch;
  expiringItems: Array<{ name: string; daysLeft: number }>;
}

export interface UseNextPantryBatchPrompt {
  pantryItemId: string;
  pantryItemName: string;
  batchId: string;
  expirationDate: string | null;
  daysLeft: number | null;
  status: ExpirationStatus;
  quantity: number | null;
  unit: string | null;
  lotCode: string | null;
  ingredientId: string | null;
  ingredientItem: string | null;
  quantityNeeded: number | null;
  neededUnit: string | null;
  quantityAvailable: number | null;
  availableUnit: string | null;
  quantitySufficient: boolean | null;
  sufficiencyStatus: 'sufficient' | 'insufficient' | 'unknown';
}

export interface UseNextRecipePrompt {
  recipe: RecipeMatch;
  useNextBatches: UseNextPantryBatchPrompt[];
  urgencyScore: number;
  readyToCook: boolean;
  promptStatus: 'ready_to_cook' | 'needs_more' | 'check_units';
}

export interface SubstitutionSuggestion {
  substitute: string;
  quantity_hint: string;
  reason: string;
  in_pantry: boolean;
}

// --- Collections ---

export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  cover_recipe_id: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CreateCollectionSchema = CollectionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  cover_recipe_id: true,
  sort_order: true,
});
export type CreateCollection = z.infer<typeof CreateCollectionSchema>;

// --- Nutrition ---

export const NutritionSourceSchema = FoodDataSourceSchema;
export type NutritionSource = z.infer<typeof NutritionSourceSchema>;

export const NutritionDataSchema = z.object({
  id: z.string(),
  pantry_item_id: z.string().nullable(),
  product_id: z.string().nullable(),
  barcode: z.string().nullable(),
  product_name: z.string().nullable(),
  brand: z.string().nullable(),
  serving_size_text: z.string().nullable(),
  calories: z.number().nullable(),
  fat_g: z.number().nullable(),
  saturated_fat_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  protein_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  source: NutritionSourceSchema,
  source_id: z.string().nullable(),
  source_url: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  serving_basis: NutritionServingBasisSchema,
  serving_quantity: z.number().nullable(),
  serving_unit: z.string().nullable(),
  parent_nutrition_data_id: z.string().nullable(),
  is_user_confirmed: z.number().int().min(0).max(1),
  confirmed_at: z.string().nullable(),
  fetched_at: z.string(),
});
export type NutritionData = z.infer<typeof NutritionDataSchema>;

export const CreateNutritionDataSchema = NutritionDataSchema.omit({
  id: true,
}).partial({
  pantry_item_id: true,
  product_id: true,
  barcode: true,
  product_name: true,
  brand: true,
  serving_size_text: true,
  calories: true,
  fat_g: true,
  saturated_fat_g: true,
  carbs_g: true,
  fiber_g: true,
  sugar_g: true,
  protein_g: true,
  sodium_mg: true,
  source_id: true,
  source_url: true,
  confidence: true,
  serving_basis: true,
  serving_quantity: true,
  serving_unit: true,
  parent_nutrition_data_id: true,
  is_user_confirmed: true,
  confirmed_at: true,
  fetched_at: true,
});
export type CreateNutritionData = z.infer<typeof CreateNutritionDataSchema>;

export const UpdateNutritionDataSchema = CreateNutritionDataSchema.partial();
export type UpdateNutritionData = z.infer<typeof UpdateNutritionDataSchema>;

export type NutritionCandidateOrigin = 'local_cache' | 'provider' | 'manual_input';
export type NutritionCandidateCompleteness = 'complete' | 'partial' | 'incomplete';
export type NutritionConfidenceLabel = 'High' | 'Medium' | 'Low' | 'Needs review';
export type NutritionSourceAccess = 'open' | 'api_key_required' | 'paid_subscription' | 'local_only';

export interface NutritionSourceDisplayData {
  label: string;
  shortLabel: string;
  description: string;
  confidenceLabel: NutritionConfidenceLabel;
  badgeTone: 'success' | 'warning' | 'danger' | 'neutral';
  access: NutritionSourceAccess;
  apiKeyLabel: string;
  rateLimitLabel: string;
  licenseLabel: string;
  attributionLabel: string;
  constraints: string[];
}

export interface NutritionSourceChoice {
  nutritionDataId: string;
  source: NutritionSource;
  sourceId: string | null;
  sourceUrl: string | null;
  productName: string | null;
  brand: string | null;
  servingSizeText: string | null;
  servingBasis: NutritionServingBasis;
  servingQuantity: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein_g: number | null;
  confidence: number | null;
  confidenceLabel: NutritionConfidenceLabel;
  isUserConfirmed: boolean;
  isSelected: boolean;
  fetchedAt: string | null;
  confirmedAt: string | null;
  display: NutritionSourceDisplayData;
  missingFields: NutritionMissingField[];
}

export interface NutritionCandidate {
  id: string;
  origin: NutritionCandidateOrigin;
  source: NutritionSource;
  source_id: string | null;
  source_url: string | null;
  product_id: string | null;
  nutrition_data_id: string | null;
  barcode: string | null;
  product_name: string | null;
  brand: string | null;
  serving_size_text: string | null;
  serving_basis: NutritionServingBasis;
  serving_quantity: number | null;
  serving_unit: string | null;
  nutrients: NutritionBreakdown;
  confidence: number;
  completeness: NutritionCandidateCompleteness;
  auto_selectable: boolean;
  is_user_confirmed: boolean;
  fetched_at: string | null;
  display: NutritionSourceDisplayData;
  quality_flags: string[];
  rank: number;
}

export interface NutritionProviderResult {
  source: Exclude<FoodDataSource, 'local_cache' | 'bestchef_cache'>;
  source_id: string | null;
  source_url?: string | null;
  barcode?: string | null;
  product_name: string | null;
  brand?: string | null;
  serving_size_text?: string | null;
  serving_basis: NutritionServingBasis;
  serving_quantity?: number | null;
  serving_unit?: string | null;
  nutrients: NutritionBreakdown;
  confidence?: number | null;
  fetched_at?: string | null;
  quality_flags?: string[];
}

export interface NutritionResolveInput {
  barcode?: string | null;
  query?: string | null;
  brand?: string | null;
  productId?: string | null;
  pantryItemId?: string | null;
  includeNetwork?: boolean;
  manualCandidates?: NutritionProviderResult[];
}

export type NutritionProviderStatusCode =
  | 'ok'
  | 'skipped'
  | 'not_configured'
  | 'rate_limited'
  | 'error';

export interface NutritionProviderStatus {
  source: FoodDataSource;
  status: NutritionProviderStatusCode;
  message: string;
}

export interface NutritionResolutionResult {
  candidates: NutritionCandidate[];
  providerStatuses: NutritionProviderStatus[];
}

export interface NutritionProviderAdapter {
  source: FoodDataSource;
  search(input: NutritionResolveInput): Promise<{
    candidates: NutritionProviderResult[];
    status: NutritionProviderStatus;
  }>;
}

// --- Receipt imports ---

export type ReceiptOcrProviderStatus = 'pending' | 'parsed' | 'failed' | 'manual';
export type ReceiptReviewStatus = 'needs_review' | 'confirmed' | 'dismissed' | 'failed';
export type ReceiptLineMatchStatus = 'unmatched' | 'matched' | 'ambiguous' | 'confirmed' | 'ignored';
export type ReceiptLineProductCandidateSource =
  | 'pantry_item'
  | 'barcode_alias'
  | 'product_alias'
  | 'product_cache'
  | 'nutrition_candidate';

export interface ReceiptImport {
  id: string;
  attachment_id: string | null;
  photo_uri: string;
  photo_mime: string;
  ocr_provider: string;
  provider_status: ReceiptOcrProviderStatus;
  provider_error: string | null;
  merchant: string | null;
  receipt_date: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  currency: string | null;
  raw_ocr_text: string | null;
  redacted_ocr_text: string | null;
  redactions_json: string;
  parsed_json: string;
  confidence: number | null;
  review_status: ReceiptReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface ReceiptImportLine {
  id: string;
  receipt_import_id: string;
  line_index: number;
  raw_description: string;
  normalized_name: string;
  quantity: number | null;
  unit_price_cents: number | null;
  total_cents: number | null;
  product_id: string | null;
  pantry_item_id: string | null;
  nutrition_data_id: string | null;
  match_status: ReceiptLineMatchStatus;
  match_confidence: number | null;
  match_reason: string | null;
  candidate_json: string;
  created_at: string;
  updated_at: string;
}

export interface ReceiptLineProductCandidate {
  id: string;
  source: ReceiptLineProductCandidateSource;
  label: string;
  product_id: string | null;
  pantry_item_id: string | null;
  nutrition_data_id: string | null;
  barcode: string | null;
  confidence: number;
  reason: string;
  grocery_section: GrocerySection | null;
  storage_location: StorageLocation | null;
  nutritionCandidate?: NutritionCandidate | null;
}

export interface ReceiptLineMatch {
  normalizedName: string;
  status: Exclude<ReceiptLineMatchStatus, 'confirmed' | 'ignored'>;
  confidence: number | null;
  reason: string | null;
  candidates: ReceiptLineProductCandidate[];
}

export interface ReceiptLineMatchInput {
  description: string;
  quantity?: number | null;
  unitPriceCents?: number | null;
  totalCents?: number | null;
}

export interface ReceiptLineMatchOptions {
  includeNetworkNutrition?: boolean;
  nutritionProviders?: NutritionProviderAdapter[];
}

export interface ReceiptOcrInput {
  photoUri: string;
  photoMime?: string;
  imageBase64?: string;
}

export interface ReceiptOcrResult {
  rawText: string;
  confidence: number;
  providerRawJson?: unknown;
}

export interface ReceiptOcrProvider {
  id: string;
  recognize(input: ReceiptOcrInput): Promise<ReceiptOcrResult>;
}

export interface ReceiptImportDraftInput extends ReceiptOcrInput {
  rawOcrText?: string;
}

export interface ReceiptImportDraftOptions extends ReceiptLineMatchOptions {}

export interface ReceiptImportReview {
  receipt: ReceiptImport;
  lines: ReceiptImportLine[];
}

export interface ReceiptLineConfirmationInput {
  lineId: string;
  selectedCandidateId?: string | null;
  pantryItemId?: string | null;
  productId?: string | null;
  nutritionDataId?: string | null;
  itemName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expirationDate?: string | null;
  lotCode?: string | null;
}

export interface ReceiptLineConfirmationResult {
  lineId: string;
  pantryItemId: string;
  batchId: string;
  productId: string | null;
  nutritionDataId: string | null;
}

export interface ReceiptImportConfirmationResult {
  receiptImportId: string;
  confirmedLineIds: string[];
  createdPantryItemIds: string[];
  createdBatchIds: string[];
  ambiguousLineIds: string[];
  ignoredLineIds: string[];
}

// --- Import ---

export type ImportSource =
  | 'url'
  | 'text'
  | 'photo'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'share'
  | 'clipboard';

export interface ImportResult {
  source: ImportSource;
  parsed: ParsedRecipe | null;
  metadata?: {
    sourceUrl?: string;
    author?: string;
    thumbnailUrl?: string;
    platform?: string;
  };
  error?: string;
}

// --- Shopping Lists ---

export interface ShoppingList {
  id: string;
  name: string;
  store_name: string | null;
  event_name: string | null;
  event_date: string | null;
  is_active: number;
  archived_at: string | null;
  media_uris: string[];
  created_at: string;
  updated_at: string;
}

export type ShoppingListFilter = 'active' | 'archived' | 'all';

export interface ShoppingListMetadata {
  store_name?: string | null;
  event_name?: string | null;
  event_date?: string | null;
}

export interface UpdateShoppingListInput extends ShoppingListMetadata {
  name?: string;
  is_active?: number;
  archived_at?: string | null;
  media_uris?: string[];
}

export interface DuplicateShoppingListOptions extends ShoppingListMetadata {
  name?: string;
  includeCheckedState?: boolean;
}

export interface ShoppingListItemRow {
  id: string;
  list_id: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  grocery_section: GrocerySection;
  recipe_id: string | null;
  recipe_multiplier: number;
  is_checked: number;
  is_custom: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateShoppingListItem {
  item: string;
  quantity?: number | null;
  unit?: string | null;
  grocery_section?: GrocerySection;
  recipe_id?: string | null;
  recipe_multiplier?: number;
  is_custom?: number;
  sort_order?: number;
}

export interface ShoppingListSummary {
  list: ShoppingList;
  totalItems: number;
  checkedItems: number;
  recipeCount: number;
  customItemCount: number;
}

export interface RecipeForShoppingList {
  recipeId: string;
  title: string;
  multiplier: number;
}

export interface RecipeGroceryFlag {
  recipe_id: string;
  default_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface GroceryFlaggedRecipe extends RecipeGroceryFlag {
  recipe_title: string;
  recipe_image_uri: string | null;
  ingredient_count: number;
}

// --- Recipe Nutrition ---
// Canonical nutrient fields live in @mylife/nutrition-engine. BestChef adds
// conversion confidence so recipe cards can label approximate totals.
export type NutritionBreakdown = SharedNutritionBreakdown;

export type NutritionFieldKey = keyof NutritionBreakdown | 'added_sugar_g';

export interface NutritionMissingField {
  key: NutritionFieldKey;
  label: string;
}

export interface NutritionFactsWithAddedSugar extends NutritionBreakdown {
  added_sugar_g: number | null;
}

export type NutritionDetailSurface =
  | 'pantry_item'
  | 'pantry_batch'
  | 'grocery_item'
  | 'recipe_ingredient'
  | 'saved_recipe'
  | 'recipe'
  | 'dish';

export type NutritionDetailStatus = 'available' | 'partial' | 'missing';

export interface NutritionSourceSummary {
  source: NutritionSource;
  label: string;
  sourceId: string | null;
  count: number;
  confidence: number | null;
  confirmedCount: number;
}

export interface NutritionHealthSummary {
  protein_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  added_sugar_g: number | null;
  confidence: number | null;
  confidenceLabel: NutritionConfidenceLabel;
  missingFields: NutritionMissingField[];
  hasMedicalClaim: false;
}

export interface RecipeIngredientNutritionConversion {
  ingredientId: string;
  ingredientName: string;
  pantryItemId: string;
  pantryItemName: string;
  nutritionDataId: string | null;
  nutritionSource: NutritionSource | null;
  sourceId: string | null;
  sourceLabel: string | null;
  confidenceLabel: NutritionConfidenceLabel | null;
  fetchedAt: string | null;
  confirmedAt: string | null;
  isUserConfirmed: boolean;
  missingFields: NutritionMissingField[];
  scale: number;
  confidence: number;
  basis: NutritionServingBasis;
  ingredientQuantity: number | null;
  ingredientUnit: string | null;
  referenceQuantity: number;
  referenceUnit: string;
  warnings: string[];
}

export interface RecipeNutritionSummary extends SharedRecipeNutritionSummary {
  coveragePercent: number;
  conversionConfidence: number;
  lowConfidenceIngredients: string[];
  lowConfidenceWarnings: string[];
  missingIngredientDetails: Array<{
    ingredientId: string;
    ingredientName: string;
    reason: 'no_pantry_match' | 'no_nutrition_data';
    quantity: number | null;
    unit: string | null;
  }>;
  ambiguousConversions: Array<{
    ingredientId: string;
    ingredientName: string;
    confidence: number;
    warnings: string[];
  }>;
  sourceBreakdown: NutritionSourceSummary[];
  missingFields: NutritionMissingField[];
  ingredientConversions: RecipeIngredientNutritionConversion[];
}

export interface NutritionDetail {
  surface: NutritionDetailSurface;
  subjectId: string;
  title: string;
  subtitle: string | null;
  status: NutritionDetailStatus;
  nutrients: NutritionFactsWithAddedSugar;
  totalNutrients: NutritionFactsWithAddedSugar | null;
  perServingNutrients: NutritionFactsWithAddedSugar | null;
  servingBasis: NutritionServingBasis | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingSizeText: string | null;
  source: NutritionSource | null;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceDisplay: NutritionSourceDisplayData | null;
  confidence: number | null;
  confidenceLabel: NutritionConfidenceLabel;
  fetchedAt: string | null;
  confirmedAt: string | null;
  isUserConfirmed: boolean;
  coverage: number | null;
  coveragePercent: number | null;
  sourceBreakdown: NutritionSourceSummary[];
  missingFields: NutritionMissingField[];
  missingIngredients: string[];
  ambiguousConversions: string[];
  lowConfidenceWarnings: string[];
  healthSummary: NutritionHealthSummary;
}

// --- Voice Commands ---

export type VoiceCommand =
  | 'next_step'
  | 'previous_step'
  | 'start_timer'
  | 'stop_timer'
  | 'repeat_step'
  | 'read_ingredients'
  | 'go_to_step';

export interface ParsedVoiceCommand {
  command: VoiceCommand;
  stepNumber?: number;
}

// --- Video Import ---

export interface VideoImportResult {
  parsed: ParsedRecipe | null;
  sourceUrl: string;
  thumbnailUrl?: string;
  author?: string;
  platform?: string;
  error?: string;
}

// --- Recipe Sharing ---

export type ShareFormat = 'text' | 'card' | 'link' | 'clipboard';

export interface ShareableRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepTime: string;
  cookTime: string;
  ingredients: Array<{ name: string; quantity: string | null; unit: string | null }>;
  steps: Array<{ stepNumber: number; instruction: string }>;
}

export interface ShareToken {
  id: string;
  recipe_id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  view_count: number;
}
