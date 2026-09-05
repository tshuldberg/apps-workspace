// Subscription engine -- renewal, cost normalization, status, notifications, budget bridge

// Renewal engine
export {
  calculateNextRenewal,
  advanceRenewalDate,
  getUpcomingRenewals,
} from './renewal';

// Cost normalization
export {
  normalizeToMonthly,
  normalizeToAnnual,
  normalizeToDaily,
  calculateSubscriptionSummary,
} from './cost';
export type {
  EnvelopeCostSummary,
  SubscriptionCostSummary,
} from './cost';

// Status state machine
export {
  validateTransition,
  getValidTransitions,
} from './status';

// Notifications
export {
  getRenewalNotifications,
  getTrialExpirationAlerts,
  getMonthlySummaryNotification,
  logNotification,
  cancelNotifications,
  getNotificationLog,
} from './notifications';
export type { PendingNotification } from './notifications';

// Price history
export {
  recordPriceChange,
  getPriceHistory,
  getLifetimeCost,
} from './price-history';

// Budget bridge (subscription <-> recurring templates)
export {
  mapBillingCycleToFrequency,
  createSubscriptionTemplate,
  syncSubscriptionToTemplate,
  processRenewal,
  deactivateSubscriptionTemplate,
  reactivateSubscriptionTemplate,
} from './budget-bridge';

// Cancellation assist engine
export {
  scoreSubscription,
  getOpportunities,
  calculateTotalSavings,
  calculatePotentialSavings,
  shouldShowOpportunity,
} from './cancellation-assist';
export type {
  CancellationOpportunity,
  CancellationActionData,
  CancellationActionRecord,
  ScoreInput,
} from './cancellation-assist';

// Subscription ROI scoring
export {
  classifyUsage,
  scoreSubscriptionROI,
  getROIReport,
} from './roi';
export type {
  UsageStatus,
  SubscriptionROI,
  ROIInput,
} from './roi';
