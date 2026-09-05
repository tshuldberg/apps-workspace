import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, V2_UP, V3_UP, V4_UP } from './db/schema';

export const WORDS_MODULE: ModuleDefinition = {
  id: 'words',
  name: 'MyWords',
  tagline: 'Dictionary + thesaurus in 270 languages',
  icon: '\u{1F4D6}',
  accentColor: '#0EA5E9',
  tier: 'premium',
  storageType: 'sqlite',
  tablePrefix: 'wd_',
  schemaVersion: 4,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'saved_words',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'word_lists',
        defaultScope: 'personal_replica',
        conflictStrategy: 'or_set',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create saved words tables: word_lists, saved_words',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS wd_saved_words',
        'DROP TABLE IF EXISTS wd_word_lists',
      ],
    },
    {
      version: 2,
      description: 'Add flash_card_id column for Flash module integration',
      up: V2_UP,
      down: [],
    },
    {
      version: 3,
      description: 'Add offline lookup cache table',
      up: V3_UP,
      down: ['DROP TABLE IF EXISTS wd_lookup_cache'],
    },
    {
      version: 4,
      description: 'Add FTS5 full-text search for saved words',
      up: V4_UP,
      down: [
        'DROP TRIGGER IF EXISTS wd_saved_words_fts_update',
        'DROP TRIGGER IF EXISTS wd_saved_words_fts_delete',
        'DROP TRIGGER IF EXISTS wd_saved_words_fts_insert',
        'DROP TABLE IF EXISTS wd_saved_words_fts',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'lookup', label: 'Lookup', icon: 'search' },
      { key: 'helper', label: 'Word Helper', icon: 'sparkles' },
      { key: 'languages', label: 'Languages', icon: 'globe' },
      { key: 'saved', label: 'Saved', icon: 'bookmark' },
      { key: 'settings', label: 'Settings', icon: 'settings' }
    ],
    screens: [
      { name: 'word-detail', title: 'Word' },
      { name: 'saved-word-detail', title: 'Saved Word' }
    ]
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.2.0'
};
