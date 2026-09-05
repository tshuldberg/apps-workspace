import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  BANK_SYNC_INDEXES,
  BANK_SYNC_TABLES,
  CORE_INDEXES,
  CORE_TABLES,
  SEED_DEFAULT_ACCOUNTS,
  SEED_DEFAULT_ENVELOPES,
  SEED_SETTINGS,
  SUBSCRIPTION_TABLES,
  SUBSCRIPTION_INDEXES,
  V4_ALL_TABLES,
  V4_INDEXES,
  V4_ALTER_STATEMENTS,
  V5_ALL_TABLES,
  V5_INDEXES,
  V5_EXTEND_ACCOUNT_TYPES,
  V6_ALL_TABLES,
  V6_INDEXES,
  V6_ALTER_STATEMENTS,
} from './db/schema';
import { budgetCrossModule } from './cross-module';

const BUDGET_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Initial budget schema — envelopes, accounts, transactions, goals, settings + indexes + seeds',
  up: [
    ...CORE_TABLES,
    ...CORE_INDEXES,
    ...SEED_DEFAULT_ACCOUNTS,
    ...SEED_DEFAULT_ENVELOPES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_goals',
    'DROP TABLE IF EXISTS bg_transactions',
    'DROP TABLE IF EXISTS bg_settings',
    'DROP TABLE IF EXISTS bg_accounts',
    'DROP TABLE IF EXISTS bg_envelopes',
  ],
};

const BUDGET_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add bank sync scaffolding tables and indexes',
  up: [
    ...BANK_SYNC_TABLES,
    ...BANK_SYNC_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_bank_webhook_events',
    'DROP TABLE IF EXISTS bg_bank_sync_state',
    'DROP TABLE IF EXISTS bg_bank_transactions_raw',
    'DROP TABLE IF EXISTS bg_bank_accounts',
    'DROP TABLE IF EXISTS bg_bank_connections',
  ],
};

const BUDGET_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add subscriptions table and indexes',
  up: [
    ...SUBSCRIPTION_TABLES,
    ...SUBSCRIPTION_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_subscriptions',
  ],
};

const BUDGET_MIGRATION_V4: Migration = {
  version: 4,
  description:
    'YNAB-style budget engine: category groups, allocations, splits, recurring templates, payee cache, CSV profiles, price history, notifications, transaction rules, net worth, debt payoff, rollovers, alerts, multi-currency, shared envelopes',
  up: [
    // Alter existing tables first (add columns before creating tables that reference them)
    ...V4_ALTER_STATEMENTS,
    // Create new tables
    ...V4_ALL_TABLES,
    // Create indexes
    ...V4_INDEXES,
    // Seed base currency
    `INSERT OR IGNORE INTO bg_currencies (code, name, symbol, decimal_places, is_base) VALUES ('USD', 'US Dollar', '$', 2, 1)`,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_shared_envelopes',
    'DROP TABLE IF EXISTS bg_exchange_rates',
    'DROP TABLE IF EXISTS bg_currencies',
    'DROP TABLE IF EXISTS bg_alert_history',
    'DROP TABLE IF EXISTS bg_budget_alerts',
    'DROP TABLE IF EXISTS bg_budget_rollovers',
    'DROP TABLE IF EXISTS bg_debt_payoff_debts',
    'DROP TABLE IF EXISTS bg_debt_payoff_plans',
    'DROP TABLE IF EXISTS bg_net_worth_snapshots',
    'DROP TABLE IF EXISTS bg_transaction_rules',
    'DROP TABLE IF EXISTS bg_notification_log',
    'DROP TABLE IF EXISTS bg_price_history',
    'DROP TABLE IF EXISTS bg_csv_profiles',
    'DROP TABLE IF EXISTS bg_payee_cache',
    'DROP TABLE IF EXISTS bg_recurring_templates',
    'DROP TABLE IF EXISTS bg_transaction_splits',
    'DROP TABLE IF EXISTS bg_budget_allocations',
    'DROP TABLE IF EXISTS bg_category_groups',
    // Note: ALTER TABLE DROP COLUMN not supported in all SQLite versions.
    // The added columns on existing tables will remain but be unused after rollback.
  ],
};

const BUDGET_MIGRATION_V5: Migration = {
  version: 5,
  description:
    'Age of Money snapshots, net worth milestones, cancellation actions, extended account types (investment, loan, mortgage)',
  up: [
    // Extend account types (recreate table with new CHECK)
    ...V5_EXTEND_ACCOUNT_TYPES,
    // Create new tables
    ...V5_ALL_TABLES,
    // Create indexes
    ...V5_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_cancellation_actions',
    'DROP TABLE IF EXISTS bg_net_worth_milestones',
    'DROP TABLE IF EXISTS bg_age_of_money_snapshots',
    // Note: account type extension rollback not implemented (safe to leave wider CHECK)
  ],
};

const BUDGET_MIGRATION_V6: Migration = {
  version: 6,
  description:
    'B+C features: receipt OCR, multi-currency history, ML categorization, loan planner, investment tracking, family sharing, expense splitting',
  up: [
    ...V6_ALTER_STATEMENTS,
    ...V6_ALL_TABLES,
    ...V6_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bg_settlements',
    'DROP TABLE IF EXISTS bg_split_participants',
    'DROP TABLE IF EXISTS bg_expense_splits',
    'DROP TABLE IF EXISTS bg_contacts',
    'DROP TABLE IF EXISTS bg_sync_log',
    'DROP TABLE IF EXISTS bg_envelope_sharing',
    'DROP TABLE IF EXISTS bg_family_members',
    'DROP TABLE IF EXISTS bg_families',
    'DROP TABLE IF EXISTS bg_holding_snapshots',
    'DROP TABLE IF EXISTS bg_holdings',
    'DROP TABLE IF EXISTS bg_loan_payments',
    'DROP TABLE IF EXISTS bg_loans',
    'DROP TABLE IF EXISTS bg_categorization_feedback',
    'DROP TABLE IF EXISTS bg_exchange_rate_history',
    'DROP TABLE IF EXISTS bg_receipts',
  ],
};

export const BUDGET_MODULE: ModuleDefinition = {
  id: 'budget',
  name: 'MyBudget',
  tagline: 'Know where every dollar went, and why',
  icon: '\u{1F4B0}',
  accentColor: '#22C55E',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [BUDGET_MIGRATION_V1, BUDGET_MIGRATION_V2, BUDGET_MIGRATION_V3, BUDGET_MIGRATION_V4, BUDGET_MIGRATION_V5, BUDGET_MIGRATION_V6],
  schemaVersion: 6,
  tablePrefix: 'bg_',
  navigation: {
    tabs: [
      { key: 'budget', label: 'Budget', icon: 'wallet' },
      { key: 'transactions', label: 'Transactions', icon: 'list' },
      { key: 'subscriptions', label: 'Subscriptions', icon: 'repeat' },
      { key: 'reports', label: 'Reports', icon: 'pie-chart' },
      { key: 'accounts', label: 'Accounts', icon: 'credit-card' },
    ],
    screens: [
      { name: 'envelope-detail', title: 'Envelope' },
      { name: 'add-transaction', title: 'Add Transaction' },
      { name: 'subscription-detail', title: 'Subscription' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: budgetCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      {
        tableName: 'transactions',
        defaultScope: 'personal_replica',
        conflictStrategy: 'manual_review',
        requiresManualResolver: true,
        resolverComponent: 'BudgetConflictResolver',
      },
      {
        tableName: 'envelopes',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'settings',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
};
