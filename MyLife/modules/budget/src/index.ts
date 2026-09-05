// @mylife/budget — MyBudget module

// Module definition
export { BUDGET_MODULE } from './definition';
export { budgetCrossModule } from './cross-module';
export type { BudgetExportBundle, BudgetResetResult } from './portability';

// Cross-Module Integrations (P8-A: Shop -> Budget)
export {
  acceptShopTransactionSuggestion,
  extractShopSourceId,
  getShopPendingSuggestions,
  type BudgetTransactionSuggestion,
} from './integrations/shop-feed';

// Automations (Phase 5-core)
export { receiptToBudgetRule } from './automations/receipt-to-budget';
export type {
  ReceiptToBudgetInput,
  ReceiptToBudgetPreviewState,
  ReceiptToBudgetResult,
} from './automations/receipt-to-budget';

// UI barrel. `./ui/index.ts` exports only web-safe design tokens and
// typography; the full RN component surface (GlassCard, MaterialSymbol,
// AddFAB, ...) lives in `./ui/index.native.ts`, which Metro picks
// automatically on mobile. Web bundlers (Turbopack/webpack) ignore the
// `.native.ts` variant and see tokens only, so the `.ttf` icon-font assets
// in `@expo/vector-icons` never enter the web dependency graph.
// Mobile code keeps importing everything from `@mylife/budget` unchanged.
export * from './ui';

// Types & schemas
export {
  // V1-V3
  AccountType,
  TransactionDirection,
  EnvelopeSchema,
  EnvelopeInsertSchema,
  EnvelopeUpdateSchema,
  AccountSchema,
  AccountInsertSchema,
  AccountUpdateSchema,
  BudgetTransactionSchema,
  BudgetTransactionInsertSchema,
  BudgetTransactionUpdateSchema,
  BudgetTransactionFilterSchema,
  BudgetGoalSchema,
  BudgetGoalInsertSchema,
  BudgetGoalUpdateSchema,
  BudgetSettingSchema,
  BillingCycle,
  SubscriptionStatus,
  BudgetSubscriptionSchema,
  BudgetSubscriptionInsertSchema,
  BudgetSubscriptionUpdateSchema,
  BudgetSubscriptionFilterSchema,
  CatalogCategorySchema,
  // V4 — Budget engine
  CategoryGroupSchema,
  CategoryGroupInsertSchema,
  CategoryGroupUpdateSchema,
  BudgetAllocationSchema,
  BudgetAllocationInsertSchema,
  TransactionSplitSchema,
  TransactionSplitInsertSchema,
  RecurringFrequency,
  RecurringTemplateSchema,
  RecurringTemplateInsertSchema,
  RecurringTemplateUpdateSchema,
  PayeeCacheSchema,
  AmountSign,
  CsvProfileSchema,
  CsvProfileInsertSchema,
  PriceHistorySchema,
  NotificationType,
  NotificationLogSchema,
  MatchType,
  TransactionRuleSchema,
  TransactionRuleInsertSchema,
  TransactionRuleUpdateSchema,
  NetWorthSnapshotSchema,
  PayoffStrategy,
  DebtPayoffPlanSchema,
  DebtPayoffPlanInsertSchema,
  Compounding,
  DebtPayoffDebtSchema,
  DebtPayoffDebtInsertSchema,
  BudgetRolloverSchema,
  BudgetAlertSchema,
  BudgetAlertInsertSchema,
  AlertHistorySchema,
  CurrencySchema,
  ExchangeRateSchema,
  SharingMode,
  SharedEnvelopeSchema,
  // V5
  AoMSnapshotSchema,
  AoMSnapshotInsertSchema,
  MilestoneType,
  NetWorthMilestoneSchema,
  NetWorthMilestoneInsertSchema,
  CancellationActionType,
  CancellationActionSchema,
  CancellationActionInsertSchema,
  // V6
  ReceiptStatus,
  ReceiptSchema,
  ReceiptInsertSchema,
  ReceiptUpdateSchema,
  ExchangeRateHistorySchema,
  ExchangeRateHistoryInsertSchema,
  CategorizationFeedbackSchema,
  CategorizationFeedbackInsertSchema,
  LoanType,
  LoanSchema,
  LoanInsertSchema,
  LoanUpdateSchema,
  LoanPaymentSchema,
  LoanPaymentInsertSchema,
  AssetClass,
  HoldingSchema,
  HoldingInsertSchema,
  HoldingUpdateSchema,
  HoldingSnapshotSchema,
  HoldingSnapshotInsertSchema,
  FamilySchema,
  FamilyInsertSchema,
  FamilyRole,
  FamilyMemberSchema,
  FamilyMemberInsertSchema,
  FamilyMemberUpdateSchema,
  SharingModeV6,
  EnvelopeSharingSchema,
  EnvelopeSharingInsertSchema,
  SyncOperation,
  SyncLogSchema,
  SyncLogInsertSchema,
  ContactSchema,
  ContactInsertSchema,
  ContactUpdateSchema,
  SplitType,
  ExpenseSplitSchema,
  ExpenseSplitInsertSchema,
  SplitParticipantSchema,
  SplitParticipantInsertSchema,
  SettlementSchema,
  SettlementInsertSchema,
} from './types';

// Bank sync contract
export * from './bank-sync';
export type {
  // V1-V3
  Envelope,
  EnvelopeInsert,
  EnvelopeUpdate,
  Account,
  AccountInsert,
  AccountUpdate,
  BudgetTransaction,
  BudgetTransactionInsert,
  BudgetTransactionUpdate,
  BudgetTransactionFilter,
  BudgetGoal,
  BudgetGoalInsert,
  BudgetGoalUpdate,
  BudgetSetting,
  BudgetSubscription,
  BudgetSubscriptionInsert,
  BudgetSubscriptionUpdate,
  BudgetSubscriptionFilter,
  CatalogEntry,
  CatalogCategory,
  // V4
  CategoryGroup,
  CategoryGroupInsert,
  CategoryGroupUpdate,
  BudgetAllocation,
  BudgetAllocationInsert,
  TransactionSplit,
  TransactionSplitInsert,
  RecurringTemplate,
  RecurringTemplateInsert,
  RecurringTemplateUpdate,
  PayeeCache,
  CsvProfile,
  CsvProfileInsert,
  PriceHistory,
  NotificationLog,
  TransactionRule,
  TransactionRuleInsert,
  TransactionRuleUpdate,
  NetWorthSnapshot,
  DebtPayoffPlan,
  DebtPayoffPlanInsert,
  DebtPayoffDebt,
  DebtPayoffDebtInsert,
  BudgetRollover,
  BudgetAlert,
  BudgetAlertInsert,
  AlertHistory,
  Currency,
  ExchangeRate,
  SharedEnvelope,
  // V5
  AoMSnapshot,
  AoMSnapshotInsert,
  NetWorthMilestone,
  NetWorthMilestoneInsert,
  CancellationAction,
  CancellationActionInsert,
  // V6
  Receipt,
  ReceiptInsert,
  ReceiptUpdate,
  ExchangeRateHistory,
  ExchangeRateHistoryInsert,
  CategorizationFeedback,
  CategorizationFeedbackInsert,
  Loan,
  LoanInsert,
  LoanUpdate,
  LoanPayment,
  LoanPaymentInsert,
  Holding,
  HoldingInsert,
  HoldingUpdate,
  HoldingSnapshot,
  HoldingSnapshotInsert,
  Family,
  FamilyInsert,
  FamilyMember,
  FamilyMemberInsert,
  FamilyMemberUpdate,
  EnvelopeSharingRecord,
  EnvelopeSharingInsert,
  SyncLogEntry,
  SyncLogInsert,
  Contact,
  ContactInsert,
  ContactUpdate,
  ExpenseSplit,
  ExpenseSplitInsert,
  SplitParticipant,
  SplitParticipantInsert,
  Settlement,
  SettlementInsert,
} from './types';

// Database operations
export {
  ALL_TABLES,
  BUDGET_TABLE_NAMES,
  CREATE_ENVELOPES,
  CREATE_ACCOUNTS,
  CREATE_TRANSACTIONS,
  CREATE_GOALS,
  CREATE_SETTINGS,
  CREATE_SUBSCRIPTIONS,
  CREATE_BANK_CONNECTIONS,
  CREATE_BANK_ACCOUNTS,
  CREATE_BANK_TRANSACTIONS_RAW,
  CREATE_BANK_SYNC_STATE,
  CREATE_BANK_WEBHOOK_EVENTS,
  CORE_TABLES,
  BANK_SYNC_TABLES,
  SUBSCRIPTION_TABLES,
  SUBSCRIPTION_INDEXES,
  CORE_INDEXES,
  BANK_SYNC_INDEXES,
  CREATE_INDEXES,
  SEED_SETTINGS,
  SEED_DEFAULT_ACCOUNTS,
  SEED_DEFAULT_ENVELOPES,
  // V4 schema
  V4_ALL_TABLES,
  V4_INDEXES,
  V4_ALTER_STATEMENTS,
  V4_BUDGET_ENGINE_TABLES,
  V4_RULES_GOALS_TABLES,
  V4_REPORTING_TABLES,
  CREATE_CATEGORY_GROUPS,
  CREATE_BUDGET_ALLOCATIONS,
  CREATE_TRANSACTION_SPLITS,
  CREATE_RECURRING_TEMPLATES,
  CREATE_PAYEE_CACHE,
  CREATE_CSV_PROFILES,
  CREATE_PRICE_HISTORY,
  CREATE_NOTIFICATION_LOG,
  CREATE_TRANSACTION_RULES,
  CREATE_NET_WORTH_SNAPSHOTS,
  CREATE_DEBT_PAYOFF_PLANS,
  CREATE_DEBT_PAYOFF_DEBTS,
  CREATE_BUDGET_ROLLOVERS,
  CREATE_BUDGET_ALERTS,
  CREATE_ALERT_HISTORY,
  CREATE_CURRENCIES,
  CREATE_EXCHANGE_RATES,
  CREATE_SHARED_ENVELOPES,
  // V1-V3 CRUD
  createEnvelope,
  getEnvelope,
  getEnvelopes,
  listEnvelopes,
  updateEnvelope,
  deleteEnvelope,
  createAccount,
  getAccount,
  getAccounts,
  listAccounts,
  updateAccount,
  deleteAccount,
  createTransaction,
  getTransaction,
  getTransactions,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  createGoal,
  getGoalById,
  getGoals,
  updateGoal,
  deleteGoal,
  getSetting,
  setSetting,
  createSubscription,
  getSubscriptionById,
  getSubscriptions,
  updateSubscription,
  deleteSubscription,
  pauseSubscription,
  cancelSubscription,
  resumeSubscription,
  // V4 — Category Groups
  createCategoryGroup,
  getCategoryGroupById,
  getCategoryGroups,
  updateCategoryGroup,
  deleteCategoryGroup,
  getEnvelopesByGroup,
  setEnvelopeGroup,
  // V4 — Transaction Splits & Budget Helpers
  createTransactionSplits,
  getSplitsByTransaction,
  replaceSplits,
  deleteSplitsByTransaction,
  getActivityByEnvelope,
  getTotalIncome,
  // V4 — Recurring Templates
  createRecurringTemplate,
  getRecurringTemplateById,
  getRecurringTemplateBySubscriptionId,
  getActiveTemplates,
  updateRecurringTemplate,
  getDueTemplates,
  // V4 — Transaction Rules
  createTransactionRule,
  getTransactionRuleById,
  getTransactionRules,
  getEnabledTransactionRules,
  updateTransactionRule,
  deleteTransactionRule,
  // V4 — Payee Cache
  updatePayeeCache,
  getPayeeSuggestions,
  getEnvelopeSuggestion,
  // V4 — Transfers
  createTransfer,
  getTransferPair,
  // V4 — Net Worth Snapshots
  createNetWorthSnapshot,
  getNetWorthSnapshotById,
  getNetWorthSnapshotByMonth,
  getNetWorthSnapshots,
  updateNetWorthSnapshot,
  deleteNetWorthSnapshot,
  // V4 — Debt Payoff
  createDebtPayoffPlan,
  getDebtPayoffPlanById,
  getDebtPayoffPlans,
  getActiveDebtPayoffPlans,
  updateDebtPayoffPlan,
  deleteDebtPayoffPlan,
  createDebtPayoffDebt,
  getDebtPayoffDebtById,
  getDebtsByPlan,
  updateDebtPayoffDebt,
  deleteDebtPayoffDebt,
  // V4 — Budget Rollovers
  createRollover,
  getRolloverById,
  getRollovers,
  getRolloversByMonth,
  getRolloversByEnvelope,
  deleteRollover,
  deleteRolloversByMonth,
  // V4 — Budget Alerts
  createBudgetAlert,
  getBudgetAlertById,
  getBudgetAlerts,
  getAlertsByEnvelope,
  updateBudgetAlert,
  deleteBudgetAlert,
  createAlertHistory,
  getAlertHistoryByAlert,
  getAlertHistoryByMonth,
  deleteAlertHistory,
  // V4 — Currencies & Exchange Rates
  createCurrency,
  getCurrency,
  getCurrencies,
  getBaseCurrency,
  deleteCurrency,
  upsertExchangeRate,
  getExchangeRate,
  getExchangeRates,
  deleteExchangeRate,
  // V6 — Receipts (OCR)
  createReceipt,
  getReceiptById,
  getReceiptsByTransaction,
  getReceiptsByStatus,
  updateReceipt,
  deleteReceipt,
  // V6 — Exchange Rate History
  createExchangeRateHistory,
  getHistoricalRate,
  getHistoricalRates,
  // V6 — Categorization Feedback
  createCategorizationFeedback,
  getFeedbackByMerchant,
  getCategorizationAccuracy,
  // V6 — Loans & Loan Payments
  createLoan,
  getLoanById,
  getActiveLoans,
  updateLoan,
  deleteLoan,
  createLoanPayment,
  getLoanPaymentById,
  getLoanPayments,
  deleteLoanPayment,
  // V6 — Holdings & Snapshots
  createHolding,
  getHoldingById,
  getHoldingsByAccount,
  getActiveHoldings,
  updateHolding,
  deleteHolding,
  createHoldingSnapshot,
  getHoldingSnapshots,
  // V6 — Family Sharing
  createFamily,
  getFamilyById,
  getFamilyByInviteCode,
  createFamilyMember,
  getFamilyMembers,
  updateFamilyMember,
  removeFamilyMember,
  setEnvelopeSharingMode,
  getEnvelopeSharingModes,
  createSyncLogEntry,
  getSyncLogSince,
  // V6 — Expense Splitting
  createContact,
  getContactById,
  getContacts,
  updateContact,
  deleteContact,
  createExpenseSplit,
  getExpenseSplitById,
  getExpenseSplits,
  createSplitParticipant,
  getSplitParticipants,
  createSettlement,
  getSettlementsByContact,
} from './db';

export {
  buildBudgetExportBundle,
  serializeBudgetExportJson,
  exportBudgetTransactionsCsv,
  resetBudgetData,
} from './portability';
export {
  BUDGET_HELP_CONTENT,
} from './data/help-content';
export type {
  BudgetHelpCategory,
  BudgetFaqEntry,
  BudgetTutorialEntry,
  BudgetChangelogEntry,
  BudgetHelpContent,
} from './data/help-content';

export type {
  TransactionWithSplits,
  NetWorthSnapshotInsert,
  NetWorthSnapshotUpdate,
  BudgetRolloverInsert,
  AlertHistoryInsert,
  CurrencyInsert,
  ExchangeRateInsert,
} from './db';

// V5 — DB operations
export {
  // Age of Money snapshots
  createAoMSnapshot,
  getAoMSnapshotById,
  getAoMSnapshotByDate,
  getRecentAoMSnapshots,
  getAoMSnapshotRange,
  deleteAoMSnapshot,
  // Net worth milestones
  createMilestone,
  getMilestoneById,
  getMilestones,
  getUndismissedMilestones,
  dismissMilestone,
  milestoneExists,
  deleteMilestone,
  // Cancellation actions
  createCancellationAction,
  getCancellationActionById,
  getCancellationActionsBySubscription,
  getCancellationActionsByYear,
  getAllCancellationActions,
  deleteCancellationAction,
  // V5 schema
  V5_ALL_TABLES,
  V5_INDEXES,
  V5_EXTEND_ACCOUNT_TYPES,
  CREATE_AGE_OF_MONEY_SNAPSHOTS,
  CREATE_NET_WORTH_MILESTONES,
  CREATE_CANCELLATION_ACTIONS,
  // V6 schema
  V6_ALL_TABLES,
  V6_INDEXES,
  V6_ALTER_STATEMENTS,
  V6_RECEIPT_TABLES,
  V6_CURRENCY_TABLES,
  V6_CATEGORIZATION_TABLES,
  V6_LOAN_TABLES,
  V6_INVESTMENT_TABLES,
  V6_FAMILY_TABLES,
  V6_SPLITTING_TABLES,
  CREATE_RECEIPTS,
  CREATE_EXCHANGE_RATE_HISTORY,
  CREATE_CATEGORIZATION_FEEDBACK,
  CREATE_LOANS,
  CREATE_LOAN_PAYMENTS,
  CREATE_HOLDINGS,
  CREATE_HOLDING_SNAPSHOTS,
  CREATE_FAMILIES,
  CREATE_FAMILY_MEMBERS,
  CREATE_ENVELOPE_SHARING,
  CREATE_SYNC_LOG,
  CREATE_CONTACTS,
  CREATE_EXPENSE_SPLITS,
  CREATE_SPLIT_PARTICIPANTS,
  CREATE_SETTLEMENTS,
} from './db';

// Subscription catalog
export {
  SUBSCRIPTION_CATALOG,
  searchCatalog,
  getPopularEntries,
  normalizeToMonthly,
  normalizeToAnnual,
  calculateNextRenewal,
} from './db/subscription-catalog';

// Subscription engine
export {
  advanceRenewalDate,
  getUpcomingRenewals,
  normalizeToDaily,
  calculateSubscriptionSummary,
  validateTransition,
  getValidTransitions,
  getRenewalNotifications,
  getTrialExpirationAlerts,
  getMonthlySummaryNotification,
  logNotification,
  cancelNotifications,
  getNotificationLog,
  recordPriceChange,
  getPriceHistory,
  getLifetimeCost,
  mapBillingCycleToFrequency,
  createSubscriptionTemplate,
  syncSubscriptionToTemplate,
  processRenewal,
  deactivateSubscriptionTemplate,
  reactivateSubscriptionTemplate,
} from './subscriptions';
export type {
  EnvelopeCostSummary,
  SubscriptionCostSummary,
  PendingNotification,
} from './subscriptions';

// Budget engine
export {
  // Core budget calculation
  calculateMonthBudget,
  getCarryForward,
  getTotalOverspent,
  moveMoneyBetweenCategories,
  // Allocation operations (DB-backed)
  allocateToEnvelope,
  moveAllocation,
  getAllocationsForMonth,
  getAllocationMap,
  // Schedule calculator
  calculateNextDate,
  generateOccurrences,
  // Transaction rules
  evaluateCondition,
  evaluateConditions,
  matchRule,
  applyRules,
  // Income estimator
  detectIncomeStreams,
  classifyIncomePattern,
  estimateMonthlyIncome,
  // Payday detector
  detectPaydays,
  predictNextPayday,
  getPaydaySchedule,
  // Net cash
  calculateNetCash,
  calculateCashFlowByPeriod,
  calculateRunningBalance,
  // Goal tracking
  calculateGoalProgress,
  suggestMonthlyContribution,
  isGoalOnTrack,
  getGoalStatus,
  calculateGoalProjection,
  // Reporting
  getSpendingByCategory,
  getMonthlySpendingTrend,
  getBudgetedVsSpent,
  getTopPayees,
  // Net worth
  calculateNetWorth,
  buildNetWorthTimeline,
  captureSnapshot,
  // Debt payoff
  calculateSnowball,
  calculateAvalanche,
  generateAmortizationSchedule,
  projectPayoffDate,
  // Rollover
  calculateRollover,
  processMonthRollover,
  applyRollovers,
  // Upcoming
  getUpcomingTransactions,
  groupByDate,
  getUpcomingTotal,
  // Alerts
  checkAlerts,
  shouldFireAlert,
  buildAlertNotification,
  // Multi-currency
  RATE_PRECISION,
  convertAmount,
  formatCurrencyAmount,
  convertToBase,
  // V5 — Age of Money
  calculateAgeOfMoney,
  buildFifoQueue,
  getAoMStatus,
  calculateAoMTrend,
  // V5 — Report helpers
  getDateRangePreset,
  bucketizeCategories,
  assignChartColors,
  calculateSavingsRate,
  formatCentsAsDollars,
  CHART_COLORS,
  // V5 — Milestones
  detectMilestones,
  ROUND_NUMBER_THRESHOLDS,
  // V6 — Receipt OCR parser
  parseReceiptText,
  calculateConfidence,
  normalizeReceiptMerchant,
  isReceiptPaymentLine,
  redactReceiptPaymentLines,
  // V6 — ML auto-categorization
  predictCategory,
  calculateCategorizerAccuracy,
  normalizeCategorizerMerchant,
  // V6 — Loan planner
  calculateMonthlyPayment,
  generateLoanAmortization,
  getLoanSummary,
  compareScenarios,
  splitLoanPayment,
  calculateTotalInterest,
  // V6 — Investment tracker
  calculateHoldingValue,
  calculateHoldingGainLoss,
  calculatePortfolioSummary,
  calculateAllocation,
  buildPerformanceTimeline,
  // V6 — Family sharing
  generateInviteCode,
  isInviteExpired,
  resolveConflict,
  buildSyncPayload,
  orderPayloadsForApplication,
  canWriteToEnvelope,
  canViewEnvelope,
  MAX_FAMILY_SIZE,
  // V6 — Expense splitting
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  validateSplitAmounts,
  validatePercentages,
  calculateBalances,
} from './engine';

// V5 — Subscription cancellation assist
export {
  scoreSubscription,
  getOpportunities,
  calculateTotalSavings,
  calculatePotentialSavings,
  shouldShowOpportunity,
} from './subscriptions';
export type {
  CancellationOpportunity,
  CancellationActionData,
  CancellationActionRecord,
  ScoreInput,
} from './subscriptions';

// Subscription ROI scoring
export {
  classifyUsage,
  scoreSubscriptionROI,
  getROIReport,
} from './subscriptions';
export type {
  UsageStatus,
  SubscriptionROI,
  ROIInput,
} from './subscriptions';

// Spending pulse (hero metric)
export { calculateSpendingPulse } from './engine';
export type { SpendingPulse, SpendingPulseInput } from './engine';

// No Spend Day streak
export {
  getNoSpendStreak,
  getNoSpendDaysInMonth,
  calculateNoSpendStats,
} from './engine';
export type { NoSpendStreakResult } from './engine';

// Spending heatmap
export { getSpendingHeatmap } from './engine';
export type { HeatmapDay, HeatmapMonth, DailySpendingEntry } from './engine';

// Weekly digest
export { generateWeeklyDigest } from './engine';
export type {
  WeeklyDigest,
  WeeklyDigestInput,
  DigestTransaction,
  CategoryDigestEntry,
  BiggestPurchase,
} from './engine';

// Cross-module insight engine
export {
  checkSubscriptionUsage,
  checkSpendingHabitCorrelation,
  checkDiningVsGroceryRatio,
  projectGoalCompletion,
  generateInsights,
} from './insights';
export type {
  Insight,
  InsightCategory,
  SubscriptionActivityInput,
  SpendingHabitInput,
  SpendingHealthInput,
  SavingsProjectionInput,
} from './insights';

export type {
  // Budget types
  CategoryBudgetState,
  GroupBudgetState,
  MonthBudgetState,
  MonthBudgetInput,
  // Schedule
  ScheduleFrequency,
  // Transaction rules
  RuleCondition,
  RuleAction,
  EngineTransactionRule,
  RuleTransactionInput,
  RuleMatch,
  ApplyRulesResult,
  ConditionField,
  ConditionOperator,
  ActionType,
  // Income estimator
  IncomeFrequency,
  IncomePattern,
  IncomeStream,
  IncomeEstimate,
  // Payday detector
  PaydayFrequency,
  PaydayPattern,
  PaydayPrediction,
  // Net cash
  NetCashResult,
  CashFlowPeriod,
  CashFlowPeriodType,
  RunningBalanceEntry,
  // Goals
  GoalInput,
  GoalProgress,
  GoalStatus,
  GoalProjection,
  // Reporting
  ReportCategorySpending,
  MonthlySpendingPoint,
  BudgetVsSpentRow,
  TopPayee,
  DateRange,
  // Net worth
  NetWorthAccountInput,
  NetWorthResult,
  NetWorthEngineSnapshot,
  NetWorthTimelinePoint,
  SnapshotInput,
  // Debt payoff
  DebtInput,
  EnginePayoffStrategy,
  PayoffScheduleEntry,
  DebtPayoffResult,
  AmortizationEntry,
  // Rollover
  RolloverRecord,
  RolloverInput,
  // Upcoming
  UpcomingTemplate,
  UpcomingTransaction,
  GroupedUpcoming,
  // Alerts
  AlertConfig,
  EngineAlertHistoryEntry,
  EnvelopeSpendState,
  AlertNotification,
  // Multi-currency
  CurrencyExchangeRate,
  CurrencyInfo,
  // V5 — Age of Money
  AoMTransaction,
  FifoEntry,
  AoMResult,
  AoMSnapshotData,
  // V5 — Report helpers
  DateRangePreset,
  DateRangeName,
  BucketizedCategory,
  // V5 — Milestones
  EngineMilestoneType,
  DetectedMilestone,
  MilestoneRecord,
  // V6 — Receipt parser
  LineItem,
  ParsedReceipt,
  ReceiptTextRedaction,
  RedactedReceiptText,
  // V6 — Categorizer
  CategorizationInput,
  CategorizationPrediction,
  FeedbackRecord,
  AccuracyResult,
  // V6 — Loan planner
  LoanInput,
  LoanAmortizationEntry,
  LoanSummary,
  ScenarioComparison,
  PaymentSplit,
  // V6 — Investment tracker
  HoldingInput,
  PortfolioSummary,
  HoldingGainLoss,
  AllocationEntry,
  PerformancePoint,
  // V6 — Family sharing
  SyncPayload,
  ConflictResult,
  EngineSharingMode,
  MemberRole,
  // V6 — Expense splitting
  EngineSplitParticipant,
  SplitResult,
  BalanceEntry,
  BalanceSummary,
} from './engine';
