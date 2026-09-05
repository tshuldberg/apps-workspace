# MyPets — Module Audit

**ID:** pets | **Prefix:** pt_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Pet health records and care tracker

## User Value
- Multi-pet profiles across 9 species with breed, sex, sterilization, microchip
- Vet visits + vaccinations with next-due reminders (core vaccine schedules seeded)
- Medications with 6 frequency types and skipped-dose tracking
- Weight entries with trend analysis (stable/gaining/losing, 2% threshold) and body condition score
- Expense tracking with 8 categories + monthly cost + lifetime cost-of-ownership

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Pet CRUD (archive filter, 9 species) | src/db/crud.ts | shipped |
| Vet visit logging (diagnosis, treatment, cost) | src/db/crud.ts | shipped |
| Vaccinations + due reminders (core schedules: dog Rabies/DHPP/Bordetella, cat Rabies/FVRCP/FeLV) | src/db/crud.ts, types.ts (CORE_VACCINE_SCHEDULES) | shipped |
| Medication CRUD + 6 frequency types | src/engine/reminders.ts | shipped |
| Medication logs (given/skipped) | src/db/crud.ts | shipped |
| Weight entries with trend (engine/weight.ts) | src/engine/weight.ts | shipped |
| Body condition score 1-9 | schema (pt_weight_entries) | shipped |
| Feeding schedules (label, food, amount, time) | src/db/crud.ts | shipped |
| Expense tracking (8 categories, cents) | src/db/crud.ts | shipped |
| Pet age calculation from birth date | src/engine/weight.ts | shipped |
| Ownership cost + avg monthly cost | src/engine/weight.ts | shipped |
| Reminder status (current/due_soon/overdue) | src/engine/reminders.ts | shipped |
| Next medication due-at (6 frequencies) | src/engine/reminders.ts | shipped |
| Emergency contacts (V2) | schema V2 (pt_emergency_contacts) | shipped |
| Exercise logs + goals (V2 + V4) | schema V2, V4 | shipped |
| Grooming records + intervals (V2 + V4) | schema V2, V4 | shipped |
| Training logs + commands (V2 + V4) | schema V2, V4 | shipped |
| Pet photos (local) | schema V2 | shipped |
| Feeding logs + dietary info + food transitions | schema V3 | shipped |
| Insurance policies + claims (V4) | schema V4 | shipped |
| Expense budgets (V4) | schema V4 | shipped |
| Dismissed alerts (V4) | schema V4 | shipped |
| Dashboard per-pet with isolation | src/db/crud.ts | shipped |
| Integrations, UI barrel | src/integrations, src/ui | shipped |

## Data Model
Prefix `pt_`, schema v4. V1 tables: pt_pets, pt_vet_visits, pt_vaccinations, pt_medications, pt_medication_logs, pt_weight_entries, pt_feeding_schedules, pt_expenses. V2: pt_emergency_contacts, pt_exercise_logs, pt_grooming_records, pt_training_logs, pt_pet_photos. V3: pt_feeding_logs, pt_dietary_info, pt_food_transitions. V4: pt_exercise_goals, pt_insurance_policies, pt_insurance_claims, pt_expense_budgets, pt_grooming_intervals, pt_training_commands, pt_dismissed_alerts.

## Screens / User Flows
Mobile tabs: Pets, Health, Reminders, Settings. Stack screens (module-level): pet-detail, add-pet, vet-visit, vaccination. 17 mobile route files, 7 web route files (many deeper flows live behind tabs).

## Distinctive / Moat-worthy
- Core-vaccine schedule constants pre-seeded per species — automatic due-date reminders without any setup
- Full expense ledger + insurance + budget layer rarely found in consumer pet apps (usually separate vet-billing tools)
- Body condition score 1-9 (veterinary standard) rather than simple weight logs

## Gaps vs competitors
- No vet-portal telemedicine integration
- No social/community (11Pets, Pawsome) — by design
- Microchip is a field, not a registry lookup

## Investor-facing hook
11Pets + PetDesk + Tractive, privacy-first, bundled for free with the rest of the MyLife suite — pet owners already running 3 apps collapse into one.
