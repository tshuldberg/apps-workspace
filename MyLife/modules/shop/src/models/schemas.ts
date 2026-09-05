import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────

export const PrioritySchema = z.enum(['need', 'want', 'someday', 'dream']);
export type Priority = z.infer<typeof PrioritySchema>;

export const CategorySchema = z.enum([
  'tech',
  'clothing',
  'books',
  'home',
  'kitchen',
  'gaming',
  'music',
  'sports',
  'gifts',
  'hobby',
  'other',
]);
export type Category = z.infer<typeof CategorySchema>;

export const OccasionSchema = z.enum([
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'general',
  'other',
]);
export type Occasion = z.infer<typeof OccasionSchema>;

export const PhotoKindSchema = z.enum([
  'product',
  'receipt',
  'unboxing',
  'comparison',
]);
export type PhotoKind = z.infer<typeof PhotoKindSchema>;

// ── Wishlist (list container) ─────────────────────────────────────────

export const WishlistSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  occasion: OccasionSchema.nullable(),
  personId: z.string().nullable(),
  isShareable: z.boolean(),
  shareToken: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Wishlist = z.infer<typeof WishlistSchema>;

export const WishlistInputSchema = z.object({
  name: z.string().min(1, 'name required').max(200),
  description: z.string().max(2000).nullable().optional().default(null),
  occasion: OccasionSchema.nullable().optional().default(null),
  personId: z.string().nullable().optional().default(null),
  isShareable: z.boolean().optional().default(false),
});
export type WishlistInput = z.input<typeof WishlistInputSchema>;
export type WishlistInputParsed = z.infer<typeof WishlistInputSchema>;

export const WishlistPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  occasion: OccasionSchema.nullable().optional(),
  personId: z.string().nullable().optional(),
  isShareable: z.boolean().optional(),
});
export type WishlistPatch = z.infer<typeof WishlistPatchSchema>;

// ── Wishlist Items ────────────────────────────────────────────────────

export const WishlistItemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  name: z.string().min(1),
  category: CategorySchema,
  descriptionMd: z.string().nullable(),
  priceCents: z.number().int().nullable(),
  priceRangeLow: z.number().int().nullable(),
  priceRangeHigh: z.number().int().nullable(),
  priority: PrioritySchema,
  url: z.string().nullable(),
  photoId: z.string().nullable(),
  store: z.string().nullable(),
  brand: z.string().nullable(),
  occasionTag: z.string().nullable(),
  notesMd: z.string().nullable(),
  sizeNotes: z.string().nullable(),
  isPurchased: z.boolean(),
  purchasedAt: z.string().nullable(),
  purchaseId: z.string().nullable(),
  isGiftFor: z.string().nullable(),
  giftForPersonId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WishlistItem = z.infer<typeof WishlistItemSchema>;

export const WishlistItemInputSchema = z.object({
  listId: z.string().min(1),
  name: z.string().min(1).max(200),
  category: CategorySchema,
  descriptionMd: z.string().max(4000).nullable().optional().default(null),
  priceCents: z.number().int().nonnegative().nullable().optional().default(null),
  priceRangeLow: z.number().int().nonnegative().nullable().optional().default(null),
  priceRangeHigh: z.number().int().nonnegative().nullable().optional().default(null),
  priority: PrioritySchema.optional().default('want'),
  url: z.string().max(2000).nullable().optional().default(null),
  photoId: z.string().nullable().optional().default(null),
  store: z.string().max(200).nullable().optional().default(null),
  brand: z.string().max(200).nullable().optional().default(null),
  occasionTag: z.string().max(100).nullable().optional().default(null),
  notesMd: z.string().max(4000).nullable().optional().default(null),
  sizeNotes: z.string().max(500).nullable().optional().default(null),
  isGiftFor: z.string().nullable().optional().default(null),
  giftForPersonId: z.string().nullable().optional().default(null),
});
export type WishlistItemInput = z.input<typeof WishlistItemInputSchema>;
export type WishlistItemInputParsed = z.infer<typeof WishlistItemInputSchema>;

export const WishlistItemPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: CategorySchema.optional(),
  descriptionMd: z.string().max(4000).nullable().optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  priceRangeLow: z.number().int().nonnegative().nullable().optional(),
  priceRangeHigh: z.number().int().nonnegative().nullable().optional(),
  priority: PrioritySchema.optional(),
  url: z.string().max(2000).nullable().optional(),
  photoId: z.string().nullable().optional(),
  store: z.string().max(200).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  occasionTag: z.string().max(100).nullable().optional(),
  notesMd: z.string().max(4000).nullable().optional(),
  sizeNotes: z.string().max(500).nullable().optional(),
  isGiftFor: z.string().nullable().optional(),
  giftForPersonId: z.string().nullable().optional(),
});
export type WishlistItemPatch = z.infer<typeof WishlistItemPatchSchema>;

// ── Photos ────────────────────────────────────────────────────────────

export const PhotoSchema = z.object({
  id: z.string(),
  purchaseId: z.string().nullable(),
  wishlistItemId: z.string().nullable(),
  warrantyId: z.string().nullable(),
  kind: PhotoKindSchema,
  localUri: z.string().min(1),
  caption: z.string().nullable(),
  createdAt: z.string(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const PhotoInputSchema = z.object({
  purchaseId: z.string().nullable().optional().default(null),
  wishlistItemId: z.string().nullable().optional().default(null),
  warrantyId: z.string().nullable().optional().default(null),
  kind: PhotoKindSchema,
  localUri: z.string().min(1),
  caption: z.string().max(500).nullable().optional().default(null),
});
export type PhotoInput = z.input<typeof PhotoInputSchema>;
export type PhotoInputParsed = z.infer<typeof PhotoInputSchema>;

// ── Filters ───────────────────────────────────────────────────────────

export const WishlistFilterSchema = z.object({
  occasion: OccasionSchema.optional(),
  personId: z.string().optional(),
  isShareable: z.boolean().optional(),
});
export type WishlistFilter = z.infer<typeof WishlistFilterSchema>;

export const WishlistItemFilterSchema = z.object({
  category: CategorySchema.optional(),
  priority: PrioritySchema.optional(),
  isPurchased: z.boolean().optional(),
});
export type WishlistItemFilter = z.infer<typeof WishlistItemFilterSchema>;

// ── Purchases ─────────────────────────────────────────────────────────

export const PaymentMethodSchema = z.enum([
  'credit_card',
  'debit_card',
  'cash',
  'gift_card',
  'financing',
  'other',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const SatisfactionRatingSchema = z
  .number()
  .int()
  .refine((n) => n >= 1 && n <= 5, {
    message: 'satisfaction rating must be an integer 1-5',
  });
export type SatisfactionRating = z.infer<typeof SatisfactionRatingSchema>;

export const SatisfactionPeriodSchema = z.enum(['initial', '30day', '90day']);
export type SatisfactionPeriod = z.infer<typeof SatisfactionPeriodSchema>;

export const PurchaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: CategorySchema,
  priceCents: z.number().int().nonnegative(),
  purchaseDate: z.string(),
  store: z.string().nullable(),
  paymentMethod: PaymentMethodSchema.nullable(),
  brand: z.string().nullable(),
  url: z.string().nullable(),
  receiptPhotoId: z.string().nullable(),
  satisfactionInitial: SatisfactionRatingSchema.nullable(),
  satisfaction30day: SatisfactionRatingSchema.nullable(),
  satisfaction90day: SatisfactionRatingSchema.nullable(),
  isImpulse: z.boolean(),
  researchNotesMd: z.string().nullable(),
  returnDeadline: z.string().nullable(),
  returned: z.boolean(),
  returnReason: z.string().nullable(),
  wishlistItemId: z.string().nullable(),
  notesMd: z.string().nullable(),
  photoId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Purchase = z.infer<typeof PurchaseSchema>;

export const PurchaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  category: CategorySchema,
  priceCents: z.number().int().nonnegative(),
  purchaseDate: z.string().min(1),
  store: z.string().max(200).nullable().optional().default(null),
  paymentMethod: PaymentMethodSchema.nullable().optional().default(null),
  brand: z.string().max(200).nullable().optional().default(null),
  url: z.string().max(2000).nullable().optional().default(null),
  receiptPhotoId: z.string().nullable().optional().default(null),
  satisfactionInitial: SatisfactionRatingSchema.nullable().optional().default(null),
  isImpulse: z.boolean().optional().default(false),
  researchNotesMd: z.string().max(4000).nullable().optional().default(null),
  returnDeadline: z.string().nullable().optional().default(null),
  policyDays: z.number().int().positive().optional(),
  wishlistItemId: z.string().nullable().optional().default(null),
  notesMd: z.string().max(4000).nullable().optional().default(null),
  photoId: z.string().nullable().optional().default(null),
});
export type PurchaseInput = z.input<typeof PurchaseInputSchema>;
export type PurchaseInputParsed = z.infer<typeof PurchaseInputSchema>;

export const PurchasePatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: CategorySchema.optional(),
  priceCents: z.number().int().nonnegative().optional(),
  purchaseDate: z.string().min(1).optional(),
  store: z.string().max(200).nullable().optional(),
  paymentMethod: PaymentMethodSchema.nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  receiptPhotoId: z.string().nullable().optional(),
  isImpulse: z.boolean().optional(),
  researchNotesMd: z.string().max(4000).nullable().optional(),
  returnDeadline: z.string().nullable().optional(),
  wishlistItemId: z.string().nullable().optional(),
  notesMd: z.string().max(4000).nullable().optional(),
  photoId: z.string().nullable().optional(),
});
export type PurchasePatch = z.infer<typeof PurchasePatchSchema>;

// ── Usage Log (cost-per-use tracking) ─────────────────────────────────

export const UsageLogEntrySchema = z.object({
  id: z.string(),
  purchaseId: z.string(),
  usedAt: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
});
export type UsageLogEntry = z.infer<typeof UsageLogEntrySchema>;

export const UsageLogInputSchema = z.object({
  purchaseId: z.string().min(1),
  usedAt: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).nullable().optional().default(null),
});
export type UsageLogInput = z.input<typeof UsageLogInputSchema>;
export type UsageLogInputParsed = z.infer<typeof UsageLogInputSchema>;

// ── Warranties ────────────────────────────────────────────────────────

export const CoverageTypeSchema = z.enum([
  'manufacturer',
  'extended',
  'protection',
]);
export type CoverageType = z.infer<typeof CoverageTypeSchema>;

export const WarrantySchema = z.object({
  id: z.string(),
  purchaseId: z.string().nullable(),
  itemName: z.string().min(1),
  coverageType: CoverageTypeSchema,
  startDate: z.number().int().nonnegative(),
  expiryDate: z.number().int().nonnegative(),
  coverageDetailsMd: z.string().nullable(),
  serialNumber: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  claimFiled: z.boolean(),
  claimNotes: z.string().nullable(),
  reminderDaysBefore: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Warranty = z.infer<typeof WarrantySchema>;

export const WarrantyInputSchema = z
  .object({
    purchaseId: z.string().nullable().optional().default(null),
    itemName: z.string().min(1).max(200),
    coverageType: CoverageTypeSchema,
    startDate: z.number().int().nonnegative(),
    expiryDate: z.number().int().nonnegative(),
    coverageDetailsMd: z.string().max(4000).nullable().optional().default(null),
    serialNumber: z.string().max(200).nullable().optional().default(null),
    registrationNumber: z.string().max(200).nullable().optional().default(null),
    reminderDaysBefore: z
      .number()
      .int()
      .nonnegative()
      .max(3650)
      .optional()
      .default(30),
  })
  .refine((v) => v.expiryDate >= v.startDate, {
    message: 'expiryDate must be >= startDate',
    path: ['expiryDate'],
  });
export type WarrantyInput = z.input<typeof WarrantyInputSchema>;
export type WarrantyInputParsed = z.infer<typeof WarrantyInputSchema>;

export const WarrantyUpdateSchema = z.object({
  purchaseId: z.string().nullable().optional(),
  itemName: z.string().min(1).max(200).optional(),
  coverageType: CoverageTypeSchema.optional(),
  startDate: z.number().int().nonnegative().optional(),
  expiryDate: z.number().int().nonnegative().optional(),
  coverageDetailsMd: z.string().max(4000).nullable().optional(),
  serialNumber: z.string().max(200).nullable().optional(),
  registrationNumber: z.string().max(200).nullable().optional(),
  reminderDaysBefore: z.number().int().nonnegative().max(3650).optional(),
});
export type WarrantyUpdate = z.infer<typeof WarrantyUpdateSchema>;

export const ClaimInputSchema = z.object({
  notes: z.string().min(1).max(4000),
});
export type ClaimInput = z.infer<typeof ClaimInputSchema>;

// ── Sizes ─────────────────────────────────────────────────────────────

export const SizeTypeSchema = z.enum(['clothing', 'shoe', 'ring', 'other']);
export type SizeType = z.infer<typeof SizeTypeSchema>;

export const SizeSchema = z.object({
  id: z.string(),
  type: SizeTypeSchema,
  brand: z.string().min(1),
  sizeValue: z.string().min(1),
  fitNotes: z.string().nullable(),
  lastVerified: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Size = z.infer<typeof SizeSchema>;

export const SizeInputSchema = z.object({
  type: SizeTypeSchema,
  brand: z.string().min(1).max(200),
  sizeValue: z.string().min(1).max(100),
  fitNotes: z.string().max(1000).nullable().optional().default(null),
  lastVerified: z.number().int().nonnegative().nullable().optional().default(null),
});
export type SizeInput = z.input<typeof SizeInputSchema>;
export type SizeInputParsed = z.infer<typeof SizeInputSchema>;

export const SizeUpdateSchema = z.object({
  type: SizeTypeSchema.optional(),
  brand: z.string().min(1).max(200).optional(),
  sizeValue: z.string().min(1).max(100).optional(),
  fitNotes: z.string().max(1000).nullable().optional(),
  lastVerified: z.number().int().nonnegative().nullable().optional(),
});
export type SizeUpdate = z.infer<typeof SizeUpdateSchema>;

// ── Preferences ───────────────────────────────────────────────────────

export const PreferenceCategorySchema = z.enum([
  'tech',
  'household',
  'color',
  'brand',
  'material',
  'allergy',
]);
export type PreferenceCategory = z.infer<typeof PreferenceCategorySchema>;

export const PreferenceSchema = z.object({
  id: z.string(),
  category: PreferenceCategorySchema,
  key: z.string().min(1),
  value: z.string().min(1),
  notes: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Preference = z.infer<typeof PreferenceSchema>;

export const PreferenceInputSchema = z.object({
  category: PreferenceCategorySchema,
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(500),
  notes: z.string().max(1000).nullable().optional().default(null),
});
export type PreferenceInput = z.input<typeof PreferenceInputSchema>;
export type PreferenceInputParsed = z.infer<typeof PreferenceInputSchema>;

export const PreferenceUpdateSchema = z.object({
  category: PreferenceCategorySchema.optional(),
  key: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(500).optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type PreferenceUpdate = z.infer<typeof PreferenceUpdateSchema>;

// ── Gifts ─────────────────────────────────────────────────────────────

export const GiftOccasionSchema = z.enum([
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'other',
]);
export type GiftOccasion = z.infer<typeof GiftOccasionSchema>;

export const GiftSchema = z.object({
  id: z.string(),
  personId: z.string(),
  personName: z.string(),
  itemDescription: z.string(),
  occasion: GiftOccasionSchema,
  occasionLabel: z.string().nullable(),
  purchaseId: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  giftDate: z.number().int().nonnegative(),
  reactionNotes: z.string().nullable(),
  photoId: z.string().nullable(),
  isGroupGift: z.boolean(),
  groupTotalCents: z.number().int().nonnegative().nullable(),
  myShareCents: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Gift = z.infer<typeof GiftSchema>;

export const GiftInputSchema = z
  .object({
    personId: z.string().min(1),
    personName: z.string().min(1).max(200),
    itemDescription: z.string().min(1).max(500),
    occasion: GiftOccasionSchema,
    occasionLabel: z.string().max(200).nullable().optional().default(null),
    purchaseId: z.string().nullable().optional().default(null),
    amountCents: z.number().int().nonnegative(),
    giftDate: z.number().int().nonnegative(),
    reactionNotes: z.string().max(2000).nullable().optional().default(null),
    photoId: z.string().nullable().optional().default(null),
    isGroupGift: z.boolean().optional().default(false),
    groupTotalCents: z.number().int().nonnegative().nullable().optional().default(null),
    myShareCents: z.number().int().nonnegative().nullable().optional().default(null),
  })
  .refine(
    (v) =>
      !v.isGroupGift ||
      (typeof v.myShareCents === 'number' && v.myShareCents >= 0),
    {
      message: 'myShareCents required when isGroupGift is true',
      path: ['myShareCents'],
    },
  );
export type GiftInput = z.input<typeof GiftInputSchema>;
export type GiftInputParsed = z.infer<typeof GiftInputSchema>;

export const GiftUpdateSchema = z.object({
  personId: z.string().min(1).optional(),
  personName: z.string().min(1).max(200).optional(),
  itemDescription: z.string().min(1).max(500).optional(),
  occasion: GiftOccasionSchema.optional(),
  occasionLabel: z.string().max(200).nullable().optional(),
  purchaseId: z.string().nullable().optional(),
  amountCents: z.number().int().nonnegative().optional(),
  giftDate: z.number().int().nonnegative().optional(),
  reactionNotes: z.string().max(2000).nullable().optional(),
  photoId: z.string().nullable().optional(),
  isGroupGift: z.boolean().optional(),
  groupTotalCents: z.number().int().nonnegative().nullable().optional(),
  myShareCents: z.number().int().nonnegative().nullable().optional(),
});
export type GiftUpdate = z.infer<typeof GiftUpdateSchema>;

export const GiftPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string().nullable(),
  nextOccasion: z.string().nullable(),
  nextOccasionDate: z.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type GiftPerson = z.infer<typeof GiftPersonSchema>;

export const GiftPersonInputSchema = z.object({
  name: z.string().min(1).max(200),
  relationship: z.string().max(200).nullable().optional().default(null),
  nextOccasion: z.string().max(200).nullable().optional().default(null),
  nextOccasionDate: z.number().int().nonnegative().nullable().optional().default(null),
  notes: z.string().max(2000).nullable().optional().default(null),
});
export type GiftPersonInput = z.input<typeof GiftPersonInputSchema>;
export type GiftPersonInputParsed = z.infer<typeof GiftPersonInputSchema>;

export const GiftPersonUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  relationship: z.string().max(200).nullable().optional(),
  nextOccasion: z.string().max(200).nullable().optional(),
  nextOccasionDate: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type GiftPersonUpdate = z.infer<typeof GiftPersonUpdateSchema>;

export const GiftBudgetSchema = z.object({
  id: z.string(),
  personId: z.string(),
  occasion: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type GiftBudget = z.infer<typeof GiftBudgetSchema>;

export const GiftBudgetInputSchema = z.object({
  personId: z.string().min(1),
  occasion: z.string().max(200).nullable().optional().default(null),
  amountCents: z.number().int().nonnegative(),
});
export type GiftBudgetInput = z.input<typeof GiftBudgetInputSchema>;
export type GiftBudgetInputParsed = z.infer<typeof GiftBudgetInputSchema>;

// ── Thirty-Day Rule (Spending Awareness) ──────────────────────────────

export const ThirtyDayRuleDecisionSchema = z.enum([
  'waiting',
  'bought',
  'skipped',
]);
export type ThirtyDayRuleDecision = z.infer<typeof ThirtyDayRuleDecisionSchema>;

export const ThirtyDayRuleItemSchema = z.object({
  id: z.string(),
  itemName: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  reasonMd: z.string().nullable(),
  addedAt: z.number().int().nonnegative(),
  decision: ThirtyDayRuleDecisionSchema,
  decidedAt: z.number().int().nonnegative().nullable(),
  purchaseId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type ThirtyDayRuleItem = z.infer<typeof ThirtyDayRuleItemSchema>;

export const ThirtyDayRuleInputSchema = z.object({
  itemName: z.string().min(1).max(200),
  priceCents: z.number().int().nonnegative(),
  reasonMd: z.string().max(2000).nullable().optional().default(null),
});
export type ThirtyDayRuleInput = z.input<typeof ThirtyDayRuleInputSchema>;
export type ThirtyDayRuleInputParsed = z.infer<typeof ThirtyDayRuleInputSchema>;

export const PurchaseFilterSchema = z.object({
  category: CategorySchema.optional(),
  store: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  impulseOnly: z.boolean().optional(),
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().nonnegative().optional(),
  returned: z.boolean().optional(),
});
export type PurchaseFilter = z.infer<typeof PurchaseFilterSchema>;

// ── Comparisons (research) ────────────────────────────────────────────

export const ComparisonItemSchema = z.object({
  name: z.string().min(1).max(200),
  pros: z.array(z.string().max(500)).default([]),
  cons: z.array(z.string().max(500)).default([]),
  priceCents: z.number().int().nonnegative().nullable().optional().default(null),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  url: z.string().max(2000).nullable().optional().default(null),
});
export type ComparisonItem = z.infer<typeof ComparisonItemSchema>;
export type ComparisonItemInput = z.input<typeof ComparisonItemSchema>;

export const ComparisonSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  items: z.array(ComparisonItemSchema),
  winner: z.string().nullable(),
  reasoningMd: z.string().nullable(),
  decidedAt: z.number().int().nonnegative().nullable(),
  purchaseId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

// Permissive item shape used for input validation. The strict ComparisonItemSchema
// is used when reading rows back from the database.
export const ComparisonItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  pros: z.array(z.string().max(500)).optional().default([]),
  cons: z.array(z.string().max(500)).optional().default([]),
  priceCents: z.number().int().nonnegative().nullable().optional().default(null),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  url: z.string().max(2000).nullable().optional().default(null),
});

export const ComparisonInputSchema = z.object({
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  items: z.array(ComparisonItemInputSchema).min(1),
  winner: z.string().max(200).nullable().optional().default(null),
  reasoningMd: z.string().max(4000).nullable().optional().default(null),
  decidedAt: z.number().int().nonnegative().nullable().optional().default(null),
  purchaseId: z.string().nullable().optional().default(null),
});
export type ComparisonInput = z.input<typeof ComparisonInputSchema>;
export type ComparisonInputParsed = z.infer<typeof ComparisonInputSchema>;

export const ComparisonUpdateSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  items: z.array(ComparisonItemInputSchema).min(1).optional(),
  winner: z.string().max(200).nullable().optional(),
  reasoningMd: z.string().max(4000).nullable().optional(),
  decidedAt: z.number().int().nonnegative().nullable().optional(),
  purchaseId: z.string().nullable().optional(),
});
export type ComparisonUpdate = z.input<typeof ComparisonUpdateSchema>;

// ── Store Notes ───────────────────────────────────────────────────────

export const StoreNoteSchema = z.object({
  id: z.string(),
  storeName: z.string(),
  returnsPolicy: z.string().nullable(),
  shippingNotes: z.string().nullable(),
  rewardsNotes: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type StoreNote = z.infer<typeof StoreNoteSchema>;

export const StoreNoteInputSchema = z.object({
  storeName: z.string().min(1).max(200),
  returnsPolicy: z.string().max(2000).nullable().optional().default(null),
  shippingNotes: z.string().max(2000).nullable().optional().default(null),
  rewardsNotes: z.string().max(2000).nullable().optional().default(null),
});
export type StoreNoteInput = z.input<typeof StoreNoteInputSchema>;
export type StoreNoteInputParsed = z.infer<typeof StoreNoteInputSchema>;
