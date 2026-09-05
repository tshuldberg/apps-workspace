import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, V2_TABLES, V2_INDEXES, V2_ALTER_ACCOUNTS, V2_ALTER_MESSAGES } from './db/schema';

export const MAIL_MODULE: ModuleDefinition = {
  id: 'mail',
  name: 'MyMail',
  tagline: 'Self-hosted private email',
  icon: '📬',
  accentColor: '#3B82F6',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 2,
  tablePrefix: 'ml_',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    entityRules: [
      {
        tableName: 'messages',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'accounts',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'drafts',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create mail tables: accounts, messages, drafts, folders',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS ml_folders',
        'DROP TABLE IF EXISTS ml_drafts',
        'DROP TABLE IF EXISTS ml_messages',
        'DROP TABLE IF EXISTS ml_accounts',
      ],
    },
    {
      version: 2,
      description: 'Add B+C feature tables: attachments, filters, contacts, threads, calendar events, notification preferences, encryption keys, sync state; extend accounts and messages',
      up: [
        ...V2_TABLES,
        ...V2_ALTER_ACCOUNTS,
        ...V2_ALTER_MESSAGES,
        ...V2_INDEXES,
      ],
      down: [
        'DROP TABLE IF EXISTS ml_sync_state',
        'DROP TABLE IF EXISTS ml_encryption_keys',
        'DROP TABLE IF EXISTS ml_notification_preferences',
        'DROP TABLE IF EXISTS ml_calendar_events',
        'DROP TABLE IF EXISTS ml_threads',
        'DROP TABLE IF EXISTS ml_contacts',
        'DROP TABLE IF EXISTS ml_filters',
        'DROP TABLE IF EXISTS ml_attachments',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'inbox', label: 'Inbox', icon: 'inbox' },
      { key: 'compose', label: 'Compose', icon: 'edit' },
      { key: 'folders', label: 'Folders', icon: 'folder' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'message-detail', title: 'Message' },
      { name: 'compose-message', title: 'Compose' },
      { name: 'server-setup', title: 'Server Setup' },
      { name: 'search', title: 'Search' },
      { name: 'thread-detail', title: 'Conversation' },
      { name: 'contacts', title: 'Contacts' },
      { name: 'filter-editor', title: 'Edit Filter' },
      { name: 'encryption-settings', title: 'Encryption' },
      { name: 'notification-settings', title: 'Notifications' },
      { name: 'accounts', title: 'Accounts' },
    ],
  },
  requiresAuth: true,
  requiresNetwork: true,
  version: '0.2.0',
};
