import type { ModuleDefinition } from '@mylife/module-registry';
import { HEALTH_MIGRATION_V1, HEALTH_MIGRATION_V2, HEALTH_MIGRATION_V3 } from './db/migrations';
import { crossModule as healthCrossModule } from './cross-module';

export const HEALTH_MODULE: ModuleDefinition = {
  id: 'health',
  name: 'MyHealth',
  tagline: 'Your health data, on your device, under your control',
  icon: '\u{1FA7A}',
  accentColor: '#EF4444',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [HEALTH_MIGRATION_V1, HEALTH_MIGRATION_V2, HEALTH_MIGRATION_V3],
  schemaVersion: 3,
  tablePrefix: 'hl_',
  freeSections: ['fasting'],
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'stethoscope' },
      { key: 'vitals', label: 'Vitals', icon: 'heart' },
      { key: 'activity', label: 'Activity', icon: 'activity' },
      { key: 'sleep', label: 'Sleep', icon: 'moon' },
      { key: 'mind', label: 'Mind', icon: 'brain' },
    ],
    screens: [
      // Former tabs (now accessible via dashboard/header)
      { name: 'fasting', title: 'Fasting' },
      { name: 'insights', title: 'Insights' },
      { name: 'vault', title: 'Vault' },
      // Fasting screens
      { name: 'fast-detail', title: 'Fast Details' },
      { name: 'choose-plan', title: 'Choose Plan' },
      // Medication screens
      { name: 'med-detail', title: 'Medication' },
      { name: 'add-med', title: 'Add Medication' },
      { name: 'schedule', title: 'Schedule' },
      { name: 'interactions', title: 'Interactions' },
      // Vitals screens
      { name: 'measurement-log', title: 'Log Measurement' },
      { name: 'vital-detail', title: 'Vital Detail' },
      { name: 'cycle-tracker', title: 'Cycle Tracker' },
      { name: 'sleep-detail', title: 'Sleep Detail' },
      // Insights screens
      { name: 'mood-check-in', title: 'Mood Check-In' },
      { name: 'correlation', title: 'Correlations' },
      { name: 'wellness-timeline', title: 'Wellness Timeline' },
      { name: 'export', title: 'Export Data' },
      // Vault screens
      { name: 'add-document', title: 'Add Document' },
      { name: 'document-viewer', title: 'Document' },
      { name: 'emergency-info', title: 'Emergency Info' },
      { name: 'health-sync-settings', title: 'Health Sync' },
      // Goals
      { name: 'goal-detail', title: 'Goal' },
      { name: 'add-goal', title: 'New Goal' },
      // Mind screens
      { name: 'cbt', title: 'CBT Exercises' },
      { name: 'breathing', title: 'Breathing' },
      // Migration
      { name: 'migration-prompt', title: 'Welcome to MyHealth' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: healthCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      { tableName: 'vitals', defaultScope: 'personal_replica', conflictStrategy: 'manual_review', requiresManualResolver: true, resolverComponent: 'HealthVitalsConflictResolver' },
      { tableName: 'sleep_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'documents', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'goals', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'goal_progress', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'emergency_info', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'breathing_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'readiness_scores', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'activity_summaries', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'cbt_entries', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'meditation_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'body_measurements', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'sos_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'sleep_routines', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'smart_alarms', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'snore_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
