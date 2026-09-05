export {
  // V1-V3
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
  // V4
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
} from './schema';

export {
  // Envelopes
  createEnvelope,
  getEnvelopeById,
  getEnvelope,
  getEnvelopes,
  listEnvelopes,
  updateEnvelope,
  deleteEnvelope,
  countEnvelopes,
  // Accounts
  createAccount,
  getAccountById,
  getAccount,
  getAccounts,
  listAccounts,
  updateAccount,
  deleteAccount,
  // Transactions
  createTransaction,
  getTransactionById,
  getTransaction,
  getTransactions,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  countTransactions,
  // Goals
  createGoal,
  getGoalById,
  getGoals,
  updateGoal,
  deleteGoal,
  // Settings
  getSetting,
  setSetting,
  // Subscriptions
  createSubscription,
  getSubscriptionById,
  getSubscriptions,
  updateSubscription,
  deleteSubscription,
  pauseSubscription,
  cancelSubscription,
  resumeSubscription,
} from './crud';

// V4 — Category Groups
export {
  createCategoryGroup,
  getCategoryGroupById,
  getCategoryGroups,
  updateCategoryGroup,
  deleteCategoryGroup,
  getEnvelopesByGroup,
  setEnvelopeGroup,
} from './categories';

// V4 — Transaction Splits & Budget Helpers
export {
  createTransactionSplits,
  getSplitsByTransaction,
  replaceSplits,
  deleteSplitsByTransaction,
  getActivityByEnvelope,
  getTotalIncome,
} from './transactions-v4';
export type { TransactionWithSplits } from './transactions-v4';

// V4 — Recurring Templates
export {
  createRecurringTemplate,
  getRecurringTemplateById,
  getRecurringTemplateBySubscriptionId,
  getActiveTemplates,
  updateRecurringTemplate,
  getDueTemplates,
} from './recurring';

// V4 — Transaction Rules
export {
  createTransactionRule,
  getTransactionRuleById,
  getTransactionRules,
  getEnabledTransactionRules,
  updateTransactionRule,
  deleteTransactionRule,
} from './transaction-rules';

// V4 — Payee Cache
export {
  updatePayeeCache,
  getPayeeSuggestions,
  getEnvelopeSuggestion,
} from './payee-cache';

// V4 — Transfers
export {
  createTransfer,
  getTransferPair,
} from './transfers';

// V4 — Net Worth Snapshots
export {
  createNetWorthSnapshot,
  getNetWorthSnapshotById,
  getNetWorthSnapshotByMonth,
  getNetWorthSnapshots,
  updateNetWorthSnapshot,
  deleteNetWorthSnapshot,
} from './net-worth';
export type {
  NetWorthSnapshotInsert,
  NetWorthSnapshotUpdate,
} from './net-worth';

// V4 — Debt Payoff
export {
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
} from './debt-payoff';

// V4 — Budget Rollovers
export {
  createRollover,
  getRolloverById,
  getRollovers,
  getRolloversByMonth,
  getRolloversByEnvelope,
  deleteRollover,
  deleteRolloversByMonth,
} from './rollovers';
export type { BudgetRolloverInsert } from './rollovers';

// V4 — Budget Alerts
export {
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
} from './alerts';
export type { AlertHistoryInsert } from './alerts';

// V4 — Currencies & Exchange Rates
export {
  createCurrency,
  getCurrency,
  getCurrencies,
  getBaseCurrency,
  deleteCurrency,
  upsertExchangeRate,
  getExchangeRate,
  getExchangeRates,
  deleteExchangeRate,
} from './currency';
export type { CurrencyInsert, ExchangeRateInsert } from './currency';

// V5 — Age of Money Snapshots
export {
  createAoMSnapshot,
  getAoMSnapshotById,
  getAoMSnapshotByDate,
  getRecentAoMSnapshots,
  getAoMSnapshotRange,
  deleteAoMSnapshot,
} from './age-of-money';

// V5 — Net Worth Milestones
export {
  createMilestone,
  getMilestoneById,
  getMilestones,
  getUndismissedMilestones,
  dismissMilestone,
  milestoneExists,
  deleteMilestone,
} from './milestones';

// V5 — Cancellation Actions
export {
  createCancellationAction,
  getCancellationActionById,
  getCancellationActionsBySubscription,
  getCancellationActionsByYear,
  getAllCancellationActions,
  deleteCancellationAction,
} from './cancellation-actions';

// V5 schema exports
export {
  V5_ALL_TABLES,
  V5_INDEXES,
  V5_EXTEND_ACCOUNT_TYPES,
  CREATE_AGE_OF_MONEY_SNAPSHOTS,
  CREATE_NET_WORTH_MILESTONES,
  CREATE_CANCELLATION_ACTIONS,
} from './schema';

// V6 — Receipts (OCR)
export {
  createReceipt,
  getReceiptById,
  getReceiptsByTransaction,
  getReceiptsByStatus,
  updateReceipt,
  deleteReceipt,
} from './receipts';

// V6 — Exchange Rate History
export {
  createExchangeRateHistory,
  getHistoricalRate,
  getHistoricalRates,
} from './exchange-rate-history';

// V6 — Categorization Feedback
export {
  createCategorizationFeedback,
  getFeedbackByMerchant,
  getCategorizationAccuracy,
} from './categorization';

// V6 — Loans & Loan Payments
export {
  createLoan,
  getLoanById,
  getActiveLoans,
  updateLoan,
  deleteLoan,
  createLoanPayment,
  getLoanPaymentById,
  getLoanPayments,
  deleteLoanPayment,
} from './loans';

// V6 — Holdings & Snapshots
export {
  createHolding,
  getHoldingById,
  getHoldingsByAccount,
  getActiveHoldings,
  updateHolding,
  deleteHolding,
  createHoldingSnapshot,
  getHoldingSnapshots,
} from './holdings';

// V6 — Family Sharing
export {
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
} from './families';

// V6 — Expense Splitting
export {
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
} from './splitting';

// V6 schema exports
export {
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
} from './schema';
