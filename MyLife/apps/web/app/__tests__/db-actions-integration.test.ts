/**
 * Database integration tests for MyLife module CRUD operations.
 *
 * Each describe block creates a fresh in-memory SQLite database,
 * initializes the hub schema, runs the module's migrations, and then
 * exercises the module's exported CRUD functions against real SQL.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createHubTestDatabase,
  createModuleTestDatabase,
  enableModule,
  disableModule,
  isModuleEnabled,
  getEnabledModules,
  setHubMode,
  getHubMode,
  incrementAggregateEventCounter,
  getAggregateEventCounter,
  listAggregateEventCounters,
} from '@mylife/db';

// ─── Module imports ──────────────────────────────────────────────────────────

import { RECIPES_MODULE } from '@mylife/bestchef';
import {
  createRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  countRecipes,
  addIngredient,
  getIngredients,
  deleteIngredient,
  addTag,
  getTags,
  deleteTag,
} from '@mylife/bestchef';

import { CAR_MODULE } from '@mylife/car';
import {
  createVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  countVehicles,
  createMaintenance,
  getMaintenanceByVehicle,
  createFuelLog,
  getFuelLogsByVehicle,
} from '@mylife/car';

import { HABITS_MODULE } from '@mylife/habits';
import {
  createHabit,
  getHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  recordCompletion,
  getCompletionsForDate,
  getStreaks,
} from '@mylife/habits';

import { MEDS_MODULE } from '@mylife/meds';
import {
  createMedication,
  getMedications,
  getMedicationById,
  updateMedication,
  deleteMedication,
  recordDose,
  getDosesForDate,
  getAdherenceRate,
} from '@mylife/meds';

import { BUDGET_MODULE } from '@mylife/budget';
import {
  createEnvelope,
  listEnvelopes,
  updateEnvelope,
  createAccount,
  listAccounts,
  createTransaction,
  listTransactions,
} from '@mylife/budget';

// ═══════════════════════════════════════════════════════════════════════════════
// A. Recipes module DB operations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module: Recipes', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('creates a recipe and retrieves it by id', () => {
    const recipe = createRecipe(db, 'rc-1', {
      title: 'Pasta Carbonara',
      servings: 4,
      difficulty: 'medium',
      prep_time_mins: 15,
      cook_time_mins: 20,
      total_time_mins: 35,
    });

    expect(recipe.id).toBe('rc-1');
    expect(recipe.title).toBe('Pasta Carbonara');
    expect(recipe.servings).toBe(4);
    expect(recipe.difficulty).toBe('medium');

    const fetched = getRecipeById(db, 'rc-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe('Pasta Carbonara');
    expect(fetched!.prep_time_mins).toBe(15);
    expect(fetched!.cook_time_mins).toBe(20);
  });

  it('lists recipes with search filter', () => {
    createRecipe(db, 'rc-2', { title: 'Chicken Tikka Masala' });
    createRecipe(db, 'rc-3', { title: 'Beef Stew' });

    const all = getRecipes(db);
    expect(all).toHaveLength(2);

    const filtered = getRecipes(db, { search: 'Chicken' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Chicken Tikka Masala');
  });

  it('updates recipe fields', () => {
    createRecipe(db, 'rc-1', {
      title: 'Pasta Carbonara',
      servings: 4,
      difficulty: 'medium',
    });
    updateRecipe(db, 'rc-1', { title: 'Spaghetti Carbonara', rating: 5 });

    const updated = getRecipeById(db, 'rc-1');
    expect(updated!.title).toBe('Spaghetti Carbonara');
    expect(updated!.rating).toBe(5);
    // Fields not updated should remain unchanged
    expect(updated!.servings).toBe(4);
  });

  it('deletes a recipe', () => {
    createRecipe(db, 'rc-3', { title: 'Delete Me' });
    const result = deleteRecipe(db, 'rc-3');
    expect(result).toBe(true);

    const fetched = getRecipeById(db, 'rc-3');
    expect(fetched).toBeNull();
  });

  it('manages ingredients (add, list, delete)', () => {
    createRecipe(db, 'rc-1', { title: 'Base Recipe' });
    const ingredient = addIngredient(db, 'ing-1', {
      recipe_id: 'rc-1',
      name: 'Spaghetti',
      quantity: '400',
      unit: 'g',
      sort_order: 0,
    });

    expect(ingredient.name).toBe('Spaghetti');

    addIngredient(db, 'ing-2', {
      recipe_id: 'rc-1',
      name: 'Guanciale',
      quantity: '200',
      unit: 'g',
      sort_order: 1,
    });

    const ingredients = getIngredients(db, 'rc-1');
    expect(ingredients.length).toBe(2);
    expect(ingredients[0].name).toBe('Spaghetti');
    expect(ingredients[1].name).toBe('Guanciale');

    deleteIngredient(db, 'ing-1');
    const remaining = getIngredients(db, 'rc-1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('Guanciale');
  });

  it('manages tags (add, list, delete)', () => {
    createRecipe(db, 'rc-1', { title: 'Tagged Recipe' });
    const tag = addTag(db, 'tag-1', 'rc-1', 'Italian');
    expect(tag.tag).toBe('Italian');

    addTag(db, 'tag-2', 'rc-1', 'Quick');

    const tags = getTags(db, 'rc-1');
    expect(tags.length).toBe(2);
    expect(tags.map((t) => t.tag).sort()).toEqual(['Italian', 'Quick']);

    deleteTag(db, 'tag-1');
    const remaining = getTags(db, 'rc-1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].tag).toBe('Quick');
  });

  it('counts recipes with and without filters', () => {
    createRecipe(db, 'rc-1', { title: 'Pasta Carbonara' });
    createRecipe(db, 'rc-2', { title: 'Chicken Tikka Masala' });
    const total = countRecipes(db);
    expect(total).toBe(2);

    const chickenCount = countRecipes(db, { search: 'Chicken' });
    expect(chickenCount).toBe(1);

    const noMatchCount = countRecipes(db, { search: 'ZZZZZ' });
    expect(noMatchCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. Car module DB operations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module: Car', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('car', CAR_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('creates a vehicle and retrieves it', () => {
    createVehicle(db, 'v-1', {
      name: 'Daily Driver',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
    });

    const vehicle = getVehicleById(db, 'v-1');
    expect(vehicle).not.toBeNull();
    expect(vehicle!.name).toBe('Daily Driver');
    expect(vehicle!.make).toBe('Toyota');
    expect(vehicle!.model).toBe('Camry');
    expect(vehicle!.year).toBe(2022);
    expect(vehicle!.odometer).toBe(0);
  });

  it('updates vehicle fields (odometer, name)', () => {
    createVehicle(db, 'v-1', {
      name: 'Daily Driver',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
    });
    updateVehicle(db, 'v-1', { odometer: 35000, name: 'My Camry' });

    const updated = getVehicleById(db, 'v-1');
    expect(updated!.name).toBe('My Camry');
    expect(updated!.odometer).toBe(35000);
    // Make should be unchanged
    expect(updated!.make).toBe('Toyota');
  });

  it('deletes a vehicle', () => {
    createVehicle(db, 'v-del', {
      name: 'Temp Car',
      make: 'Honda',
      model: 'Civic',
      year: 2020,
    });

    expect(getVehicleById(db, 'v-del')).not.toBeNull();
    deleteVehicle(db, 'v-del');
    expect(getVehicleById(db, 'v-del')).toBeNull();
  });

  it('creates maintenance records for a vehicle', () => {
    createVehicle(db, 'v-1', {
      name: 'Daily Driver',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
    });
    createMaintenance(db, 'm-1', 'v-1', {
      type: 'oil_change',
      performedAt: '2026-01-15',
      costCents: 6500,
      odometerAt: 34000,
    });

    createMaintenance(db, 'm-2', 'v-1', {
      type: 'tire_rotation',
      performedAt: '2026-02-10',
    });

    const records = getMaintenanceByVehicle(db, 'v-1');
    expect(records.length).toBe(2);
    // Ordered by performed_at DESC
    expect(records[0].type).toBe('tire_rotation');
    expect(records[1].type).toBe('oil_change');
    expect(records[1].costCents).toBe(6500);
  });

  it('creates fuel logs for a vehicle', () => {
    createVehicle(db, 'v-1', {
      name: 'Daily Driver',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
    });
    createFuelLog(db, 'f-1', 'v-1', {
      gallons: 12.5,
      costCents: 4375,
      odometerAt: 35200,
      loggedAt: '2026-02-20T10:00:00.000Z',
      station: 'Costco',
    });

    const logs = getFuelLogsByVehicle(db, 'v-1');
    expect(logs.length).toBe(1);
    expect(logs[0].gallons).toBe(12.5);
    expect(logs[0].costCents).toBe(4375);
    expect(logs[0].station).toBe('Costco');
  });

  it('counts vehicles', () => {
    createVehicle(db, 'v-1', {
      name: 'Daily Driver',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
    });
    const count = countVehicles(db);
    expect(count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. Habits module DB operations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module: Habits', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('creates a habit and retrieves it', () => {
    createHabit(db, 'h-1', { name: 'Morning Meditation', frequency: 'daily' });

    const habit = getHabitById(db, 'h-1');
    expect(habit).not.toBeNull();
    expect(habit!.name).toBe('Morning Meditation');
    expect(habit!.frequency).toBe('daily');
    expect(habit!.targetCount).toBe(1);
    expect(habit!.isArchived).toBe(false);
  });

  it('updates habit fields', () => {
    createHabit(db, 'h-1', { name: 'Morning Meditation', frequency: 'daily' });
    updateHabit(db, 'h-1', { name: 'Meditation', targetCount: 2 });

    const updated = getHabitById(db, 'h-1');
    expect(updated!.name).toBe('Meditation');
    expect(updated!.targetCount).toBe(2);
    expect(updated!.frequency).toBe('daily');
  });

  it('deletes a habit', () => {
    createHabit(db, 'h-del', { name: 'Temp Habit' });
    expect(getHabitById(db, 'h-del')).not.toBeNull();

    deleteHabit(db, 'h-del');
    expect(getHabitById(db, 'h-del')).toBeNull();
  });

  it('records completions and retrieves by date', () => {
    createHabit(db, 'h-1', { name: 'Morning Meditation', frequency: 'daily' });
    const today = new Date().toISOString().slice(0, 10);

    recordCompletion(db, 'c-1', 'h-1', `${today}T08:00:00.000Z`);
    recordCompletion(db, 'c-2', 'h-1', `${today}T20:00:00.000Z`);

    const completions = getCompletionsForDate(db, today);
    expect(completions.length).toBe(2);
    expect(completions[0].habitId).toBe('h-1');
  });

  it('calculates streaks', () => {
    // Create a habit with consecutive day completions
    createHabit(db, 'h-streak', { name: 'Streak Test' });

    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      recordCompletion(db, `cs-${i}`, 'h-streak', `${dateStr}T12:00:00.000Z`);
    }

    const streaks = getStreaks(db, 'h-streak');
    expect(streaks.currentStreak).toBeGreaterThanOrEqual(1);
    expect(streaks.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it('filters habits by archived status', () => {
    createHabit(db, 'h-active', { name: 'Active Habit' });
    createHabit(db, 'h-archived', { name: 'Archived Habit' });
    updateHabit(db, 'h-archived', { isArchived: true });

    const active = getHabits(db, { isArchived: false });
    const archived = getHabits(db, { isArchived: true });

    expect(active.every((h) => !h.isArchived)).toBe(true);
    expect(archived.every((h) => h.isArchived)).toBe(true);
    expect(archived.some((h) => h.name === 'Archived Habit')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Meds module DB operations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module: Meds', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('creates a medication and retrieves it', () => {
    createMedication(db, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'twice_daily',
    });

    const med = getMedicationById(db, 'med-1');
    expect(med).not.toBeNull();
    expect(med!.name).toBe('Metformin');
    expect(med!.dosage).toBe('500');
    expect(med!.unit).toBe('mg');
    expect(med!.frequency).toBe('twice_daily');
    expect(med!.isActive).toBe(true);
  });

  it('updates medication fields', () => {
    createMedication(db, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'twice_daily',
    });
    updateMedication(db, 'med-1', { dosage: '1000', frequency: 'daily' });

    const updated = getMedicationById(db, 'med-1');
    expect(updated!.dosage).toBe('1000');
    expect(updated!.frequency).toBe('daily');
    // Name should be unchanged
    expect(updated!.name).toBe('Metformin');
  });

  it('deletes a medication', () => {
    createMedication(db, 'med-del', { name: 'Temp Med' });
    expect(getMedicationById(db, 'med-del')).not.toBeNull();

    deleteMedication(db, 'med-del');
    expect(getMedicationById(db, 'med-del')).toBeNull();
  });

  it('records doses (taken and skipped)', () => {
    createMedication(db, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'twice_daily',
    });
    const today = new Date().toISOString().slice(0, 10);

    recordDose(db, 'dose-1', 'med-1', `${today}T08:00:00.000Z`, false);
    recordDose(db, 'dose-2', 'med-1', `${today}T20:00:00.000Z`, true);

    const doses = getDosesForDate(db, today);
    expect(doses.length).toBe(2);

    const taken = doses.find((d) => d.id === 'dose-1');
    const skipped = doses.find((d) => d.id === 'dose-2');
    expect(taken!.skipped).toBe(false);
    expect(skipped!.skipped).toBe(true);
  });

  it('retrieves doses for a specific date', () => {
    createMedication(db, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'twice_daily',
    });
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    recordDose(db, 'dose-y1', 'med-1', `${yesterday}T09:00:00.000Z`, false);

    const yesterdayDoses = getDosesForDate(db, yesterday);
    expect(yesterdayDoses.length).toBe(1);
    expect(yesterdayDoses[0].id).toBe('dose-y1');

    // Should not return today's doses
    const today = new Date().toISOString().slice(0, 10);
    const todayDoses = getDosesForDate(db, today);
    const yesterdayIdsInToday = todayDoses.filter((d) => d.id === 'dose-y1');
    expect(yesterdayIdsInToday.length).toBe(0);
  });

  it('calculates adherence rate', () => {
    createMedication(db, 'med-1', {
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'twice_daily',
    });
    recordDose(db, 'dose-1', 'med-1', '2026-02-20T08:00:00.000Z', false);
    recordDose(db, 'dose-2', 'med-1', '2026-02-20T20:00:00.000Z', true);
    recordDose(db, 'dose-y1', 'med-1', '2026-02-19T09:00:00.000Z', false);

    const rate = getAdherenceRate(db, 'med-1', '2026-02-01', '2026-03-01');
    // 2 taken out of 3 total = 67%
    expect(rate).toBe(67);
  });

  it('filters medications by active status', () => {
    createMedication(db, 'med-inactive', { name: 'Discontinued Med' });
    updateMedication(db, 'med-inactive', { isActive: false });

    const active = getMedications(db, { isActive: true });
    const inactive = getMedications(db, { isActive: false });

    expect(active.every((m) => m.isActive)).toBe(true);
    expect(inactive.every((m) => !m.isActive)).toBe(true);
    expect(inactive.some((m) => m.name === 'Discontinued Med')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. Budget module DB operations
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module: Budget', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('budget', BUDGET_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('creates and lists envelopes', () => {
    const envelope = createEnvelope(db, 'env-test', {
      name: 'Test Groceries',
      monthly_budget: 50000, // $500.00 in cents
    });

    expect(envelope.id).toBe('env-test');
    expect(envelope.name).toBe('Test Groceries');
    expect(envelope.monthly_budget).toBe(50000);

    // listEnvelopes excludes archived by default
    const envelopes = listEnvelopes(db);
    const found = envelopes.find((e) => e.id === 'env-test');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test Groceries');
  });

  it('archives and restores envelopes', () => {
    createEnvelope(db, 'env-archive', { name: 'Archive Test' });

    // Archive it
    updateEnvelope(db, 'env-archive', { archived: 1 });
    const activeEnvelopes = listEnvelopes(db, false);
    expect(activeEnvelopes.find((e) => e.id === 'env-archive')).toBeUndefined();

    // Include archived
    const allEnvelopes = listEnvelopes(db, true);
    const archived = allEnvelopes.find((e) => e.id === 'env-archive');
    expect(archived).toBeDefined();
    expect(archived!.archived).toBe(1);

    // Restore it
    updateEnvelope(db, 'env-archive', { archived: 0 });
    const restoredList = listEnvelopes(db, false);
    expect(restoredList.find((e) => e.id === 'env-archive')).toBeDefined();
  });

  it('creates and lists accounts', () => {
    const account = createAccount(db, 'acct-test', {
      name: 'Test Checking',
      type: 'checking',
      current_balance: 100000,
    });

    expect(account.id).toBe('acct-test');
    expect(account.name).toBe('Test Checking');
    expect(account.type).toBe('checking');
    expect(account.current_balance).toBe(100000);

    const accounts = listAccounts(db);
    const found = accounts.find((a) => a.id === 'acct-test');
    expect(found).toBeDefined();
  });

  it('creates and lists transactions with filters', () => {
    createEnvelope(db, 'env-test', { name: 'Test Envelope' });
    createAccount(db, 'acct-test', {
      name: 'Test Checking',
      type: 'checking',
      current_balance: 100000,
    });

    const tx = createTransaction(db, 'tx-1', {
      envelope_id: 'env-test',
      account_id: 'acct-test',
      amount: 4235,
      direction: 'outflow',
      merchant: 'Whole Foods',
      occurred_on: '2026-02-20',
    });

    expect(tx.id).toBe('tx-1');
    expect(tx.amount).toBe(4235);
    expect(tx.direction).toBe('outflow');

    createTransaction(db, 'tx-2', {
      amount: 200000,
      direction: 'inflow',
      occurred_on: '2026-02-21',
      account_id: 'acct-test',
    });

    // All transactions
    const allTxns = listTransactions(db);
    expect(allTxns).toHaveLength(2);

    // Filter by direction
    const outflows = listTransactions(db, { direction: 'outflow' });
    expect(outflows.every((t) => t.direction === 'outflow')).toBe(true);
    expect(outflows.some((t) => t.id === 'tx-1')).toBe(true);

    const inflows = listTransactions(db, { direction: 'inflow' });
    expect(inflows.every((t) => t.direction === 'inflow')).toBe(true);
    expect(inflows.some((t) => t.id === 'tx-2')).toBe(true);

    // Filter by envelope
    const envelopeTxns = listTransactions(db, { envelope_id: 'env-test' });
    expect(envelopeTxns.every((t) => t.envelope_id === 'env-test')).toBe(true);

    // Filter by account
    const accountTxns = listTransactions(db, { account_id: 'acct-test' });
    expect(accountTxns).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. Hub operations (enable/disable modules, mode config, event counters)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hub operations', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => closeDb());

  it('enables and disables modules', () => {
    enableModule(db, 'recipes');
    enableModule(db, 'books');
    enableModule(db, 'car');

    expect(isModuleEnabled(db, 'recipes')).toBe(true);
    expect(isModuleEnabled(db, 'books')).toBe(true);
    expect(isModuleEnabled(db, 'car')).toBe(true);
    expect(isModuleEnabled(db, 'meds')).toBe(false);

    const enabled = getEnabledModules(db);
    expect(enabled.length).toBe(3);
    expect(enabled.map((m) => m.module_id).sort()).toEqual(['books', 'car', 'recipes']);

    disableModule(db, 'car');
    expect(isModuleEnabled(db, 'car')).toBe(false);

    const remaining = getEnabledModules(db);
    expect(remaining.length).toBe(2);

    // Re-enabling is idempotent (INSERT OR IGNORE)
    enableModule(db, 'recipes');
    expect(getEnabledModules(db).length).toBe(2);
  });

  it('persists hub mode selection', () => {
    // Initially no mode is set
    expect(getHubMode(db)).toBeUndefined();

    setHubMode(db, 'local_only');
    const mode = getHubMode(db);
    expect(mode).toBeDefined();
    expect(mode!.mode).toBe('local_only');
    expect(mode!.server_url).toBeNull();

    // Update to hosted with a server URL
    setHubMode(db, 'hosted', 'https://api.mylife.app');
    const hosted = getHubMode(db);
    expect(hosted!.mode).toBe('hosted');
    expect(hosted!.server_url).toBe('https://api.mylife.app');

    // Switch to self_host
    setHubMode(db, 'self_host', 'https://my-server.example.com');
    const selfHost = getHubMode(db);
    expect(selfHost!.mode).toBe('self_host');
    expect(selfHost!.server_url).toBe('https://my-server.example.com');
  });

  it('tracks aggregate event counters', () => {
    const bucket = '2026-02-24';

    incrementAggregateEventCounter(db, 'module.enabled', bucket, 1);
    incrementAggregateEventCounter(db, 'module.enabled', bucket, 1);
    incrementAggregateEventCounter(db, 'module.enabled', bucket, 3);
    incrementAggregateEventCounter(db, 'app.launched', bucket, 1);

    const enabledCounter = getAggregateEventCounter(db, 'module.enabled', bucket);
    expect(enabledCounter).toBeDefined();
    expect(enabledCounter!.count).toBe(5);

    const launchedCounter = getAggregateEventCounter(db, 'app.launched', bucket);
    expect(launchedCounter!.count).toBe(1);

    // Non-existent counter returns undefined
    const missing = getAggregateEventCounter(db, 'nonexistent', bucket);
    expect(missing).toBeUndefined();

    // List with prefix filter
    const moduleCounters = listAggregateEventCounters(db, {
      eventKeyPrefix: 'module.',
      bucketDate: bucket,
    });
    expect(moduleCounters.length).toBe(1);
    expect(moduleCounters[0].event_key).toBe('module.enabled');
  });
});
