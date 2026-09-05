import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const BillingCycleSchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'lifetime',
]);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

export const SubscriptionStatusSchema = z.enum([
  'active',
  'paused',
  'cancelled',
  'trial',
  'expired',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const RenewalEventStatusSchema = z.enum([
  'upcoming',
  'paid',
  'skipped',
  'missed',
]);
export type RenewalEventStatus = z.infer<typeof RenewalEventStatusSchema>;

export const CancellationActionTypeSchema = z.enum([
  'dismissed',
  'reminded',
  'cancelled',
  'downgraded',
  'kept',
]);
export type CancellationActionType = z.infer<typeof CancellationActionTypeSchema>;

// ── Core Entities ──────────────────────────────────────────────────────

export const SubscriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  costCents: z.number().int(),
  billingCycle: BillingCycleSchema,
  categoryId: z.string().nullable(),
  nextRenewalDate: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  trialEndDate: z.string().nullable(),
  iconUri: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  status: SubscriptionStatusSchema,
  notificationEnabled: z.boolean(),
  notificationDaysBefore: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const PriceHistorySchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  oldCostCents: z.number().int(),
  newCostCents: z.number().int(),
  changedOn: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type PriceHistory = z.infer<typeof PriceHistorySchema>;

export const RenewalEventSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  renewalDate: z.string(),
  amountCents: z.number().int(),
  status: RenewalEventStatusSchema,
  notifiedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type RenewalEvent = z.infer<typeof RenewalEventSchema>;

export const CancellationActionSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  action: CancellationActionTypeSchema,
  savingsCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  actedOn: z.string(),
  createdAt: z.string(),
});
export type CancellationAction = z.infer<typeof CancellationActionSchema>;

export const PriceAlternativeSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  alternativeName: z.string(),
  alternativeCostCents: z.number().int(),
  alternativeBillingCycle: BillingCycleSchema,
  alternativeUrl: z.string().nullable(),
  notes: z.string().nullable(),
  isFreeTier: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PriceAlternative = z.infer<typeof PriceAlternativeSchema>;

export const CatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable(),
  typicalCostCents: z.number().int().nullable(),
  typicalBillingCycle: BillingCycleSchema,
  cancelUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  iconUri: z.string().nullable(),
  searchTerms: z.string().nullable(),
  popularityRank: z.number().int(),
  createdAt: z.string(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

// ── Input Schemas ──────────────────────────────────────────────────────

export const CreateSubscriptionInputSchema = z.object({
  name: z.string().min(1).max(200),
  costCents: z.number().int().nonnegative(),
  billingCycle: BillingCycleSchema.default('monthly'),
  categoryId: z.string().nullable().default(null),
  nextRenewalDate: z.string().nullable().default(null),
  startDate: z.string(),
  endDate: z.string().nullable().default(null),
  trialEndDate: z.string().nullable().default(null),
  iconUri: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  status: SubscriptionStatusSchema.default('active'),
  notificationEnabled: z.boolean().default(true),
  notificationDaysBefore: z.number().int().min(1).max(30).default(3),
});
export type CreateSubscriptionInput = z.input<typeof CreateSubscriptionInputSchema>;

export const UpdateSubscriptionInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  costCents: z.number().int().nonnegative().optional(),
  billingCycle: BillingCycleSchema.optional(),
  categoryId: z.string().nullable().optional(),
  nextRenewalDate: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  trialEndDate: z.string().nullable().optional(),
  iconUri: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: SubscriptionStatusSchema.optional(),
  notificationEnabled: z.boolean().optional(),
  notificationDaysBefore: z.number().int().min(1).max(30).optional(),
});
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionInputSchema>;

export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  sortOrder: z.number().int().nonnegative().default(0),
});
export type CreateCategoryInput = z.input<typeof CreateCategoryInputSchema>;

export const CreatePriceAlternativeInputSchema = z.object({
  subscriptionId: z.string(),
  alternativeName: z.string().min(1).max(200),
  alternativeCostCents: z.number().int().nonnegative(),
  alternativeBillingCycle: BillingCycleSchema.default('monthly'),
  alternativeUrl: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  isFreeTier: z.boolean().default(false),
});
export type CreatePriceAlternativeInput = z.input<typeof CreatePriceAlternativeInputSchema>;

export const CreateCancellationActionInputSchema = z.object({
  subscriptionId: z.string(),
  action: CancellationActionTypeSchema,
  savingsCents: z.number().int().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
});
export type CreateCancellationActionInput = z.input<typeof CreateCancellationActionInputSchema>;

// ── Detection Types (V2 - Bank Sync) ──────────────────────────────────

export const DetectionFrequencySchema = z.enum(['weekly', 'monthly', 'annual']);
export type DetectionFrequency = z.infer<typeof DetectionFrequencySchema>;

export const DetectionStatusSchema = z.enum(['pending', 'accepted', 'dismissed']);
export type DetectionStatus = z.infer<typeof DetectionStatusSchema>;

export const DetectedSubscriptionSchema = z.object({
  id: z.string(),
  payee: z.string(),
  normalizedPayee: z.string(),
  amountCents: z.number().int(),
  frequency: DetectionFrequencySchema,
  confidence: z.number().min(0).max(1),
  matchedCatalogId: z.string().nullable(),
  transactionDates: z.array(z.string()),
  status: DetectionStatusSchema,
  acceptedSubscriptionId: z.string().nullable(),
  bankConnectionId: z.string().nullable(),
  detectedAt: z.string(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DetectedSubscription = z.infer<typeof DetectedSubscriptionSchema>;

export const DismissedPayeeSchema = z.object({
  id: z.string(),
  normalizedPayee: z.string(),
  rawPayee: z.string(),
  dismissedAt: z.string(),
});
export type DismissedPayee = z.infer<typeof DismissedPayeeSchema>;

export const SaveDetectionResultInputSchema = z.object({
  payee: z.string(),
  normalizedPayee: z.string(),
  amountCents: z.number().int().nonnegative(),
  frequency: DetectionFrequencySchema,
  confidence: z.number().min(0).max(1),
  matchedCatalogId: z.string().nullable().default(null),
  transactionDates: z.array(z.string()),
  bankConnectionId: z.string().nullable().default(null),
});
export type SaveDetectionResultInput = z.input<typeof SaveDetectionResultInputSchema>;

// ── Filter Schemas ─────────────────────────────────────────────────────

export const SubscriptionFilterSchema = z.object({
  status: SubscriptionStatusSchema.optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'cost', 'nextRenewal', 'createdAt']).default('nextRenewal'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).strict();
export type SubscriptionFilter = z.infer<typeof SubscriptionFilterSchema>;

// ── Analytics Types ────────────────────────────────────────────────────

export interface CostSummary {
  totalMonthlyCents: number;
  totalAnnualCents: number;
  totalWeeklyCents: number;
  activeCount: number;
  pausedCount: number;
  cancelledCount: number;
  trialCount: number;
  averageMonthlyCents: number;
  mostExpensive: { name: string; monthlyCents: number } | null;
  cheapest: { name: string; monthlyCents: number } | null;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  monthlyCents: number;
  annualCents: number;
  percentage: number;
  subscriptionCount: number;
}

export interface CycleBreakdown {
  cycle: BillingCycle;
  count: number;
  totalMonthlyCents: number;
  percentage: number;
}

export interface PriceChangeAnalysis {
  subscriptionId: string;
  subscriptionName: string;
  currentCostCents: number;
  originalCostCents: number;
  totalChangeCents: number;
  totalChangePercent: number;
  changes: { date: string; oldCents: number; newCents: number; changeCents: number; changePercent: number }[];
  direction: 'increased' | 'decreased' | 'stable';
}

export interface OpportunityScore {
  subscriptionId: string;
  subscriptionName: string;
  totalScore: number;
  reasons: { signal: string; points: number; description: string }[];
  monthlySavingsCents: number;
  annualSavingsCents: number;
  priority: 'high' | 'medium';
}

export interface CalendarDay {
  date: string;
  renewals: RenewalItem[];
  totalCents: number;
}

export interface RenewalItem {
  subscriptionId: string;
  subscriptionName: string;
  amountCents: number;
  billingCycle: BillingCycle;
  categoryColor: string;
  status: RenewalEventStatus;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  totalCents: number;
  renewalCount: number;
}
