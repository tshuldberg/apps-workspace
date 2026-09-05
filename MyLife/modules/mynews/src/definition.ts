import type { Migration, ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES } from './db/schema';

const MYNEWS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'MyNews local cache: follows, saved, read cursor, feeds, drafts, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS nw_settings',
    'DROP TABLE IF EXISTS nw_drafts',
    'DROP TABLE IF EXISTS nw_feed_pins',
    'DROP TABLE IF EXISTS nw_feed_defs',
    'DROP TABLE IF EXISTS nw_read_cursor',
    'DROP TABLE IF EXISTS nw_saved',
    'DROP TABLE IF EXISTS nw_follows',
  ],
};

export const MYNEWS_MODULE: ModuleDefinition = {
  id: 'mynews',
  name: 'MyNews',
  tagline: 'Open journalism, improved by everyone',
  icon: '\u{1F4F0}',
  accentColor: '#8BCFF0',
  tier: 'premium',
  storageType: 'supabase',
  migrations: [MYNEWS_MIGRATION_V1],
  schemaVersion: 1,
  tablePrefix: 'nw_',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    entityRules: [
      { tableName: 'follows', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'saved', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'read_cursor', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'feed_defs', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'feed_pins', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'drafts', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'home' },
      { key: 'discover', label: 'Discover', icon: 'compass' },
      { key: 'desk', label: 'Desk', icon: 'edit-3' },
      { key: 'support', label: 'Support', icon: 'heart' },
      { key: 'me', label: 'Me', icon: 'user' },
    ],
    screens: [
      { name: 'article-detail', title: 'Article' },
      { name: 'journalist-detail', title: 'Journalist' },
      { name: 'suggestion-detail', title: 'Suggestion' },
      { name: 'suggest', title: 'Suggest an edit' },
      { name: 'review-batch', title: 'Batch copyedits' },
      { name: 'credibility', title: 'Credibility' },
      { name: 'newsrooms', title: 'Newsrooms' },
      { name: 'newsroom-detail', title: 'Newsroom' },
      { name: 'register', title: 'Create your profile' },
      { name: 'blocked', title: 'Blocked accounts' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.1.0',
};
