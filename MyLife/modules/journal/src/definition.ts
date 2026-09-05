import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { BASE_INDEXES, BASE_TABLES, SEED_SETTINGS, V2_UP, V3_UP, V4_UP } from './db/schema';
import { crossModule as journalCrossModule } from './cross-module';

const JOURNAL_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Create journal entries, tags, links, and settings',
  up: [...BASE_TABLES, ...BASE_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS jn_settings',
    'DROP TABLE IF EXISTS jn_entry_tags',
    'DROP TABLE IF EXISTS jn_tags',
    'DROP TABLE IF EXISTS jn_entries',
  ],
};

const JOURNAL_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add multiple journals and notebook-aware entry indexing',
  up: V2_UP,
  down: ['DROP TABLE IF EXISTS jn_journals'],
};

const JOURNAL_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add voice-to-text, automatic metadata, therapy templates, and CBT thought records',
  up: V3_UP,
  down: [
    'DROP TABLE IF EXISTS jn_thought_record_distortions',
    'DROP TABLE IF EXISTS jn_thought_record_emotions',
    'DROP TABLE IF EXISTS jn_thought_records',
    'DROP TABLE IF EXISTS jn_therapy_topics',
    'DROP TABLE IF EXISTS jn_voice_recordings',
  ],
};

const JOURNAL_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Add AI prompts, philosophy quotes, affirmations, grid layouts, and vision boards',
  up: V4_UP,
  down: [
    'DROP TABLE IF EXISTS jn_vision_board_items',
    'DROP TABLE IF EXISTS jn_vision_boards',
    'DROP TABLE IF EXISTS jn_grid_cells',
    'DROP TABLE IF EXISTS jn_grid_layouts',
    'DROP TABLE IF EXISTS jn_affirmation_logs',
    'DROP TABLE IF EXISTS jn_affirmations',
    'DROP TABLE IF EXISTS jn_philosophy_quotes',
    'DROP TABLE IF EXISTS jn_ai_prompts',
  ],
};

export const JOURNAL_MODULE: ModuleDefinition = {
  id: 'journal',
  name: 'MyJournal',
  tagline: 'Private journal, thought toolkit, and self-reflection suite',
  icon: '📓',
  accentColor: '#A78BFA',
  tier: 'free',
  storageType: 'sqlite',
  migrations: [JOURNAL_MIGRATION_V1, JOURNAL_MIGRATION_V2, JOURNAL_MIGRATION_V3, JOURNAL_MIGRATION_V4],
  schemaVersion: 4,
  tablePrefix: 'jn_',
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'edit-3' },
      { key: 'entries', label: 'Entries', icon: 'book-open' },
      { key: 'toolkit', label: 'Toolkit', icon: 'heart' },
      { key: 'insights', label: 'Insights', icon: 'bar-chart-2' },
      { key: 'search', label: 'Search', icon: 'search' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'entry-detail', title: 'Entry' },
      { name: 'new-entry', title: 'New Entry' },
      { name: 'thought-record', title: 'CBT Thought Record' },
      { name: 'therapy-prep', title: 'Therapy Prep' },
      { name: 'affirmations', title: 'Affirmations' },
      { name: 'philosophy', title: 'Daily Philosophy' },
      { name: 'grid-entry', title: 'Grid Entry' },
      { name: 'vision-board', title: 'Vision Board' },
      { name: 'challenges', title: 'Challenges' },
      { name: 'book-builder', title: 'Book Builder' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: journalCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    entityRules: [
      { tableName: 'entries', defaultScope: 'personal_replica', conflictStrategy: 'document_crdt' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
