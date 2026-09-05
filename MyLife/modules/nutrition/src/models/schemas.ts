import { z } from 'zod';

// -- Enums -------------------------------------------------------------------

export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof MealTypeSchema>;

export const FoodSourceSchema = z.enum([
  'usda',
  'open_food_facts',
  'fatsecret',
  'custom',
  'ai_photo',
]);
export type FoodSource = z.infer<typeof FoodSourceSchema>;

export const NutrientCategorySchema = z.enum([
  'vitamin',
  'mineral',
  'amino_acid',
  'fatty_acid',
  'other',
]);
export type NutrientCategory = z.infer<typeof NutrientCategorySchema>;

// -- Food --------------------------------------------------------------------

export const FoodSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative(),
  sugarG: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative(),
  source: FoodSourceSchema,
  barcode: z.string().nullable(),
  usdaNdbNumber: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Food = z.infer<typeof FoodSchema>;

export const CreateFoodInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative().default(0),
  carbsG: z.number().nonnegative().default(0),
  fatG: z.number().nonnegative().default(0),
  fiberG: z.number().nonnegative().default(0),
  sugarG: z.number().nonnegative().default(0),
  sodiumMg: z.number().nonnegative().default(0),
  source: FoodSourceSchema.default('custom'),
  barcode: z.string().optional(),
  usdaNdbNumber: z.string().optional(),
});
export type CreateFoodInput = z.infer<typeof CreateFoodInputSchema>;

export const UpdateFoodInputSchema = CreateFoodInputSchema.partial();
export type UpdateFoodInput = z.infer<typeof UpdateFoodInputSchema>;

// -- Nutrient ----------------------------------------------------------------

export const NutrientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  unit: z.string().min(1),
  rdaValue: z.number().nonnegative().nullable(),
  rdaUnit: z.string().nullable(),
  category: NutrientCategorySchema,
  sortOrder: z.number().int().nonnegative(),
});
export type Nutrient = z.infer<typeof NutrientSchema>;

export const CreateNutrientInputSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  rdaValue: z.number().nonnegative().optional(),
  rdaUnit: z.string().optional(),
  category: NutrientCategorySchema,
  sortOrder: z.number().int().nonnegative().default(0),
});
export type CreateNutrientInput = z.infer<typeof CreateNutrientInputSchema>;

// -- Food Nutrient -----------------------------------------------------------

export const FoodNutrientSchema = z.object({
  id: z.string(),
  foodId: z.string(),
  nutrientId: z.string(),
  amount: z.number().nonnegative(),
});
export type FoodNutrient = z.infer<typeof FoodNutrientSchema>;

export const CreateFoodNutrientInputSchema = z.object({
  foodId: z.string(),
  nutrientId: z.string(),
  amount: z.number().nonnegative(),
});
export type CreateFoodNutrientInput = z.infer<typeof CreateFoodNutrientInputSchema>;

// -- Food Log ----------------------------------------------------------------

export const FoodLogEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  mealType: MealTypeSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type FoodLogEntry = z.infer<typeof FoodLogEntrySchema>;

export const CreateFoodLogEntryInputSchema = z.object({
  date: z.string(),
  mealType: MealTypeSchema,
  notes: z.string().optional(),
});
export type CreateFoodLogEntryInput = z.infer<typeof CreateFoodLogEntryInputSchema>;

// -- Food Log Item -----------------------------------------------------------

export const FoodLogItemSchema = z.object({
  id: z.string(),
  logId: z.string(),
  foodId: z.string(),
  servingCount: z.number().positive(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});
export type FoodLogItem = z.infer<typeof FoodLogItemSchema>;

export const CreateFoodLogItemInputSchema = z.object({
  logId: z.string(),
  foodId: z.string(),
  servingCount: z.number().positive().default(1),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});
export type CreateFoodLogItemInput = z.infer<typeof CreateFoodLogItemInputSchema>;

// -- Daily Goals -------------------------------------------------------------

export const DailyGoalsSchema = z.object({
  id: z.string(),
  calories: z.number().positive(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  effectiveDate: z.string(),
});
export type DailyGoals = z.infer<typeof DailyGoalsSchema>;

export const CreateDailyGoalsInputSchema = z.object({
  calories: z.number().positive(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  effectiveDate: z.string(),
});
export type CreateDailyGoalsInput = z.infer<typeof CreateDailyGoalsInputSchema>;

// -- Barcode Cache -----------------------------------------------------------

export const BarcodeCacheSchema = z.object({
  barcode: z.string(),
  foodId: z.string().nullable(),
  source: z.string(),
  rawJson: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type BarcodeCache = z.infer<typeof BarcodeCacheSchema>;

// -- Water Tracking ----------------------------------------------------------

export const WaterSourceSchema = z.enum(['manual', 'quick_add', 'healthkit']);

export const WaterEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  amountMl: z.number().positive(),
  source: WaterSourceSchema,
  createdAt: z.string(),
});

export const CreateWaterEntryInputSchema = z.object({
  date: z.string(),
  amountMl: z.number().positive(),
  source: WaterSourceSchema.default('manual'),
});
export type CreateWaterEntryInput = z.infer<typeof CreateWaterEntryInputSchema>;

// -- Energy Balance ----------------------------------------------------------

export const EnergySourceSchema = z.enum(['manual', 'healthkit', 'calculated']);
export const ActivityLevelSchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const UserSexSchema = z.enum(['male', 'female']);

export const UserProfileSchema = z.object({
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  age: z.number().int().positive(),
  sex: UserSexSchema,
  activityLevel: ActivityLevelSchema,
});
export type UserProfileInput = z.infer<typeof UserProfileSchema>;

export const EnergyLogEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  basalCalories: z.number().nonnegative(),
  activeCalories: z.number().nonnegative(),
  totalExpenditure: z.number().nonnegative(),
  source: EnergySourceSchema,
  syncedAt: z.string().nullable(),
  createdAt: z.string(),
});

// -- Daily Notes -------------------------------------------------------------

export const DailyNoteSchema = z.object({
  id: z.string(),
  date: z.string(),
  content: z.string(),
  tags: z.array(z.string()).nullable(),
  mealTypes: z.array(MealTypeSchema).nullable(),
  linkedFoodIds: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateDailyNoteInputSchema = z.object({
  date: z.string(),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  mealTypes: z.array(MealTypeSchema).optional(),
  linkedFoodIds: z.array(z.string()).optional(),
});
export type CreateDailyNoteInput = z.infer<typeof CreateDailyNoteInputSchema>;

// -- Restaurant Menus --------------------------------------------------------

export const RestaurantCategorySchema = z.enum([
  'fast_food', 'casual', 'fine_dining', 'cafe', 'pizza', 'asian', 'mexican', 'other',
]);

export const RestaurantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: RestaurantCategorySchema,
  chain: z.boolean(),
  logoEmoji: z.string().nullable(),
  logoUri: z.string().nullable(),
  website: z.string().nullable(),
  source: z.enum(['seed', 'user', 'api']),
  verified: z.boolean(),
  createdAt: z.string(),
});

export const CreateRestaurantInputSchema = z.object({
  name: z.string().min(1),
  category: RestaurantCategorySchema.default('other'),
  chain: z.boolean().default(false),
  logoEmoji: z.string().optional(),
  logoUri: z.string().optional(),
  website: z.string().optional(),
});
export type CreateRestaurantInput = z.infer<typeof CreateRestaurantInputSchema>;

export const MenuItemSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  servingSize: z.string().nullable(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative(),
  source: z.enum(['seed', 'user', 'official']),
  verified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateMenuItemInputSchema = z.object({
  restaurantId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  servingSize: z.string().optional(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative().default(0),
  carbsG: z.number().nonnegative().default(0),
  fatG: z.number().nonnegative().default(0),
  fiberG: z.number().nonnegative().default(0),
  sodiumMg: z.number().nonnegative().default(0),
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemInputSchema>;

// -- Community ---------------------------------------------------------------

export const ProfileVisibilitySchema = z.enum(['private', 'connections', 'public']);
export const ConnectionStatusSchema = z.enum(['pending', 'accepted', 'blocked']);
export const ActivityTypeSchema = z.enum(['streak', 'goal_hit', 'challenge_joined', 'challenge_complete', 'milestone', 'custom']);
export const ChallengeTypeSchema = z.enum(['streak', 'calorie_target', 'protein_target', 'water_target', 'log_streak', 'custom']);
export const ChallengeJoinTypeSchema = z.enum(['open', 'invite', 'approval']);
export const ChallengeStatusSchema = z.enum(['upcoming', 'active', 'completed', 'cancelled']);
export const ChallengeMemberRoleSchema = z.enum(['creator', 'member']);

export const CommunityProfileSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1).max(30),
  avatarEmoji: z.string(),
  bio: z.string().nullable(),
  shareStreaks: z.boolean(),
  shareGoals: z.boolean(),
  shareCalories: z.boolean(),
  shareMacros: z.boolean(),
  shareWeight: z.boolean(),
  profileVisibility: ProfileVisibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateProfileInputSchema = z.object({
  displayName: z.string().min(1).max(30),
  avatarEmoji: z.string().optional(),
  bio: z.string().optional(),
  shareStreaks: z.boolean().optional(),
  shareGoals: z.boolean().optional(),
  shareCalories: z.boolean().optional(),
  shareMacros: z.boolean().optional(),
  shareWeight: z.boolean().optional(),
  profileVisibility: ProfileVisibilitySchema.optional(),
});
export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

export const CreateChallengeInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  challengeType: ChallengeTypeSchema,
  targetValue: z.number().optional(),
  targetUnit: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  maxParticipants: z.number().int().positive().optional(),
  joinType: ChallengeJoinTypeSchema.optional(),
});
export type CreateChallengeInput = z.infer<typeof CreateChallengeInputSchema>;

export const ChallengeMemberSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  profileId: z.string(),
  role: ChallengeMemberRoleSchema,
  currentValue: z.number().nonnegative(),
  joinedAt: z.string(),
  completedAt: z.string().nullable(),
});
