# Handoff: Build Out 13 Scaffolded MyLife Hub Modules

## Purpose

This document provides everything needed for someone (human or AI agent) to take any of the 13 scaffolded modules from stub to fully functional hub module. Each module already has `definition.ts`, `types.ts`, and `index.ts` but zero database schema, CRUD operations, or business logic.

## Prerequisites

- Read `/Users/trey/Desktop/Apps/MyLife/CLAUDE.md` for hub conventions
- Understand the Module System pattern (ModuleDefinition, SQLite with table prefixes, migration arrays)
- Reference a completed module as a template: `modules/workouts/` is the most comprehensive example (V3 schema, 11 tables, 40+ CRUD functions, 8 engines, 284 tests)

## Common Pattern (All 13 Modules Follow This)

### What Already Exists

Every module at `modules/<name>/` has:
- `src/definition.ts` -- ModuleDefinition with id, name, tagline, icon, tier, tablePrefix, navigation tabs/screens. But `migrations: []` and `schemaVersion: 0`.
- `src/types.ts` -- 2-4 starter Zod schemas for the core domain objects.
- `src/index.ts` -- Barrel export of definition + types.
- `package.json` -- Minimal with zod dep, peer deps on @mylife/db and @mylife/module-registry.

### What Needs To Be Built

For each module, in order:

#### Step 1: Expand Types (`src/types.ts`)
- Add input schemas (CreateXInput, UpdateXInput) with `.default()` for optional fields
- Add any enum schemas needed (categories, statuses, levels)
- Add computed/derived types if the module has engines
- Use `z.input<typeof Schema>` for input types where defaults exist (not `z.infer`)
- Export all types from the barrel

#### Step 2: Database Schema (`src/db/schema.ts`)
- Define CREATE TABLE statements using the module's table prefix
- All tables: `id TEXT PRIMARY KEY`, timestamps as `TEXT DEFAULT (datetime('now'))`
- Foreign keys with CASCADE delete where appropriate
- Add indexes for common query patterns (by date DESC, by parent FK)
- Reference the design spec for the full data model

#### Step 3: Migration (`src/definition.ts`)
- Create V1 migration object with `up` (CREATE TABLE + indexes) and `down` (DROP TABLE)
- Set `schemaVersion: 1`
- Add migration to the `migrations` array
- If the module needs multiple migration versions, add V2, V3, etc.

#### Step 4: CRUD Operations (`src/db/crud.ts`)
- Import `DatabaseAdapter` from `@mylife/db`
- Every function takes `(db: DatabaseAdapter, ...)` as first param
- Row mapper functions: `rowToX()` converts snake_case SQLite rows to camelCase TS objects
- Standard pattern: create, getById, list (with filters/pagination), update, delete
- Dashboard/aggregation functions if the module has a stats view
- Use `crypto.randomUUID()` for ID generation

#### Step 5: Business Logic Engines (if applicable)
- Pure functions with zero I/O dependencies
- Place in `src/<domain>/` subdirectories (e.g., `src/fuel/calculator.ts`)
- Keep engines separate from CRUD -- they should be testable without a database

#### Step 6: Update Barrel Export (`src/index.ts`)
- Re-export everything: definition, types, CRUD functions, engine functions, constants

#### Step 7: Tests (`src/**/__tests__/`)
- Use `createModuleTestDatabase('<name>', MODULE.migrations!)` from `@mylife/db`
- Call `closeDb()` in `afterEach`
- Test every CRUD function and every engine function
- Target: 15-30 tests per module minimum

#### Step 8: Module CLAUDE.md
- Use the `/module-claude-md-generator` skill or model after `modules/workouts/CLAUDE.md`
- Document: overview, exports, storage, engines, schemas, test coverage, key files

#### Step 9: Wire Into Host Apps
- Mobile: Create route group at `apps/mobile/app/(<name>)/` with screen files matching navigation tabs
- Web: Create route directory at `apps/web/app/<name>/` with page.tsx files
- Add `@mylife/<name>` dependency to both `apps/mobile/package.json` and `apps/web/package.json`
- Run `pnpm install` to link

#### Step 10: Update Parity Scripts
- Add module to `scripts/check-module-parity.mjs` if not already present
- Run `pnpm check:parity` to verify

### Quality Gate

Before marking a module complete:
```bash
pnpm typecheck                    # Zero errors
pnpm test -- --filter @mylife/<name>  # All tests pass
pnpm check:parity                 # Full parity suite passes
```

---

## Module Inventory

### Tier: FREE (4 modules)

#### 1. MyJournal (`modules/journal/`)
- **Prefix:** `jn_` | **Icon:** writing
- **Current types:** JournalEntry (id, date, title, body, tags[], mood, imageUris[]), JournalTag (id, name, color)
- **Design spec:** `docs/plans/2026-02-22-myjournal-design.md` (34 KB)
- **Key features from spec:** Markdown editor, FTS5 full-text search, mood tracking, biometric unlock, encrypted storage (SQLCipher), voice-to-journal (Whisper.cpp), daily writing streaks
- **Standalone:** MyJournal/ -- DESIGN.md only, no app code
- **Suggested tables:** `jn_entries`, `jn_tags`, `jn_entry_tags` (M2M), `jn_streaks`
- **Suggested engines:** Markdown parser, streak calculator, mood analytics
- **Complexity:** Medium (FTS5 search, encryption are non-trivial)

#### 2. MyMood (`modules/mood/`)
- **Prefix:** `mo_` | **Icon:** theater masks
- **Current types:** MoodLevel (great/good/okay/low/awful), MoodEntry (id, date, level, activities[], notes), MoodActivity (id, name, icon, isDefault)
- **Design spec:** `docs/plans/2026-02-22-mymood-design.md` (35 KB)
- **Key features from spec:** 5-point mood scale, activity tagging, mood trends/patterns, weekly insights, correlation analysis, mood streaks
- **Standalone:** MyMood/ -- DESIGN.md only
- **Suggested tables:** `mo_entries`, `mo_activities`, `mo_entry_activities` (M2M)
- **Suggested engines:** Trend calculator, correlation analyzer, streak tracker
- **Complexity:** Low-Medium

#### 3. MyNotes (`modules/notes/`)
- **Prefix:** `nt_` | **Icon:** memo
- **Current types:** Note (id, title, body, folderId, tags[], isPinned), NoteFolder (id, name, parentId)
- **Design spec:** `docs/plans/2026-02-22-mynotes-design.md` (38 KB)
- **Key features from spec:** Plain markdown, folder hierarchy, FTS5 search, tags, pinning, sort options, export to .md files
- **Standalone:** MyNotes/ -- DESIGN.md only
- **Suggested tables:** `nt_notes`, `nt_folders`, `nt_tags`, `nt_note_tags` (M2M)
- **Suggested engines:** FTS5 indexer, markdown renderer helpers
- **Complexity:** Low-Medium

#### 4. MyVoice (`modules/voice/`)
- **Prefix:** `vc_` | **Icon:** microphone
- **Current types:** Transcription (id, text, durationSeconds, language, confidence, audioUri), VoiceSetting (key, value)
- **Design spec:** Completed (in `docs/plans/done/`)
- **Key features:** On-device speech-to-text, transcription history, audio playback
- **Standalone:** MyVoice/ -- FULL ELECTRON APP (native Swift bridges, overlay UI). This is a macOS desktop app, not a mobile app. Hub module would be a mobile/web adaptation.
- **Suggested tables:** `vc_transcriptions`, `vc_settings`
- **Complexity:** High (native speech recognition APIs differ by platform)
- **Note:** The standalone is an Electron desktop app. Hub integration means building mobile speech recognition (expo-speech or Whisper.cpp) -- this is architecturally different from just porting business logic.

### Tier: PREMIUM (9 modules)

#### 5. MyCloset (`modules/closet/`)
- **Prefix:** `cl_` | **Icon:** dress
- **Current types:** ClothingCategory (8 values), ClothingItem (id, name, category, color, brand, costCents, imageUri, notes), Outfit (id, name, itemIds[], imageUri, notes)
- **Design spec:** `docs/plans/2026-02-22-mycloset-design.md` (58 KB) -- most detailed spec
- **Key features from spec:** On-device background removal, outfit builder, wardrobe analytics, cost-per-wear tracking, seasonal rotation, similar item detection
- **Standalone:** MyCloset/ -- DESIGN.md only
- **Suggested tables:** `cl_items`, `cl_outfits`, `cl_outfit_items` (M2M), `cl_wears`, `cl_categories`
- **Suggested engines:** Cost-per-wear calculator, wardrobe analytics, seasonal rotation logic
- **Complexity:** Medium-High (image processing for background removal)

#### 6. MyCycle (`modules/cycle/`)
- **Prefix:** `cy_` | **Icon:** crescent moon
- **Current types:** CyclePhase (menstrual/follicular/ovulation/luteal), FlowLevel (light/medium/heavy/spotting), CycleDay (id, date, phase, flowLevel, symptoms[], mood, notes), Cycle (id, startDate, endDate, lengthDays)
- **Design spec:** `docs/plans/2026-02-22-mycycle-design.md` (27 KB)
- **Key features from spec:** Period prediction, fertility window estimation, symptom tracking, cycle length analytics, PMS pattern recognition
- **Standalone:** MyCycle/ -- DESIGN.md only
- **Suggested tables:** `cy_days`, `cy_cycles`, `cy_symptoms`
- **Suggested engines:** Cycle predictor (average length), fertility window calculator, symptom pattern analyzer
- **Complexity:** Medium (prediction algorithms, medical data sensitivity)

#### 7. MyFlash (`modules/flash/`)
- **Prefix:** `fl_` | **Icon:** lightning
- **Current types:** Deck (id, name, description, cardCount, newCount, dueCount), CardRating (again/hard/good/easy), Flashcard (id, deckId, front, back, interval, ease, dueAt, reviewCount, lapseCount)
- **Design spec:** `docs/plans/2026-02-22-myflash-design.md` (31 KB)
- **Key features from spec:** SM-2 spaced repetition algorithm, deck management, review sessions, learning statistics, import/export (Anki format)
- **Standalone:** MyFlash/ -- DESIGN.md only
- **Suggested tables:** `fl_decks`, `fl_cards`, `fl_reviews` (review history), `fl_study_sessions`
- **Suggested engines:** SM-2 scheduler (calculate next review interval based on rating), study session state machine, deck statistics
- **Complexity:** Medium (SM-2 algorithm is well-documented but needs careful implementation)

#### 8. MyGarden (`modules/garden/`)
- **Prefix:** `gd_` | **Icon:** seedling
- **Current types:** PlantLocation (indoor/outdoor/greenhouse/balcony), Plant (id, name, species, location, imageUri, waterFrequencyDays, lastWatered, notes), GardenEntry (id, plantId, date, action, notes, imageUri)
- **Design spec:** `docs/plans/2026-02-22-mygarden-design.md` (27 KB)
- **Key features from spec:** Plant care tracking, watering schedules, garden journal, plant identification, seasonal planting guide, pest/disease log
- **Standalone:** MyGarden/ -- DESIGN.md only
- **Suggested tables:** `gd_plants`, `gd_entries`, `gd_schedules`, `gd_zones`
- **Suggested engines:** Watering reminder scheduler, growth tracker
- **Complexity:** Low-Medium

#### 9. MyMail (`modules/mail/`)
- **Prefix:** `ml_` | **Icon:** mailbox
- **Current types:** MailAccount (id, email, displayName, serverHost, serverPort, isActive), MailMessage (id, accountId, subject, from, to[], body, isRead, isStarred, folder, receivedAt)
- **Design spec:** None separate (standalone has extensive docs)
- **Key features:** Self-hosted email via Stalwart server, Docker deployment, SPF/DKIM/DMARC
- **Standalone:** MyMail/ -- FULL DOCKER-BASED EMAIL SERVER with admin UI, Caddy, Stalwart, Roundcube, rspamd
- **Suggested approach:** Hub module would be a client-side email viewer connecting to IMAP/SMTP, NOT a port of the server infrastructure. Focus on message display, compose, and folder management.
- **Complexity:** High (IMAP/SMTP protocol integration, authentication, server setup guidance)
- **Note:** This is fundamentally different from other modules. The standalone is server infrastructure; the hub module is a client app. Consider this a "connect to existing server" module rather than a consolidation.

#### 10. MyPets (`modules/pets/`)
- **Prefix:** `pt_` | **Icon:** paw prints
- **Current types:** PetSpecies (dog/cat/bird/fish/reptile/small_mammal/other), Pet (id, name, species, breed, birthDate, weightGrams, imageUri, notes), VetVisit (id, petId, date, reason, veterinarian, costCents, notes), Vaccination (id, petId, name, dateGiven, nextDueDate, notes)
- **Design spec:** `docs/plans/2026-02-22-mypets-design.md` (45 KB)
- **Key features from spec:** Pet profiles, vet visit log, vaccination tracker, medication reminders, weight tracking, feeding schedules, expense tracking
- **Standalone:** MyPets/ -- DESIGN.md only
- **Suggested tables:** `pt_pets`, `pt_vet_visits`, `pt_vaccinations`, `pt_medications`, `pt_weights`, `pt_feeding_schedules`
- **Suggested engines:** Vaccination reminder scheduler, weight trend analyzer, medication tracker
- **Complexity:** Medium (similar patterns to MyCar -- entity + logs + reminders)

#### 11. MyStars (`modules/stars/`)
- **Prefix:** `st_` | **Icon:** sparkles
- **Current types:** ZodiacSign (12 signs), BirthProfile (id, name, birthDate, birthTime, birthLat, birthLng, birthPlace, sunSign, moonSign, risingSign), Transit (id, profileId, date, planet, sign, aspect, description)
- **Design spec:** `docs/plans/2026-02-22-mystars-design.md` (41 KB)
- **Key features from spec:** Birth chart calculation, transit tracking, compatibility analysis, daily horoscope generation, planetary positions
- **Standalone:** MyStars/ -- DESIGN.md only
- **Suggested tables:** `st_profiles`, `st_transits`, `st_compatibility`, `st_horoscopes`
- **Suggested engines:** Birth chart calculator (planetary positions from ephemeris data), transit evaluator, compatibility scorer
- **Complexity:** High (astronomical calculations, ephemeris data, house system math)

#### 12. MySubs (`modules/subs/`)
- **Prefix:** `sb_` | **Icon:** credit card
- **Current types:** BillingCycle (weekly/monthly/quarterly/yearly/lifetime), Subscription (id, name, costCents, billingCycle, category, nextRenewalDate, startDate, iconUri, notes, isActive)
- **Design spec:** `docs/plans/2026-02-22-mysubs-design.md` (36 KB)
- **Key features from spec:** Subscription inventory, renewal calendar, cost dashboard, cancellation reminders, category grouping, annual spend projections
- **Standalone:** MySubs/ -- DESIGN.md only
- **Suggested tables:** `sb_subscriptions`, `sb_categories`, `sb_payment_history`
- **Suggested engines:** Renewal calculator, annual cost projector, cancellation value analyzer
- **Complexity:** Low (straightforward CRUD + date math)
- **Note:** MyBudget module already has a 215-entry subscription catalog and subscription tracking. Consider whether MySubs should be a standalone module or a view/feature within MyBudget. Review `modules/budget/` for overlap.

#### 13. MyTrails (`modules/trails/`)
- **Prefix:** `tr_` | **Icon:** hiking boot
- **Current types:** TrailDifficulty (easy/moderate/hard/expert), Trail (id, name, difficulty, distanceMeters, elevationGainMeters, estimatedMinutes, lat, lng, region, description, isSaved), TrailRecording (id, trailId, name, startedAt, endedAt, distanceMeters, elevationGainMeters, durationSeconds, gpxData)
- **Design spec:** `docs/plans/2026-02-22-mytrails-design.md` (40 KB)
- **Key features from spec:** Offline trail maps, GPS recording, elevation profiles, pace tracking, GPX import/export, offline tile downloads
- **Standalone:** MyTrails/ -- DESIGN.md only
- **Suggested tables:** `tr_trails`, `tr_recordings`, `tr_waypoints`, `tr_offline_regions`
- **Suggested engines:** GPX parser/generator, elevation profile calculator, pace analyzer, distance tracker
- **Complexity:** Medium-High (GPS tracking, offline maps, GPX format)
- **Note:** MySurf standalone has MyTrails integration (trail tab, hike summaries sync). Coordinate with MySurf consolidation.

---

## Recommended Build Order

**Batch 1 -- Quickest wins (Low complexity, well-defined scope):**
1. MySubs (but check MyBudget overlap first)
2. MyMood
3. MyNotes
4. MyGarden

**Batch 2 -- Medium complexity, good design specs:**
5. MyPets (similar to MyCar pattern)
6. MyJournal (FTS5 adds complexity)
7. MyFlash (SM-2 algorithm)
8. MyCloset

**Batch 3 -- Higher complexity, domain-specific challenges:**
9. MyCycle (prediction algorithms, sensitive data)
10. MyTrails (GPS, offline maps, GPX)
11. MyStars (astronomical calculations)

**Batch 4 -- Architecturally different:**
12. MyVoice (platform-specific speech APIs, not a simple port)
13. MyMail (server infrastructure vs client module)

## Available Skills

- `/hub-module-scaffold` -- Creates a new module from scratch (generates definition, schema, CRUD, routes, tests)
- `/module-claude-md-generator` -- Generates standardized CLAUDE.md for a module
- `/parity-check` -- Validates standalone vs module parity
- `/function-gate-runner` -- Runs quality gate on changed files
- `/domain-engine-benchmarker` -- Generates test suites for pure engine functions

## Reference Implementation

Use `modules/workouts/` as the gold standard:
- `src/types.ts` -- 30+ type definitions with z.input for defaults
- `src/db/schema.ts` -- 11 tables with indexes
- `src/db/crud.ts` -- 40+ CRUD functions with row mappers
- `src/workout/engine.ts` -- State machine (pure function)
- `src/workout/oneRM.ts` -- Calculator (pure function)
- `src/body-map.ts` -- Data mapping module
- `src/voice.ts` -- Command parser
- `src/progress.ts` -- Analytics engine
- 16 test files, 284 tests
- Comprehensive CLAUDE.md
