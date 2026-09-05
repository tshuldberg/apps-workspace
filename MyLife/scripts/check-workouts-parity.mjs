#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

let failures = 0;

function fail(message) {
  console.error(`FAIL ${message}`);
  failures += 1;
}

function ok(message) {
  console.log(`OK   ${message}`);
}

function ensureFile(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail(`${path} is missing`);
    return '';
  }
  ok(`${path}`);
  return readFileSync(full, 'utf8');
}

function ensureAnyFile(paths, label) {
  for (const path of paths) {
    const full = resolve(root, path);
    if (!existsSync(full)) continue;
    ok(`${label} (${path})`);
    return readFileSync(full, 'utf8');
  }

  fail(`${label} is missing (checked: ${paths.join(', ')})`);
  return '';
}

// Standalone MyWorkouts has been archived (2026-03-08).
// This script now verifies hub-side artifacts only.

console.log('Checking workouts archive status...\n');

if (existsSync(resolve(root, 'MyWorkouts'))) {
  fail('MyWorkouts standalone directory should not exist at root (expected archive/MyWorkouts)');
}

if (!existsSync(resolve(root, 'archive/MyWorkouts'))) {
  fail('archive/MyWorkouts placeholder is missing');
} else {
  ok('archive/MyWorkouts placeholder present');
}

const hubFiles = [
  'modules/workouts/src/data/exercise-seed.json',
  'modules/workouts/src/db/crud.ts',
  'modules/workouts/src/db/schema.ts',
  'modules/workouts/src/definition.ts',
  'modules/workouts/src/index.ts',
  'modules/workouts/src/types.ts',
  'modules/workouts/src/workout/engine.ts',
  'modules/workouts/src/workout/oneRM.ts',
  'modules/workouts/src/workout/warmup.ts',
  'modules/workouts/src/workout/plates.ts',
  'modules/workouts/src/workout/plan-helpers.ts',
  'modules/workouts/src/body-map.ts',
  'modules/workouts/src/voice.ts',
  'modules/workouts/src/progress.ts',
  'apps/mobile/app/(workouts)/builder.tsx',
  'apps/mobile/app/(workouts)/exercise/[id].tsx',
  'apps/mobile/app/(workouts)/recordings.tsx',
  'apps/web/app/workouts/[...slug]/page.tsx',
];

console.log('\nChecking hub workouts module artifacts...\n');
for (const path of hubFiles) {
  ensureFile(path);
}
ensureAnyFile(
  [
    'apps/mobile/app/(workouts)/explore.tsx',
    'apps/mobile/app/(workouts)/(tabs)/explore.tsx',
  ],
  'workouts mobile explore route',
);
ensureAnyFile(
  [
    'apps/mobile/app/(workouts)/progress.tsx',
    'apps/mobile/app/(workouts)/(tabs)/progress.tsx',
  ],
  'workouts mobile progress route',
);
ensureAnyFile(
  [
    'apps/mobile/app/(workouts)/workouts.tsx',
    'apps/mobile/app/(workouts)/(tabs)/workouts.tsx',
  ],
  'workouts mobile workouts route',
);

const crudSource = ensureFile('modules/workouts/src/db/crud.ts');
const requiredCrudSymbols = [
  'seedWorkoutExerciseLibrary',
  'getWorkoutExercises',
  'getWorkoutExerciseById',
  'createWorkout',
  'updateWorkout',
  'getWorkouts',
  'createWorkoutSession',
  'createWorkoutFormRecording',
  'recordSetWeight',
  'getSetWeightsForSession',
  'record1RM',
  'get1RMHistory',
  'createBodyMeasurement',
  'getBodyMeasurements',
  'createWorkoutPlan',
  'getWorkoutPlans',
  'subscribeToPlan',
  'getActivePlanSubscription',
];

console.log('\nChecking CRUD symbols...\n');
for (const symbol of requiredCrudSymbols) {
  if (!crudSource.includes(`function ${symbol}`) && !crudSource.includes(`export function ${symbol}`)) {
    fail(`modules/workouts CRUD is missing ${symbol}`);
  } else {
    ok(`modules/workouts CRUD includes ${symbol}`);
  }
}

const schemaSource = ensureFile('modules/workouts/src/db/schema.ts');
const requiredTables = [
  'wk_exercises',
  'wk_workouts',
  'wk_workout_sessions',
  'wk_form_recordings',
  'wk_workout_set_weights',
  'wk_exercise_1rm_history',
  'wk_body_measurements',
  'wk_workout_plans',
  'wk_plan_subscriptions',
];

console.log('\nChecking schema tables...\n');
for (const tableName of requiredTables) {
  if (!schemaSource.includes(tableName)) {
    fail(`schema missing table ${tableName}`);
  } else {
    ok(`schema includes ${tableName}`);
  }
}

const indexSource = ensureFile('modules/workouts/src/index.ts');
const webFallbackSource = ensureFile('apps/web/app/workouts/[...slug]/page.tsx');
const requiredExports = [
  'createPlayerStatus',
  'reducePlayer',
  'calculateEpley1RM',
  'calculateWarmupSets',
  'calculatePlates',
  'parseVoiceCommand',
  'calculateStreaks',
  'buildHighlightData',
];

console.log('\nChecking barrel exports...\n');
for (const exp of requiredExports) {
  if (!indexSource.includes(exp)) {
    fail(`index.ts missing export ${exp}`);
  } else {
    ok(`index.ts exports ${exp}`);
  }
}

console.log('\nChecking archived web fallback...\n');
if (!webFallbackSource.includes('ModuleWebFallback')) {
  fail('apps/web/app/workouts/[...slug]/page.tsx must use ModuleWebFallback');
} else {
  ok('workouts web fallback uses ModuleWebFallback');
}

if (!webFallbackSource.includes('archived MyWorkouts web app') || !webFallbackSource.includes('folded into MyLife')) {
  fail('apps/web/app/workouts/[...slug]/page.tsx should explain archived standalone routing');
} else {
  ok('workouts web fallback explains archived standalone routing');
}

if (failures > 0) {
  console.error(`\ncheck-workouts-parity: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-workouts-parity: passed');
