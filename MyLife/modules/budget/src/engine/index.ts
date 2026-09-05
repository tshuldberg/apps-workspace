// Budget calculation engine — YNAB-style allocation, carry-forward, overspend

export {
  calculateMonthBudget,
  getCarryForward,
  getTotalOverspent,
  moveMoneyBetweenCategories,
} from './budget';
export type {
  CategoryBudgetState,
  GroupBudgetState,
  MonthBudgetState,
  MonthBudgetInput,
} from './budget';

export {
  allocateToEnvelope,
  moveAllocation,
  getAllocationsForMonth,
  getAllocationMap,
} from './allocations';

export {
  calculateNextDate,
  generateOccurrences,
} from './schedule';
export type { Frequency as ScheduleFrequency } from './schedule';

// Transaction rules engine
export {
  evaluateCondition,
  evaluateConditions,
  matchRule,
  applyRules,
} from './transaction-rules';
export type {
  RuleCondition,
  RuleAction,
  TransactionRule as EngineTransactionRule,
  TransactionInput as RuleTransactionInput,
  RuleMatch,
  ApplyRulesResult,
  ConditionField,
  ConditionOperator,
  ActionType,
} from './transaction-rules';

// Income estimator
export {
  detectIncomeStreams,
  classifyIncomePattern,
  estimateMonthlyIncome,
} from './income-estimator';
export type {
  IncomeFrequency,
  IncomePattern,
  IncomeStream,
  IncomeEstimate,
} from './income-estimator';

// Payday detector
export {
  detectPaydays,
  predictNextPayday,
  getPaydaySchedule,
} from './payday-detector';
export type {
  PaydayFrequency,
  PaydayPattern,
  PaydayPrediction,
} from './payday-detector';

// Net cash calculator
export {
  calculateNetCash,
  calculateCashFlowByPeriod,
  calculateRunningBalance,
} from './net-cash';
export type {
  NetCashResult,
  CashFlowPeriod,
  CashFlowPeriodType,
  RunningBalanceEntry,
} from './net-cash';

// Goal tracking
export {
  calculateGoalProgress,
  suggestMonthlyContribution,
  isGoalOnTrack,
  getGoalStatus,
  calculateGoalProjection,
} from './goals';
export type {
  Goal as GoalInput,
  GoalProgress,
  GoalStatus,
  GoalProjection,
} from './goals';

// Reporting engine
export {
  getSpendingByCategory,
  getMonthlySpendingTrend,
  getBudgetedVsSpent,
  getTopPayees,
} from './reporting';
export type {
  CategorySpending as ReportCategorySpending,
  MonthlySpendingPoint,
  BudgetVsSpentRow,
  TopPayee,
  DateRange,
} from './reporting';

// Net worth engine
export {
  calculateNetWorth,
  buildNetWorthTimeline,
  captureSnapshot,
} from './net-worth';
export type {
  AccountInput as NetWorthAccountInput,
  NetWorthResult,
  NetWorthSnapshot as NetWorthEngineSnapshot,
  NetWorthTimelinePoint,
  SnapshotInput,
} from './net-worth';

// Debt payoff engine
export {
  calculateSnowball,
  calculateAvalanche,
  generateAmortizationSchedule,
  projectPayoffDate,
} from './debt-payoff';
export type {
  DebtInput,
  PayoffStrategy as EnginePayoffStrategy,
  PayoffScheduleEntry,
  DebtPayoffResult,
  AmortizationEntry,
} from './debt-payoff';

// Rollover engine
export {
  calculateRollover,
  processMonthRollover,
  applyRollovers,
} from './rollover';
export type {
  RolloverRecord,
  RolloverInput,
} from './rollover';

// Upcoming transactions engine
export {
  getUpcomingTransactions,
  groupByDate,
  getUpcomingTotal,
} from './upcoming';
export type {
  RecurringTemplate as UpcomingTemplate,
  UpcomingTransaction,
  GroupedUpcoming,
} from './upcoming';

// Budget alerts engine
export {
  checkAlerts,
  shouldFireAlert,
  buildAlertNotification,
} from './alerts';
export type {
  AlertConfig,
  AlertHistoryEntry as EngineAlertHistoryEntry,
  EnvelopeSpendState,
  AlertNotification,
} from './alerts';

// Multi-currency engine
export {
  RATE_PRECISION,
  convertAmount,
  formatCurrencyAmount,
  convertToBase,
} from './multi-currency';
export type {
  ExchangeRate as CurrencyExchangeRate,
  CurrencyInfo,
} from './multi-currency';

// Age of Money engine
export {
  calculateAgeOfMoney,
  buildFifoQueue,
  getAoMStatus,
  calculateAoMTrend,
} from './age-of-money';
export type {
  AoMTransaction,
  FifoEntry,
  AoMResult,
  AoMSnapshotData,
} from './age-of-money';

// Report helpers
export {
  getDateRangePreset,
  bucketizeCategories,
  assignChartColors,
  calculateSavingsRate,
  formatCentsAsDollars,
  CHART_COLORS,
} from './report-helpers';
export type {
  DateRangePreset,
  DateRangeName,
  BucketizedCategory,
} from './report-helpers';

// Net worth milestones engine
export {
  detectMilestones,
  ROUND_NUMBER_THRESHOLDS,
} from './milestones';
export type {
  MilestoneType as EngineMilestoneType,
  DetectedMilestone,
  MilestoneRecord,
} from './milestones';

// V6 — Receipt OCR parser
export {
  parseReceiptText,
  calculateConfidence,
  normalizeMerchant as normalizeReceiptMerchant,
  isReceiptPaymentLine,
  redactReceiptPaymentLines,
} from './receipt-parser';
export type {
  LineItem,
  ParsedReceipt,
  ReceiptTextRedaction,
  RedactedReceiptText,
} from './receipt-parser';

// V6 — ML auto-categorization
export {
  predictCategory,
  calculateAccuracy as calculateCategorizerAccuracy,
  normalizeMerchant as normalizeCategorizerMerchant,
} from './categorizer';
export type {
  CategorizationInput,
  Prediction as CategorizationPrediction,
  FeedbackRecord,
  AccuracyResult,
} from './categorizer';

// V6 — Loan planner
export {
  calculateMonthlyPayment,
  generateLoanAmortization,
  getLoanSummary,
  compareScenarios,
  splitPayment as splitLoanPayment,
  calculateTotalInterest,
} from './loan-planner';
export type {
  LoanInput,
  AmortizationEntry as LoanAmortizationEntry,
  LoanSummary,
  ScenarioComparison,
  PaymentSplit,
} from './loan-planner';

// V6 — Investment tracker
export {
  calculateHoldingValue,
  calculateHoldingGainLoss,
  calculatePortfolioSummary,
  calculateAllocation,
  buildPerformanceTimeline,
} from './investment-tracker';
export type {
  HoldingInput,
  PortfolioSummary,
  HoldingGainLoss,
  AllocationEntry,
  PerformancePoint,
} from './investment-tracker';

// V6 — Family sharing
export {
  generateInviteCode,
  isInviteExpired,
  resolveConflict,
  buildSyncPayload,
  orderPayloadsForApplication,
  canWriteToEnvelope,
  canViewEnvelope,
  MAX_FAMILY_SIZE,
} from './family-sharing';
export type {
  SyncPayload,
  ConflictResult,
  SharingMode as EngineSharingMode,
  MemberRole,
} from './family-sharing';

// V6 — Expense splitting
export {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  validateSplitAmounts,
  validatePercentages,
  calculateBalances,
} from './expense-splitting';
export type {
  SplitParticipant as EngineSplitParticipant,
  SplitResult,
  BalanceEntry,
  BalanceSummary,
} from './expense-splitting';

// Spending pulse (hero metric)
export { calculateSpendingPulse } from './spending-pulse';
export type { SpendingPulse, SpendingPulseInput } from './spending-pulse';

// No Spend Day streak
export {
  getNoSpendStreak,
  getNoSpendDaysInMonth,
  calculateNoSpendStats,
} from './no-spend-streak';
export type { NoSpendStreakResult } from './no-spend-streak';

// Spending heatmap
export { getSpendingHeatmap } from './spending-heatmap';
export type {
  HeatmapDay,
  HeatmapMonth,
  DailySpendingEntry,
} from './spending-heatmap';

// Weekly digest
export { generateWeeklyDigest } from './weekly-digest';
export type {
  WeeklyDigest,
  WeeklyDigestInput,
  DigestTransaction,
  CategoryDigestEntry,
  BiggestPurchase,
} from './weekly-digest';
