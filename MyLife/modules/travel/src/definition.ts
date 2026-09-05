import type { ModuleDefinition } from '@mylife/module-registry';
import { getTravelMigrations } from './db';

export const TRAVEL_MODULE: ModuleDefinition = {
  id: 'travel',
  name: 'MyTravel',
  tagline: 'Plan trips, collect memories',
  icon: '\u2708\uFE0F',
  accentColor: '#0EA5E9',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: getTravelMigrations(),
  schemaVersion: 7,
  tablePrefix: 'tv_',
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'trips',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'destinations',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'journal_entries',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'journal_memories',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
      {
        tableName: 'itinerary_days',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'activities',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'index', label: 'Trips', icon: 'plane' },
      { key: 'destinations', label: 'Destinations', icon: 'map-pin' },
      { key: 'journal', label: 'Journal', icon: 'book-open' },
      { key: 'logistics', label: 'Logistics', icon: 'briefcase' },
    ],
    screens: [
      { name: 'settings', title: 'Settings' },
      { name: 'trip-detail', title: 'Trip' },
      { name: 'destination-detail', title: 'Destination' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
