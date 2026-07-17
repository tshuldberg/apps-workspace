# Phase 6: MyCar Consolidation Plan

## Metadata
- **Project:** MyLife
- **Priority:** 01
- **Effort:** Large (1 session)
- **Dependencies:** Phase 4 complete (workouts archived)
- **Worktree:** No (direct on main)

## Context

MyCar is a vehicle maintenance tracking app with a full standalone implementation at `MyLife/MyCar/`. The hub module at `modules/car/` exists but has a simplified 4-table schema vs the standalone's 7-table schema. This consolidation ports the missing tables, CRUD, and pure-logic engines into the hub module.

**Standalone stack:** Turborepo, Expo (React Native), Next.js 15, SQLite (expo-sqlite / better-sqlite3), Zod, Vitest
**Hub pattern:** Same as Phases 1-4 (port packages/shared/ into modules/car/src/)

## Gap Analysis

### Already In Hub Module

**Schema (V1, 4 tables):**
- `cr_vehicles` -- Basic vehicle info
- `cr_maintenance` -- Maintenance records (simplified)
- `cr_fuel_logs` -- Fuel entries
- `cr_settings` -- Key-value settings

**Definition:** CAR_MODULE with id='car', prefix='cr_', tier='premium', 4 tabs + 3 screens

### Missing From Hub (Port From Standalone)

#### Missing Tables (Need V2 Migration)

| Table | Standalone Name | Hub Name | Key Columns |
|-------|----------------|----------|-------------|
| Reminders | `reminders` | `cr_reminders` | id, vehicle_id, service_type, mileage_interval, date_interval_days, last_odometer, last_date, next_odometer, next_date, status (active/snoozed/dismissed), snooze_until |
| Expenses | `expenses` | `cr_expenses` | id, vehicle_id, category (8 types), description, date, cost (cents), currency, is_recurring, recurrence |
| Documents | `documents` | `cr_documents` | id, vehicle_id, doc_type (8 types), label, local_path, expiry_date |

The existing `cr_maintenance` table also needs schema alignment with the standalone's `service_log` (it's missing: custom_type, location, cost, currency fields).

#### Missing Types (Add to types.ts)

**From standalone `packages/shared/src/models/`:**
- `ReminderStatusSchema` (active/snoozed/dismissed)
- `ReminderDueStateSchema` (upcoming/due_soon/overdue)
- `ReminderEntrySchema`, `CreateReminderInputSchema`, `UpdateReminderInputSchema`
- `ReminderWithStateSchema` (entry + computed state: dueState, milesUntilDue, daysUntilDue)
- `ExpenseCategorySchema` (insurance/registration/parking/tolls/car_wash/accessories/tickets/other)
- `ExpenseEntrySchema`, `CreateExpenseInputSchema`, `UpdateExpenseInputSchema`
- `DocumentTypeSchema` (insurance/registration/title/vin_sticker/inspection/warranty/receipt/other)
- `DocumentExpiryStateSchema` (none/valid/due_soon/expired)
- `DocumentEntrySchema`, `CreateDocumentInputSchema`, `UpdateDocumentInputSchema`
- `DocumentWithStateSchema` (entry + computed: expiryState, daysUntilExpiry)
- `AppSettingsSchema` (odometerUnit, fuelUnit, currency, appearance)

Also align existing Vehicle/ServiceLog/FuelLog types with standalone versions (standalone has more fields: trim, color, vin, licensePlate, photoPath, position).

#### Missing CRUD Functions

**Reminder CRUD:**
- `createReminder(db, input)`, `getRemindersByVehicle(db, vehicleId)`, `getReminderById(db, id)`
- `getRemindersWithState(db, vehicleId, currentOdometer, today?)` -- enriches with computed due state
- `updateReminder(db, id, input)`, `deleteReminder(db, id)`

**Expense CRUD:**
- `createExpense(db, input)`, `getExpenses(db, options?)`, `getExpensesByVehicle(db, vehicleId)`
- `getExpenseById(db, id)`, `updateExpense(db, id, input)`, `deleteExpense(db, id)`

**Document CRUD:**
- `createDocument(db, input)`, `getDocumentsByVehicle(db, vehicleId)`
- `getDocumentsWithState(db, vehicleId, today?)` -- enriches with expiry state
- `getDocumentById(db, id)`, `updateDocument(db, id, input)`, `deleteDocument(db, id)`

**Settings CRUD:**
- `getSettings(db)`, `updateSettings(db, input)`, `resetSettings(db)`

#### Missing Pure-Logic Engines

| File to Create | Source | Description |
|---------------|--------|-------------|
| `src/fuel/calculator.ts` | `packages/shared/src/fuel/calculator.ts` | `calculateFuelEconomy(currentFill, previousFill, partialFills, unitSystem)` -- MPG (US) or L/100km (metric) |
| `src/reminders/scheduler.ts` | `packages/shared/src/reminders/scheduler.ts` | `evaluateReminder(reminder, currentOdometer, today)` -- returns dueState (upcoming/due_soon/overdue), milesUntilDue, daysUntilDue |
| `src/expenses/summary.ts` | `packages/shared/src/expenses/summary.ts` | `buildExpenseLedger(serviceLogs, fuelLogs, expenses)`, `calculateExpenseSummary(rows)` -- aggregation by category, month, year, vehicle |
| `src/backup/snapshot.ts` | `packages/shared/src/backup/snapshot.ts` | `buildBackupSnapshot(db)`, `restoreBackupSnapshot(db, payload)` -- JSON backup/restore |

**Deliberately excluded:**
- Export engines (csv-expense.ts, pdf-service-history.ts) -- defer to future export feature
- Notification scheduling (reminder-notifications.ts) -- platform-specific, stays in apps/
- Share reports (share-reports.ts) -- platform-specific, stays in apps/

### Missing Tests

**Port from standalone (11 test files in packages/shared):**
1. `db/__tests__/vehicles.test.ts` -- Vehicle CRUD, setActive
2. `db/__tests__/service-logs.test.ts` -- Service log CRUD by vehicle
3. `db/__tests__/fuel-logs.test.ts` -- Fuel log CRUD, economy recomputation
4. `db/__tests__/reminders.test.ts` -- Reminder CRUD, state evaluation
5. `db/__tests__/expenses.test.ts` -- Expense CRUD, ledger
6. `db/__tests__/documents.test.ts` -- Document CRUD, expiry state
7. `db/__tests__/settings.test.ts` -- Settings get/update/reset
8. `fuel/__tests__/calculator.test.ts` -- MPG/L100km calculations
9. `reminders/__tests__/scheduler.test.ts` -- Reminder state logic
10. `expenses/__tests__/summary.test.ts` -- Ledger aggregation
11. `backup/__tests__/snapshot.test.ts` -- Backup/restore cycle

## Tasks

### Task 1: Expand Types + V2 Schema + CRUD
- Align existing types with standalone (add missing fields to Vehicle, ServiceLog, FuelLog)
- Add all missing types (Reminder, Expense, Document, Settings with all input/update variants)
- Add 3 new tables + indexes to `db/schema.ts`
- Align existing `cr_maintenance` table with standalone `service_log` schema
- Create V2 migration (new tables + ALTER TABLE for missing columns)
- Implement all missing CRUD functions
- Update barrel exports

### Task 2: Port Pure-Logic Engines
- Copy and adapt 4 engine files from standalone `packages/shared/src/`
- Only import path changes needed (pure functions, zero platform deps)
- Update barrel exports

### Task 3: Write Tests
- Port 11 test files from standalone
- Adapt to hub test pattern (`createModuleTestDatabase`)
- Target: ~100+ tests

### Task 4: Docs + Archive
- Update `modules/car/CLAUDE.md`
- Update `MyLife/CLAUDE.md` (Phase 6 Done, MyCar archived)
- Update parity scripts (mark workouts archived status)
- Archive standalone: `git submodule deinit -f MyCar && git rm --cached MyCar && mv MyCar archive/MyCar`
- Update `archive/README.md`, `.gitmodules`, parity scripts, passthrough matrix test

## Verification

```bash
pnpm typecheck           # Zero errors
pnpm test -- --filter @mylife/car  # All tests pass
pnpm check:parity        # Full suite passes
```

## Standalone Source Files (Key Paths)

```
MyCar/packages/shared/src/
  models/          -- 7 Zod schema files (vehicle, service-log, fuel-log, reminder, expense, document, settings)
  repositories/    -- 7 repository implementations (InMemory + SQLite)
  db/              -- schema.ts (7 tables), queries.ts, migrate.ts
  fuel/            -- calculator.ts
  reminders/       -- scheduler.ts
  expenses/        -- summary.ts
  backup/          -- snapshot.ts
  constants/       -- service-types.ts
  __tests__/       -- 11 test files
```
