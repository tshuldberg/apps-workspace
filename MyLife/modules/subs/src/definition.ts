import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_CATEGORIES } from './db/schema';
import { V2_TABLES, V2_INDEXES, V2_ALTER_STATEMENTS } from './db/detection-schema';

const SUBS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Create core tables: subscriptions, categories, price_history, renewal_events, cancellation_actions, price_alternatives, catalog',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_CATEGORIES],
  down: [
    'DROP TABLE IF EXISTS sb_catalog',
    'DROP TABLE IF EXISTS sb_price_alternatives',
    'DROP TABLE IF EXISTS sb_cancellation_actions',
    'DROP TABLE IF EXISTS sb_renewal_events',
    'DROP TABLE IF EXISTS sb_price_history',
    'DROP TABLE IF EXISTS sb_subscriptions',
    'DROP TABLE IF EXISTS sb_categories',
  ],
};

const SUBS_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add bank sync detection tables: detected_subscriptions, dismissed_payees, bank_detected column',
  up: [...V2_TABLES, ...V2_INDEXES, ...V2_ALTER_STATEMENTS],
  down: [
    'DROP TABLE IF EXISTS sb_dismissed_payees',
    'DROP TABLE IF EXISTS sb_detected_subscriptions',
  ],
};

export const SUBS_MODULE: ModuleDefinition = {
  id: 'subs',
  name: 'MySubs',
  tagline: 'Subscription cost tracker',
  icon: '💳',
  accentColor: '#10B981',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 2,
  tablePrefix: 'sb_',
  migrations: [SUBS_MIGRATION_V1, SUBS_MIGRATION_V2],
  navigation: {
    tabs: [
      { key: 'dashboard', label: 'Dashboard', icon: 'credit-card' },
      { key: 'subscriptions', label: 'Subs', icon: 'list' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'sub-detail', title: 'Subscription' },
      { name: 'add-sub', title: 'Add Subscription' },
      { name: 'cost-report', title: 'Cost Report' },
      { name: 'detect', title: 'Find Subscriptions' },
      { name: 'cancel-detail', title: 'Review Subscription' },
      { name: 'compare', title: 'Compare Prices' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      {
        tableName: 'subscriptions',
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
