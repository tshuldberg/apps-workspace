import type { ModuleDefinition } from '@mylife/module-registry';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  CREATE_TEMPERATURES,
  CREATE_TEMPERATURE_INDEXES,
  CREATE_PREGNANCY_CONFIG,
  CREATE_APPOINTMENTS,
  CREATE_PREGNANCY_INDEXES,
  CREATE_PARTNER_LINKS,
  CREATE_PARTNER_INDEXES,
  PARTNER_LINKS_V5_ALTERS,
} from './db/schema';

export const CYCLE_MODULE: ModuleDefinition = {
  id: 'cycle',
  name: 'MyCycle',
  tagline: 'Private period and fertility tracker',
  icon: '🌙',
  accentColor: '#C9894D',
  tier: 'premium',
  storageType: 'sqlite',
  schemaVersion: 5,
  tablePrefix: 'cy_',
  migrations: [
    {
      version: 1,
      description: 'Create cycle tables: cycles, cycle_days, symptoms',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS cy_symptoms',
        'DROP TABLE IF EXISTS cy_cycle_days',
        'DROP TABLE IF EXISTS cy_cycles',
      ],
    },
    {
      version: 2,
      description: 'Add temperature tracking table',
      up: [CREATE_TEMPERATURES, ...CREATE_TEMPERATURE_INDEXES],
      down: ['DROP TABLE IF EXISTS cy_temperatures'],
    },
    {
      version: 3,
      description: 'Add pregnancy mode tables: pregnancy config and appointments',
      up: [CREATE_PREGNANCY_CONFIG, CREATE_APPOINTMENTS, ...CREATE_PREGNANCY_INDEXES],
      down: [
        'DROP TABLE IF EXISTS cy_appointments',
        'DROP TABLE IF EXISTS cy_pregnancy_config',
      ],
    },
    {
      version: 4,
      description: 'Add partner sync table for sharing cycle data',
      up: [CREATE_PARTNER_LINKS, ...CREATE_PARTNER_INDEXES],
      down: ['DROP TABLE IF EXISTS cy_partner_links'],
    },
    {
      version: 5,
      description: 'Add granular mood and temperature partner sharing preferences',
      up: PARTNER_LINKS_V5_ALTERS,
      down: [],
    },
  ],
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'calendar-check' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'insights', label: 'Insights', icon: 'trending-up' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'log-day', title: 'Log Day' },
      { name: 'cycle-detail', title: 'Cycle Detail' },
      { name: 'temperature', title: 'Temperature Chart' },
      { name: 'pregnancy', title: 'Pregnancy Tracker' },
      { name: 'partner', title: 'Partner Sharing' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      { tableName: 'cycles', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'cycle_days', defaultScope: 'personal_replica', conflictStrategy: 'manual_review', requiresManualResolver: true, resolverComponent: 'CycleConflictResolver' },
      { tableName: 'symptoms', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'temperatures', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'pregnancy_config', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'appointments', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'partner_links', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
