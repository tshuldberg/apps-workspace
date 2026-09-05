import type { Migration, ModuleDefinition } from '@mylife/module-registry';
import { V1_INDEXES, V1_TABLES } from './db/schema';
import { SPORTS_MIGRATION_V2 } from './db/migrations/v2-games';
import { SPORTS_MIGRATION_V3 } from './db/migrations/v3-notifications-log';
import { SPORTS_MIGRATION_V4 } from './db/migrations/v4-betting';
import { SPORTS_MIGRATION_V5 } from './db/migrations/v5-fantasy';
import { SPORTS_MIGRATION_V6 } from './db/migrations/v6-participation';
import { SPORTS_MIGRATION_V7 } from './db/migrations/v7-events';
import { SPORTS_MIGRATION_V8 } from './db/migrations/v8-predictions';

const SPORTS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial sports schema -- teams + settings',
  up: [...V1_TABLES, ...V1_INDEXES],
  down: [
    'DROP TABLE IF EXISTS sp_settings',
    'DROP TABLE IF EXISTS sp_teams',
  ],
};

export const SPORTS_MODULE: ModuleDefinition = {
  id: 'sports',
  name: 'MySports',
  tagline: 'Your sports life, together',
  icon: '\u26BD',
  accentColor: '#16A34A',
  tier: 'premium',
  storageType: 'sqlite',
  tablePrefix: 'sp_',
  schemaVersion: 8,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'bets',
        defaultScope: 'personal_replica',
        maxScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'participation_sessions',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'attendance',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'teams',
        defaultScope: 'personal_replica',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'predictions',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'games',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    SPORTS_MIGRATION_V1,
    SPORTS_MIGRATION_V2,
    SPORTS_MIGRATION_V3,
    SPORTS_MIGRATION_V4,
    SPORTS_MIGRATION_V5,
    SPORTS_MIGRATION_V6,
    SPORTS_MIGRATION_V7,
    SPORTS_MIGRATION_V8,
  ],
  navigation: {
    tabs: [
      { key: 'index', label: 'Scores', icon: 'radio' },
      { key: 'teams', label: 'Teams', icon: 'users' },
      { key: 'betting', label: 'Betting', icon: 'dollar-sign' },
      { key: 'fantasy', label: 'Fantasy', icon: 'trophy' },
      { key: 'play', label: 'Play', icon: 'activity' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [],
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.1.0',
};
