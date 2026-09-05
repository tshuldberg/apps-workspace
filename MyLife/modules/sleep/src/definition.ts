import type { ModuleDefinition } from '@mylife/module-registry';
import { getSleepMigrations } from './db';

export const SLEEP_MODULE: ModuleDefinition = {
  id: 'sleep',
  name: 'MySleep',
  tagline: 'Track your sleep, remember your dreams',
  icon: '\u{1F319}',
  accentColor: '#A78BFA',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: getSleepMigrations(),
  schemaVersion: 4,
  tablePrefix: 'sl_',
  navigation: {
    tabs: [
      { key: 'log', label: 'Sleep', icon: 'moon' },
      { key: 'dreams', label: 'Dreams', icon: 'sparkles' },
      { key: 'insights', label: 'Insights', icon: 'bar-chart-3' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'entry-detail', title: 'Sleep Entry' },
      { name: 'dream-detail', title: 'Dream' },
      { name: 'dream-patterns', title: 'Dream Patterns' },
      { name: 'goals', title: 'Goals' },
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
        tableName: 'sleep_entries',
        defaultScope: 'personal_replica',
        conflictStrategy: 'manual_review',
        requiresManualResolver: true,
        resolverComponent: 'SleepEntryResolver',
      },
      {
        tableName: 'dreams',
        defaultScope: 'personal_replica',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'naps',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'factors',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'goals',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'streaks',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'streak_history',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'hygiene_checks',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
};
