import type { ModuleDefinition } from '@mylife/module-registry';
import type { Migration } from '@mylife/module-registry';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  V2_TABLES,
  CREATE_V2_INDEXES,
  SEED_SETTINGS,
  V3_TABLES,
  CREATE_V3_INDEXES,
} from './db/schema';
import { crossModule as homesCrossModule } from './cross-module';

const HOMES_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial homes schema — listings and tours',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS hm_tours',
    'DROP TABLE IF EXISTS hm_listings',
  ],
};

const HOMES_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add properties, maintenance schedules, and settings',
  up: [...V2_TABLES, ...CREATE_V2_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS hm_maintenance_schedules',
    'DROP TABLE IF EXISTS hm_settings',
    'DROP TABLE IF EXISTS hm_properties',
  ],
};

const HOMES_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add cost tracking, documents, contractors, insurance, inventory, appliances, and renovation projects',
  up: [...V3_TABLES, ...CREATE_V3_INDEXES],
  down: [
    'DROP TABLE IF EXISTS hm_project_photos',
    'DROP TABLE IF EXISTS hm_project_phases',
    'DROP TABLE IF EXISTS hm_projects',
    'DROP TABLE IF EXISTS hm_appliances',
    'DROP TABLE IF EXISTS hm_inventory_items',
    'DROP TABLE IF EXISTS hm_rooms',
    'DROP TABLE IF EXISTS hm_insurance_policies',
    'DROP TABLE IF EXISTS hm_contractor_services',
    'DROP TABLE IF EXISTS hm_contractors',
    'DROP TABLE IF EXISTS hm_documents',
    'DROP TABLE IF EXISTS hm_cost_entries',
  ],
};

export const HOMES_MODULE: ModuleDefinition = {
  id: 'homes',
  name: 'MyHomes',
  tagline: 'Real estate, reimagined',
  icon: '\u{1F3E0}',
  accentColor: '#F59E0B',
  tier: 'premium',
  storageType: 'drizzle',
  migrations: [HOMES_MIGRATION_V1, HOMES_MIGRATION_V2, HOMES_MIGRATION_V3],
  schemaVersion: 3,
  tablePrefix: 'hm_',
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'listings',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'tours',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'properties',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'maintenance_schedules',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'cost_entries',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'documents',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'projects',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'dashboard', label: 'Home', icon: 'home' },
      { key: 'properties', label: 'Properties', icon: 'building' },
      { key: 'maintenance', label: 'Maintenance', icon: 'tool' },
      { key: 'costs', label: 'Costs', icon: 'credit-card' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'property-detail', title: 'Property' },
      { name: 'add-property', title: 'Add Property' },
      { name: 'schedule-detail', title: 'Maintenance Task' },
      { name: 'add-schedule', title: 'Add Task' },
      { name: 'cost-list', title: 'Cost History' },
      { name: 'cost-detail', title: 'Cost Entry' },
      { name: 'add-cost', title: 'Log Cost' },
      { name: 'contractor-directory', title: 'Contractors' },
      { name: 'contractor-detail', title: 'Contractor' },
      { name: 'add-contractor', title: 'Add Contractor' },
      { name: 'insurance-policies', title: 'Insurance' },
      { name: 'insurance-detail', title: 'Policy' },
      { name: 'add-insurance', title: 'Add Policy' },
      { name: 'document-vault', title: 'Documents' },
      { name: 'document-detail', title: 'Document' },
      { name: 'add-document', title: 'Add Document' },
      { name: 'inventory-manager', title: 'Inventory' },
      { name: 'room-detail', title: 'Room' },
      { name: 'inventory-item-detail', title: 'Item' },
      { name: 'add-inventory-item', title: 'Add Item' },
      { name: 'appliance-registry', title: 'Appliances' },
      { name: 'appliance-detail', title: 'Appliance' },
      { name: 'add-appliance', title: 'Add Appliance' },
      { name: 'project-tracker', title: 'Projects' },
      { name: 'project-detail', title: 'Project' },
      { name: 'add-project', title: 'Add Project' },
      { name: 'settings', title: 'Settings' },
      { name: 'onboarding', title: 'Setup' },
    ],
  },
  requiresAuth: true,
  requiresNetwork: false,
  version: '0.3.0',
  crossModule: homesCrossModule,
};
