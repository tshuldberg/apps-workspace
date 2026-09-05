// Definition
export { SUBS_MODULE } from './definition';

// Types
export type {
  BillingCycle,
  SubscriptionStatus,
  RenewalEventStatus,
  CancellationActionType,
  Subscription,
  Category,
  PriceHistory,
  RenewalEvent,
  CancellationAction,
  PriceAlternative,
  CatalogEntry,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreateCategoryInput,
  CreatePriceAlternativeInput,
  CreateCancellationActionInput,
  SubscriptionFilter,
  CostSummary,
  CategoryBreakdown,
  CycleBreakdown,
  PriceChangeAnalysis,
  OpportunityScore,
  CalendarDay,
  RenewalItem,
  CalendarMonth,
} from './types';

export {
  BillingCycleSchema,
  SubscriptionStatusSchema,
  RenewalEventStatusSchema,
  CancellationActionTypeSchema,
  SubscriptionSchema,
  CategorySchema,
  PriceHistorySchema,
  RenewalEventSchema,
  CancellationActionSchema,
  PriceAlternativeSchema,
  CatalogEntrySchema,
  CreateSubscriptionInputSchema,
  UpdateSubscriptionInputSchema,
  CreateCategoryInputSchema,
  CreatePriceAlternativeInputSchema,
  CreateCancellationActionInputSchema,
  SubscriptionFilterSchema,
} from './types';

// CRUD
export {
  createSubscription,
  getSubscription,
  listSubscriptions,
  updateSubscription,
  deleteSubscription,
  getSubscriptionCount,
  listCategories,
  createCategory,
  deleteCategory,
  getPriceHistory,
  addPriceChange,
  getUpcomingRenewals,
  generateRenewalEvents,
  markRenewalPaid,
  getRenewalEvents,
  logCancellationAction,
  getCancellationHistory,
  listAlternatives,
  addAlternative,
  deleteAlternative,
  searchCatalog,
  getCatalogByCategory,
  getAllCatalogEntries,
  getTotalMonthlyCost,
  getTotalAnnualCost,
  getCostByCategory,
  normalizeToMonthlyCents,
  normalizeToAnnualCents,
} from './db/crud';

// Engines
export {
  getCostSummary,
  getCategoryBreakdown,
  getCycleBreakdown,
  getPriceChanges,
  getSpendingProjection,
} from './engines/cost-analysis';

export {
  getCalendarMonth,
  getAgendaView,
  getRenewalSummary,
  getDueNotifications,
} from './engines/renewal-calendar';

export {
  scoreSubscription,
  getOpportunities,
  shouldShowOpportunity,
  calculateTotalSavings,
} from './engines/cancellation-assist';

export {
  matchToCatalog,
  getComparison,
  getComparisonSummary,
} from './engines/price-comparison';

export type {
  ComparisonResult,
  TierComparison,
  AnnualDiscount,
  AlternativeComparison,
} from './engines/price-comparison';

// V2 — Detection types
export type {
  DetectionFrequency,
  DetectionStatus,
  DetectedSubscription,
  DismissedPayee,
  SaveDetectionResultInput,
} from './types';

export {
  DetectionFrequencySchema,
  DetectionStatusSchema,
  DetectedSubscriptionSchema,
  DismissedPayeeSchema,
  SaveDetectionResultInputSchema,
} from './types';

// V2 — Detection CRUD
export {
  saveDetectionResult,
  saveDetectionResults,
  getDetectedSubscription,
  listDetectedSubscriptions,
  getPendingDetections,
  acceptDetection,
  dismissDetection,
  deleteDetectedSubscription,
  clearOldDetections,
  addDismissedPayee,
  listDismissedPayees,
  getDismissedPayeeNames,
  removeDismissedPayee,
  isDismissedPayee,
} from './db/detection';

// V2 — Bank detection engine
export {
  runDetection,
  acceptDetectedSubscription,
  dismissDetectedSubscription,
  acceptAllPendingDetections,
  frequencyToBillingCycle,
  estimateNextRenewal,
  detectionToSubscriptionInput,
} from './engines/bank-detection';

export type {
  BankDetectedSubscription,
  DetectionRunResult,
  AcceptDetectionResult,
} from './engines/bank-detection';

// V2 — Plaid configuration
export {
  getPlaidConfig,
  isPlaidConfigured,
  PLAID_ENV_VARS,
} from './plaid-config';

export type {
  PlaidConfig,
  PlaidEnvironment,
  PlaidLinkParams,
} from './plaid-config';

// V2 — Detection schema
export {
  CREATE_DETECTED_SUBSCRIPTIONS,
  CREATE_DISMISSED_PAYEES,
  V2_TABLES,
  V2_INDEXES,
  V2_ALTER_STATEMENTS,
} from './db/detection-schema';
