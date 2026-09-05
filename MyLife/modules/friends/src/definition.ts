import type { ModuleDefinition } from '@mylife/module-registry';
import { INIT_TABLES, INIT_INDEXES, V2_MIGRATION_STATEMENTS } from './db/schema';

export const FRIENDS_MODULE: ModuleDefinition = {
  id: 'friends',
  name: 'MyFriends',
  tagline: 'Remember who matters to you',
  icon: '\u{1FAC2}',
  accentColor: '#EC4899',
  tier: 'free',
  storageType: 'sqlite',
  tablePrefix: 'fn_',
  schemaVersion: 2,
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'people',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'hangouts',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'memories',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'circles',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'gifts',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'gift_ideas',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'life_events',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description:
        'Create friends module tables: people, circles, hangouts, gifts, gift_ideas, memories, life_events, nudges, photos, settings',
      up: [...INIT_TABLES, ...INIT_INDEXES],
      down: [
        'DROP TABLE IF EXISTS fn_settings',
        'DROP TABLE IF EXISTS fn_photos',
        'DROP TABLE IF EXISTS fn_nudges',
        'DROP TABLE IF EXISTS fn_life_events',
        'DROP TABLE IF EXISTS fn_memories',
        'DROP TABLE IF EXISTS fn_gift_ideas',
        'DROP TABLE IF EXISTS fn_gifts',
        'DROP TABLE IF EXISTS fn_hangouts',
        'DROP TABLE IF EXISTS fn_circles',
        'DROP TABLE IF EXISTS fn_people',
      ],
    },
    {
      version: 2,
      description:
        'Add type column to fn_memories for gratitude/conflict/growth entries',
      up: V2_MIGRATION_STATEMENTS,
      down: [
        'DROP INDEX IF EXISTS idx_fn_memories_person',
        'DROP INDEX IF EXISTS idx_fn_memories_type',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'people', label: 'People', icon: 'users' },
      { key: 'hangouts', label: 'Hangouts', icon: 'calendar-heart' },
      { key: 'birthdays', label: 'Birthdays', icon: 'cake' },
      { key: 'memories', label: 'Memories', icon: 'heart' },
    ],
    screens: [
      { name: 'person-detail', title: 'Person' },
      { name: 'add-person', title: 'Add Person' },
      { name: 'edit-person', title: 'Edit Person' },
      { name: 'log-hangout', title: 'Log Hangout' },
      { name: 'hangout-detail', title: 'Hangout' },
      { name: 'gift-tracker', title: 'Gifts' },
      { name: 'add-memory', title: 'Add Memory' },
      { name: 'circles', title: 'Circles' },
      { name: 'journal', title: 'Journal' },
      { name: 'add-journal', title: 'Add Journal Entry' },
      { name: 'settings', title: 'Settings' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
