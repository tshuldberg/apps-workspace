import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  BASE_INDEXES,
  BASE_TABLES,
  DEFAULT_DECK_SEED,
  SEED_SETTINGS,
  V2_UP,
  V3_UP,
  V4_UP,
  V5_UP,
} from './db/schema';

const FLASH_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Create flash decks, cards, review logs, and settings',
  up: [...BASE_TABLES, ...BASE_INDEXES, ...SEED_SETTINGS, DEFAULT_DECK_SEED],
  down: [
    'DROP TABLE IF EXISTS fl_settings',
    'DROP TABLE IF EXISTS fl_review_logs',
    'DROP TABLE IF EXISTS fl_cards',
    'DROP TABLE IF EXISTS fl_decks',
  ],
};

const FLASH_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add browser, queue controls, export history, and reminder settings',
  up: V2_UP,
  down: [
    'DROP TABLE IF EXISTS fl_export_records',
  ],
};

const FLASH_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add media, multiple choice results, match game results, and card source tracking',
  up: V3_UP,
  down: [
    'DROP TABLE IF EXISTS fl_match_bests',
    'DROP TABLE IF EXISTS fl_match_results',
    'DROP TABLE IF EXISTS fl_mc_results',
    'DROP TABLE IF EXISTS fl_media',
  ],
};

const FLASH_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Add starred/favorite column to cards',
  up: V5_UP,
  down: [],
};

const FLASH_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Add custom templates, image occlusion, practice tests, conversation practice, and competitive leagues',
  up: V4_UP,
  down: [
    'DROP TABLE IF EXISTS fl_league_scores',
    'DROP TABLE IF EXISTS fl_league_members',
    'DROP TABLE IF EXISTS fl_leagues',
    'DROP TABLE IF EXISTS fl_conversation_messages',
    'DROP TABLE IF EXISTS fl_conversations',
    'DROP TABLE IF EXISTS fl_practice_answers',
    'DROP TABLE IF EXISTS fl_practice_tests',
    'DROP TABLE IF EXISTS fl_occlusion_regions',
    'DROP TABLE IF EXISTS fl_template_fields',
    'DROP TABLE IF EXISTS fl_templates',
  ],
};

export const FLASH_MODULE: ModuleDefinition = {
  id: 'flash',
  name: 'MyFlash',
  tagline: 'Never forget what matters',
  icon: '🧠',
  accentColor: '#8B5CF6',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [FLASH_MIGRATION_V1, FLASH_MIGRATION_V2, FLASH_MIGRATION_V3, FLASH_MIGRATION_V4, FLASH_MIGRATION_V5],
  schemaVersion: 5,
  tablePrefix: 'fl_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'decks',
        defaultScope: 'personal_replica',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'cards',
        defaultScope: 'personal_replica',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'review_logs',
        defaultScope: 'personal_replica',
        conflictStrategy: 'counter',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'study', label: 'Study', icon: 'play-circle' },
      { key: 'decks', label: 'Decks', icon: 'layers' },
      { key: 'browser', label: 'Browse', icon: 'search' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'deck-detail', title: 'Deck' },
      { name: 'card-editor', title: 'Edit Card' },
      { name: 'review', title: 'Review' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.2.0',
};
