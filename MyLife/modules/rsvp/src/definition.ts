import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_TABLES, V3_TABLES } from './db/schema';
import { crossModule as rsvpCrossModule } from './cross-module';

const RSVP_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Initial RSVP schema - events, invites, RSVPs, polls, announcements, comments, album, links, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS rv_event_links',
    'DROP TABLE IF EXISTS rv_photos',
    'DROP TABLE IF EXISTS rv_comments',
    'DROP TABLE IF EXISTS rv_announcements',
    'DROP TABLE IF EXISTS rv_poll_votes',
    'DROP TABLE IF EXISTS rv_polls',
    'DROP TABLE IF EXISTS rv_question_responses',
    'DROP TABLE IF EXISTS rv_questions',
    'DROP TABLE IF EXISTS rv_rsvps',
    'DROP TABLE IF EXISTS rv_invites',
    'DROP TABLE IF EXISTS rv_event_cohosts',
    'DROP TABLE IF EXISTS rv_settings',
    'DROP TABLE IF EXISTS rv_events',
  ],
};

const RSVP_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'Calendar sync (calendar_event_id), expense splitting (rv_expenses, rv_expense_splits)',
  up: V2_TABLES,
  down: [
    'DROP TABLE IF EXISTS rv_expense_splits',
    'DROP TABLE IF EXISTS rv_expenses',
    // SQLite does not support DROP COLUMN; calendar_event_id left in place on rollback
  ],
};

const RSVP_MIGRATION_V3: Migration = {
  version: 3,
  description:
    'Recurring events, map/directions, invitation designs, messaging, gift registry, seating',
  up: V3_TABLES,
  down: [
    'DROP TABLE IF EXISTS rv_seat_assignments',
    'DROP TABLE IF EXISTS rv_tables',
    'DROP TABLE IF EXISTS rv_registry_items',
    'DROP TABLE IF EXISTS rv_messages',
    'DROP TABLE IF EXISTS rv_event_series',
    'DROP TABLE IF EXISTS rv_recurrence_rules',
  ],
};

export const RSVP_MODULE: ModuleDefinition = {
  id: 'rsvp',
  name: 'MyRSVP',
  tagline: 'Events, invites, and RSVP tracking',
  icon: '\u{1F48C}',
  accentColor: '#FB7185',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [RSVP_MIGRATION_V1, RSVP_MIGRATION_V2, RSVP_MIGRATION_V3],
  schemaVersion: 3,
  tablePrefix: 'rv_',
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'events',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'invites',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'rsvps',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'guests',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'announcements',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'polls',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'poll_votes',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'comments',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'events', label: 'Events', icon: 'calendar' },
      { key: 'guests', label: 'Guests', icon: 'users' },
      { key: 'polls', label: 'Polls', icon: 'bar-chart' },
      { key: 'feed', label: 'Feed', icon: 'message-circle' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'event-detail', title: 'Event Details' },
      { name: 'invite-management', title: 'Invites' },
      { name: 'check-in', title: 'Check-in' },
      { name: 'photo-album', title: 'Photo Album' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: rsvpCrossModule,
};
