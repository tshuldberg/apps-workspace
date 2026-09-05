import type { ModuleDefinition } from '@mylife/module-registry';
import {
  CACHE_TABLES,
  CACHE_INDEXES,
  V2_CACHE_TABLES,
  V2_CACHE_INDEXES,
  V3_CACHE_TABLES,
  V3_CACHE_INDEXES,
  V4_CACHE_TABLES,
  V4_CACHE_INDEXES,
} from './db/schema';

export const FORUMS_MODULE: ModuleDefinition = {
  id: 'forums',
  name: 'MyForums',
  tagline: 'Human-verified community, bot-free by design',
  icon: '\u{1F4AC}',
  accentColor: '#7C4DFF',
  tier: 'free',
  storageType: 'supabase',
  schemaVersion: 4,
  tablePrefix: 'fr_',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    entityRules: [
      {
        tableName: 'communities_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'threads_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'replies_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create local cache tables for offline browsing of communities, threads, and replies',
      up: [...CACHE_TABLES, ...CACHE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS fr_tags_cache',
        'DROP TABLE IF EXISTS fr_bookmarks_cache',
        'DROP TABLE IF EXISTS fr_replies_cache',
        'DROP TABLE IF EXISTS fr_threads_cache',
        'DROP TABLE IF EXISTS fr_community_members_cache',
        'DROP TABLE IF EXISTS fr_communities_cache',
      ],
    },
    {
      version: 2,
      description: 'Add B+C feature cache tables: profiles, conversations, messages',
      up: [...V2_CACHE_TABLES, ...V2_CACHE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS fr_messages_cache',
        'DROP TABLE IF EXISTS fr_conversations_cache',
        'DROP TABLE IF EXISTS fr_profiles_cache',
      ],
    },
    {
      version: 3,
      description: 'Add humans_only column to communities cache + local vote tracking table',
      up: [
        `ALTER TABLE fr_communities_cache ADD COLUMN humans_only INTEGER NOT NULL DEFAULT 0`,
        ...V3_CACHE_TABLES,
        ...V3_CACHE_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS fr_votes_local',
      ],
    },
    {
      version: 4,
      description: 'Add cached activity feed rows with persistent read state',
      up: [...V4_CACHE_TABLES, ...V4_CACHE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS fr_activity_cache',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'feed', label: 'Feed', icon: 'newspaper' },
      { key: 'communities', label: 'Communities', icon: 'users' },
      { key: 'search', label: 'Search', icon: 'search' },
      { key: 'saved', label: 'Saved', icon: 'bookmark' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
    screens: [
      { name: 'community-detail', title: 'Community' },
      { name: 'thread-detail', title: 'Thread' },
      { name: 'create-thread', title: 'New Thread' },
      { name: 'create-community', title: 'New Community' },
      { name: 'community-settings', title: 'Settings' },
      { name: 'community-health', title: 'Community Health' },
      { name: 'mod-log', title: 'Mod Log' },
      { name: 'user-profile', title: 'Profile' },
      { name: 'edit-profile', title: 'Edit Profile' },
      { name: 'activity-feed', title: 'Activity' },
      { name: 'messages', title: 'Messages' },
      { name: 'conversation', title: 'Conversation' },
      { name: 'new-message', title: 'New Message' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.4.0',
};
