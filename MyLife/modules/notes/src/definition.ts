import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, FTS_STATEMENTS, CREATE_INDEXES } from './db/schema';
import { NOTES_V2_UP, NOTES_V2_DOWN } from './db/schema-v2';
import { NOTES_V3_UP, NOTES_V3_DOWN } from './db/schema-v3';
import { NOTES_V4_UP, NOTES_V4_DOWN } from './db/schema-v4';

export const NOTES_MODULE: ModuleDefinition = {
  id: 'notes',
  name: 'MyNotes',
  tagline: 'Private knowledge engine with markdown, wiki linking, and intelligence',
  icon: '📝',
  accentColor: '#64748B',
  tier: 'free',
  storageType: 'sqlite',
  schemaVersion: 4,
  tablePrefix: 'nt_',
  migrations: [
    {
      version: 1,
      description: 'Create notes tables: folders, notes, tags, note-tags, links, templates, settings + FTS5 index',
      up: [...ALL_TABLES, ...FTS_STATEMENTS, ...CREATE_INDEXES],
      down: [
        'DROP TRIGGER IF EXISTS nt_notes_fts_update',
        'DROP TRIGGER IF EXISTS nt_notes_fts_delete',
        'DROP TRIGGER IF EXISTS nt_notes_fts_insert',
        'DROP TABLE IF EXISTS nt_notes_fts',
        'DROP TABLE IF EXISTS nt_settings',
        'DROP TABLE IF EXISTS nt_templates',
        'DROP TABLE IF EXISTS nt_note_links',
        'DROP TABLE IF EXISTS nt_note_tags',
        'DROP TABLE IF EXISTS nt_tags',
        'DROP TABLE IF EXISTS nt_notes',
        'DROP TABLE IF EXISTS nt_folders',
      ],
    },
    {
      version: 2,
      description: 'A-tier features: daily notes, templates UI, attachments, OCR, web clipper, AI assistant, databases, plugins',
      up: NOTES_V2_UP,
      down: NOTES_V2_DOWN,
    },
    {
      version: 3,
      description: 'B-tier features: canvas/whiteboard with infinite surface, nodes, edges',
      up: NOTES_V3_UP,
      down: NOTES_V3_DOWN,
    },
    {
      version: 4,
      description: 'Add hub_tag_id column to nt_tags for shadow-write adoption of hub_tags',
      up: NOTES_V4_UP,
      down: NOTES_V4_DOWN,
    },
  ],
  navigation: {
    tabs: [
      { key: 'notes', label: 'Notes', icon: 'file-text' },
      { key: 'folders', label: 'Folders', icon: 'folder' },
      { key: 'canvas', label: 'Canvas', icon: 'layout' },
      { key: 'insights', label: 'Insights', icon: 'bar-chart-2' },
      { key: 'search', label: 'Search', icon: 'search' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'note-editor', title: 'Edit Note' },
      { name: 'note-preview', title: 'Preview' },
      { name: 'canvas-editor', title: 'Canvas' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    entityRules: [
      { tableName: 'notes', defaultScope: 'personal_replica', conflictStrategy: 'document_crdt' },
      { tableName: 'note_tags', defaultScope: 'personal_replica', conflictStrategy: 'or_set' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
