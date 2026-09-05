import { z } from 'zod';

// --- Enums ---

export const AccountType = z.enum([
  'cash',
  'checking',
  'savings',
  'credit',
  'investment',
  'loan',
  'mortgage',
  'other',
]);
export type AccountType = z.infer<typeof AccountType>;

export const TransactionDirection = z.enum(['inflow', 'outflow', 'transfer']);
export type TransactionDirection = z.infer<typeof TransactionDirection>;

// --- Envelopes ---

export const EnvelopeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  monthly_budget: z.number().int().nonnegative(),
  rollover_enabled: z.number().int().min(0).max(1), // SQLite boolean
  archived: z.number().int().min(0).max(1), // SQLite boolean
  sort_order: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

export const EnvelopeInsertSchema = EnvelopeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  icon: true,
  color: true,
  monthly_budget: true,
  rollover_enabled: true,
  archived: true,
  sort_order: true,
});
export type EnvelopeInsert = z.infer<typeof EnvelopeInsertSchema>;

export const EnvelopeUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  monthly_budget: z.number().int().nonnegative().optional(),
  rollover_enabled: z.number().int().min(0).max(1).optional(),
  archived: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type EnvelopeUpdate = z.infer<typeof EnvelopeUpdateSchema>;

// --- Accounts ---

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  type: AccountType,
  current_balance: z.number().int(),
  currency: z.string().length(3).default('USD'),
  archived: z.number().int().min(0).max(1), // SQLite boolean
  sort_order: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountInsertSchema = AccountSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  type: true,
  current_balance: true,
  currency: true,
  archived: true,
  sort_order: true,
});
export type AccountInsert = z.infer<typeof AccountInsertSchema>;

export const AccountUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: AccountType.optional(),
  current_balance: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  archived: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;

// --- Transactions ---

export const BudgetTransactionSchema = z.object({
  id: z.string(),
  envelope_id: z.string().nullable(),
  account_id: z.string().nullable(),
  amount: z.number().int(), // cents
  direction: TransactionDirection,
  merchant: z.string().nullable(),
  note: z.string().nullable(),
  occurred_on: z.string(), // YYYY-MM-DD
  created_at: z.string(),
  updated_at: z.string(),
});
export type BudgetTransaction = z.infer<typeof BudgetTransactionSchema>;

export const BudgetTransactionInsertSchema = BudgetTransactionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  envelope_id: true,
  account_id: true,
  merchant: true,
  note: true,
});
export type BudgetTransactionInsert = z.infer<typeof BudgetTransactionInsertSchema>;

export const BudgetTransactionUpdateSchema = z.object({
  envelope_id: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
  amount: z.number().int().optional(),
  direction: TransactionDirection.optional(),
  merchant: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  occurred_on: z.string().optional(),
});
export type BudgetTransactionUpdate = z.infer<typeof BudgetTransactionUpdateSchema>;

export const BudgetTransactionFilterSchema = z.object({
  envelope_id: z.string().optional(),
  account_id: z.string().optional(),
  direction: TransactionDirection.optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type BudgetTransactionFilter = z.infer<typeof BudgetTransactionFilterSchema>;

// --- Goals ---

export const BudgetGoalSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  name: z.string().min(1).max(80),
  target_amount: z.number().int().nonnegative(),
  target_date: z.string().nullable(),
  completed_amount: z.number().int().nonnegative(),
  is_completed: z.number().int().min(0).max(1), // SQLite boolean
  created_at: z.string(),
  updated_at: z.string(),
});
export type BudgetGoal = z.infer<typeof BudgetGoalSchema>;

export const BudgetGoalInsertSchema = BudgetGoalSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  target_date: true,
  completed_amount: true,
  is_completed: true,
});
export type BudgetGoalInsert = z.infer<typeof BudgetGoalInsertSchema>;

export const BudgetGoalUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  target_amount: z.number().int().nonnegative().optional(),
  target_date: z.string().nullable().optional(),
  completed_amount: z.number().int().nonnegative().optional(),
  is_completed: z.number().int().min(0).max(1).optional(),
});
export type BudgetGoalUpdate = z.infer<typeof BudgetGoalUpdateSchema>;

// --- Settings ---

export const BudgetSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type BudgetSetting = z.infer<typeof BudgetSettingSchema>;

// --- Subscriptions ---

export const BillingCycle = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
]);
export type BillingCycle = z.infer<typeof BillingCycle>;

export const SubscriptionStatus = z.enum(['active', 'paused', 'cancelled', 'trial']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const BudgetSubscriptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  price: z.number().int(),
  currency: z.string().length(3),
  billing_cycle: BillingCycle,
  custom_days: z.number().int().positive().nullable(),
  status: SubscriptionStatus,
  start_date: z.string(),
  next_renewal: z.string(),
  trial_end_date: z.string().nullable(),
  cancelled_date: z.string().nullable(),
  notes: z.string().nullable(),
  url: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  notify_days: z.number().int().nonnegative(),
  envelope_id: z.string().nullable(),
  catalog_id: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BudgetSubscription = z.infer<typeof BudgetSubscriptionSchema>;

export const BudgetSubscriptionInsertSchema = BudgetSubscriptionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  currency: true,
  custom_days: true,
  trial_end_date: true,
  cancelled_date: true,
  notes: true,
  url: true,
  icon: true,
  color: true,
  notify_days: true,
  envelope_id: true,
  catalog_id: true,
  sort_order: true,
});
export type BudgetSubscriptionInsert = z.infer<typeof BudgetSubscriptionInsertSchema>;

export const BudgetSubscriptionUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  billing_cycle: BillingCycle.optional(),
  custom_days: z.number().int().positive().nullable().optional(),
  status: SubscriptionStatus.optional(),
  start_date: z.string().optional(),
  next_renewal: z.string().optional(),
  trial_end_date: z.string().nullable().optional(),
  cancelled_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  notify_days: z.number().int().nonnegative().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type BudgetSubscriptionUpdate = z.infer<typeof BudgetSubscriptionUpdateSchema>;

export const BudgetSubscriptionFilterSchema = z.object({
  status: SubscriptionStatus.optional(),
  billing_cycle: BillingCycle.optional(),
});
export type BudgetSubscriptionFilter = z.infer<typeof BudgetSubscriptionFilterSchema>;

// --- Catalog ---

export const CatalogCategorySchema = z.enum([
  'entertainment',
  'productivity',
  'health',
  'shopping',
  'news',
  'finance',
  'utilities',
  'other',
]);
export type CatalogCategory = z.infer<typeof CatalogCategorySchema>;

export interface CatalogEntry {
  id: string;
  name: string;
  defaultPrice: number;
  billingCycle: BillingCycle;
  category: CatalogCategory;
}

// =====================================================================
// V4 Types — YNAB-style budget engine, reporting, alerts, multi-currency
// =====================================================================

// --- Category Groups ---

export const CategoryGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  sort_order: z.number().int().nonnegative(),
  is_hidden: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CategoryGroup = z.infer<typeof CategoryGroupSchema>;

export const CategoryGroupInsertSchema = CategoryGroupSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  sort_order: true,
  is_hidden: true,
});
export type CategoryGroupInsert = z.infer<typeof CategoryGroupInsertSchema>;

export const CategoryGroupUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  sort_order: z.number().int().nonnegative().optional(),
  is_hidden: z.number().int().min(0).max(1).optional(),
});
export type CategoryGroupUpdate = z.infer<typeof CategoryGroupUpdateSchema>;

// --- Budget Allocations ---

export const BudgetAllocationSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  month: z.string(), // YYYY-MM
  allocated: z.number().int(),
});
export type BudgetAllocation = z.infer<typeof BudgetAllocationSchema>;

export const BudgetAllocationInsertSchema = BudgetAllocationSchema.omit({
  id: true,
});
export type BudgetAllocationInsert = z.infer<typeof BudgetAllocationInsertSchema>;

// --- Transaction Splits ---

export const TransactionSplitSchema = z.object({
  id: z.string(),
  transaction_id: z.string(),
  envelope_id: z.string().nullable(),
  amount: z.number().int(),
  memo: z.string().nullable(),
});
export type TransactionSplit = z.infer<typeof TransactionSplitSchema>;

export const TransactionSplitInsertSchema = TransactionSplitSchema.omit({
  id: true,
}).partial({
  envelope_id: true,
  memo: true,
});
export type TransactionSplitInsert = z.infer<typeof TransactionSplitInsertSchema>;

// --- Recurring Templates ---

export const RecurringFrequency = z.enum([
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
]);
export type RecurringFrequency = z.infer<typeof RecurringFrequency>;

export const RecurringTemplateSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  envelope_id: z.string().nullable(),
  payee: z.string().min(1),
  amount: z.number().int(),
  frequency: RecurringFrequency,
  start_date: z.string(),
  end_date: z.string().nullable(),
  next_date: z.string(),
  is_active: z.number().int().min(0).max(1),
  subscription_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecurringTemplate = z.infer<typeof RecurringTemplateSchema>;

export const RecurringTemplateInsertSchema = RecurringTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  envelope_id: true,
  end_date: true,
  is_active: true,
  subscription_id: true,
});
export type RecurringTemplateInsert = z.infer<typeof RecurringTemplateInsertSchema>;

export const RecurringTemplateUpdateSchema = z.object({
  envelope_id: z.string().nullable().optional(),
  payee: z.string().min(1).optional(),
  amount: z.number().int().optional(),
  frequency: RecurringFrequency.optional(),
  end_date: z.string().nullable().optional(),
  next_date: z.string().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});
export type RecurringTemplateUpdate = z.infer<typeof RecurringTemplateUpdateSchema>;

// --- Payee Cache ---

export const PayeeCacheSchema = z.object({
  payee: z.string(),
  last_envelope_id: z.string().nullable(),
  use_count: z.number().int().nonnegative(),
  last_used: z.string(),
});
export type PayeeCache = z.infer<typeof PayeeCacheSchema>;

// --- CSV Profiles ---

export const AmountSign = z.enum([
  'negative_is_outflow',
  'positive_is_outflow',
  'separate_columns',
]);
export type AmountSign = z.infer<typeof AmountSign>;

export const CsvProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  date_column: z.number().int().nonnegative(),
  payee_column: z.number().int().nonnegative(),
  amount_column: z.number().int().nonnegative(),
  memo_column: z.number().int().nonnegative().nullable(),
  date_format: z.string(),
  amount_sign: AmountSign,
  debit_column: z.number().int().nonnegative().nullable(),
  credit_column: z.number().int().nonnegative().nullable(),
  skip_rows: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type CsvProfile = z.infer<typeof CsvProfileSchema>;

export const CsvProfileInsertSchema = CsvProfileSchema.omit({
  id: true,
  created_at: true,
}).partial({
  memo_column: true,
  debit_column: true,
  credit_column: true,
  skip_rows: true,
});
export type CsvProfileInsert = z.infer<typeof CsvProfileInsertSchema>;

// --- Price History ---

export const PriceHistorySchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  price: z.number().int(),
  effective_date: z.string(),
  created_at: z.string(),
});
export type PriceHistory = z.infer<typeof PriceHistorySchema>;

// --- Notification Log ---

export const NotificationType = z.enum([
  'renewal',
  'trial_expiry',
  'monthly_summary',
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationLogSchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  type: NotificationType,
  scheduled_for: z.string(),
  sent_at: z.string().nullable(),
});
export type NotificationLog = z.infer<typeof NotificationLogSchema>;

// --- Transaction Rules ---

export const MatchType = z.enum(['contains', 'exact', 'starts_with']);
export type MatchType = z.infer<typeof MatchType>;

export const TransactionRuleSchema = z.object({
  id: z.string(),
  payee_pattern: z.string().min(1),
  match_type: MatchType,
  envelope_id: z.string(),
  is_enabled: z.number().int().min(0).max(1),
  priority: z.number().int(),
  created_at: z.string(),
});
export type TransactionRule = z.infer<typeof TransactionRuleSchema>;

export const TransactionRuleInsertSchema = TransactionRuleSchema.omit({
  id: true,
  created_at: true,
}).partial({
  is_enabled: true,
  priority: true,
});
export type TransactionRuleInsert = z.infer<typeof TransactionRuleInsertSchema>;

export const TransactionRuleUpdateSchema = z.object({
  payee_pattern: z.string().min(1).optional(),
  match_type: MatchType.optional(),
  envelope_id: z.string().optional(),
  is_enabled: z.number().int().min(0).max(1).optional(),
  priority: z.number().int().optional(),
});
export type TransactionRuleUpdate = z.infer<typeof TransactionRuleUpdateSchema>;

// --- Net Worth Snapshots ---

export const NetWorthSnapshotSchema = z.object({
  id: z.string(),
  month: z.string(), // YYYY-MM
  assets: z.number().int(),
  liabilities: z.number().int(),
  net_worth: z.number().int(),
  account_balances: z.string().nullable(), // JSON
  created_at: z.string(),
});
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>;

// --- Debt Payoff ---

export const PayoffStrategy = z.enum(['snowball', 'avalanche']);
export type PayoffStrategy = z.infer<typeof PayoffStrategy>;

export const DebtPayoffPlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  strategy: PayoffStrategy,
  extra_payment: z.number().int().nonnegative(),
  is_active: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DebtPayoffPlan = z.infer<typeof DebtPayoffPlanSchema>;

export const DebtPayoffPlanInsertSchema = DebtPayoffPlanSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  extra_payment: true,
  is_active: true,
});
export type DebtPayoffPlanInsert = z.infer<typeof DebtPayoffPlanInsertSchema>;

export const Compounding = z.enum(['monthly', 'daily']);
export type Compounding = z.infer<typeof Compounding>;

export const DebtPayoffDebtSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  account_id: z.string().nullable(),
  name: z.string().min(1),
  balance: z.number().int(),
  interest_rate: z.number().int().nonnegative(),
  minimum_payment: z.number().int().nonnegative(),
  compounding: Compounding,
  sort_order: z.number().int().nonnegative(),
});
export type DebtPayoffDebt = z.infer<typeof DebtPayoffDebtSchema>;

export const DebtPayoffDebtInsertSchema = DebtPayoffDebtSchema.omit({
  id: true,
}).partial({
  account_id: true,
  interest_rate: true,
  minimum_payment: true,
  compounding: true,
  sort_order: true,
});
export type DebtPayoffDebtInsert = z.infer<typeof DebtPayoffDebtInsertSchema>;

// --- Budget Rollovers ---

export const BudgetRolloverSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  from_month: z.string(),
  to_month: z.string(),
  amount: z.number().int(),
  created_at: z.string(),
});
export type BudgetRollover = z.infer<typeof BudgetRolloverSchema>;

// --- Budget Alerts ---

export const BudgetAlertSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  threshold_pct: z.number().int().min(1).max(200),
  is_enabled: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BudgetAlert = z.infer<typeof BudgetAlertSchema>;

export const BudgetAlertInsertSchema = BudgetAlertSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  threshold_pct: true,
  is_enabled: true,
});
export type BudgetAlertInsert = z.infer<typeof BudgetAlertInsertSchema>;

export const AlertHistorySchema = z.object({
  id: z.string(),
  alert_id: z.string(),
  envelope_id: z.string(),
  month: z.string(),
  threshold_pct: z.number().int(),
  spent_pct: z.number().int(),
  amount_spent: z.number().int(),
  target_amount: z.number().int(),
  notified_at: z.string(),
});
export type AlertHistory = z.infer<typeof AlertHistorySchema>;

// --- Multi-Currency ---

export const CurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1),
  symbol: z.string(),
  decimal_places: z.number().int().nonnegative(),
  is_base: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type Currency = z.infer<typeof CurrencySchema>;

export const ExchangeRateSchema = z.object({
  id: z.string(),
  from_currency: z.string().length(3),
  to_currency: z.string().length(3),
  rate: z.number().int(),
  rate_decimal: z.string(),
  fetched_at: z.string(),
});
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

// --- Shared Envelopes ---

export const SharingMode = z.enum(['joint', 'split']);
export type SharingMode = z.infer<typeof SharingMode>;

export const SharedEnvelopeSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  device_id: z.string(),
  partner_device_id: z.string().nullable(),
  sharing_mode: SharingMode,
  is_active: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SharedEnvelope = z.infer<typeof SharedEnvelopeSchema>;

// =====================================================================
// V5 Types -- Age of Money, Net Worth Milestones, Cancellation Actions
// =====================================================================

// --- Age of Money Snapshots ---

export const AoMSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  age_days: z.number().int().nonnegative(),
  sample_size: z.number().int().positive(),
  created_at: z.string(),
});
export type AoMSnapshot = z.infer<typeof AoMSnapshotSchema>;

export const AoMSnapshotInsertSchema = AoMSnapshotSchema.omit({
  id: true,
  created_at: true,
});
export type AoMSnapshotInsert = z.infer<typeof AoMSnapshotInsertSchema>;

// --- Net Worth Milestones ---

export const MilestoneType = z.enum([
  'first_positive',
  'round_number',
  'all_time_high',
  'debt_free',
  'custom',
]);
export type MilestoneType = z.infer<typeof MilestoneType>;

export const NetWorthMilestoneSchema = z.object({
  id: z.string(),
  milestone_type: MilestoneType,
  value: z.number().int(),
  achieved_at: z.string(),
  dismissed: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type NetWorthMilestone = z.infer<typeof NetWorthMilestoneSchema>;

export const NetWorthMilestoneInsertSchema = NetWorthMilestoneSchema.omit({
  id: true,
  created_at: true,
}).partial({
  dismissed: true,
});
export type NetWorthMilestoneInsert = z.infer<typeof NetWorthMilestoneInsertSchema>;

// --- Cancellation Actions ---

export const CancellationActionType = z.enum([
  'dismissed',
  'reminded',
  'cancelled',
  'downgraded',
  'kept',
]);
export type CancellationActionType = z.infer<typeof CancellationActionType>;

export const CancellationActionSchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  action: CancellationActionType,
  savings_amount: z.number().int().nullable(),
  notes: z.string().nullable(),
  acted_on: z.string(),
  created_at: z.string(),
});
export type CancellationAction = z.infer<typeof CancellationActionSchema>;

export const CancellationActionInsertSchema = CancellationActionSchema.omit({
  id: true,
  created_at: true,
}).partial({
  savings_amount: true,
  notes: true,
  acted_on: true,
});
export type CancellationActionInsert = z.infer<typeof CancellationActionInsertSchema>;

// =====================================================================
// V6 Types -- Receipt OCR, Multi-currency history, ML categorization,
//             Loan planner, Investment tracking, Family sharing,
//             Expense splitting
// =====================================================================

// --- Receipts (OCR) ---

export const ReceiptStatus = z.enum(['pending', 'parsed', 'reviewed', 'linked', 'failed']);
export type ReceiptStatus = z.infer<typeof ReceiptStatus>;

export const ReceiptSchema = z.object({
  id: z.string(),
  transaction_id: z.string().nullable(),
  image_uri: z.string(),
  thumbnail_uri: z.string().nullable(),
  merchant_raw: z.string().nullable(),
  total_raw: z.string().nullable(),
  date_raw: z.string().nullable(),
  currency_raw: z.string().nullable(),
  tax_amount: z.number().int().nullable(),
  subtotal: z.number().int().nullable(),
  line_items: z.string().nullable(), // JSON
  ocr_confidence: z.number().nullable(),
  ocr_provider: z.string(),
  raw_ocr_text: z.string().nullable(),
  status: ReceiptStatus,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const ReceiptInsertSchema = ReceiptSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  transaction_id: true,
  thumbnail_uri: true,
  merchant_raw: true,
  total_raw: true,
  date_raw: true,
  currency_raw: true,
  tax_amount: true,
  subtotal: true,
  line_items: true,
  ocr_confidence: true,
  ocr_provider: true,
  raw_ocr_text: true,
  status: true,
});
export type ReceiptInsert = z.infer<typeof ReceiptInsertSchema>;

export const ReceiptUpdateSchema = z.object({
  transaction_id: z.string().nullable().optional(),
  thumbnail_uri: z.string().nullable().optional(),
  merchant_raw: z.string().nullable().optional(),
  total_raw: z.string().nullable().optional(),
  date_raw: z.string().nullable().optional(),
  currency_raw: z.string().nullable().optional(),
  tax_amount: z.number().int().nullable().optional(),
  subtotal: z.number().int().nullable().optional(),
  line_items: z.string().nullable().optional(),
  ocr_confidence: z.number().nullable().optional(),
  raw_ocr_text: z.string().nullable().optional(),
  status: ReceiptStatus.optional(),
});
export type ReceiptUpdate = z.infer<typeof ReceiptUpdateSchema>;

// --- Exchange Rate History ---

export const ExchangeRateHistorySchema = z.object({
  id: z.string(),
  from_currency: z.string().length(3),
  to_currency: z.string().length(3),
  rate: z.number().int(),
  rate_decimal: z.string(),
  effective_date: z.string(), // YYYY-MM-DD
  source: z.string(),
  created_at: z.string(),
});
export type ExchangeRateHistory = z.infer<typeof ExchangeRateHistorySchema>;

export const ExchangeRateHistoryInsertSchema = ExchangeRateHistorySchema.omit({
  id: true,
  created_at: true,
}).partial({
  source: true,
});
export type ExchangeRateHistoryInsert = z.infer<typeof ExchangeRateHistoryInsertSchema>;

// --- Categorization Feedback (ML) ---

export const CategorizationFeedbackSchema = z.object({
  id: z.string(),
  transaction_id: z.string(),
  merchant_normalized: z.string(),
  predicted_envelope_id: z.string().nullable(),
  actual_envelope_id: z.string().nullable(),
  confidence: z.number(),
  was_accepted: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type CategorizationFeedback = z.infer<typeof CategorizationFeedbackSchema>;

export const CategorizationFeedbackInsertSchema = CategorizationFeedbackSchema.omit({
  id: true,
  created_at: true,
}).partial({
  predicted_envelope_id: true,
  actual_envelope_id: true,
});
export type CategorizationFeedbackInsert = z.infer<typeof CategorizationFeedbackInsertSchema>;

// --- Loans ---

export const LoanType = z.enum(['mortgage', 'auto', 'student', 'personal', 'heloc', 'business', 'other']);
export type LoanType = z.infer<typeof LoanType>;

export const LoanSchema = z.object({
  id: z.string(),
  account_id: z.string().nullable(),
  name: z.string().min(1),
  loan_type: LoanType,
  original_principal: z.number().int(),
  current_balance: z.number().int(),
  interest_rate: z.number().int(),
  term_months: z.number().int(),
  start_date: z.string(),
  monthly_payment: z.number().int(),
  extra_payment: z.number().int(),
  compounding: Compounding,
  lender: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const LoanInsertSchema = LoanSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  account_id: true,
  extra_payment: true,
  compounding: true,
  lender: true,
  notes: true,
  is_active: true,
});
export type LoanInsert = z.infer<typeof LoanInsertSchema>;

export const LoanUpdateSchema = z.object({
  account_id: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  loan_type: LoanType.optional(),
  current_balance: z.number().int().optional(),
  interest_rate: z.number().int().optional(),
  monthly_payment: z.number().int().optional(),
  extra_payment: z.number().int().optional(),
  compounding: Compounding.optional(),
  lender: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});
export type LoanUpdate = z.infer<typeof LoanUpdateSchema>;

// --- Loan Payments ---

export const LoanPaymentSchema = z.object({
  id: z.string(),
  loan_id: z.string(),
  transaction_id: z.string().nullable(),
  payment_date: z.string(),
  total_amount: z.number().int(),
  principal_amount: z.number().int(),
  interest_amount: z.number().int(),
  extra_amount: z.number().int(),
  remaining_balance: z.number().int(),
  created_at: z.string(),
});
export type LoanPayment = z.infer<typeof LoanPaymentSchema>;

export const LoanPaymentInsertSchema = LoanPaymentSchema.omit({
  id: true,
  created_at: true,
}).partial({
  transaction_id: true,
  extra_amount: true,
});
export type LoanPaymentInsert = z.infer<typeof LoanPaymentInsertSchema>;

// --- Holdings (Investment) ---

export const AssetClass = z.enum([
  'stock', 'bond', 'etf', 'mutual_fund', 'reit', 'crypto', 'commodity', 'cash_equivalent', 'other',
]);
export type AssetClass = z.infer<typeof AssetClass>;

export const HoldingSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  symbol: z.string(),
  name: z.string(),
  asset_class: AssetClass,
  shares: z.number(),
  cost_basis: z.number().int(),
  current_price: z.number().int().nullable(),
  current_value: z.number().int().nullable(),
  currency: z.string().length(3),
  last_price_update: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const HoldingInsertSchema = HoldingSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  asset_class: true,
  current_price: true,
  current_value: true,
  currency: true,
  last_price_update: true,
  notes: true,
  is_active: true,
});
export type HoldingInsert = z.infer<typeof HoldingInsertSchema>;

export const HoldingUpdateSchema = z.object({
  symbol: z.string().optional(),
  name: z.string().optional(),
  asset_class: AssetClass.optional(),
  shares: z.number().optional(),
  cost_basis: z.number().int().optional(),
  current_price: z.number().int().nullable().optional(),
  current_value: z.number().int().nullable().optional(),
  currency: z.string().length(3).optional(),
  last_price_update: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});
export type HoldingUpdate = z.infer<typeof HoldingUpdateSchema>;

// --- Holding Snapshots ---

export const HoldingSnapshotSchema = z.object({
  id: z.string(),
  holding_id: z.string(),
  date: z.string(), // YYYY-MM-DD
  shares: z.number(),
  price_per_share: z.number().int(),
  total_value: z.number().int(),
  created_at: z.string(),
});
export type HoldingSnapshot = z.infer<typeof HoldingSnapshotSchema>;

export const HoldingSnapshotInsertSchema = HoldingSnapshotSchema.omit({
  id: true,
  created_at: true,
});
export type HoldingSnapshotInsert = z.infer<typeof HoldingSnapshotInsertSchema>;

// --- Families ---

export const FamilySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_by_device_id: z.string(),
  invite_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Family = z.infer<typeof FamilySchema>;

export const FamilyInsertSchema = FamilySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  name: true,
});
export type FamilyInsert = z.infer<typeof FamilyInsertSchema>;

// --- Family Members ---

export const FamilyRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type FamilyRole = z.infer<typeof FamilyRole>;

export const FamilyMemberSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  device_id: z.string(),
  display_name: z.string(),
  avatar_emoji: z.string(),
  role: FamilyRole,
  joined_at: z.string(),
  last_sync_at: z.string().nullable(),
  is_active: z.number().int().min(0).max(1),
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const FamilyMemberInsertSchema = FamilyMemberSchema.omit({
  id: true,
  joined_at: true,
}).partial({
  avatar_emoji: true,
  role: true,
  last_sync_at: true,
  is_active: true,
});
export type FamilyMemberInsert = z.infer<typeof FamilyMemberInsertSchema>;

export const FamilyMemberUpdateSchema = z.object({
  display_name: z.string().optional(),
  avatar_emoji: z.string().optional(),
  role: FamilyRole.optional(),
  last_sync_at: z.string().nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});
export type FamilyMemberUpdate = z.infer<typeof FamilyMemberUpdateSchema>;

// --- Envelope Sharing ---

export const SharingModeV6 = z.enum(['shared', 'visible', 'private']);
export type SharingModeV6 = z.infer<typeof SharingModeV6>;

export const EnvelopeSharingSchema = z.object({
  id: z.string(),
  envelope_id: z.string(),
  family_id: z.string(),
  sharing_mode: SharingModeV6,
  created_at: z.string(),
});
export type EnvelopeSharingRecord = z.infer<typeof EnvelopeSharingSchema>;

export const EnvelopeSharingInsertSchema = EnvelopeSharingSchema.omit({
  id: true,
  created_at: true,
}).partial({
  sharing_mode: true,
});
export type EnvelopeSharingInsert = z.infer<typeof EnvelopeSharingInsertSchema>;

// --- Sync Log ---

export const SyncOperation = z.enum(['create', 'update', 'delete']);
export type SyncOperation = z.infer<typeof SyncOperation>;

export const SyncLogSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  device_id: z.string(),
  operation: SyncOperation,
  table_name: z.string(),
  record_id: z.string(),
  payload: z.string(), // JSON
  timestamp: z.string(),
  applied: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type SyncLogEntry = z.infer<typeof SyncLogSchema>;

export const SyncLogInsertSchema = SyncLogSchema.omit({
  id: true,
  created_at: true,
}).partial({
  applied: true,
});
export type SyncLogInsert = z.infer<typeof SyncLogInsertSchema>;

// --- Contacts (Expense Splitting) ---

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatar_emoji: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const ContactInsertSchema = ContactSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  email: true,
  phone: true,
  avatar_emoji: true,
  notes: true,
});
export type ContactInsert = z.infer<typeof ContactInsertSchema>;

export const ContactUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatar_emoji: z.string().optional(),
  notes: z.string().nullable().optional(),
});
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;

// --- Expense Splits ---

export const SplitType = z.enum(['equal', 'unequal', 'percentage', 'shares']);
export type SplitType = z.infer<typeof SplitType>;

export const ExpenseSplitSchema = z.object({
  id: z.string(),
  transaction_id: z.string().nullable(),
  description: z.string(),
  total_amount: z.number().int(),
  currency: z.string().length(3),
  split_type: SplitType,
  paid_by: z.string(),
  date: z.string(),
  group_name: z.string().nullable(),
  is_settled: z.number().int().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExpenseSplit = z.infer<typeof ExpenseSplitSchema>;

export const ExpenseSplitInsertSchema = ExpenseSplitSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  transaction_id: true,
  currency: true,
  split_type: true,
  paid_by: true,
  group_name: true,
  is_settled: true,
});
export type ExpenseSplitInsert = z.infer<typeof ExpenseSplitInsertSchema>;

// --- Split Participants ---

export const SplitParticipantSchema = z.object({
  id: z.string(),
  split_id: z.string(),
  contact_id: z.string().nullable(),
  is_self: z.number().int().min(0).max(1),
  share_amount: z.number().int(),
  share_value: z.number().nullable(),
  is_paid: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type SplitParticipant = z.infer<typeof SplitParticipantSchema>;

export const SplitParticipantInsertSchema = SplitParticipantSchema.omit({
  id: true,
  created_at: true,
}).partial({
  contact_id: true,
  is_self: true,
  share_value: true,
  is_paid: true,
});
export type SplitParticipantInsert = z.infer<typeof SplitParticipantInsertSchema>;

// --- Settlements ---

export const SettlementSchema = z.object({
  id: z.string(),
  contact_id: z.string(),
  amount: z.number().int(),
  transaction_id: z.string().nullable(),
  note: z.string().nullable(),
  settled_at: z.string(),
  created_at: z.string(),
});
export type Settlement = z.infer<typeof SettlementSchema>;

export const SettlementInsertSchema = SettlementSchema.omit({
  id: true,
  created_at: true,
}).partial({
  transaction_id: true,
  note: true,
  settled_at: true,
});
export type SettlementInsert = z.infer<typeof SettlementInsertSchema>;

