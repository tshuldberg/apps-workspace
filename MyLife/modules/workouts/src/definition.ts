import type { Migration, ModuleDefinition } from '@mylife/module-registry';
import { workoutsCrossModule } from './cross-module';
import {
  CREATE_FORM_RECORDINGS,
  CREATE_WORKOUT_SESSIONS,
  CREATE_WORKOUTS,
  CREATE_EXERCISES,
  CREATE_WORKOUT_LOGS,
  CREATE_WORKOUT_PROGRAMS,
  CREATE_WORKOUT_SET_WEIGHTS,
  CREATE_EXERCISE_1RM_HISTORY,
  CREATE_BODY_MEASUREMENTS,
  CREATE_WORKOUT_PLANS,
  CREATE_PLAN_SUBSCRIPTIONS,
  CREATE_OVERLOAD_RULES,
  CREATE_GENERATION_HISTORY,
  CREATE_GPS_ROUTES,
  CREATE_GPS_POINTS,
  CREATE_PLATE_INVENTORIES,
  CREATE_PROGRESS_PHOTOS,
  CREATE_TRAINERS,
  CREATE_EXERCISE_VIDEOS,
} from './db/schema';

const WORKOUTS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial workouts schema — programs and workout logs',
  up: [
    CREATE_WORKOUT_LOGS,
    CREATE_WORKOUT_PROGRAMS,
    `CREATE INDEX IF NOT EXISTS wk_workout_logs_focus_idx ON wk_workout_logs(focus)`,
    `CREATE INDEX IF NOT EXISTS wk_workout_logs_completed_idx ON wk_workout_logs(completed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_programs_active_idx ON wk_programs(is_active)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_workout_logs',
    'DROP TABLE IF EXISTS wk_programs',
  ],
};

const WORKOUTS_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'Merge standalone MyWorkouts feature architecture into MyLife module schema (exercise library, workouts, sessions, recordings)',
  up: [
    CREATE_EXERCISES,
    CREATE_WORKOUTS,
    CREATE_WORKOUT_SESSIONS,
    CREATE_FORM_RECORDINGS,
    // V2 indexes only -- V3 table indexes are in WORKOUTS_MIGRATION_V3
    `CREATE INDEX IF NOT EXISTS wk_exercises_category_idx ON wk_exercises(category)`,
    `CREATE INDEX IF NOT EXISTS wk_exercises_difficulty_idx ON wk_exercises(difficulty)`,
    `CREATE INDEX IF NOT EXISTS wk_workouts_created_idx ON wk_workouts(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_workout_sessions_workout_idx ON wk_workout_sessions(workout_id)`,
    `CREATE INDEX IF NOT EXISTS wk_workout_sessions_completed_idx ON wk_workout_sessions(completed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_form_recordings_session_idx ON wk_form_recordings(session_id)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_form_recordings',
    'DROP TABLE IF EXISTS wk_workout_sessions',
    'DROP TABLE IF EXISTS wk_workouts',
    'DROP TABLE IF EXISTS wk_exercises',
  ],
};

const WORKOUTS_MIGRATION_V3: Migration = {
  version: 3,
  description:
    'Add strength tracking (set weights, 1RM history), body measurements, workout plans, and plan subscriptions',
  up: [
    CREATE_WORKOUT_SET_WEIGHTS,
    CREATE_EXERCISE_1RM_HISTORY,
    CREATE_BODY_MEASUREMENTS,
    CREATE_WORKOUT_PLANS,
    CREATE_PLAN_SUBSCRIPTIONS,
    `CREATE INDEX IF NOT EXISTS wk_set_weights_session_exercise_idx ON wk_workout_set_weights(session_id, exercise_id)`,
    `CREATE INDEX IF NOT EXISTS wk_1rm_history_exercise_idx ON wk_exercise_1rm_history(exercise_id)`,
    `CREATE INDEX IF NOT EXISTS wk_body_measurements_type_measured_idx ON wk_body_measurements(type, measured_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_workout_plans_created_idx ON wk_workout_plans(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_plan_subscriptions_plan_active_idx ON wk_plan_subscriptions(plan_id, is_active)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_plan_subscriptions',
    'DROP TABLE IF EXISTS wk_workout_plans',
    'DROP TABLE IF EXISTS wk_body_measurements',
    'DROP TABLE IF EXISTS wk_exercise_1rm_history',
    'DROP TABLE IF EXISTS wk_workout_set_weights',
  ],
};

const WORKOUTS_MIGRATION_V4: Migration = {
  version: 4,
  description:
    'Add progressive overload rules, AI generation history, GPS routes and points',
  up: [
    CREATE_OVERLOAD_RULES,
    CREATE_GENERATION_HISTORY,
    CREATE_GPS_ROUTES,
    CREATE_GPS_POINTS,
    `CREATE INDEX IF NOT EXISTS wk_overload_rules_exercise_idx ON wk_overload_rules(exercise_id)`,
    `CREATE INDEX IF NOT EXISTS wk_generation_history_created_idx ON wk_generation_history(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_generation_history_goal_idx ON wk_generation_history(goal)`,
    `CREATE INDEX IF NOT EXISTS wk_gps_routes_activity_idx ON wk_gps_routes(activity_type)`,
    `CREATE INDEX IF NOT EXISTS wk_gps_routes_started_idx ON wk_gps_routes(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_gps_points_route_idx ON wk_gps_points(route_id, timestamp_ms)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_gps_points',
    'DROP TABLE IF EXISTS wk_gps_routes',
    'DROP TABLE IF EXISTS wk_generation_history',
    'DROP TABLE IF EXISTS wk_overload_rules',
  ],
};

const WORKOUTS_MIGRATION_V5: Migration = {
  version: 5,
  description:
    'Add plate inventories and progress photos for B+C features',
  up: [
    CREATE_PLATE_INVENTORIES,
    CREATE_PROGRESS_PHOTOS,
    `CREATE INDEX IF NOT EXISTS wk_plate_inventories_default_idx ON wk_plate_inventories(is_default)`,
    `CREATE INDEX IF NOT EXISTS wk_progress_photos_taken_idx ON wk_progress_photos(taken_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wk_progress_photos_view_idx ON wk_progress_photos(view_type)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_progress_photos',
    'DROP TABLE IF EXISTS wk_plate_inventories',
  ],
};

const WORKOUTS_MIGRATION_V6: Migration = {
  version: 6,
  description:
    'Add trainer profiles and exercise demo videos for trainer video upload system',
  up: [
    CREATE_TRAINERS,
    CREATE_EXERCISE_VIDEOS,
    `CREATE INDEX IF NOT EXISTS wk_exercise_videos_exercise_idx ON wk_exercise_videos(exercise_id, sort_order)`,
    `CREATE INDEX IF NOT EXISTS wk_exercise_videos_trainer_idx ON wk_exercise_videos(trainer_id)`,
    `CREATE INDEX IF NOT EXISTS wk_exercise_videos_primary_idx ON wk_exercise_videos(exercise_id, is_primary)`,
    `CREATE INDEX IF NOT EXISTS wk_trainers_active_idx ON wk_trainers(is_active)`,
  ],
  down: [
    'DROP TABLE IF EXISTS wk_exercise_videos',
    'DROP TABLE IF EXISTS wk_trainers',
  ],
};

const WORKOUTS_MIGRATION_V7: Migration = {
  version: 7,
  description:
    'Add user-authored title and notes to workout sessions',
  up: [
    `ALTER TABLE wk_workout_sessions ADD COLUMN title TEXT`,
    `ALTER TABLE wk_workout_sessions ADD COLUMN notes TEXT`,
  ],
  down: [
    'ALTER TABLE wk_workout_sessions DROP COLUMN notes',
    'ALTER TABLE wk_workout_sessions DROP COLUMN title',
  ],
};

export const WORKOUTS_MODULE: ModuleDefinition = {
  id: 'workouts',
  name: 'MyWorkouts',
  tagline: 'Your gym data, your device, your gains',
  icon: '\u{1F4AA}',
  accentColor: '#EF4444',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [WORKOUTS_MIGRATION_V1, WORKOUTS_MIGRATION_V2, WORKOUTS_MIGRATION_V3, WORKOUTS_MIGRATION_V4, WORKOUTS_MIGRATION_V5, WORKOUTS_MIGRATION_V6, WORKOUTS_MIGRATION_V7],
  schemaVersion: 7,
  tablePrefix: 'wk_',
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'explore', label: 'Explore', icon: 'search' },
      { key: 'workouts', label: 'Workouts', icon: 'layers' },
      { key: 'progress', label: 'Progress', icon: 'trending-up' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
    screens: [
      { name: 'workout-detail', title: 'Workout' },
      { name: 'exercise-detail', title: 'Exercise' },
      { name: 'builder', title: 'Workout Builder' },
      { name: 'recordings', title: 'Form Recordings' },
      { name: 'generate', title: 'Generate Workout' },
      { name: 'recovery', title: 'Recovery Heatmap' },
      { name: 'gps-session', title: 'GPS Workout' },
      { name: 'route-detail', title: 'Route Detail' },
      { name: 'overload-settings', title: 'Progressive Overload' },
      { name: 'plate-calc', title: 'Plate Calculator' },
      { name: 'photos', title: 'Progress Photos' },
      { name: 'photo-compare', title: 'Photo Comparison' },
      { name: 'share-card', title: 'Share Workout' },
      { name: 'exercise-demo', title: 'Exercise Demo' },
      { name: 'social', title: 'Social Feed' },
      { name: 'social-profile', title: 'User Profile' },
      { name: 'insights', title: 'Workout Insights' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.5.0',
  crossModule: workoutsCrossModule,
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    isSensitive: true,
    entityRules: [
      { tableName: 'exercises', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'workouts', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'workout_sessions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'form_recordings', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'workout_logs', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'programs', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'workout_set_weights', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'exercise_1rm_history', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'body_measurements', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'workout_plans', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'plan_subscriptions', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'overload_rules', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'generation_history', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'gps_routes', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'gps_points', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'plate_inventories', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'progress_photos', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'trainers', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'exercise_videos', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
    ],
  },
};
