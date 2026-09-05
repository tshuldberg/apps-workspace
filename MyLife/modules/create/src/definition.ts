import type { ModuleDefinition } from '@mylife/module-registry';
import { CREATE_MIGRATION_V1, CREATE_MIGRATION_V2 } from './db';

export const CREATE_MODULE: ModuleDefinition = {
  id: 'create',
  name: 'MyCreate',
  tagline: 'Track your creative journey',
  icon: '\u{1F3A8}',
  accentColor: '#D946EF',
  tier: 'premium',
  storageType: 'sqlite',
  tablePrefix: 'ct_',
  schemaVersion: 2,
  migrations: [CREATE_MIGRATION_V1, CREATE_MIGRATION_V2],
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'projects',
        defaultScope: 'personal_replica',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'portfolio_pieces',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'progress_entries',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'projects', label: 'Projects', icon: 'palette' },
      { key: 'practice', label: 'Practice', icon: 'timer' },
      { key: 'skills', label: 'Skills', icon: 'sparkles' },
      { key: 'portfolio', label: 'Portfolio', icon: 'image' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'project-detail', title: 'Project' },
      { name: 'add-project', title: 'Add Project' },
      { name: 'log-progress', title: 'Log Progress' },
      { name: 'skill-detail', title: 'Skill' },
      { name: 'portfolio-piece', title: 'Portfolio Piece' },
      { name: 'equipment', title: 'Equipment' },
      { name: 'settings', title: 'Settings' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
