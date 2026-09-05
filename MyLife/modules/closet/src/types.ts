import { z } from 'zod';

export const ClothingCategorySchema = z.enum([
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
  'activewear',
  'swimwear',
  'sleepwear',
  'underwear',
  'other',
]);
export type ClothingCategory = z.infer<typeof ClothingCategorySchema>;

export const ClothingStatusSchema = z.enum(['active', 'stored', 'donated', 'sold', 'archived']);
export type ClothingStatus = z.infer<typeof ClothingStatusSchema>;

export const ClothingConditionSchema = z.enum(['new', 'good', 'fair', 'worn_out']);
export type ClothingCondition = z.infer<typeof ClothingConditionSchema>;

export const LaundryStatusSchema = z.enum(['clean', 'dirty', 'washing']);
export type LaundryStatus = z.infer<typeof LaundryStatusSchema>;

export const CareInstructionSchema = z.enum([
  'machine_wash',
  'hand_wash',
  'dry_clean',
  'delicate',
]);
export type CareInstruction = z.infer<typeof CareInstructionSchema>;

export const LaundryEventTypeSchema = z.enum(['washed', 'dry_cleaned']);
export type LaundryEventType = z.infer<typeof LaundryEventTypeSchema>;

export const PackingListModeSchema = z.enum(['quick_list', 'outfit_planning']);
export type PackingListMode = z.infer<typeof PackingListModeSchema>;

export const PackingListSeasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type PackingListSeason = z.infer<typeof PackingListSeasonSchema>;

export const ClothingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ClothingCategorySchema,
  color: z.string().nullable(),
  brand: z.string().nullable(),
  purchasePriceCents: z.number().int().nullable(),
  purchaseDate: z.string().nullable(),
  imageUri: z.string().nullable(),
  seasons: z.array(z.string()),
  occasions: z.array(z.string()),
  condition: ClothingConditionSchema,
  status: ClothingStatusSchema,
  laundryStatus: LaundryStatusSchema,
  careInstructions: CareInstructionSchema,
  autoDirtyOnWear: z.boolean(),
  wearsSinceWash: z.number().int().min(0),
  timesWorn: z.number().int(),
  lastWornDate: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClothingItem = z.infer<typeof ClothingItemSchema>;

export const OutfitSchema = z.object({
  id: z.string(),
  name: z.string(),
  itemIds: z.array(z.string()),
  occasion: z.string().nullable(),
  season: z.string().nullable(),
  imageUri: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Outfit = z.infer<typeof OutfitSchema>;

export const WearLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  outfitId: z.string().nullable(),
  itemIds: z.array(z.string()),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type WearLog = z.infer<typeof WearLogSchema>;

export const LaundryEventSchema = z.object({
  id: z.string(),
  clothingItemId: z.string(),
  eventType: LaundryEventTypeSchema,
  eventDate: z.string(),
  wearsBeforeWash: z.number().int().min(0),
  createdAt: z.string(),
});
export type LaundryEvent = z.infer<typeof LaundryEventSchema>;

export const PackingListItemSchema = z.object({
  id: z.string(),
  packingListId: z.string(),
  clothingItemId: z.string().nullable(),
  customName: z.string().nullable(),
  categoryGroup: z.string(),
  quantity: z.number().int().min(1).max(20),
  isPacked: z.boolean(),
  sortOrder: z.number().int().min(0),
  createdAt: z.string(),
});
export type PackingListItem = z.infer<typeof PackingListItemSchema>;

export const PackingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  occasions: z.array(z.string()),
  season: PackingListSeasonSchema,
  mode: PackingListModeSchema,
  items: z.array(PackingListItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PackingList = z.infer<typeof PackingListSchema>;

export const ClosetTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  usageCount: z.number().int(),
  createdAt: z.string(),
});
export type ClosetTag = z.infer<typeof ClosetTagSchema>;

export const ClosetSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type ClosetSetting = z.infer<typeof ClosetSettingSchema>;

export const ClosetDashboardSchema = z.object({
  totalItems: z.number().int(),
  totalOutfits: z.number().int(),
  wardrobeValueCents: z.number().int(),
  itemsWorn30Days: z.number().int(),
  donationCandidateCount: z.number().int(),
});
export type ClosetDashboard = z.infer<typeof ClosetDashboardSchema>;

export const CreateClothingItemInputSchema = z.object({
  name: z.string().min(1),
  category: ClothingCategorySchema,
  color: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  purchasePriceCents: z.number().int().nullable().default(null),
  purchaseDate: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
  seasons: z.array(z.string()).default(['all-season']),
  occasions: z.array(z.string()).default([]),
  condition: ClothingConditionSchema.default('good'),
  status: ClothingStatusSchema.default('active'),
  laundryStatus: LaundryStatusSchema.default('clean'),
  careInstructions: CareInstructionSchema.default('machine_wash'),
  autoDirtyOnWear: z.boolean().default(true),
  notes: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});
export type CreateClothingItemInput = z.input<typeof CreateClothingItemInputSchema>;

export const UpdateClothingItemInputSchema = z.object({
  name: z.string().min(1).optional(),
  category: ClothingCategorySchema.optional(),
  color: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  purchasePriceCents: z.number().int().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  imageUri: z.string().nullable().optional(),
  seasons: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  condition: ClothingConditionSchema.optional(),
  status: ClothingStatusSchema.optional(),
  laundryStatus: LaundryStatusSchema.optional(),
  careInstructions: CareInstructionSchema.optional(),
  autoDirtyOnWear: z.boolean().optional(),
  wearsSinceWash: z.number().int().min(0).optional(),
  timesWorn: z.number().int().min(0).optional(),
  lastWornDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateClothingItemInput = z.input<typeof UpdateClothingItemInputSchema>;

export const ClothingItemFilterSchema = z.object({
  category: ClothingCategorySchema.optional(),
  tag: z.string().optional(),
  status: ClothingStatusSchema.optional(),
  laundryStatus: LaundryStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(5000).default(100),
});
export type ClothingItemFilter = z.input<typeof ClothingItemFilterSchema>;

export const CreateOutfitInputSchema = z.object({
  name: z.string().min(1),
  itemIds: z.array(z.string()).min(1),
  occasion: z.string().nullable().default(null),
  season: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreateOutfitInput = z.input<typeof CreateOutfitInputSchema>;

export const CreateWearLogInputSchema = z.object({
  date: z.string().optional(),
  outfitId: z.string().nullable().default(null),
  itemIds: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
});
export type CreateWearLogInput = z.input<typeof CreateWearLogInputSchema>;

export const MarkLaundryItemsCleanInputSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  eventType: LaundryEventTypeSchema.default('washed'),
  eventDate: z.string().optional(),
});
export type MarkLaundryItemsCleanInput = z.input<typeof MarkLaundryItemsCleanInputSchema>;

export const CreatePackingListInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string(),
  endDate: z.string(),
  occasions: z.array(z.string()).default([]),
  mode: PackingListModeSchema.default('quick_list'),
}).superRefine((value, ctx) => {
  const start = new Date(`${value.startDate}T00:00:00Z`);
  const end = new Date(`${value.endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid trip dates' });
    return;
  }
  if (end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must be greater than or equal to startDate',
      path: ['endDate'],
    });
  }
});
export type CreatePackingListInput = z.input<typeof CreatePackingListInputSchema>;

export const AddPackingListCustomItemInputSchema = z.object({
  customName: z.string().trim().min(1).max(200),
  categoryGroup: z.string().trim().min(1).max(50).default('Essentials'),
  quantity: z.number().int().min(1).max(20).default(1),
});
export type AddPackingListCustomItemInput = z.input<typeof AddPackingListCustomItemInputSchema>;

export const ExportClosetDataInputSchema = z.object({
  includeItems: z.boolean().default(true),
  includeOutfits: z.boolean().default(true),
  includeWearLogs: z.boolean().default(true),
  includeLaundryEvents: z.boolean().default(true),
  includePackingLists: z.boolean().default(true),
  includeSettings: z.boolean().default(true),
});
export type ExportClosetDataInput = z.input<typeof ExportClosetDataInputSchema>;

export const ClosetExportBundleSchema = z.object({
  exportVersion: z.literal('1.0'),
  exportedAt: z.string(),
  module: z.literal('closet'),
  items: z.array(ClothingItemSchema),
  outfits: z.array(OutfitSchema),
  wearLogs: z.array(WearLogSchema),
  laundryEvents: z.array(LaundryEventSchema),
  packingLists: z.array(PackingListSchema),
  settings: z.array(ClosetSettingSchema),
});
export type ClosetExportBundle = z.infer<typeof ClosetExportBundleSchema>;

// ── V3 types: Wishlist, Capsule, Outfit Suggestions, Weather, Seasonal, Color ──

export const WishlistPrioritySchema = z.enum(['high', 'medium', 'low']);
export type WishlistPriority = z.infer<typeof WishlistPrioritySchema>;

export const WishlistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ClothingCategorySchema,
  brand: z.string().nullable(),
  color: z.string().nullable(),
  estimatedPriceCents: z.number().int().nullable(),
  url: z.string().nullable(),
  imageUri: z.string().nullable(),
  notes: z.string().nullable(),
  priority: WishlistPrioritySchema,
  isPurchased: z.boolean(),
  purchasedDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WishlistItem = z.infer<typeof WishlistItemSchema>;

export const CreateWishlistItemInputSchema = z.object({
  name: z.string().trim().min(1),
  category: ClothingCategorySchema,
  brand: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  estimatedPriceCents: z.number().int().nullable().default(null),
  url: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  priority: WishlistPrioritySchema.default('medium'),
});
export type CreateWishlistItemInput = z.input<typeof CreateWishlistItemInputSchema>;

export const UpdateWishlistItemInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  category: ClothingCategorySchema.optional(),
  brand: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  estimatedPriceCents: z.number().int().nullable().optional(),
  url: z.string().nullable().optional(),
  imageUri: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  priority: WishlistPrioritySchema.optional(),
});
export type UpdateWishlistItemInput = z.input<typeof UpdateWishlistItemInputSchema>;

export const WishlistSummarySchema = z.object({
  totalItems: z.number().int(),
  totalEstimatedCents: z.number().int(),
  countByPriority: z.object({
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
  }),
});
export type WishlistSummary = z.infer<typeof WishlistSummarySchema>;

export const CapsuleWardrobeSchema = z.object({
  id: z.string(),
  name: z.string(),
  season: z.string(),
  targetCount: z.number().int(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  itemIds: z.array(z.string()),
  essentialItemIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CapsuleWardrobe = z.infer<typeof CapsuleWardrobeSchema>;

export const CreateCapsuleInputSchema = z.object({
  name: z.string().trim().min(1),
  season: z.string().default('all-season'),
  targetCount: z.number().int().min(20).max(50).default(33),
  notes: z.string().nullable().default(null),
  itemIds: z.array(z.string()).default([]),
  essentialItemIds: z.array(z.string()).default([]),
});
export type CreateCapsuleInput = z.input<typeof CreateCapsuleInputSchema>;

export const ColorCategorySchema = z.enum([
  'black', 'white', 'gray', 'blue', 'red', 'green', 'pink',
  'yellow', 'orange', 'purple', 'brown', 'multi', 'unknown',
]);
export type ColorCategory = z.infer<typeof ColorCategorySchema>;

export const ColorDistributionEntrySchema = z.object({
  color: ColorCategorySchema,
  count: z.number().int(),
  percentage: z.number(),
});
export type ColorDistributionEntry = z.infer<typeof ColorDistributionEntrySchema>;

export const WeatherConditionSchema = z.object({
  temperatureF: z.number(),
  condition: z.string(),
  humidity: z.number().nullable(),
  windSpeedMph: z.number().nullable(),
});
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const WeatherRecommendationSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  category: ClothingCategorySchema,
  score: z.number(),
  reason: z.string(),
});
export type WeatherRecommendation = z.infer<typeof WeatherRecommendationSchema>;

export const OutfitSuggestionSchema = z.object({
  itemIds: z.array(z.string()),
  score: z.number(),
  context: z.string(),
  hash: z.string(),
});
export type OutfitSuggestion = z.infer<typeof OutfitSuggestionSchema>;

export const SuggestionFeedbackSchema = z.object({
  id: z.string(),
  suggestionHash: z.string(),
  itemIds: z.array(z.string()),
  feedback: z.enum(['up', 'down']),
  context: z.string(),
  createdAt: z.string(),
});
export type SuggestionFeedback = z.infer<typeof SuggestionFeedbackSchema>;

export const SeasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type Season = z.infer<typeof SeasonSchema>;

export const HemisphereSchema = z.enum(['northern', 'southern']);
export type Hemisphere = z.infer<typeof HemisphereSchema>;

export const SeasonalRotationStatusSchema = z.object({
  currentSeason: SeasonSchema,
  needsRotation: z.boolean(),
  itemsToStore: z.number().int(),
  itemsToActivate: z.number().int(),
  lastRotationDate: z.string().nullable(),
});
export type SeasonalRotationStatus = z.infer<typeof SeasonalRotationStatusSchema>;
