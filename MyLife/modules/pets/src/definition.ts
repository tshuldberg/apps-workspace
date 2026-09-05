import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  BASE_INDEXES,
  BASE_TABLES,
  EXPANDED_CARE_INDEXES,
  EXPANDED_CARE_TABLES,
  FEEDING_SCHEDULE_ALTER_COLUMNS,
  FEEDING_ENHANCEMENT_TABLES,
  FEEDING_ENHANCEMENT_INDEXES,
  EXERCISE_LOG_ALTER_COLUMNS,
  V4_TABLES,
  V4_INDEXES,
} from './db/schema';

const PETS_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Create pet profiles, care history, medication reminders, feeding schedules, and expenses',
  up: [...BASE_TABLES, ...BASE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS pt_expenses',
    'DROP TABLE IF EXISTS pt_feeding_schedules',
    'DROP TABLE IF EXISTS pt_weight_entries',
    'DROP TABLE IF EXISTS pt_medication_logs',
    'DROP TABLE IF EXISTS pt_medications',
    'DROP TABLE IF EXISTS pt_vaccinations',
    'DROP TABLE IF EXISTS pt_vet_visits',
    'DROP TABLE IF EXISTS pt_pets',
  ],
};

const PETS_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'Add emergency contacts, activity logs, grooming tracking, training logs, and local pet photos',
  up: [
    ...EXPANDED_CARE_TABLES,
    ...EXPANDED_CARE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS pt_pet_photos',
    'DROP TABLE IF EXISTS pt_training_logs',
    'DROP TABLE IF EXISTS pt_grooming_records',
    'DROP TABLE IF EXISTS pt_exercise_logs',
    'DROP TABLE IF EXISTS pt_emergency_contacts',
  ],
};

const PETS_MIGRATION_V3: Migration = {
  version: 3,
  description:
    'Extend feeding schedules with portions/reminders, add feeding logs, dietary info, and food transitions',
  up: [
    ...FEEDING_SCHEDULE_ALTER_COLUMNS,
    ...FEEDING_ENHANCEMENT_TABLES,
    ...FEEDING_ENHANCEMENT_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS pt_food_transitions',
    'DROP TABLE IF EXISTS pt_dietary_info',
    'DROP TABLE IF EXISTS pt_feeding_logs',
  ],
};

const PETS_MIGRATION_V4: Migration = {
  version: 4,
  description:
    'Add exercise goals, insurance, expense budgets, grooming intervals, training commands, dismissed alerts',
  up: [
    ...EXERCISE_LOG_ALTER_COLUMNS,
    ...V4_TABLES,
    ...V4_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS pt_dismissed_alerts',
    'DROP TABLE IF EXISTS pt_training_commands',
    'DROP TABLE IF EXISTS pt_grooming_intervals',
    'DROP TABLE IF EXISTS pt_expense_budgets',
    'DROP TABLE IF EXISTS pt_insurance_claims',
    'DROP TABLE IF EXISTS pt_insurance_policies',
    'DROP TABLE IF EXISTS pt_exercise_goals',
  ],
};

export const PETS_MODULE: ModuleDefinition = {
  id: 'pets',
  name: 'MyPets',
  tagline: 'Pet health records and care tracker',
  icon: '🐾',
  accentColor: '#F59E0B',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [PETS_MIGRATION_V1, PETS_MIGRATION_V2, PETS_MIGRATION_V3, PETS_MIGRATION_V4],
  schemaVersion: 4,
  tablePrefix: 'pt_',
  syncPolicy: {
    defaultScope: 'shared_workspace',
    shareable: true,
    entityRules: [
      {
        tableName: 'pets',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'vet_visits',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'medications',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'vaccinations',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'feeding_schedules',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'pet_photos',
        defaultScope: 'shared_workspace',
        conflictStrategy: 'document_crdt',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'pets', label: 'Pets', icon: 'heart' },
      { key: 'health', label: 'Health', icon: 'activity' },
      { key: 'reminders', label: 'Reminders', icon: 'bell' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'pet-detail', title: 'Pet' },
      { name: 'add-pet', title: 'Add Pet' },
      { name: 'vet-visit', title: 'Vet Visit' },
      { name: 'vaccination', title: 'Vaccination' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
