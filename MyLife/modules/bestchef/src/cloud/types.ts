/**
 * BestChef cloud entity schemas (Supabase `bc_` tables).
 *
 * Every schema is defined in Zod with a TypeScript type inferred alongside.
 * UUIDs use `z.string().uuid()`, timestamps use `z.coerce.date()`.
 */

import { z } from 'zod';

// ── Shared Enums / Constants ───────────────────────────────────────────

export const DishCategory = z.enum([
  'appetizer',
  'soup',
  'salad',
  'main',
  'side',
  'dessert',
  'bread',
  'beverage',
  'condiment',
  'snack',
  'breakfast',
]);
export type DishCategory = z.infer<typeof DishCategory>;

export const VoteTier = {
  NOT_FOR_ME: 'like',
  ID_EAT_THAT: 'bronze',
  AS_GOOD_AS_MOMMAS: 'silver',
  BEST_CHEF: 'gold',
  TAP_UP: 'tap_up',
  TAP_DOWN: 'tap_down',
} as const;
export type VoteTier = (typeof VoteTier)[keyof typeof VoteTier];

export const VOTE_TIER_WEIGHTS: Record<VoteTier, number> = {
  gold: 5,
  silver: 3,
  bronze: 1,
  like: 0,
  tap_up: 1,
  tap_down: -1,
};

/** Free-form cuisine string. Not enumerated because the taxonomy is open-ended. */
export type CuisineOrigin = string;

// ── Dish ───────────────────────────────────────────────────────────────

export const DishStatus = z.enum(['active', 'pending', 'merged', 'rejected']);

export const DishSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  nativeName: z.string().nullable(),
  category: DishCategory,
  cuisine: z.string().min(1),
  region: z.string().nullable(),
  description: z.string().nullable(),
  photoUrl: z.string().nullable(),
  gradientFrom: z.string().nullable(),
  gradientTo: z.string().nullable(),
  emoji: z.string().nullable(),
  aliasCount: z.number().int().nonnegative().default(0),
  submissionCount: z.number().int().nonnegative().default(0),
  status: DishStatus.default('active'),
  proposedBy: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  /**
   * Approved bc_dish_translations name for the caller's locale (plan 33
   * Phase 2.3). Absent/null means no translation exists: display falls back
   * to the canonical `name` (use dishDisplayName()).
   */
  localizedName: z.string().nullable().optional(),
  localizedDescription: z.string().nullable().optional(),
});
export type Dish = z.infer<typeof DishSchema>;

// ── DishAlias ──────────────────────────────────────────────────────────

export const DishAliasSchema = z.object({
  id: z.string().uuid(),
  dishId: z.string().uuid(),
  alias: z.string().min(1),
  locale: z.string().nullable(),
});
export type DishAlias = z.infer<typeof DishAliasSchema>;

// ── RecipeSnapshot ─────────────────────────────────────────────────────

export const RecipeSnapshotSchema = z.object({
  id: z.string().uuid(),
  originalLocalRecipeId: z.string().nullable(),
  profileId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  servings: z.number().int().positive().nullable(),
  prepTimeMins: z.number().int().nonnegative().nullable(),
  cookTimeMins: z.number().int().nonnegative().nullable(),
  totalTimeMins: z.number().int().nonnegative().nullable(),
  difficulty: z.string().nullable(),
  ingredientsJson: z.unknown(),
  stepsJson: z.unknown(),
  tags: z.array(z.string()).nullable(),
  nutritionJson: z.unknown().nullable(),
  sourceUrl: z.string().nullable(),
  sourceAttribution: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type RecipeSnapshot = z.infer<typeof RecipeSnapshotSchema>;

// ── Submission ─────────────────────────────────────────────────────────

export const VerificationMethod = z.enum([
  'exif',
  'ai_detection',
  'community',
  'manual',
]);

export const ContentModerationStatus = z.enum([
  'approved',
  'pending',
  'hidden',
  'rejected',
]);
export type ContentModerationStatus = z.infer<typeof ContentModerationStatus>;

export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  dishId: z.string().uuid(),
  recipeSnapshotId: z.string().uuid(),
  profileId: z.string().uuid(),
  photoUrl: z.string().nullable(),
  photoVerified: z.boolean().default(false),
  photoVerifiedAt: z.coerce.date().nullable(),
  verificationMethod: VerificationMethod.nullable(),
  chefLocation: z.string().nullable(),
  chefLocationLat: z.number().nullable(),
  chefLocationLng: z.number().nullable(),
  chefOrigin: z.string().nullable(),
  countryCode: z.string().max(2).nullable(),
  voteScore: z.number().default(0),
  likeCount: z.number().int().nonnegative().default(0),
  rank: z.number().int().nullable(),
  moderationStatus: ContentModerationStatus.default('approved'),
  // P1-A additions
  region: z.string().nullable().default(null),
  isRestaurant: z.boolean().default(false),
  upvoteCount: z.number().int().nonnegative().default(0),
  downvoteCount: z.number().int().nonnegative().default(0),
  reviewedCount: z.number().int().nonnegative().default(0),
  tapCount: z.number().int().nonnegative().default(0),
  /**
   * Author's app language at publish time (plan 33 Phase 2.5), lowercase
   * tag ('de', 'pt-br'). Null = untagged (pre-2.5 rows and old clients);
   * untagged rows only appear in unfiltered views.
   */
  language: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Submission = z.infer<typeof SubmissionSchema>;

// ── Vote ───────────────────────────────────────────────────────────────

export const VoteTierSchema = z.enum(['gold', 'silver', 'bronze', 'like', 'tap_up', 'tap_down']);

export const VoteSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  voterProfileId: z.string().uuid(),
  tier: VoteTierSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Vote = z.infer<typeof VoteSchema>;

// ── Ranking ────────────────────────────────────────────────────────────

export const RankingSchema = z.object({
  dishId: z.string().uuid(),
  submissionId: z.string().uuid(),
  score: z.number(),
  rank: z.number().int(),
  region: z.string().nullable(),
  countryCode: z.string().max(2).nullable(),
  updatedAt: z.coerce.date(),
});
export type Ranking = z.infer<typeof RankingSchema>;

// ── Comment (bc_comments) ──────────────────────────────────────────────

export const CommentType = z.enum(['comment', 'tried_this', 'chefs_tip']);

export const CommentSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  profileId: z.string().uuid(),
  socialActivityId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  body: z.string().max(2000),
  commentType: CommentType.default('comment'),
  photoUrl: z.string().nullable(),
  isPinned: z.boolean().default(false),
  helpfulCount: z.number().int().nonnegative().default(0),
  moderationStatus: ContentModerationStatus.default('approved'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  editedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
});
export type Comment = z.infer<typeof CommentSchema>;

// ── CommentHelpful ─────────────────────────────────────────────────────

export const CommentHelpfulSchema = z.object({
  commentId: z.string().uuid(),
  voterProfileId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type CommentHelpful = z.infer<typeof CommentHelpfulSchema>;

// ── PhotoReport ────────────────────────────────────────────────────────

export const PhotoReportReason = z.enum([
  'ai_generated',
  'stolen',
  'inappropriate',
  'wrong_dish',
  'other',
]);

export const PhotoReportStatus = z.enum(['open', 'noted', 'resolved', 'dismissed']);

export const PhotoReportSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  reporterId: z.string().uuid(),
  reason: PhotoReportReason,
  status: PhotoReportStatus.default('open'),
  createdAt: z.coerce.date(),
});
export type PhotoReport = z.infer<typeof PhotoReportSchema>;

// ── Flag ───────────────────────────────────────────────────────────────

export const FlagTargetType = z.enum([
  'submission',
  'comment',
  'dish_proposal',
  'photo',
  'profile',
  'media_asset',
  'product_contribution',
  'product_evidence',
  'vote_proof',
]);

export const FlagStatus = z.enum(['open', 'noted', 'actioned', 'dismissed']);

export const FlagSchema = z.object({
  id: z.string().uuid(),
  targetType: FlagTargetType,
  targetId: z.string().uuid(),
  flaggerId: z.string().uuid(),
  reason: z.string().min(1),
  status: FlagStatus.default('open'),
  resolution: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Flag = z.infer<typeof FlagSchema>;

// ── Note (Community Notes) ─────────────────────────────────────────────

export const NoteStatus = z.enum(['pending', 'shown', 'hidden']);

export const NoteSchema = z.object({
  id: z.string().uuid(),
  flagId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string().max(1000),
  helpfulCount: z.number().int().nonnegative().default(0),
  unhelpfulCount: z.number().int().nonnegative().default(0),
  status: NoteStatus.default('pending'),
  createdAt: z.coerce.date(),
});
export type Note = z.infer<typeof NoteSchema>;

// ── NoteRating ─────────────────────────────────────────────────────────

export const NoteRatingValue = z.enum(['helpful', 'unhelpful']);

export const NoteRatingSchema = z.object({
  noteId: z.string().uuid(),
  raterId: z.string().uuid(),
  rating: NoteRatingValue,
  createdAt: z.coerce.date(),
});
export type NoteRating = z.infer<typeof NoteRatingSchema>;

// ── BadgeDefinition ────────────────────────────────────────────────────

export const BadgeTier = z.enum(['bronze', 'silver', 'gold', 'platinum']);

export const BadgeDefinitionSchema = z.object({
  id: z.string().min(1), // text PK, e.g. 'first_submission'
  name: z.string().min(1),
  description: z.string(),
  icon: z.string(),
  criteriaJson: z.unknown(),
  tier: BadgeTier,
  createdAt: z.coerce.date(),
});
export type BadgeDefinition = z.infer<typeof BadgeDefinitionSchema>;

// ── ChefBadge ──────────────────────────────────────────────────────────

export const ChefBadgeSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  badgeId: z.string().min(1),
  earnedAt: z.coerce.date(),
});
export type ChefBadge = z.infer<typeof ChefBadgeSchema>;

// ── CreatorApplication ─────────────────────────────────────────────────

export const CreatorApplicationStatus = z.enum([
  'submitted',
  'under_review',
  'approved',
  'declined',
  'more_info_needed',
  'withdrawn',
]);
export type CreatorApplicationStatusValue = z.infer<typeof CreatorApplicationStatus>;

export const CreatorApplicationSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  platformLinks: z.unknown(), // jsonb
  bio: z.string(),
  specialties: z.array(z.string()),
  status: CreatorApplicationStatus.default('submitted'),
  reviewedAt: z.coerce.date().nullable(),
  reviewerNote: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type CreatorApplication = z.infer<typeof CreatorApplicationSchema>;

// ── Tip ────────────────────────────────────────────────────────────────

export const TipStatus = z.enum(['pending', 'completed', 'failed', 'refunded']);

export const TipSchema = z.object({
  id: z.string().uuid(),
  tipperId: z.string().uuid(),
  chefId: z.string().uuid(),
  submissionId: z.string().uuid().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(3),
  platformFeeCents: z.number().int().nonnegative(),
  paymentIntentId: z.string(),
  status: TipStatus.default('pending'),
  createdAt: z.coerce.date(),
});
export type Tip = z.infer<typeof TipSchema>;

// ── Subscription ───────────────────────────────────────────────────────

export const SubscriptionStatus = z.enum([
  'active',
  'cancelled',
  'past_due',
  'expired',
]);

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  subscriberId: z.string().uuid(),
  chefId: z.string().uuid(),
  tierName: z.string(),
  priceCents: z.number().int().nonnegative(),
  platformFeeCents: z.number().int().nonnegative(),
  status: SubscriptionStatus.default('active'),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  stripeSubscriptionId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// ── SubscriptionTier ───────────────────────────────────────────────────

export const SubscriptionTierSchema = z.object({
  id: z.string().uuid(),
  chefId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  benefits: z.unknown(), // jsonb
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
});
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

// ── Post ───────────────────────────────────────────────────────────────

export const PostType = z.enum(['blog', 'exclusive_recipe', 'announcement']);
export const PostVisibility = z.enum(['public', 'subscribers', 'tier_specific']);

export const PostSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string(),
  postType: PostType,
  visibility: PostVisibility.default('public'),
  requiredTierId: z.string().uuid().nullable(),
  coverImageUrl: z.string().nullable(),
  linkedSubmissionId: z.string().uuid().nullable(),
  likeCount: z.number().int().nonnegative().default(0),
  commentCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Post = z.infer<typeof PostSchema>;

// ── RecipeFork ─────────────────────────────────────────────────────────

export const RecipeForkSchema = z.object({
  id: z.string().uuid(),
  sourceSnapshotId: z.string().uuid(),
  forkedByProfileId: z.string().uuid(),
  forkedSnapshotId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type RecipeFork = z.infer<typeof RecipeForkSchema>;

// ── BrandMapping ───────────────────────────────────────────────────────

export const BrandMappingSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  brandName: z.string(),
  genericName: z.string().nullable(),
  category: z.string().nullable(),
  verified: z.boolean().default(false),
  createdAt: z.coerce.date(),
});
export type BrandMapping = z.infer<typeof BrandMappingSchema>;

// Product cache, contributions, and evidence

export const ProductDataSource = z.enum([
  'manual',
  'unknown',
  'open_food_facts',
  'usda_fdc',
  'gs1',
  'bestchef_cache',
  'local_cache',
  'receipt_ocr',
  'food_recognition',
  'user_contribution',
]);
export type ProductDataSource = z.infer<typeof ProductDataSource>;

export const ProductType = z.enum([
  'generic',
  'branded',
  'raw_ingredient',
  'prepared_food',
]);
export type ProductType = z.infer<typeof ProductType>;

export const ProductModerationStatus = z.enum([
  'pending',
  'approved',
  'quarantined',
  'rejected',
]);
export type ProductModerationStatus = z.infer<typeof ProductModerationStatus>;

export const ProductPublicationStatus = z.enum([
  'private',
  'published',
  'superseded',
  'rejected',
]);
export type ProductPublicationStatus = z.infer<typeof ProductPublicationStatus>;

export const ProductAliasType = z.enum([
  'barcode',
  'name',
  'receipt_line',
  'ocr_label',
  'source_id',
]);
export type ProductAliasType = z.infer<typeof ProductAliasType>;

export const ProductServingBasis = z.enum([
  'per_serving',
  'per_100g',
  'per_100ml',
  'per_package',
  'per_item',
]);
export type ProductServingBasis = z.infer<typeof ProductServingBasis>;

export const ProductContributionStatus = z.enum([
  'private_draft',
  'submitted',
  'verified',
  'rejected',
  'superseded',
]);
export type ProductContributionStatus = z.infer<typeof ProductContributionStatus>;

export const ProductContributionType = z.enum([
  'product_record',
  'alias',
  'nutrition',
  'evidence',
  'correction',
]);
export type ProductContributionType = z.infer<typeof ProductContributionType>;

export const OpenFoodFactsExportStatus = z.enum([
  'not_applicable',
  'eligible',
  'pending',
  'sent',
  'rejected',
]);
export type OpenFoodFactsExportStatus = z.infer<typeof OpenFoodFactsExportStatus>;

export const ProductEvidenceKind = z.enum([
  'package_front',
  'nutrition_label',
  'barcode',
  'source_page',
  'receipt_crop',
  'other',
]);
export type ProductEvidenceKind = z.infer<typeof ProductEvidenceKind>;

export const ProductEvidenceConsentStatus = z.enum([
  'not_granted',
  'owned_by_user',
  'permission_granted',
  'public_domain',
  'not_required',
]);
export type ProductEvidenceConsentStatus = z.infer<typeof ProductEvidenceConsentStatus>;

export const ProductEvidenceVisibility = z.enum(['private', 'unlisted', 'public']);
export type ProductEvidenceVisibility = z.infer<typeof ProductEvidenceVisibility>;

export const ProductRecordSchema = z.object({
  id: z.string().uuid(),
  canonicalName: z.string().min(1),
  brand: z.string().nullable(),
  manufacturer: z.string().nullable(),
  productType: ProductType.default('generic'),
  barcode: z.string().nullable(),
  gtin: z.string().nullable(),
  category: z.string().nullable(),
  grocerySection: z.string().nullable(),
  defaultStorageLocation: z.string().nullable(),
  nutritionJson: z.unknown(),
  source: ProductDataSource,
  sourceId: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  license: z.string().min(1),
  licenseUrl: z.string().nullable(),
  attribution: z.string().nullable(),
  fetchedAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
  createdByProfileId: z.string().uuid().nullable(),
  verifiedByProfileId: z.string().uuid().nullable(),
  moderationStatus: ProductModerationStatus.default('pending'),
  publicationStatus: ProductPublicationStatus.default('private'),
  supersededByProductId: z.string().uuid().nullable(),
  metadata: z.unknown(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProductRecord = z.infer<typeof ProductRecordSchema>;

export const ProductAliasSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  aliasType: ProductAliasType,
  aliasValue: z.string().min(1),
  normalizedValue: z.string().min(1),
  source: ProductDataSource,
  sourceId: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  license: z.string().min(1),
  attribution: z.string().nullable(),
  fetchedAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
  moderationStatus: ProductModerationStatus.default('pending'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProductAlias = z.infer<typeof ProductAliasSchema>;

export const ProductNutritionSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  servingBasis: ProductServingBasis.default('per_serving'),
  servingSizeText: z.string().nullable(),
  servingQuantity: z.number().nullable(),
  servingUnit: z.string().nullable(),
  nutritionJson: z.unknown(),
  source: ProductDataSource,
  sourceId: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  license: z.string().min(1),
  attribution: z.string().nullable(),
  fetchedAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
  moderationStatus: ProductModerationStatus.default('pending'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProductNutrition = z.infer<typeof ProductNutritionSchema>;

export const ProductContributionSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  localProductId: z.string().nullable(),
  contributionType: ProductContributionType,
  proposedProductJson: z.record(z.unknown()).default({}),
  proposedAliasJson: z.record(z.unknown()).default({}),
  proposedNutritionJson: z.record(z.unknown()).default({}),
  status: ProductContributionStatus.default('private_draft'),
  shareOptIn: z.boolean().default(false),
  evidenceOptIn: z.boolean().default(false),
  source: ProductDataSource.default('manual'),
  sourceId: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  license: z.string().min(1),
  attribution: z.string().nullable(),
  openFoodFactsExportStatus: OpenFoodFactsExportStatus.default('not_applicable'),
  moderationStatus: ProductModerationStatus.default('pending'),
  moderationNotes: z.string().nullable(),
  reviewedByProfileId: z.string().uuid().nullable(),
  submittedAt: z.coerce.date().nullable(),
  reviewedAt: z.coerce.date().nullable(),
  verifiedAt: z.coerce.date().nullable(),
  rejectedAt: z.coerce.date().nullable(),
  supersededByContributionId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProductContribution = z.infer<typeof ProductContributionSchema>;

export const ProductEvidenceSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  contributionId: z.string().uuid().nullable(),
  mediaAssetId: z.string().uuid().nullable(),
  ownerProfileId: z.string().uuid(),
  evidenceKind: ProductEvidenceKind,
  sourceUrl: z.string().nullable(),
  imageLicense: z.string().min(1),
  imageConsentStatus: ProductEvidenceConsentStatus.default('not_granted'),
  shareOptIn: z.boolean().default(false),
  moderationStatus: ProductModerationStatus.default('pending'),
  visibility: ProductEvidenceVisibility.default('private'),
  attribution: z.string().nullable(),
  capturedAt: z.coerce.date().nullable(),
  approvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProductEvidence = z.infer<typeof ProductEvidenceSchema>;

// ── P1-A additions ────────────────────────────────────────────────────

// Notification kind + category (mirrors bc_notifications CHECK constraints)
export const NotificationKindSchema = z.enum([
  'upvote',
  'reviewed_vote',
  'rank_up',
  'rank_milestone',
  'follow',
  'comment',
  'mention',
  'badge',
  'competition',
  'system',
  // Statement of reasons on moderation decisions + appeal outcomes
  // (audit H4 / DSA Art. 17).
  'moderation_decision',
  'appeal_resolved',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationCategorySchema = z.enum([
  'votes',
  'ranks',
  'social',
  'system',
  'moderation',
]);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

export const NotificationTargetTypeSchema = z.enum([
  'submission',
  'chef',
  'dish',
  'badge',
  'challenge',
  'comment',
  'appeal',
]);
export type NotificationTargetType = z.infer<typeof NotificationTargetTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: NotificationKindSchema,
  category: NotificationCategorySchema,
  /** Legacy stored copy; typed rows store '' and render from kind+params. */
  title: z.string().default(''),
  body: z.string().default(''),
  /** Localization params (plan 33 Phase 2.1); clients render via catalogs. */
  params: z.record(z.unknown()).default({}),
  actorUserId: z.string().uuid().nullable(),
  actorName: z.string().nullable(),
  actorColor: z.string().nullable(),
  targetType: NotificationTargetTypeSchema.nullable(),
  targetId: z.string().nullable(),
  isRead: z.boolean().default(false),
  createdAt: z.coerce.date(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// Follower edge (bc_followers)
export const FollowerEdgeSchema = z.object({
  followerId: z.string().uuid(),
  chefId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type FollowerEdge = z.infer<typeof FollowerEdgeSchema>;

// Rank history entry (bc_rank_history)
export const RankHistoryEntrySchema = z.object({
  chefId: z.string().uuid(),
  week: z.coerce.date(),
  rank: z.number().int().positive(),
  totalChefs: z.number().int().positive(),
});
export type RankHistoryEntry = z.infer<typeof RankHistoryEntrySchema>;
