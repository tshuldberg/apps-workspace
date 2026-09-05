import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_INDEXES, V2_TABLES } from './db/schema';

const PRESENCE_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial presence schema -- daily usage, app usage, goals, sessions, intentions, XP, settings',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS pr_xp_log',
    'DROP TABLE IF EXISTS pr_app_opens',
    'DROP TABLE IF EXISTS pr_app_intentions',
    'DROP TABLE IF EXISTS pr_session_whitelist',
    'DROP TABLE IF EXISTS pr_sessions',
    'DROP TABLE IF EXISTS pr_goals',
    'DROP TABLE IF EXISTS pr_app_usage',
    'DROP TABLE IF EXISTS pr_daily_usage',
    'DROP TABLE IF EXISTS pr_settings',
  ],
};

const PRESENCE_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add phase 4 gap-fill features: scheduled sessions, persistent badges, accountability, rewards, commitments, and app reflection notes',
  up: [...V2_TABLES, ...V2_INDEXES],
  down: [
    'DROP TABLE IF EXISTS pr_commitment_contracts',
    'DROP TABLE IF EXISTS pr_rewards',
    'DROP TABLE IF EXISTS pr_accountability_partners',
    'DROP TABLE IF EXISTS pr_badges',
    'DROP TABLE IF EXISTS pr_scheduled_sessions',
  ],
};

export const PRESENCE_MODULE: ModuleDefinition = {
  id: 'presence',
  name: 'MyPresence',
  tagline: 'Put your phone down. Pick your life up.',
  icon: '\u{1F9D8}',
  accentColor: '#0891B2',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [PRESENCE_MIGRATION_V1, PRESENCE_MIGRATION_V2],
  schemaVersion: 2,
  tablePrefix: 'pr_',
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'stats', label: 'Stats', icon: 'insights' },
      { key: 'sessions', label: 'Sessions', icon: 'timer' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'onboarding', title: 'Get Started' },
      { name: 'hub', title: 'Discover' },
      { name: 'intentions', title: 'App Intentions' },
      { name: 'intention-prompt', title: 'Intention' },
      { name: 'session-active', title: 'Focus Session' },
      { name: 'session-complete', title: 'Session Complete' },
      { name: 'scheduled', title: 'Scheduled Sessions' },
      { name: 'accountability', title: 'Accountability' },
      { name: 'rewards', title: 'Rewards' },
      { name: 'commitment', title: 'Commitment' },
      { name: 'breathing-pause', title: 'Breathing Pause' },
      { name: 'reflection', title: 'Reflection' },
      { name: 'badges', title: 'Badges' },
      { name: 'insights', title: 'Insights' },
      { name: 'report', title: 'Daily Report' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    entityRules: [
      { tableName: 'sessions', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'app_intentions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'daily_usage', defaultScope: 'personal_replica', conflictStrategy: 'counter' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
