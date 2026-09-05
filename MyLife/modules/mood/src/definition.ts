import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES } from './db/schema';
import { MOOD_V2_UP, MOOD_V2_DOWN } from './db/schema-v2';
import { MOOD_V3_UP, MOOD_V3_DOWN } from './db/schema-v3';

export const MOOD_MODULE: ModuleDefinition = {
  id: 'mood',
  name: 'MyMood',
  tagline: 'Know your mind. Calm your body.',
  icon: '🎭',
  accentColor: '#FB923C',
  tier: 'free',
  storageType: 'sqlite',
  schemaVersion: 3,
  tablePrefix: 'mo_',
  migrations: [
    {
      version: 1,
      description: 'Create mood tables: entries, activities, emotion tags, entry-activities, breathing sessions, settings',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS mo_settings',
        'DROP TABLE IF EXISTS mo_breathing_sessions',
        'DROP TABLE IF EXISTS mo_entry_activities',
        'DROP TABLE IF EXISTS mo_emotion_tags',
        'DROP TABLE IF EXISTS mo_activities',
        'DROP TABLE IF EXISTS mo_entries',
      ],
    },
    {
      version: 2,
      description: 'Add experiments, experiment templates, and module lock tables',
      up: MOOD_V2_UP,
      down: MOOD_V2_DOWN,
    },
    {
      version: 3,
      description: 'Add SOS, attachments, suggestions, meditation, virtual pet, and focus music tables',
      up: MOOD_V3_UP,
      down: MOOD_V3_DOWN,
    },
  ],
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'smile' },
      { key: 'history', label: 'History', icon: 'clock' },
      { key: 'insights', label: 'Insights', icon: 'trending-up' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'log-mood', title: 'Log Mood' },
      { name: 'day-detail', title: 'Day Detail' },
      { name: 'sos', title: 'SOS' },
      { name: 'meditation', title: 'Meditation' },
      { name: 'meditation-session', title: 'Meditation Session' },
      { name: 'pet', title: 'My Pet' },
      { name: 'focus', title: 'Focus Music' },
      { name: 'focus-session', title: 'Focus Session' },
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
      { tableName: 'entries', defaultScope: 'personal_replica', conflictStrategy: 'manual_review', requiresManualResolver: true, resolverComponent: 'MoodConflictResolver' },
      { tableName: 'activities', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'emotion_tags', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'entry_activities', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'breathing_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'experiments', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'module_lock', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'sos_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'attachments', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'meditation_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'pet', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'focus_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
