import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import {
  ALL_TABLES,
  CREATE_INDEXES,
  SEED_SETTINGS,
  ALTER_HABITS_V2,
  ALL_V2_TABLES,
  V2_INDEXES,
  ALL_V3_TABLES,
  V3_INDEXES,
  ALL_V4_TABLES,
  V4_INDEXES,
  ALL_V5_TABLES,
  V5_INDEXES,
  ALL_V6_TABLES,
  ALTER_HABITS_V6,
  SEED_AREAS,
  V6_INDEXES,
  ALL_V7_TABLES,
  ALTER_HABITS_V7,
  MIGRATE_REMINDER_DATA,
  V7_INDEXES,
  DROP_DEPRECATED_CYCLE_TABLES,
} from './db/schema';
import { habitsCrossModule } from './cross-module';


const HABITS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial habits schema -- habits, completions, settings + indexes + seeds',
  up: [
    ...ALL_TABLES,
    ...CREATE_INDEXES,
    ...SEED_SETTINGS,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_completions',
    'DROP TABLE IF EXISTS hb_settings',
    'DROP TABLE IF EXISTS hb_habits',
  ],
};

const HABITS_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'V2 -- habit types, timed sessions, measurements (cycle tracking removed; use @mylife/cycle instead -- see V8)',
  up: [
    ...ALTER_HABITS_V2,
    ...ALL_V2_TABLES,
    ...V2_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_measurements',
    'DROP TABLE IF EXISTS hb_timed_sessions',
    // Note: SQLite does not support DROP COLUMN, so V2 ALTER columns
    // remain in the table on rollback. This is acceptable for local-only data.
  ],
};

const HABITS_MIGRATION_V3: Migration = {
  version: 3,
  description: 'V3 -- sobriety clock, craving log, milestones, focus timer, HealthKit auto-tracking',
  up: [
    ...ALL_V3_TABLES,
    ...V3_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_healthkit_links',
    'DROP TABLE IF EXISTS hb_focus_sessions',
    'DROP TABLE IF EXISTS hb_milestones',
    'DROP TABLE IF EXISTS hb_craving_triggers',
    'DROP TABLE IF EXISTS hb_cravings',
    'DROP TABLE IF EXISTS hb_sobriety_pledges',
    'DROP TABLE IF EXISTS hb_sobriety_profiles',
  ],
};

const HABITS_MIGRATION_V4: Migration = {
  version: 4,
  description: 'V4 -- challenges/programs, badges, time tracking, RPG gamification, pet companion, location reminders',
  up: [
    ...ALL_V4_TABLES,
    ...V4_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_location_reminders',
    'DROP TABLE IF EXISTS hb_pet_state',
    'DROP TABLE IF EXISTS hb_xp_transactions',
    'DROP TABLE IF EXISTS hb_player_profile',
    'DROP TABLE IF EXISTS hb_projects',
    'DROP TABLE IF EXISTS hb_badges',
    'DROP TABLE IF EXISTS hb_program_enrollments',
    'DROP TABLE IF EXISTS hb_programs',
  ],
};

const HABITS_MIGRATION_V5: Migration = {
  version: 5,
  description: 'V5 -- habit stacking, streak freeze, action items (sub-tasks)',
  up: [
    ...ALL_V5_TABLES,
    ...V5_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_action_completions',
    'DROP TABLE IF EXISTS hb_action_items',
    'DROP TABLE IF EXISTS hb_streak_freezes',
    'DROP TABLE IF EXISTS hb_habit_links',
  ],
};

const HABITS_MIGRATION_V6: Migration = {
  version: 6,
  description: 'V6 -- area/category grouping for habits',
  up: [
    ...ALL_V6_TABLES,
    ...ALTER_HABITS_V6,
    ...SEED_AREAS,
    ...V6_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_areas',
    // SQLite does not support DROP COLUMN; area_id remains on rollback
  ],
};

const HABITS_MIGRATION_V7: Migration = {
  version: 7,
  description: 'V7 -- multiple reminders, habit start/end dates',
  up: [
    ...ALL_V7_TABLES,
    ...ALTER_HABITS_V7,
    MIGRATE_REMINDER_DATA,
    ...V7_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS hb_reminders',
  ],
};

const HABITS_MIGRATION_V8: Migration = {
  version: 8,
  description:
    'V8 -- drop deprecated cycle tracking tables (hb_periods, hb_period_symptoms, hb_predictions, hb_cycle_settings). Cycle tracking moved to @mylife/cycle.',
  up: [
    ...DROP_DEPRECATED_CYCLE_TABLES,
  ],
  down: [
    // Irreversible: the old cycle tables are not recreated on rollback.
    // Existing data in those tables is also discarded when V8 runs.
  ],
};

export const HABITS_MODULE: ModuleDefinition = {
  id: 'habits',
  name: 'MyHabits',
  tagline: 'Your complete habit system',
  icon: '\u{2705}',
  accentColor: '#8B5CF6',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [HABITS_MIGRATION_V1, HABITS_MIGRATION_V2, HABITS_MIGRATION_V3, HABITS_MIGRATION_V4, HABITS_MIGRATION_V5, HABITS_MIGRATION_V6, HABITS_MIGRATION_V7, HABITS_MIGRATION_V8],
  schemaVersion: 8,
  tablePrefix: 'hb_',
  navigation: {
    tabs: [
      { key: 'today', label: 'Today', icon: 'check-circle' },
      { key: 'habits', label: 'Habits', icon: 'list' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'habit-detail', title: 'Habit' },
      { name: 'add-habit', title: 'New Habit' },
      { name: 'streak-detail', title: 'Streak' },
      { name: 'sobriety-clock', title: 'Sobriety Clock' },
      { name: 'log-craving', title: 'Log Craving' },
      { name: 'craving-insights', title: 'Craving Insights' },
      { name: 'focus-timer', title: 'Focus Timer' },
      { name: 'programs', title: 'Programs' },
      { name: 'program-detail', title: 'Program' },
      { name: 'badge-gallery', title: 'Badges' },
      { name: 'time-reports', title: 'Time Reports' },
      { name: 'pet-detail', title: 'Pet' },
      { name: 'habit-stack', title: 'Habit Stack' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.5.0',
  crossModule: habitsCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      { tableName: 'habits', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'completions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'timed_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'measurements', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'sobriety_profiles', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'sobriety_pledges', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'cravings', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'craving_triggers', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'milestones', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'focus_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'healthkit_links', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'programs', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'program_enrollments', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'badges', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'projects', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'player_profile', defaultScope: 'personal_replica', conflictStrategy: 'counter' },
      { tableName: 'xp_transactions', defaultScope: 'personal_replica', conflictStrategy: 'counter' },
      { tableName: 'pet_state', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'location_reminders', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'habit_links', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'streak_freezes', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'action_items', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'action_completions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'areas', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'reminders', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
};
